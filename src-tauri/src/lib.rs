// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod config;
mod downloader;
mod lifetime;
mod migrations;
mod sidecar;
mod tools;
use base64::{engine::general_purpose::STANDARD, Engine};
use config::{get_config_path, load_config, save_config, Config};
use futures_util::{SinkExt, StreamExt};
use reqwest;
use serde_json::Value;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use std::{
    collections::{hash_map::DefaultHasher, HashMap},
    env, fs,
    hash::{Hash, Hasher},
    sync::{Arc, Mutex as StdMutex},
    time::Duration,
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    path::BaseDirectory,
    Emitter, Manager, State,
};
use tauri_plugin_opener::OpenerExt;
use tokio::{
    net::{TcpListener, TcpStream},
    sync::{oneshot, Mutex},
    time::sleep,
};
use tokio_tungstenite::accept_async;
use log::{info, error};

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
fn is_flatpak() -> bool {
    sidecar::is_flatpak()
}

#[tauri::command]
fn get_appimage_path() -> Option<String> {
    std::env::var("APPDIR").ok()
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
    let pid = u32::try_from(pid).map_err(|_| format!("Invalid process id: {pid}"))?;
    downloader::process::kill_process_tree(pid)
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
            info!("Revealing file: {} in explorer", file_path);
            return app_handle
                .opener()
                .reveal_item_in_dir(file_path)
                .map_err(|e| {
                    error!("Failed to reveal file in explorer: {}", e);
                    e.to_string()
                });
        }
        info!("Opening file: {} with app: {}", file_path, name);
    } else {
        info!("Opening file: {} with default app", file_path);
    }

    app_handle
        .opener()
        .open_path(file_path, app_name)
        .map_err(|e| {
            error!("Failed to open file: {}", e);
            e.to_string()
        })
}

#[tauri::command]
async fn open_link_with_app(
    app_handle: tauri::AppHandle,
    url: String,
    app_name: Option<String>,
) -> Result<(), String> {
    if let Some(name) = &app_name {
        info!("Opening link: {} with app: {}", url, name);
    } else {
        info!("Opening link: {} with default app", url);
    }

    app_handle
        .opener()
        .open_url(url, app_name)
        .map_err(|e| {
            error!("Failed to open link: {}", e);
            e.to_string()
        })
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
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_notification::init())
        .manage(ImageCache(StdMutex::new(HashMap::new())))
        .manage(websocket_state.clone())
        .setup(move |app| {
            // The SQL plugin has already created and migrated `database.db` in the app config dir
            // (it runs during plugin setup), so open that same file. The pool connects lazily, which
            // lets the manager be registered before any command can run.
            let config_dir = app
                .path()
                .app_config_dir()
                .map_err(|e| format!("Failed to resolve the app config dir: {}", e))?;
            let db_options = SqliteConnectOptions::new()
                .filename(config_dir.join("database.db"))
                .busy_timeout(Duration::from_secs(5));
            let pool = SqlitePoolOptions::new()
                .max_connections(4)
                .connect_lazy_with(db_options);
            let launcher = sidecar::Launcher::for_current_app(
                app.path().data_dir().unwrap_or_default(),
            )
            .map_err(|e| format!("Failed to locate the app's executable: {}", e))?;
            let download_manager = downloader::commands::new_app_manager(
                app.handle().clone(),
                launcher.clone(),
                pool.clone(),
            );
            app.manage(download_manager.clone());
            let tools = tools::commands::new_tools(app.handle().clone(), launcher);
            app.manage(tools.clone());
            let settings = downloader::repo::Repo::new(pool);
            app.manage(settings.clone());
            tauri::async_runtime::spawn(async move {
                download_manager.recover().await;
                // Bring the PO-token server in line with the saved settings.
                if let Err(e) = tools::commands::sync_pot_server_with(&tools, &settings).await {
                    log::warn!("Could not start the POT server at launch: {}", e);
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
                            let manager = app_handle.state::<downloader::commands::AppManager>();
                            manager.shutdown().await;
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

            // Fix tray icon in sandboxed environments (e.g., Flatpak)
            // libappindicator uses the full path of the icon in dbus messages,
            // so the path needs to be accessible from both the host and the sandbox.
            // The default /tmp path doesn't work across sandbox boundaries.
            if let Ok(local_data_path) = app
                .path()
                .resolve("tray-icon", BaseDirectory::AppLocalData)
            {
                let _ = fs::create_dir_all(&local_data_path);
                let _ = tray.set_temp_dir_path(Some(local_data_path));
                // Re-set the icon so it gets written to the new temp dir path
                let _ = tray.set_icon(Some(app.default_window_icon().unwrap().clone()));
            }

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
            open_link_with_app,
            downloader::commands::fetch_video_metadata,
            downloader::commands::cancel_metadata_fetch,
            downloader::commands::start_download,
            downloader::commands::pause_download,
            downloader::commands::resume_download,
            downloader::commands::cancel_download,
            downloader::commands::list_download_states,
            downloader::commands::set_download_paths,
            downloader::commands::shutdown_downloads,
            send_to_extension,
            receive_frontend_response,
            get_config,
            update_config,
            reset_config,
            get_config_file_path,
            restart_websocket_server,
            is_flatpak,
            get_appimage_path,
            tools::commands::stop_pot_server,
            tools::commands::sync_pot_server,
            tools::commands::get_pot_status,
            tools::commands::get_ytdlp_version,
            tools::commands::update_ytdlp,
            tools::commands::register_macos,
            tools::commands::register_linux
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            // Child processes outlive their parent, so stop the POT server explicitly.
            if let tauri::RunEvent::Exit = event {
                if let Some(tools) = app.try_state::<tools::commands::Tools>() {
                    tools.pot.shutdown();
                }
            }
        });
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
