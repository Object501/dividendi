import rawInstruments from "../config/instruments.json";

export interface MarketInstrument {
	readonly code: string;
	readonly name: string;
	readonly market: string;
}

export interface FuturesProduct {
	readonly code: string;
	readonly name: string;
	readonly exchange: string;
	readonly underlying: MarketInstrument;
}

export interface InstrumentConfig {
	readonly schemaVersion: 1;
	readonly futuresProducts: readonly FuturesProduct[];
	readonly stocks: readonly MarketInstrument[];
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

function parseMarketInstrument(value: unknown, path: string): MarketInstrument {
	if (!isRecord(value)) {
		throw new Error(`${path} 必须是对象`);
	}

	return {
		code: requiredString(value, "code", path),
		name: requiredString(value, "name", path),
		market: requiredString(value, "market", path),
	};
}

function parseFuturesProduct(value: unknown, path: string): FuturesProduct {
	if (!isRecord(value)) {
		throw new Error(`${path} 必须是对象`);
	}

	return {
		code: requiredString(value, "code", path),
		name: requiredString(value, "name", path),
		exchange: requiredString(value, "exchange", path),
		underlying: parseMarketInstrument(value.underlying, `${path}.underlying`),
	};
}

function assertUnique(values: readonly string[], path: string): void {
	if (new Set(values).size !== values.length) {
		throw new Error(`${path} 中存在重复标的`);
	}
}

export function parseInstrumentConfig(value: unknown): InstrumentConfig {
	if (!isRecord(value)) {
		throw new Error("标的配置必须是对象");
	}

	if (value.schemaVersion !== 1) {
		throw new Error("不支持的标的配置版本");
	}

	if (
		!Array.isArray(value.futuresProducts) ||
		value.futuresProducts.length === 0
	) {
		throw new Error("futuresProducts 必须包含至少一个期货品种");
	}

	if (!Array.isArray(value.stocks) || value.stocks.length === 0) {
		throw new Error("stocks 必须包含至少一只股票");
	}

	const futuresProducts = value.futuresProducts.map((product, index) =>
		parseFuturesProduct(product, `futuresProducts[${index}]`),
	);
	const stocks = value.stocks.map((stock, index) =>
		parseMarketInstrument(stock, `stocks[${index}]`),
	);

	assertUnique(
		futuresProducts.map((product) => `${product.exchange}:${product.code}`),
		"futuresProducts",
	);
	assertUnique(
		stocks.map((stock) => `${stock.market}:${stock.code}`),
		"stocks",
	);

	return { schemaVersion: 1, futuresProducts, stocks };
}

export const instruments = parseInstrumentConfig(rawInstruments);
