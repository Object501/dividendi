from __future__ import annotations

import json
import socket
import unittest
from datetime import date
from decimal import Decimal
from http.client import IncompleteRead
from pathlib import Path
from unittest.mock import MagicMock, call, patch
from urllib.error import HTTPError, URLError

from collector.dividendi_data.cninfo import (
    create_accept_enckey,
    fetch_dividend_payload,
    parse_dividend_payload,
)

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "cninfo_dividends.json"


class CNInfoDividendParserTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.payload = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))

    def test_creates_deterministic_request_token(self) -> None:
        self.assertEqual(create_accept_enckey(1_725_000_000), "4WmSKmLaMhHqtJeRLuilMA==")

    def test_parses_paid_cash_dividends_per_share(self) -> None:
        dividends = parse_dividend_payload(self.payload, "600000")

        self.assertEqual(len(dividends), 2)
        self.assertEqual(dividends[0].implementation_date, date(2025, 12, 10))
        self.assertEqual(dividends[0].per_share, Decimal("0.152"))
        self.assertEqual(dividends[0].fiscal_year, 2025)
        self.assertEqual(dividends[0].distribution_type, "中期分红")
        self.assertEqual(dividends[1].per_share, Decimal("0.335"))
        self.assertEqual(dividends[1].fiscal_year, 2025)
        self.assertEqual(dividends[1].distribution_type, "年度分红")

    def test_ignores_non_cash_and_unpaid_plans(self) -> None:
        dividends = parse_dividend_payload(self.payload, "600000")

        self.assertNotIn(date(2025, 9, 1), {item.implementation_date for item in dividends})

    def test_rejects_invalid_records_shape(self) -> None:
        with self.assertRaisesRegex(ValueError, "records 必须是数组"):
            parse_dividend_payload({"records": None}, "600000")


class CNInfoDividendFetchTest(unittest.TestCase):
    def setUp(self) -> None:
        self.payload = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
        self.response = MagicMock()
        self.response.__enter__.return_value = self.response
        self.response.read.return_value = json.dumps(self.payload).encode("utf-8")
        self.urlopen = self.enterContext(patch("collector.dividendi_data.cninfo.urlopen"))
        self.delay = self.enterContext(patch("collector.dividendi_data.cninfo.polite_delay"))

    def test_retries_dns_failure_with_fresh_token(self) -> None:
        self.urlopen.side_effect = [
            URLError(socket.gaierror(-5, "No address associated with hostname")),
            self.response,
        ]
        with (
            patch(
                "collector.dividendi_data.cninfo.create_accept_enckey",
                side_effect=["first-token", "second-token"],
            ),
            self.assertLogs("collector.dividendi_data.cninfo", level="WARNING") as logs,
        ):
            self.assertEqual(fetch_dividend_payload("600000", timeout=7), self.payload)

        self.assertIn("600000", logs.output[0])
        self.assertIn("No address associated with hostname", logs.output[0])
        self.delay.assert_called_once_with(2, 4)
        self.assertEqual(self.urlopen.call_count, 2)
        for attempt, token in zip(
            self.urlopen.call_args_list, ("first-token", "second-token"), strict=True
        ):
            request = attempt.args[0]
            self.assertTrue(request.full_url.endswith("?scode=600000"))
            self.assertEqual(request.get_method(), "POST")
            self.assertEqual(request.get_header("Accept-enckey"), token)
            self.assertEqual(attempt.kwargs, {"timeout": 7})

    def test_retries_transient_http_errors(self) -> None:
        for status in (408, 429, 500, 502, 503, 504):
            with self.subTest(status=status):
                self.urlopen.reset_mock()
                self.delay.reset_mock()
                self.urlopen.side_effect = [
                    HTTPError("https://webapi.cninfo.com.cn", status, "temporary", {}, None),
                    self.response,
                ]
                with self.assertLogs("collector.dividendi_data.cninfo", level="WARNING"):
                    self.assertEqual(fetch_dividend_payload("600000"), self.payload)
                self.assertEqual(self.urlopen.call_count, 2)
                self.delay.assert_called_once()

    def test_retries_timeout_and_interrupted_response(self) -> None:
        for error in (TimeoutError("timed out"), ConnectionResetError(), IncompleteRead(b"{")):
            with self.subTest(error=type(error).__name__):
                self.urlopen.reset_mock()
                self.delay.reset_mock()
                self.urlopen.return_value = self.response
                self.response.read.side_effect = [error, json.dumps(self.payload).encode("utf-8")]
                with self.assertLogs("collector.dividendi_data.cninfo", level="WARNING"):
                    self.assertEqual(fetch_dividend_payload("600000"), self.payload)
                self.assertEqual(self.urlopen.call_count, 2)
                self.delay.assert_called_once()

    def test_stops_after_four_attempts_with_last_error(self) -> None:
        errors = [URLError(f"DNS failure {index}") for index in range(4)]
        self.urlopen.side_effect = errors
        with (
            self.assertLogs("collector.dividendi_data.cninfo", level="WARNING") as logs,
            self.assertRaises(URLError) as raised,
        ):
            fetch_dividend_payload("600000")

        self.assertIs(raised.exception, errors[-1])
        self.assertEqual(self.urlopen.call_count, 4)
        self.assertEqual(self.delay.call_args_list, [call(2, 4), call(4, 8), call(8, 16)])
        self.assertEqual(len(logs.output), 3)

    def test_does_not_retry_permanent_http_errors(self) -> None:
        for status in (400, 401, 403, 404):
            with self.subTest(status=status):
                self.urlopen.reset_mock()
                error = HTTPError("https://webapi.cninfo.com.cn", status, "permanent", {}, None)
                self.urlopen.side_effect = error
                with self.assertRaises(HTTPError) as raised:
                    fetch_dividend_payload("600000")
                self.assertIs(raised.exception, error)
                self.urlopen.assert_called_once()
                self.delay.assert_not_called()

    def test_does_not_retry_invalid_json(self) -> None:
        self.urlopen.return_value = self.response
        self.response.read.return_value = b"not json"
        with self.assertRaises(json.JSONDecodeError):
            fetch_dividend_payload("600000")
        self.urlopen.assert_called_once()
        self.delay.assert_not_called()


if __name__ == "__main__":
    unittest.main()
