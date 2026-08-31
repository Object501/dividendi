import type {
	FuturesProduct,
	InstrumentConfig,
	MarketInstrument,
} from "./config";
import type { LatestData } from "./data";
import {
	contractExpiry,
	elapsedTradingDays,
	remainingTradingDays,
	type TradingCalendar,
	type TradingDayPhase,
} from "./tradingCalendar";

const FUTURES_MARKET = "220";
const FUTURES_CATALOG_URL =
	"https://futsse-static.eastmoney.com/redis?msgid=220";
const FUTURES_CONTRACT_URL = "https://futsse-static.eastmoney.com/redis?msgid=";
const FUTURES_QUOTE_URL = "https://futsseapi.eastmoney.com/list/custom/";
const SPOT_QUOTE_URL = "https://push2delay.eastmoney.com/api/qt/ulist.np/get";
const QUOTE_SOURCE = "eastmoney";

export interface EastmoneyContract {
	readonly contractCode: string;
	readonly market: string;
	readonly productCode: string;
}

interface ProviderProduct {
	readonly market: string;
	readonly productCode: string;
	readonly type: string;
}

export interface EastmoneyQuote {
	readonly code: string;
	readonly market: string;
	readonly price: number;
	readonly productCode?: string;
	readonly updatedAt: number;
}

export interface EastmoneyQuotes {
	readonly fetchedAt: string;
	readonly futures: readonly EastmoneyQuote[];
	readonly marketDate: string;
	readonly spots: readonly EastmoneyQuote[];
}

type Fetcher = typeof fetch;

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

function shanghaiDate(epochSeconds: number): string {
	const parts = new Intl.DateTimeFormat("en", {
		day: "2-digit",
		month: "2-digit",
		timeZone: "Asia/Shanghai",
		year: "numeric",
	})
		.formatToParts(new Date(epochSeconds * 1000))
		.filter((part) => part.type !== "literal")
		.map((part) => [part.type, part.value]);
	const values = Object.fromEntries(parts);
	return `${values.year}-${values.month}-${values.day}`;
}

function oldestTimestamp(quotes: readonly EastmoneyQuote[]): number {
	if (quotes.length === 0) {
		throw new Error("东方财富没有返回行情");
	}
	return Math.min(...quotes.map((quote) => quote.updatedAt));
}

async function fetchJson(url: string, fetcher: Fetcher): Promise<unknown> {
	let failure: unknown = new Error("东方财富请求失败");
	for (let attempt = 0; attempt < 2; attempt += 1) {
		try {
			const response = await fetcher(url, { cache: "no-store" });
			if (!response.ok) {
				throw new Error(`东方财富请求失败：${response.status}`);
			}
			return response.json();
		} catch (error) {
			failure = error;
			if (attempt === 0) {
				await new Promise((resolve) =>
					setTimeout(resolve, 250 + Math.random() * 500),
				);
			}
		}
	}
	throw failure;
}

export function parseProductCatalog(
	value: unknown,
	instruments: InstrumentConfig,
): readonly ProviderProduct[] {
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
		return matches[0] as ProviderProduct;
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

export async function discoverEastmoneyContracts(
	instruments: InstrumentConfig,
	fetcher: Fetcher = fetch,
): Promise<readonly EastmoneyContract[]> {
	const providerProducts = parseProductCatalog(
		await fetchJson(FUTURES_CATALOG_URL, fetcher),
		instruments,
	);
	const groups = await Promise.all(
		providerProducts.map(async (providerProduct) => {
			const product = instruments.futuresProducts.find(
				(candidate) => candidate.code === providerProduct.productCode,
			);
			if (product === undefined) {
				throw new Error(`标的配置缺少 ${providerProduct.productCode}`);
			}
			const url = `${FUTURES_CONTRACT_URL}${providerProduct.market}_${providerProduct.type}`;
			return parseContractCatalog(await fetchJson(url, fetcher), product);
		}),
	);
	return groups.flat();
}

function expectedSpotInstruments(
	instruments: InstrumentConfig,
): ReadonlyMap<string, MarketInstrument> {
	const entries = [
		...instruments.futuresProducts.map((product) => product.underlying),
		...instruments.stocks,
	].map((instrument) => [spotSecurityId(instrument), instrument] as const);
	return new Map(entries);
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
				price: numberValue(row, "f2", path),
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
				price: numberValue(row, "p", path),
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

export async function fetchEastmoneyQuotes(
	instruments: InstrumentConfig,
	contracts: readonly EastmoneyContract[],
	fetcher: Fetcher = fetch,
): Promise<EastmoneyQuotes> {
	const spotIds = [...expectedSpotInstruments(instruments).keys()];
	const spotParameters = new URLSearchParams({
		fields: "f2,f12,f13,f14,f124",
		fltt: "2",
		secids: spotIds.join(","),
	});
	const futuresPath = contracts
		.map((contract) => `${contract.market}_${contract.contractCode}`)
		.join(",");
	const futuresParameters = new URLSearchParams({
		field: "dm,p,utime,sc",
		orderBy: "dm",
		pageIndex: "0",
		pageSize: String(contracts.length),
		sort: "asc",
	});
	const [spotValue, futuresValue] = await Promise.all([
		fetchJson(`${SPOT_QUOTE_URL}?${spotParameters}`, fetcher).catch(() => {
			throw new Error("东方财富现货行情请求失败");
		}),
		fetchJson(
			`${FUTURES_QUOTE_URL}${futuresPath}?${futuresParameters}`,
			fetcher,
		).catch(() => {
			throw new Error("东方财富期货行情请求失败");
		}),
	]);
	const spots = parseSpotQuotes(spotValue, instruments);
	const futures = parseFuturesQuotes(futuresValue, contracts);
	const allQuotes = [...spots, ...futures];
	const marketDates = new Set(
		allQuotes.map((quote) => shanghaiDate(quote.updatedAt)),
	);
	if (marketDates.size !== 1) {
		throw new Error("东方财富行情日期不一致");
	}
	const timestamp = oldestTimestamp(allQuotes);
	return {
		fetchedAt: new Date(timestamp * 1000).toISOString(),
		futures,
		marketDate: [...marketDates][0] as string,
		spots,
	};
}

export function snapshotPhase(timestamp: string): TradingDayPhase {
	const parts = Object.fromEntries(
		new Intl.DateTimeFormat("en", {
			hour: "2-digit",
			hour12: false,
			minute: "2-digit",
			timeZone: "Asia/Shanghai",
		})
			.formatToParts(new Date(timestamp))
			.filter((part) => part.type !== "literal")
			.map((part) => [part.type, part.value]),
	);
	return Number(parts.hour) * 60 + Number(parts.minute) >= 15 * 60
		? "eod"
		: "intraday";
}

export function mergeEastmoneyQuotes(
	baseline: LatestData,
	baselinePhase: TradingDayPhase,
	live: EastmoneyQuotes,
	instruments: InstrumentConfig,
	calendar: TradingCalendar,
): LatestData {
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
	const livePhase = snapshotPhase(live.fetchedAt);
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
			previous.completedFiscalYearDividendPerShare === undefined
				? {}
				: {
						completedFiscalYearDividendYield:
							previous.completedFiscalYearDividendPerShare / quote.price,
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
	baseline: LatestData,
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
			shanghaiDate(quote.updatedAt) !== live.marketDate
		) {
			throw new Error(`浏览器行情缺少 ${productCode} 标的指数`);
		}
		return [productCode, quote.price] as const;
	});
}
