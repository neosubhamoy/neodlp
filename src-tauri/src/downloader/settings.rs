//! The subset of app settings that influences yt-dlp arguments (`Settings` in `src/types/settings.ts`).

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct CustomCommand {
    pub id: String,
    pub label: String,
    pub args: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct DownloadSettings {
    pub max_parallel_downloads: u32,
    pub max_retries: u32,
    pub prefer_video_over_playlist: bool,
    pub strict_downloadablity_check: bool,
    pub use_proxy: bool,
    pub proxy_url: String,
    pub use_rate_limit: bool,
    pub rate_limit: f64,
    pub video_format: String,
    pub audio_format: String,
    pub always_reencode_video: bool,
    pub embed_video_metadata: bool,
    pub embed_audio_metadata: bool,
    pub embed_video_thumbnail: bool,
    pub embed_audio_thumbnail: bool,
    pub use_cookies: bool,
    pub import_cookies_from: String,
    pub cookies_browser: String,
    pub cookies_file: String,
    pub use_sponsorblock: bool,
    pub sponsorblock_mode: String,
    pub sponsorblock_remove: String,
    pub sponsorblock_mark: String,
    pub sponsorblock_remove_categories: Vec<String>,
    pub sponsorblock_mark_categories: Vec<String>,
    pub use_aria2: bool,
    pub use_force_internet_protocol: bool,
    pub force_internet_protocol: String,
    pub use_custom_commands: bool,
    pub custom_commands: Vec<CustomCommand>,
    pub filename_template: String,
    pub debug_mode: bool,
    pub log_verbose: bool,
    pub log_progress: bool,
    pub use_delay: bool,
    pub use_search_delay: bool,
    pub delay_mode: String,
    pub min_sleep_interval: f64,
    pub max_sleep_interval: f64,
    pub request_sleep_interval: f64,
    pub delay_playlist_only: bool,
    pub use_potoken: bool,
    pub disable_innertube: bool,
    pub pot_server_port: u16,
    pub windows_filenames: bool,
    pub restrict_filenames: bool,
    pub unique_filenames: bool,
}

impl DownloadSettings {
    /// Builds settings from the unwrapped `settings` table rows. A value of the wrong type only
    /// loses that one key (it keeps its default) instead of discarding every setting.
    pub fn from_map(stored: &serde_json::Map<String, serde_json::Value>) -> Self {
        let mut merged = serde_json::to_value(Self::default())
            .ok()
            .and_then(|v| v.as_object().cloned())
            .unwrap_or_default();

        for (key, value) in stored {
            if !merged.contains_key(key) {
                continue; // not a download setting (theme, websocket_port, ...)
            }
            let mut candidate = merged.clone();
            candidate.insert(key.clone(), value.clone());
            if serde_json::from_value::<Self>(serde_json::Value::Object(candidate.clone())).is_ok() {
                merged = candidate;
            } else {
                log::warn!("Ignoring invalid value for setting '{key}'");
            }
        }
        serde_json::from_value(serde_json::Value::Object(merged)).unwrap_or_default()
    }
}

impl Default for DownloadSettings {
    fn default() -> Self {
        Self {
            max_parallel_downloads: 2,
            max_retries: 5,
            prefer_video_over_playlist: true,
            strict_downloadablity_check: false,
            use_proxy: false,
            proxy_url: String::new(),
            use_rate_limit: false,
            rate_limit: 1_048_576.0,
            video_format: "auto".into(),
            audio_format: "auto".into(),
            always_reencode_video: false,
            embed_video_metadata: false,
            embed_audio_metadata: false,
            embed_video_thumbnail: false,
            embed_audio_thumbnail: false,
            use_cookies: false,
            import_cookies_from: "browser".into(),
            cookies_browser: "firefox".into(),
            cookies_file: String::new(),
            use_sponsorblock: false,
            sponsorblock_mode: "remove".into(),
            sponsorblock_remove: "default".into(),
            sponsorblock_mark: "default".into(),
            sponsorblock_remove_categories: Vec::new(),
            sponsorblock_mark_categories: Vec::new(),
            use_aria2: false,
            use_force_internet_protocol: false,
            force_internet_protocol: "ipv4".into(),
            use_custom_commands: false,
            custom_commands: Vec::new(),
            filename_template: "%(title|Untitled)s_%(resolution|unknown)s".into(),
            debug_mode: false,
            log_verbose: true,
            log_progress: false,
            use_delay: true,
            use_search_delay: false,
            delay_mode: "auto".into(),
            min_sleep_interval: 10.0,
            max_sleep_interval: 20.0,
            request_sleep_interval: 1.0,
            delay_playlist_only: true,
            use_potoken: false,
            disable_innertube: false,
            pot_server_port: 4416,
            windows_filenames: true,
            restrict_filenames: true,
            unique_filenames: true,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{json, Map, Value};

    fn map(v: Value) -> Map<String, Value> {
        v.as_object().unwrap().clone()
    }

    #[test]
    fn from_map_applies_known_keys_and_defaults_the_rest() {
        let s = DownloadSettings::from_map(&map(json!({
            "max_parallel_downloads": 4,
            "proxy_url": "http://p:1",
            "custom_commands": [{"id": "c", "label": "L", "args": "--x"}],
            "theme": "dark",
            "websocket_port": 53511
        })));
        assert_eq!(s.max_parallel_downloads, 4);
        assert_eq!(s.proxy_url, "http://p:1");
        assert_eq!(s.custom_commands[0].id, "c");
        assert_eq!(s.max_retries, 5, "unspecified keys keep their default");
    }

    #[test]
    fn from_map_skips_only_the_bad_keys() {
        let s = DownloadSettings::from_map(&map(json!({
            "max_retries": "not a number",
            "rate_limit": null,
            "use_proxy": true,
            "proxy_url": "http://ok"
        })));
        assert_eq!(s.max_retries, 5);
        assert!(s.use_proxy);
        assert_eq!(s.proxy_url, "http://ok");
    }

    #[test]
    fn from_empty_map_is_default() {
        let s = DownloadSettings::from_map(&Map::new());
        assert_eq!(s.max_parallel_downloads, 2);
        assert!(!s.log_progress);
    }
}
