import { fetchJson } from "./request";

const HOLIDAY_CALENDAR_URL =
	"https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPTA_WEB_ZGXSRL&columns=ALL&pageSize=200&sortColumns=SDATE&sortTypes=-1";

export interface TradingCalendar {
	readonly closedDates: ReadonlySet<string>;
	readonly coveredYears: ReadonlySet<number>;
}

export type TradingDayPhase = "eod" | "intraday";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isoDate(value: unknown, path: string): string {
	if (typeof value !== "string" || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}/.test(value)) {
		throw new Error(`${path} 必须包含 ISO 日期`);
	}
	const date = value.slice(0, 10);
	if (Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
		throw new Error(`${path} 不是有效日期`);
	}
	return date;
}

function addDays(date: string, days: number): string {
	const value = new Date(`${date}T00:00:00Z`);
	value.setUTCDate(value.getUTCDate() + days);
	return value.toISOString().slice(0, 10);
}

function yearOf(date: string): number {
	return Number(date.slice(0, 4));
}

export function parseTradingCalendar(value: unknown): TradingCalendar {
	if (!isRecord(value) || value.success !== true || !isRecord(value.result)) {
		throw new Error("东方财富休市日历响应无效");
	}
	const rows = value.result.data;
	if (!Array.isArray(rows)) {
		throw new Error("东方财富休市日历缺少数据");
	}

	const closedDates = new Set<string>();
	const coveredYears = new Set<number>();
	for (const [index, item] of rows.entries()) {
		if (!isRecord(item) || item.MKT !== "A股") {
			continue;
		}
		const start = isoDate(item.SDATE, `休市日历[${index}].SDATE`);
		const end = isoDate(item.EDATE, `休市日历[${index}].EDATE`);
		if (end < start) {
			throw new Error(`休市日历[${index}] 的结束日期早于开始日期`);
		}
		let current = start;
		while (current <= end) {
			closedDates.add(current);
			coveredYears.add(yearOf(current));
			current = addDays(current, 1);
		}
	}
	if (closedDates.size === 0) {
		throw new Error("东方财富休市日历没有 A 股休市日期");
	}
	return { closedDates, coveredYears };
}

export async function fetchTradingCalendar(
	options: {
		readonly fetcher?: typeof fetch;
		readonly signal?: AbortSignal;
	} = {},
): Promise<TradingCalendar> {
	return parseTradingCalendar(
		await fetchJson(HOLIDAY_CALENDAR_URL, "东方财富休市日历", options),
	);
}

export function isTradingDay(date: string, calendar: TradingCalendar): boolean {
	const day = new Date(`${date}T00:00:00Z`).getUTCDay();
	return day !== 0 && day !== 6 && !calendar.closedDates.has(date);
}

export function tradingDaysBetween(
	start: string,
	end: string,
	calendar: TradingCalendar,
): number {
	if (end < start) {
		return 0;
	}
	for (let year = yearOf(start); year <= yearOf(end); year += 1) {
		if (!calendar.coveredYears.has(year)) {
			throw new Error(`东方财富尚未公布 ${year} 年 A 股休市安排`);
		}
	}
	let count = 0;
	let current = start;
	while (current <= end) {
		if (isTradingDay(current, calendar)) {
			count += 1;
		}
		current = addDays(current, 1);
	}
	return count;
}

function thirdFriday(year: number, month: number): string {
	const first = new Date(Date.UTC(year, month - 1, 1));
	const firstFriday = 1 + ((5 - first.getUTCDay() + 7) % 7);
	return `${year.toString().padStart(4, "0")}-${month
		.toString()
		.padStart(2, "0")}-${(firstFriday + 14).toString().padStart(2, "0")}`;
}

export function contractExpiry(
	productCode: string,
	contractCode: string,
	calendar: TradingCalendar,
): string {
	const suffix = contractCode.slice(productCode.length);
	if (!contractCode.startsWith(productCode) || !/^[0-9]{4}$/.test(suffix)) {
		throw new Error(`期货合约 ${contractCode} 无法解析到期月份`);
	}
	const year = 2000 + Number(suffix.slice(0, 2));
	const month = Number(suffix.slice(2));
	if (month < 1 || month > 12) {
		throw new Error(`期货合约 ${contractCode} 的到期月份无效`);
	}
	let expiry = thirdFriday(year, month);
	while (!isTradingDay(expiry, calendar)) {
		expiry = addDays(expiry, 1);
	}
	return expiry;
}

export function remainingTradingDays(
	marketDate: string,
	expiryDate: string,
	intraday: boolean,
	calendar: TradingCalendar,
): number {
	return tradingDaysBetween(
		intraday ? marketDate : addDays(marketDate, 1),
		expiryDate,
		calendar,
	);
}

export function elapsedTradingDays(
	baselineDate: string,
	baselinePhase: TradingDayPhase,
	liveDate: string,
	livePhase: TradingDayPhase,
	calendar: TradingCalendar,
): number {
	if (liveDate < baselineDate) {
		throw new Error("新行情日期不能早于计算基准");
	}
	const baselineStart =
		baselinePhase === "intraday" ? baselineDate : addDays(baselineDate, 1);
	const liveStart = livePhase === "intraday" ? liveDate : addDays(liveDate, 1);
	return tradingDaysBetween(baselineStart, addDays(liveStart, -1), calendar);
}
