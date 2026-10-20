import path from "path";
import { defineConfig } from "vitest/config";

// Kept separate from vite.config.ts so tests don't load the router/devtools/tailwind plugins.
export default defineConfig({
	resolve: {
		alias: {
			"@": path.resolve(import.meta.dirname, "./src"),
		},
	},
	test: {
		environment: "node",
		include: ["src/**/*.test.{ts,tsx}"],
		restoreMocks: true,
	},
});
