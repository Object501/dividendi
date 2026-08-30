from __future__ import annotations

import unittest
from datetime import date

from collector.dividendi_data.calendar import (
    ContractMonth,
    active_contract_codes,
    active_contract_months,
    cffex_expiry,
    remaining_trading_days,
    third_friday,
)


class CffexCalendarTest(unittest.TestCase):
    def test_third_friday_without_holiday(self) -> None:
        self.assertEqual(third_friday(2026, 9), date(2026, 9, 18))
        self.assertEqual(cffex_expiry(2026, 9), date(2026, 9, 18))

    def test_expiry_moves_to_next_session_for_holiday(self) -> None:
        self.assertEqual(third_friday(2026, 6), date(2026, 6, 19))
        self.assertEqual(cffex_expiry(2026, 6), date(2026, 6, 22))

    def test_front_month_rolls_after_expiry(self) -> None:
        self.assertEqual(
            active_contract_months(date(2026, 8, 21)),
            (
                ContractMonth(2026, 8),
                ContractMonth(2026, 9),
                ContractMonth(2026, 12),
                ContractMonth(2027, 3),
            ),
        )
        self.assertEqual(
            active_contract_months(date(2026, 8, 22)),
            (
                ContractMonth(2026, 9),
                ContractMonth(2026, 10),
                ContractMonth(2026, 12),
                ContractMonth(2027, 3),
            ),
        )

    def test_contract_codes_use_configured_product(self) -> None:
        self.assertEqual(
            active_contract_codes("TEST", date(2026, 8, 30)),
            ("TEST2609", "TEST2610", "TEST2612", "TEST2703"),
        )

    def test_intraday_count_includes_snapshot_session(self) -> None:
        expiry = date(2026, 9, 18)
        self.assertEqual(remaining_trading_days(date(2026, 9, 1), expiry, intraday=True), 14)
        self.assertEqual(remaining_trading_days(date(2026, 9, 1), expiry, intraday=False), 13)

    def test_expired_contract_has_no_remaining_sessions(self) -> None:
        self.assertEqual(
            remaining_trading_days(date(2026, 9, 19), date(2026, 9, 18), intraday=True),
            0,
        )


if __name__ == "__main__":
    unittest.main()
