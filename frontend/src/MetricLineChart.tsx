import { LineChart } from "echarts/charts";
import {
	AriaComponent,
	GridComponent,
	LegendComponent,
	MarkLineComponent,
	TooltipComponent,
} from "echarts/components";
import { init, use } from "echarts/core";
import { SVGRenderer } from "echarts/renderers";
import { useEffect, useRef } from "react";

import { chartPalette } from "./chartTheme";
import { useTheme } from "./theme";

use([
	LineChart,
	GridComponent,
	LegendComponent,
	MarkLineComponent,
	TooltipComponent,
	AriaComponent,
	SVGRenderer,
]);

export interface LineChartDatum {
	readonly closePrice: number;
	readonly date: string;
	readonly metricValue: number;
}

export interface FiscalYearTransition {
	readonly date: string;
	readonly fromFiscalYear: number;
	readonly toFiscalYear: number;
}

interface MetricLineChartProps {
	readonly data: readonly LineChartDatum[];
	readonly description: string;
	readonly fiscalYearTransitions?: readonly FiscalYearTransition[];
	readonly metricLabel: string;
	readonly metricUnit: "点" | "%";
	readonly priceLabel: string;
	readonly priceUnit: "点" | "元";
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
	fiscalYearTransitions = [],
	metricLabel,
	metricUnit,
	priceLabel,
	priceUnit,
}: MetricLineChartProps) {
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
				bottom: 28,
				containLabel: true,
				left: 4,
				right: 8,
				top: 48,
			},
			legend: {
				data: [metricLabel, priceLabel],
				itemHeight: 8,
				itemWidth: 18,
				textStyle: { color: palette.label, fontSize: 10 },
				top: 4,
			},
			tooltip: {
				backgroundColor: palette.tooltipBackground,
				borderColor: palette.tooltipBorder,
				textStyle: { color: palette.tooltipText },
				trigger: "axis",
			},
			xAxis: {
				axisLabel: {
					color: palette.axis,
					fontSize: 10,
					formatter: shortDate,
					hideOverlap: true,
				},
				axisLine: { lineStyle: { color: palette.axisLine } },
				axisTick: { show: false },
				boundaryGap: false,
				data: data.map((item) => item.date),
				type: "category",
			},
			yAxis: [
				{
					axisLabel: { color: palette.positive, fontSize: 10 },
					axisLine: { show: false },
					name: metricUnit,
					nameTextStyle: { color: palette.positive, fontSize: 10 },
					position: "left",
					scale: true,
					splitLine: { lineStyle: { color: palette.splitLine } },
					type: "value",
				},
				{
					axisLabel: { color: palette.secondary, fontSize: 10 },
					axisLine: { show: false },
					name: priceUnit,
					nameTextStyle: { color: palette.secondary, fontSize: 10 },
					position: "right",
					scale: true,
					splitLine: { show: false },
					type: "value",
				},
			],
			series: [
				{
					areaStyle: { color: palette.area },
					data: data.map((item) => item.metricValue),
					itemStyle: { color: palette.positive },
					lineStyle: { color: palette.positive, width: 2 },
					markLine: {
						data: [
							{
								label: { show: false },
								lineStyle: {
									color: palette.zeroLine,
									type: "dashed",
									width: 1,
								},
								yAxis: 0,
							},
							...fiscalYearTransitions.map((transition) => ({
								label: {
									color: palette.annotation,
									fontSize: 9,
									formatter: `${transition.toFiscalYear}财年`,
									position: "insideEndTop",
									show: true,
								},
								lineStyle: {
									color: palette.annotation,
									type: "dashed",
									width: 1.2,
								},
								name: `${transition.fromFiscalYear} 财年 → ${transition.toFiscalYear} 财年`,
								xAxis: transition.date,
							})),
						],
						silent: true,
						symbol: "none",
					},
					showSymbol: false,
					smooth: 0.12,
					name: metricLabel,
					tooltip: {
						valueFormatter: (value: unknown) =>
							`${numberFormat.format(Number(value))}${metricUnit}`,
					},
					type: "line",
				},
				{
					data: data.map((item) => item.closePrice),
					itemStyle: { color: palette.secondary },
					lineStyle: { color: palette.secondary, width: 1.8 },
					name: priceLabel,
					showSymbol: false,
					smooth: 0.12,
					tooltip: {
						valueFormatter: (value: unknown) =>
							`${numberFormat.format(Number(value))}${priceUnit}`,
					},
					type: "line",
					yAxisIndex: 1,
				},
			],
		});

		const observer = new ResizeObserver(() => chart.resize());
		observer.observe(container.current);
		return () => {
			observer.disconnect();
			chart.dispose();
		};
	}, [
		data,
		description,
		fiscalYearTransitions,
		metricLabel,
		metricUnit,
		priceLabel,
		priceUnit,
		theme,
	]);

	return <div className="metric-chart metric-chart--history" ref={container} />;
}
