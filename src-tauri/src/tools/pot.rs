//! The PO-token server (`neodlp-pot`): started on demand, supervised, stopped on request or quit.
//! Replaces `src/hooks/use-pot-server.ts`.

use super::{ToolEvents, ToolRunner};
use crate::downloader::manager::LogLevel;
use crate::downloader::process::OutputLine;
use crate::downloader::settings::DownloadSettings;
use crate::sidecar::Program;
use regex::Regex;
use serde::Serialize;
use std::sync::{Arc, LazyLock, Mutex};
use std::time::Duration;

const SOURCE: &str = "NEODLP POT-SERVER";

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
pub struct PotStatus {
    pub running: bool,
    pub starting: bool,
    pub pid: Option<u32>,
}

static ANSI: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\x1b\[[0-9;]*m").unwrap());
static LOG_PREFIX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^\d{4}-\d{2}-\d{2}T[\d:.]+Z\s+\w+\s+[\w:]+:\s*").unwrap());

/// Strips colour codes and the `tracing` timestamp/level/target prefix from a server log line.
pub fn clean_line(line: &str) -> String {
    let without_colours = ANSI.replace_all(line, "");
    LOG_PREFIX.replace(&without_colours, "").trim().to_string()
}

struct Inner<R, E> {
    runner: R,
    events: E,
    status: Mutex<PotStatus>,
    /// The port of the server that is starting or running; only meaningful while `status` says so.
    port: Mutex<u16>,
}

/// Pause between stopping a server and starting its replacement, so the old one releases the port.
const RESTART_PAUSE: Duration = Duration::from_millis(300);

pub struct PotServer<R, E> {
    inner: Arc<Inner<R, E>>,
}

impl<R, E> Clone for PotServer<R, E> {
    fn clone(&self) -> Self {
        Self { inner: self.inner.clone() }
    }
}

impl<R: ToolRunner, E: ToolEvents> PotServer<R, E> {
    pub fn new(runner: R, events: E) -> Self {
        Self {
            inner: Arc::new(Inner {
                runner,
                events,
                status: Mutex::new(PotStatus::default()),
                port: Mutex::new(0),
            }),
        }
    }

    pub fn status(&self) -> PotStatus {
        self.inner.status.lock().unwrap().clone()
    }

    /// Starts the server unless it is already running or starting. Must run inside the async runtime.
    pub fn start(&self, port: u16) -> Result<(), String> {
        let inner = &self.inner;
        {
            let mut status = inner.status.lock().unwrap();
            if status.pid.is_some() || status.starting {
                drop(status);
                inner.events.log(LogLevel::Warning, SOURCE, "POT Server is already running or starting.");
                return Ok(());
            }
            status.starting = true;
            *inner.port.lock().unwrap() = port;
            inner.events.pot_state(&status);
        }
        inner.events.log(LogLevel::Info, SOURCE, &format!("Starting POT Server on port: {port}"));

        let args = vec!["server".to_string(), "--port".into(), port.to_string()];
        let spawned = match inner.runner.spawn_bound(&Program::Sidecar("neodlp-pot"), args) {
            Ok(spawned) => spawned,
            Err(e) => {
                let message = format!("Error starting POT Server: {e}");
                inner.events.log(LogLevel::Error, SOURCE, &message);
                self.set_status(PotStatus::default());
                return Err(message);
            }
        };

        let pid = spawned.pid;
        self.set_status(PotStatus { running: false, starting: false, pid: Some(pid) });
        let server = self.clone();
        tokio::spawn(async move { server.supervise(pid, spawned).await });
        Ok(())
    }

    /// Makes the server match the saved settings: running on the configured port when PO tokens are
    /// on (and custom commands, which replace PO tokens, are off), stopped otherwise. Safe to call
    /// at any time, so launch, the settings page and a reset all go through here and nobody has to
    /// know the current state. A start failure is logged and returned.
    pub async fn apply(&self, settings: &DownloadSettings) -> Result<(), String> {
        let wanted = (settings.use_potoken && !settings.use_custom_commands).then_some(settings.pot_server_port);
        let active = {
            let status = self.inner.status.lock().unwrap();
            (status.pid.is_some() || status.starting).then(|| *self.inner.port.lock().unwrap())
        };
        match (wanted, active) {
            (Some(wanted), Some(active)) if wanted == active => Ok(()),
            (Some(wanted), Some(_)) => {
                self.shutdown();
                tokio::time::sleep(RESTART_PAUSE).await;
                self.start(wanted)
            }
            (Some(wanted), None) => self.start(wanted),
            (None, Some(_)) => {
                self.shutdown();
                Ok(())
            }
            (None, None) => Ok(()),
        }
    }

    /// For app quit: stops the server if it is running, without complaining when it isn't.
    /// (Child processes aren't killed with their parent, so this prevents an orphaned server.)
    pub fn shutdown(&self) {
        if self.status().pid.is_some() {
            self.stop();
        }
    }

    /// Stops the server if it is running. Safe to call when it isn't.
    pub fn stop(&self) {
        let inner = &self.inner;
        let Some(pid) = self.status().pid else {
            inner.events.log(LogLevel::Warning, SOURCE, "No POT Server process found to stop.");
            return;
        };
        inner.events.log(LogLevel::Info, SOURCE, &format!("Stopping POT Server with PID: {pid}"));
        // Clear the status first: the exit is reported asynchronously and by then a new server
        // may already be running (the supervisor only resets the status it started).
        self.set_status(PotStatus::default());
        inner.runner.kill(pid);
    }

    fn set_status(&self, status: PotStatus) {
        let mut current = self.inner.status.lock().unwrap();
        *current = status;
        self.inner.events.pot_state(&current);
    }

    async fn supervise(&self, pid: u32, mut spawned: crate::downloader::manager::Spawned) {
        let events = &self.inner.events;
        while let Some(line) = spawned.lines.recv().await {
            match line {
                OutputLine::Stdout(raw) => {
                    let line = clean_line(&raw);
                    if line.is_empty() {
                        continue;
                    }
                    events.log(LogLevel::Info, SOURCE, &line);
                    if line.starts_with("POT server") {
                        let mut status = self.inner.status.lock().unwrap();
                        if status.pid == Some(pid) && !status.running {
                            status.running = true;
                            events.pot_state(&status);
                        }
                    }
                }
                OutputLine::Stderr(raw) => {
                    let line = clean_line(&raw);
                    if !line.is_empty() {
                        events.log(LogLevel::Error, SOURCE, &line);
                    }
                }
            }
        }

        match spawned.exit.await {
            Ok(exit) if exit.success => {
                events.log(LogLevel::Info, SOURCE, "POT Server process exited with code: 0");
            }
            exit => {
                let code = exit.ok().and_then(|e| e.code).map_or("unknown".to_string(), |c| c.to_string());
                events.log(
                    LogLevel::Error,
                    SOURCE,
                    &format!("POT Server process exited with code: {code} (ignore if you manually stopped the server)"),
                );
            }
        }

        let mut status = self.inner.status.lock().unwrap();
        if status.pid == Some(pid) {
            *status = PotStatus::default();
            events.pot_state(&status);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tools::testing::{FakeToolEvents, FakeToolRunner, Script};
    use std::time::Duration;

    fn server() -> (PotServer<FakeToolRunner, FakeToolEvents>, FakeToolRunner, FakeToolEvents) {
        let runner = FakeToolRunner::default();
        let events = FakeToolEvents::default();
        (PotServer::new(runner.clone(), events.clone()), runner, events)
    }

    async fn eventually(what: &str, mut check: impl FnMut() -> bool) {
        let ok = tokio::time::timeout(Duration::from_secs(5), async {
            while !check() {
                tokio::time::sleep(Duration::from_millis(5)).await;
            }
        })
        .await;
        assert!(ok.is_ok(), "timed out waiting for: {what}");
    }

    // ---------- log cleaning ----------

    #[test]
    fn strips_ansi_colours() {
        assert_eq!(clean_line("\x1b[32mPOT server\x1b[0m listening"), "POT server listening");
        assert_eq!(clean_line("\x1b[1;31mError\x1b[0m"), "Error");
    }

    #[test]
    fn strips_the_tracing_prefix() {
        assert_eq!(
            clean_line("2026-10-20T12:34:56.789012Z  INFO neodlp_pot::server: POT server started on port 4416"),
            "POT server started on port 4416"
        );
    }

    #[test]
    fn strips_both_and_trims() {
        let line = "\x1b[2m2026-10-20T12:34:56Z\x1b[0m \x1b[32m INFO\x1b[0m neodlp_pot: ready  \r";
        assert_eq!(clean_line(line), "ready");
    }

    #[test]
    fn leaves_plain_lines_alone() {
        assert_eq!(clean_line("  hello 日本語 café  "), "hello 日本語 café");
        assert_eq!(clean_line(""), "");
    }

    // ---------- lifecycle ----------

    #[tokio::test]
    async fn starts_the_sidecar_with_the_port() {
        let (pot, runner, events) = server();
        runner.push(Script::Hold);
        pot.start(4416).unwrap();

        assert_eq!(
            runner.spawned(),
            [(
                Program::Sidecar("neodlp-pot"),
                vec!["server".to_string(), "--port".into(), "4416".into()]
            )]
        );
        let pid = runner.pids()[0];
        assert_eq!(pot.status(), PotStatus { running: false, starting: false, pid: Some(pid) });
        // starting was announced first, then the pid
        let states = events.pot_states();
        assert_eq!(states.first(), Some(&PotStatus { running: false, starting: true, pid: None }));
        assert_eq!(states.last(), Some(&pot.status()));
        assert!(events.has_log(LogLevel::Info, "Starting POT Server on port: 4416"));
    }

    #[tokio::test]
    async fn becomes_running_when_the_server_announces_itself() {
        let (pot, runner, events) = server();
        runner.push(Script::Hold);
        pot.start(4416).unwrap();
        let pid = runner.pids()[0];

        runner.say(pid, "2026-10-20T12:00:00.1Z  INFO neodlp_pot: loading");
        runner.say(pid, "\x1b[32m2026-10-20T12:00:01Z  INFO neodlp_pot::server: POT server listening on 4416\x1b[0m");
        eventually("running", || pot.status().running).await;

        assert!(events.has_log(LogLevel::Info, "POT server listening on 4416"));
        assert!(events.logs().iter().any(|(_, source, msg)| source == SOURCE && msg == "loading"));
        assert_eq!(pot.status(), PotStatus { running: true, starting: false, pid: Some(pid) });
    }

    #[tokio::test]
    async fn stderr_is_logged_as_errors_and_blank_lines_are_skipped() {
        let (pot, runner, events) = server();
        runner.push(Script::Hold);
        pot.start(4416).unwrap();
        let pid = runner.pids()[0];
        runner.say_err(pid, "something broke");
        runner.say(pid, "   ");
        runner.say(pid, "POT server up");
        eventually("running", || pot.status().running).await;
        assert!(events.has_log(LogLevel::Error, "something broke"));
        assert!(!events.logs().iter().any(|(_, _, m)| m.trim().is_empty()));
    }

    #[tokio::test]
    async fn resets_when_the_process_exits() {
        let (pot, runner, events) = server();
        runner.push(Script::Hold);
        pot.start(4416).unwrap();
        let pid = runner.pids()[0];
        runner.say(pid, "POT server up");
        eventually("running", || pot.status().running).await;

        runner.finish(pid, true);
        eventually("reset", || pot.status() == PotStatus::default()).await;
        assert!(events.has_log(LogLevel::Info, "exited with code: 0"));
        assert_eq!(events.pot_states().last(), Some(&PotStatus::default()));
    }

    #[tokio::test]
    async fn a_crash_is_logged_as_an_error() {
        let (pot, runner, events) = server();
        runner.push(Script::Hold);
        pot.start(4416).unwrap();
        runner.finish(runner.pids()[0], false);
        eventually("reset", || pot.status() == PotStatus::default()).await;
        assert!(events.has_log(LogLevel::Error, "exited with code: 1 (ignore if you manually stopped the server)"));
    }

    #[tokio::test]
    async fn stop_kills_the_process_and_clears_the_status_at_once() {
        let (pot, runner, events) = server();
        runner.push(Script::Hold);
        pot.start(4416).unwrap();
        let pid = runner.pids()[0];
        runner.say(pid, "POT server up");
        eventually("running", || pot.status().running).await;

        pot.stop();
        assert_eq!(runner.killed(), [pid]);
        assert_eq!(pot.status(), PotStatus::default());
        assert!(events.has_log(LogLevel::Info, &format!("Stopping POT Server with PID: {pid}")));
    }

    #[tokio::test]
    async fn stopping_when_nothing_runs_only_warns() {
        let (pot, runner, events) = server();
        pot.stop();
        assert!(runner.killed().is_empty());
        assert!(events.has_log(LogLevel::Warning, "No POT Server process found to stop."));
    }

    #[tokio::test]
    async fn starting_twice_does_not_spawn_twice() {
        let (pot, runner, events) = server();
        runner.push(Script::Hold);
        pot.start(4416).unwrap();
        pot.start(4416).unwrap();
        assert_eq!(runner.spawned().len(), 1);
        assert!(events.has_log(LogLevel::Warning, "already"));
    }

    #[tokio::test]
    async fn a_spawn_failure_is_reported_and_leaves_the_server_startable() {
        let (pot, runner, events) = server();
        runner.push(Script::SpawnError("neodlp-pot not found"));
        let err = pot.start(4416).unwrap_err();
        assert!(err.contains("neodlp-pot not found"), "{err}");
        assert_eq!(pot.status(), PotStatus::default());
        assert!(events.has_log(LogLevel::Error, "Error starting POT Server"));

        runner.push(Script::Hold);
        pot.start(4416).unwrap();
        assert!(pot.status().pid.is_some());
    }

    #[tokio::test]
    async fn an_old_process_exiting_does_not_clobber_a_restarted_server() {
        let (pot, runner, _events) = server();
        runner.push(Script::Hold);
        pot.start(4416).unwrap();
        let old = runner.pids()[0];
        pot.stop();

        runner.push(Script::Hold);
        pot.start(4417).unwrap();
        let new = runner.pids()[1];
        assert_ne!(old, new);
        runner.say(new, "POT server up");
        eventually("new server running", || pot.status().running).await;

        // The old process only now reports its exit (the kill above was asynchronous).
        runner.finish(old, false);
        tokio::time::sleep(Duration::from_millis(100)).await;
        assert_eq!(pot.status(), PotStatus { running: true, starting: false, pid: Some(new) });
    }

    // ---------- settings drive the server ----------

    fn settings(use_potoken: bool, port: u16, use_custom_commands: bool) -> DownloadSettings {
        DownloadSettings { use_potoken, pot_server_port: port, use_custom_commands, ..Default::default() }
    }

    fn port_arg(args: &[String]) -> &str {
        &args[args.iter().position(|a| a == "--port").unwrap() + 1]
    }

    #[tokio::test]
    async fn enabled_settings_start_the_server_on_the_configured_port() {
        let (pot, runner, _) = server();
        runner.push(Script::Hold);
        pot.apply(&settings(true, 5555, false)).await.unwrap();
        assert_eq!(runner.spawned()[0].1, vec!["server".to_string(), "--port".into(), "5555".into()]);
    }

    #[tokio::test]
    async fn disabled_settings_start_nothing() {
        let (pot, runner, _) = server();
        pot.apply(&settings(false, 4416, false)).await.unwrap();
        assert!(runner.spawned().is_empty());
    }

    #[tokio::test]
    async fn custom_commands_keep_the_server_off() {
        let (pot, runner, _) = server();
        pot.apply(&settings(true, 4416, true)).await.unwrap();
        assert!(runner.spawned().is_empty());

        // ...and turning them on stops a server that was already running.
        runner.push(Script::Hold);
        pot.apply(&settings(true, 4416, false)).await.unwrap();
        let pid = runner.pids()[0];
        pot.apply(&settings(true, 4416, true)).await.unwrap();
        assert_eq!(runner.killed(), [pid]);
        assert_eq!(pot.status(), PotStatus::default());
    }

    #[tokio::test]
    async fn applying_the_same_settings_again_keeps_the_running_server() {
        let (pot, runner, _) = server();
        runner.push(Script::Hold);
        pot.apply(&settings(true, 4416, false)).await.unwrap();
        pot.apply(&settings(true, 4416, false)).await.unwrap();
        assert_eq!(runner.spawned().len(), 1);
        assert!(runner.killed().is_empty());
    }

    #[tokio::test]
    async fn a_changed_port_restarts_the_server() {
        let (pot, runner, _) = server();
        runner.push(Script::Hold);
        pot.apply(&settings(true, 4416, false)).await.unwrap();
        let old = runner.pids()[0];

        runner.push(Script::Hold);
        pot.apply(&settings(true, 5555, false)).await.unwrap();

        assert_eq!(runner.killed(), [old]);
        let spawned = runner.spawned();
        assert_eq!(spawned.len(), 2);
        assert_eq!(port_arg(&spawned[1].1), "5555");
        assert_eq!(pot.status().pid, Some(runner.pids()[1]));
    }

    #[tokio::test]
    async fn turning_the_setting_off_stops_the_server() {
        let (pot, runner, _) = server();
        runner.push(Script::Hold);
        pot.apply(&settings(true, 4416, false)).await.unwrap();
        let pid = runner.pids()[0];

        pot.apply(&settings(false, 4416, false)).await.unwrap();
        assert_eq!(runner.killed(), [pid]);
        assert_eq!(pot.status(), PotStatus::default());
    }

    #[tokio::test]
    async fn a_crashed_server_is_started_again_by_the_next_apply() {
        let (pot, runner, _) = server();
        runner.push(Script::Hold);
        pot.apply(&settings(true, 4416, false)).await.unwrap();
        runner.finish(runner.pids()[0], false);
        eventually("reset", || pot.status() == PotStatus::default()).await;

        runner.push(Script::Hold);
        pot.apply(&settings(true, 4416, false)).await.unwrap();
        assert_eq!(runner.spawned().len(), 2);
    }

    #[tokio::test]
    async fn apply_reports_a_spawn_failure() {
        let (pot, runner, _) = server();
        runner.push(Script::SpawnError("neodlp-pot not found"));
        let err = pot.apply(&settings(true, 4416, false)).await.unwrap_err();
        assert!(err.contains("neodlp-pot not found"), "{err}");
    }

    // ---------- quit ----------

    #[tokio::test]
    async fn the_server_is_tied_to_the_apps_lifetime() {
        // If the app dies without cleaning up (installer exit, crash, killed), the OS must take
        // the server down with it.
        let (pot, runner, _) = server();
        runner.push(Script::Hold);
        pot.start(4416).unwrap();
        assert_eq!(runner.bound(), runner.pids());
    }

    #[tokio::test]
    async fn shutdown_stops_a_running_server_quietly() {
        let (pot, runner, _events) = server();
        runner.push(Script::Hold);
        pot.start(4416).unwrap();
        let pid = runner.pids()[0];

        pot.shutdown();
        assert_eq!(runner.killed(), [pid]);
        assert_eq!(pot.status(), PotStatus::default());
    }

    #[tokio::test]
    async fn shutdown_without_a_server_does_nothing_and_says_nothing() {
        let (pot, runner, events) = server();
        pot.shutdown();
        assert!(runner.killed().is_empty());
        assert!(events.logs().is_empty(), "{:?}", events.logs());
    }
}
