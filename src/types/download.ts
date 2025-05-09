export interface DownloadState {
    download_id: string;
    download_status: string;
    video_id: string;
    format_id: string;
    subtitle_id: string | null;
    queue_index: number | null;
    playlist_id: string | null;
    playlist_index: number | null;
    title: string;
    url: string;
    host: string;
    thumbnail: string | null;
    channel: string | null;
    duration_string: string | null;
    release_date: string | null;
    view_count: number | null;
    like_count: number | null;
    playlist_title: string;
    playlist_url: string;
    playlist_n_entries: number;
    playlist_channel: string | null;
    resolution: string | null;
    ext: string | null;
    abr: number | null;
    vbr: number | null;
    acodec: string | null;
    vcodec: string | null;
    dynamic_range: string | null;
    process_id: number | null;
    status: string | null;
    progress: number | null;
    total: number | null;
    downloaded: number | null;
    speed: number | null;
    eta: number | null;
    filepath: string | null;
    filetype: string | null;
    filesize: number | null;
}

export interface Download {
    download_id: string;
    download_status: string;
    video_id: string;
    format_id: string;
    subtitle_id: string | null;
    queue_index: number | null;
    playlist_id: string | null;
    playlist_index: number | null;
    resolution: string | null;
    ext: string | null;
    abr: number | null;
    vbr: number | null;
    acodec: string | null;
    vcodec: string | null;
    dynamic_range: string | null;
    process_id: number | null;
    status: string | null;
    progress: number | null;
    total: number | null;
    downloaded: number | null;
    speed: number | null;
    eta: number | null;
    filepath: string | null;
    filetype: string | null;
    filesize: number | null;
}

export interface DownloadProgress {
    status: string | null;
    progress: number | null;
    speed: number | null;
    downloaded: number | null;
    total: number | null;
    eta: number | null;
}