import { useEffect, useState } from "react";
import { ThemeProvider } from "@/lib/theme-provider";
import type { Settings } from "@/types/index";

function App({ children }: { children: React.ReactNode }) {
	const [settings, setSettings] = useState<Settings>({
		theme: "system",
		autofill_url: true,
	});

	// loading the settings from storage if available, overwriting the default values when the component mounts
	useEffect(() => {
		const loadSettings = async () => {
			try {
				const result = await browser.storage.local.get("settings");
				if (result.settings) {
					// Merge saved settings with default settings
					// Only override keys that exist in saved settings, keeping defaults otherwise
					setSettings((prevSettings) => ({
						...prevSettings,
						...result.settings,
					}));
				}
			} catch (error) {
				console.error("Failed to load settings:", error);
			}
		};
		loadSettings();
	}, []);

	return (
		<ThemeProvider
			defaultTheme={settings.theme || "system"}
			storageKey="vite-ui-theme"
		>
			{children}
		</ThemeProvider>
	);
}

export default App;
