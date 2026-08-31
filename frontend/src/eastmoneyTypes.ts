export interface EastmoneyContract {
	readonly contractCode: string;
	readonly market: string;
	readonly productCode: string;
}

export interface EastmoneyProduct {
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
