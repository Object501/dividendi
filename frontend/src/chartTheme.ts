import type { Theme } from "./theme";

export interface ChartPalette {
	readonly area: string;
	readonly axis: string;
	readonly axisLine: string;
	readonly label: string;
	readonly negative: string;
	readonly positive: string;
	readonly secondary: string;
	readonly splitLine: string;
	readonly tooltipBackground: string;
	readonly tooltipBorder: string;
	readonly tooltipText: string;
	readonly zeroLine: string;
}

const darkPalette: ChartPalette = {
	area: "rgb(114 208 180 / 16%)",
	axis: "#9caca6",
	axisLine: "#34433e",
	label: "#d2ddd8",
	negative: "#f09b87",
	positive: "#72d0b4",
	secondary: "#d5bd68",
	splitLine: "#2a3833",
	tooltipBackground: "#18231f",
	tooltipBorder: "#34433e",
	tooltipText: "#edf3ef",
	zeroLine: "#5e7069",
};

const lightPalette: ChartPalette = {
	area: "rgb(30 110 94 / 10%)",
	axis: "#64716c",
	axisLine: "#d9ddd4",
	label: "#42534d",
	negative: "#b35b49",
	positive: "#1e6e5e",
	secondary: "#9a7113",
	splitLine: "#e8e9e3",
	tooltipBackground: "#fffdf8",
	tooltipBorder: "#d9ddd4",
	tooltipText: "#17312c",
	zeroLine: "#aeb7b1",
};

export function chartPalette(theme: Theme): ChartPalette {
	return theme === "dark" ? darkPalette : lightPalette;
}
