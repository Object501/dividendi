import type { InstrumentConfig } from "./config";

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
}

export interface LatestData {
	readonly schemaVersion: 1;
	readonly marketDate: string;
	readonly fetchedAt: string;
	readonly futures: readonly FuturesMetric[];
	readonly stocks: readonly StockMetric[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(
	record: Record<string, unknown>,
	key: string,
	path: string,
): string {
	const value = record[key];
	if (typeof value !== "string" || value.trim() === "") {
		throw new Error(`${path}.${key} 必须是非空字符串`);
	}
	return value;
}

function decimalString(
	record: Record<string, unknown>,
	key: string,
	path: string,
): number {
	const value = record[key];
	if (typeof value !== "string" || value.trim() === "") {
		throw new Error(`${path}.${key} 必须是十进制字符串`);
	}
	const number = Number(value);
	if (!Number.isFinite(number)) {
		throw new Error(`${path}.${key} 必须是有限数值`);
	}
	return number;
}

function positiveInteger(
	record: Record<string, unknown>,
	key: string,
	path: string,
): number {
	const value = record[key];
	if (!Number.isInteger(value) || (value as number) <= 0) {
		throw new Error(`${path}.${key} 必须是正整数`);
	}
	return value as number;
}

function isoDate(
	record: Record<string, unknown>,
	key: string,
	path: string,
): string {
	const value = requiredString(record, key, path);
	if (
		!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
		Number.isNaN(Date.parse(`${value}T00:00:00Z`))
	) {
		throw new Error(`${path}.${key} 必须是 ISO 日期`);
	}
	return value;
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
	if (!isRecord(value)) {
		throw new Error(`${path} 必须是对象`);
	}

	const metric: FuturesMetric = {
		productCode: requiredString(value, "productCode", path),
		contractCode: requiredString(value, "contractCode", path),
		expiryDate: isoDate(value, "expiryDate", path),
		indexLevel: decimalString(value, "indexLevel", path),
		futuresPrice: decimalString(value, "futuresPrice", path),
		discountPoints: decimalString(value, "discountPoints", path),
		remainingTradingDays: positiveInteger(value, "remainingTradingDays", path),
		dailyDiscountPoints: decimalString(value, "dailyDiscountPoints", path),
		source: requiredString(value, "source", path),
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
	if (!isRecord(value)) {
		throw new Error(`${path} 必须是对象`);
	}

	const metric: StockMetric = {
		market: requiredString(value, "market", path),
		code: requiredString(value, "code", path),
		latestPrice: decimalString(value, "latestPrice", path),
		implementedDividendPerShare: decimalString(
			value,
			"implementedDividendPerShare",
			path,
		),
		dividendYield: decimalString(value, "dividendYield", path),
		priceSource: requiredString(value, "priceSource", path),
		dividendSource: requiredString(value, "dividendSource", path),
	};

	if (metric.latestPrice <= 0) {
		throw new Error(`${path}.latestPrice 必须大于零`);
	}
	if (metric.implementedDividendPerShare < 0) {
		throw new Error(`${path}.implementedDividendPerShare 不能为负数`);
	}
	if (
		!closeEnough(
			metric.dividendYield,
			metric.implementedDividendPerShare / metric.latestPrice,
		)
	) {
		throw new Error(`${path}.dividendYield 与分红和价格不一致`);
	}
	return metric;
}

export function parseLatestData(
	value: unknown,
	instruments: InstrumentConfig,
): LatestData {
	if (!isRecord(value)) {
		throw new Error("行情数据必须是对象");
	}
	if (value.schemaVersion !== 1) {
		throw new Error("不支持的行情数据版本");
	}
	if (!Array.isArray(value.futures) || value.futures.length === 0) {
		throw new Error("futures 必须是非空数组");
	}
	if (!Array.isArray(value.stocks) || value.stocks.length === 0) {
		throw new Error("stocks 必须是非空数组");
	}

	const marketDate = isoDate(value, "marketDate", "latest");
	const fetchedAt = requiredString(value, "fetchedAt", "latest");
	if (
		Number.isNaN(Date.parse(fetchedAt)) ||
		!/(?:Z|[+-]\d{2}:\d{2})$/.test(fetchedAt)
	) {
		throw new Error("latest.fetchedAt 必须是含时区的 ISO 时间");
	}

	const futures = value.futures.map((metric, index) =>
		parseFuturesMetric(metric, `futures[${index}]`, marketDate),
	);
	const stocks = value.stocks.map((metric, index) =>
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
