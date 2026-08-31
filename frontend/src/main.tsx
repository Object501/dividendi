import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import "./styles/base.css";
import "./styles/market.css";
import "./styles/history.css";
import "./styles/navigation.css";
import "./styles/responsive.css";
import { ThemeProvider } from "./theme";

const root = document.getElementById("root");

if (root === null) {
	throw new Error("找不到应用挂载节点");
}

createRoot(root).render(
	<StrictMode>
		<ThemeProvider>
			<App />
		</ThemeProvider>
	</StrictMode>,
);
