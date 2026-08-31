import { shanghaiTimeFormat } from "./formatters";
import type { Theme } from "./theme";
import type { MarketSnapshotState } from "./useMarketSnapshot";

function statusCopy(state: MarketSnapshotState): string {
	if (state.status === "loading") {
		return "正在读取历史基准与浏览器行情";
	}
	if (state.data === null) {
		return "暂无可用数据，请稍后再试";
	}
	const updatedAt = shanghaiTimeFormat.format(new Date(state.data.fetchedAt));
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

export function SiteHeader({
	snapshotState,
	theme,
	toggleTheme,
}: {
	readonly snapshotState: MarketSnapshotState;
	readonly theme: Theme;
	readonly toggleTheme: () => void;
}) {
	return (
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
	);
}
