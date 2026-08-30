import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "dividendi-theme";

interface ThemeContextValue {
	readonly theme: Theme;
	readonly toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function initialTheme(): Theme {
	try {
		return window.localStorage.getItem(STORAGE_KEY) === "light"
			? "light"
			: "dark";
	} catch {
		return "dark";
	}
}

export function ThemeProvider({ children }: { readonly children: ReactNode }) {
	const [theme, setTheme] = useState<Theme>(initialTheme);

	useEffect(() => {
		document.documentElement.dataset.theme = theme;
		document
			.querySelector('meta[name="theme-color"]')
			?.setAttribute("content", theme === "dark" ? "#0d1412" : "#173c35");
		try {
			window.localStorage.setItem(STORAGE_KEY, theme);
		} catch {
			// The selected theme still applies when storage is unavailable.
		}
	}, [theme]);

	const value = useMemo<ThemeContextValue>(
		() => ({
			theme,
			toggleTheme: () =>
				setTheme((current) => (current === "dark" ? "light" : "dark")),
		}),
		[theme],
	);

	return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme(): ThemeContextValue {
	const value = useContext(ThemeContext);
	if (value === null) {
		throw new Error("useTheme 必须在 ThemeProvider 内使用");
	}
	return value;
}
