import { lazy, Suspense, useMemo, useState } from "react";

import { instruments } from "./config";
import type { HistoryData, LatestData } from "./data";
import { useHistoryData } from "./useHistoryData";

const MetricLineChart = lazy(() => import("./MetricLineChart"));

type MetricKind = "futures" | "stocks";
type RangeDays = 31 | 92 | 365;

interface TrendPoint {
	readonly date: string;
	readonly value: number;
}

const numberFormat = new Intl.NumberFormat("zh-CN", {
	minimumFractionDigits: 0,
	maximumFractionDigits: 2,
});

const percentFormat = new Intl.NumberFormat("zh-CN", {
	style: "percent",
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});

function filterRange(
	points: readonly TrendPoint[],
	history: HistoryData,
	rangeDays: RangeDays,
): readonly TrendPoint[] {
	const newestDate = history.snapshots.at(-1)?.marketDate;
	if (newestDate === undefined) {
		return [];
	}
	const cutoff = new Date(`${newestDate}T00:00:00Z`);
	cutoff.setUTCDate(cutoff.getUTCDate() - rangeDays);
	const cutoffDate = cutoff.toISOString().slice(0, 10);
	return points.filter((point) => point.date > cutoffDate);
}

function currentContracts(
	history: HistoryData,
	latest: LatestData | null,
): readonly string[] {
	const newest = history.snapshots.at(-1);
	const source = latest?.marketDate === newest?.marketDate ? latest : newest;
	return [
		...new Set(source?.futures.map((metric) => metric.contractCode) ?? []),
	];
}

function futuresPoints(
	history: HistoryData,
	contractCode: string,
): readonly TrendPoint[] {
	return history.snapshots.flatMap((snapshot) => {
		const metric = snapshot.futures.find(
			(candidate) => candidate.contractCode === contractCode,
		);
		return metric === undefined
			? []
			: [{ date: snapshot.marketDate, value: metric.dailyDiscountPoints }];
	});
}

function stockPoints(
	history: HistoryData,
	stockKey: string,
): readonly TrendPoint[] {
	return history.snapshots.flatMap((snapshot) => {
		const metric = snapshot.stocks.find(
			(candidate) => `${candidate.market}:${candidate.code}` === stockKey,
		);
		return metric === undefined
			? []
			: [{ date: snapshot.marketDate, value: metric.dividendYield * 100 }];
	});
}

export function HistorySection({
	latest,
}: {
	readonly latest: LatestData | null;
}) {
	const { load, state } = useHistoryData();

	return (
		<section className="section" id="history" aria-labelledby="history-title">
			<div className="section-heading">
				<div>
					<p className="eyebrow">历史趋势</p>
					<h2 id="history-title">回看最近一年</h2>
				</div>
				<span className="section-count">按需加载</span>
			</div>

			{state.status === "ready" ? (
				<HistoryExplorer history={state.data} latest={latest} />
			) : (
				<div className="history-gate">
					<p>历史文件约含一年交易日。需要时再下载，避免拖慢手机首屏。</p>
					<button
						className="primary-button"
						disabled={state.status === "loading"}
						onClick={() => void load()}
						type="button"
					>
						{state.status === "loading"
							? "正在加载历史数据"
							: state.status === "error"
								? "加载失败，重新尝试"
								: "加载历史趋势"}
					</button>
				</div>
			)}
		</section>
	);
}

function HistoryExplorer({
	history,
	latest,
}: {
	readonly history: HistoryData;
	readonly latest: LatestData | null;
}) {
	const contracts = currentContracts(history, latest);
	const [kind, setKind] = useState<MetricKind>("futures");
	const [contractCode, setContractCode] = useState(contracts[0] ?? "");
	const firstStock = instruments.stocks[0];
	const [stockKey, setStockKey] = useState(
		firstStock === undefined ? "" : `${firstStock.market}:${firstStock.code}`,
	);
	const [rangeDays, setRangeDays] = useState<RangeDays>(92);

	const allPoints = useMemo(
		() =>
			kind === "futures"
				? futuresPoints(history, contractCode)
				: stockPoints(history, stockKey),
		[contractCode, history, kind, stockKey],
	);
	const points = filterRange(allPoints, history, rangeDays);
	const selectedStock = instruments.stocks.find(
		(stock) => `${stock.market}:${stock.code}` === stockKey,
	);
	const label =
		kind === "futures"
			? `${contractCode} 日化贴水`
			: `${selectedStock?.name ?? stockKey} 股息率`;
	const unit = kind === "futures" ? "点" : "%";
	const latestPoint = points.at(-1);

	return (
		<div className="history-card">
			<fieldset className="segmented-control">
				<legend className="sr-only">历史指标</legend>
				<button
					aria-pressed={kind === "futures"}
					onClick={() => setKind("futures")}
					type="button"
				>
					期货贴水
				</button>
				<button
					aria-pressed={kind === "stocks"}
					onClick={() => setKind("stocks")}
					type="button"
				>
					股票股息率
				</button>
			</fieldset>

			<div className="history-controls">
				<label>
					<span>{kind === "futures" ? "当前合约" : "股票"}</span>
					<select
						onChange={(event) =>
							kind === "futures"
								? setContractCode(event.target.value)
								: setStockKey(event.target.value)
						}
						value={kind === "futures" ? contractCode : stockKey}
					>
						{kind === "futures"
							? contracts.map((contract) => (
									<option key={contract} value={contract}>
										{contract}
									</option>
								))
							: instruments.stocks.map((stock) => {
									const key = `${stock.market}:${stock.code}`;
									return (
										<option key={key} value={key}>
											{stock.name} · {stock.code}
										</option>
									);
								})}
					</select>
				</label>

				<fieldset className="range-control">
					<legend className="sr-only">历史范围</legend>
					{(
						[
							[31, "1 个月"],
							[92, "3 个月"],
							[365, "1 年"],
						] as const
					).map(([days, copy]) => (
						<button
							aria-pressed={rangeDays === days}
							key={days}
							onClick={() => setRangeDays(days)}
							type="button"
						>
							{copy}
						</button>
					))}
				</fieldset>
			</div>

			{points.length === 0 || latestPoint === undefined ? (
				<p className="history-empty">所选范围内暂无可用数据。</p>
			) : (
				<>
					<div className="history-summary">
						<p>{label}</p>
						<strong>
							{kind === "futures"
								? `${latestPoint.value > 0 ? "+" : ""}${numberFormat.format(latestPoint.value)}点`
								: percentFormat.format(latestPoint.value / 100)}
						</strong>
						<span>
							{points[0]?.date} 至 {latestPoint.date} · {points.length} 个交易日
						</span>
					</div>
					<Suspense
						fallback={<div className="chart-placeholder">正在绘制历史趋势</div>}
					>
						<MetricLineChart
							data={points}
							description={`${label}从${points[0]?.date}到${latestPoint.date}的历史趋势`}
							unit={unit}
						/>
					</Suspense>
					{kind === "futures" ? (
						<p className="history-hint">
							仅显示当前仍在交易的具体合约；上市前没有历史点，换月时请改选合约。
						</p>
					) : null}
				</>
			)}
		</div>
	);
}
