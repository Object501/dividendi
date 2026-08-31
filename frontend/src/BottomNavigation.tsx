export function BottomNavigation() {
	return (
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
	);
}
