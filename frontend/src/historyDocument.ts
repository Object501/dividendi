import type { InstrumentConfig } from "./config";
import { validateHistoryDocument } from "./generated/publicDataValidators.js";
import { parseMarketSnapshotStructure } from "./marketSnapshotCodec";
import type { MarketSnapshot } from "./marketSnapshotTypes";
import { assertStructure } from "./publicDataValidation";

export interface HistoryData {
	readonly schemaVersion: 1;
	readonly snapshots: readonly MarketSnapshot[];
}

export function parseHistoryData(
	value: unknown,
	instruments: InstrumentConfig,
): HistoryData {
	assertStructure(value, validateHistoryDocument, "history");
	const record = value as Record<string, unknown>;
	const snapshots = (record.snapshots as readonly unknown[]).map((snapshot) =>
		parseMarketSnapshotStructure(snapshot, instruments),
	);
	const dates = snapshots.map((snapshot) => snapshot.marketDate);
	if (
		dates.some((marketDate, index) => {
			const previousDate = dates[index - 1];
			return previousDate !== undefined && marketDate <= previousDate;
		})
	) {
		throw new Error("历史快照必须按交易日严格升序排列");
	}
	const millisecondsPerDay = 24 * 60 * 60 * 1000;
	const newestDate = dates.at(-1);
	if (newestDate === undefined) {
		throw new Error("history.snapshots 必须是非空数组");
	}
	const newest = Date.parse(`${newestDate}T00:00:00Z`);
	const cutoff = newest - 365 * millisecondsPerDay;
	if (
		dates.some((marketDate) => Date.parse(`${marketDate}T00:00:00Z`) <= cutoff)
	) {
		throw new Error("历史快照超出 365 天滚动窗口");
	}
	return { schemaVersion: 1, snapshots };
}
