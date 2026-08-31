import { useCallback, useEffect, useRef, useState } from "react";

import { loadClientSnapshot, saveClientSnapshot } from "./clientSnapshot";
import { instruments } from "./config";
import type { LatestData } from "./data";
import {
	discoverEastmoneyContracts,
	type EastmoneyContract,
	fetchEastmoneyQuotes,
	mergeEastmoneyQuotes,
} from "./eastmoney";
import { loadHistoryData } from "./historyData";
import { fetchTradingCalendar, type TradingCalendar } from "./tradingCalendar";

const REFRESH_INTERVAL_MS = 60 * 60 * 1000;
const MINIMUM_REFRESH_GAP_MS = 5 * 60 * 1000;
const marketClock = new Intl.DateTimeFormat("en-CA", {
	hour: "2-digit",
	hour12: false,
	minute: "2-digit",
	timeZone: "Asia/Shanghai",
	weekday: "short",
});
const marketDate = new Intl.DateTimeFormat("en-CA", {
	day: "2-digit",
	month: "2-digit",
	timeZone: "Asia/Shanghai",
	year: "numeric",
});

export type LatestDataState =
	| { readonly status: "loading"; readonly data: null }
	| { readonly status: "ready"; readonly data: LatestData }
	| {
			readonly status: "error";
			readonly data: LatestData | null;
			readonly reason: string;
	  };

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

function currentMarketDate(now: Date): string {
	const parts = Object.fromEntries(
		marketDate
			.formatToParts(now)
			.filter((part) => part.type !== "literal")
			.map((part) => [part.type, part.value]),
	);
	return `${parts.year}-${parts.month}-${parts.day}`;
}

function storedSnapshot(): LatestData | null {
	try {
		return loadClientSnapshot(window.localStorage, instruments);
	} catch {
		return null;
	}
}

function persistSnapshot(data: LatestData): void {
	try {
		saveClientSnapshot(window.localStorage, data);
	} catch {
		// Storage may be unavailable or full. The in-memory snapshot still works.
	}
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : "未知错误";
}

export function useLatestData(): LatestDataState {
	const initial = useRef<LatestData | null | undefined>(undefined);
	if (initial.current === undefined) {
		initial.current = storedSnapshot();
	}
	const [state, setState] = useState<LatestDataState>(() =>
		initial.current === null
			? { status: "loading", data: null }
			: { status: "ready", data: initial.current as LatestData },
	);
	const baseline = useRef<LatestData | null>(null);
	const calendar = useRef<TradingCalendar | null>(null);
	const contracts = useRef<readonly EastmoneyContract[] | null>(null);
	const contractsDate = useRef<string | null>(null);
	const historyRequestDate = useRef<string | null>(null);
	const lastGood = useRef<LatestData | null>(initial.current ?? null);
	const lastAttempt = useRef(0);

	const refresh = useCallback(async () => {
		const now = Date.now();
		if (now - lastAttempt.current < MINIMUM_REFRESH_GAP_MS) {
			return;
		}
		lastAttempt.current = now;
		const today = currentMarketDate(new Date(now));

		try {
			const history = await loadHistoryData(
				historyRequestDate.current !== null &&
					historyRequestDate.current !== today,
			);
			const daily = history.snapshots.at(-1);
			if (daily === undefined) {
				throw new Error("历史数据没有日终快照");
			}
			historyRequestDate.current = today;
			const basisAdvanced =
				baseline.current === null ||
				daily.marketDate > baseline.current.marketDate;
			const shouldAdoptDaily =
				basisAdvanced &&
				(lastGood.current === null ||
					daily.marketDate >= lastGood.current.marketDate);
			baseline.current = daily;
			if (shouldAdoptDaily) {
				lastGood.current = daily;
				persistSnapshot(daily);
				setState({ status: "ready", data: daily });
			}
		} catch {
			// A validated local snapshot can still be refreshed with browser quotes.
		}

		const basis = baseline.current ?? lastGood.current;
		if (basis === null) {
			setState({ status: "error", data: null, reason: "无法读取历史基准" });
			return;
		}

		try {
			try {
				calendar.current ??= await fetchTradingCalendar();
			} catch {
				throw new Error("休市日历请求失败");
			}
			if (contracts.current === null || contractsDate.current !== today) {
				try {
					contracts.current = await discoverEastmoneyContracts(instruments);
				} catch {
					throw new Error("期货合约目录请求失败");
				}
				contractsDate.current = today;
			}
			const quotes = await fetchEastmoneyQuotes(instruments, contracts.current);
			const live = mergeEastmoneyQuotes(
				basis,
				quotes,
				instruments,
				calendar.current,
			);
			lastGood.current = live;
			persistSnapshot(live);
			setState({ status: "ready", data: live });
		} catch (error) {
			calendar.current = null;
			contracts.current = null;
			contractsDate.current = null;
			setState({
				status: "error",
				data: lastGood.current,
				reason: errorMessage(error),
			});
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
		const timer = window.setInterval(refreshIfActive, REFRESH_INTERVAL_MS);
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
