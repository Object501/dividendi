import { lazy, Suspense } from "react";

import { instruments } from "./config";
import type { FuturesMetric } from "./data";
import { HistorySection } from "./HistorySection";
import { useTheme } from "./theme";
import {
	type MarketSnapshotState,
	useMarketSnapshot,
} from "./useMarketSnapshot";

const MetricBarChart = lazy(() => import("./MetricBarChart"));

const numberFormat = new Intl.NumberFormat("zh-CN", {
	minimumFractionDigits: 0,
	maximumFractionDigits: 2,
});
const perShareDividendFormat = new Intl.NumberFormat("zh-CN", {
	minimumFractionDigits: 2,
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

function statusCopy(state: MarketSnapshotState): string {
	if (state.status === "loading") {
		return "正在读取历史基准与浏览器行情";
	}
	if (state.data === null) {
		return "暂无可用数据，请稍后再试";
	}
	const updatedAt = timeFormat.format(new Date(state.data.fetchedAt));
	if (state.status === "error") {
		return `浏览器更新失败：${state.reason}；显示 ${updatedAt} 的上次有效数据`;
	}
	if (state.source === "browser") {
		return `行情日 ${state.data.marketDate} · ${updatedAt} 更新（约延迟 15 分钟）`;
	}
	if (state.source === "history") {
		return `行情日 ${state.data.marketDate} · ${updatedAt} 日终基准`;
	}
	return `行情日 ${state.data.marketDate} · ${updatedAt} 本机缓存，正在更新`;
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
	const snapshotState = useMarketSnapshot();
	const currentSnapshot = snapshotState.data;
	const rankedStocks = instruments.stocks
		.map((stock, index) => ({ metric: currentSnapshot?.stocks[index], stock }))
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
					用一致、可复核的口径，查看股指期货日化贴水，以及已实施 365
					天和完整财年的分红收益率。
				</p>
				<div
					className={`status-line${snapshotState.status === "error" ? " status-line--error" : ""}`}
					role="status"
				>
					<span className="status-dot" aria-hidden="true" />
					{statusCopy(snapshotState)}
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
							const contracts = (currentSnapshot?.futures ?? [])
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
							);
						})}
					</div>
					{currentSnapshot ? (
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

				<HistorySection currentSnapshot={currentSnapshot} />

				<aside className="method-note" aria-labelledby="method-title">
					<p className="eyebrow">口径说明</p>
					<h2 id="method-title">三个口径，分别看清</h2>
					<p className="method-note__intro">
						所有历史指标都只使用截至当日已知的数据，并与同日不复权收盘价配对。
					</p>
					<div className="method-note__grid">
						<article>
							<h3>日化贴水</h3>
							<p className="method-note__formula">
								（标的指数 − 期货价格）÷ 剩余交易日
							</p>
							<p>
								正数表示贴水，负数表示升水。盘中包含当天，日终从下一交易日开始计数。
							</p>
						</article>
						<article>
							<h3>已实施 365 天</h3>
							<p className="method-note__formula">
								窗口内已派每股分红 ÷ 当日收盘价
							</p>
							<p>
								按派息日统计，不含未派方案、预测、税费和再投资；新旧分红进出窗口时可能跳变。
							</p>
						</article>
						<article>
							<h3>购买参考</h3>
							<p className="method-note__formula">
								最近完整财年常规每股分红 ÷ 当日收盘价
							</p>
							<p>
								年度分红实际派发后才确认该财年；合计同财年的年度、中期和季度分红，排除特别分红且不向未来看。
							</p>
						</article>
					</div>
					<p className="method-note__footnote">
						购买参考能避免旧分红机械退出窗口，但完整财年分红真实变化时仍会调整；所有结果均为税前历史参考，不是预测或买卖建议。使用前请先检查页面顶部的行情日期和更新时间。
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
