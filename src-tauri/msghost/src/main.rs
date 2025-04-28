mod config;
use config::load_config;
use futures_util::{SinkExt, StreamExt};
use serde_json::Value;
use std::io::{self, Read, Write};
use std::time::Duration;
use tokio::net::TcpStream;
use tokio::time::sleep;
use tokio_tungstenite::{
    connect_async, tungstenite::protocol::Message, MaybeTlsStream, WebSocketStream,
};

fn get_websocket_url() -> String {
    let config = load_config();
    format!("ws://localhost:{}", config.port)
}

async fn connect_with_retry(
    url: &str,
    max_attempts: u32,
) -> Result<WebSocketStream<MaybeTlsStream<TcpStream>>, Box<dyn std::error::Error + Send + Sync>> {
    let mut attempts = 0;
    loop {
        match connect_async(url).await {
            Ok((ws_stream, _)) => {
                eprintln!("Successfully connected to Tauri app :)");
                return Ok(ws_stream);
            }
            Err(e) => {
                attempts += 1;
                if attempts >= max_attempts {
                    return Err(Box::new(e));
                }
                let wait_time = Duration::from_secs(2u64.pow(attempts));
                eprintln!(
                    "Connection attempt {} failed. Retrying in {:?}...",
                    attempts, wait_time
                );
                sleep(wait_time).await;
            }
        }
    }
}

fn read_stdin_message() -> Result<String, Box<dyn std::error::Error>> {
    let mut stdin = io::stdin();
    let mut length_bytes = [0u8; 4];
    stdin.read_exact(&mut length_bytes)?;
    let length = u32::from_ne_bytes(length_bytes) as usize;

    let mut buffer = vec![0u8; length];
    stdin.read_exact(&mut buffer)?;

    let message = String::from_utf8(buffer)?;
    Ok(message)
}

fn write_stdout_message(message: &str) -> Result<(), Box<dyn std::error::Error>> {
    let message_bytes = message.as_bytes();
    let message_size = message_bytes.len();
    io::stdout().write_all(&(message_size as u32).to_ne_bytes())?;
    io::stdout().write_all(message_bytes)?;
    io::stdout().flush()?;
    Ok(())
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    eprintln!("Waiting for message from extension...");

    let input = match read_stdin_message() {
        Ok(msg) => {
            eprintln!("Received message: {}", msg);
            msg
        }
        Err(e) => {
            eprintln!("Error reading message: {:?}", e);
            return Err(e);
        }
    };

    // Send immediate response to the extension
    write_stdout_message(
        &serde_json::json!({
            "status": "received",
            "message": "Message received by native host"
        })
        .to_string(),
    )?;

    let parsed: Value = serde_json::from_str(&input)?;

    let websocket_url = get_websocket_url();
    eprintln!("Attempting to connect to {}", websocket_url);

    let mut ws_stream = match connect_with_retry(&websocket_url, 2).await {
        Ok(stream) => stream,
        Err(e) => {
            eprintln!("Failed to connect after multiple attempts: {:?}", e);
            write_stdout_message(
                &serde_json::json!({
                    "status": "error",
                    "message": "Failed to connect to Tauri app"
                })
                .to_string(),
            )?;
            return Err(e);
        }
    };

    // Send message to Tauri app
    ws_stream
        .send(Message::Text(parsed.to_string().into()))
        .await?;

    // Receive response from Tauri app
    if let Some(Ok(msg)) = ws_stream.next().await {
        // Send Tauri app's response back to browser extension
        if let Message::Text(text) = msg {
            write_stdout_message(
                &serde_json::json!({
                    "status": "success",
                    "response": text.to_string()
                })
                .to_string(),
            )?;
        }
    }

    // Close the connection
    ws_stream.close(None).await?;

    Ok(())
}
