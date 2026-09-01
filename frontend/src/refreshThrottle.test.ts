import { describe, expect, it } from "vitest";

import {
	claimRefreshAttempt,
	MINIMUM_MARKET_REFRESH_GAP_MS,
} from "./refreshThrottle";

class MemoryStorage {
	private readonly values = new Map<string, string>();

	getItem(key: string): string | null {
		return this.values.get(key) ?? null;
	}

	setItem(key: string, value: string): void {
		this.values.set(key, value);
	}
}

describe("行情刷新限流", () => {
	it("跨页面实例保留最小刷新间隔", () => {
		const storage = new MemoryStorage();

		expect(
			claimRefreshAttempt(storage, 1_000_000, MINIMUM_MARKET_REFRESH_GAP_MS),
		).toBe(true);
		expect(
			claimRefreshAttempt(storage, 1_000_001, MINIMUM_MARKET_REFRESH_GAP_MS),
		).toBe(false);
		expect(
			claimRefreshAttempt(
				storage,
				1_000_000 + MINIMUM_MARKET_REFRESH_GAP_MS,
				MINIMUM_MARKET_REFRESH_GAP_MS,
			),
		).toBe(true);
	});

	it("损坏或未来的时间戳不会永久阻止刷新", () => {
		const storage = new MemoryStorage();
		storage.setItem("dividendi:market-refresh-attempt:v1", "invalid");
		expect(claimRefreshAttempt(storage, 2_000_000, 300_000)).toBe(true);

		storage.setItem("dividendi:market-refresh-attempt:v1", "3000000");
		expect(claimRefreshAttempt(storage, 2_000_000, 300_000)).toBe(true);
		expect(claimRefreshAttempt(storage, 2_000_001, 300_000)).toBe(false);
	});

	it("存储不可用时交给页面内存限流", () => {
		const storage = {
			getItem: () => {
				throw new Error("storage blocked");
			},
			setItem: () => {
				throw new Error("storage blocked");
			},
		};

		expect(claimRefreshAttempt(storage, 1_000_000, 300_000)).toBe(true);
	});
});
