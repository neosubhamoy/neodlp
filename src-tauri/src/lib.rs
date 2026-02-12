// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod config;
mod migrations;
use base64::{engine::general_purpose::STANDARD, Engine};
use config::{get_config_path, load_config, save_config, Config};
use futures_util::{SinkExt, StreamExt};
use reqwest;
use serde_json::Value;
use sqlx::{
    sqlite::{SqliteConnectOptions, SqlitePool},
    Pool, Row, Sqlite,
};
use std::{
    collections::{hash_map::DefaultHasher, HashMap},
    env, fs,
    hash::{Hash, Hasher},
    process::Command as StdCommand,
    sync::{Arc, Mutex as StdMutex},
    time::Duration,
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, State,
};
use tauri_plugin_opener::OpenerExt;
use tokio::{
    net::{TcpListener, TcpStream},
    sync::{oneshot, Mutex},
    time::sleep,
};
use tokio_tungstenite::accept_async;

struct ImageCache(StdMutex<HashMap<String, String>>);

struct ResponseChannel {
    sender: Option<oneshot::Sender<String>>,
}

struct WebSocketState {
    sender: Option<
        futures_util::stream::SplitSink<
            tokio_tungstenite::WebSocketStream<TcpStream>,
            tokio_tungstenite::tungstenite::Message,
        >,
    >,
    response_channel: ResponseChannel,
    server_abort: Option<tokio::sync::oneshot::Sender<()>>,
    config: Config,
}

#[derive(Debug, serde::Serialize)]
struct DownloadState {
    id: i32,
    download_id: String,
    download_status: String,
    process_id: Option<i32>,
    status: String,
}

async fn is_port_available(port: u16) -> bool {
    match TcpListener::bind(format!("127.0.0.1:{}", port)).await {
        Ok(_) => true,
        Err(_) => false,
    }
}

async fn wait_for_port_availability(port: u16, max_attempts: u32) -> Result<(), String> {
    let mut attempts = 0;
    while attempts < max_attempts {
        if is_port_available(port).await {
            return Ok(());
        }
        sleep(Duration::from_millis(500)).await;
        attempts += 1;
    }
    Err(format!(
        "Port {} did not become available after {} attempts",
        port, max_attempts
    ))
}

async fn start_websocket_server(app_handle: tauri::AppHandle, port: u16) -> Result<(), String> {
    let addr = format!("127.0.0.1:{}", port);

    // First ensure any existing server is stopped
    {
        let state = app_handle.state::<Arc<Mutex<WebSocketState>>>();
        let mut state = state.lock().await;
        if let Some(old_abort) = state.server_abort.take() {
            let _ = old_abort.send(());
            // Wait for the port to become available
            wait_for_port_availability(port, 6).await?; // Try for 3 seconds (6 attempts * 500ms)
        }
    }

    // Now try to bind to the port
    let listener = match TcpListener::bind(&addr).await {
        Ok(l) => l,
        Err(_e) => {
            // One final attempt to wait and retry
            sleep(Duration::from_secs(1)).await;
            TcpListener::bind(&addr)
                .await
                .map_err(|e| format!("Failed to bind to port {}: {}", port, e))?
        }
    };

    let (abort_sender, mut abort_receiver) = tokio::sync::oneshot::channel();

    // Store the new abort sender
    {
        let state = app_handle.state::<Arc<Mutex<WebSocketState>>>();
        let mut state = state.lock().await;
        state.server_abort = Some(abort_sender);
    }

    // Spawn the server task
    tokio::spawn(async move {
        println!("Starting WebSocket server on port {}", port);
        loop {
            tokio::select! {
                accept_result = listener.accept() => {
                    match accept_result {
                        Ok((stream, _)) => {
                            let app_handle = app_handle.clone();
                            tokio::spawn(handle_connection(stream, app_handle));
                        }
                        Err(e) => {
                            println!("Error accepting connection: {}", e);
                            break;
                        }
                    }
                }
                _ = &mut abort_receiver => {
                    println!("WebSocket server shutting down on port {}...", port);
                    break;
                }
            }
        }
    });

    // Wait a moment to ensure the server has started
    sleep(Duration::from_millis(100)).await;
    Ok(())
}

#[tauri::command]
async fn restart_websocket_server(
    state: tauri::State<'_, Arc<Mutex<WebSocketState>>>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let port = {
        let state = state.lock().await;
        state.config.port
    };

    println!("Restarting WebSocket server on port {}", port);
    // Start the server (this will also handle stopping the old one)
    start_websocket_server(app_handle, port).await
}

#[tauri::command]
async fn get_config(state: tauri::State<'_, Arc<Mutex<WebSocketState>>>) -> Result<Config, String> {
    let state = state.lock().await;
    Ok(state.config.clone())
}

#[tauri::command]
fn get_config_file_path() -> Result<String, String> {
    match get_config_path() {
        Some(path) => Ok(path.to_string_lossy().into_owned()),
        None => Err("Could not determine config path".to_string()),
    }
}

#[tauri::command]
fn get_current_app_path() -> Result<String, String> {
    let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
    Ok(exe_path
        .parent()
        .ok_or("Failed to get parent directory")?
        .to_string_lossy()
        .into_owned())
}

#[tauri::command]
async fn update_config(
    new_config: Config,
    state: tauri::State<'_, Arc<Mutex<WebSocketState>>>,
    app_handle: tauri::AppHandle,
) -> Result<Config, String> {
    // Save the new config first
    save_config(&new_config)?;

    // Update the state with new config
    {
        let mut state = state.lock().await;
        state.config = new_config.clone();
    }

    // Start the new server (this will also handle stopping the old one)
    start_websocket_server(app_handle, new_config.port).await?;

    Ok(new_config)
}

#[tauri::command]
async fn reset_config(
    state: tauri::State<'_, Arc<Mutex<WebSocketState>>>,
    app_handle: tauri::AppHandle,
) -> Result<Config, String> {
    let config = Config::default();
    save_config(&config)?;

    {
        let mut state = state.lock().await;
        state.config = config.clone();
    }

    start_websocket_server(app_handle, config.port).await?;

    Ok(config)
}

#[tauri::command]
async fn send_to_extension(
    message: String,
    state: tauri::State<'_, Arc<Mutex<WebSocketState>>>,
) -> Result<(), String> {
    let mut state = state.lock().await;
    if let Some(sender) = &mut state.sender {
        sender
            .send(tokio_tungstenite::tungstenite::Message::Text(
                message.into(),
            ))
            .await
            .map_err(|e| format!("Failed to send message: {}", e))?;
        Ok(())
    } else {
        Err("No active WebSocket connection".to_string())
    }
}

#[tauri::command]
async fn receive_frontend_response(
    response: String,
    state: tauri::State<'_, Arc<Mutex<WebSocketState>>>,
) -> Result<(), String> {
    let mut state = state.lock().await;
    if let Some(sender) = state.response_channel.sender.take() {
        sender
            .send(response)
            .map_err(|e| format!("Failed to send response: {:?}", e))?;
    }
    Ok(())
}

#[tauri::command]
async fn kill_all_process(pid: i32) -> Result<(), String> {
    #[cfg(unix)]
    {
        println!("Sending INT signal to process with PID: {}", pid);
        let mut kill = StdCommand::new("kill")
            .args(["-s", "SIGINT", &pid.to_string()])
            .spawn()
            .map_err(|e| e.to_string())?;
        kill.wait().map_err(|e| e.to_string())?;
    }

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        println!("Sending taskkill to process with PID: {}", pid);
        let mut kill = StdCommand::new("taskkill")
            .args(["/PID", &pid.to_string(), "/F", "/T"]) // /T flag kills the process tree
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| e.to_string())?;
        kill.wait().map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
async fn fetch_image(
    app_handle: tauri::AppHandle,
    cache: State<'_, ImageCache>,
    url: String,
) -> Result<String, String> {
    // Check if image is already cached (acquire and release lock quickly)
    let cached_path = {
        let cache_map = cache.0.lock().unwrap();
        cache_map.get(&url).cloned()
    };

    if let Some(local_path) = cached_path {
        return Ok(local_path);
    }

    // Download image (no lock held during network operations)
    let response = reqwest::get(&url).await.map_err(|e| e.to_string())?;

    let bytes = response.bytes().await.map_err(|e| e.to_string())?;

    // Generate path for caching
    let app_dir = app_handle
        .path()
        .app_cache_dir()
        .map_err(|_| "Failed to get cache dir".to_string())?
        .join("thumbnails");

    fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;

    // Create filename from URL hash
    let mut hasher = DefaultHasher::new();
    url.hash(&mut hasher);
    let hash = hasher.finish();

    let file_name = format!("thumb_{}.jpg", hash);
    let file_path = app_dir.join(&file_name);

    fs::write(&file_path, &bytes).map_err(|e| e.to_string())?;

    // Instead of file://, use a data URI
    let image_data = STANDARD.encode(&bytes);
    let local_path = format!("data:image/jpeg;base64,{}", image_data);

    // Cache the URL to path mapping (acquire lock again briefly)
    {
        let mut cache_map = cache.0.lock().unwrap();
        cache_map.insert(url, local_path.clone());
    }

    Ok(local_path)
}

#[tauri::command]
async fn open_file_with_app(
    app_handle: tauri::AppHandle,
    file_path: String,
    app_name: Option<String>,
) -> Result<(), String> {
    if let Some(name) = &app_name {
        if name == "explorer" {
            println!("Revealing file: {} in explorer", file_path);
            return app_handle
                .opener()
                .reveal_item_in_dir(file_path)
                .map_err(|e| e.to_string());
        }
        println!("Opening file: {} with app: {}", file_path, name);
    } else {
        println!("Opening file: {} with default app", file_path);
    }

    app_handle
        .opener()
        .open_path(file_path, app_name)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn list_ongoing_downloads(
    state_mutex: State<'_, StdMutex<Pool<Sqlite>>>,
) -> Result<Vec<DownloadState>, String> {
    let pool_clone = {
        let pool = state_mutex.lock().map_err(|e| e.to_string())?;
        pool.clone()
    };

    let qry = "SELECT * FROM downloads WHERE download_status = 'downloading' OR download_status = 'starting' OR download_status = 'queued'";

    match sqlx::query(qry).fetch_all(&pool_clone).await {
        Ok(rows) => {
            let mut downloads = Vec::new();
            for row in rows {
                downloads.push(DownloadState {
                    id: row.get("id"),
                    download_id: row.get("download_id"),
                    download_status: row.get("download_status"),
                    process_id: row.get("process_id"),
                    status: row.get("status"),
                });
            }
            Ok(downloads)
        }
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
async fn pause_ongoing_downloads(
    state_mutex: State<'_, StdMutex<Pool<Sqlite>>>,
) -> Result<(), String> {
    // Get database connection
    let pool_clone = {
        let pool = state_mutex.lock().map_err(|e| e.to_string())?;
        pool.clone()
    };

    // Fetch all ongoing downloads
    let qry = "SELECT * FROM downloads WHERE download_status = 'downloading' OR download_status = 'starting' OR download_status = 'queued'";

    let downloads = match sqlx::query(qry).fetch_all(&pool_clone).await {
        Ok(rows) => {
            let mut downloads = Vec::new();
            for row in rows {
                downloads.push(DownloadState {
                    id: row.get("id"),
                    download_id: row.get("download_id"),
                    download_status: row.get("download_status"),
                    process_id: row.get("process_id"),
                    status: row.get("status"),
                });
            }
            downloads
        }
        Err(e) => return Err(e.to_string()),
    };

    println!("Found {} ongoing downloads to pause", downloads.len());

    // Process each download
    for download in downloads {
        println!(
            "Pausing download: {} ({}), Status: {}",
            download.download_id, download.id, download.download_status
        );

        // Kill the process if it exists
        if let Some(pid) = download.process_id {
            println!("Terminating process with PID: {}", pid);
            if let Err(e) = kill_all_process(pid).await {
                println!("Failed to kill process {}: {}", pid, e);
            } else {
                println!("Successfully terminated process {}", pid);
            }
        }

        // Update the download status in the database
        let update_qry = "UPDATE downloads SET download_status = 'paused' WHERE id = ?";
        if let Err(e) = sqlx::query(update_qry)
            .bind(download.id)
            .execute(&pool_clone)
            .await
        {
            println!(
                "Failed to update download status for ID {}: {}",
                download.id, e
            );
        } else {
            println!("Updated download status to 'paused' for ID {}", download.id);
        }
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub async fn run() {
    let _ = fix_path_env::fix();
    let migrations = migrations::get_migrations();
    let config = load_config();
    let port = config.port;
    let websocket_state = Arc::new(Mutex::new(WebSocketState {
        sender: None,
        response_channel: ResponseChannel { sender: None },
        server_abort: None,
        config,
    }));

    let args: Vec<String> = env::args().collect();
    let start_hidden = args.contains(&"--hidden".to_string());

    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new()
            .level(log::LevelFilter::Info)
            .max_file_size(5_242_880) /* in bytes = 5MB */
            .build(),
        )
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // Focus the main window when attempting to launch another instance
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_sql::Builder::default()
            .add_migrations("sqlite:database.db", migrations)
            .build(),
        )
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_notification::init())
        .manage(ImageCache(StdMutex::new(HashMap::new())))
        .manage(websocket_state.clone())
        .setup(move |app| {
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let _ = fs::create_dir_all(app_handle.path().app_data_dir().unwrap());
                let db_path = app_handle
                    .path()
                    .app_data_dir()
                    .unwrap()
                    .join("database.db");

                let options = SqliteConnectOptions::new()
                    .filename(db_path)
                    .create_if_missing(true);
                let pool = SqlitePool::connect_with(options).await;
                match pool {
                    Ok(db) => {
                        app_handle.manage(StdMutex::new(db.clone()));
                    }
                    Err(e) => {
                        eprintln!("Database connection error: {}", e);
                    }
                }
            });

            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)
                .map_err(|e| format!("Failed to create quit menu item: {}", e))?;
            let show = MenuItem::with_id(app, "show", "Show NeoDLP", true, None::<&str>)
                .map_err(|e| format!("Failed to create show menu item: {}", e))?;
            let menu = Menu::with_items(app, &[&show, &quit])
                .map_err(|e| format!("Failed to create menu: {}", e))?;
            let tray = TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("NeoDLP")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        let app_handle = app.clone();
                        tauri::async_runtime::spawn(async move {
                            let state_mutex = app_handle.state::<StdMutex<Pool<Sqlite>>>();
                            if let Err(e) = pause_ongoing_downloads(state_mutex).await {
                                println!("Error pausing downloads: {}", e);
                            }
                            app_handle.exit(0);
                        });
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)
                .map_err(|e| format!("Failed to create tray: {}", e))?;

            app.manage(tray);

            let window = app.get_webview_window("main").unwrap();
            if !start_hidden {
                window.show().unwrap();
            }

            let websocket_app_handle = app.handle().clone();
            tokio::spawn(async move {
                if let Err(e) = start_websocket_server(websocket_app_handle, port).await {
                    println!("Failed to start initial WebSocket server: {}", e);
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            kill_all_process,
            fetch_image,
            open_file_with_app,
            list_ongoing_downloads,
            pause_ongoing_downloads,
            send_to_extension,
            receive_frontend_response,
            get_config,
            update_config,
            reset_config,
            get_config_file_path,
            restart_websocket_server,
            get_current_app_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

async fn handle_connection(stream: TcpStream, app_handle: tauri::AppHandle) {
    let ws_stream = accept_async(stream).await.unwrap();
    let (ws_sender, mut ws_receiver) = ws_stream.split();

    // Store the sender in the shared state
    {
        let state = app_handle.state::<Arc<Mutex<WebSocketState>>>();
        let mut state = state.lock().await;
        state.sender = Some(ws_sender);
    }

    println!("New WebSocket connection established");

    while let Some(msg) = ws_receiver.next().await {
        if let Ok(msg) = msg {
            if let Ok(text) = msg.to_text() {
                println!("Received message: {}", text);

                // Parse the JSON message
                if let Ok(json_value) = serde_json::from_str::<Value>(text) {
                    // Create a new channel for this request
                    let (response_sender, response_receiver) = oneshot::channel();
                    {
                        let state = app_handle.state::<Arc<Mutex<WebSocketState>>>();
                        let mut state = state.lock().await;
                        state.response_channel.sender = Some(response_sender);
                    }

                    // Emit an event to the frontend
                    app_handle
                        .emit_to("main", "websocket-message", json_value)
                        .unwrap();

                    // Wait for the response from the frontend
                    let response = response_receiver
                        .await
                        .unwrap_or_else(|e| format!("Error receiving response: {:?}", e));

                    // Send the response back through WebSocket
                    let state = app_handle.state::<Arc<Mutex<WebSocketState>>>();
                    let mut state = state.lock().await;
                    if let Some(sender) = &mut state.sender {
                        let _ = sender
                            .send(tokio_tungstenite::tungstenite::Message::Text(
                                response.into(),
                            ))
                            .await;
                    }
                }
            }
        }
    }

    println!("WebSocket connection closed");

    // Remove the sender from the shared state when the connection closes
    let state = app_handle.state::<Arc<Mutex<WebSocketState>>>();
    let mut state = state.lock().await;
    state.sender = None;
}
