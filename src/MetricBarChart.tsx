import { BarChart } from "echarts/charts";
import {
	AriaComponent,
	GridComponent,
	TooltipComponent,
} from "echarts/components";
import { init, use } from "echarts/core";
import { SVGRenderer } from "echarts/renderers";
import { useEffect, useRef } from "react";

import { chartPalette } from "./chartTheme";
import { useTheme } from "./theme";

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
	const { theme } = useTheme();

	useEffect(() => {
		if (container.current === null) {
			return;
		}

		const palette = chartPalette(theme);
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
				backgroundColor: palette.tooltipBackground,
				borderColor: palette.tooltipBorder,
				textStyle: { color: palette.tooltipText },
				trigger: "axis",
				valueFormatter: (value: unknown) =>
					`${numberFormat.format(Number(value))}${unit}`,
			},
			xAxis: {
				axisLabel: { color: palette.axis, fontSize: 11 },
				axisLine: { lineStyle: { color: palette.axisLine } },
				axisTick: { show: false },
				data: data.map((item) => item.label),
				type: "category",
			},
			yAxis: {
				axisLabel: { color: palette.axis, fontSize: 10 },
				axisLine: { show: false },
				name: unit,
				nameTextStyle: { color: palette.axis, fontSize: 10 },
				splitLine: { lineStyle: { color: palette.splitLine } },
				type: "value",
			},
			series: [
				{
					barMaxWidth: 32,
					data: data.map((item) => ({
						itemStyle: {
							color: item.value >= 0 ? palette.positive : palette.negative,
							borderRadius: item.value >= 0 ? [5, 5, 0, 0] : [0, 0, 5, 5],
						},
						value: item.value,
					})),
					label: {
						color: palette.label,
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
	}, [data, description, theme, unit]);

	return <div className="metric-chart" ref={container} />;
}
