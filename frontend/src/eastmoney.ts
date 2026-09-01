import type { InstrumentConfig } from "./config";
import {
	EastmoneyQuotesNotReadyError,
	expectedSpotInstruments,
	parseContractCatalog,
	parseFuturesQuotes,
	parseProductCatalog,
	parseSpotQuotes,
} from "./eastmoneyParsers";
import type {
	EastmoneyContract,
	EastmoneyQuote,
	EastmoneyQuotes,
} from "./eastmoneyTypes";
import { shanghaiDate } from "./marketTime";
import { fetchJson } from "./request";

const FUTURES_CATALOG_URL =
	"https://futsse-static.eastmoney.com/redis?msgid=220";
const FUTURES_CONTRACT_URL = "https://futsse-static.eastmoney.com/redis?msgid=";
const FUTURES_QUOTE_URL = "https://futsseapi.eastmoney.com/list/custom/";
const SPOT_QUOTE_URL = "https://push2delay.eastmoney.com/api/qt/ulist.np/get";

interface EastmoneyRequestOptions {
	readonly fetcher?: typeof fetch;
	readonly signal?: AbortSignal;
}

export { EastmoneyQuotesNotReadyError };

function oldestTimestamp(quotes: readonly EastmoneyQuote[]): number {
	if (quotes.length === 0) {
		throw new Error("东方财富没有返回行情");
	}
	return Math.min(...quotes.map((quote) => quote.updatedAt));
}

export async function discoverEastmoneyContracts(
	instruments: InstrumentConfig,
	options: EastmoneyRequestOptions = {},
): Promise<readonly EastmoneyContract[]> {
	const { fetcher, signal } = options;
	const providerProducts = parseProductCatalog(
		await fetchJson(FUTURES_CATALOG_URL, "东方财富期货品种", {
			fetcher,
			signal,
		}),
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
			return parseContractCatalog(
				await fetchJson(url, `东方财富 ${product.code} 合约`, {
					fetcher,
					signal,
				}),
				product,
			);
		}),
	);
	return groups.flat();
}

export async function fetchEastmoneyQuotes(
	instruments: InstrumentConfig,
	contracts: readonly EastmoneyContract[],
	options: EastmoneyRequestOptions = {},
): Promise<EastmoneyQuotes> {
	const { fetcher, signal } = options;
	const spotIds = [...expectedSpotInstruments(instruments).keys()];
	const spotParameters = new URLSearchParams({
		fields: "f2,f18,f12,f13,f14,f124",
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
		fetchJson(`${SPOT_QUOTE_URL}?${spotParameters}`, "东方财富现货行情", {
			fetcher,
			signal,
		}),
		fetchJson(
			`${FUTURES_QUOTE_URL}${futuresPath}?${futuresParameters}`,
			"东方财富期货行情",
			{ fetcher, signal },
		),
	]);
	const spots = parseSpotQuotes(spotValue, instruments);
	const futures = parseFuturesQuotes(futuresValue, contracts);
	const allQuotes = [...spots, ...futures];
	const marketDates = new Set(
		allQuotes.map((quote) => shanghaiDate(new Date(quote.updatedAt * 1000))),
	);
	if (marketDates.size !== 1) {
		throw new EastmoneyQuotesNotReadyError("东方财富各市场行情尚未同步");
	}
	const timestamp = oldestTimestamp(allQuotes);
	return {
		fetchedAt: new Date(timestamp * 1000).toISOString(),
		futures,
		marketDate: [...marketDates][0] as string,
		spots,
	};
}
