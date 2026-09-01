import type {
	FuturesProduct,
	InstrumentConfig,
	MarketInstrument,
} from "./config";
import type {
	EastmoneyContract,
	EastmoneyProduct,
	EastmoneyQuote,
} from "./eastmoneyTypes";

const FUTURES_MARKET = "220";

export class EastmoneyQuotesNotReadyError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function record(value: unknown, path: string): Record<string, unknown> {
	if (!isRecord(value)) {
		throw new Error(`${path} 必须是对象`);
	}
	return value;
}

function array(value: unknown, path: string): readonly unknown[] {
	if (!Array.isArray(value)) {
		throw new Error(`${path} 必须是数组`);
	}
	return value;
}

function stringValue(
	value: Record<string, unknown>,
	key: string,
	path: string,
): string {
	const field = value[key];
	if (typeof field !== "string" || field.trim() === "") {
		throw new Error(`${path}.${key} 必须是非空字符串`);
	}
	return field;
}

function numberValue(
	value: Record<string, unknown>,
	key: string,
	path: string,
): number {
	const field = value[key];
	if (typeof field !== "number" || !Number.isFinite(field) || field <= 0) {
		throw new Error(`${path}.${key} 必须是有限正数`);
	}
	return field;
}

function spotPrice(value: Record<string, unknown>, path: string): number {
	const latest = value.f2;
	if (typeof latest === "number" && Number.isFinite(latest) && latest > 0) {
		return latest;
	}
	const previousClose = value.f18;
	if (
		typeof previousClose === "number" &&
		Number.isFinite(previousClose) &&
		previousClose > 0
	) {
		return previousClose;
	}
	throw new Error(`${path}.f2 和 ${path}.f18 必须至少有一个有限正数`);
}

function futuresPrice(value: Record<string, unknown>, path: string): number {
	const latest = value.p;
	if (latest === null || latest === 0 || latest === "-" || latest === "--") {
		throw new EastmoneyQuotesNotReadyError("东方财富期货行情尚未开始更新");
	}
	return numberValue(value, "p", path);
}

function nonNegativeIntegerValue(
	value: Record<string, unknown>,
	key: string,
	path: string,
): number {
	const field = value[key];
	if (typeof field !== "number" || !Number.isInteger(field) || field < 0) {
		throw new Error(`${path}.${key} 必须是非负整数`);
	}
	return field;
}

function providerSpotMarket(market: string): string {
	if (market === "SH") {
		return "1";
	}
	if (market === "SZ" || market === "BJ") {
		return "0";
	}
	throw new Error(`东方财富不支持市场 ${market}`);
}

function spotSecurityId(instrument: MarketInstrument): string {
	return `${providerSpotMarket(instrument.market)}.${instrument.code}`;
}

export function expectedSpotInstruments(
	instruments: InstrumentConfig,
): ReadonlyMap<string, MarketInstrument> {
	const entries = [
		...instruments.futuresProducts.map((product) => product.underlying),
		...instruments.stocks,
	].map((instrument) => [spotSecurityId(instrument), instrument] as const);
	return new Map(entries);
}

export function parseProductCatalog(
	value: unknown,
	instruments: InstrumentConfig,
): readonly EastmoneyProduct[] {
	const rows = array(value, "东方财富期货品种").map((item, index) => {
		const row = record(item, `东方财富期货品种[${index}]`);
		return {
			market: stringValue(row, "mktid", `东方财富期货品种[${index}]`),
			productCode: stringValue(row, "vcode", `东方财富期货品种[${index}]`),
			type: stringValue(row, "vtype", `东方财富期货品种[${index}]`),
		};
	});

	return instruments.futuresProducts.map((product) => {
		if (product.exchange !== "CFFEX") {
			throw new Error(`东方财富浏览器行情不支持交易所 ${product.exchange}`);
		}
		const matches = rows.filter(
			(row) =>
				row.market === FUTURES_MARKET && row.productCode === product.code,
		);
		if (matches.length !== 1) {
			throw new Error(`东方财富缺少唯一期货品种 ${product.code}`);
		}
		return matches[0] as EastmoneyProduct;
	});
}

export function parseContractCatalog(
	value: unknown,
	product: FuturesProduct,
): readonly EastmoneyContract[] {
	const escapedProductCode = product.code.replace(
		/[.*+?^${}()|[\]\\]/g,
		"\\$&",
	);
	const contractPattern = new RegExp(`^${escapedProductCode}[0-9]{4}$`);
	const contracts = array(value, `${product.code} 合约`).flatMap(
		(item, index) => {
			const row = record(item, `${product.code} 合约[${index}]`);
			const contractCode = stringValue(
				row,
				"code",
				`${product.code} 合约[${index}]`,
			);
			return contractPattern.test(contractCode)
				? [
						{
							contractCode,
							market: String(
								numberValue(row, "mktid", `${product.code} 合约[${index}]`),
							),
							productCode: product.code,
						},
					]
				: [];
		},
	);
	if (contracts.length === 0) {
		throw new Error(`东方财富没有返回 ${product.code} 在交易合约`);
	}
	if (
		contracts.some((contract) => contract.market !== FUTURES_MARKET) ||
		new Set(contracts.map((contract) => contract.contractCode)).size !==
			contracts.length
	) {
		throw new Error(`东方财富 ${product.code} 合约列表无效`);
	}
	return contracts;
}

export function parseSpotQuotes(
	value: unknown,
	instruments: InstrumentConfig,
): readonly EastmoneyQuote[] {
	const expected = expectedSpotInstruments(instruments);
	const data = record(
		record(value, "东方财富现货行情").data,
		"东方财富现货行情.data",
	);
	const quotes = array(data.diff, "东方财富现货行情.data.diff").map(
		(item, index) => {
			const path = `东方财富现货行情.data.diff[${index}]`;
			const row = record(item, path);
			const providerId = `${nonNegativeIntegerValue(row, "f13", path)}.${stringValue(row, "f12", path)}`;
			const instrument = expected.get(providerId);
			if (instrument === undefined) {
				throw new Error(`东方财富返回未请求的现货 ${providerId}`);
			}
			return {
				code: instrument.code,
				market: instrument.market,
				price: spotPrice(row, path),
				updatedAt: numberValue(row, "f124", path),
			};
		},
	);
	const returned = new Set(
		quotes.map((quote) => spotSecurityId({ ...quote, name: quote.code })),
	);
	if (
		returned.size !== quotes.length ||
		[...expected.keys()].some((providerId) => !returned.has(providerId))
	) {
		throw new Error("东方财富现货行情没有完整覆盖配置标的");
	}
	return quotes;
}

export function parseFuturesQuotes(
	value: unknown,
	contracts: readonly EastmoneyContract[],
): readonly EastmoneyQuote[] {
	const expected = new Map(
		contracts.map((contract) => [contract.contractCode, contract]),
	);
	const root = record(value, "东方财富期货行情");
	const quotes = array(root.list, "东方财富期货行情.list").map(
		(item, index) => {
			const path = `东方财富期货行情.list[${index}]`;
			const row = record(item, path);
			const contractCode = stringValue(row, "dm", path);
			const contract = expected.get(contractCode);
			if (contract === undefined) {
				throw new Error(`东方财富返回未请求的期货 ${contractCode}`);
			}
			const market = String(numberValue(row, "sc", path));
			if (market !== contract.market) {
				throw new Error(`东方财富期货 ${contractCode} 的市场不一致`);
			}
			return {
				code: contractCode,
				market,
				price: futuresPrice(row, path),
				productCode: contract.productCode,
				updatedAt: numberValue(row, "utime", path),
			};
		},
	);
	if (
		new Set(quotes.map((quote) => quote.code)).size !== quotes.length ||
		contracts.some(
			(contract) =>
				!quotes.some((quote) => quote.code === contract.contractCode),
		)
	) {
		throw new Error("东方财富期货行情没有完整覆盖在交易合约");
	}
	return quotes;
}
