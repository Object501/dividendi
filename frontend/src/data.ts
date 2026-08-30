import type { InstrumentConfig } from "./config";
import {
	type PublicDataValidator,
	validateHistoryDocument,
	validateLatestDocument,
} from "./generated/publicDataValidators.js";

export interface FuturesMetric {
	readonly productCode: string;
	readonly contractCode: string;
	readonly expiryDate: string;
	readonly indexLevel: number;
	readonly futuresPrice: number;
	readonly discountPoints: number;
	readonly remainingTradingDays: number;
	readonly dailyDiscountPoints: number;
	readonly source: string;
}

export interface StockMetric {
	readonly market: string;
	readonly code: string;
	readonly latestPrice: number;
	readonly implementedDividendPerShare: number;
	readonly dividendYield: number;
	readonly priceSource: string;
	readonly dividendSource: string;
	readonly completedFiscalYear?: number;
	readonly completedFiscalYearDividendPerShare?: number;
	readonly completedFiscalYearDividendYield?: number;
}

export interface LatestData {
	readonly schemaVersion: 1;
	readonly marketDate: string;
	readonly fetchedAt: string;
	readonly futures: readonly FuturesMetric[];
	readonly stocks: readonly StockMetric[];
}

export interface HistoryData {
	readonly schemaVersion: 1;
	readonly snapshots: readonly LatestData[];
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

function validationPath(documentName: string, instancePath: string): string {
	return `${documentName}${instancePath.replaceAll("/", ".")}`;
}

function assertStructure(
	value: unknown,
	validator: PublicDataValidator,
	documentName: string,
): void {
	if (validator(value)) {
		return;
	}
	const error = validator.errors?.[0];
	const path = validationPath(documentName, error?.instancePath ?? "");
	throw new Error(
		`${path} 不符合 public-data-v1 JSON Schema${error?.message === undefined ? "" : `：${error.message}`}`,
	);
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
	const completedMetric =
		completedFiscalYear === undefined
			? {}
			: {
					completedFiscalYear,
					completedFiscalYearDividendPerShare:
						completedFiscalYearDividendPerShare as number,
					completedFiscalYearDividendYield:
						completedFiscalYearDividendYield as number,
				};
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
		...completedMetric,
	};

	if (metric.latestPrice <= 0) {
		throw new Error(`${path}.latestPrice 必须大于零`);
	}
	if (metric.implementedDividendPerShare < 0) {
		throw new Error(`${path}.implementedDividendPerShare 不能为负数`);
	}
	if (
		metric.completedFiscalYearDividendPerShare !== undefined &&
		metric.completedFiscalYearDividendPerShare < 0
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
		metric.completedFiscalYearDividendPerShare !== undefined &&
		metric.completedFiscalYearDividendYield !== undefined &&
		!closeEnough(
			metric.completedFiscalYearDividendYield,
			metric.completedFiscalYearDividendPerShare / metric.latestPrice,
		)
	) {
		throw new Error(
			`${path}.completedFiscalYearDividendYield 与分红和价格不一致`,
		);
	}
	return metric;
}

export function parseLatestData(
	value: unknown,
	instruments: InstrumentConfig,
): LatestData {
	assertStructure(value, validateLatestDocument, "latest");
	return parseStructuredLatestData(value, instruments);
}

function parseStructuredLatestData(
	value: unknown,
	instruments: InstrumentConfig,
): LatestData {
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

export function parseHistoryData(
	value: unknown,
	instruments: InstrumentConfig,
): HistoryData {
	assertStructure(value, validateHistoryDocument, "history");
	const record = objectValue(value);
	const snapshots = arrayValue(record, "snapshots").map((snapshot) =>
		parseStructuredLatestData(snapshot, instruments),
	);
	const dates = snapshots.map((snapshot) => snapshot.marketDate);
	if (
		dates.some((marketDate, index) => {
			const previousDate = dates[index - 1];
			return previousDate !== undefined && marketDate <= previousDate;
		})
	) {
		throw new Error("历史快照必须按交易日严格升序排列");
	}
	const millisecondsPerDay = 24 * 60 * 60 * 1000;
	const newestDate = dates.at(-1);
	if (newestDate === undefined) {
		throw new Error("history.snapshots 必须是非空数组");
	}
	const newest = Date.parse(`${newestDate}T00:00:00Z`);
	const cutoff = newest - 365 * millisecondsPerDay;
	if (
		dates.some((marketDate) => Date.parse(`${marketDate}T00:00:00Z`) <= cutoff)
	) {
		throw new Error("历史快照超出 365 天滚动窗口");
	}
	return { schemaVersion: 1, snapshots };
}
