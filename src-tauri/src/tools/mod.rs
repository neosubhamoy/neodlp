//! Helper tools the app runs besides downloading: the PO-token server, the yt-dlp version check and
//! updater, and the per-platform file registration. All process access goes through [`ToolRunner`]
//! so each can be tested without launching anything.

pub mod commands;
#[cfg(test)]
mod e2e_tests;
pub mod pot;
pub mod register;
pub mod ytdlp;

use crate::downloader::manager::{LogLevel, Spawned};
use crate::downloader::process::OutputLine;
use crate::sidecar::Program;
use pot::PotStatus;
use std::io;

pub trait ToolRunner: Send + Sync + 'static {
    fn spawn(&self, program: &Program, args: Vec<String>) -> io::Result<Spawned>;
    /// Like [`spawn`](Self::spawn), for a long-lived background process: the OS also ends it when
    /// the app process disappears by any route (installer exit, crash, killed), not only when the
    /// app shuts down cleanly.
    fn spawn_bound(&self, program: &Program, args: Vec<String>) -> io::Result<Spawned> {
        self.spawn(program, args)
    }
    /// Terminates the process tree; the exit is reported through [`Spawned::exit`].
    fn kill(&self, pid: u32);
}

/// What the tools tell the UI.
pub trait ToolEvents: Send + Sync + 'static {
    fn log(&self, level: LogLevel, source: &str, message: &str);
    fn pot_state(&self, status: &PotStatus);
}

/// Everything a finished process printed, decoded lossily.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Output {
    pub success: bool,
    pub code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
}

/// Runs a program to completion and collects its output.
pub async fn run_to_end<R: ToolRunner>(
    runner: &R,
    program: &Program,
    args: Vec<String>,
) -> io::Result<Output> {
    let mut spawned = runner.spawn(program, args)?;
    let (mut stdout, mut stderr) = (Vec::new(), Vec::new());
    while let Some(line) = spawned.lines.recv().await {
        match line {
            OutputLine::Stdout(l) => stdout.push(l),
            OutputLine::Stderr(l) => stderr.push(l),
        }
    }
    let exit = spawned
        .exit
        .await
        .map_err(|_| io::Error::other("the process ended without reporting an exit status"))?;
    Ok(Output {
        success: exit.success,
        code: exit.code,
        stdout: stdout.join("\n"),
        stderr: stderr.join("\n"),
    })
}

#[cfg(test)]
pub(crate) mod testing {
    use super::*;
    use crate::downloader::manager::ExitInfo;
    use std::collections::{HashMap, VecDeque};
    use std::sync::{Arc, Mutex};
    use tokio::sync::{mpsc, oneshot};

    /// How the fake runner answers the next `spawn`.
    pub enum Script {
        /// Prints these lines and exits at once.
        Run { stdout: Vec<&'static str>, stderr: Vec<&'static str>, success: bool },
        /// Starts a process the test drives with `say` / `say_err` / `finish`.
        Hold,
        /// `spawn` itself fails.
        SpawnError(&'static str),
    }

    struct Proc {
        lines: mpsc::Sender<OutputLine>,
        exit: Option<oneshot::Sender<ExitInfo>>,
    }

    #[derive(Default)]
    struct State {
        next_pid: u32,
        scripts: VecDeque<Script>,
        procs: HashMap<u32, Proc>,
        spawned: Vec<(u32, Program, Vec<String>)>,
        killed: Vec<u32>,
        bound: Vec<u32>,
    }

    #[derive(Clone, Default)]
    pub struct FakeToolRunner(Arc<Mutex<State>>);

    impl FakeToolRunner {
        pub fn push(&self, script: Script) {
            self.0.lock().unwrap().scripts.push_back(script);
        }
        pub fn spawned(&self) -> Vec<(Program, Vec<String>)> {
            self.0.lock().unwrap().spawned.iter().map(|(_, p, a)| (p.clone(), a.clone())).collect()
        }
        pub fn pids(&self) -> Vec<u32> {
            self.0.lock().unwrap().spawned.iter().map(|(pid, _, _)| *pid).collect()
        }
        pub fn killed(&self) -> Vec<u32> {
            self.0.lock().unwrap().killed.clone()
        }
        /// Processes started through `spawn_bound`.
        pub fn bound(&self) -> Vec<u32> {
            self.0.lock().unwrap().bound.clone()
        }
        pub fn say(&self, pid: u32, line: &str) {
            let tx = self.0.lock().unwrap().procs[&pid].lines.clone();
            tx.try_send(OutputLine::Stdout(line.into())).unwrap();
        }
        pub fn say_err(&self, pid: u32, line: &str) {
            let tx = self.0.lock().unwrap().procs[&pid].lines.clone();
            tx.try_send(OutputLine::Stderr(line.into())).unwrap();
        }
        pub fn finish(&self, pid: u32, success: bool) {
            let mut state = self.0.lock().unwrap();
            if let Some(proc) = state.procs.get_mut(&pid) {
                if let Some(exit) = proc.exit.take() {
                    let _ = exit.send(ExitInfo { success, code: Some(if success { 0 } else { 1 }) });
                }
            }
            state.procs.remove(&pid); // closes the line channel, like EOF
        }
    }

    impl ToolRunner for FakeToolRunner {
        fn spawn(&self, program: &Program, args: Vec<String>) -> io::Result<Spawned> {
            let mut state = self.0.lock().unwrap();
            let script = state.scripts.pop_front().expect("unexpected spawn: no script queued");
            if let Script::SpawnError(msg) = script {
                return Err(io::Error::new(io::ErrorKind::NotFound, msg));
            }
            state.next_pid += 1;
            let pid = 5000 + state.next_pid;
            state.spawned.push((pid, program.clone(), args));
            let (lines_tx, lines) = mpsc::channel(256);
            let (exit_tx, exit) = oneshot::channel();
            match script {
                Script::Run { stdout, stderr, success } => {
                    for l in stdout {
                        lines_tx.try_send(OutputLine::Stdout(l.into())).unwrap();
                    }
                    for l in stderr {
                        lines_tx.try_send(OutputLine::Stderr(l.into())).unwrap();
                    }
                    let _ = exit_tx.send(ExitInfo { success, code: Some(if success { 0 } else { 1 }) });
                }
                Script::Hold => {
                    state.procs.insert(pid, Proc { lines: lines_tx, exit: Some(exit_tx) });
                }
                Script::SpawnError(_) => unreachable!(),
            }
            Ok(Spawned { pid, lines, exit })
        }

        fn spawn_bound(&self, program: &Program, args: Vec<String>) -> io::Result<Spawned> {
            let spawned = self.spawn(program, args)?;
            self.0.lock().unwrap().bound.push(spawned.pid);
            Ok(spawned)
        }

        fn kill(&self, pid: u32) {
            self.0.lock().unwrap().killed.push(pid);
            self.finish(pid, false);
        }
    }

    #[derive(Default)]
    struct Log {
        logs: Vec<(LogLevel, String, String)>,
        pot: Vec<PotStatus>,
    }

    #[derive(Clone, Default)]
    pub struct FakeToolEvents(Arc<Mutex<Log>>);

    impl FakeToolEvents {
        pub fn logs(&self) -> Vec<(LogLevel, String, String)> {
            self.0.lock().unwrap().logs.clone()
        }
        pub fn has_log(&self, level: LogLevel, needle: &str) -> bool {
            self.logs().iter().any(|(l, _, m)| *l == level && m.contains(needle))
        }
        pub fn pot_states(&self) -> Vec<PotStatus> {
            self.0.lock().unwrap().pot.clone()
        }
    }

    impl ToolEvents for FakeToolEvents {
        fn log(&self, level: LogLevel, source: &str, message: &str) {
            self.0.lock().unwrap().logs.push((level, source.into(), message.into()));
        }
        fn pot_state(&self, status: &PotStatus) {
            self.0.lock().unwrap().pot.push(status.clone());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::testing::*;
    use super::*;

    #[tokio::test]
    async fn collects_stdout_stderr_and_the_exit_status() {
        let runner = FakeToolRunner::default();
        runner.push(Script::Run {
            stdout: vec!["first", "日本語 café"],
            stderr: vec!["warning"],
            success: true,
        });
        let out = run_to_end(&runner, &Program::System("tool"), vec!["--x".into()]).await.unwrap();
        assert_eq!(
            out,
            Output {
                success: true,
                code: Some(0),
                stdout: "first\n日本語 café".into(),
                stderr: "warning".into()
            }
        );
        assert_eq!(runner.spawned(), [(Program::System("tool"), vec!["--x".to_string()])]);
    }

    #[tokio::test]
    async fn reports_failures() {
        let runner = FakeToolRunner::default();
        runner.push(Script::Run { stdout: vec![], stderr: vec!["boom"], success: false });
        let out = run_to_end(&runner, &Program::System("tool"), vec![]).await.unwrap();
        assert!(!out.success);
        assert_eq!(out.code, Some(1));
        assert_eq!(out.stderr, "boom");
        assert_eq!(out.stdout, "");
    }

    #[tokio::test]
    async fn spawn_errors_propagate() {
        let runner = FakeToolRunner::default();
        runner.push(Script::SpawnError("not found"));
        let err = run_to_end(&runner, &Program::System("tool"), vec![]).await.unwrap_err();
        assert!(err.to_string().contains("not found"));
    }
}
