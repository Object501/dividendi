import { useCallback, useState } from "react";

import { instruments } from "./config";
import { type HistoryData, parseHistoryData } from "./data";

const historyDataUrl =
	import.meta.env.VITE_HISTORY_URL ??
	`${import.meta.env.BASE_URL}data/history.json`;

export type HistoryDataState =
	| { readonly status: "idle" | "loading" | "error"; readonly data: null }
	| { readonly status: "ready"; readonly data: HistoryData };

export function useHistoryData(): {
	readonly state: HistoryDataState;
	readonly load: () => Promise<void>;
} {
	const [state, setState] = useState<HistoryDataState>({
		status: "idle",
		data: null,
	});

	const load = useCallback(async () => {
		setState((current) =>
			current.status === "ready" ? current : { status: "loading", data: null },
		);
		try {
			const response = await fetch(historyDataUrl, { cache: "no-cache" });
			if (!response.ok) {
				throw new Error(`历史数据请求失败：${response.status}`);
			}
			const data = parseHistoryData(await response.json(), instruments);
			setState({ status: "ready", data });
		} catch {
			setState({ status: "error", data: null });
		}
	}, []);

	return { state, load };
}
