//! The production [`Runner`]: yt-dlp, located through the shared [`Launcher`].

use super::manager::{ExitInfo, Runner, Spawned};
use super::process;
use crate::sidecar::{Launcher, Program};
use crate::tools::ToolRunner;
use std::io;
use tokio::process::Command;
use tokio::sync::oneshot;

/// Starts `command` and reports its exit through [`Spawned::exit`].
pub fn spawn_command(command: Command) -> io::Result<Spawned> {
    let (pid, lines, mut child) = process::spawn_streaming(command)?.into_parts();
    let (exit_tx, exit) = oneshot::channel();
    tokio::spawn(async move {
        let info = match child.wait().await {
            Ok(status) => ExitInfo { success: status.success(), code: status.code() },
            Err(e) => {
                log::warn!("Could not wait for process {pid}: {e}");
                ExitInfo { success: false, code: None }
            }
        };
        let _ = exit_tx.send(info);
    });
    Ok(Spawned { pid, lines, exit })
}

#[derive(Clone)]
pub struct SidecarRunner {
    launcher: Launcher,
}

impl SidecarRunner {
    pub fn new(launcher: Launcher) -> Self {
        Self { launcher }
    }
}

impl Runner for SidecarRunner {
    fn spawn(&self, args: Vec<String>) -> io::Result<Spawned> {
        spawn_command(self.launcher.command(&Program::Sidecar("yt-dlp"), args))
    }

    fn kill(&self, pid: u32) {
        if let Err(e) = process::kill_process_tree(pid) {
            log::warn!("Could not kill process {pid}: {e}");
        }
    }
}

impl ToolRunner for SidecarRunner {
    fn spawn(&self, program: &Program, args: Vec<String>) -> io::Result<Spawned> {
        spawn_command(self.launcher.command(program, args))
    }

    fn kill(&self, pid: u32) {
        Runner::kill(self, pid);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The test binary doubles as a real child: `--list` prints test names and exits 0, an unknown
    /// flag makes libtest exit non-zero.
    fn test_binary(arg: &str) -> Command {
        let mut command = Command::new(std::env::current_exe().unwrap());
        command.arg(arg);
        command
    }

    #[tokio::test]
    async fn reports_output_and_a_successful_exit() {
        let mut spawned = spawn_command(test_binary("--list")).unwrap();
        assert!(spawned.pid > 0);
        let mut lines = 0;
        while spawned.lines.recv().await.is_some() {
            lines += 1;
        }
        assert!(lines > 0, "expected the test names on stdout");
        let exit = spawned.exit.await.unwrap();
        assert_eq!(exit, ExitInfo { success: true, code: Some(0) });
    }

    #[tokio::test]
    async fn reports_a_failing_exit_code() {
        let mut spawned = spawn_command(test_binary("--this-flag-does-not-exist")).unwrap();
        while spawned.lines.recv().await.is_some() {}
        let exit = spawned.exit.await.unwrap();
        assert!(!exit.success);
        assert!(exit.code.is_some_and(|c| c != 0));
    }

    #[tokio::test]
    async fn a_missing_binary_is_a_spawn_error() {
        assert!(spawn_command(Command::new("definitely-not-a-real-binary-xyz")).is_err());
    }

    #[tokio::test]
    async fn the_runner_launches_yt_dlp_through_the_launcher() {
        // A launcher pointing at a directory with no yt-dlp must fail to spawn, proving the path
        // really comes from the launcher.
        let missing = std::env::temp_dir().join("neodlp-no-such-dir");
        let runner = SidecarRunner::new(Launcher::new(missing.clone(), missing, false));
        assert!(Runner::spawn(&runner, vec!["--version".into()]).is_err());
    }
}
