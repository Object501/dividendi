export const numberFormat = new Intl.NumberFormat("zh-CN", {
	minimumFractionDigits: 0,
	maximumFractionDigits: 2,
});

export const perShareDividendFormat = new Intl.NumberFormat("zh-CN", {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});

export const percentFormat = new Intl.NumberFormat("zh-CN", {
	style: "percent",
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});

export const shanghaiTimeFormat = new Intl.DateTimeFormat("zh-CN", {
	timeZone: "Asia/Shanghai",
	month: "numeric",
	day: "numeric",
	hour: "2-digit",
	minute: "2-digit",
});

export function signedPoints(value: number): string {
	const prefix = value > 0 ? "+" : "";
	return `${prefix}${numberFormat.format(value)}`;
}

export function contractDate(value: string): string {
	const [, month, day] = value.split("-");
	return `${Number(month)}月${Number(day)}日`;
}

export function valueTone(value: number): string {
	return value >= 0 ? "value-positive" : "value-negative";
}
