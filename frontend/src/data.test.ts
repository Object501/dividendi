import { describe, expect, it } from "vitest";

import latestFixture from "../../collector/tests/fixtures/snapshot.json";
import { instruments } from "./config";
import { parseHistoryData, parseLatestData } from "./data";

describe("parseLatestData", () => {
	it("accepts the collector fixture", () => {
		const latest = parseLatestData(latestFixture, instruments);

		expect(latest.stocks).toHaveLength(instruments.stocks.length);
		expect(new Set(latest.futures.map((metric) => metric.productCode))).toEqual(
			new Set(instruments.futuresProducts.map((product) => product.code)),
		);
	});

	it("rejects an inconsistent daily discount", () => {
		expect(() =>
			parseLatestData(
				{
					...latestFixture,
					futures: [{ ...latestFixture.futures[0], dailyDiscountPoints: "2" }],
				},
				instruments,
			),
		).toThrow("dailyDiscountPoints 与贴水和剩余交易日不一致");
	});

	it("rejects fields outside the generated structural validator", () => {
		expect(() =>
			parseLatestData({ ...latestFixture, unexpected: true }, instruments),
		).toThrow("public-data-v1 JSON Schema");
	});

	it("lets the generated validator enforce fiscal-year field dependencies", () => {
		expect(() =>
			parseLatestData(
				{
					...latestFixture,
					stocks: [
						{ ...latestFixture.stocks[0], completedFiscalYear: 2025 },
						...latestFixture.stocks.slice(1),
					],
				},
				instruments,
			),
		).toThrow("public-data-v1 JSON Schema");
	});

	it("keeps dividend formulas as an independent semantic check", () => {
		expect(() =>
			parseLatestData(
				{
					...latestFixture,
					stocks: [
						{ ...latestFixture.stocks[0], dividendYield: "0.06" },
						...latestFixture.stocks.slice(1),
					],
				},
				instruments,
			),
		).toThrow("dividendYield 与分红和价格不一致");
	});

	it("rejects an incomplete stock list", () => {
		expect(() =>
			parseLatestData(
				{
					...latestFixture,
					stocks: latestFixture.stocks.slice(0, -1),
				},
				instruments,
			),
		).toThrow("股票行情必须完整覆盖配置");
	});

	it("rejects an extra stock", () => {
		expect(() =>
			parseLatestData(
				{
					...latestFixture,
					stocks: [...latestFixture.stocks, latestFixture.stocks[0]],
				},
				instruments,
			),
		).toThrow("股票行情必须完整覆盖配置");
	});
});

describe("parseHistoryData", () => {
	it("accepts strictly ordered snapshots inside the rolling window", () => {
		const history = parseHistoryData(
			{
				schemaVersion: 1,
				snapshots: [
					{
						...latestFixture,
						marketDate: "2026-08-27",
					},
					latestFixture,
				],
			},
			instruments,
		);

		expect(history.snapshots).toHaveLength(2);
	});

	it("rejects duplicate or descending dates", () => {
		expect(() =>
			parseHistoryData(
				{
					schemaVersion: 1,
					snapshots: [latestFixture, latestFixture],
				},
				instruments,
			),
		).toThrow("严格升序");
	});

	it("rejects snapshots on the excluded cutoff date", () => {
		expect(() =>
			parseHistoryData(
				{
					schemaVersion: 1,
					snapshots: [
						{ ...latestFixture, marketDate: "2025-08-28" },
						latestFixture,
					],
				},
				instruments,
			),
		).toThrow("超出 365 天");
	});
});
