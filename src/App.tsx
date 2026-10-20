// import * as fs from "@tauri-apps/plugin-fs";
import { ThemeProvider } from "@/lib/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppContext } from "@/lib/app-context-provider";
import { useEffect, useRef, useState } from "react";
import { arch, exeExtension } from "@tauri-apps/plugin-os";
import { downloadDir, join, resourceDir, tempDir } from "@tauri-apps/api/path";
import {
	useBasePathsStore,
	useCurrentVideoMetadataStore,
	useDownloadStatesStore,
	useEnvironmentStore,
	useKvPairsStatesStore,
	useSettingsPageStatesStore,
} from "@/services/store";
import { isObjEmpty } from "@/lib/utils";
import {
	useFetchAllDownloadStates,
	useFetchAllkVPairs,
	useFetchAllSettings,
} from "@/services/queries";
import { config } from "@/config";
import { useYtDlpUpdater } from "@/hooks/use-ytdlp-updater";
import { getVersion } from "@tauri-apps/api/app";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { listen } from "@tauri-apps/api/event";
import { WebSocketMessage } from "@/types/index";
import { useNavigate } from "@tanstack/react-router";
import { platform } from "@tauri-apps/plugin-os";
import { useMacOsRegisterer } from "@/hooks/use-macos-registerer";
import useAppUpdater from "@/hooks/use-app-updater";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { useLogger } from "@/hooks/use-logger";
import { useDownloadEvents } from "@/hooks/use-download-events";
import {
	cancelDownload,
	fetchVideoMetadata,
	pauseDownload,
	resumeDownload,
	setDownloadPaths,
	shutdownDownloads,
	startDownload,
} from "@/services/downloads";
import { usePotEvents } from "@/hooks/use-pot-events";
import { getYtDlpVersion } from "@/services/tools";
import { useLinuxRegisterer } from "@/hooks/use-linux-registerer";
import { invoke } from "@tauri-apps/api/core";

// Download work happens in the Rust backend; these are plain commands, so the object is stable.
const downloader = {
	fetchVideoMetadata,
	startDownload,
	pauseDownload,
	resumeDownload,
	cancelDownload,
};

export default function App({ children }: { children: React.ReactNode }) {
	const { data: downloadStates, isSuccess: isSuccessFetchingDownloadStates } =
		useFetchAllDownloadStates();
	const { data: settings, isSuccess: isSuccessFetchingSettings } =
		useFetchAllSettings();
	const { data: kvPairs, isSuccess: isSuccessFetchingKvPairs } =
		useFetchAllkVPairs();
	const [isSettingsStatePropagated, setIsSettingsStatePropagated] =
		useState(false);
	const [isKvPairsStatePropagated, setIsKvPairsStatePropagated] =
		useState(false);
	const setDownloadStates = useDownloadStatesStore(
		(state) => state.setDownloadStates,
	);
	const setPath = useBasePathsStore((state) => state.setPath);
	const tempDownloadDirPath = useBasePathsStore(
		(state) => state.tempDownloadDirPath,
	);
	const downloadDirPath = useBasePathsStore((state) => state.downloadDirPath);

	const setIsFlatpak = useEnvironmentStore((state) => state.setIsFlatpak);
	const setIsAppimage = useEnvironmentStore((state) => state.setIsAppimage);
	const setAppDirPath = useEnvironmentStore((state) => state.setAppDirPath);

	const setIsUsingDefaultSettings = useSettingsPageStatesStore(
		(state) => state.setIsUsingDefaultSettings,
	);
	const setSettingsKey = useSettingsPageStatesStore(
		(state) => state.setSettingsKey,
	);
	const appVersion = useSettingsPageStatesStore((state) => state.appVersion);
	const ytDlpVersion = useSettingsPageStatesStore(
		(state) => state.ytDlpVersion,
	);
	const setYtDlpVersion = useSettingsPageStatesStore(
		(state) => state.setYtDlpVersion,
	);
	const setIsFetchingYtDlpVersion = useSettingsPageStatesStore(
		(state) => state.setIsFetchingYtDlpVersion,
	);
	const setAppVersion = useSettingsPageStatesStore(
		(state) => state.setAppVersion,
	);
	const setIsFetchingAppVersion = useSettingsPageStatesStore(
		(state) => state.setIsFetchingAppVersion,
	);
	const {
		ytdlp_auto_update: YTDLP_AUTO_UPDATE,
		ytdlp_update_channel: YTDLP_UPDATE_CHANNEL,
		download_dir: DOWNLOAD_DIR,
		theme: APP_THEME,
		color_scheme: APP_COLOR_SCHEME,
		quit_on_close: QUIT_ON_CLOSE,
	} = useSettingsPageStatesStore((state) => state.settings);

	const appWindow = getCurrentWebviewWindow();
	const navigate = useNavigate();
	const LOG = useLogger();
	const currentPlatform = platform();
	const { updateYtDlp } = useYtDlpUpdater();
	const { registerToMac } = useMacOsRegisterer();
	const { registerToLinux } = useLinuxRegisterer();
	const { checkForAppUpdate } = useAppUpdater();
	usePotEvents();
	const setKvPairsKey = useKvPairsStatesStore((state) => state.setKvPairsKey);
	const ytDlpUpdateLastCheck = useKvPairsStatesStore(
		(state) => state.kvPairs.ytdlp_update_last_check,
	);
	const macOsRegisteredVersion = useKvPairsStatesStore(
		(state) => state.kvPairs.macos_registered_version,
	);
	const linuxRegisteredVersion = useKvPairsStatesStore(
		(state) => state.kvPairs.linux_registered_version,
	);

	useDownloadEvents();

	const hasRunYtDlpAutoUpdateRef = useRef(false);
	const hasRunAppUpdateCheckRef = useRef(false);
	const isRegisteredToMacOsRef = useRef(false);
	const isRegisteredToLinuxRef = useRef(false);

	// Prevent right click context menu in production
	if (!import.meta.env.DEV) {
		document.oncontextmenu = (event) => {
			event.preventDefault();
		};
	}

	// Prevent app from closing
	useEffect(() => {
		const handleCloseRequested = async (event: any) => {
			event.preventDefault();
			if (QUIT_ON_CLOSE) {
				try {
					await shutdownDownloads();
				} catch (e) {
					console.error("Failed to stop downloads before quitting:", e);
				}
				await appWindow.destroy();
			} else {
				await appWindow.hide();
			}
		};

		appWindow.onCloseRequested(handleCloseRequested);
	}, []);

	// Detect sandbox environments
	useEffect(() => {
		const detectEnvironment = async () => {
			try {
				const isFlatpak = await invoke<boolean>("is_flatpak");
				const appimagePath = await invoke<string | null>("get_appimage_path");
				console.log("Environment detection results:", {
					isFlatpak,
					appimagePath,
				});

				if (isFlatpak) setIsFlatpak(true);
				if (appimagePath) {
					setIsAppimage(true);
					setAppDirPath(appimagePath);
				}
			} catch (e) {
				console.error("Failed to detect environment:", e);
			}
		};
		detectEnvironment();
	}, [setIsFlatpak, setIsAppimage, setAppDirPath]);

	// Listen for websocket messages
	useEffect(() => {
		const unlisten = listen<WebSocketMessage>("websocket-message", (event) => {
			if (event.payload.command === "download") {
				const handleDownload = async () => {
					appWindow.show();
					appWindow.setFocus();
					navigate({ to: "/" });
					if (event.payload.url) {
						LOG.info(
							"NEODLP",
							`Received search request from neodlp browser extension for URL: ${event.payload.url}`,
						);
						const { setRequestedUrl, setAutoSubmitSearch } =
							useCurrentVideoMetadataStore.getState();
						setRequestedUrl(event.payload.url);
						setAutoSubmitSearch(true);
					}
				};
				handleDownload().catch((error) => {
					console.error("Error handling download:", error);
				});
			}
		});

		return () => {
			unlisten.then((f) => f());
		};
	}, []);

	// Fetch download states from database and sync with state
	useEffect(() => {
		if (isSuccessFetchingSettings && settings) {
			console.log("Settings fetched successfully:", settings);
			if (!isObjEmpty(settings)) {
				setIsUsingDefaultSettings(false);
				Object.keys(settings).forEach((key) => {
					setSettingsKey(key, settings[key]);
				});
			} else {
				setIsUsingDefaultSettings(true);
			}
			setIsSettingsStatePropagated(true);
		}
	}, [settings, isSuccessFetchingSettings]);

	// Fetch KV pairs from database and sync with state
	useEffect(() => {
		if (isSuccessFetchingKvPairs && kvPairs) {
			console.log("KvPairs fetched successfully:", kvPairs);
			if (!isObjEmpty(kvPairs)) {
				Object.keys(kvPairs).forEach((key) => {
					setKvPairsKey(key, kvPairs[key]);
				});
			}
			setIsKvPairsStatePropagated(true);
		}
	}, [kvPairs, isSuccessFetchingKvPairs]);

	// Initiate/Resolve base app paths
	useEffect(() => {
		const initPaths = async () => {
			try {
				const currentArch = arch();
				const currentExeExtension = exeExtension();
				const isFlatpak = await invoke<boolean>("is_flatpak");
				const downloadDirPath = await downloadDir();
				const tempDirPath = await tempDir();
				const resourceDirPath = await resourceDir();

				const ffmpegPath = await join(
					resourceDirPath,
					"binaries",
					`ffmpeg-${currentArch}${currentExeExtension ? "." + currentExeExtension : ""}`,
				);
				const tempDownloadDirPath = isFlatpak
					? await join(downloadDirPath, config.appName, ".tempdownloads")
					: await join(tempDirPath, config.appPkgName, "downloads");
				const appDownloadDirPath = await join(downloadDirPath, config.appName);

				// !! Temp download dir won't be present initially, it will be autometically created by yt-dlp on the first download
				// if (!await fs.exists(tempDownloadDirPath)) fs.mkdir(tempDownloadDirPath, { recursive: true }).then(() => { console.log(`Created DIR: ${tempDownloadDirPath}`) });

				setPath("ffmpegPath", ffmpegPath);
				setPath("tempDownloadDirPath", tempDownloadDirPath);
				if (DOWNLOAD_DIR) {
					setPath("downloadDirPath", DOWNLOAD_DIR);
				} else {
					// if(!await fs.exists(appDownloadDirPath)) fs.mkdir(appDownloadDirPath, { recursive: true }).then(() => { console.log(`Created DIR: ${appDownloadDirPath}`) });
					setPath("downloadDirPath", appDownloadDirPath);
				}
				console.log("Paths initialized:", {
					ffmpegPath,
					tempDownloadDirPath,
					downloadDirPath: DOWNLOAD_DIR || appDownloadDirPath,
				});
			} catch (e) {
				console.error("Failed to fetch paths:", e);
			}
		};
		initPaths();
	}, [DOWNLOAD_DIR, setPath]);

	// Tell the downloader where files go. It won't start (or resume) anything before this.
	useEffect(() => {
		if (tempDownloadDirPath && downloadDirPath) {
			setDownloadPaths(tempDownloadDirPath, downloadDirPath).catch((e) =>
				console.error("Failed to set download paths:", e),
			);
		}
	}, [tempDownloadDirPath, downloadDirPath]);

	// Fetch app version
	useEffect(() => {
		const fetchAppVersion = async () => {
			setIsFetchingAppVersion(true);
			try {
				const version = await getVersion();
				console.log("App version fetched successfully:", version);
				setAppVersion(version);
			} catch (e) {
				console.error("Failed to fetch app version:", e);
			} finally {
				setIsFetchingAppVersion(false);
			}
		};
		fetchAppVersion();
	}, []);

	// Fetch yt-dlp version
	useEffect(() => {
		const fetchYtDlpVersion = async () => {
			setIsFetchingYtDlpVersion(true);
			try {
				const version = await getYtDlpVersion();
				console.log("yt-dlp version fetched successfully:", version);
				setYtDlpVersion(version);
			} catch (e) {
				console.error("Failed to fetch yt-dlp version:", e);
			} finally {
				setIsFetchingYtDlpVersion(false);
			}
		};
		fetchYtDlpVersion();
	}, [ytDlpVersion, setYtDlpVersion]);

	// Check for app update
	useEffect(() => {
		const handleAppUpdateCheck = async () => {
			// Only run once when both settings and KV pairs are loaded
			if (!isSettingsStatePropagated || !isKvPairsStatePropagated) {
				console.log(
					"Skipping app update check, waiting for configs to load...",
				);
				return;
			}
			// Skip if we've already run the update check once
			if (hasRunAppUpdateCheckRef.current) {
				console.log(
					"App update check already performed in this session, skipping",
				);
				return;
			}
			const isFlatpak = await invoke<boolean>("is_flatpak");
			// Skip self-update check on Flatpak, as updates should be handled by Flatpak cli itself
			if (isFlatpak) {
				console.log("Flatpak detected! Skipping app update check");
				return;
			}

			hasRunAppUpdateCheckRef.current = true;
			try {
				await checkForAppUpdate();
			} catch (e) {
				console.error("Error checking for app update:", e);
			}
		};
		handleAppUpdateCheck();
	}, [isSettingsStatePropagated, isKvPairsStatePropagated]);

	// Check for yt-dlp auto-update
	useEffect(() => {
		const handleYtDlpAutoUpdate = async () => {
			// Only run once when both settings and KV pairs are loaded
			if (!isSettingsStatePropagated || !isKvPairsStatePropagated) {
				console.log(
					"Skipping yt-dlp auto-update check, waiting for configs to load...",
				);
				return;
			}
			// Skip if we've already run the auto-update once
			if (hasRunYtDlpAutoUpdateRef.current) {
				console.log(
					"Auto-update check already performed in this session, skipping",
				);
				return;
			}
			const isFlatpak = await invoke<boolean>("is_flatpak");
			if (
				isFlatpak &&
				(!linuxRegisteredVersion || linuxRegisteredVersion !== appVersion)
			) {
				console.log(
					"Flatpak registration not completed yet! Skipping yt-dlp auto-update...",
				);
				return;
			}
			// if (isFlatpak) {
			//     console.log("Flatpak detected! Skipping yt-dlp auto-update");
			//     return;
			// }
			hasRunYtDlpAutoUpdateRef.current = true;
			console.log("Checking yt-dlp auto-update with loaded config values:", {
				autoUpdate: YTDLP_AUTO_UPDATE,
				updateChannel: YTDLP_UPDATE_CHANNEL,
				lastCheck: ytDlpUpdateLastCheck,
			});
			const currentTimestamp = Date.now();
			const YTDLP_UPDATE_INTERVAL = 86400000; // 24H;
			if (
				YTDLP_AUTO_UPDATE &&
				(ytDlpUpdateLastCheck === null ||
					currentTimestamp - ytDlpUpdateLastCheck > YTDLP_UPDATE_INTERVAL)
			) {
				console.log("Running auto-update for yt-dlp...");
				updateYtDlp();
			} else {
				console.log(
					"Skipping yt-dlp auto-update, either disabled or recently updated.",
				);
			}
		};
		handleYtDlpAutoUpdate();
	}, [isSettingsStatePropagated, isKvPairsStatePropagated]);

	// Check for MacOS auto-registration
	useEffect(() => {
		// Only run once when both settings and KV pairs are loaded
		if (!isSettingsStatePropagated || !isKvPairsStatePropagated) {
			console.log(
				"Skipping MacOS auto registration, waiting for configs to load...",
			);
			return;
		}
		// Skip if we've already run the macos auto-registration once
		if (isRegisteredToMacOsRef.current) {
			console.log(
				"MacOS auto registration check already performed in this session, skipping",
			);
			return;
		}
		isRegisteredToMacOsRef.current = true;
		console.log("Checking MacOS auto registration with loaded config values:", {
			appVersion: appVersion,
			registeredVersion: macOsRegisteredVersion,
		});
		if (
			currentPlatform === "macos" &&
			(!macOsRegisteredVersion || macOsRegisteredVersion !== appVersion)
		) {
			console.log("Running MacOS auto registration...");
			LOG.info("NEODLP", "Running macOS registration");
			registerToMac()
				.then((result: { success: boolean; message: string }) => {
					if (result.success) {
						console.log("MacOS registration successful:", result.message);
						LOG.info("NEODLP", "macOS registration successful");
					} else {
						console.error("MacOS registration failed:", result.message);
						LOG.error("NEODLP", `macOS registration failed: ${result.message}`);
					}
				})
				.catch((error) => {
					console.error("Error during macOS registration:", error);
					LOG.error("NEODLP", `Error during macOS registration: ${error}`);
				});
		}
	}, [isSettingsStatePropagated, isKvPairsStatePropagated]);

	// Check for Linux auto-registration
	useEffect(() => {
		// Only run once when both settings and KV pairs are loaded
		if (!isSettingsStatePropagated || !isKvPairsStatePropagated) {
			console.log(
				"Skipping Linux auto registration, waiting for configs to load...",
			);
			return;
		}
		// Skip if we've already run the linux auto-registration once
		if (isRegisteredToLinuxRef.current) {
			console.log(
				"Linux auto registration check already performed in this session, skipping",
			);
			return;
		}
		isRegisteredToLinuxRef.current = true;
		console.log("Checking Linux auto registration with loaded config values:", {
			appVersion: appVersion,
			registeredVersion: linuxRegisteredVersion,
		});
		if (
			currentPlatform === "linux" &&
			(!linuxRegisteredVersion || linuxRegisteredVersion !== appVersion)
		) {
			console.log("Running Linux auto registration...");
			LOG.info("NEODLP", "Running Linux registration");
			registerToLinux()
				.then((result: { success: boolean; message: string }) => {
					if (result.success) {
						console.log("Linux registration successful:", result.message);
						LOG.info("NEODLP", "Linux registration successful");
					} else {
						console.error("Linux registration failed:", result.message);
						LOG.error("NEODLP", `Linux registration failed: ${result.message}`);
					}
				})
				.catch((error) => {
					console.error("Error during Linux registration:", error);
					LOG.error("NEODLP", `Error during Linux registration: ${error}`);
				});
		}
	}, [isSettingsStatePropagated, isKvPairsStatePropagated]);

	useEffect(() => {
		if (isSuccessFetchingDownloadStates && downloadStates) {
			// console.log("Download States fetched successfully:", downloadStates);
			setDownloadStates(downloadStates);
		}
	}, [downloadStates, isSuccessFetchingDownloadStates, setDownloadStates]);

	return (
		<AppContext.Provider value={downloader}>
			<ThemeProvider
				defaultTheme={APP_THEME || "system"}
				defaultColorScheme={APP_COLOR_SCHEME || "default"}
			>
				<TooltipProvider delay={1000}>
					{children}
					<Sonner closeButton />
				</TooltipProvider>
			</ThemeProvider>
		</AppContext.Provider>
	);
}
