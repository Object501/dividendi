import { LineChart } from "echarts/charts";
import {
	AriaComponent,
	GridComponent,
	TooltipComponent,
} from "echarts/components";
import { init, use } from "echarts/core";
import { SVGRenderer } from "echarts/renderers";
import { useEffect, useRef } from "react";

use([LineChart, GridComponent, TooltipComponent, AriaComponent, SVGRenderer]);

export interface LineChartDatum {
	readonly date: string;
	readonly value: number;
}

interface MetricLineChartProps {
	readonly data: readonly LineChartDatum[];
	readonly description: string;
	readonly unit: "点" | "%";
}

const numberFormat = new Intl.NumberFormat("zh-CN", {
	minimumFractionDigits: 0,
	maximumFractionDigits: 2,
});

function shortDate(value: string): string {
	const [, month, day] = value.split("-");
	return `${Number(month)}/${Number(day)}`;
}

export default function MetricLineChart({
	data,
	description,
	unit,
}: MetricLineChartProps) {
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
				bottom: 28,
				containLabel: true,
				left: 4,
				right: 8,
				top: 20,
			},
			tooltip: {
				trigger: "axis",
				valueFormatter: (value: unknown) =>
					`${numberFormat.format(Number(value))}${unit}`,
			},
			xAxis: {
				axisLabel: {
					color: "#64716c",
					fontSize: 10,
					formatter: shortDate,
					hideOverlap: true,
				},
				axisLine: { lineStyle: { color: "#d9ddd4" } },
				axisTick: { show: false },
				boundaryGap: false,
				data: data.map((item) => item.date),
				type: "category",
			},
			yAxis: {
				axisLabel: { color: "#64716c", fontSize: 10 },
				axisLine: { show: false },
				name: unit,
				nameTextStyle: { color: "#64716c", fontSize: 10 },
				scale: true,
				splitLine: { lineStyle: { color: "#e8e9e3" } },
				type: "value",
			},
			series: [
				{
					areaStyle: { color: "rgb(30 110 94 / 10%)" },
					data: data.map((item) => item.value),
					lineStyle: { color: "#1e6e5e", width: 2 },
					markLine: {
						data: [{ yAxis: 0 }],
						label: { show: false },
						lineStyle: { color: "#aeb7b1", type: "dashed", width: 1 },
						silent: true,
						symbol: "none",
					},
					showSymbol: false,
					smooth: 0.12,
					type: "line",
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

	return <div className="metric-chart metric-chart--history" ref={container} />;
}
