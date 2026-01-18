import { ThemeProvider } from "@/providers/themeProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppContext } from "@/providers/appContextProvider";
import { useEffect, useRef, useState } from "react";
import { arch, exeExtension } from "@tauri-apps/plugin-os";
import { downloadDir, join, resourceDir, tempDir } from "@tauri-apps/api/path";
import { useBasePathsStore, useCurrentVideoMetadataStore, useDownloaderPageStatesStore, useDownloadStatesStore, useKvPairsStatesStore, useSettingsPageStatesStore } from "@/services/store";
import { isObjEmpty} from "@/utils";
import { Command } from "@tauri-apps/plugin-shell";
import { useUpdateDownloadStatus } from "@/services/mutations";
import { useQueryClient } from "@tanstack/react-query";
import { useFetchAllDownloadStates, useFetchAllkVPairs, useFetchAllSettings } from "@/services/queries";
import { config } from "@/config";
import * as fs from "@tauri-apps/plugin-fs";
import { useYtDlpUpdater } from "@/helpers/use-ytdlp-updater";
import { getVersion } from "@tauri-apps/api/app";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { listen } from "@tauri-apps/api/event";
import { WebSocketMessage } from "@/types/websocket";
import { useNavigate } from "react-router-dom";
import { platform } from "@tauri-apps/plugin-os";
import { useMacOsRegisterer } from "@/helpers/use-macos-registerer";
import useAppUpdater from "@/helpers/use-app-updater";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { toast } from "sonner";
import { useLogger } from "@/helpers/use-logger";
import useDownloader from "@/helpers/use-downloader";

export default function App({ children }: { children: React.ReactNode }) {
    const { data: downloadStates, isSuccess: isSuccessFetchingDownloadStates } = useFetchAllDownloadStates();
    const { data: settings, isSuccess: isSuccessFetchingSettings } = useFetchAllSettings();
    const { data: kvPairs, isSuccess: isSuccessFetchingKvPairs } = useFetchAllkVPairs();
    const [isSettingsStatePropagated, setIsSettingsStatePropagated] = useState(false);
    const [isKvPairsStatePropagated, setIsKvPairsStatePropagated] = useState(false);
    const globalDownloadStates = useDownloadStatesStore((state) => state.downloadStates);
    const setDownloadStates = useDownloadStatesStore((state) => state.setDownloadStates);
    const setPath = useBasePathsStore((state) => state.setPath);

    const setIsUsingDefaultSettings = useSettingsPageStatesStore((state) => state.setIsUsingDefaultSettings);
    const setSettingsKey = useSettingsPageStatesStore((state) => state.setSettingsKey);
    const appVersion = useSettingsPageStatesStore(state => state.appVersion);
    const ytDlpVersion = useSettingsPageStatesStore(state => state.ytDlpVersion);
    const setYtDlpVersion = useSettingsPageStatesStore((state) => state.setYtDlpVersion);
    const setIsFetchingYtDlpVersion = useSettingsPageStatesStore((state) => state.setIsFetchingYtDlpVersion);
    const setAppVersion = useSettingsPageStatesStore((state) => state.setAppVersion);
    const setIsFetchingAppVersion = useSettingsPageStatesStore((state) => state.setIsFetchingAppVersion);
    const {
        ytdlp_auto_update: YTDLP_AUTO_UPDATE,
        ytdlp_update_channel: YTDLP_UPDATE_CHANNEL,
        download_dir: DOWNLOAD_DIR,
        theme: APP_THEME,
        color_scheme: APP_COLOR_SCHEME,
    } = useSettingsPageStatesStore(state => state.settings);

    const erroredDownloadIds = useDownloaderPageStatesStore((state) => state.erroredDownloadIds);
    const expectedErrorDownloadIds = useDownloaderPageStatesStore((state) => state.expectedErrorDownloadIds);
    const removeErroredDownload = useDownloaderPageStatesStore((state) => state.removeErroredDownload);
    const removeExpectedErrorDownload = useDownloaderPageStatesStore((state) => state.removeExpectedErrorDownload);

    const appWindow = getCurrentWebviewWindow();
    const navigate = useNavigate();
    const LOG = useLogger();
    const currentPlatform = platform();
    const { updateYtDlp } = useYtDlpUpdater();
    const { registerToMac } = useMacOsRegisterer();
    const { checkForAppUpdate } = useAppUpdater();
    const setKvPairsKey = useKvPairsStatesStore((state) => state.setKvPairsKey);
    const ytDlpUpdateLastCheck = useKvPairsStatesStore(state => state.kvPairs.ytdlp_update_last_check);
    const macOsRegisteredVersion = useKvPairsStatesStore(state => state.kvPairs.macos_registered_version);

    const queryClient = useQueryClient();
    const downloadStatusUpdater = useUpdateDownloadStatus();

    const ongoingDownloads = globalDownloadStates.filter(state => state.download_status === 'downloading' || state.download_status === 'starting');
    const queuedDownloads = globalDownloadStates.filter(state => state.download_status === 'queued').sort((a, b) => a.queue_index! - b.queue_index!);

    const hasRunYtDlpAutoUpdateRef = useRef(false);
    const hasRunAppUpdateCheckRef = useRef(false);
    const isRegisteredToMacOsRef = useRef(false);
    const pendingErrorUpdatesRef = useRef<Set<string>>(new Set());

    const { fetchVideoMetadata, startDownload, pauseDownload, resumeDownload, cancelDownload, processQueuedDownloads } = useDownloader();

    // Prevent right click context menu in production
    if (!import.meta.env.DEV) {
        document.oncontextmenu = (event) => {
            event.preventDefault()
        }
    }

    // Prevent app from closing
    useEffect(() => {
        const handleCloseRequested = (event: any) => {
            event.preventDefault();
            appWindow.hide();
        };

        appWindow.onCloseRequested(handleCloseRequested);
    }, []);

    // Listen for websocket messages
    useEffect(() => {
        const unlisten = listen<WebSocketMessage>('websocket-message', (event) => {
        if(event.payload.command === 'download') {
            const handleDownload = async () => {
                appWindow.show();
                appWindow.setFocus();
                navigate('/');
                if (event.payload.url) {
                    LOG.info('NEODLP', `Received search request from neodlp browser extension for URL: ${event.payload.url}`);
                    const { setRequestedUrl, setAutoSubmitSearch } = useCurrentVideoMetadataStore.getState();
                    setRequestedUrl(event.payload.url);
                    setAutoSubmitSearch(true);
                }
            }
            handleDownload().catch((error) => {
                console.error("Error handling download:", error);
            });
        }
        });

        return () => {
            unlisten.then(f => f());
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
            }
            else {
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
                const downloadDirPath = await downloadDir();
                const tempDirPath = await tempDir();
                const resourceDirPath = await resourceDir();

                const ffmpegPath = await join(resourceDirPath, 'binaries', `ffmpeg-${currentArch}${currentExeExtension ? '.' + currentExeExtension : ''}`);
                const tempDownloadDirPath = await join(tempDirPath, config.appPkgName, 'downloads');
                const appDownloadDirPath = await join(downloadDirPath, config.appName);

                if (!await fs.exists(tempDownloadDirPath)) fs.mkdir(tempDownloadDirPath, { recursive: true }).then(() => { console.log(`Created DIR: ${tempDownloadDirPath}`) });

                setPath('ffmpegPath', ffmpegPath);
                setPath('tempDownloadDirPath', tempDownloadDirPath);
                if (DOWNLOAD_DIR) {
                    setPath('downloadDirPath', DOWNLOAD_DIR);
                } else {
                    if(!await fs.exists(appDownloadDirPath)) fs.mkdir(appDownloadDirPath, { recursive: true }).then(() => { console.log(`Created DIR: ${appDownloadDirPath}`) });
                    setPath('downloadDirPath', appDownloadDirPath);
                }
                console.log('Paths initialized:', { ffmpegPath, tempDownloadDirPath, downloadDirPath: DOWNLOAD_DIR || appDownloadDirPath });
            } catch (e) {
                console.error('Failed to fetch paths:', e);
            }
        };
        initPaths();
    }, [DOWNLOAD_DIR, setPath]);

    // Fetch app version
    useEffect(() => {
        const fetchAppVersion = async () => {
            setIsFetchingAppVersion(true);
            try {
                const version = await getVersion();
                console.log("App version fetched successfully:", version);
                setAppVersion(version);
            } catch (e) {
                console.error('Failed to fetch app version:', e);
            } finally {
                setIsFetchingAppVersion(false);
            }
        }
        fetchAppVersion();
    }, []);

    // Fetch yt-dlp version
    useEffect(() => {
        const fetchYtDlpVersion = async () => {
            setIsFetchingYtDlpVersion(true);
            try {
                const command = Command.sidecar('binaries/yt-dlp', ['--version']);
                const output = await command.execute();
                if (output.code === 0) {
                    const version = output.stdout.trim();
                    console.log("yt-dlp version fetched successfully:", version);
                    setYtDlpVersion(version);
                } else {
                    console.error("Failed to fetch yt-dlp version:", output.stderr);
                }
            } catch (e) {
                console.error('Failed to fetch yt-dlp version:', e);
            } finally {
                setIsFetchingYtDlpVersion(false);
            }
        };
        fetchYtDlpVersion();
    }, [ytDlpVersion, setYtDlpVersion]);

    // Check for app update
    useEffect(() => {
        // Only run once when both settings and KV pairs are loaded
        if (!isSettingsStatePropagated || !isKvPairsStatePropagated) {
            console.log("Skipping app update check, waiting for configs to load...");
            return;
        }
        // Skip if we've already run the update check once
        if (hasRunAppUpdateCheckRef.current) {
            console.log("App update check already performed in this session, skipping");
            return;
        }
        hasRunAppUpdateCheckRef.current = true;
        checkForAppUpdate().catch((error) => {
            console.error("Error checking for app update:", error);
        });
    }, [isSettingsStatePropagated, isKvPairsStatePropagated]);

    // Check for yt-dlp auto-update
    useEffect(() => {
        // Only run once when both settings and KV pairs are loaded
        if (!isSettingsStatePropagated || !isKvPairsStatePropagated) {
            console.log("Skipping yt-dlp auto-update check, waiting for configs to load...");
            return;
        }
        // Skip if we've already run the auto-update once
        if (hasRunYtDlpAutoUpdateRef.current) {
            console.log("Auto-update check already performed in this session, skipping");
            return;
        }
        hasRunYtDlpAutoUpdateRef.current = true;
        console.log("Checking yt-dlp auto-update with loaded config values:", {
            autoUpdate: YTDLP_AUTO_UPDATE,
            updateChannel: YTDLP_UPDATE_CHANNEL,
            lastCheck: ytDlpUpdateLastCheck
        });
        const currentTimestamp = Date.now()
        const YTDLP_UPDATE_INTERVAL = 86400000   // 24H;
        if (YTDLP_AUTO_UPDATE && (ytDlpUpdateLastCheck === null || currentTimestamp - ytDlpUpdateLastCheck > YTDLP_UPDATE_INTERVAL)) {
            console.log("Running auto-update for yt-dlp...");
            updateYtDlp();
        } else {
            console.log("Skipping yt-dlp auto-update, either disabled or recently updated.");
        }
    }, [isSettingsStatePropagated, isKvPairsStatePropagated]);

    // Check for MacOS auto-registration
    useEffect(() => {
        // Only run once when both settings and KV pairs are loaded
        if (!isSettingsStatePropagated || !isKvPairsStatePropagated) {
            console.log("Skipping MacOS auto registration, waiting for configs to load...");
            return;
        }
        // Skip if we've already run the macos auto-registration once
        if (isRegisteredToMacOsRef.current) {
            console.log("MacOS auto registration check already performed in this session, skipping");
            return;
        }
        isRegisteredToMacOsRef.current = true;
        console.log("Checking MacOS auto registration with loaded config values:", {
            appVersion: appVersion,
            registeredVersion: macOsRegisteredVersion
        });
        if (currentPlatform === 'macos' && (!macOsRegisteredVersion || macOsRegisteredVersion !== appVersion)) {
            console.log("Running MacOS auto registration...");
            LOG.info('NEODLP', 'Running macOS registration');
            registerToMac().then((result: { success: boolean, message: string }) => {
                if (result.success) {
                    console.log("MacOS registration successful:", result.message);
                    LOG.info('NEODLP', 'macOS registration successful');
                } else {
                    console.error("MacOS registration failed:", result.message);
                    LOG.error('NEODLP', `macOS registration failed: ${result.message}`);
                }
            }).catch((error) => {
                console.error("Error during macOS registration:", error);
                LOG.error('NEODLP', `Error during macOS registration: ${error}`);
            });
        }
    }, [isSettingsStatePropagated, isKvPairsStatePropagated]);

    useEffect(() => {
        if (isSuccessFetchingDownloadStates && downloadStates) {
            // console.log("Download States fetched successfully:", downloadStates);
            setDownloadStates(downloadStates);
        }
    }, [downloadStates, isSuccessFetchingDownloadStates, setDownloadStates]);

    // Process queued downloads
    useEffect(() => {
        // Safely process the queue when dependencies change
        const timeoutId = setTimeout(() => {
            processQueuedDownloads();
        }, 500);

        // Cleanup timeout if component unmounts or dependencies change
        return () => clearTimeout(timeoutId);
    }, [processQueuedDownloads, ongoingDownloads, queuedDownloads]);

    // show a toast and pause the download when yt-dlp exits unexpectedly
    useEffect(() => {
        const unexpectedErrors = Array.from(erroredDownloadIds).filter(id => !expectedErrorDownloadIds.has(id));
        const processedUnexpectedErrors = unexpectedErrors.filter(id => !pendingErrorUpdatesRef.current.has(id));
        if (unexpectedErrors.length === 0) return;

        processedUnexpectedErrors.forEach((downloadId) => {
            const downloadState = globalDownloadStates.find(d => d.download_id === downloadId);
            const isPlaylist = downloadState?.playlist_id !== null && downloadState?.playlist_indices !== null;
            const isMultiplePlaylistItems = isPlaylist && downloadState?.playlist_indices && downloadState?.playlist_indices.includes(',');

            toast.error("Download Failed", {
                description: `The download for ${isMultiplePlaylistItems ? 'playlist ' : ''}"${isMultiplePlaylistItems ? downloadState?.playlist_title : downloadState?.title}" failed because yt-dlp exited unexpectedly. Please try again later.`,
            });
        });

        const timeoutIds: NodeJS.Timeout[] = [];
        unexpectedErrors.forEach((downloadId) => {
            pendingErrorUpdatesRef.current.add(downloadId);

            const timeoutId = setTimeout(() => {
                downloadStatusUpdater.mutate({ download_id: downloadId, download_status: 'errored' }, {
                    onSuccess: (data) => {
                        console.log("Download status updated successfully:", data);
                        queryClient.invalidateQueries({ queryKey: ['download-states'] });
                        removeErroredDownload(downloadId);
                        pendingErrorUpdatesRef.current.delete(downloadId);
                    },
                    onError: (error) => {
                        console.error("Failed to update download status:", error);
                        removeErroredDownload(downloadId);
                        pendingErrorUpdatesRef.current.delete(downloadId);
                    }
                });
            }, 500);
            timeoutIds.push(timeoutId);
        });

        return () => {
            timeoutIds.forEach(id => clearTimeout(id));
        };
    }, [erroredDownloadIds, expectedErrorDownloadIds]);

    // auto reset error states after 3 seconds of expecting an error
    useEffect(() => {
        if (expectedErrorDownloadIds.size > 0) {
            const timeoutId = setTimeout(() => {
                expectedErrorDownloadIds.forEach((downloadId) => {
                    removeErroredDownload(downloadId);
                    removeExpectedErrorDownload(downloadId);
                });
            }, 3000);
            return () => clearTimeout(timeoutId);
        }
    }, [expectedErrorDownloadIds]);

    return (
        <AppContext.Provider value={{ fetchVideoMetadata, startDownload, pauseDownload, resumeDownload, cancelDownload }}>
            <ThemeProvider defaultTheme={APP_THEME || "system"} defaultColorScheme={APP_COLOR_SCHEME || "default"}>
                <TooltipProvider delayDuration={1000}>
                    {children}
                    <Sonner closeButton />
                </TooltipProvider>
            </ThemeProvider>
        </AppContext.Provider>
    );
}
