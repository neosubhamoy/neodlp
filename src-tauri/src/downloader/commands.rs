//! The Tauri-facing surface of the downloader: managed state, UI events and `#[tauri::command]`s.
//!
//! Events (all payloads are JSON):
//! * `download://state`    – a full `DownloadState` row, whenever a download changes status
//! * `download://progress` – `{download_id, status, item, progress, speed, downloaded, total, eta}`
//! * `download://removed`  – `{download_id}`
//! * `app://log`           – `{level, source, message}` with level `info|warning|error|progress`;
//!   shared by the downloader and the helper tools

use super::manager::{
    Events, LogLevel, Manager, MetadataParams, Paths, ProgressEvent, StartParams,
};
use super::repo::{DownloadState, Repo};
use super::runner::SidecarRunner;
use crate::sidecar::Launcher;
use serde::Serialize;
use serde_json::Value;
use sqlx::SqlitePool;
use tauri::{AppHandle, Emitter, State};

pub const STATE_EVENT: &str = "download://state";
pub const PROGRESS_EVENT: &str = "download://progress";
pub const REMOVED_EVENT: &str = "download://removed";
pub const LOG_EVENT: &str = "app://log";

pub type AppManager = Manager<SidecarRunner, TauriEvents>;

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct RemovedEvent<'a> {
    pub download_id: &'a str,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct LogEvent<'a> {
    pub level: LogLevel,
    pub source: &'a str,
    pub message: &'a str,
}

/// Forwards download events to the webview.
pub struct TauriEvents {
    app: AppHandle,
}

impl TauriEvents {
    fn emit<S: Serialize + Clone>(&self, event: &str, payload: S) {
        if let Err(e) = self.app.emit(event, payload) {
            log::warn!("Could not emit {event}: {e}");
        }
    }
}

impl Events for TauriEvents {
    fn state(&self, state: &DownloadState) {
        self.emit(STATE_EVENT, state);
    }

    fn progress(&self, event: &ProgressEvent) {
        self.emit(PROGRESS_EVENT, event);
    }

    fn removed(&self, download_id: &str) {
        self.emit(REMOVED_EVENT, RemovedEvent { download_id });
    }

    fn log(&self, level: LogLevel, source: &str, message: &str) {
        self.emit(LOG_EVENT, LogEvent { level, source, message });
    }
}

/// Builds the manager for the running app. `pool` may be lazy: nothing touches the database until
/// the first command.
pub fn new_app_manager(app: AppHandle, launcher: Launcher, pool: SqlitePool) -> AppManager {
    Manager::new(
        Repo::new(pool),
        SidecarRunner::new(launcher),
        TauriEvents { app },
        cfg!(target_os = "macos"),
    )
}

#[tauri::command]
pub async fn fetch_video_metadata(
    manager: State<'_, AppManager>,
    params: MetadataParams,
) -> Result<Value, String> {
    manager.fetch_video_metadata(params).await
}

#[tauri::command]
pub fn cancel_metadata_fetch(manager: State<'_, AppManager>) {
    manager.cancel_metadata_fetch();
}

#[tauri::command]
pub async fn start_download(
    manager: State<'_, AppManager>,
    params: StartParams,
) -> Result<String, String> {
    manager.start_download(params).await
}

#[tauri::command]
pub async fn pause_download(manager: State<'_, AppManager>, download_id: String) -> Result<(), String> {
    manager.pause_download(&download_id).await
}

#[tauri::command]
pub async fn resume_download(manager: State<'_, AppManager>, download_id: String) -> Result<(), String> {
    manager.resume_download(&download_id).await
}

/// Cancels a running download, or deletes a stored one (queued, paused, errored, completed).
#[tauri::command]
pub async fn cancel_download(manager: State<'_, AppManager>, download_id: String) -> Result<(), String> {
    manager.cancel_download(&download_id).await
}

#[tauri::command]
pub async fn list_download_states(manager: State<'_, AppManager>) -> Result<Vec<DownloadState>, String> {
    manager.list_states().await
}

/// Where yt-dlp keeps partial files and puts finished ones.
// Async on purpose: it starts background work, which needs the async runtime.
#[tauri::command]
pub async fn set_download_paths(manager: State<'_, AppManager>, temp_dir: String, download_dir: String) -> Result<(), String> {
    manager.set_paths(Paths { temp_dir, download_dir });
    Ok(())
}

/// Pauses every download; called before the app quits.
#[tauri::command]
pub async fn shutdown_downloads(manager: State<'_, AppManager>) -> Result<(), String> {
    manager.shutdown().await;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn event_names_are_valid_tauri_event_names() {
        for name in [STATE_EVENT, PROGRESS_EVENT, REMOVED_EVENT, LOG_EVENT] {
            assert!(
                name.chars().all(|c| c.is_ascii_alphanumeric() || "-/:_".contains(c)),
                "{name}"
            );
        }
    }

    #[test]
    fn log_events_use_lowercase_levels() {
        for (level, expected) in [
            (LogLevel::Info, "info"),
            (LogLevel::Warning, "warning"),
            (LogLevel::Error, "error"),
            (LogLevel::Progress, "progress"),
        ] {
            let value = serde_json::to_value(LogEvent { level, source: "NEODLP", message: "m" }).unwrap();
            assert_eq!(value, json!({"level": expected, "source": "NEODLP", "message": "m"}));
        }
    }

    #[test]
    fn removed_and_progress_payload_shapes() {
        assert_eq!(
            serde_json::to_value(RemovedEvent { download_id: "d1" }).unwrap(),
            json!({"download_id": "d1"})
        );
        let progress = ProgressEvent {
            download_id: "d1".into(),
            status: Some("downloading".into()),
            item: Some("1/2".into()),
            progress: Some(50.5),
            speed: None,
            downloaded: Some(10),
            total: Some(20),
            eta: Some(3),
            frame: Some(120),
            fps: Some(30.5),
        };
        assert_eq!(
            serde_json::to_value(progress).unwrap(),
            json!({
                "download_id": "d1", "status": "downloading", "item": "1/2", "progress": 50.5,
                "speed": null, "downloaded": 10, "total": 20, "eta": 3, "frame": 120, "fps": 30.5
            })
        );
    }

    #[test]
    fn a_download_state_serializes_flat_like_the_old_ts_type() {
        let mut state = DownloadState::default();
        state.record.download_id = "d1".into();
        state.record.download_status = "queued".into();
        state.title = "日本語".into();
        let value = serde_json::to_value(&state).unwrap();
        assert_eq!(value["download_id"], "d1");
        assert_eq!(value["download_status"], "queued");
        assert_eq!(value["title"], "日本語");
        assert!(value.get("record").is_none(), "the record must be flattened");
        assert!(value.get("playlist_title").is_some());
    }

    #[test]
    fn start_params_accept_the_frontend_shape() {
        let params: StartParams = serde_json::from_value(json!({
            "url": "https://x/v",
            "selectedFormat": "137+140",
            "downloadConfig": {
                "output_format": "mkv", "embed_metadata": true, "embed_thumbnail": null,
                "square_crop_thumbnail": null, "sponsorblock": null, "custom_command": null,
                "trim_stamps": [1.5, 20]
            },
            "selectedSubtitles": "en",
            "playlistItems": "1,2",
            "overrideTbr": 256.0,
            "overrideFilesize": 1000
        }))
        .unwrap();
        assert_eq!(params.selected_format, "137+140");
        assert_eq!(params.download_config.output_format.as_deref(), Some("mkv"));
        assert_eq!(params.download_config.trim_stamps, Some(vec![1.5, 20.0]));
        assert_eq!(params.playlist_items.as_deref(), Some("1,2"));
        assert_eq!(params.override_filesize, Some(1000));
    }
}
