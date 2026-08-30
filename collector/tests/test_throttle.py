from __future__ import annotations

import unittest
from unittest.mock import patch

from collector.dividendi_data.throttle import polite_delay


class PoliteDelayTest(unittest.TestCase):
    @patch("collector.dividendi_data.throttle.sleep")
    @patch("collector.dividendi_data.throttle.uniform", return_value=1.25)
    def test_sleeps_for_random_value_inside_range(self, uniform, sleep) -> None:
        polite_delay(0.5, 2.0)

        uniform.assert_called_once_with(0.5, 2.0)
        sleep.assert_called_once_with(1.25)

    def test_rejects_invalid_range(self) -> None:
        with self.assertRaisesRegex(ValueError, "延时范围"):
            polite_delay(2, 1)


if __name__ == "__main__":
    unittest.main()
