import { DownloadState } from "@/types/download";
import { RawVideoInfo } from "@/types/video";
import { Settings } from "@/types/settings";
import { KvStore } from "@/types/kvStore";
import { Update } from "@tauri-apps/plugin-updater";

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
    setVideoUrl: (url: string) => void;
    setVideoMetadata: (metadata: RawVideoInfo | null) => void;
    setIsMetadataLoading: (isLoading: boolean) => void;
    setRequestedUrl: (url: string) => void;
    setAutoSubmitSearch: (autoSubmit: boolean) => void;
}

export interface DownloaderPageStatesStore {
    activeDownloadModeTab: string;
    isStartingDownload: boolean;
    selectedDownloadFormat: string;
    selectedCombinableVideoFormat: string;
    selectedCombinableAudioFormat: string;
    selectedSubtitles: string[];
    selectedPlaylistVideoIndex: string;
    isErrored: boolean;
    isErrorExpected: boolean;
    erroredDownloadId: string | null;
    setActiveDownloadModeTab: (tab: string) => void;
    setIsStartingDownload: (isStarting: boolean) => void;
    setSelectedDownloadFormat: (format: string) => void;
    setSelectedCombinableVideoFormat: (format: string) => void;
    setSelectedCombinableAudioFormat: (format: string) => void;
    setSelectedSubtitles: (subtitles: string[]) => void;
    setSelectedPlaylistVideoIndex: (index: string) => void;
    setIsErrored: (isErrored: boolean) => void;
    setIsErrorExpected: (isErrorExpected: boolean) => void;
    setErroredDownloadId: (downloadId: string | null) => void;
}

export interface LibraryPageStatesStore {
    activeTab: string;
    setActiveTab: (tab: string) => void;
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
}

export interface KvPairsStatesStore {
    kvPairs: KvStore
    setKvPairsKey: (key: string, value: unknown) => void;
    setKvPairs: (kvPairs: KvStore) => void;
}