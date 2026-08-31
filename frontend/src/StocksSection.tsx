import { lazy } from "react";

import { ChartPanel } from "./ChartPanel";
import { instruments } from "./config";
import {
	numberFormat,
	percentFormat,
	perShareDividendFormat,
} from "./formatters";
import type { MarketSnapshot } from "./marketSnapshotTypes";
import { PlaceholderValue } from "./PlaceholderValue";

const MetricBarChart = lazy(() => import("./MetricBarChart"));

export function StocksSection({
	snapshot,
}: {
	readonly snapshot: MarketSnapshot | null;
}) {
	const rankedStocks = instruments.stocks
		.map((stock, index) => ({ metric: snapshot?.stocks[index], stock }))
		.toSorted(
			(left, right) =>
				(right.metric?.dividendYield ?? -1) -
				(left.metric?.dividendYield ?? -1),
		);

	return (
		<section
			className="section"
			id="dividends"
			aria-labelledby="dividends-title"
		>
			<div className="section-heading">
				<div>
					<p className="eyebrow">A 股</p>
					<h2 id="dividends-title">近 365 天股息率</h2>
				</div>
				<span className="section-count">
					{instruments.stocks.length} 只股票
				</span>
			</div>

			<div className="stock-list">
				{rankedStocks.map(({ metric, stock }, index) => (
					<article className="stock-row" key={`${stock.market}:${stock.code}`}>
						<span className="rank">{String(index + 1).padStart(2, "0")}</span>
						<div className="stock-name">
							<h3>{stock.name}</h3>
							<p>
								{stock.market} · {stock.code}
								{metric
									? ` · 最新价 ¥${numberFormat.format(metric.latestPrice)} · 分红 ¥${perShareDividendFormat.format(metric.implementedDividendPerShare)} / 股`
									: ""}
							</p>
						</div>
						<div className="stock-yield">
							<strong>
								{metric ? (
									percentFormat.format(metric.dividendYield)
								) : (
									<PlaceholderValue />
								)}
							</strong>
							<span>税前股息率</span>
						</div>
					</article>
				))}
			</div>
			{snapshot ? (
				<ChartPanel title="股息率横向比较">
					<MetricBarChart
						data={rankedStocks.map(({ metric, stock }) => ({
							label: stock.name,
							value: Number(((metric?.dividendYield ?? 0) * 100).toFixed(2)),
						}))}
						description="配置股票过去365天已实施现金分红的税前股息率比较"
						unit="%"
					/>
				</ChartPanel>
			) : null}
		</section>
	);
}
