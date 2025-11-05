export interface SettingsTable {
    key: string;
    value: string;
}

export interface CustomCommand {
    id: string;
    label: string;
    args: string;
}

export interface Settings {
    ytdlp_update_channel: string;
    ytdlp_auto_update: boolean;
    theme: 'dark' | 'light' | 'system';
    download_dir: string;
    max_parallel_downloads: number;
    max_retries: number;
    prefer_video_over_playlist: boolean;
    strict_downloadablity_check: boolean;
    use_proxy: boolean;
    proxy_url: string;
    use_rate_limit: boolean;
    rate_limit: number;
    video_format: string;
    audio_format: string;
    always_reencode_video: boolean;
    embed_video_metadata: boolean;
    embed_audio_metadata: boolean;
    embed_video_thumbnail: boolean;
    embed_audio_thumbnail: boolean;
    use_cookies: boolean;
    import_cookies_from: string;
    cookies_browser: string;
    cookies_file: string;
    use_sponsorblock: boolean;
    sponsorblock_mode: string;
    sponsorblock_remove: string;
    sponsorblock_mark: string;
    sponsorblock_remove_categories: string[];
    sponsorblock_mark_categories: string[];
    use_aria2: boolean;
    use_force_internet_protocol: boolean;
    force_internet_protocol: string;
    use_custom_commands: boolean;
    custom_commands: CustomCommand[];
    filename_template: string;
    debug_mode: boolean;
    log_verbose: boolean;
    log_warning: boolean;
    log_progress: boolean;
    enable_notifications: boolean;
    update_notification: boolean;
    download_completion_notification: boolean;
    // extension settings
    websocket_port: number;
}

export interface DownloadConfiguration {
    output_format: string | null;
    embed_metadata: boolean | null;
    embed_thumbnail: boolean | null;
    sponsorblock: string | null;
    custom_command: string | null;
}
