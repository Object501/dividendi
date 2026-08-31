import type { InstrumentConfig } from "./config";
import { validateMarketSnapshot } from "./generated/publicDataValidators.js";
import type {
	CompletedFiscalYearMetric,
	FuturesMetric,
	MarketSnapshot,
	StockMetric,
} from "./marketSnapshotTypes";
import { assertStructure } from "./publicDataValidation";

function decimalString(value: number): string {
	if (!Number.isFinite(value)) {
		throw new Error("客户端快照包含非有限数值");
	}
	return String(value);
}

export function marketSnapshotJson(
	data: MarketSnapshot,
): Record<string, unknown> {
	return {
		fetchedAt: data.fetchedAt,
		futures: data.futures.map((metric) => ({
			contractCode: metric.contractCode,
			dailyDiscountPoints: decimalString(metric.dailyDiscountPoints),
			discountPoints: decimalString(metric.discountPoints),
			expiryDate: metric.expiryDate,
			futuresPrice: decimalString(metric.futuresPrice),
			indexLevel: decimalString(metric.indexLevel),
			productCode: metric.productCode,
			remainingTradingDays: metric.remainingTradingDays,
			source: metric.source,
		})),
		marketDate: data.marketDate,
		schemaVersion: 1,
		stocks: data.stocks.map((metric) => ({
			code: metric.code,
			...(metric.completedFiscalYear === undefined
				? {}
				: {
						completedFiscalYear: metric.completedFiscalYear.fiscalYear,
						completedFiscalYearDividendPerShare: decimalString(
							metric.completedFiscalYear.dividendPerShare,
						),
						completedFiscalYearDividendYield: decimalString(
							metric.completedFiscalYear.dividendYield,
						),
					}),
			dividendSource: metric.dividendSource,
			dividendYield: decimalString(metric.dividendYield),
			implementedDividendPerShare: decimalString(
				metric.implementedDividendPerShare,
			),
			latestPrice: decimalString(metric.latestPrice),
			market: metric.market,
			priceSource: metric.priceSource,
		})),
	};
}

function decimalNumber(
	record: Record<string, unknown>,
	key: string,
	path: string,
): number {
	const number = Number(record[key]);
	if (!Number.isFinite(number)) {
		throw new Error(`${path}.${key} 超出浏览器的有限数值范围`);
	}
	return number;
}

function optionalDecimalNumber(
	record: Record<string, unknown>,
	key: string,
	path: string,
): number | undefined {
	return record[key] === undefined
		? undefined
		: decimalNumber(record, key, path);
}

function optionalIntegerValue(
	record: Record<string, unknown>,
	key: string,
): number | undefined {
	return record[key] === undefined ? undefined : (record[key] as number);
}

function stringValue(record: Record<string, unknown>, key: string): string {
	return record[key] as string;
}

function arrayValue(
	record: Record<string, unknown>,
	key: string,
): readonly unknown[] {
	return record[key] as readonly unknown[];
}

function objectValue(value: unknown): Record<string, unknown> {
	return value as Record<string, unknown>;
}

function closeEnough(left: number, right: number): boolean {
	return (
		Math.abs(left - right) <=
		Math.max(1, Math.abs(left), Math.abs(right)) * 1e-10
	);
}

function parseFuturesMetric(
	value: unknown,
	path: string,
	marketDate: string,
): FuturesMetric {
	const record = objectValue(value);

	const metric: FuturesMetric = {
		productCode: stringValue(record, "productCode"),
		contractCode: stringValue(record, "contractCode"),
		expiryDate: stringValue(record, "expiryDate"),
		indexLevel: decimalNumber(record, "indexLevel", path),
		futuresPrice: decimalNumber(record, "futuresPrice", path),
		discountPoints: decimalNumber(record, "discountPoints", path),
		remainingTradingDays: record.remainingTradingDays as number,
		dailyDiscountPoints: decimalNumber(record, "dailyDiscountPoints", path),
		source: stringValue(record, "source"),
	};

	if (metric.expiryDate < marketDate) {
		throw new Error(`${path}.expiryDate 不能早于行情日期`);
	}
	if (metric.indexLevel <= 0 || metric.futuresPrice <= 0) {
		throw new Error(`${path} 的指数和期货价格必须大于零`);
	}
	if (
		!closeEnough(metric.discountPoints, metric.indexLevel - metric.futuresPrice)
	) {
		throw new Error(`${path}.discountPoints 与原始行情不一致`);
	}
	if (
		!closeEnough(
			metric.dailyDiscountPoints,
			metric.discountPoints / metric.remainingTradingDays,
		)
	) {
		throw new Error(`${path}.dailyDiscountPoints 与贴水和剩余交易日不一致`);
	}
	return metric;
}

function parseStockMetric(value: unknown, path: string): StockMetric {
	const record = objectValue(value);

	const completedFiscalYear = optionalIntegerValue(
		record,
		"completedFiscalYear",
	);
	const completedFiscalYearDividendPerShare = optionalDecimalNumber(
		record,
		"completedFiscalYearDividendPerShare",
		path,
	);
	const completedFiscalYearDividendYield = optionalDecimalNumber(
		record,
		"completedFiscalYearDividendYield",
		path,
	);
	let completedMetric: CompletedFiscalYearMetric | undefined;
	if (completedFiscalYear !== undefined) {
		if (
			completedFiscalYearDividendPerShare === undefined ||
			completedFiscalYearDividendYield === undefined
		) {
			throw new Error(`${path} 的完整财年分红字段必须同时提供`);
		}
		completedMetric = {
			dividendPerShare: completedFiscalYearDividendPerShare,
			dividendYield: completedFiscalYearDividendYield,
			fiscalYear: completedFiscalYear,
		};
	}
	const metric: StockMetric = {
		market: stringValue(record, "market"),
		code: stringValue(record, "code"),
		latestPrice: decimalNumber(record, "latestPrice", path),
		implementedDividendPerShare: decimalNumber(
			record,
			"implementedDividendPerShare",
			path,
		),
		dividendYield: decimalNumber(record, "dividendYield", path),
		priceSource: stringValue(record, "priceSource"),
		dividendSource: stringValue(record, "dividendSource"),
		...(completedMetric === undefined
			? {}
			: { completedFiscalYear: completedMetric }),
	};

	if (metric.latestPrice <= 0) {
		throw new Error(`${path}.latestPrice 必须大于零`);
	}
	if (metric.implementedDividendPerShare < 0) {
		throw new Error(`${path}.implementedDividendPerShare 不能为负数`);
	}
	if (
		metric.completedFiscalYear !== undefined &&
		metric.completedFiscalYear.dividendPerShare < 0
	) {
		throw new Error(`${path}.completedFiscalYearDividendPerShare 不能为负数`);
	}
	if (
		!closeEnough(
			metric.dividendYield,
			metric.implementedDividendPerShare / metric.latestPrice,
		)
	) {
		throw new Error(`${path}.dividendYield 与分红和价格不一致`);
	}
	if (
		metric.completedFiscalYear !== undefined &&
		!closeEnough(
			metric.completedFiscalYear.dividendYield,
			metric.completedFiscalYear.dividendPerShare / metric.latestPrice,
		)
	) {
		throw new Error(
			`${path}.completedFiscalYearDividendYield 与分红和价格不一致`,
		);
	}
	return metric;
}

export function parseMarketSnapshot(
	value: unknown,
	instruments: InstrumentConfig,
): MarketSnapshot {
	assertStructure(value, validateMarketSnapshot, "snapshot");
	return parseMarketSnapshotStructure(value, instruments);
}

export function parseMarketSnapshotStructure(
	value: unknown,
	instruments: InstrumentConfig,
): MarketSnapshot {
	const record = objectValue(value);
	const marketDate = stringValue(record, "marketDate");
	const fetchedAt = stringValue(record, "fetchedAt");

	const futures = arrayValue(record, "futures").map((metric, index) =>
		parseFuturesMetric(metric, `futures[${index}]`, marketDate),
	);
	const stocks = arrayValue(record, "stocks").map((metric, index) =>
		parseStockMetric(metric, `stocks[${index}]`),
	);

	const configuredProducts = new Set(
		instruments.futuresProducts.map((product) => product.code),
	);
	const documentProducts = new Set(futures.map((metric) => metric.productCode));
	if (
		configuredProducts.size !== documentProducts.size ||
		[...configuredProducts].some((code) => !documentProducts.has(code))
	) {
		throw new Error("期货行情没有完整覆盖配置品种");
	}
	if (
		new Set(futures.map((metric) => metric.contractCode)).size !==
		futures.length
	) {
		throw new Error("期货行情中存在重复合约");
	}

	const configuredStocks = instruments.stocks.map(
		(stock) => `${stock.market}:${stock.code}`,
	);
	const documentStocks = stocks.map((stock) => `${stock.market}:${stock.code}`);
	if (
		configuredStocks.length !== documentStocks.length ||
		configuredStocks.some((stock, index) => documentStocks[index] !== stock)
	) {
		throw new Error("股票行情必须完整覆盖配置并保持相同顺序");
	}

	return { schemaVersion: 1, marketDate, fetchedAt, futures, stocks };
}
