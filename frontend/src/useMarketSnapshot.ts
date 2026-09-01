import { useCallback, useEffect, useRef, useState } from "react";

import { loadClientSnapshot, saveClientSnapshot } from "./clientSnapshot";
import { instruments } from "./config";
import {
	defaultMarketSnapshotRefreshDependencies,
	MarketSnapshotRefresher,
} from "./marketSnapshotRefresh";
import type {
	LastGoodMarketSnapshot,
	MarketSnapshotState,
} from "./marketSnapshotState";
import type { MarketSnapshot } from "./marketSnapshotTypes";
import { isChineseMarketRefreshWindow, shanghaiDate } from "./marketTime";
import { MINIMUM_MARKET_REFRESH_GAP_MS } from "./refreshThrottle";

const REFRESH_INTERVAL_MS = 60 * 60 * 1000;

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

export function useMarketSnapshot(): MarketSnapshotState {
	const initial = useRef<MarketSnapshot | null | undefined>(undefined);
	if (initial.current === undefined) {
		initial.current = storedSnapshot();
	}
	const initialSnapshot = initial.current;
	const [state, setState] = useState<MarketSnapshotState>(() =>
		initialSnapshot === null
			? { status: "loading", data: null }
			: { status: "ready", data: initialSnapshot, source: "local" },
	);
	const mounted = useRef(false);
	const lastAttempt = useRef(0);
	const inFlight = useRef<Promise<void> | null>(null);
	const activeRequest = useRef<AbortController | null>(null);
	const refresher = useRef<MarketSnapshotRefresher | null>(null);
	if (refresher.current === null) {
		const initialLastGood: LastGoodMarketSnapshot | null =
			initialSnapshot === null
				? null
				: { data: initialSnapshot, source: "local" };
		refresher.current = new MarketSnapshotRefresher(
			initialLastGood,
			(next) => {
				if (mounted.current) {
					setState(next);
				}
			},
			defaultMarketSnapshotRefreshDependencies(persistSnapshot),
		);
	}

	const refresh = useCallback(() => {
		const now = Date.now();
		if (inFlight.current !== null) {
			if (activeRequest.current?.signal.aborted !== true) {
				return;
			}
			inFlight.current = null;
			lastAttempt.current = 0;
		}
		if (now - lastAttempt.current < MINIMUM_MARKET_REFRESH_GAP_MS) {
			return;
		}
		lastAttempt.current = now;
		const controller = new AbortController();
		activeRequest.current = controller;
		const request = refresher.current
			?.refresh(shanghaiDate(new Date(now)), controller.signal)
			.finally(() => {
				if (inFlight.current === request) {
					inFlight.current = null;
					activeRequest.current = null;
				}
			});
		if (request !== undefined) {
			inFlight.current = request;
		}
	}, []);

	useEffect(() => {
		mounted.current = true;
		refresh();
		const refreshIfActive = () => {
			if (
				document.visibilityState === "visible" &&
				navigator.onLine &&
				isChineseMarketRefreshWindow(new Date())
			) {
				refresh();
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

export type {
	MarketSnapshotSource,
	MarketSnapshotState,
} from "./marketSnapshotState";
export { isChineseMarketRefreshWindow } from "./marketTime";
