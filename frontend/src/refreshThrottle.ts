const STORAGE_KEY = "dividendi:market-refresh-attempt:v1";
export const MINIMUM_MARKET_REFRESH_GAP_MS = 5 * 60 * 1000;

interface TimestampStorage {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
}

export function claimRefreshAttempt(
	storage: TimestampStorage,
	now: number,
	minimumGap: number,
): boolean {
	try {
		const encoded = storage.getItem(STORAGE_KEY);
		if (encoded !== null) {
			const previous = Number(encoded);
			if (
				Number.isFinite(previous) &&
				previous >= 0 &&
				previous <= now &&
				now - previous < minimumGap
			) {
				return false;
			}
		}
		storage.setItem(STORAGE_KEY, String(now));
	} catch {
		// The hook's in-memory guard still limits this page when storage is blocked.
	}
	return true;
}
