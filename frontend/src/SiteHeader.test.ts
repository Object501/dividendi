import { describe, expect, it } from "vitest";

import snapshotFixture from "../../collector/tests/fixtures/snapshot.json";
import { instruments } from "./config";
import { parseMarketSnapshot } from "./marketSnapshotCodec";
import { statusCopy } from "./SiteHeader";

describe("页面行情状态", () => {
	const snapshot = parseMarketSnapshot(snapshotFixture, instruments);

	it("明确标出本机缓存的上次有效行情时间", () => {
		const copy = statusCopy({
			data: snapshot,
			source: "local",
			status: "ready",
		});

		expect(copy).toContain("上次有效行情 8/28 15:05 · 本机缓存");
		expect(copy).not.toContain("正在更新");
	});

	it("区分浏览器行情时间、日终收盘时间和失败时的有效时间", () => {
		expect(
			statusCopy({ data: snapshot, source: "browser", status: "ready" }),
		).toContain("行情时间 8/28 15:05");
		expect(
			statusCopy({ data: snapshot, source: "history", status: "ready" }),
		).toContain("收盘时间 8/28 15:05");
		expect(
			statusCopy({
				data: snapshot,
				reason: "网络不可用",
				source: "local",
				status: "error",
			}),
		).toContain("上次有效行情 8/28 15:05");
	});
});
