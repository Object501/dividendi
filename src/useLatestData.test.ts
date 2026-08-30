import { describe, expect, it } from "vitest";

import { isChineseMarketRefreshWindow } from "./useLatestData";

describe("isChineseMarketRefreshWindow", () => {
	it("allows the weekday market refresh window", () => {
		expect(isChineseMarketRefreshWindow(new Date("2026-08-28T01:00:00Z"))).toBe(
			true,
		);
		expect(isChineseMarketRefreshWindow(new Date("2026-08-28T08:00:00Z"))).toBe(
			true,
		);
	});

	it("pauses overnight and on weekends", () => {
		expect(isChineseMarketRefreshWindow(new Date("2026-08-28T00:59:00Z"))).toBe(
			false,
		);
		expect(isChineseMarketRefreshWindow(new Date("2026-08-30T02:00:00Z"))).toBe(
			false,
		);
	});
});
