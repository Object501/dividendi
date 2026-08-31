import { type EChartsType, init } from "echarts/core";

export function mountResponsiveChart(
	element: HTMLDivElement,
	configure: (chart: EChartsType) => void,
): () => void {
	const chart = init(element, undefined, { renderer: "svg" });
	configure(chart);
	const observer = new ResizeObserver(() => chart.resize());
	observer.observe(element);

	return () => {
		observer.disconnect();
		chart.dispose();
	};
}
