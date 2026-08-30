import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
	const environment = loadEnv(mode, process.cwd(), "");
	return {
		base: "./",
		plugins: [react()],
		publicDir:
			mode === "development"
				? environment.DIVIDENDI_DATA_DIR || ".data"
				: "public",
		test: {
			environment: "node",
		},
	};
});
