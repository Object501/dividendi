import { instruments } from "./config";
import {
	discoverEastmoneyContracts,
	EastmoneyQuotesNotReadyError,
	fetchEastmoneyQuotes,
} from "./eastmoney";
import type { EastmoneyContract, EastmoneyQuotes } from "./eastmoneyTypes";
import { loadHistoryData } from "./historyData";
import type { HistoryData } from "./historyDocument";
import type {
	LastGoodMarketSnapshot,
	MarketSnapshotState,
} from "./marketSnapshotState";
import type { MarketSnapshot } from "./marketSnapshotTypes";
import { tradingDayPhase } from "./marketTime";
import { mergeEastmoneyQuotes } from "./mergeEastmoneyQuotes";
import {
	fetchTradingCalendar,
	type TradingCalendar,
	type TradingDayPhase,
} from "./tradingCalendar";

export interface MarketSnapshotRefreshDependencies {
	readonly discoverContracts: (
		signal: AbortSignal,
	) => Promise<readonly EastmoneyContract[]>;
	readonly fetchCalendar: (signal: AbortSignal) => Promise<TradingCalendar>;
	readonly fetchQuotes: (
		contracts: readonly EastmoneyContract[],
		signal: AbortSignal,
	) => Promise<EastmoneyQuotes>;
	readonly loadHistory: (refresh: boolean) => Promise<HistoryData>;
	readonly mergeQuotes: (
		basis: MarketSnapshot,
		basisPhase: TradingDayPhase,
		quotes: EastmoneyQuotes,
		calendar: TradingCalendar,
	) => MarketSnapshot;
	readonly persist: (snapshot: MarketSnapshot) => void;
}

const providerDependencies: Omit<MarketSnapshotRefreshDependencies, "persist"> =
	{
		discoverContracts: (signal) =>
			discoverEastmoneyContracts(instruments, { signal }),
		fetchCalendar: (signal) => fetchTradingCalendar({ signal }),
		fetchQuotes: (contracts, signal) =>
			fetchEastmoneyQuotes(instruments, contracts, { signal }),
		loadHistory: loadHistoryData,
		mergeQuotes: (basis, basisPhase, quotes, calendar) =>
			mergeEastmoneyQuotes(basis, basisPhase, quotes, instruments, calendar),
	};

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : "未知错误";
}

export class MarketSnapshotRefresher {
	private baseline: MarketSnapshot | null = null;
	private calendar: TradingCalendar | null = null;
	private contracts: readonly EastmoneyContract[] | null = null;
	private contractsDate: string | null = null;
	private historyRequestDate: string | null = null;
	private lastGood: LastGoodMarketSnapshot | null;

	constructor(
		initial: LastGoodMarketSnapshot | null,
		private readonly publish: (state: MarketSnapshotState) => void,
		private readonly dependencies: MarketSnapshotRefreshDependencies,
	) {
		this.lastGood = initial;
	}

	async refresh(today: string, signal: AbortSignal): Promise<void> {
		await this.refreshHistory(today);
		const basis = this.baseline ?? this.lastGood?.data ?? null;
		if (basis === null) {
			this.publish({
				status: "error",
				data: null,
				reason: "无法读取历史基准",
				source: null,
			});
			return;
		}

		try {
			await this.refreshBrowserQuotes(basis, today, signal);
		} catch (error) {
			if (signal.aborted || error instanceof EastmoneyQuotesNotReadyError) {
				return;
			}
			this.calendar = null;
			this.contracts = null;
			this.contractsDate = null;
			this.publish({
				status: "error",
				data: this.lastGood?.data ?? null,
				reason: errorMessage(error),
				source: this.lastGood?.source ?? null,
			});
		}
	}

	private async refreshHistory(today: string): Promise<void> {
		try {
			const history = await this.dependencies.loadHistory(
				this.historyRequestDate !== null && this.historyRequestDate !== today,
			);
			const daily = history.snapshots.at(-1);
			if (daily === undefined) {
				throw new Error("历史数据没有日终快照");
			}
			this.historyRequestDate = today;
			const basisAdvanced =
				this.baseline === null || daily.marketDate > this.baseline.marketDate;
			const shouldAdoptDaily =
				basisAdvanced &&
				(this.lastGood === null ||
					daily.marketDate >= this.lastGood.data.marketDate);
			this.baseline = daily;
			if (shouldAdoptDaily) {
				this.lastGood = { data: daily, source: "history" };
				this.dependencies.persist(daily);
				this.publish({ status: "ready", data: daily, source: "history" });
			}
		} catch {
			// A validated local snapshot can still be refreshed with browser quotes.
		}
	}

	private async refreshBrowserQuotes(
		basis: MarketSnapshot,
		today: string,
		signal: AbortSignal,
	): Promise<void> {
		try {
			this.calendar ??= await this.dependencies.fetchCalendar(signal);
		} catch {
			throw new Error("休市日历请求失败");
		}
		if (this.contracts === null || this.contractsDate !== today) {
			try {
				this.contracts = await this.dependencies.discoverContracts(signal);
			} catch {
				throw new Error("期货合约目录请求失败");
			}
			this.contractsDate = today;
		}
		const quotes = await this.dependencies.fetchQuotes(this.contracts, signal);
		const live = this.dependencies.mergeQuotes(
			basis,
			this.baseline === null ? tradingDayPhase(basis.fetchedAt) : "eod",
			quotes,
			this.calendar,
		);
		this.lastGood = { data: live, source: "browser" };
		this.dependencies.persist(live);
		this.publish({ status: "ready", data: live, source: "browser" });
	}
}

export function defaultMarketSnapshotRefreshDependencies(
	persist: (snapshot: MarketSnapshot) => void,
): MarketSnapshotRefreshDependencies {
	return { ...providerDependencies, persist };
}
