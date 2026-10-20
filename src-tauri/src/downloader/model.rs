//! Plain data types shared by the downloader modules. Field names match the existing TS types
//! (`src/types/settings.ts`, `src/types/download.ts`) so they cross the IPC boundary unchanged.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FileType {
    #[serde(rename = "video+audio")]
    VideoAudio,
    #[serde(rename = "video")]
    Video,
    #[serde(rename = "audio")]
    Audio,
    #[serde(rename = "unknown")]
    Unknown,
}

impl FileType {
    pub fn as_str(self) -> &'static str {
        match self {
            FileType::VideoAudio => "video+audio",
            FileType::Video => "video",
            FileType::Audio => "audio",
            FileType::Unknown => "unknown",
        }
    }

    /// Mirrors `determineFileType` in `src/lib/utils.ts`.
    pub fn from_codecs(vcodec: Option<&str>, acodec: Option<&str>) -> Self {
        fn present(codec: Option<&str>) -> bool {
            let codec = codec.unwrap_or("").to_lowercase();
            !["none", "auto", "n/a", "-", ""].contains(&codec.as_str())
        }
        match (present(vcodec), present(acodec)) {
            (true, true) => FileType::VideoAudio,
            (true, false) => FileType::Video,
            (false, true) => FileType::Audio,
            (false, false) => FileType::Unknown,
        }
    }
}

/// Per-download options chosen in the UI (`DownloadConfiguration` in TS).
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct DownloadConfig {
    pub output_format: Option<String>,
    pub embed_metadata: Option<bool>,
    pub embed_thumbnail: Option<bool>,
    pub square_crop_thumbnail: Option<bool>,
    pub sponsorblock: Option<String>,
    /// Id of one of `DownloadSettings::custom_commands`.
    pub custom_command: Option<String>,
    /// `[start, end]` in seconds.
    pub trim_stamps: Option<Vec<f64>>,
}

/// What was persisted for a paused/queued download, so a resume reproduces the original options.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct ResumeState {
    pub download_id: Option<String>,
    pub video_id: Option<String>,
    pub playlist_id: Option<String>,
    pub playlist_indices: Option<String>,
    /// The resolved custom-command argument string (not an id).
    pub custom_command: Option<String>,
    pub output_format: Option<String>,
    pub embed_metadata: bool,
    pub embed_thumbnail: bool,
    pub square_crop_thumbnail: bool,
    pub sponsorblock_remove: Option<String>,
    pub sponsorblock_mark: Option<String>,
    pub use_aria2: bool,
    /// `"start,end"`
    pub trim_stamps: Option<String>,
}
