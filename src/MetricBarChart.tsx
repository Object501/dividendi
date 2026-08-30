import { BarChart } from "echarts/charts";
import {
	AriaComponent,
	GridComponent,
	TooltipComponent,
} from "echarts/components";
import { init, use } from "echarts/core";
import { SVGRenderer } from "echarts/renderers";
import { useEffect, useRef } from "react";

use([BarChart, GridComponent, TooltipComponent, AriaComponent, SVGRenderer]);

export interface ChartDatum {
	readonly label: string;
	readonly value: number;
}

interface MetricBarChartProps {
	readonly data: readonly ChartDatum[];
	readonly description: string;
	readonly unit: "点" | "%";
}

const numberFormat = new Intl.NumberFormat("zh-CN", {
	minimumFractionDigits: 0,
	maximumFractionDigits: 2,
});

export default function MetricBarChart({
	data,
	description,
	unit,
}: MetricBarChartProps) {
	const container = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (container.current === null) {
			return;
		}

		const chart = init(container.current, undefined, { renderer: "svg" });
		chart.setOption({
			animationDuration: 320,
			aria: {
				description,
				enabled: true,
			},
			grid: {
				bottom: 32,
				containLabel: true,
				left: 4,
				right: 8,
				top: 26,
			},
			tooltip: {
				trigger: "axis",
				valueFormatter: (value: unknown) =>
					`${numberFormat.format(Number(value))}${unit}`,
			},
			xAxis: {
				axisLabel: { color: "#64716c", fontSize: 11 },
				axisLine: { lineStyle: { color: "#d9ddd4" } },
				axisTick: { show: false },
				data: data.map((item) => item.label),
				type: "category",
			},
			yAxis: {
				axisLabel: { color: "#64716c", fontSize: 10 },
				axisLine: { show: false },
				name: unit,
				nameTextStyle: { color: "#64716c", fontSize: 10 },
				splitLine: { lineStyle: { color: "#e8e9e3" } },
				type: "value",
			},
			series: [
				{
					barMaxWidth: 32,
					data: data.map((item) => ({
						itemStyle: {
							color: item.value >= 0 ? "#1e6e5e" : "#b35b49",
							borderRadius: item.value >= 0 ? [5, 5, 0, 0] : [0, 0, 5, 5],
						},
						value: item.value,
					})),
					label: {
						color: "#42534d",
						fontSize: 10,
						formatter: (parameters: { value: number }) =>
							numberFormat.format(parameters.value),
						position: "top",
						show: true,
					},
					type: "bar",
				},
			],
		});

		const observer = new ResizeObserver(() => chart.resize());
		observer.observe(container.current);
		return () => {
			observer.disconnect();
			chart.dispose();
		};
	}, [data, description, unit]);

	return <div className="metric-chart" ref={container} />;
}
