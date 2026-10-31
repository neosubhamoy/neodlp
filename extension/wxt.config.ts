import path from "path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
	modules: ["@wxt-dev/module-react"],
	react: {
		vitePluginsBefore: [
			tanstackRouter({
				target: "react",
				autoCodeSplitting: true,
				routesDirectory: "./entrypoints/popup/routes",
				generatedRouteTree: "./entrypoints/popup/routeTree.gen.ts",
			}),
		],
	},
	vite: () => ({
		plugins: [tailwindcss()],
		resolve: {
			alias: {
				"@": path.resolve(__dirname),
			},
		},
	}),
	manifest: ({ browser }) => {
		const manifest = {
			name: "Neo Downloader Plus",
			description: "Neo Downloader Plus Browser Integration",
			homepage_url: "https://neodlp.neosubhamoy.com",
			version: "0.4.5",
			permissions: ["tabs", "storage", "contextMenus", "nativeMessaging"],
		};
		if (browser === "chrome") {
			return {
				...manifest,
				key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAntUIxtZKYDil4qeQzS0anabCsEd/cUTR5gf9xShEXob54sSnbkUfG2+8m2XpZA4E0ATSOqUkEIG5t1nBPRdxWYoBQ6NfoW6MNyZFFwte9aoqfSiA8PiuYrtujYOEExtLl+WyU/eY45ufYrMqWHyuhb4KrPuRyHGO/xcn6boHlP5DAVPwbCLALlXswNRwHvtZUJgVUJkUt8LE3LkX8RGn5sN0+jJtrocXq6byOq/RzDCC22fdbVXxYLDAg3+pwlyx2/po3EhMnG6E3vkcqlpIuGUVcVxcjMZq9nAMLDtiArgQXLvvKaTzFJ7C1iacTIYh8soqRHGXh0vaaRK4ttuSQQIDAQAB",
				commands: {
					_execute_action: {
						suggested_key: {
							default: "Alt+Shift+N",
						},
					},
					"neodlp:quick-search": {
						description: "Quick Search",
						suggested_key: {
							default: "Alt+Shift+Q",
						},
					},
				},
			};
		} else if (browser === "firefox") {
			return {
				...manifest,
				browser_specific_settings: {
					gecko: {
						id: "neodlp@neosubhamoy.com",
					},
				},
				commands: {
					_execute_browser_action: {
						suggested_key: {
							default: "Alt+Shift+N",
						},
					},
					"neodlp:quick-search": {
						description: "Quick Search",
						suggested_key: {
							default: "Alt+Shift+Q",
						},
					},
				},
			};
		} else {
			return {
				...manifest,
				commands: {
					_execute_action: {
						suggested_key: {
							default: "Alt+Shift+N",
						},
					},
					"neodlp:quick-search": {
						description: "Quick Search",
						suggested_key: {
							default: "Alt+Shift+Q",
						},
					},
				},
			};
		}
	},
});
