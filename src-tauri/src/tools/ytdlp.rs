//! The yt-dlp version check and self-update. Replaces `src/hooks/use-ytdlp-updater.ts` and the
//! version check in `src/App.tsx`.

use super::{run_to_end, ToolEvents, ToolRunner};
use crate::downloader::manager::LogLevel;
use crate::sidecar::{flatpak_binary, sidecar_path, Program};
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

const SOURCE: &str = "NEODLP";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Platform {
    Windows,
    MacOs,
    Linux,
}

impl Platform {
    pub fn current() -> Self {
        if cfg!(windows) {
            Platform::Windows
        } else if cfg!(target_os = "macos") {
            Platform::MacOs
        } else {
            Platform::Linux
        }
    }
}

/// How the result of an update attempt is reported to the UI.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "status", rename_all = "lowercase")]
pub enum UpdateOutcome {
    Updated { elevated: bool },
    /// yt-dlp ran but the update didn't succeed.
    Failed { message: String },
    /// The update couldn't even be attempted.
    Error { message: String },
}

#[derive(Debug, Clone)]
pub struct UpdaterConfig {
    pub platform: Platform,
    pub flatpak: bool,
    pub exe_dir: PathBuf,
    pub data_dir: PathBuf,
}

/// The command that updates yt-dlp on this platform.
pub fn update_plan(
    platform: Platform,
    flatpak: bool,
    channel: &str,
    data_dir: &Path,
) -> (Program, Vec<String>) {
    match (platform, flatpak) {
        // Flatpak keeps a private, user-writable copy of yt-dlp.
        (Platform::Linux, true) => (
            Program::Path(flatpak_binary(data_dir, "yt-dlp")),
            vec!["--update-to".into(), channel.into()],
        ),
        // A system-wide install needs root.
        (Platform::Linux, false) => (
            Program::System("pkexec"),
            vec!["yt-dlp".into(), "--update-to".into(), channel.into()],
        ),
        _ => (Program::Sidecar("yt-dlp"), vec!["--update-to".into(), channel.into()]),
    }
}

/// Windows fallback: re-run the update with administrator rights (the app may live in a
/// protected folder).
pub fn elevated_plan(exe_dir: &Path, channel: &str) -> (Program, Vec<String>) {
    let exe = sidecar_path(exe_dir, "yt-dlp");
    (
        Program::System("powershell"),
        vec![
            "Start-Process".into(),
            format!("\"{}\"", exe.display()),
            "-ArgumentList".into(),
            format!("\"--update-to {channel}\""),
            "-Verb".into(),
            "RunAs".into(),
            "-Wait".into(),
            "-WindowStyle".into(),
            "Hidden".into(),
        ],
    )
}

struct Inner<R, E> {
    runner: R,
    events: E,
    config: UpdaterConfig,
    busy: AtomicBool,
}

pub struct YtDlp<R, E> {
    inner: Arc<Inner<R, E>>,
}

impl<R, E> Clone for YtDlp<R, E> {
    fn clone(&self) -> Self {
        Self { inner: self.inner.clone() }
    }
}

impl<R: ToolRunner, E: ToolEvents> YtDlp<R, E> {
    pub fn new(runner: R, events: E, config: UpdaterConfig) -> Self {
        Self { inner: Arc::new(Inner { runner, events, config, busy: AtomicBool::new(false) }) }
    }

    pub async fn version(&self) -> Result<String, String> {
        let output = run_to_end(&self.inner.runner, &Program::Sidecar("yt-dlp"), vec!["--version".into()])
            .await
            .map_err(|e| e.to_string())?;
        if output.success {
            Ok(output.stdout.trim().to_string())
        } else {
            Err(output.stderr)
        }
    }

    /// Updates yt-dlp. `Err` only when another update is already running.
    pub async fn update(&self, channel: &str) -> Result<UpdateOutcome, String> {
        let inner = &self.inner;
        if inner.busy.swap(true, Ordering::SeqCst) {
            return Err("A yt-dlp update is already in progress.".into());
        }
        let outcome = self.run_update(channel).await;
        inner.busy.store(false, Ordering::SeqCst);
        Ok(outcome)
    }

    async fn run_update(&self, channel: &str) -> UpdateOutcome {
        let Inner { runner, events, config, .. } = &*self.inner;
        events.log(LogLevel::Info, SOURCE, "Updating yt-dlp to latest version");

        let error = |e: std::io::Error| {
            events.log(LogLevel::Error, SOURCE, &format!("Exception while updating yt-dlp: {e}"));
            UpdateOutcome::Error { message: e.to_string() }
        };

        let (program, args) = update_plan(config.platform, config.flatpak, channel, &config.data_dir);
        let output = match run_to_end(runner, &program, args).await {
            Ok(output) => output,
            Err(e) => return error(e),
        };
        if output.success {
            events.log(LogLevel::Info, SOURCE, "yt-dlp updated successfully");
            return UpdateOutcome::Updated { elevated: false };
        }
        if config.platform != Platform::Windows {
            events.log(LogLevel::Error, SOURCE, &format!("Failed to update yt-dlp: {}", output.stderr));
            return UpdateOutcome::Failed { message: output.stderr };
        }

        events.log(LogLevel::Warning, SOURCE, "yt-dlp update failed! Now, attempting with elevated privileges.");
        let (program, args) = elevated_plan(&config.exe_dir, channel);
        match run_to_end(runner, &program, args).await {
            Ok(output) if output.success => {
                events.log(LogLevel::Info, SOURCE, "yt-dlp updated successfully with elevation");
                UpdateOutcome::Updated { elevated: true }
            }
            Ok(output) => {
                events.log(
                    LogLevel::Error,
                    SOURCE,
                    &format!("Failed to update yt-dlp with elevation: {}", output.stderr),
                );
                UpdateOutcome::Failed { message: output.stderr }
            }
            Err(e) => error(e),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tools::testing::{FakeToolEvents, FakeToolRunner, Script};
    use std::time::Duration;

    fn config(platform: Platform, flatpak: bool) -> UpdaterConfig {
        UpdaterConfig {
            platform,
            flatpak,
            exe_dir: PathBuf::from("/opt/neodlp"),
            data_dir: PathBuf::from("/home/u/.local/share"),
        }
    }

    fn tool(platform: Platform, flatpak: bool) -> (YtDlp<FakeToolRunner, FakeToolEvents>, FakeToolRunner, FakeToolEvents) {
        let runner = FakeToolRunner::default();
        let events = FakeToolEvents::default();
        (YtDlp::new(runner.clone(), events.clone(), config(platform, flatpak)), runner, events)
    }

    fn strs(v: &[&str]) -> Vec<String> {
        v.iter().map(|s| s.to_string()).collect()
    }

    // ---------- plans ----------

    #[test]
    fn windows_and_macos_update_the_bundled_binary() {
        for platform in [Platform::Windows, Platform::MacOs] {
            assert_eq!(
                update_plan(platform, false, "nightly", Path::new("/d")),
                (Program::Sidecar("yt-dlp"), strs(&["--update-to", "nightly"]))
            );
        }
    }

    #[test]
    fn linux_updates_the_system_install_with_elevation() {
        assert_eq!(
            update_plan(Platform::Linux, false, "stable", Path::new("/d")),
            (Program::System("pkexec"), strs(&["yt-dlp", "--update-to", "stable"]))
        );
    }

    #[test]
    fn flatpak_updates_its_own_copy() {
        assert_eq!(
            update_plan(Platform::Linux, true, "nightly", Path::new("/home/u/.local/share")),
            (
                Program::Path(PathBuf::from("/home/u/.local/share/yt-dlp/yt-dlp")),
                strs(&["--update-to", "nightly"])
            )
        );
    }

    #[test]
    fn the_elevated_command_runs_the_bundled_exe_as_administrator() {
        let (program, args) = elevated_plan(Path::new("C:\\Program Files\\NeoDLP"), "nightly");
        assert_eq!(program, Program::System("powershell"));
        let exe = sidecar_path(Path::new("C:\\Program Files\\NeoDLP"), "yt-dlp");
        assert_eq!(
            args,
            vec![
                "Start-Process".to_string(),
                format!("\"{}\"", exe.display()),
                "-ArgumentList".into(),
                "\"--update-to nightly\"".into(),
                "-Verb".into(),
                "RunAs".into(),
                "-Wait".into(),
                "-WindowStyle".into(),
                "Hidden".into(),
            ]
        );
    }

    // ---------- version ----------

    #[tokio::test]
    async fn reads_the_version() {
        let (yt, runner, _) = tool(Platform::Windows, false);
        runner.push(Script::Run { stdout: vec!["2026.10.10.233141 "], stderr: vec![], success: true });
        assert_eq!(yt.version().await.unwrap(), "2026.10.10.233141");
        assert_eq!(runner.spawned(), [(Program::Sidecar("yt-dlp"), strs(&["--version"]))]);
    }

    #[tokio::test]
    async fn a_failing_version_check_reports_stderr() {
        let (yt, runner, _) = tool(Platform::Windows, false);
        runner.push(Script::Run { stdout: vec![], stderr: vec!["broken install"], success: false });
        assert_eq!(yt.version().await.unwrap_err(), "broken install");
    }

    #[tokio::test]
    async fn a_missing_binary_is_a_version_error() {
        let (yt, runner, _) = tool(Platform::Windows, false);
        runner.push(Script::SpawnError("yt-dlp not found"));
        assert!(yt.version().await.unwrap_err().contains("yt-dlp not found"));
    }

    // ---------- update ----------

    #[tokio::test]
    async fn a_successful_update_is_reported() {
        let (yt, runner, events) = tool(Platform::MacOs, false);
        runner.push(Script::Run { stdout: vec!["Updated yt-dlp to nightly@2026.10.10"], stderr: vec![], success: true });
        assert_eq!(yt.update("nightly").await.unwrap(), UpdateOutcome::Updated { elevated: false });
        assert_eq!(runner.spawned(), [(Program::Sidecar("yt-dlp"), strs(&["--update-to", "nightly"]))]);
        assert!(events.has_log(LogLevel::Info, "Updating yt-dlp to latest version"));
        assert!(events.has_log(LogLevel::Info, "yt-dlp updated successfully"));
    }

    #[tokio::test]
    async fn a_failed_update_outside_windows_is_not_retried() {
        let (yt, runner, events) = tool(Platform::Linux, false);
        runner.push(Script::Run { stdout: vec![], stderr: vec!["permission denied"], success: false });
        assert_eq!(
            yt.update("stable").await.unwrap(),
            UpdateOutcome::Failed { message: "permission denied".into() }
        );
        assert_eq!(runner.spawned().len(), 1);
        assert!(events.has_log(LogLevel::Error, "Failed to update yt-dlp: permission denied"));
    }

    #[tokio::test]
    async fn on_windows_a_failure_is_retried_with_elevation() {
        let (yt, runner, events) = tool(Platform::Windows, false);
        runner.push(Script::Run { stdout: vec![], stderr: vec!["access denied"], success: false });
        runner.push(Script::Run { stdout: vec![], stderr: vec![], success: true });
        assert_eq!(yt.update("nightly").await.unwrap(), UpdateOutcome::Updated { elevated: true });

        let spawned = runner.spawned();
        assert_eq!(spawned.len(), 2);
        assert_eq!(spawned[1].0, Program::System("powershell"));
        assert!(events.has_log(LogLevel::Warning, "attempting with elevated privileges"));
        assert!(events.has_log(LogLevel::Info, "updated successfully with elevation"));
    }

    #[tokio::test]
    async fn a_failed_elevated_update_is_a_failure() {
        let (yt, runner, events) = tool(Platform::Windows, false);
        runner.push(Script::Run { stdout: vec![], stderr: vec!["access denied"], success: false });
        runner.push(Script::Run { stdout: vec![], stderr: vec!["cancelled by user"], success: false });
        assert_eq!(
            yt.update("nightly").await.unwrap(),
            UpdateOutcome::Failed { message: "cancelled by user".into() }
        );
        assert!(events.has_log(LogLevel::Error, "Failed to update yt-dlp with elevation: cancelled by user"));
    }

    #[tokio::test]
    async fn a_spawn_failure_is_an_error_outcome() {
        let (yt, runner, events) = tool(Platform::Windows, false);
        runner.push(Script::SpawnError("yt-dlp not found"));
        match yt.update("nightly").await.unwrap() {
            UpdateOutcome::Error { message } => assert!(message.contains("yt-dlp not found"), "{message}"),
            other => panic!("unexpected outcome: {other:?}"),
        }
        assert!(events.has_log(LogLevel::Error, "Exception while updating yt-dlp"));
    }

    #[tokio::test]
    async fn only_one_update_runs_at_a_time() {
        let (yt, runner, _) = tool(Platform::MacOs, false);
        runner.push(Script::Hold);
        let first = tokio::spawn({
            let yt = yt.clone();
            async move { yt.update("nightly").await }
        });
        while runner.pids().is_empty() {
            tokio::time::sleep(Duration::from_millis(5)).await;
        }

        let err = yt.update("nightly").await.unwrap_err();
        assert!(err.contains("already in progress"), "{err}");

        runner.finish(runner.pids()[0], true);
        assert_eq!(first.await.unwrap().unwrap(), UpdateOutcome::Updated { elevated: false });

        // the guard is released afterwards, also after failures
        runner.push(Script::Run { stdout: vec![], stderr: vec![], success: true });
        assert!(yt.update("nightly").await.is_ok());
        runner.push(Script::SpawnError("gone"));
        assert!(matches!(yt.update("nightly").await.unwrap(), UpdateOutcome::Error { .. }));
        runner.push(Script::Run { stdout: vec![], stderr: vec![], success: true });
        assert!(yt.update("nightly").await.is_ok());
    }
}
