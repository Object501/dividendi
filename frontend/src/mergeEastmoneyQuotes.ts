import type { InstrumentConfig } from "./config";
import type { EastmoneyQuote, EastmoneyQuotes } from "./eastmoneyTypes";
import type { MarketSnapshot } from "./marketSnapshotTypes";
import { shanghaiDate, tradingDayPhase } from "./marketTime";
import {
	contractExpiry,
	elapsedTradingDays,
	remainingTradingDays,
	type TradingCalendar,
	type TradingDayPhase,
} from "./tradingCalendar";

const QUOTE_SOURCE = "eastmoney";

export function mergeEastmoneyQuotes(
	baseline: MarketSnapshot,
	baselinePhase: TradingDayPhase,
	live: EastmoneyQuotes,
	instruments: InstrumentConfig,
	calendar: TradingCalendar,
): MarketSnapshot {
	if (live.marketDate < baseline.marketDate) {
		throw new Error("浏览器行情早于每日基准");
	}
	const spotQuotes = new Map(
		live.spots.map((quote) => [`${quote.market}:${quote.code}`, quote]),
	);
	const underlyingByProduct = new Map(
		instrumentsForProducts(baseline, live, spotQuotes, instruments),
	);
	const baselineFutures = new Map(
		baseline.futures.map((metric) => [metric.contractCode, metric]),
	);
	const livePhase = tradingDayPhase(live.fetchedAt);
	const futures = live.futures.flatMap((quote) => {
		const previous = baselineFutures.get(quote.code);
		const indexLevel = underlyingByProduct.get(quote.productCode ?? "");
		if (indexLevel === undefined || quote.productCode === undefined) {
			throw new Error(`浏览器行情无法匹配期货 ${quote.code} 的标的指数`);
		}
		let expiryDate: string;
		let remaining: number;
		try {
			expiryDate =
				previous?.expiryDate ??
				contractExpiry(quote.productCode, quote.code, calendar);
			remaining =
				previous === undefined
					? remainingTradingDays(
							live.marketDate,
							expiryDate,
							livePhase === "intraday",
							calendar,
						)
					: previous.remainingTradingDays -
						elapsedTradingDays(
							baseline.marketDate,
							baselinePhase,
							live.marketDate,
							livePhase,
							calendar,
						);
		} catch (error) {
			const reason = error instanceof Error ? error.message : "未知错误";
			throw new Error(`浏览器行情无法计算期货 ${quote.code}：${reason}`);
		}
		if (remaining <= 0) {
			return [];
		}
		const discountPoints = indexLevel - quote.price;
		return [
			{
				contractCode: quote.code,
				dailyDiscountPoints: discountPoints / remaining,
				discountPoints,
				expiryDate,
				futuresPrice: quote.price,
				indexLevel,
				productCode: quote.productCode,
				remainingTradingDays: remaining,
				source: QUOTE_SOURCE,
			},
		];
	});
	const products = new Set(
		baseline.futures.map((metric) => metric.productCode),
	);
	if (
		[...products].some(
			(productCode) =>
				!futures.some((metric) => metric.productCode === productCode),
		)
	) {
		throw new Error("浏览器期货行情不能覆盖每日基准品种");
	}

	const stocks = baseline.stocks.map((previous) => {
		const quote = spotQuotes.get(`${previous.market}:${previous.code}`);
		if (quote === undefined) {
			throw new Error(`浏览器行情缺少股票 ${previous.market}:${previous.code}`);
		}
		const completedMetric =
			previous.completedFiscalYear === undefined
				? {}
				: {
						completedFiscalYear: {
							...previous.completedFiscalYear,
							dividendYield:
								previous.completedFiscalYear.dividendPerShare / quote.price,
						},
					};
		return {
			...previous,
			...completedMetric,
			dividendYield: previous.implementedDividendPerShare / quote.price,
			latestPrice: quote.price,
			priceSource: QUOTE_SOURCE,
		};
	});

	return {
		fetchedAt: live.fetchedAt,
		futures,
		marketDate: live.marketDate,
		schemaVersion: 1,
		stocks,
	};
}

function instrumentsForProducts(
	baseline: MarketSnapshot,
	live: EastmoneyQuotes,
	spotQuotes: ReadonlyMap<string, EastmoneyQuote>,
	instruments: InstrumentConfig,
): readonly (readonly [string, number])[] {
	const productCodes = new Set(
		baseline.futures.map((metric) => metric.productCode),
	);
	return [...productCodes].map((productCode) => {
		const product = instruments.futuresProducts.find(
			(candidate) => candidate.code === productCode,
		);
		if (product === undefined) {
			throw new Error(`每日基准包含未配置品种 ${productCode}`);
		}
		const quote = spotQuotes.get(
			`${product.underlying.market}:${product.underlying.code}`,
		);
		if (
			quote === undefined ||
			shanghaiDate(new Date(quote.updatedAt * 1000)) !== live.marketDate
		) {
			throw new Error(`浏览器行情缺少 ${productCode} 标的指数`);
		}
		return [productCode, quote.price] as const;
	});
}
