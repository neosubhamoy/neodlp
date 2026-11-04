// Thin client for the extension WebSocket server (src-tauri/src/websocket.rs). The backend runs
// it and reports its real state; the UI only asks it to start or stop and shows the status.

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export const WEBSOCKET_STATE_EVENT = "websocket://state";

export interface WebSocketServerStatus {
	/** The listener is bound and accepting connections. */
	running: boolean;
	port: number;
	/** Saved choice: the server starts at launch when set. */
	enabled: boolean;
	/** False under Flatpak, where the server never runs. */
	supported: boolean;
	/** Why the last start failed, while it stays stopped because of it. */
	error: string | null;
}

export const getWebSocketServerStatus = () =>
	invoke<WebSocketServerStatus>("get_websocket_status");

/** Starts the server and keeps it running across restarts. Rejects with the reason if it can't. */
export const startWebSocketServer = () =>
	invoke<WebSocketServerStatus>("start_websocket_server");

/** Stops the server (dropping the extension's connection) and keeps it stopped across restarts. */
export const stopWebSocketServer = () =>
	invoke<WebSocketServerStatus>("stop_websocket_server");

/** Subscribes to server status changes; the returned function unsubscribes. */
export async function listenToWebSocketServerState(
	handler: (status: WebSocketServerStatus) => void,
): Promise<() => void> {
	return listen<WebSocketServerStatus>(WEBSOCKET_STATE_EVENT, (e) =>
		handler(e.payload),
	);
}
