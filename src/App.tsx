import { instruments } from "./config";

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
	return (
		<div className="app-shell">
			<header className="hero">
				<div className="hero__brand">
					<span className="brand-mark" aria-hidden="true">
						D
					</span>
					<div>
						<p className="eyebrow">DIVIDENDI</p>
						<h1>贴水与股息率</h1>
					</div>
				</div>
				<p className="hero__summary">
					用一致、可复核的口径，查看股指期货日化贴水与过去 365
					天已实施分红收益率。
				</p>
				<div className="status-line" role="status">
					<span className="status-dot" aria-hidden="true" />
					等待首次数据更新
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
						{instruments.futuresProducts.map((product) => (
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
										<dd>
											<PlaceholderValue />
										</dd>
									</div>
									<div>
										<dt>日化贴水</dt>
										<dd>
											<PlaceholderValue />
										</dd>
									</div>
									<div>
										<dt>剩余交易日</dt>
										<dd>
											<PlaceholderValue />
										</dd>
									</div>
								</dl>
								<p className="empty-copy">
									行情到达后，将在这里显示各在交易合约及期限结构。
								</p>
							</article>
						))}
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
						{instruments.stocks.map((stock, index) => (
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
									</p>
								</div>
								<div className="stock-yield">
									<PlaceholderValue />
									<span>税前股息率</span>
								</div>
							</article>
						))}
					</div>
				</section>

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
			</nav>
		</div>
	);
}
