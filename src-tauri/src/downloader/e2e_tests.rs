//! End-to-end check against the real yt-dlp: the real manager, runner, process layer and parser
//! download a file from a local HTTP server. Opt-in, because it needs the bundled binary:
//!
//!     cargo test --lib e2e -- --ignored --nocapture
//!
//! Set `NEODLP_YTDLP` to use a different yt-dlp than `binaries/yt-dlp-x86_64-pc-windows-msvc.exe`.

use super::manager::{
    Events, LogLevel, Manager, Paths, ProgressEvent, Runner, Spawned, StartParams,
};
use super::process::kill_process_tree;
use super::repo::testing::{memory_repo, set_setting};
use super::repo::DownloadState;
use super::runner::spawn_command;
use std::io;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::process::Command;

const FILE_NAME: &str = "日本語のタイトル café 🎬.mp4";
const FILE_SIZE: usize = 3 * 1024 * 1024;

struct RealRunner(PathBuf);

impl Runner for RealRunner {
    fn spawn(&self, args: Vec<String>) -> io::Result<Spawned> {
        let mut command = Command::new(&self.0);
        command.args(args);
        spawn_command(command)
    }

    fn kill(&self, pid: u32) {
        let _ = kill_process_tree(pid);
    }
}

#[derive(Clone, Default)]
struct Recorder(Arc<Mutex<Vec<String>>>);

impl Events for Recorder {
    fn state(&self, state: &DownloadState) {
        self.0.lock().unwrap().push(format!("state:{}", state.record.download_status));
    }
    fn progress(&self, _: &ProgressEvent) {
        self.0.lock().unwrap().push("progress".into());
    }
    fn removed(&self, id: &str) {
        self.0.lock().unwrap().push(format!("removed:{id}"));
    }
    fn log(&self, level: LogLevel, source: &str, message: &str) {
        println!("[{level:?}] {source}: {message}");
    }
}

/// Serves `FILE_SIZE` bytes of `video/mp4` for any path, so yt-dlp's generic extractor treats the
/// URL as a direct media link.
async fn serve_video() -> u16 {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    tokio::spawn(async move {
        loop {
            let Ok((mut socket, _)) = listener.accept().await else { return };
            tokio::spawn(async move {
                let mut buf = vec![0u8; 8192];
                let mut request = Vec::new();
                while !request.windows(4).any(|w| w == b"\r\n\r\n") {
                    match socket.read(&mut buf).await {
                        Ok(0) | Err(_) => return,
                        Ok(n) => request.extend_from_slice(&buf[..n]),
                    }
                }
                let is_head = request.starts_with(b"HEAD");
                let header = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: video/mp4\r\nContent-Length: {FILE_SIZE}\r\nConnection: close\r\n\r\n"
                );
                let _ = socket.write_all(header.as_bytes()).await;
                if !is_head {
                    let body: Vec<u8> = (0..FILE_SIZE).map(|i| (i % 251) as u8).collect();
                    let _ = socket.write_all(&body).await;
                }
                let _ = socket.shutdown().await;
            });
        }
    });
    port
}

fn bundled_ytdlp() -> Option<PathBuf> {
    let path = std::env::var_os("NEODLP_YTDLP").map(PathBuf::from).unwrap_or_else(|| {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("binaries")
            .join("yt-dlp-x86_64-pc-windows-msvc.exe")
    });
    path.exists().then_some(path)
}

#[tokio::test]
#[ignore = "needs the bundled yt-dlp binary; run with --ignored"]
async fn downloads_a_non_ascii_file_with_the_real_ytdlp() {
    let Some(ytdlp) = bundled_ytdlp() else {
        println!("yt-dlp binary not found; set NEODLP_YTDLP");
        return;
    };
    let work = std::env::temp_dir().join(format!("neodlp-e2e-{}", std::process::id()));
    let (temp_dir, download_dir) = (work.join("tmp"), work.join("out"));
    let _ = std::fs::remove_dir_all(&work);

    let port = serve_video().await;
    let url = format!("http://127.0.0.1:{port}/{}", urlencoding_path(FILE_NAME));

    let repo = memory_repo().await;
    // The app defaults to --restrict-filenames, which would transliterate away the very characters
    // this test is about, so turn the filename restrictions off.
    for key in ["restrict_filenames", "windows_filenames", "unique_filenames"] {
        set_setting(&repo, key, serde_json::json!(false)).await;
    }
    let events = Recorder::default();
    let manager = Manager::new(repo.clone(), RealRunner(ytdlp), events.clone(), false);
    manager.set_paths(Paths {
        temp_dir: temp_dir.to_string_lossy().into(),
        download_dir: download_dir.to_string_lossy().into(),
    });

    let id = manager
        .start_download(StartParams {
            url: url.clone(),
            selected_format: "best".into(),
            ..Default::default()
        })
        .await
        .unwrap_or_else(|e| panic!("start_download failed: {e}"));

    let state = tokio::time::timeout(Duration::from_secs(60), async {
        loop {
            let state = repo.fetch_by_id(&id).await.unwrap().unwrap();
            if matches!(state.record.download_status.as_str(), "completed" | "errored") {
                return state;
            }
            tokio::time::sleep(Duration::from_millis(100)).await;
        }
    })
    .await
    .expect("download did not finish in time");

    println!("final row: {:#?}", state.record);
    assert_eq!(
        state.record.download_status, "completed",
        "error: {:?}",
        state.record.error_message
    );

    let path = PathBuf::from(state.record.filepath.clone().expect("a final file path"));
    assert!(path.exists(), "downloaded file missing: {path:?}");
    assert_eq!(std::fs::metadata(&path).unwrap().len(), FILE_SIZE as u64);
    assert_eq!(state.record.ext.as_deref(), Some("mp4"));
    assert!(
        path.to_string_lossy().contains("café"),
        "non-ASCII characters must survive in the path: {path:?}"
    );
    assert!(state.record.completed_at.is_some());
    assert_eq!(manager.running_count(), 0);

    let log = events.0.lock().unwrap().clone();
    assert!(log.iter().any(|e| e == "state:downloading"), "{log:?}");
    assert_eq!(log.last().map(String::as_str), Some("state:completed"));

    let _ = std::fs::remove_dir_all(&work);
}

/// Percent-encodes everything outside the unreserved set (the file name is the URL path).
fn urlencoding_path(s: &str) -> String {
    s.bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => (b as char).to_string(),
            _ => format!("%{b:02X}"),
        })
        .collect()
}
