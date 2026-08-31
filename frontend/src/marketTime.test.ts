import { describe, expect, it } from "vitest";

import {
	isChineseMarketRefreshWindow,
	shanghaiDate,
	tradingDayPhase,
} from "./marketTime";

describe("Shanghai market time", () => {
	it("formats dates and distinguishes intraday from EOD", () => {
		expect(shanghaiDate(new Date("2026-08-31T02:00:00Z"))).toBe("2026-08-31");
		expect(tradingDayPhase("2026-08-31T06:59:00Z")).toBe("intraday");
		expect(tradingDayPhase("2026-08-31T07:00:00Z")).toBe("eod");
	});

	it("allows only the weekday market refresh window", () => {
		expect(isChineseMarketRefreshWindow(new Date("2026-08-28T01:00:00Z"))).toBe(
			true,
		);
		expect(isChineseMarketRefreshWindow(new Date("2026-08-28T08:00:00Z"))).toBe(
			true,
		);
		expect(isChineseMarketRefreshWindow(new Date("2026-08-28T00:59:00Z"))).toBe(
			false,
		);
		expect(isChineseMarketRefreshWindow(new Date("2026-08-30T02:00:00Z"))).toBe(
			false,
		);
	});
});
