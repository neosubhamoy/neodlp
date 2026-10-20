//! Typed access to yt-dlp's `--dump-single-json` output, plus the id/extension rules that used to
//! live in `startDownload` (`src/hooks/use-downloader.ts`).

use super::model::{DownloadConfig, FileType, ResumeState};
use super::repo::DownloadState;
use super::settings::DownloadSettings;
use serde_json::Value;

/// The fields of one video (or of a playlist's first entry) that the app records.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct VideoMeta {
    pub id: String,
    pub domain: String,
    pub title: String,
    pub thumbnail: Option<String>,
    /// creator, else channel, else uploader
    pub channel: Option<String>,
    pub duration_string: Option<String>,
    pub release_date: Option<String>,
    pub view_count: Option<i64>,
    pub like_count: Option<i64>,
    pub duration: Option<f64>,
    pub resolution: Option<String>,
    pub ext: Option<String>,
    pub abr: Option<f64>,
    pub vbr: Option<f64>,
    pub acodec: Option<String>,
    pub vcodec: Option<String>,
    pub dynamic_range: Option<String>,
    pub filesize_approx: Option<i64>,
    pub playlist_id: Option<String>,
    pub playlist_title: Option<String>,
    pub playlist_url: Option<String>,
    pub playlist_n_entries: Option<i64>,
    /// `playlist_channel` as stored on download rows
    pub playlist_channel: Option<String>,
    /// playlist creator, else channel, else uploader, as stored on playlist rows
    pub playlist_info_channel: Option<String>,
}

impl VideoMeta {
    /// For playlists the per-video fields come from the first entry, as before. Returns `None` when
    /// the JSON lacks an id/domain (or, for a playlist, any entries).
    pub fn from_json(root: &Value, is_playlist: bool) -> Option<VideoMeta> {
        let v = if is_playlist { root.get("entries")?.get(0)? } else { root };
        let id = text(v, "id")?;
        let domain = text(v, "webpage_url_domain")?;
        Some(VideoMeta {
            id,
            domain,
            title: text(v, "title").unwrap_or_else(|| "Untitled".into()),
            thumbnail: text(v, "thumbnail"),
            channel: first_text(v, &["creator", "channel", "uploader"]),
            duration_string: text(v, "duration_string"),
            release_date: text(v, "release_date"),
            view_count: int(v, "view_count"),
            like_count: int(v, "like_count"),
            duration: v.get("duration").and_then(Value::as_f64),
            resolution: text(v, "resolution"),
            ext: text(v, "ext"),
            abr: v.get("abr").and_then(Value::as_f64),
            vbr: v.get("vbr").and_then(Value::as_f64),
            acodec: text(v, "acodec"),
            vcodec: text(v, "vcodec"),
            dynamic_range: text(v, "dynamic_range"),
            filesize_approx: int(v, "filesize_approx"),
            playlist_id: text(v, "playlist_id"),
            playlist_title: text(v, "playlist_title"),
            playlist_url: text(v, "playlist_webpage_url"),
            playlist_n_entries: int(v, "playlist_count").or_else(|| int(v, "n_entries")),
            playlist_channel: text(v, "playlist_channel"),
            playlist_info_channel: first_text(
                v,
                &["playlist_creator", "playlist_channel", "playlist_uploader"],
            ),
        })
    }
}

/// A non-empty string field (the old code treated "" like null).
fn text(v: &Value, key: &str) -> Option<String> {
    v.get(key)?.as_str().filter(|s| !s.is_empty()).map(String::from)
}

fn first_text(v: &Value, keys: &[&str]) -> Option<String> {
    keys.iter().find_map(|key| text(v, key))
}

/// A non-zero integer field; JSON floats like `12.0` are accepted.
fn int(v: &Value, key: &str) -> Option<i64> {
    let n = v.get(key)?;
    n.as_i64()
        .or_else(|| n.as_f64().map(|f| f as i64))
        .filter(|n| *n != 0)
}

/// `generateVideoId`: the host without its TLD, joined with `_`, then `_<id>`.
pub fn generate_video_id(id: &str, host: &str) -> String {
    let mut parts: Vec<&str> = host.trim().split('.').collect();
    parts.pop();
    format!("{}_{id}", parts.join("_"))
}

/// The extension the UI shows until the real file name is known (`videoMetadata.ext` overrides).
pub fn effective_ext(
    meta_ext: Option<&str>,
    file_type: FileType,
    settings: &DownloadSettings,
    config: &DownloadConfig,
    resume: Option<&ResumeState>,
) -> Option<String> {
    let mut ext = meta_ext.map(String::from);
    let (video, audio) = (settings.video_format.as_str(), settings.audio_format.as_str());

    if file_type != FileType::Unknown {
        if video != "auto" && matches!(file_type, FileType::VideoAudio | FileType::Video) {
            ext = Some(video.into());
        }
        if audio != "auto" && file_type == FileType::Audio {
            ext = Some(audio.into());
        }
    }
    if let Some(format) = config.output_format.as_deref().filter(|f| !f.is_empty() && *f != "auto") {
        ext = Some(format.into());
    }
    if let Some(format) = resume
        .and_then(|r| r.output_format.as_deref())
        .filter(|f| !f.is_empty())
    {
        ext = Some(format.into());
    }
    ext
}

/// Rebuilds the options a stored download was started with.
pub fn resume_from_state(state: &DownloadState) -> ResumeState {
    let r = &state.record;
    ResumeState {
        download_id: Some(r.download_id.clone()),
        video_id: Some(r.video_id.clone()),
        playlist_id: r.playlist_id.clone(),
        playlist_indices: r.playlist_indices.clone(),
        custom_command: r.custom_command.clone(),
        output_format: r.output_format.clone(),
        embed_metadata: r.embed_metadata != 0,
        embed_thumbnail: r.embed_thumbnail != 0,
        square_crop_thumbnail: r.square_crop_thumbnail != 0,
        sponsorblock_remove: r.sponsorblock_remove.clone(),
        sponsorblock_mark: r.sponsorblock_mark.clone(),
        use_aria2: r.use_aria2 != 0,
        trim_stamps: r.trim_stamps.clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn single() -> Value {
        json!({
            "id": "dQw4w9WgXcQ",
            "webpage_url_domain": "youtube.com",
            "title": "日本語のタイトル 🎬 café",
            "thumbnail": "https://i.ytimg.com/x.jpg",
            "creator": null,
            "channel": "Some Channel",
            "uploader": "Uploader",
            "duration_string": "3:33",
            "duration": 213.4,
            "release_date": "20091025",
            "view_count": 1500000000u64,
            "like_count": 0,
            "resolution": "1920x1080",
            "ext": "webm",
            "abr": 129.5,
            "vbr": null,
            "acodec": "opus",
            "vcodec": "vp9",
            "dynamic_range": "SDR",
            "filesize_approx": 12345678
        })
    }

    #[test]
    fn parses_a_single_video() {
        let m = VideoMeta::from_json(&single(), false).unwrap();
        assert_eq!(m.id, "dQw4w9WgXcQ");
        assert_eq!(m.domain, "youtube.com");
        assert_eq!(m.title, "日本語のタイトル 🎬 café");
        assert_eq!(m.channel.as_deref(), Some("Some Channel"));
        assert_eq!(m.view_count, Some(1_500_000_000));
        assert_eq!(m.like_count, None, "0 is stored as null like before");
        assert_eq!(m.abr, Some(129.5));
        assert_eq!(m.vbr, None);
        assert_eq!(m.duration, Some(213.4));
        assert_eq!(m.filesize_approx, Some(12_345_678));
        assert_eq!(m.playlist_title, None);
    }

    #[test]
    fn channel_falls_back_creator_then_channel_then_uploader() {
        let mut v = single();
        v["creator"] = json!("Creator");
        assert_eq!(VideoMeta::from_json(&v, false).unwrap().channel.as_deref(), Some("Creator"));
        v["creator"] = json!("");
        v["channel"] = json!("");
        assert_eq!(VideoMeta::from_json(&v, false).unwrap().channel.as_deref(), Some("Uploader"));
        v["uploader"] = Value::Null;
        assert_eq!(VideoMeta::from_json(&v, false).unwrap().channel, None);
    }

    #[test]
    fn empty_strings_become_none_and_missing_title_gets_a_placeholder() {
        let v = json!({"id": "x", "webpage_url_domain": "a.com", "thumbnail": "", "resolution": ""});
        let m = VideoMeta::from_json(&v, false).unwrap();
        assert_eq!(m.thumbnail, None);
        assert_eq!(m.resolution, None);
        assert_eq!(m.title, "Untitled");
    }

    #[test]
    fn rejects_metadata_without_id_or_domain() {
        assert!(VideoMeta::from_json(&json!({"title": "t"}), false).is_none());
        assert!(VideoMeta::from_json(&json!({"id": "x"}), false).is_none());
    }

    #[test]
    fn playlists_read_the_first_entry() {
        let root = json!({
            "_type": "playlist",
            "entries": [
                {
                    "id": "e1", "webpage_url_domain": "youtube.com", "title": "First",
                    "playlist_id": "PL1", "playlist_title": "My List",
                    "playlist_webpage_url": "https://youtube.com/playlist?list=PL1",
                    "playlist_count": 12, "n_entries": 99,
                    "playlist_channel": "PChan", "playlist_uploader": "PUp"
                },
                {"id": "e2", "webpage_url_domain": "youtube.com", "title": "Second"}
            ]
        });
        let m = VideoMeta::from_json(&root, true).unwrap();
        assert_eq!(m.id, "e1");
        assert_eq!(m.title, "First");
        assert_eq!(m.playlist_id.as_deref(), Some("PL1"));
        assert_eq!(m.playlist_title.as_deref(), Some("My List"));
        assert_eq!(m.playlist_url.as_deref(), Some("https://youtube.com/playlist?list=PL1"));
        assert_eq!(m.playlist_n_entries, Some(12), "playlist_count wins over n_entries");
        assert_eq!(m.playlist_channel.as_deref(), Some("PChan"));
        assert_eq!(m.playlist_info_channel.as_deref(), Some("PChan"));
    }

    #[test]
    fn playlist_entry_count_falls_back_to_n_entries() {
        let root = json!({"entries": [{"id": "e", "webpage_url_domain": "a.com", "n_entries": 5}]});
        assert_eq!(VideoMeta::from_json(&root, true).unwrap().playlist_n_entries, Some(5));
    }

    #[test]
    fn empty_playlist_is_rejected() {
        assert!(VideoMeta::from_json(&json!({"entries": []}), true).is_none());
        assert!(VideoMeta::from_json(&json!({}), true).is_none());
    }

    #[test]
    fn video_ids_drop_the_tld() {
        assert_eq!(generate_video_id("abc", "youtube.com"), "youtube_abc");
        assert_eq!(generate_video_id("abc", " www.example.co.uk "), "www_example_co_abc");
        assert_eq!(generate_video_id("abc", "localhost"), "_abc");
    }

    fn settings(video: &str, audio: &str) -> DownloadSettings {
        DownloadSettings {
            video_format: video.into(),
            audio_format: audio.into(),
            ..Default::default()
        }
    }

    #[test]
    fn ext_defaults_to_the_metadata_ext() {
        let cfg = DownloadConfig::default();
        assert_eq!(
            effective_ext(Some("webm"), FileType::VideoAudio, &settings("auto", "auto"), &cfg, None).as_deref(),
            Some("webm")
        );
        assert_eq!(effective_ext(None, FileType::Video, &settings("auto", "auto"), &cfg, None), None);
    }

    #[test]
    fn settings_override_by_file_type() {
        let cfg = DownloadConfig::default();
        let s = settings("mp4", "mp3");
        assert_eq!(effective_ext(Some("webm"), FileType::VideoAudio, &s, &cfg, None).as_deref(), Some("mp4"));
        assert_eq!(effective_ext(Some("webm"), FileType::Video, &s, &cfg, None).as_deref(), Some("mp4"));
        assert_eq!(effective_ext(Some("opus"), FileType::Audio, &s, &cfg, None).as_deref(), Some("mp3"));
        assert_eq!(effective_ext(Some("x"), FileType::Unknown, &s, &cfg, None).as_deref(), Some("x"));
    }

    #[test]
    fn config_then_resume_output_format_win() {
        let s = settings("mp4", "mp3");
        let cfg = DownloadConfig { output_format: Some("mkv".into()), ..Default::default() };
        assert_eq!(effective_ext(Some("webm"), FileType::Video, &s, &cfg, None).as_deref(), Some("mkv"));
        let auto = DownloadConfig { output_format: Some("auto".into()), ..Default::default() };
        assert_eq!(effective_ext(Some("webm"), FileType::Video, &s, &auto, None).as_deref(), Some("mp4"));
        let resume = ResumeState { output_format: Some("flac".into()), ..Default::default() };
        assert_eq!(effective_ext(Some("webm"), FileType::Video, &s, &cfg, Some(&resume)).as_deref(), Some("flac"));
    }

    #[test]
    fn resume_state_mirrors_the_stored_row() {
        use super::super::repo::DownloadRecord;
        let state = DownloadState {
            record: DownloadRecord {
                download_id: "d1".into(),
                video_id: "yt_abc".into(),
                playlist_id: Some("yt_pl".into()),
                playlist_indices: Some("1,2".into()),
                custom_command: Some("--geo-bypass".into()),
                output_format: Some("mkv".into()),
                embed_metadata: 1,
                embed_thumbnail: 0,
                square_crop_thumbnail: 1,
                sponsorblock_remove: Some("sponsor".into()),
                sponsorblock_mark: None,
                use_aria2: 1,
                trim_stamps: Some("5,9".into()),
                ..Default::default()
            },
            ..Default::default()
        };
        let r = resume_from_state(&state);
        assert_eq!(r.download_id.as_deref(), Some("d1"));
        assert_eq!(r.video_id.as_deref(), Some("yt_abc"));
        assert_eq!(r.playlist_id.as_deref(), Some("yt_pl"));
        assert_eq!(r.playlist_indices.as_deref(), Some("1,2"));
        assert_eq!(r.custom_command.as_deref(), Some("--geo-bypass"));
        assert_eq!(r.output_format.as_deref(), Some("mkv"));
        assert!(r.embed_metadata && !r.embed_thumbnail && r.square_crop_thumbnail && r.use_aria2);
        assert_eq!(r.sponsorblock_remove.as_deref(), Some("sponsor"));
        assert_eq!(r.sponsorblock_mark, None);
        assert_eq!(r.trim_stamps.as_deref(), Some("5,9"));
    }
}
