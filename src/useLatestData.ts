import { useCallback, useEffect, useRef, useState } from "react";

import { instruments } from "./config";
import { type LatestData, parseLatestData } from "./data";

const REFRESH_INTERVAL_MS = 60 * 60 * 1000;
const MINIMUM_REFRESH_GAP_MS = 5 * 60 * 1000;
const latestDataUrl =
	import.meta.env.VITE_DATA_URL ??
	`${import.meta.env.BASE_URL}data/latest.json`;

export type LatestDataState =
	| { readonly status: "loading"; readonly data: null }
	| { readonly status: "ready"; readonly data: LatestData }
	| { readonly status: "error"; readonly data: LatestData | null };

export function useLatestData(): LatestDataState {
	const [state, setState] = useState<LatestDataState>({
		status: "loading",
		data: null,
	});
	const lastAttempt = useRef(0);

	const refresh = useCallback(async () => {
		const now = Date.now();
		if (now - lastAttempt.current < MINIMUM_REFRESH_GAP_MS) {
			return;
		}
		lastAttempt.current = now;

		try {
			const response = await fetch(latestDataUrl, { cache: "no-cache" });
			if (!response.ok) {
				throw new Error(`行情请求失败：${response.status}`);
			}
			const data = parseLatestData(await response.json(), instruments);
			setState({ status: "ready", data });
		} catch {
			setState((current) => ({ status: "error", data: current.data }));
		}
	}, []);

	useEffect(() => {
		void refresh();
		const timer = window.setInterval(() => {
			if (document.visibilityState === "visible" && navigator.onLine) {
				void refresh();
			}
		}, REFRESH_INTERVAL_MS);

		return () => window.clearInterval(timer);
	}, [refresh]);

	return state;
}
