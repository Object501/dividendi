import type { InstrumentConfig } from "./config";
import {
	type MarketSnapshot,
	marketSnapshotJson,
	parseMarketSnapshot,
} from "./data";

const STORAGE_KEY = "dividendi:snapshot:v1";
const LEGACY_STORAGE_KEY = "dividendi:latest:v1";

interface KeyValueStorage {
	getItem(key: string): string | null;
	removeItem(key: string): void;
	setItem(key: string, value: string): void;
}

export function loadClientSnapshot(
	storage: KeyValueStorage,
	instruments: InstrumentConfig,
): MarketSnapshot | null {
	const current = storage.getItem(STORAGE_KEY);
	const encoded = current ?? storage.getItem(LEGACY_STORAGE_KEY);
	if (encoded === null) {
		return null;
	}
	try {
		const snapshot = parseMarketSnapshot(JSON.parse(encoded), instruments);
		if (current === null) {
			storage.setItem(
				STORAGE_KEY,
				JSON.stringify(marketSnapshotJson(snapshot)),
			);
			storage.removeItem(LEGACY_STORAGE_KEY);
		}
		return snapshot;
	} catch {
		storage.removeItem(current === null ? LEGACY_STORAGE_KEY : STORAGE_KEY);
		return null;
	}
}

export function saveClientSnapshot(
	storage: KeyValueStorage,
	data: MarketSnapshot,
): void {
	storage.setItem(STORAGE_KEY, JSON.stringify(marketSnapshotJson(data)));
}
