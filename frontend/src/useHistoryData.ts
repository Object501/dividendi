import { useCallback, useState, useSyncExternalStore } from "react";

import {
	getHistoryDataState,
	type HistoryDataState,
	loadHistoryData,
	subscribeHistoryData,
} from "./historyData";

export function useHistoryData(): {
	readonly state: HistoryDataState;
	readonly load: () => Promise<void>;
} {
	const [requested, setRequested] = useState(false);
	const sharedState = useSyncExternalStore(
		subscribeHistoryData,
		getHistoryDataState,
	);

	const load = useCallback(async () => {
		setRequested(true);
		try {
			await loadHistoryData();
		} catch {
			// The shared store exposes the error state and supports a later retry.
		}
	}, []);

	return {
		state: requested ? sharedState : { status: "idle", data: null },
		load,
	};
}
