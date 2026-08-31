import type { InstrumentConfig } from "./config";
import { type LatestData, latestDataJson, parseLatestData } from "./data";

const STORAGE_KEY = "dividendi:latest:v1";

interface KeyValueStorage {
	getItem(key: string): string | null;
	removeItem(key: string): void;
	setItem(key: string, value: string): void;
}

export function loadClientSnapshot(
	storage: KeyValueStorage,
	instruments: InstrumentConfig,
): LatestData | null {
	const encoded = storage.getItem(STORAGE_KEY);
	if (encoded === null) {
		return null;
	}
	try {
		return parseLatestData(JSON.parse(encoded), instruments);
	} catch {
		storage.removeItem(STORAGE_KEY);
		return null;
	}
}

export function saveClientSnapshot(
	storage: KeyValueStorage,
	data: LatestData,
): void {
	storage.setItem(STORAGE_KEY, JSON.stringify(latestDataJson(data)));
}
