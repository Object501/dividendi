import { describe, expect, it } from "vitest";

import type { InstrumentConfig } from "./config";
import type { LatestData } from "./data";
import {
	type EastmoneyQuotes,
	mergeEastmoneyQuotes,
	parseContractCatalog,
	parseFuturesQuotes,
	parseProductCatalog,
	parseSpotQuotes,
} from "./eastmoney";
import fixture from "./fixtures/eastmoney-quotes.json";
import { parseTradingCalendar } from "./tradingCalendar";

const instruments: InstrumentConfig = {
	schemaVersion: 1,
	futuresProducts: [
		{
			code: "IM",
			exchange: "CFFEX",
			name: "中证1000股指期货",
			underlying: { code: "000852", market: "SH", name: "中证1000" },
		},
	],
	stocks: [{ code: "601939", market: "SH", name: "建设银行" }],
};
const product = instruments.futuresProducts[0];
if (product === undefined) {
	throw new Error("测试配置缺少期货品种");
}

const baseline: LatestData = {
	schemaVersion: 1,
	marketDate: "2026-08-28",
	fetchedAt: "2026-08-28T07:05:00Z",
	futures: [
		{
			contractCode: "IM2609",
			dailyDiscountPoints: 3,
			discountPoints: 36,
			expiryDate: "2026-09-18",
			futuresPrice: 6464,
			indexLevel: 6500,
			productCode: "IM",
			remainingTradingDays: 12,
			source: "cffex",
		},
	],
	stocks: [
		{
			code: "601939",
			completedFiscalYear: 2025,
			completedFiscalYearDividendPerShare: 0.5,
			completedFiscalYearDividendYield: 0.0625,
			dividendSource: "cninfo",
			dividendYield: 0.05,
			implementedDividendPerShare: 0.4,
			latestPrice: 8,
			market: "SH",
			priceSource: "baostock",
		},
	],
};

const calendar = parseTradingCalendar({
	success: true,
	result: {
		data: [
			{
				MKT: "A股",
				HOLIDAY: "国庆节",
				SDATE: "2026-10-01 00:00:00",
				EDATE: "2026-10-07 00:00:00",
			},
		],
	},
});

describe("东方财富浏览器行情", () => {
	it("从供应商目录筛选配置品种和具体合约", () => {
		const products = parseProductCatalog(fixture.productCatalog, instruments);
		expect(products).toEqual([{ market: "220", productCode: "IM", type: "7" }]);

		const contracts = parseContractCatalog(fixture.contractCatalog, product);
		expect(contracts).toEqual([
			{ contractCode: "IM2609", market: "220", productCode: "IM" },
		]);
	});

	it("解析完整的股票、指数和期货报价", () => {
		const contracts = parseContractCatalog(fixture.contractCatalog, product);
		expect(parseSpotQuotes(fixture.spotQuotes, instruments)).toHaveLength(2);
		expect(parseFuturesQuotes(fixture.futuresQuotes, contracts)).toEqual([
			{
				code: "IM2609",
				market: "220",
				price: 6500,
				productCode: "IM",
				updatedAt: 1787899500,
			},
		]);
	});

	it("用实时价格重算指标并在收盘后推进剩余交易日", () => {
		const live: EastmoneyQuotes = {
			fetchedAt: "2026-08-31T07:15:00.000Z",
			marketDate: "2026-08-31",
			futures: [
				{
					code: "IM2609",
					market: "220",
					price: 6500,
					productCode: "IM",
					updatedAt: 1788160500,
				},
			],
			spots: [
				{
					code: "000852",
					market: "SH",
					price: 6600,
					updatedAt: 1788160500,
				},
				{
					code: "601939",
					market: "SH",
					price: 10,
					updatedAt: 1788160500,
				},
			],
		};

		const merged = mergeEastmoneyQuotes(baseline, live, instruments, calendar);

		expect(merged.marketDate).toBe("2026-08-31");
		expect(merged.futures[0]).toMatchObject({
			dailyDiscountPoints: 100 / 11,
			discountPoints: 100,
			futuresPrice: 6500,
			indexLevel: 6600,
			remainingTradingDays: 11,
			source: "eastmoney",
		});
		expect(merged.stocks[0]).toMatchObject({
			completedFiscalYearDividendYield: 0.05,
			dividendYield: 0.04,
			latestPrice: 10,
			priceSource: "eastmoney",
		});
	});

	it("盘中沿用上一日终快照的剩余交易日", () => {
		const live: EastmoneyQuotes = {
			fetchedAt: "2026-08-31T02:00:00.000Z",
			marketDate: "2026-08-31",
			futures: [
				{
					code: "IM2609",
					market: "220",
					price: 6500,
					productCode: "IM",
					updatedAt: 1788141600,
				},
			],
			spots: [
				{
					code: "000852",
					market: "SH",
					price: 6600,
					updatedAt: 1788141600,
				},
				{
					code: "601939",
					market: "SH",
					price: 10,
					updatedAt: 1788141600,
				},
			],
		};

		expect(
			mergeEastmoneyQuotes(baseline, live, instruments, calendar).futures[0]
				?.remainingTradingDays,
		).toBe(12);
	});
});
