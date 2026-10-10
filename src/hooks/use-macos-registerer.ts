import { join, resourceDir, homeDir } from "@tauri-apps/api/path";
import * as fs from "@tauri-apps/plugin-fs";
import { useKvPairs } from "@/hooks/use-kvpairs";
import { useSettingsPageStatesStore } from "@/services/store";

interface FileMap {
	source: string;
	destination: string;
	dir: string;
}

export function useMacOsRegisterer() {
	const { saveKvPair } = useKvPairs();
	const appVersion = useSettingsPageStatesStore((state) => state.appVersion);

	const registerToMac = async () => {
		try {
			const filesToCopy: FileMap[] = [
				{
					source: "neodlp-autostart.plist",
					destination: "Library/LaunchAgents/com.neosubhamoy.neodlp.plist",
					dir: "Library/LaunchAgents/",
				},
				{
					source: "neodlp-msghost.json",
					destination:
						"Library/Application Support/Google/Chrome/NativeMessagingHosts/com.neosubhamoy.neodlp.json",
					dir: "Library/Application Support/Google/Chrome/NativeMessagingHosts/",
				},
				{
					source: "neodlp-msghost.json",
					destination:
						"Library/Application Support/Chromium/NativeMessagingHosts/com.neosubhamoy.neodlp.json",
					dir: "Library/Application Support/Chromium/NativeMessagingHosts/",
				},
				{
					source: "neodlp-msghost-moz.json",
					destination:
						"Library/Application Support/Mozilla/NativeMessagingHosts/com.neosubhamoy.neodlp.json",
					dir: "Library/Application Support/Mozilla/NativeMessagingHosts/",
				},
				{
					source:
						"yt-dlp-plugins/bgutil-ytdlp-pot-provider/yt_dlp_plugins/extractor/getpot_bgutil.py",
					destination:
						"yt-dlp-plugins/bgutil-ytdlp-pot-provider/yt_dlp_plugins/extractor/getpot_bgutil.py",
					dir: "yt-dlp-plugins/bgutil-ytdlp-pot-provider/yt_dlp_plugins/extractor/",
				},
				{
					source:
						"yt-dlp-plugins/bgutil-ytdlp-pot-provider/yt_dlp_plugins/extractor/getpot_bgutil_cli.py",
					destination:
						"yt-dlp-plugins/bgutil-ytdlp-pot-provider/yt_dlp_plugins/extractor/getpot_bgutil_cli.py",
					dir: "yt-dlp-plugins/bgutil-ytdlp-pot-provider/yt_dlp_plugins/extractor/",
				},
				{
					source:
						"yt-dlp-plugins/bgutil-ytdlp-pot-provider/yt_dlp_plugins/extractor/getpot_bgutil_http.py",
					destination:
						"yt-dlp-plugins/bgutil-ytdlp-pot-provider/yt_dlp_plugins/extractor/getpot_bgutil_http.py",
					dir: "yt-dlp-plugins/bgutil-ytdlp-pot-provider/yt_dlp_plugins/extractor/",
				},
			];

			const resourceDirPath = await resourceDir();
			const homeDirPath = await homeDir();

			for (const file of filesToCopy) {
				const sourcePath = await join(resourceDirPath, file.source);
				const destinationDir = await join(homeDirPath, file.dir);
				const destinationPath = await join(homeDirPath, file.destination);

				const dirExists = await fs.exists(destinationDir);
				if (dirExists) {
					await fs.copyFile(sourcePath, destinationPath);
					console.log(
						`File ${file.source} copied successfully to ${destinationPath}`,
					);
				} else {
					await fs.mkdir(destinationDir, { recursive: true });
					console.log(`Created dir ${destinationDir}`);
					await fs.copyFile(sourcePath, destinationPath);
					console.log(
						`File ${file.source} copied successfully to ${destinationPath}`,
					);
				}
			}
			saveKvPair("macos_registered_version", appVersion);
			return { success: true, message: "Registered successfully" };
		} catch (error) {
			console.error("Error copying files:", error);
			return { success: false, message: "Failed to register" };
		}
	};

	return { registerToMac };
}
