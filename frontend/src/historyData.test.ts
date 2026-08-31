import { afterEach, describe, expect, it, vi } from "vitest";

import snapshot from "../../collector/tests/fixtures/snapshot.json";

afterEach(() => {
	vi.unstubAllGlobals();
	vi.resetModules();
});

function responseWith(marketDate: string): Response {
	return new Response(
		JSON.stringify({
			schemaVersion: 1,
			snapshots: [{ ...snapshot, marketDate }],
		}),
		{ status: 200 },
	);
}

describe("history data store", () => {
	it("shares one request and publishes refreshed history to subscribers", async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(responseWith("2026-08-28"))
			.mockResolvedValueOnce(responseWith("2026-08-31"));
		vi.stubGlobal("fetch", fetcher);
		const store = await import("./historyData");
		const states: string[] = [];
		const unsubscribe = store.subscribeHistoryData(() => {
			const current = store.getHistoryDataState();
			states.push(
				current.status === "ready"
					? `${current.status}:${current.data.snapshots.at(-1)?.marketDate}`
					: current.status,
			);
		});

		const first = store.loadHistoryData();
		const shared = store.loadHistoryData();
		expect(shared).toBe(first);
		await first;
		await store.loadHistoryData(true);
		unsubscribe();

		expect(fetcher).toHaveBeenCalledTimes(2);
		expect(states).toEqual(["loading", "ready:2026-08-28", "ready:2026-08-31"]);
	});

	it("keeps the last good history when a background refresh fails", async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(responseWith("2026-08-28"))
			.mockResolvedValueOnce(new Response(null, { status: 404 }));
		vi.stubGlobal("fetch", fetcher);
		const store = await import("./historyData");

		await store.loadHistoryData();
		await expect(store.loadHistoryData(true)).rejects.toThrow(
			"历史数据请求失败：404",
		);

		expect(store.getHistoryDataState()).toMatchObject({
			status: "ready",
		});
	});
});
