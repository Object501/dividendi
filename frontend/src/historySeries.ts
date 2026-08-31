import type { HistoryData } from "./historyDocument";
import type { FiscalYearTransition } from "./MetricLineChart";
import type { MarketSnapshot } from "./marketSnapshotTypes";

export type DividendBasis = "reference" | "trailing";
export type RangeDays = 31 | 92 | 365;

export interface TrendPoint {
	readonly closePrice: number;
	readonly date: string;
	readonly fiscalYear?: number;
	readonly metricValue: number;
}

export function filterRange(
	points: readonly TrendPoint[],
	history: HistoryData,
	rangeDays: RangeDays,
): readonly TrendPoint[] {
	const newestDate = history.snapshots.at(-1)?.marketDate;
	if (newestDate === undefined) {
		return [];
	}
	const cutoff = new Date(`${newestDate}T00:00:00Z`);
	cutoff.setUTCDate(cutoff.getUTCDate() - rangeDays);
	const cutoffDate = cutoff.toISOString().slice(0, 10);
	return points.filter((point) => point.date > cutoffDate);
}

export function currentContracts(
	history: HistoryData,
	currentSnapshot: MarketSnapshot | null,
): readonly string[] {
	const newest = history.snapshots.at(-1);
	const source =
		currentSnapshot?.marketDate === newest?.marketDate
			? currentSnapshot
			: newest;
	return [
		...new Set(source?.futures.map((metric) => metric.contractCode) ?? []),
	];
}

export function futuresPoints(
	history: HistoryData,
	contractCode: string,
): readonly TrendPoint[] {
	return history.snapshots.flatMap((snapshot) => {
		const metric = snapshot.futures.find(
			(candidate) => candidate.contractCode === contractCode,
		);
		return metric === undefined
			? []
			: [
					{
						closePrice: metric.futuresPrice,
						date: snapshot.marketDate,
						metricValue: metric.dailyDiscountPoints,
					},
				];
	});
}

export function stockPoints(
	history: HistoryData,
	stockKey: string,
	basis: DividendBasis = "trailing",
): readonly TrendPoint[] {
	return history.snapshots.flatMap((snapshot) => {
		const metric = snapshot.stocks.find(
			(candidate) => `${candidate.market}:${candidate.code}` === stockKey,
		);
		const metricValue =
			basis === "reference"
				? metric?.completedFiscalYear?.dividendYield
				: metric?.dividendYield;
		return metric === undefined || metricValue === undefined
			? []
			: [
					{
						closePrice: metric.latestPrice,
						date: snapshot.marketDate,
						...(basis === "reference" &&
						metric.completedFiscalYear !== undefined
							? { fiscalYear: metric.completedFiscalYear.fiscalYear }
							: {}),
						metricValue: metricValue * 100,
					},
				];
	});
}

export function fiscalYearTransitions(
	points: readonly TrendPoint[],
): readonly FiscalYearTransition[] {
	return points.flatMap((point, index) => {
		const previous = points[index - 1];
		return previous?.fiscalYear !== undefined &&
			point.fiscalYear !== undefined &&
			previous.fiscalYear !== point.fiscalYear
			? [
					{
						date: point.date,
						fromFiscalYear: previous.fiscalYear,
						toFiscalYear: point.fiscalYear,
					},
				]
			: [];
	});
}
