import { describe, expect, it, vi } from "vitest";

import snapshotFixture from "../../collector/tests/fixtures/snapshot.json";
import { instruments } from "./config";
import { EastmoneyQuotesNotReadyError } from "./eastmoney";
import { parseMarketSnapshot } from "./marketSnapshotCodec";
import {
	type MarketSnapshotRefreshDependencies,
	MarketSnapshotRefresher,
} from "./marketSnapshotRefresh";
import type { MarketSnapshotState } from "./marketSnapshotState";

const daily = parseMarketSnapshot(snapshotFixture, instruments);
const live = { ...daily, fetchedAt: "2026-08-28T07:20:00Z" };
const calendar = {
	closedDates: new Set<string>(),
	coveredYears: new Set<number>(),
};
const contracts = [
	{ contractCode: "IM2609", market: "220", productCode: "IM" },
];
const quotes = {
	fetchedAt: live.fetchedAt,
	futures: [],
	marketDate: live.marketDate,
	spots: [],
};

function dependencies(
	overrides: Partial<MarketSnapshotRefreshDependencies> = {},
): MarketSnapshotRefreshDependencies {
	return {
		discoverContracts: vi.fn().mockResolvedValue(contracts),
		fetchCalendar: vi.fn().mockResolvedValue(calendar),
		fetchQuotes: vi.fn().mockResolvedValue(quotes),
		loadHistory: vi
			.fn()
			.mockResolvedValue({ schemaVersion: 1, snapshots: [daily] }),
		mergeQuotes: vi.fn().mockReturnValue(live),
		persist: vi.fn(),
		...overrides,
	};
}

describe("market snapshot refresher", () => {
	it("publishes the daily basis before browser quotes and reuses daily metadata", async () => {
		const states: MarketSnapshotState[] = [];
		const deps = dependencies();
		const refresher = new MarketSnapshotRefresher(
			null,
			(state) => states.push(state),
			deps,
		);
		const signal = new AbortController().signal;

		await refresher.refresh("2026-08-31", signal);
		await refresher.refresh("2026-08-31", signal);
		await refresher.refresh("2026-09-01", signal);

		expect(states.map((state) => state.status)).toEqual([
			"ready",
			"ready",
			"ready",
			"ready",
		]);
		expect(
			states.map((state) => (state.status === "ready" ? state.source : null)),
		).toEqual(["history", "browser", "browser", "browser"]);
		expect(deps.loadHistory).toHaveBeenNthCalledWith(1, false);
		expect(deps.loadHistory).toHaveBeenNthCalledWith(2, false);
		expect(deps.loadHistory).toHaveBeenNthCalledWith(3, true);
		expect(deps.fetchCalendar).toHaveBeenCalledTimes(1);
		expect(deps.discoverContracts).toHaveBeenCalledTimes(2);
		expect(deps.persist).toHaveBeenCalledTimes(4);
	});

	it("preserves the last good snapshot and retries provider metadata", async () => {
		const states: MarketSnapshotState[] = [];
		const fetchCalendar = vi.fn().mockRejectedValue(new Error("offline"));
		const deps = dependencies({
			fetchCalendar,
			loadHistory: vi.fn().mockRejectedValue(new Error("history offline")),
		});
		const refresher = new MarketSnapshotRefresher(
			{ data: daily, source: "local" },
			(state) => states.push(state),
			deps,
		);
		const signal = new AbortController().signal;

		await refresher.refresh("2026-08-31", signal);
		await refresher.refresh("2026-08-31", signal);

		expect(fetchCalendar).toHaveBeenCalledTimes(2);
		expect(states).toHaveLength(2);
		expect(states[1]).toMatchObject({
			data: daily,
			reason: "休市日历请求失败",
			source: "local",
			status: "error",
		});
	});

	it("reports a missing basis without contacting quote providers", async () => {
		const states: MarketSnapshotState[] = [];
		const deps = dependencies({
			loadHistory: vi.fn().mockRejectedValue(new Error("history offline")),
		});
		const refresher = new MarketSnapshotRefresher(
			null,
			(state) => states.push(state),
			deps,
		);

		await refresher.refresh("2026-08-31", new AbortController().signal);

		expect(states).toEqual([
			{
				data: null,
				reason: "无法读取历史基准",
				source: null,
				status: "error",
			},
		]);
		expect(deps.fetchCalendar).not.toHaveBeenCalled();
		expect(deps.fetchQuotes).not.toHaveBeenCalled();
	});

	it("keeps the ready history state while delayed markets synchronize", async () => {
		const states: MarketSnapshotState[] = [];
		const deps = dependencies({
			fetchQuotes: vi
				.fn()
				.mockRejectedValue(
					new EastmoneyQuotesNotReadyError("东方财富各市场行情尚未同步"),
				),
		});
		const refresher = new MarketSnapshotRefresher(
			null,
			(state) => states.push(state),
			deps,
		);

		await refresher.refresh("2026-08-31", new AbortController().signal);

		expect(states).toEqual([
			{ data: daily, source: "history", status: "ready" },
		]);
	});
});
