// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
	adapter: cloudflare(),
	integrations: [react(), sitemap()],
	vite: {
		plugins: [tailwindcss()],
	},
	site: "https://neodlp.neosubhamoy.com",
	output: "server",
});
