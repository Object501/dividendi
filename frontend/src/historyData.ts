import { instruments } from "./config";
import { type HistoryData, parseHistoryData } from "./data";

const historyDataUrl =
	import.meta.env.VITE_HISTORY_URL ??
	`${import.meta.env.BASE_URL}data/history.json`;

let pending: Promise<HistoryData> | null = null;

export function loadHistoryData(refresh = false): Promise<HistoryData> {
	if (refresh) {
		pending = null;
	}
	if (pending !== null) {
		return pending;
	}
	pending = fetch(historyDataUrl, { cache: "no-cache" })
		.then(async (response) => {
			if (!response.ok) {
				throw new Error(`历史数据请求失败：${response.status}`);
			}
			return parseHistoryData(await response.json(), instruments);
		})
		.catch((error: unknown) => {
			pending = null;
			throw error;
		});
	return pending;
}
