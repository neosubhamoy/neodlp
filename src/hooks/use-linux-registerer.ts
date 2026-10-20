import { invoke } from "@tauri-apps/api/core";
import { useKvPairs } from "@/hooks/use-kvpairs";
import { useYtDlpUpdater } from "@/hooks/use-ytdlp-updater";
import { registerForLinux } from "@/lib/registration";
import { useSettingsPageStatesStore } from "@/services/store";
import { registerLinux } from "@/services/tools";

// The files (yt-dlp plugins, and under Flatpak its own yt-dlp copy) are copied by the Rust backend.
export function useLinuxRegisterer() {
	const { saveKvPair } = useKvPairs();
	const { updateYtDlp } = useYtDlpUpdater();
	const appVersion = useSettingsPageStatesStore((state) => state.appVersion);

	const registerToLinux = () =>
		registerForLinux({
			register: registerLinux,
			saveVersion: () => saveKvPair("linux_registered_version", appVersion),
			isFlatpak: () => invoke<boolean>("is_flatpak"),
			updateYtDlp,
		});

	return { registerToLinux };
}
