export interface RawVideoInfo {
    id: string;
    title: string;
    original_url: string;
    webpage_url: string;
    webpage_url_domain: string;
    thumbnail: string;
    channel: string;
    uploader: string;
    creator: string;
    duration_string: string;
    release_date: string;
    upload_date: string;
    view_count: number;
    like_count: number;
    resolution: string;
    ext: string;
    abr: number;
    vbr: number;
    tbr: number;
    acodec: string;
    vcodec: string;
    audio_ext: string;
    video_ext: string;
    fps: number;
    dynamic_range: string;
    aspect_ratio: number;
    _type: string;
    extractor: string;
    filesize_approx: number;
    subtitles: {
        [subtitle_id: string]: VideoSubtitle[];
    };
    automatic_captions: {
        [subtitle_id: string]: VideoSubtitle[];
    };
    formats: VideoFormat[];
    requested_downloads: VideoFormat[];
    requested_subtitles: {
        [subtitle_id: string]: VideoSubtitle;
    };
    playlist_id: string;
    playlist_title: string;
    playlist_channel: string;
    playlist_uploader: string;
    playlist_creator: string;
    playlist_webpage_url: string;
    entries: RawVideoInfo[];
    n_entries: number;
    playlist_count: number;
    playlist_index: number;
}

export interface VideoInfo {
    video_id: string;
    title: string;
    url: string;
    host: string;
    thumbnail: string | null;
    channel: string | null;
    duration_string: string | null;
    release_date: string | null;
    view_count: number | null;
    like_count: number | null;
}

export interface VideoFormat {
    format_id: string;
    format: string;
    format_note: string;
    ext: string;
    resolution: string | null;
    filesize_approx: number | null;
    dynamic_range?: string | null;
    vcodec?: string | null;
    acodec?: string | null;
    video_ext?: string | null;
    audio_ext?: string | null;
    tbr?: number | null;
    fps?: number | null;
}

export interface VideoSubtitle {
    ext: string;
    url: string;
    name: string;
}
