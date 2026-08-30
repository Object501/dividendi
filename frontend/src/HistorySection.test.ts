import { describe, expect, it } from "vitest";

import latestFixture from "../../collector/tests/fixtures/latest.json";
import { instruments } from "./config";
import { parseLatestData } from "./data";
import { futuresPoints, stockPoints } from "./HistorySection";

const snapshot = parseLatestData(latestFixture, instruments);
const history = { schemaVersion: 1 as const, snapshots: [snapshot] };

describe("history chart points", () => {
	it("pairs daily discount with the futures close", () => {
		const metric = snapshot.futures[0];
		expect(metric).toBeDefined();
		if (metric === undefined) {
			return;
		}

		expect(futuresPoints(history, metric.contractCode)).toEqual([
			{
				closePrice: metric.futuresPrice,
				date: snapshot.marketDate,
				metricValue: metric.dailyDiscountPoints,
			},
		]);
	});

	it("pairs dividend yield with the stock close", () => {
		const metric = snapshot.stocks[0];
		expect(metric).toBeDefined();
		if (metric === undefined) {
			return;
		}

		expect(stockPoints(history, `${metric.market}:${metric.code}`)).toEqual([
			{
				closePrice: metric.latestPrice,
				date: snapshot.marketDate,
				metricValue: metric.dividendYield * 100,
			},
		]);
	});

	it("pairs completed fiscal-year yield with the stock close", () => {
		const metric = snapshot.stocks[0];
		expect(metric).toBeDefined();
		if (metric === undefined) {
			return;
		}

		const referenceSnapshot = {
			...snapshot,
			stocks: snapshot.stocks.map((stock, index) =>
				index === 0
					? {
							...stock,
							completedFiscalYear: 2025,
							completedFiscalYearDividendPerShare: 0.5,
							completedFiscalYearDividendYield: 0.05,
						}
					: stock,
			),
		};

		expect(
			stockPoints(
				{ schemaVersion: 1, snapshots: [referenceSnapshot] },
				`${metric.market}:${metric.code}`,
				"reference",
			),
		).toEqual([
			{
				closePrice: metric.latestPrice,
				date: snapshot.marketDate,
				fiscalYear: 2025,
				metricValue: 5,
			},
		]);
	});
});
