import { useCallback, useEffect, useRef, useState } from "react";

import { instruments } from "./config";
import { type LatestData, parseLatestData } from "./data";

const REFRESH_INTERVAL_MS = 60 * 60 * 1000;
const MINIMUM_REFRESH_GAP_MS = 5 * 60 * 1000;
const marketClock = new Intl.DateTimeFormat("en-CA", {
	hour: "2-digit",
	hour12: false,
	minute: "2-digit",
	timeZone: "Asia/Shanghai",
	weekday: "short",
});
const latestDataUrl =
	import.meta.env.VITE_DATA_URL ??
	`${import.meta.env.BASE_URL}data/latest.json`;

export type LatestDataState =
	| { readonly status: "loading"; readonly data: null }
	| { readonly status: "ready"; readonly data: LatestData }
	| { readonly status: "error"; readonly data: LatestData | null };

export function isChineseMarketRefreshWindow(now: Date): boolean {
	const parts = Object.fromEntries(
		marketClock
			.formatToParts(now)
			.filter((part) => part.type !== "literal")
			.map((part) => [part.type, part.value]),
	);
	if (parts.weekday === "Sat" || parts.weekday === "Sun") {
		return false;
	}
	const minutes = Number(parts.hour) * 60 + Number(parts.minute);
	return minutes >= 9 * 60 && minutes <= 16 * 60;
}

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
			const response = await fetch(latestDataUrl, { cache: "no-store" });
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
		const refreshIfActive = () => {
			if (
				document.visibilityState === "visible" &&
				navigator.onLine &&
				isChineseMarketRefreshWindow(new Date())
			) {
				void refresh();
			}
		};
		const timer = window.setInterval(() => {
			refreshIfActive();
		}, REFRESH_INTERVAL_MS);
		document.addEventListener("visibilitychange", refreshIfActive);
		window.addEventListener("online", refreshIfActive);

		return () => {
			window.clearInterval(timer);
			document.removeEventListener("visibilitychange", refreshIfActive);
			window.removeEventListener("online", refreshIfActive);
		};
	}, [refresh]);

	return state;
}
