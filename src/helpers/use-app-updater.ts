import { config } from "@/config";
import { check as checkAppUpdate, Update } from "@tauri-apps/plugin-updater";
import { relaunch as relaunchApp } from "@tauri-apps/plugin-process";
import { useSettingsPageStatesStore } from "@/services/store";
import { useLogger } from "@/helpers/use-logger";
import { sendNotification } from '@tauri-apps/plugin-notification';

export default function useAppUpdater() {
    const setIsCheckingAppUpdate = useSettingsPageStatesStore(state => state.setIsCheckingAppUpdate);
    const setAppUpdate = useSettingsPageStatesStore(state => state.setAppUpdate);
    const setIsUpdating = useSettingsPageStatesStore(state => state.setIsUpdatingApp);
    const setDownloadProgress = useSettingsPageStatesStore(state => state.setAppUpdateDownloadProgress);
    const enableNotifications = useSettingsPageStatesStore(state => state.settings.enable_notifications);
    const updateNotification = useSettingsPageStatesStore(state => state.settings.update_notification);
    const LOG = useLogger();

    const checkForAppUpdate = async () => {
        setIsCheckingAppUpdate(true);
        try {
            const update = await checkAppUpdate();
            if (update) {
                setAppUpdate(update);
                console.log(`app update available v${update.version}`);
                LOG.info('NEODLP', `App update available v${update.version}`);
                if (enableNotifications && updateNotification) {
                    sendNotification({
                        title: `Update Available (v${update.version})`,
                        body: `A newer version of ${config.appName} is available. Please update to the latest version for the best experience`,
                    });
                }
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsCheckingAppUpdate(false);
        }
    }

    const downloadAndInstallAppUpdate = async (update: Update) => {
        setIsUpdating(true);
        LOG.info('NEODLP', `Downloading and installing app update v${update.version}`);
        let downloaded = 0;
        let contentLength: number | undefined = 0;
        await update.downloadAndInstall((event) => {
            switch (event.event) {
            case 'Started':
                contentLength = event.data.contentLength;
                console.log(`started downloading app update of ${event.data.contentLength} bytes`);
                break;
            case 'Progress':
                downloaded += event.data.chunkLength;
                const progress = (downloaded / (contentLength || 1)) * 100;
                setDownloadProgress(Math.round(progress * 10) / 10);
                console.log(`downloaded ${downloaded} bytes from ${contentLength} bytes of app update`);
                break;
            case 'Finished':
                console.log('app update download finished');
                setIsUpdating(false);
                break;
            }
        });
        await relaunchApp();
    }

    return {
        checkForAppUpdate,
        downloadAndInstallAppUpdate
    }
}
