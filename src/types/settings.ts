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
    prefer_video_over_playlist: boolean;
    use_proxy: boolean;
    proxy_url: string;
    video_format: string;
    audio_format: string;
    always_reencode_video: boolean;
    embed_video_metadata: boolean;
    embed_audio_metadata: boolean;
    embed_audio_thumbnail: boolean;
    // extension settings
    websocket_port: number;
}