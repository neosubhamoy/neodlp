//! End-to-end checks of the helper tools against the real bundled binaries. Opt-in, because they
//! need the sidecars that `tauri dev` copies next to the app executable:
//!
//!     cargo test --lib tools::e2e -- --ignored --nocapture

use super::pot::{PotServer, PotStatus};
use super::ytdlp::{Platform, UpdaterConfig, YtDlp};
use super::ToolEvents;
use crate::downloader::manager::LogLevel;
use crate::downloader::runner::SidecarRunner;
use crate::sidecar::{sidecar_path, Launcher};
use std::net::{SocketAddr, TcpStream};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;

#[derive(Clone, Default)]
struct Recorder(Arc<Mutex<Vec<PotStatus>>>);

impl ToolEvents for Recorder {
    fn log(&self, level: LogLevel, source: &str, message: &str) {
        println!("[{level:?}] {source}: {message}");
    }
    fn pot_state(&self, status: &PotStatus) {
        self.0.lock().unwrap().push(status.clone());
    }
}

/// The directory `tauri dev` copies sidecars into: next to the app, one level above the test binary.
fn sidecar_dir() -> PathBuf {
    let exe = std::env::current_exe().unwrap();
    exe.parent().unwrap().parent().unwrap().to_path_buf()
}

struct StopOnDrop(PotServer<SidecarRunner, Recorder>);

impl Drop for StopOnDrop {
    fn drop(&mut self) {
        self.0.shutdown();
    }
}

fn free_port() -> u16 {
    std::net::TcpListener::bind("127.0.0.1:0").unwrap().local_addr().unwrap().port()
}

/// The server binds `[::]` (IPv6), which on Windows doesn't necessarily accept IPv4 connections,
/// so try both loopback addresses (`localhost` resolves to either).
fn listening(port: u16) -> bool {
    let timeout = Duration::from_millis(300);
    [SocketAddr::from(([127, 0, 0, 1], port)), SocketAddr::from(([0, 0, 0, 0, 0, 0, 0, 1], port))]
        .iter()
        .any(|addr| TcpStream::connect_timeout(addr, timeout).is_ok())
}

async fn eventually(what: &str, secs: u64, mut check: impl FnMut() -> bool) {
    let ok = tokio::time::timeout(Duration::from_secs(secs), async {
        while !check() {
            tokio::time::sleep(Duration::from_millis(100)).await;
        }
    })
    .await;
    assert!(ok.is_ok(), "timed out waiting for: {what}");
}

#[tokio::test]
#[ignore = "needs the bundled sidecars next to the app executable"]
async fn runs_the_real_pot_server_and_reads_the_real_ytdlp_version() {
    let exe_dir = sidecar_dir();
    if !sidecar_path(&exe_dir, "neodlp-pot").exists() || !sidecar_path(&exe_dir, "yt-dlp").exists() {
        println!("sidecars not found in {exe_dir:?}; run the app once with `tauri dev`");
        return;
    }
    let launcher = Launcher::new(exe_dir.clone(), std::env::temp_dir(), false);
    let runner = SidecarRunner::new(launcher);
    let events = Recorder::default();

    // yt-dlp version, through the real production path resolution
    let ytdlp = YtDlp::new(
        runner.clone(),
        events.clone(),
        UpdaterConfig {
            platform: Platform::current(),
            flatpak: false,
            exe_dir,
            data_dir: std::env::temp_dir(),
        },
    );
    let version = ytdlp.version().await.expect("yt-dlp --version");
    println!("yt-dlp version: {version}");
    assert!(
        version.chars().next().is_some_and(|c| c.is_ascii_digit()) && version.contains('.'),
        "unexpected version: {version:?}"
    );

    // PO-token server: start, wait until it announces itself and listens, then stop
    let port = free_port();
    let pot = PotServer::new(runner, events.clone());
    // A failed assertion must not leave the server running (it would also hang the test runtime).
    let _stop_on_drop = StopOnDrop(pot.clone());
    pot.start(port).expect("start the POT server");
    assert!(pot.status().pid.is_some());

    eventually("the POT server to report running", 60, || pot.status().running).await;
    eventually("the POT server to accept connections", 30, || listening(port)).await;

    pot.stop();
    assert_eq!(pot.status(), PotStatus::default());
    eventually("the POT server process to exit", 30, || !listening(port)).await;

    let states = events.0.lock().unwrap().clone();
    assert!(states.iter().any(|s| s.starting), "{states:?}");
    assert!(states.iter().any(|s| s.running), "{states:?}");
    assert_eq!(states.last(), Some(&PotStatus::default()));
}
