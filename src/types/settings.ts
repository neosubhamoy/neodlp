export interface SettingsTable {
    key: string;
    value: string;
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
    embed_audio_thumbnail: boolean;
    // extension settings
    websocket_port: number;
}