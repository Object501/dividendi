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

export interface CompletedFiscalYearMetric {
	readonly dividendPerShare: number;
	readonly dividendYield: number;
	readonly fiscalYear: number;
}

export interface StockMetric {
	readonly market: string;
	readonly code: string;
	readonly latestPrice: number;
	readonly implementedDividendPerShare: number;
	readonly dividendYield: number;
	readonly priceSource: string;
	readonly dividendSource: string;
	readonly completedFiscalYear?: CompletedFiscalYearMetric;
}

export interface MarketSnapshot {
	readonly schemaVersion: 1;
	readonly marketDate: string;
	readonly fetchedAt: string;
	readonly futures: readonly FuturesMetric[];
	readonly stocks: readonly StockMetric[];
}
