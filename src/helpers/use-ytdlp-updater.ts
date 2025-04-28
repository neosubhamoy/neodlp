import { useSettingsPageStatesStore } from "@/services/store";
import { useKvPairs } from "@/helpers/use-kvpairs";
import { Command } from "@tauri-apps/plugin-shell";
import { platform } from "@tauri-apps/plugin-os";

export function useYtDlpUpdater() {
    const { saveKvPair } = useKvPairs();
    const ytDlpUpdateChannel = useSettingsPageStatesStore(state => state.settings.ytdlp_update_channel);
    const setIsUpdatingYtDlp = useSettingsPageStatesStore((state) => state.setIsUpdatingYtDlp);
    const setYtDlpVersion = useSettingsPageStatesStore((state) => state.setYtDlpVersion);
    const currentPlatform = platform();

    const updateYtDlp = async () => {
        const CURRENT_TIMESTAMP = Date.now();
        setIsUpdatingYtDlp(true);
        try {
            const command = currentPlatform === 'linux' ? Command.create('pkexec', ['yt-dlp', '--update-to', ytDlpUpdateChannel]) : Command.sidecar('binaries/yt-dlp', ['--update-to', ytDlpUpdateChannel]);
            const output = await command.execute();
            if (output.code === 0) {
                console.log("yt-dlp updated successfully:", output.stdout);
                saveKvPair('ytdlp_update_last_check', CURRENT_TIMESTAMP);
                setYtDlpVersion(null);
            } else {
                console.error("Failed to update yt-dlp:", output.stderr);
            }
        } catch (e) {
            console.error('Failed to update yt-dlp:', e);
        } finally {
            setIsUpdatingYtDlp(false);
        }
    }

    return { updateYtDlp };
}