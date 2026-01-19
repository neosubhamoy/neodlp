import { DownloadState } from "@/types/download";
import { RawVideoInfo } from "@/types/video";
import { DownloadConfiguration, Settings } from "@/types/settings";
import { KvStore } from "@/types/kvStore";
import { Update } from "@tauri-apps/plugin-updater";
import { Log } from "@/types/logs";

export interface BasePathsStore {
    ffmpegPath: string | null;
    tempDownloadDirPath: string | null;
    downloadDirPath: string | null;
    setPath: (key: string, path: string) => void;
}

export interface DownloadStatesStore {
    downloadStates: DownloadState[];
    setDownloadStates: (state: DownloadState[]) => void;
    setDownloadState: (state: DownloadState) => void;
}

export interface CurrentVideoMetadataStore {
    videoUrl: string;
    videoMetadata: RawVideoInfo | null;
    isMetadataLoading: boolean;
    requestedUrl: string;
    autoSubmitSearch: boolean;
    searchPid: number | null;
    showSearchError: boolean;
    setVideoUrl: (url: string) => void;
    setVideoMetadata: (metadata: RawVideoInfo | null) => void;
    setIsMetadataLoading: (isLoading: boolean) => void;
    setRequestedUrl: (url: string) => void;
    setAutoSubmitSearch: (autoSubmit: boolean) => void;
    setSearchPid: (pid: number | null) => void;
    setShowSearchError: (showError: boolean) => void;
}

export interface DownloaderPageStatesStore {
    activeDownloadModeTab: string;
    activeDownloadConfigurationTab: string;
    isStartingDownload: boolean;
    selectedDownloadFormat: string;
    selectedCombinableVideoFormat: string;
    selectedCombinableAudioFormats: string[];
    selectedSubtitles: string[];
    selectedPlaylistVideos: string[];
    downloadConfiguration: DownloadConfiguration;
    erroredDownloadIds: Set<string>;
    expectedErrorDownloadIds: Set<string>;
    videoPanelSizes: number[];
    playlistPanelSizes: number[];
    setActiveDownloadModeTab: (tab: string) => void;
    setActiveDownloadConfigurationTab: (tab: string) => void;
    setIsStartingDownload: (isStarting: boolean) => void;
    setSelectedDownloadFormat: (format: string) => void;
    setSelectedCombinableVideoFormat: (format: string) => void;
    setSelectedCombinableAudioFormats: (formats: string[]) => void;
    setSelectedSubtitles: (subtitles: string[]) => void;
    setSelectedPlaylistVideos: (indices: string[]) => void;
    setDownloadConfigurationKey: (key: string, value: unknown) => void;
    setDownloadConfiguration: (config: DownloadConfiguration) => void;
    resetDownloadConfiguration: () => void;
    addErroredDownload: (downloadId: string) => void;
    removeErroredDownload: (downloadId: string) => void;
    addExpectedErrorDownload: (downloadId: string) => void;
    removeExpectedErrorDownload: (downloadId: string) => void;
    clearErrorStates: () => void;
    setVideoPanelSizes: (sizes: number[]) => void;
    setPlaylistPanelSizes: (sizes: number[]) => void;
}

export interface LibraryPageStatesStore {
    activeTab: string;
    activeCompletedDownloadsPage: number;
    setActiveTab: (tab: string) => void;
    setActiveCompletedDownloadsPage: (page: number) => void;
}

export interface DownloadActionStatesStore {
    downloadActions: {
        [download_id: string]: {
            isResuming: boolean;
            isPausing: boolean;
            isCanceling: boolean;
            isDeleteFileChecked: boolean;
        }
    };
    setIsResumingDownload: (download_id: string, isResuming: boolean) => void;
    setIsPausingDownload: (download_id: string, isPausing: boolean) => void;
    setIsCancelingDownload: (download_id: string, isCanceling: boolean) => void;
    setIsDeleteFileChecked: (download_id: string, isDeleteFileChecked: boolean) => void;
}

export interface SettingsPageStatesStore {
    activeTab: string;
    activeSubAppTab: string;
    activeSubExtTab: string;
    appVersion: string | null;
    isFetchingAppVersion: boolean;
    ytDlpVersion: string | null;
    isFetchingYtDlpVersion: boolean;
    isUpdatingYtDlp: boolean;
    settings: Settings;
    isUsingDefaultSettings: boolean;
    isChangingWebSocketPort: boolean;
    isRestartingWebSocketServer: boolean;
    isCheckingAppUpdate: boolean;
    appUpdate: Update | null;
    isUpdatingApp: boolean;
    appUpdateDownloadProgress: number;
    formResetTrigger: number;
    resetAcknowledgements: number;
    setActiveTab: (tab: string) => void;
    setActiveSubAppTab: (tab: string) => void;
    setActiveSubExtTab: (tab: string) => void;
    setAppVersion: (version: string | null) => void;
    setIsFetchingAppVersion: (isFetching: boolean) => void;
    setYtDlpVersion: (version: string | null) => void;
    setIsFetchingYtDlpVersion: (isFetching: boolean) => void;
    setIsUpdatingYtDlp: (isUpdating: boolean) => void;
    setSettingsKey: (key: string, value: unknown) => void;
    setSettings: (settings: Settings) => void;
    resetSettings: () => void;
    setIsUsingDefaultSettings: (isUsingDefault: boolean) => void;
    setIsChangingWebSocketPort: (isChanging: boolean) => void;
    setIsRestartingWebSocketServer: (isRestarting: boolean) => void;
    setIsCheckingAppUpdate: (isChecking: boolean) => void;
    setAppUpdate: (update: Update | null) => void;
    setIsUpdatingApp: (isUpdating: boolean) => void;
    setAppUpdateDownloadProgress: (progress: number) => void;
    triggerFormReset: () => void;
    acknowledgeFormReset: () => void;
}

export interface KvPairsStatesStore {
    kvPairs: KvStore
    setKvPairsKey: (key: string, value: unknown) => void;
    setKvPairs: (kvPairs: KvStore) => void;
}

export interface LogsStore {
    logs: Log[];
    setLogs: (logs: Log[]) => void;
    addLog: (log: Log) => void;
    clearLogs: () => void;
}
