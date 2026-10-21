import { config } from "@/config";
import { check as checkAppUpdate, Update } from "@tauri-apps/plugin-updater";
import { relaunch as relaunchApp } from "@tauri-apps/plugin-process";
import { useSettingsPageStatesStore } from "@/services/store";
import { useLogger } from "@/hooks/use-logger";
import { sendNotification } from "@tauri-apps/plugin-notification";
import usePotServer from "@/hooks/use-pot-server";

export default function useAppUpdater() {
	const setIsCheckingAppUpdate = useSettingsPageStatesStore(
		(state) => state.setIsCheckingAppUpdate,
	);
	const setAppUpdate = useSettingsPageStatesStore(
		(state) => state.setAppUpdate,
	);
	const setIsUpdating = useSettingsPageStatesStore(
		(state) => state.setIsUpdatingApp,
	);
	const setDownloadProgress = useSettingsPageStatesStore(
		(state) => state.setAppUpdateDownloadProgress,
	);
	const enableNotifications = useSettingsPageStatesStore(
		(state) => state.settings.enable_notifications,
	);
	const updateNotification = useSettingsPageStatesStore(
		(state) => state.settings.update_notification,
	);

	const { stopPotServer, syncPotServer } = usePotServer();
	const LOG = useLogger();

	const checkForAppUpdate = async () => {
		setIsCheckingAppUpdate(true);
		try {
			const update = await checkAppUpdate();
			if (update) {
				setAppUpdate(update);
				console.log(`app update available v${update.version}`);
				LOG.info("NEODLP", `App update available v${update.version}`);
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
	};

	const downloadAndInstallAppUpdate = async (update: Update) => {
		setIsUpdating(true);
		// The installer replaces the POT server's binary, so it must not be running. Stopping is a
		// no-op when it isn't, so there is no need to check the (possibly stale) UI state.
		await stopPotServer();
		LOG.info(
			"NEODLP",
			`Downloading and installing app update v${update.version}`,
		);
		let downloaded = 0;
		let contentLength: number | undefined = 0;
		try {
			await update.downloadAndInstall((event) => {
				switch (event.event) {
					case "Started":
						contentLength = event.data.contentLength;
						console.log(
							`started downloading app update of ${event.data.contentLength} bytes`,
						);
						break;
					case "Progress":
						downloaded += event.data.chunkLength;
						const progress = (downloaded / (contentLength || 1)) * 100;
						setDownloadProgress(Math.round(progress * 10) / 10);
						console.log(
							`downloaded ${downloaded} bytes from ${contentLength} bytes of app update`,
						);
						break;
					case "Finished":
						console.log("app update download finished");
						setIsUpdating(false);
						break;
				}
			});
		} catch (error) {
			// The app keeps running, so let the backend bring the POT server back if it is enabled.
			await syncPotServer();
			throw error;
		}
		await relaunchApp();
	};

	return { checkForAppUpdate, downloadAndInstallAppUpdate };
}
