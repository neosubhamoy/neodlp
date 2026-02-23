import { join, resourceDir, homeDir, configDir } from "@tauri-apps/api/path";
import * as fs from "@tauri-apps/plugin-fs";
import { useKvPairs } from "@/helpers/use-kvpairs";
import { useSettingsPageStatesStore } from "@/services/store";
import { invoke } from "@tauri-apps/api/core";
import { useLogger } from "@/helpers/use-logger";

interface FileMap {
    source: string;
    destination: string;
    dir: string;
}

export function useLinuxRegisterer() {
    const { saveKvPair } = useKvPairs();
    const LOG = useLogger();
    const appVersion = useSettingsPageStatesStore(state => state.appVersion);

    const registerToLinux = async () => {
        try {
            const filesToCopy: FileMap[] = [
                { source: 'yt-dlp-plugins/bgutil-ytdlp-pot-provider/yt_dlp_plugins/extractor/getpot_bgutil.py', destination: 'yt-dlp-plugins/bgutil-ytdlp-pot-provider/yt_dlp_plugins/extractor/getpot_bgutil.py', dir: 'yt-dlp-plugins/bgutil-ytdlp-pot-provider/yt_dlp_plugins/extractor/' },
                { source: 'yt-dlp-plugins/bgutil-ytdlp-pot-provider/yt_dlp_plugins/extractor/getpot_bgutil_cli.py', destination: 'yt-dlp-plugins/bgutil-ytdlp-pot-provider/yt_dlp_plugins/extractor/getpot_bgutil_cli.py', dir: 'yt-dlp-plugins/bgutil-ytdlp-pot-provider/yt_dlp_plugins/extractor/' },
                { source: 'yt-dlp-plugins/bgutil-ytdlp-pot-provider/yt_dlp_plugins/extractor/getpot_bgutil_http.py', destination: 'yt-dlp-plugins/bgutil-ytdlp-pot-provider/yt_dlp_plugins/extractor/getpot_bgutil_http.py', dir: 'yt-dlp-plugins/bgutil-ytdlp-pot-provider/yt_dlp_plugins/extractor/' },
            ];

            const isFlatpak = await invoke<boolean>('is_flatpak');
            const resourceDirPath = isFlatpak ? '/app/lib/neodlp' : await resourceDir();
            const homeDirPath = await homeDir();
            const configDirPath = await configDir();

            LOG.info("LINUX REGISTERER", `Starting registration process. isFlatpak: ${isFlatpak}, resourceDirPath: ${resourceDirPath}, homeDirPath: ${homeDirPath}, configDirPath: ${configDirPath}`);

            for (const file of filesToCopy) {
                const sourcePath = await join(resourceDirPath, file.source);
                const destinationDir = isFlatpak ? await join(configDirPath, file.dir) : await join(homeDirPath, file.dir);
                const destinationPath = isFlatpak ? await join(configDirPath, file.destination) : await join(homeDirPath, file.destination);

                const dirExists = await fs.exists(destinationDir);
                if (dirExists) {
                    await fs.copyFile(sourcePath, destinationPath);
                    console.log(`File ${file.source} copied successfully to ${destinationPath}`);
                } else {
                    await fs.mkdir(destinationDir, { recursive: true })
                    console.log(`Created dir ${destinationDir}`);
                    await fs.copyFile(sourcePath, destinationPath);
                    console.log(`File ${file.source} copied successfully to ${destinationPath}`);
                }
            }
            saveKvPair('linux_registered_version', appVersion);
            return { success: true, message: 'Registered successfully' }
        } catch (error) {
            console.error('Error copying files:', error);
            LOG.error("LINUX REGISTERER", `Error during registration: ${error}`);
            return { success: false, message: 'Failed to register' }
        }
    }

    return { registerToLinux };
}
