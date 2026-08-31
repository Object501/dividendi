import { describe, expect, it } from "vitest";

import {
	contractExpiry,
	elapsedTradingDays,
	parseTradingCalendar,
	remainingTradingDays,
} from "./tradingCalendar";

const calendar = parseTradingCalendar({
	success: true,
	result: {
		data: [
			{
				MKT: "A股",
				HOLIDAY: "测试休市",
				SDATE: "2026-09-18 00:00:00",
				EDATE: "2026-09-18 00:00:00",
			},
			{
				MKT: "A股",
				HOLIDAY: "中秋节",
				SDATE: "2026-09-25 00:00:00",
				EDATE: "2026-09-25 00:00:00",
			},
			{
				MKT: "A股",
				HOLIDAY: "元旦",
				SDATE: "2027-01-01 00:00:00",
				EDATE: "2027-01-01 00:00:00",
			},
		],
	},
});

describe("trading calendar", () => {
	it("counts only published trading sessions", () => {
		expect(
			remainingTradingDays("2026-09-23", "2026-09-28", true, calendar),
		).toBe(3);
		expect(
			remainingTradingDays("2026-09-23", "2026-09-28", false, calendar),
		).toBe(2);
	});

	it("moves an expiry on a closed third Friday", () => {
		expect(contractExpiry("IM", "IM2609", calendar)).toBe("2026-09-21");
	});

	it("adjusts an EOD baseline only for elapsed sessions", () => {
		expect(
			elapsedTradingDays(
				"2026-09-23",
				"eod",
				"2026-09-28",
				"intraday",
				calendar,
			),
		).toBe(1);
		expect(
			elapsedTradingDays("2026-09-23", "eod", "2026-09-28", "eod", calendar),
		).toBe(2);
	});

	it("advances a same-day intraday snapshot after the close", () => {
		expect(
			elapsedTradingDays(
				"2026-09-23",
				"intraday",
				"2026-09-23",
				"eod",
				calendar,
			),
		).toBe(1);
		expect(
			elapsedTradingDays("2026-09-23", "eod", "2026-09-23", "eod", calendar),
		).toBe(0);
	});

	it("rejects years without a published holiday calendar", () => {
		expect(() =>
			remainingTradingDays("2028-01-03", "2028-01-21", true, calendar),
		).toThrow("尚未公布 2028 年");
	});
});
