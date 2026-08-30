import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

const frontendRoot = fileURLToPath(new URL(".", import.meta.url));
const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig(({ mode }) => {
	const environment = loadEnv(mode, repositoryRoot, "");
	return {
		base: "./",
		root: frontendRoot,
		envDir: repositoryRoot,
		cacheDir: resolve(repositoryRoot, "node_modules/.vite"),
		plugins: [react()],
		publicDir:
			mode === "development"
				? resolve(repositoryRoot, environment.DIVIDENDI_DATA_DIR || ".data")
				: false,
		build: {
			emptyOutDir: true,
			outDir: resolve(repositoryRoot, "dist"),
		},
		test: {
			environment: "node",
		},
	};
});
