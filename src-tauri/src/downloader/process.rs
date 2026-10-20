//! Spawning child processes (yt-dlp & friends) and streaming their output.
//!
//! Output is read as raw bytes and decoded lossily. `tauri-plugin-shell` decodes every line with a
//! strict `String::from_utf8`, which is what produced "invalid utf-8 sequence of N bytes" whenever a
//! tool emitted a non-UTF-8 title or path.

use std::io;
use std::process::Stdio;
#[cfg(test)]
use std::process::ExitStatus;
use tokio::io::{AsyncBufReadExt, AsyncRead, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::mpsc;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;
const CHANNEL_CAPACITY: usize = 256;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum OutputLine {
    Stdout(String),
    Stderr(String),
}

/// A running child with its output lines multiplexed onto one channel.
pub struct ProcessHandle {
    pub pid: u32,
    /// Closes once both stdout and stderr have reached EOF.
    pub lines: mpsc::Receiver<OutputLine>,
    child: Child,
}

impl ProcessHandle {
    #[cfg(test)]
    pub async fn wait(&mut self) -> io::Result<ExitStatus> {
        self.child.wait().await
    }

    /// Splits into the pid, the output stream and the child (to `wait` on separately).
    pub fn into_parts(self) -> (u32, mpsc::Receiver<OutputLine>, Child) {
        (self.pid, self.lines, self.child)
    }
}

/// Reads the next line as lossily-decoded UTF-8 without the trailing `\n` / `\r\n`.
/// `buf` is scratch space reused between calls. Returns `Ok(None)` at EOF.
pub async fn next_line<R: AsyncBufReadExt + Unpin>(
    reader: &mut R,
    buf: &mut Vec<u8>,
) -> io::Result<Option<String>> {
    buf.clear();
    if reader.read_until(b'\n', buf).await? == 0 {
        return Ok(None);
    }
    if buf.last() == Some(&b'\n') {
        buf.pop();
        if buf.last() == Some(&b'\r') {
            buf.pop();
        }
    }
    Ok(Some(String::from_utf8_lossy(buf).into_owned()))
}

/// Forces UTF-8 from Python-based tools, hides the console window on Windows and pipes stdio.
pub fn configure(cmd: &mut Command) {
    cmd.env("PYTHONUNBUFFERED", "1")
        .env("PYTHONUTF8", "1")
        .env("PYTHONIOENCODING", "utf-8")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
}

pub fn spawn_streaming(mut cmd: Command) -> io::Result<ProcessHandle> {
    configure(&mut cmd);
    let mut child = cmd.spawn()?;
    let pid = child.id().ok_or_else(|| {
        io::Error::new(io::ErrorKind::Other, "process exited before it could be tracked")
    })?;
    let stdout = child.stdout.take().expect("stdout is piped");
    let stderr = child.stderr.take().expect("stderr is piped");

    let (tx, lines) = mpsc::channel(CHANNEL_CAPACITY);
    tokio::spawn(forward(stdout, tx.clone(), OutputLine::Stdout));
    tokio::spawn(forward(stderr, tx, OutputLine::Stderr));
    Ok(ProcessHandle { pid, lines, child })
}

/// Terminates `pid` and its children (ffmpeg, aria2c, ...).
pub fn kill_process_tree(pid: u32) -> Result<(), String> {
    #[cfg(unix)]
    {
        // SIGINT lets yt-dlp shut down and clean up like a Ctrl+C would.
        std::process::Command::new("kill")
            .args(["-s", "SIGINT", &pid.to_string()])
            .status()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // /T kills the whole process tree. A non-zero exit just means it was already gone.
        std::process::Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/F", "/T"])
            .creation_flags(CREATE_NO_WINDOW)
            .status()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

async fn forward<R: AsyncRead + Unpin>(
    reader: R,
    tx: mpsc::Sender<OutputLine>,
    wrap: fn(String) -> OutputLine,
) {
    let mut reader = BufReader::new(reader);
    let mut buf = Vec::new();
    while let Ok(Some(line)) = next_line(&mut reader, &mut buf).await {
        if tx.send(wrap(line)).await.is_err() {
            break;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use std::time::Duration;

    async fn collect(input: &[u8]) -> Vec<String> {
        let mut reader = BufReader::new(input);
        let mut buf = Vec::new();
        let mut out = Vec::new();
        while let Some(line) = next_line(&mut reader, &mut buf).await.unwrap() {
            out.push(line);
        }
        out
    }

    #[tokio::test]
    async fn splits_lf_and_crlf_and_keeps_last_unterminated_line() {
        assert_eq!(collect(b"a\nb\r\nc").await, ["a", "b", "c"]);
    }

    #[tokio::test]
    async fn empty_lines_are_preserved() {
        assert_eq!(collect(b"a\n\nb\n").await, ["a", "", "b"]);
    }

    #[tokio::test]
    async fn empty_input_yields_nothing() {
        assert!(collect(b"").await.is_empty());
    }

    #[tokio::test]
    async fn invalid_utf8_is_replaced_not_an_error() {
        // cp1252 "é" (0xE9) and a truncated multi-byte sequence.
        let lines = collect(b"Finalpath: caf\xE9.mp4\n\xE6\x97\n").await;
        assert_eq!(lines, ["Finalpath: caf\u{FFFD}.mp4", "\u{FFFD}"]);
    }

    #[tokio::test]
    async fn valid_non_ascii_round_trips() {
        let text = "日本語のタイトル 🎬 café Привет";
        let lines = collect(format!("{text}\n").as_bytes()).await;
        assert_eq!(lines, [text]);
    }

    #[tokio::test]
    async fn very_long_lines_are_returned_whole() {
        let long = "x".repeat(1 << 20);
        let lines = collect(format!("{long}\nend\n").as_bytes()).await;
        assert_eq!(lines.len(), 2);
        assert_eq!(lines[0].len(), 1 << 20);
    }

    // The test binary doubles as a fake child process: when NEODLP_FAKE_CHILD is set, this "test"
    // emits raw bytes / sleeps instead of asserting anything. In a normal run it is a no-op.
    #[test]
    fn fake_child() {
        match std::env::var("NEODLP_FAKE_CHILD").as_deref() {
            Ok("latin1") => {
                let mut out = std::io::stdout();
                out.write_all(b"@@Finalpath: caf\xE9.mp4\n").unwrap();
                out.write_all(b"@@\xE6\x97\n").unwrap();
                out.flush().unwrap();
                std::io::stderr().write_all(b"@@err \xFF\n").unwrap();
            }
            Ok("python-env") => {
                println!(
                    "@@{}|{}",
                    std::env::var("PYTHONUTF8").unwrap_or_default(),
                    std::env::var("PYTHONIOENCODING").unwrap_or_default()
                );
            }
            Ok("sleep") => std::thread::sleep(Duration::from_secs(60)),
            _ => {}
        }
    }

    fn fake_child_command(mode: &str) -> Command {
        let mut cmd = Command::new(std::env::current_exe().unwrap());
        cmd.args([
            "--exact",
            "downloader::process::tests::fake_child",
            "--nocapture",
            "--test-threads=1",
        ])
        .env("NEODLP_FAKE_CHILD", mode);
        cmd
    }

    async fn run(cmd: Command) -> (Vec<OutputLine>, ExitStatus) {
        let mut handle = spawn_streaming(cmd).unwrap();
        let mut lines = Vec::new();
        while let Some(line) = handle.lines.recv().await {
            lines.push(line);
        }
        let status = handle.wait().await.unwrap();
        (lines, status)
    }

    /// Keeps only the lines the fake child wrote. The test harness prints "test ... " without a
    /// newline, so the marker can appear mid-line.
    fn marked(lines: &[OutputLine]) -> Vec<OutputLine> {
        lines
            .iter()
            .filter_map(|l| match l {
                OutputLine::Stdout(s) => s.split_once("@@").map(|(_, s)| OutputLine::Stdout(s.into())),
                OutputLine::Stderr(s) => s.split_once("@@").map(|(_, s)| OutputLine::Stderr(s.into())),
            })
            .collect()
    }

    #[tokio::test]
    async fn streams_invalid_utf8_child_output_without_error() {
        let (lines, status) = run(fake_child_command("latin1")).await;
        assert!(status.success());
        let got = marked(&lines);
        assert!(got.contains(&OutputLine::Stdout("Finalpath: caf\u{FFFD}.mp4".into())), "{got:?}");
        assert!(got.contains(&OutputLine::Stdout("\u{FFFD}".into())), "{got:?}");
        assert!(got.contains(&OutputLine::Stderr("err \u{FFFD}".into())), "{got:?}");
    }

    #[tokio::test]
    async fn forces_utf8_environment_for_python_tools() {
        let (lines, _) = run(fake_child_command("python-env")).await;
        assert_eq!(marked(&lines), [OutputLine::Stdout("1|utf-8".into())]);
    }

    #[tokio::test]
    async fn reports_pid_and_missing_binary() {
        let mut handle = spawn_streaming(fake_child_command("none")).unwrap();
        assert!(handle.pid > 0);
        while handle.lines.recv().await.is_some() {}
        handle.wait().await.unwrap();

        assert!(spawn_streaming(Command::new("definitely-not-a-real-binary-xyz")).is_err());
    }

    #[tokio::test]
    async fn kill_process_tree_terminates_the_child() {
        let mut handle = spawn_streaming(fake_child_command("sleep")).unwrap();
        // Give the child time to start running the test body.
        tokio::time::sleep(Duration::from_millis(500)).await;
        kill_process_tree(handle.pid).unwrap();
        let status = tokio::time::timeout(Duration::from_secs(15), handle.wait())
            .await
            .expect("child should exit after being killed")
            .unwrap();
        assert!(!status.success());
    }
}
