import { describe, expect, it } from "vitest";

import latestFixture from "../collector/tests/fixtures/latest.json";
import { instruments } from "./config";
import { parseLatestData } from "./data";

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
