import { BasePathsStore, CurrentVideoMetadataStore, DownloadActionStatesStore, DownloaderPageStatesStore, DownloadStatesStore, EnvironmentStore, KvPairsStatesStore, LibraryPageStatesStore, LogsStore, SettingsPageStatesStore } from '@/types/store';
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
    searchPid: null,
    showSearchError: true,
    setVideoUrl: (url) => set(() => ({ videoUrl: url })),
    setVideoMetadata: (metadata) => set(() => ({ videoMetadata: metadata })),
    setIsMetadataLoading: (isLoading) => set(() => ({ isMetadataLoading: isLoading })),
    setRequestedUrl: (url) => set(() => ({ requestedUrl: url })),
    setAutoSubmitSearch: (autoSubmit) => set(() => ({ autoSubmitSearch: autoSubmit })),
    setSearchPid: (pid) => set(() => ({ searchPid: pid })),
    setShowSearchError: (showError) => set(() => ({ showSearchError: showError }))
}));

export const useDownloaderPageStatesStore = create<DownloaderPageStatesStore>((set) => ({
    activeDownloadModeTab: 'selective',
    activeDownloadConfigurationTab: 'options',
    isStartingDownload: false,
    selectedDownloadFormat: 'best',
    selectedCombinableVideoFormat: '',
    selectedCombinableAudioFormats: [],
    selectedSubtitles: [],
    selectedPlaylistVideos: ["1"],
    downloadConfiguration: {
        output_format: null,
        embed_metadata: null,
        embed_thumbnail: null,
        square_crop_thumbnail: null,
        sponsorblock: null,
        custom_command: null
    },
    erroredDownloadIds: new Set(),
    expectedErrorDownloadIds: new Set(),
    videoPanelSizes: [35, 65],
    playlistPanelSizes: [45, 55],
    setActiveDownloadModeTab: (tab) => set(() => ({ activeDownloadModeTab: tab })),
    setActiveDownloadConfigurationTab: (tab) => set(() => ({ activeDownloadConfigurationTab: tab })),
    setIsStartingDownload: (isStarting) => set(() => ({ isStartingDownload: isStarting })),
    setSelectedDownloadFormat: (format) => set(() => ({ selectedDownloadFormat: format })),
    setSelectedCombinableVideoFormat: (format) => set(() => ({ selectedCombinableVideoFormat: format })),
    setSelectedCombinableAudioFormats: (formats) => set(() => ({ selectedCombinableAudioFormats: formats })),
    setSelectedSubtitles: (subtitles) => set(() => ({ selectedSubtitles: subtitles })),
    setSelectedPlaylistVideos: (indices) => set(() => ({ selectedPlaylistVideos: indices })),
    setDownloadConfigurationKey: (key, value) => set((state) => ({
        downloadConfiguration: {
            ...state.downloadConfiguration,
            [key]: value
        }
    })),
    setDownloadConfiguration: (config) => set(() => ({ downloadConfiguration: config })),
    resetDownloadConfiguration: () => set(() => ({
        downloadConfiguration: {
            output_format: null,
            embed_metadata: null,
            embed_thumbnail: null,
            square_crop_thumbnail: null,
            sponsorblock: null,
            custom_command: null
        }
    })),
    addErroredDownload: (downloadId) => set((state) => ({
        erroredDownloadIds: new Set(state.erroredDownloadIds).add(downloadId)
    })),
    removeErroredDownload: (downloadId) => set((state) => {
        const newSet = new Set(state.erroredDownloadIds);
        newSet.delete(downloadId);
        return { erroredDownloadIds: newSet };
    }),
    addExpectedErrorDownload: (downloadId) => set((state) => ({
        expectedErrorDownloadIds: new Set(state.expectedErrorDownloadIds).add(downloadId)
    })),
    removeExpectedErrorDownload: (downloadId) => set((state) => {
        const newSet = new Set(state.expectedErrorDownloadIds);
        newSet.delete(downloadId);
        return { expectedErrorDownloadIds: newSet };
    }),
    clearErrorStates: () => set({ erroredDownloadIds: new Set(), expectedErrorDownloadIds: new Set() }),
    setVideoPanelSizes: (sizes) => set(() => ({ videoPanelSizes: sizes })),
    setPlaylistPanelSizes: (sizes) => set(() => ({ playlistPanelSizes: sizes }))
}));

export const useLibraryPageStatesStore = create<LibraryPageStatesStore>((set) => ({
    activeTab: 'completed',
    activeCompletedDownloadsPage: 1,
    setActiveTab: (tab) => set(() => ({ activeTab: tab })),
    setActiveCompletedDownloadsPage: (page) => set(() => ({ activeCompletedDownloadsPage: page }))
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
        color_scheme: 'default',
        download_dir: '',
        prefer_video_over_playlist: true,
        strict_downloadablity_check: false,
        max_parallel_downloads: 2,
        max_retries: 5,
        use_proxy: false,
        proxy_url: '',
        use_rate_limit: false,
        rate_limit: 1048576, // 1 MB/s
        video_format: 'auto',
        audio_format: 'auto',
        always_reencode_video: false,
        embed_video_metadata: false,
        embed_audio_metadata: false,
        embed_video_thumbnail: false,
        embed_audio_thumbnail: false,
        use_cookies: false,
        import_cookies_from: 'browser',
        cookies_browser: 'firefox',
        cookies_file: '',
        use_sponsorblock: false,
        sponsorblock_mode: 'remove',
        sponsorblock_remove: 'default',
        sponsorblock_mark: 'default',
        sponsorblock_remove_categories: [],
        sponsorblock_mark_categories: [],
        use_aria2: false,
        use_force_internet_protocol: false,
        force_internet_protocol: 'ipv4',
        use_custom_commands: false,
        custom_commands: [],
        filename_template: '%(title|Unknown)s_%(resolution|unknown)s',
        debug_mode: false,
        log_verbose: true,
        log_progress: false,
        enable_notifications: false,
        update_notification: true,
        download_completion_notification: false,
        use_delay: true,
        use_search_delay: false,
        delay_mode: 'auto',
        min_sleep_interval: 10,
        max_sleep_interval: 20,
        request_sleep_interval: 1,
        delay_playlist_only: true,
        use_potoken: false,
        disable_innertube: false,
        pot_server_port: 4416,
        // extension settings
        websocket_port: 53511
    },
    isUsingDefaultSettings: true,
    isChangingWebSocketPort: false,
    isRestartingWebSocketServer: false,
    isCheckingAppUpdate: false,
    appUpdate: null,
    isUpdatingApp: false,
    appUpdateDownloadProgress: 0,
    formResetTrigger: 0,
    resetAcknowledgements: 0,
    isRunningPotServer: false,
    isStartingPotServer: false,
    isChangingPotServerPort: false,
    potServerPid: null,
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
            color_scheme: 'default',
            download_dir: '',
            prefer_video_over_playlist: true,
            strict_downloadablity_check: false,
            max_parallel_downloads: 2,
            max_retries: 5,
            use_proxy: false,
            proxy_url: '',
            use_rate_limit: false,
            rate_limit: 1048576, // 1 MB/s
            video_format: 'auto',
            audio_format: 'auto',
            always_reencode_video: false,
            embed_video_metadata: false,
            embed_audio_metadata: false,
            embed_video_thumbnail: false,
            embed_audio_thumbnail: false,
            use_cookies: false,
            import_cookies_from: 'browser',
            cookies_browser: 'firefox',
            cookies_file: '',
            use_sponsorblock: false,
            sponsorblock_mode: 'remove',
            sponsorblock_remove: 'default',
            sponsorblock_mark: 'default',
            sponsorblock_remove_categories: [],
            sponsorblock_mark_categories: [],
            use_aria2: false,
            use_force_internet_protocol: false,
            force_internet_protocol: 'ipv4',
            use_custom_commands: false,
            custom_commands: [],
            filename_template: '%(title|Unknown)s_%(resolution|unknown)s',
            debug_mode: false,
            log_verbose: true,
            log_progress: false,
            enable_notifications: false,
            update_notification: true,
            download_completion_notification: false,
            use_delay: true,
            use_search_delay: false,
            delay_mode: 'auto',
            min_sleep_interval: 10,
            max_sleep_interval: 20,
            request_sleep_interval: 1,
            delay_playlist_only: true,
            use_potoken: false,
            disable_innertube: false,
            pot_server_port: 4416,
            // extension settings
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
    setAppUpdateDownloadProgress: (progress) => set(() => ({ appUpdateDownloadProgress: progress })),
    triggerFormReset: () => set((state) => ({
        formResetTrigger: state.formResetTrigger + 1,
        resetAcknowledgements: 0
    })),
    acknowledgeFormReset: () => set((state) => ({
        resetAcknowledgements: state.resetAcknowledgements + 1
    })),
    setIsRunningPotServer: (isRunning) => set(() => ({ isRunningPotServer: isRunning })),
    setIsStartingPotServer: (isStarting) => set(() => ({ isStartingPotServer: isStarting })),
    setIsChangingPotServerPort: (isChanging) => set(() => ({ isChangingPotServerPort: isChanging })),
    setPotServerPid: (pid) => set(() => ({ potServerPid: pid }))
}));

export const useKvPairsStatesStore = create<KvPairsStatesStore>((set) => ({
    kvPairs: {
        ytdlp_update_last_check: null,
        macos_registered_version: null,
        linux_registered_version: null
    },
    setKvPairsKey: (key, value) => set((state) => ({
        kvPairs: {
            ...state.kvPairs,
            [key]: value
        }
    })),
    setKvPairs: (kvPairs) => set(() => ({ kvPairs }))
}));

export const useLogsStore = create<LogsStore>((set) => ({
    logs: [],
    setLogs: (logs) => set(() => ({ logs })),
    addLog: (log) => set((state) => ({ logs: [...state.logs, log] })),
    clearLogs: () => set(() => ({ logs: [] }))
}));

export const useEnvironmentStore = create<EnvironmentStore>((set) => ({
    isFlatpak: false,
    isAppimage: false,
    appDirPath: null,
    setIsFlatpak: (isFlatpak) => set(() => ({ isFlatpak })),
    setIsAppimage: (isAppimage) => set(() => ({ isAppimage })),
    setAppDirPath: (path) => set(() => ({ appDirPath: path }))
}));
