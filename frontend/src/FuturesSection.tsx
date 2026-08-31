import { lazy } from "react";

import { ChartPanel } from "./ChartPanel";
import { instruments } from "./config";
import {
	contractDate,
	numberFormat,
	signedPoints,
	valueTone,
} from "./formatters";
import type { FuturesMetric, MarketSnapshot } from "./marketSnapshotTypes";
import { PlaceholderValue } from "./PlaceholderValue";

const MetricBarChart = lazy(() => import("./MetricBarChart"));

export function FuturesSection({
	snapshot,
}: {
	readonly snapshot: MarketSnapshot | null;
}) {
	return (
		<section className="section" id="futures" aria-labelledby="futures-title">
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
					const contracts = (snapshot?.futures ?? [])
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
											value: Number(contract.dailyDiscountPoints.toFixed(2)),
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
