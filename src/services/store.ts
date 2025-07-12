import { BasePathsStore, CurrentVideoMetadataStore, DownloadActionStatesStore, DownloaderPageStatesStore, DownloadStatesStore, KvPairsStatesStore, SettingsPageStatesStore } from '@/types/store';
import { create } from 'zustand';

export const useBasePathsStore = create<BasePathsStore>((set) => ({
    ffmpegPath: null,
    tempDownloadDirPath: null,
    downloadDirPath: null,
    setPath: (key, path) => set(() => ({ [key]: path }))
}));

export const useDownloadStatesStore = create<DownloadStatesStore>((set) => ({
    downloadStates: [],
    setDownloadStates: (states) => set(() => ({ downloadStates: states })),
    setDownloadState: (state) => set((prev) => {
        const existingIndex = prev.downloadStates.findIndex(
            item => item.download_id === state.download_id
        );
        
        if (existingIndex !== -1) {
            // Update existing state
            const updatedStates = [...prev.downloadStates];
            updatedStates[existingIndex] = state;
            return { downloadStates: updatedStates };
        } else {
            // Add new state
            return { downloadStates: [...prev.downloadStates, state] };
        }
    })
}));

export const useCurrentVideoMetadataStore = create<CurrentVideoMetadataStore>((set) => ({
    videoUrl: '',
    videoMetadata: null,
    isMetadataLoading: false,
    requestedUrl: '',
    autoSubmitSearch: false,
    setVideoUrl: (url) => set(() => ({ videoUrl: url })),
    setVideoMetadata: (metadata) => set(() => ({ videoMetadata: metadata })),
    setIsMetadataLoading: (isLoading) => set(() => ({ isMetadataLoading: isLoading })),
    setRequestedUrl: (url) => set(() => ({ requestedUrl: url })),
    setAutoSubmitSearch: (autoSubmit) => set(() => ({ autoSubmitSearch: autoSubmit })),
}));

export const useDownloaderPageStatesStore = create<DownloaderPageStatesStore>((set) => ({
    activeDownloadModeTab: 'selective',
    isStartingDownload: false,
    selectedDownloadFormat: 'best',
    selectedCombinableVideoFormat: '',
    selectedCombinableAudioFormat: '',
    selectedSubtitles: [],
    selectedPlaylistVideoIndex: '1',
    setActiveDownloadModeTab: (tab) => set(() => ({ activeDownloadModeTab: tab })),
    setIsStartingDownload: (isStarting) => set(() => ({ isStartingDownload: isStarting })),
    setSelectedDownloadFormat: (format) => set(() => ({ selectedDownloadFormat: format })),
    setSelectedCombinableVideoFormat: (format) => set(() => ({ selectedCombinableVideoFormat: format })),
    setSelectedCombinableAudioFormat: (format) => set(() => ({ selectedCombinableAudioFormat: format })),
    setSelectedSubtitles: (subtitles) => set(() => ({ selectedSubtitles: subtitles })),
    setSelectedPlaylistVideoIndex: (index) => set(() => ({ selectedPlaylistVideoIndex: index }))
}));

export const useDownloadActionStatesStore = create<DownloadActionStatesStore>((set) => ({
    downloadActions: {},
    setIsResumingDownload: (download_id, isResuming) => set((state) => ({
        downloadActions: {
            ...state.downloadActions,
            [download_id]: {
                ...state.downloadActions[download_id],
                isResuming
            }
        }
    })),
    setIsPausingDownload: (download_id, isPausing) => set((state) => ({
        downloadActions: {
            ...state.downloadActions,
            [download_id]: {
                ...state.downloadActions[download_id],
                isPausing
            }
        }
    })),
    setIsCancelingDownload: (download_id, isCanceling) => set((state) => ({
        downloadActions: {
            ...state.downloadActions,
            [download_id]: {
                ...state.downloadActions[download_id],
                isCanceling
            }
        }
    })),
    setIsDeleteFileChecked: (download_id, isDeleteFileChecked) => set((state) => ({
        downloadActions: {
            ...state.downloadActions,
            [download_id]: {
                ...state.downloadActions[download_id],
                isDeleteFileChecked
            }
        }
    }))
}));

export const useSettingsPageStatesStore = create<SettingsPageStatesStore>((set) => ({
    activeTab: 'app',
    activeSubAppTab: 'general',
    activeSubExtTab: 'install',
    appVersion: null,
    isFetchingAppVersion: false,
    ytDlpVersion: null,
    isFetchingYtDlpVersion: false,
    isUpdatingYtDlp: false,
    settings: {
        ytdlp_update_channel: 'nightly',
        ytdlp_auto_update: true,
        theme: 'system',
        download_dir: '',
        prefer_video_over_playlist: true,
        strict_downloadablity_check: false,
        max_parallel_downloads: 2,
        use_proxy: false,
        proxy_url: '',
        video_format: 'auto',
        audio_format: 'auto',
        always_reencode_video: false,
        embed_video_metadata: false,
        embed_audio_metadata: true,
        embed_audio_thumbnail: true,
        websocket_port: 53511
    },
    isUsingDefaultSettings: true,
    isChangingWebSocketPort: false,
    isRestartingWebSocketServer: false,
    isCheckingAppUpdate: false,
    appUpdate: null,
    isUpdatingApp: false,
    appUpdateDownloadProgress: 0,
    setActiveTab: (tab) => set(() => ({ activeTab: tab })),
    setActiveSubAppTab: (tab) => set(() => ({ activeSubAppTab: tab })),
    setActiveSubExtTab: (tab) => set(() => ({ activeSubExtTab: tab })),
    setAppVersion: (version) => set(() => ({ appVersion: version })),
    setIsFetchingAppVersion: (isFetching) => set(() => ({ isFetchingAppVersion: isFetching })),
    setYtDlpVersion: (version) => set(() => ({ ytDlpVersion: version })),
    setIsFetchingYtDlpVersion: (isFetching) => set(() => ({ isFetchingYtDlpVersion: isFetching })),
    setIsUpdatingYtDlp: (isUpdating) => set(() => ({ isUpdatingYtDlp: isUpdating })),
    setSettingsKey: (key, value) => set((state) => ({
        settings: {
            ...state.settings,
            [key]: value
        }
    })),
    setSettings: (settings) => set(() => ({ settings })),
    resetSettings: () => set(() => ({
        settings: {
            ytdlp_update_channel: 'nightly',
            ytdlp_auto_update: true,
            theme: 'system',
            download_dir: '',
            prefer_video_over_playlist: true,
            strict_downloadablity_check: false,
            max_parallel_downloads: 2,
            use_proxy: false,
            proxy_url: '',
            video_format: 'auto',
            audio_format: 'auto',
            always_reencode_video: false,
            embed_video_metadata: false,
            embed_audio_metadata: true,
            embed_audio_thumbnail: true,
            websocket_port: 53511
        },
        isUsingDefaultSettings: true
    })),
    setIsUsingDefaultSettings: (isUsing) => set(() => ({ isUsingDefaultSettings: isUsing })),
    setIsChangingWebSocketPort: (isChanging) => set(() => ({ isChangingWebSocketPort: isChanging })),
    setIsRestartingWebSocketServer: (isRestarting) => set(() => ({ isRestartingWebSocketServer: isRestarting })),
    setIsCheckingAppUpdate: (isChecking) => set(() => ({ isCheckingAppUpdate: isChecking })),
    setAppUpdate: (update) => set(() => ({ appUpdate: update })),
    setIsUpdatingApp: (isUpdating) => set(() => ({ isUpdatingApp: isUpdating })),
    setAppUpdateDownloadProgress: (progress) => set(() => ({ appUpdateDownloadProgress: progress }))
}));

export const useKvPairsStatesStore = create<KvPairsStatesStore>((set) => ({
    kvPairs: {
        ytdlp_update_last_check: null,
        macos_registered_version: null
    },
    setKvPairsKey: (key, value) => set((state) => ({
        kvPairs: {
            ...state.kvPairs,
            [key]: value
        }
    })),
    setKvPairs: (kvPairs) => set(() => ({ kvPairs }))
}));