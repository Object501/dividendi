import type { TradingDayPhase } from "./tradingCalendar";

const shanghaiDateFormatter = new Intl.DateTimeFormat("en-CA", {
	day: "2-digit",
	hourCycle: "h23",
	month: "2-digit",
	timeZone: "Asia/Shanghai",
	year: "numeric",
});
const shanghaiClockFormatter = new Intl.DateTimeFormat("en-CA", {
	hour: "2-digit",
	hourCycle: "h23",
	minute: "2-digit",
	timeZone: "Asia/Shanghai",
	weekday: "short",
});

function parts(
	formatter: Intl.DateTimeFormat,
	value: Date,
): Readonly<Record<string, string>> {
	return Object.fromEntries(
		formatter
			.formatToParts(value)
			.filter((part) => part.type !== "literal")
			.map((part) => [part.type, part.value]),
	);
}

export function shanghaiDate(value: Date): string {
	const values = parts(shanghaiDateFormatter, value);
	return `${values.year}-${values.month}-${values.day}`;
}

export function tradingDayPhase(timestamp: string): TradingDayPhase {
	const values = parts(shanghaiClockFormatter, new Date(timestamp));
	return Number(values.hour) * 60 + Number(values.minute) >= 15 * 60
		? "eod"
		: "intraday";
}

export function isChineseMarketRefreshWindow(now: Date): boolean {
	const values = parts(shanghaiClockFormatter, now);
	if (values.weekday === "Sat" || values.weekday === "Sun") {
		return false;
	}
	const minutes = Number(values.hour) * 60 + Number(values.minute);
	return minutes >= 9 * 60 && minutes <= 16 * 60;
}
