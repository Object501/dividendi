import type { MarketSnapshot } from "./marketSnapshotTypes";

export type MarketSnapshotSource = "browser" | "history" | "local";

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

export interface LastGoodMarketSnapshot {
	readonly data: MarketSnapshot;
	readonly source: MarketSnapshotSource;
}
