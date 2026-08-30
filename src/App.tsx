import { lazy, Suspense } from "react";

import { instruments } from "./config";
import type { FuturesMetric } from "./data";
import { HistorySection } from "./HistorySection";
import { useTheme } from "./theme";
import { type LatestDataState, useLatestData } from "./useLatestData";

const MetricBarChart = lazy(() => import("./MetricBarChart"));

const numberFormat = new Intl.NumberFormat("zh-CN", {
	minimumFractionDigits: 0,
	maximumFractionDigits: 2,
});
const percentFormat = new Intl.NumberFormat("zh-CN", {
	style: "percent",
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});
const timeFormat = new Intl.DateTimeFormat("zh-CN", {
	timeZone: "Asia/Shanghai",
	month: "numeric",
	day: "numeric",
	hour: "2-digit",
	minute: "2-digit",
});

function signedPoints(value: number): string {
	const prefix = value > 0 ? "+" : "";
	return `${prefix}${numberFormat.format(value)}`;
}

function contractDate(value: string): string {
	const [, month, day] = value.split("-");
	return `${Number(month)}月${Number(day)}日`;
}

function statusCopy(state: LatestDataState): string {
	if (state.status === "loading") {
		return "正在读取最新数据";
	}
	if (state.data === null) {
		return "暂无可用数据，请稍后再试";
	}
	const updatedAt = timeFormat.format(new Date(state.data.fetchedAt));
	return state.status === "error"
		? `更新失败，显示 ${updatedAt} 的数据`
		: `行情日 ${state.data.marketDate} · ${updatedAt} 更新`;
}

function valueTone(value: number): string {
	return value >= 0 ? "value-positive" : "value-negative";
}

function PlaceholderValue() {
	return (
		<>
			<span className="placeholder-value" aria-hidden="true">
				—
			</span>
			<span className="sr-only">暂无数据</span>
		</>
	);
}

export function App() {
	const { theme, toggleTheme } = useTheme();
	const latestState = useLatestData();
	const latest = latestState.data;
	const rankedStocks = instruments.stocks
		.map((stock, index) => ({ metric: latest?.stocks[index], stock }))
		.toSorted(
			(left, right) =>
				(right.metric?.dividendYield ?? -1) -
				(left.metric?.dividendYield ?? -1),
		);

	return (
		<div className="app-shell">
			<header className="hero">
				<div className="hero__top">
					<div className="hero__brand">
						<span className="brand-mark" aria-hidden="true">
							D
						</span>
						<div>
							<p className="eyebrow">DIVIDENDI</p>
							<h1>贴水与股息率</h1>
						</div>
					</div>
					<button
						aria-label={`切换到${theme === "dark" ? "浅色" : "暗色"}模式`}
						aria-pressed={theme === "dark"}
						className="theme-toggle"
						onClick={toggleTheme}
						type="button"
					>
						<span aria-hidden="true" className="theme-toggle__icon">
							{theme === "dark" ? "☼" : "◐"}
						</span>
						<span className="theme-toggle__label">
							{theme === "dark" ? "浅色" : "暗色"}
						</span>
					</button>
				</div>
				<p className="hero__summary">
					用一致、可复核的口径，查看股指期货日化贴水与过去 365
					天已实施分红收益率。
				</p>
				<div
					className={`status-line${latestState.status === "error" ? " status-line--error" : ""}`}
					role="status"
				>
					<span className="status-dot" aria-hidden="true" />
					{statusCopy(latestState)}
				</div>
			</header>

			<main>
				<section
					className="section"
					id="futures"
					aria-labelledby="futures-title"
				>
					<div className="section-heading">
						<div>
							<p className="eyebrow">股指期货</p>
							<h2 id="futures-title">日化贴水</h2>
						</div>
						<span className="section-count">
							{instruments.futuresProducts.length} 个品种
						</span>
					</div>

					<div className="card-grid">
						{instruments.futuresProducts.map((product) => {
							const contracts = (latest?.futures ?? [])
								.filter((metric) => metric.productCode === product.code)
								.toSorted((left, right) =>
									left.expiryDate.localeCompare(right.expiryDate),
								);
							const nearest = contracts[0];

							return (
								<article
									className="metric-card metric-card--feature"
									key={product.code}
								>
									<div className="metric-card__title-row">
										<div>
											<p className="instrument-code">
												{product.exchange} · {product.code}
											</p>
											<h3>{product.name}</h3>
										</div>
										<span className="instrument-badge">
											{product.underlying.name}
										</span>
									</div>
									<dl className="metric-row">
										<div>
											<dt>最近合约</dt>
											<dd>{nearest?.contractCode ?? <PlaceholderValue />}</dd>
										</div>
										<div>
											<dt>日化贴水</dt>
											<dd
												className={
													nearest
														? valueTone(nearest.dailyDiscountPoints)
														: undefined
												}
											>
												{nearest ? (
													signedPoints(nearest.dailyDiscountPoints)
												) : (
													<PlaceholderValue />
												)}
											</dd>
										</div>
										<div>
											<dt>剩余交易日</dt>
											<dd>
												{nearest?.remainingTradingDays ?? <PlaceholderValue />}
											</dd>
										</div>
									</dl>
									{contracts.length === 0 ? (
										<p className="empty-copy">
											行情到达后，将在这里显示各在交易合约及期限结构。
										</p>
									) : (
										<div className="contract-list">
											{contracts.map((contract) => (
												<ContractRow
													contract={contract}
													key={contract.contractCode}
												/>
											))}
										</div>
									)}
									{contracts.length > 0 ? (
										<ChartPanel title="各合约日化贴水">
											<MetricBarChart
												data={contracts.map((contract) => ({
													label: contract.contractCode,
													value: Number(
														contract.dailyDiscountPoints.toFixed(2),
													),
												}))}
												description={`${product.name}各在交易合约的日化贴水点数`}
												unit="点"
											/>
										</ChartPanel>
									) : null}
								</article>
							);
						})}
					</div>
				</section>

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
						{rankedStocks.map(({ metric, stock }, index) => {
							return (
								<article
									className="stock-row"
									key={`${stock.market}:${stock.code}`}
								>
									<span className="rank">
										{String(index + 1).padStart(2, "0")}
									</span>
									<div className="stock-name">
										<h3>{stock.name}</h3>
										<p>
											{stock.market} · {stock.code}
											{metric
												? ` · 最新价 ¥${numberFormat.format(metric.latestPrice)} · 分红 ¥${numberFormat.format(metric.implementedDividendPerShare)}`
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
							);
						})}
					</div>
					{latest ? (
						<ChartPanel title="股息率横向比较">
							<MetricBarChart
								data={rankedStocks.map(({ metric, stock }) => ({
									label: stock.name,
									value: Number(
										((metric?.dividendYield ?? 0) * 100).toFixed(2),
									),
								}))}
								description="配置股票过去365天已实施现金分红的税前股息率比较"
								unit="%"
							/>
						</ChartPanel>
					) : null}
				</section>

				<HistorySection latest={latest} />

				<aside className="method-note" aria-labelledby="method-title">
					<p className="eyebrow">口径说明</p>
					<h2 id="method-title">先看数据日期，再看数字</h2>
					<p>
						贴水按剩余交易日折算；股息率仅统计过去 365
						天已经实施的每股现金分红，不含预测和税费。
					</p>
				</aside>
			</main>

			<nav className="bottom-nav" aria-label="页面导航">
				<a href="#futures">
					<span aria-hidden="true">↘</span>
					日化贴水
				</a>
				<a href="#dividends">
					<span aria-hidden="true">%</span>
					股息率
				</a>
				<a href="#history">
					<span aria-hidden="true">⌁</span>
					历史趋势
				</a>
			</nav>
		</div>
	);
}

function ChartPanel({
	children,
	title,
}: {
	readonly children: React.ReactNode;
	readonly title: string;
}) {
	return (
		<div className="chart-panel">
			<p>{title}</p>
			<Suspense
				fallback={<div className="chart-placeholder">正在绘制图表</div>}
			>
				{children}
			</Suspense>
		</div>
	);
}

function ContractRow({ contract }: { readonly contract: FuturesMetric }) {
	return (
		<div className="contract-row">
			<div>
				<strong>{contract.contractCode}</strong>
				<span>{contractDate(contract.expiryDate)}到期</span>
			</div>
			<dl>
				<div>
					<dt>最新价</dt>
					<dd>{numberFormat.format(contract.futuresPrice)}</dd>
				</div>
				<div>
					<dt>贴水</dt>
					<dd className={valueTone(contract.discountPoints)}>
						{signedPoints(contract.discountPoints)}
					</dd>
				</div>
				<div>
					<dt>日化</dt>
					<dd className={valueTone(contract.dailyDiscountPoints)}>
						{signedPoints(contract.dailyDiscountPoints)}
					</dd>
				</div>
			</dl>
		</div>
	);
}
