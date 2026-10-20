import { useKvPairs } from "@/hooks/use-kvpairs";
import { registerForMacos } from "@/lib/registration";
import { useSettingsPageStatesStore } from "@/services/store";
import { registerMacos } from "@/services/tools";

// The files (autostart entry, browser manifests, yt-dlp plugins) are copied by the Rust backend.
export function useMacOsRegisterer() {
	const { saveKvPair } = useKvPairs();
	const appVersion = useSettingsPageStatesStore((state) => state.appVersion);

	const registerToMac = () =>
		registerForMacos({
			register: registerMacos,
			saveVersion: () => saveKvPair("macos_registered_version", appVersion),
		});

	return { registerToMac };
}
