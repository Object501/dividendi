import { BottomNavigation } from "./BottomNavigation";
import { FuturesSection } from "./FuturesSection";
import { HistorySection } from "./HistorySection";
import { MethodNote } from "./MethodNote";
import { SiteHeader } from "./SiteHeader";
import { StocksSection } from "./StocksSection";
import { useTheme } from "./theme";
import { useMarketSnapshot } from "./useMarketSnapshot";

export function App() {
	const { theme, toggleTheme } = useTheme();
	const snapshotState = useMarketSnapshot();

	return (
		<div className="app-shell">
			<SiteHeader
				snapshotState={snapshotState}
				theme={theme}
				toggleTheme={toggleTheme}
			/>
			<main>
				<FuturesSection snapshot={snapshotState.data} />
				<StocksSection snapshot={snapshotState.data} />
				<HistorySection currentSnapshot={snapshotState.data} />
				<MethodNote />
			</main>
			<BottomNavigation />
		</div>
	);
}
