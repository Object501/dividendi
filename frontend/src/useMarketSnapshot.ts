import { useCallback, useEffect, useRef, useState } from "react";

import { loadClientSnapshot, saveClientSnapshot } from "./clientSnapshot";
import { instruments } from "./config";
import { discoverEastmoneyContracts, fetchEastmoneyQuotes } from "./eastmoney";
import type { EastmoneyContract } from "./eastmoneyTypes";
import { loadHistoryData } from "./historyData";
import type { MarketSnapshot } from "./marketSnapshotTypes";
import {
	isChineseMarketRefreshWindow,
	shanghaiDate,
	tradingDayPhase,
} from "./marketTime";
import { mergeEastmoneyQuotes } from "./mergeEastmoneyQuotes";
import { fetchTradingCalendar, type TradingCalendar } from "./tradingCalendar";

const REFRESH_INTERVAL_MS = 60 * 60 * 1000;
const MINIMUM_REFRESH_GAP_MS = 5 * 60 * 1000;
export type MarketSnapshotState =
	| { readonly status: "loading"; readonly data: null }
	| {
			readonly status: "ready";
			readonly data: MarketSnapshot;
			readonly source: MarketSnapshotSource;
	  }
	| {
			readonly status: "error";
			readonly data: MarketSnapshot | null;
			readonly reason: string;
			readonly source: MarketSnapshotSource | null;
	  };

export type MarketSnapshotSource = "browser" | "history" | "local";

interface LastGoodData {
	readonly data: MarketSnapshot;
	readonly source: MarketSnapshotSource;
}

function storedSnapshot(): MarketSnapshot | null {
	try {
		return loadClientSnapshot(window.localStorage, instruments);
	} catch {
		return null;
	}
}

function persistSnapshot(data: MarketSnapshot): void {
	try {
		saveClientSnapshot(window.localStorage, data);
	} catch {
		// Storage may be unavailable or full. The in-memory snapshot still works.
	}
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : "未知错误";
}

export function useMarketSnapshot(): MarketSnapshotState {
	const initial = useRef<MarketSnapshot | null | undefined>(undefined);
	if (initial.current === undefined) {
		initial.current = storedSnapshot();
	}
	const [state, setState] = useState<MarketSnapshotState>(() =>
		initial.current === null
			? { status: "loading", data: null }
			: {
					status: "ready",
					data: initial.current as MarketSnapshot,
					source: "local",
				},
	);
	const baseline = useRef<MarketSnapshot | null>(null);
	const calendar = useRef<TradingCalendar | null>(null);
	const contracts = useRef<readonly EastmoneyContract[] | null>(null);
	const contractsDate = useRef<string | null>(null);
	const historyRequestDate = useRef<string | null>(null);
	const lastGood = useRef<LastGoodData | null>(
		initial.current === null || initial.current === undefined
			? null
			: { data: initial.current, source: "local" },
	);
	const lastAttempt = useRef(0);
	const inFlight = useRef<Promise<void> | null>(null);
	const activeRequest = useRef<AbortController | null>(null);
	const mounted = useRef(false);

	const refresh = useCallback(() => {
		const now = Date.now();
		if (inFlight.current !== null) {
			if (activeRequest.current?.signal.aborted !== true) {
				return;
			}
			inFlight.current = null;
			lastAttempt.current = 0;
		}
		if (now - lastAttempt.current < MINIMUM_REFRESH_GAP_MS) {
			return;
		}
		lastAttempt.current = now;
		const today = shanghaiDate(new Date(now));
		const controller = new AbortController();
		activeRequest.current = controller;

		const request = (async () => {
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
						daily.marketDate >= lastGood.current.data.marketDate);
				baseline.current = daily;
				if (shouldAdoptDaily) {
					lastGood.current = { data: daily, source: "history" };
					persistSnapshot(daily);
					if (mounted.current) {
						setState({ status: "ready", data: daily, source: "history" });
					}
				}
			} catch {
				// A validated local snapshot can still be refreshed with browser quotes.
			}

			const basis = baseline.current ?? lastGood.current?.data ?? null;
			if (basis === null) {
				if (mounted.current) {
					setState({
						status: "error",
						data: null,
						reason: "无法读取历史基准",
						source: null,
					});
				}
				return;
			}

			try {
				try {
					calendar.current ??= await fetchTradingCalendar({
						signal: controller.signal,
					});
				} catch {
					throw new Error("休市日历请求失败");
				}
				if (contracts.current === null || contractsDate.current !== today) {
					try {
						contracts.current = await discoverEastmoneyContracts(instruments, {
							signal: controller.signal,
						});
					} catch {
						throw new Error("期货合约目录请求失败");
					}
					contractsDate.current = today;
				}
				const quotes = await fetchEastmoneyQuotes(
					instruments,
					contracts.current,
					{
						signal: controller.signal,
					},
				);
				const live = mergeEastmoneyQuotes(
					basis,
					baseline.current === null ? tradingDayPhase(basis.fetchedAt) : "eod",
					quotes,
					instruments,
					calendar.current,
				);
				lastGood.current = { data: live, source: "browser" };
				persistSnapshot(live);
				if (mounted.current) {
					setState({ status: "ready", data: live, source: "browser" });
				}
			} catch (error) {
				if (controller.signal.aborted) {
					return;
				}
				calendar.current = null;
				contracts.current = null;
				contractsDate.current = null;
				if (mounted.current) {
					setState({
						status: "error",
						data: lastGood.current?.data ?? null,
						reason: errorMessage(error),
						source: lastGood.current?.source ?? null,
					});
				}
			}
		})().finally(() => {
			if (inFlight.current === request) {
				inFlight.current = null;
				activeRequest.current = null;
			}
		});
		inFlight.current = request;
	}, []);

	useEffect(() => {
		mounted.current = true;
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
			mounted.current = false;
			activeRequest.current?.abort();
			window.clearInterval(timer);
			document.removeEventListener("visibilitychange", refreshIfActive);
			window.removeEventListener("online", refreshIfActive);
		};
	}, [refresh]);

	return state;
}

export { isChineseMarketRefreshWindow } from "./marketTime";
