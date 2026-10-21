//! The Tauri-facing surface of the helper tools: managed state, UI events and commands.
//!
//! Events:
//! * `pot://state` – `{running, starting, pid}` whenever the PO-token server changes state
//! * `app://log`   – shared log channel (see `downloader::commands`)

use super::pot::{PotServer, PotStatus};
use super::register::{copy_files, linux_files, linux_resource_dir, macos_files};
use super::ytdlp::{Platform, UpdateOutcome, UpdaterConfig, YtDlp};
use super::ToolEvents;
use crate::downloader::commands::{LogEvent, LOG_EVENT};
use crate::downloader::manager::LogLevel;
use crate::downloader::repo::Repo;
use crate::downloader::runner::SidecarRunner;
use crate::sidecar::{is_flatpak, Launcher};
use tauri::{AppHandle, Emitter, Manager, State};

pub const POT_STATE_EVENT: &str = "pot://state";

pub struct TauriToolEvents {
    app: AppHandle,
}

impl ToolEvents for TauriToolEvents {
    fn log(&self, level: LogLevel, source: &str, message: &str) {
        if let Err(e) = self.app.emit(LOG_EVENT, LogEvent { level, source, message }) {
            log::warn!("Could not emit {LOG_EVENT}: {e}");
        }
    }

    fn pot_state(&self, status: &PotStatus) {
        if let Err(e) = self.app.emit(POT_STATE_EVENT, status) {
            log::warn!("Could not emit {POT_STATE_EVENT}: {e}");
        }
    }
}

/// Everything the tools need at runtime; registered as Tauri state.
#[derive(Clone)]
pub struct Tools {
    pub pot: PotServer<SidecarRunner, TauriToolEvents>,
    pub ytdlp: YtDlp<SidecarRunner, TauriToolEvents>,
}

pub fn new_tools(app: AppHandle, launcher: Launcher) -> Tools {
    let config = UpdaterConfig {
        platform: Platform::current(),
        flatpak: launcher.is_flatpak(),
        exe_dir: launcher.exe_dir().to_path_buf(),
        data_dir: launcher.data_dir().to_path_buf(),
    };
    let runner = SidecarRunner::new(launcher);
    Tools {
        pot: PotServer::new(runner.clone(), TauriToolEvents { app: app.clone() }),
        ytdlp: YtDlp::new(runner, TauriToolEvents { app }, config),
    }
}

// Stopping is idempotent: nothing running is not an error, so callers needn't check the status first.
#[tauri::command]
pub async fn stop_pot_server(tools: State<'_, Tools>) -> Result<(), String> {
    tools.pot.shutdown();
    Ok(())
}

/// Reads the saved settings and starts, stops or restarts the server to match them. The backend
/// decides; the frontend only says "settings changed" (after saving them). Async on purpose:
/// starting the server spawns background tasks, which needs the async runtime.
pub async fn sync_pot_server_with(tools: &Tools, repo: &Repo) -> Result<(), String> {
    let settings = repo.load_settings().await.map_err(|e| e.to_string())?;
    tools.pot.apply(&settings).await
}

#[tauri::command]
pub async fn sync_pot_server(tools: State<'_, Tools>, repo: State<'_, Repo>) -> Result<(), String> {
    sync_pot_server_with(&tools, &repo).await
}

#[tauri::command]
pub fn get_pot_status(tools: State<'_, Tools>) -> PotStatus {
    tools.pot.status()
}

#[tauri::command]
pub async fn get_ytdlp_version(tools: State<'_, Tools>) -> Result<String, String> {
    tools.ytdlp.version().await
}

#[tauri::command]
pub async fn update_ytdlp(tools: State<'_, Tools>, channel: String) -> Result<UpdateOutcome, String> {
    tools.ytdlp.update(&channel).await
}

fn app_dirs(app: &AppHandle) -> Result<(std::path::PathBuf, std::path::PathBuf), String> {
    let resources = app.path().resource_dir().map_err(|e| e.to_string())?;
    let home = app.path().home_dir().map_err(|e| e.to_string())?;
    Ok((resources, home))
}

#[tauri::command]
pub async fn register_macos(app: AppHandle) -> Result<(), String> {
    if !cfg!(target_os = "macos") {
        return Err("macOS registration only applies on macOS".into());
    }
    let (resources, home) = app_dirs(&app)?;
    tokio::task::spawn_blocking(move || copy_files(&resources, &home, &macos_files()))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn register_linux(app: AppHandle) -> Result<(), String> {
    if !cfg!(target_os = "linux") {
        return Err("Linux registration only applies on Linux".into());
    }
    let (resources, home) = app_dirs(&app)?;
    let flatpak = is_flatpak();
    let resources = linux_resource_dir(flatpak, &resources);
    tokio::task::spawn_blocking(move || copy_files(&resources, &home, &linux_files(flatpak)))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn the_pot_state_event_has_the_shape_the_frontend_reads() {
        let status = PotStatus { running: true, starting: false, pid: Some(4242) };
        assert_eq!(
            serde_json::to_value(status).unwrap(),
            json!({"running": true, "starting": false, "pid": 4242})
        );
        assert_eq!(
            serde_json::to_value(PotStatus::default()).unwrap(),
            json!({"running": false, "starting": false, "pid": null})
        );
    }

    #[test]
    fn update_outcomes_are_tagged_by_status() {
        assert_eq!(
            serde_json::to_value(UpdateOutcome::Updated { elevated: true }).unwrap(),
            json!({"status": "updated", "elevated": true})
        );
        assert_eq!(
            serde_json::to_value(UpdateOutcome::Failed { message: "denied".into() }).unwrap(),
            json!({"status": "failed", "message": "denied"})
        );
        assert_eq!(
            serde_json::to_value(UpdateOutcome::Error { message: "gone".into() }).unwrap(),
            json!({"status": "error", "message": "gone"})
        );
    }

    #[test]
    fn the_event_name_is_a_valid_tauri_event_name() {
        assert!(POT_STATE_EVENT.chars().all(|c| c.is_ascii_alphanumeric() || "-/:_".contains(c)));
    }
}
