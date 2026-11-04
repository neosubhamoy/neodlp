//! The WebSocket server the browser extension talks to (through the `msghost` native-messaging
//! host). This module owns its lifecycle: it binds the port, accepts connections and drops them
//! again on stop, and reports what the listener is actually doing, not what was last asked for.
//! What a connection does is up to the [`WsHost`].

use futures_util::future::BoxFuture;
use serde::Serialize;
use std::{sync::Arc, time::Duration};
use tokio::{
    net::{TcpListener, TcpStream},
    sync::{oneshot, Mutex},
    task::{JoinHandle, JoinSet},
    time::sleep,
};

pub const WEBSOCKET_STATE_EVENT: &str = "websocket://state";

/// Binding right after a stop can briefly fail while the OS releases the port.
const BIND_ATTEMPTS: u32 = 6;
const BIND_RETRY_DELAY: Duration = Duration::from_millis(250);

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct WsStatus {
    /// The listener is bound and accepting connections.
    pub running: bool,
    pub port: u16,
    /// The saved choice: when set, the server starts at launch.
    pub enabled: bool,
    /// False under Flatpak, where the server never runs.
    pub supported: bool,
    /// Why the last start failed, while it stays stopped because of it.
    pub error: Option<String>,
}

/// The app side of the server: status reporting and what to do with a connection.
pub trait WsHost: Send + Sync + 'static {
    fn status_changed(&self, status: &WsStatus);
    /// Serves one accepted connection. The future is dropped when the server stops.
    fn serve(&self, stream: TcpStream) -> BoxFuture<'static, ()>;
}

struct Running {
    stop: oneshot::Sender<()>,
    task: JoinHandle<()>,
}

struct State {
    port: u16,
    enabled: bool,
    error: Option<String>,
    running: Option<Running>,
}

pub struct WsServer<H: WsHost> {
    host: Arc<H>,
    supported: bool,
    /// Held across a whole start/stop so they can't interleave.
    state: Mutex<State>,
}

impl<H: WsHost> WsServer<H> {
    pub fn new(host: H, supported: bool, port: u16, enabled: bool) -> Self {
        Self {
            host: Arc::new(host),
            supported,
            state: Mutex::new(State { port, enabled, error: None, running: None }),
        }
    }

    pub async fn status(&self) -> WsStatus {
        let state = self.state.lock().await;
        self.snapshot(&state)
    }

    /// Brings the server in line with the saved choice; called at launch.
    pub async fn apply(&self) -> WsStatus {
        let mut state = self.state.lock().await;
        if state.enabled && self.supported && state.running.is_none() {
            self.launch(&mut state).await;
        }
        self.publish(&state)
    }

    /// Starts the server and remembers that it should run. Check `running` for the outcome; a
    /// failure is in `error`. Does nothing where the server isn't supported.
    pub async fn start(&self) -> WsStatus {
        let mut state = self.state.lock().await;
        if self.supported {
            state.enabled = true;
            if state.running.is_none() {
                self.launch(&mut state).await;
            }
        }
        self.publish(&state)
    }

    /// Stops the server, closing open connections, and remembers that it should stay stopped.
    pub async fn stop(&self) -> WsStatus {
        let mut state = self.state.lock().await;
        state.enabled = false;
        state.error = None;
        halt(&mut state).await;
        self.publish(&state)
    }

    /// Moves the server to `port`. A server that should run is (re)started there; a stopped one
    /// stays stopped.
    pub async fn set_port(&self, port: u16) -> WsStatus {
        let mut state = self.state.lock().await;
        if port != state.port || state.running.is_none() {
            halt(&mut state).await;
            state.port = port;
            state.error = None;
            if state.enabled && self.supported {
                self.launch(&mut state).await;
            }
        }
        self.publish(&state)
    }

    async fn launch(&self, state: &mut State) {
        match bind(state.port).await {
            Ok(listener) => {
                let (stop, stopped) = oneshot::channel();
                let task = tokio::spawn(accept_loop(listener, self.host.clone(), stopped));
                state.running = Some(Running { stop, task });
                state.error = None;
                log::info!("Extension WebSocket server listening on port {}", state.port);
            }
            Err(e) => {
                let message = format!("Couldn't listen on port {}: {}", state.port, e);
                log::warn!("{message}");
                state.error = Some(message);
            }
        }
    }

    fn snapshot(&self, state: &State) -> WsStatus {
        WsStatus {
            running: state.running.is_some(),
            port: state.port,
            enabled: state.enabled,
            supported: self.supported,
            error: state.error.clone(),
        }
    }

    fn publish(&self, state: &State) -> WsStatus {
        let status = self.snapshot(state);
        self.host.status_changed(&status);
        status
    }
}

/// Stops the accept loop and waits for it, so the port is free and connections are gone.
async fn halt(state: &mut State) {
    if let Some(running) = state.running.take() {
        let _ = running.stop.send(());
        let _ = running.task.await;
        log::info!("Extension WebSocket server on port {} stopped", state.port);
    }
}

async fn bind(port: u16) -> std::io::Result<TcpListener> {
    let mut attempt = 1;
    loop {
        match TcpListener::bind(("127.0.0.1", port)).await {
            Ok(listener) => return Ok(listener),
            Err(e) if attempt >= BIND_ATTEMPTS => return Err(e),
            Err(_) => {
                attempt += 1;
                sleep(BIND_RETRY_DELAY).await;
            }
        }
    }
}

async fn accept_loop<H: WsHost>(
    listener: TcpListener,
    host: Arc<H>,
    mut stop: oneshot::Receiver<()>,
) {
    let mut connections = JoinSet::new();
    loop {
        tokio::select! {
            // Also fires if the server itself was dropped.
            _ = &mut stop => break,
            accepted = listener.accept() => match accepted {
                Ok((stream, _)) => {
                    connections.spawn(host.serve(stream));
                }
                // Usually transient (e.g. out of file handles); keep listening.
                Err(e) => {
                    log::warn!("Extension WebSocket server couldn't accept a connection: {e}");
                    sleep(Duration::from_millis(100)).await;
                }
            },
            Some(_) = connections.join_next(), if !connections.is_empty() => {}
        }
    }
    drop(listener);
    connections.shutdown().await;
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Mutex as StdMutex;

    #[derive(Default)]
    struct FakeHost {
        statuses: StdMutex<Vec<WsStatus>>,
        served: Arc<AtomicUsize>,
        dropped: Arc<AtomicUsize>,
    }

    struct DropCounter(Arc<AtomicUsize>);
    impl Drop for DropCounter {
        fn drop(&mut self) {
            self.0.fetch_add(1, Ordering::SeqCst);
        }
    }

    impl WsHost for FakeHost {
        fn status_changed(&self, status: &WsStatus) {
            self.statuses.lock().unwrap().push(status.clone());
        }

        /// Holds the connection open until the server drops it.
        fn serve(&self, stream: TcpStream) -> BoxFuture<'static, ()> {
            let served = self.served.clone();
            let guard = DropCounter(self.dropped.clone());
            Box::pin(async move {
                let _guard = guard;
                let _stream = stream;
                served.fetch_add(1, Ordering::SeqCst);
                std::future::pending::<()>().await;
            })
        }
    }

    fn free_port() -> u16 {
        std::net::TcpListener::bind("127.0.0.1:0").unwrap().local_addr().unwrap().port()
    }

    fn port_is_free(port: u16) -> bool {
        std::net::TcpListener::bind(("127.0.0.1", port)).is_ok()
    }

    async fn connects(port: u16) -> bool {
        TcpStream::connect(("127.0.0.1", port)).await.is_ok()
    }

    async fn wait_for(counter: &AtomicUsize, n: usize) {
        for _ in 0..200 {
            if counter.load(Ordering::SeqCst) >= n {
                return;
            }
            sleep(Duration::from_millis(10)).await;
        }
        panic!("counter stayed at {} (wanted {n})", counter.load(Ordering::SeqCst));
    }

    fn server(port: u16, enabled: bool, supported: bool) -> WsServer<FakeHost> {
        WsServer::new(FakeHost::default(), supported, port, enabled)
    }

    #[tokio::test]
    async fn an_enabled_server_starts_at_launch_and_accepts_connections() {
        let port = free_port();
        let s = server(port, true, true);
        let status = s.apply().await;
        assert!(status.running && status.enabled && status.supported, "{status:?}");
        assert_eq!(status.port, port);
        assert!(connects(port).await);
        wait_for(&s.host.served, 1).await;
    }

    #[tokio::test]
    async fn a_disabled_server_stays_stopped_at_launch() {
        let port = free_port();
        let s = server(port, false, true);
        let status = s.apply().await;
        assert!(!status.running && !status.enabled, "{status:?}");
        assert!(!connects(port).await);
    }

    #[tokio::test]
    async fn stopping_frees_the_port_and_drops_open_connections() {
        let port = free_port();
        let s = server(port, true, true);
        s.apply().await;
        let _client = TcpStream::connect(("127.0.0.1", port)).await.unwrap();
        wait_for(&s.host.served, 1).await;

        let status = s.stop().await;
        assert!(!status.running && !status.enabled, "{status:?}");
        assert_eq!(s.host.dropped.load(Ordering::SeqCst), 1, "connection still being served");
        assert!(port_is_free(port), "listener still bound");
        assert_eq!(s.status().await, status);
    }

    #[tokio::test]
    async fn a_stopped_server_can_be_started_again() {
        let port = free_port();
        let s = server(port, false, true);
        s.apply().await;
        let status = s.start().await;
        assert!(status.running && status.enabled && status.error.is_none(), "{status:?}");
        assert!(connects(port).await);

        s.stop().await;
        assert!(s.start().await.running, "restart on the same port");
        assert!(connects(port).await);
    }

    #[tokio::test]
    async fn starting_twice_keeps_one_listener() {
        let port = free_port();
        let s = server(port, false, true);
        s.start().await;
        assert!(s.start().await.running);
        s.stop().await;
        assert!(port_is_free(port));
    }

    #[tokio::test]
    async fn the_server_never_runs_where_unsupported() {
        let port = free_port();
        let s = server(port, true, false);
        let status = s.apply().await;
        assert!(!status.running && !status.supported, "{status:?}");
        let status = s.start().await;
        assert!(!status.running, "{status:?}");
        assert!(!connects(port).await);
    }

    #[tokio::test]
    async fn a_busy_port_is_reported_not_hidden() {
        let port = free_port();
        let _taken = std::net::TcpListener::bind(("127.0.0.1", port)).unwrap();
        let s = server(port, false, true);
        let status = s.start().await;
        assert!(!status.running, "{status:?}");
        assert!(status.enabled, "the choice to run is kept, so a relaunch tries again");
        assert!(status.error.as_deref().is_some_and(|e| e.contains(&port.to_string())), "{status:?}");
    }

    #[tokio::test]
    async fn changing_the_port_moves_a_running_server() {
        let (old, new) = (free_port(), free_port());
        let s = server(old, true, true);
        s.apply().await;
        let status = s.set_port(new).await;
        assert!(status.running && status.port == new, "{status:?}");
        assert!(connects(new).await);
        assert!(port_is_free(old));
    }

    #[tokio::test]
    async fn changing_the_port_of_a_stopped_server_keeps_it_stopped() {
        let (old, new) = (free_port(), free_port());
        let s = server(old, false, true);
        s.apply().await;
        let status = s.set_port(new).await;
        assert!(!status.running && status.port == new, "{status:?}");
        assert!(!connects(new).await);
    }

    #[tokio::test]
    async fn every_change_is_reported_to_the_host() {
        let port = free_port();
        let s = server(port, false, true);
        let started = s.start().await;
        let stopped = s.stop().await;
        let seen = s.host.statuses.lock().unwrap().clone();
        assert_eq!(seen.last(), Some(&stopped));
        assert!(seen.contains(&started));
    }

    #[test]
    fn the_event_name_is_a_valid_tauri_event_name() {
        assert!(WEBSOCKET_STATE_EVENT
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || "-/:_".contains(c)));
    }
}
