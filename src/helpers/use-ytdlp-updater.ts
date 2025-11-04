import { useSettingsPageStatesStore } from "@/services/store";
import { useKvPairs } from "@/helpers/use-kvpairs";
import { Command } from "@tauri-apps/plugin-shell";
import { invoke } from "@tauri-apps/api/core";
import { join } from "@tauri-apps/api/path";
import { platform } from "@tauri-apps/plugin-os";
import { useLogger } from "@/helpers/use-logger";
import { toast } from "sonner";

export function useYtDlpUpdater() {
    const { saveKvPair } = useKvPairs();
    const ytDlpUpdateChannel = useSettingsPageStatesStore(state => state.settings.ytdlp_update_channel);
    const setIsUpdatingYtDlp = useSettingsPageStatesStore((state) => state.setIsUpdatingYtDlp);
    const setYtDlpVersion = useSettingsPageStatesStore((state) => state.setYtDlpVersion);
    const currentPlatform = platform();
    const LOG = useLogger();

    const updateYtDlp = async () => {
        const CURRENT_TIMESTAMP = Date.now();
        setIsUpdatingYtDlp(true);
        LOG.info('NEODLP', 'Updating yt-dlp to latest version');
        try {
            const command = currentPlatform === 'linux' ? Command.create('pkexec', ['yt-dlp', '--update-to', ytDlpUpdateChannel]) : Command.sidecar('binaries/yt-dlp', ['--update-to', ytDlpUpdateChannel]);
            const output = await command.execute();
            if (output.code === 0) {
                console.log("yt-dlp updated successfully:", output.stdout);
                LOG.info('NEODLP', "yt-dlp updated successfully");
                saveKvPair('ytdlp_update_last_check', CURRENT_TIMESTAMP);
                setYtDlpVersion(null);
                toast.success("Update successful", { description: "yt-dlp has been updated successfully." });
            } else {
                if (currentPlatform === 'windows') {
                    LOG.warning('NEODLP', "yt-dlp update failed! Now, attempting with elevated privileges.");
                    const appPath = await invoke<string>('get_current_app_path');
                    const ytdlpPath = await join(appPath, 'yt-dlp.exe');
                    const elevateCommand = Command.create('powershell', ['Start-Process', `"${ytdlpPath}"`, '-ArgumentList', `"--update-to ${ytDlpUpdateChannel}"`, '-Verb', 'RunAs', '-Wait', '-WindowStyle', 'Hidden']);
                    const elevateOutput = await elevateCommand.execute();
                    if (elevateOutput.code === 0) {
                        console.log("yt-dlp updated successfully with elevation:", elevateOutput.stdout);
                        LOG.info('NEODLP', "yt-dlp updated successfully with elevation");
                        saveKvPair('ytdlp_update_last_check', CURRENT_TIMESTAMP);
                        setYtDlpVersion(null);
                        toast.success("Update successful", { description: "yt-dlp has been updated successfully." });
                    } else {
                        console.error("Failed to update yt-dlp with elevation:", elevateOutput.stderr);
                        LOG.error('NEODLP', `Failed to update yt-dlp with elevation: ${elevateOutput.stderr}`);
                        toast.error("Update failed", { description: "Failed to update yt-dlp." });
                    }
                    return;
                }
                console.error("Failed to update yt-dlp:", output.stderr);
                LOG.error('NEODLP', `Failed to update yt-dlp: ${output.stderr}`);
                toast.error("Update failed", { description: "Failed to update yt-dlp." });
            }
        } catch (e) {
            console.error('Failed to update yt-dlp:', e);
            LOG.error('NEODLP', `Exception while updating yt-dlp: ${e}`);
            toast.error("Update failed", { description: "An error occurred while updating yt-dlp." });
        } finally {
            setIsUpdatingYtDlp(false);
        }
    }

    return { updateYtDlp };
}
