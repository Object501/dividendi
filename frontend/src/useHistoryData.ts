import { useCallback, useState } from "react";

import type { HistoryData } from "./data";
import { loadHistoryData } from "./historyData";

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
			const data = await loadHistoryData();
			setState({ status: "ready", data });
		} catch {
			setState({ status: "error", data: null });
		}
	}, []);

	return { state, load };
}
