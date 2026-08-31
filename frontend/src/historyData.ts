import { instruments } from "./config";
import { type HistoryData, parseHistoryData } from "./historyDocument";
import { fetchJson } from "./request";

const historyDataUrl =
	import.meta.env.VITE_HISTORY_URL ??
	`${import.meta.env.BASE_URL}data/history.json`;

export type HistoryDataState =
	| { readonly status: "idle" | "loading" | "error"; readonly data: null }
	| { readonly status: "ready"; readonly data: HistoryData };

let cached: HistoryData | null = null;
let pending: Promise<HistoryData> | null = null;
let state: HistoryDataState = { status: "idle", data: null };
const listeners = new Set<() => void>();

function publish(next: HistoryDataState): void {
	state = next;
	for (const listener of listeners) {
		listener();
	}
}

export function getHistoryDataState(): HistoryDataState {
	return state;
}

export function subscribeHistoryData(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export function loadHistoryData(refresh = false): Promise<HistoryData> {
	if (pending !== null) {
		return pending;
	}
	if (!refresh && cached !== null) {
		return Promise.resolve(cached);
	}
	if (cached === null) {
		publish({ status: "loading", data: null });
	}
	const request = fetchJson(historyDataUrl, "历史数据", { cache: "no-cache" })
		.then((value) => {
			const data = parseHistoryData(value, instruments);
			cached = data;
			publish({ status: "ready", data });
			return data;
		})
		.catch((error: unknown) => {
			if (cached === null) {
				publish({ status: "error", data: null });
			}
			throw error;
		})
		.finally(() => {
			if (pending === request) {
				pending = null;
			}
		});
	pending = request;
	return request;
}
