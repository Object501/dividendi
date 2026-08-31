export function MethodNote() {
	return (
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
	);
}
