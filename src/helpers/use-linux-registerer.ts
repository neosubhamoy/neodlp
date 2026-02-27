import { join, resourceDir, homeDir } from "@tauri-apps/api/path";
import * as fs from "@tauri-apps/plugin-fs";
import { useKvPairs } from "@/helpers/use-kvpairs";
import { useSettingsPageStatesStore } from "@/services/store";
import { Command } from "@tauri-apps/plugin-shell";
import { invoke } from "@tauri-apps/api/core";

interface FileMap {
    source: string;
    destination: string;
    dir: string;
    content?: string;
}

export function useLinuxRegisterer() {
    const { saveKvPair } = useKvPairs();
    const appVersion = useSettingsPageStatesStore(state => state.appVersion);

    const registerToLinux = async () => {
        try {
            const isFlatpak = await invoke<boolean>('is_flatpak');
            const resourceDirPath = isFlatpak ? '/app/lib/neodlp' : await resourceDir();
            const homeDirPath = await homeDir();
            const flatpakChromeManifestContent = {
                name: "com.neosubhamoy.neodlp",
                description: "NeoDLP MsgHost",
                path: `${homeDirPath}/.local/bin/neodlp-msghost`,
                type: "stdio",
                allowed_origins: ["chrome-extension://mehopeailfjmiloiiohgicphlcgpompf/"]
            };
            const flatpakFirefoxManifestContent = {
                name: "com.neosubhamoy.neodlp",
                description: "NeoDLP MsgHost",
                path: `${homeDirPath}/.local/bin/neodlp-msghost`,
                type: "stdio",
                allowed_extensions: ["neodlp@neosubhamoy.com"]
            };

            const filesToCopy: FileMap[] = [
                { source: 'yt-dlp-plugins/bgutil-ytdlp-pot-provider/yt_dlp_plugins/extractor/getpot_bgutil.py', destination: 'yt-dlp-plugins/bgutil-ytdlp-pot-provider/yt_dlp_plugins/extractor/getpot_bgutil.py', dir: 'yt-dlp-plugins/bgutil-ytdlp-pot-provider/yt_dlp_plugins/extractor/' },
                { source: 'yt-dlp-plugins/bgutil-ytdlp-pot-provider/yt_dlp_plugins/extractor/getpot_bgutil_cli.py', destination: 'yt-dlp-plugins/bgutil-ytdlp-pot-provider/yt_dlp_plugins/extractor/getpot_bgutil_cli.py', dir: 'yt-dlp-plugins/bgutil-ytdlp-pot-provider/yt_dlp_plugins/extractor/' },
                { source: 'yt-dlp-plugins/bgutil-ytdlp-pot-provider/yt_dlp_plugins/extractor/getpot_bgutil_http.py', destination: 'yt-dlp-plugins/bgutil-ytdlp-pot-provider/yt_dlp_plugins/extractor/getpot_bgutil_http.py', dir: 'yt-dlp-plugins/bgutil-ytdlp-pot-provider/yt_dlp_plugins/extractor/' },
            ];

            const filesToCopyFlatpak: FileMap[] = [
                { source: 'chrome.json', destination: '.config/google-chrome/NativeMessagingHosts/com.neosubhamoy.neodlp.json', dir: '.config/google-chrome/NativeMessagingHosts/', content: JSON.stringify(flatpakChromeManifestContent) },
                { source: 'chrome.json', destination: '.config/chromium/NativeMessagingHosts/com.neosubhamoy.neodlp.json', dir: '.config/chromium/NativeMessagingHosts/', content: JSON.stringify(flatpakChromeManifestContent) },
                { source: 'firefox.json', destination: '.mozilla/native-messaging-hosts/com.neosubhamoy.neodlp.json', dir: '.mozilla/native-messaging-hosts/', content: JSON.stringify(flatpakFirefoxManifestContent) },
                { source: 'neodlp-msghost', destination: '.local/bin/neodlp-msghost', dir: '.local/bin/' },
            ];

            if (isFlatpak) {
                for (const file of filesToCopyFlatpak) {
                    const sourcePath = await join(resourceDirPath, file.source);
                    const destinationPath = await join(homeDirPath, file.destination);
                    const escapedContent = file.content?.replace(/'/g, `'\\''`) || '';
                    const copyCommand = Command.create('sh', ['-c', `cp "${sourcePath}" "${destinationPath}"`]);
                    const writeCommand = Command.create('sh', ['-c', `printf '%s' '${escapedContent}' > "${destinationPath}"`]);

                    if (file.content) {
                        const writeOutput = await writeCommand.execute();
                        if (writeOutput.code === 0) {
                            console.log(`File ${file.destination} created successfully at ${destinationPath}`);
                        } else {
                            console.error(`Failed to create file ${file.destination} at ${destinationPath}:`, writeOutput.stderr);
                            return { success: false, message: 'Failed to register' };
                        }
                    } else {
                        const copyOutput = await copyCommand.execute();
                        if (copyOutput.code === 0) {
                            console.log(`File ${file.source} copied successfully to ${destinationPath}`);
                        } else {
                            console.error(`Failed to copy file ${file.source} to ${destinationPath}:`, copyOutput.stderr);
                            return { success: false, message: 'Failed to register' };
                        }
                    }
                }
            } else {
                for (const file of filesToCopy) {
                    const sourcePath = await join(resourceDirPath, file.source);
                    const destinationDir = await join(homeDirPath, file.dir);
                    const destinationPath = await join(homeDirPath, file.destination);

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
            }
            saveKvPair('linux_registered_version', appVersion);
            return { success: true, message: 'Registered successfully' }
        } catch (error) {
            console.error('Error copying files:', error);
            return { success: false, message: 'Failed to register' }
        }
    }

    return { registerToLinux };
}
