import { type ReactNode, Suspense } from "react";

export function ChartPanel({
	children,
	title,
}: {
	readonly children: ReactNode;
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
