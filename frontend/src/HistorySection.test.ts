import { describe, expect, it } from "vitest";

import snapshotFixture from "../../collector/tests/fixtures/snapshot.json";
import { instruments } from "./config";
import { parseMarketSnapshot } from "./data";
import {
	fiscalYearTransitions,
	futuresPoints,
	stockPoints,
} from "./HistorySection";

const snapshot = parseMarketSnapshot(snapshotFixture, instruments);
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
							completedFiscalYear: {
								dividendPerShare: 0.5,
								dividendYield: 0.05,
								fiscalYear: 2025,
							},
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

	it("locates completed fiscal-year transitions", () => {
		expect(
			fiscalYearTransitions([
				{
					closePrice: 10,
					date: "2026-06-24",
					fiscalYear: 2024,
					metricValue: 10,
				},
				{
					closePrice: 11,
					date: "2026-06-25",
					fiscalYear: 2024,
					metricValue: 9,
				},
				{
					closePrice: 12,
					date: "2026-06-26",
					fiscalYear: 2025,
					metricValue: 8,
				},
				{
					closePrice: 13,
					date: "2026-06-29",
					fiscalYear: 2025,
					metricValue: 7,
				},
			]),
		).toEqual([
			{
				date: "2026-06-26",
				fromFiscalYear: 2024,
				toFiscalYear: 2025,
			},
		]);
	});
});
