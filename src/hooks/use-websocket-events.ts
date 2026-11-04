import { useEffect } from "react";
import { useSettingsPageStatesStore } from "@/services/store";
import {
	getWebSocketServerStatus,
	listenToWebSocketServerState,
	type WebSocketServerStatus,
} from "@/services/websocket";

/** Mirrors the backend's extension WebSocket server status into the settings store. Mount once, near the root. */
export function useWebSocketEvents() {
	const setWebSocketServerStatus = useSettingsPageStatesStore(
		(state) => state.setWebSocketServerStatus,
	);

	useEffect(() => {
		let disposed = false;
		let receivedEvent = false;
		let unlisten: (() => void) | undefined;

		listenToWebSocketServerState((status) => {
			receivedEvent = true;
			setWebSocketServerStatus(status);
		})
			.then((stop) => {
				if (disposed) stop();
				else unlisten = stop;
			})
			.catch((e) =>
				console.error("Failed to listen for WebSocket server status:", e),
			);

		// The backend starts the server at launch, possibly before this page loaded. An event that
		// arrives first is newer than this snapshot, so it wins.
		getWebSocketServerStatus()
			.then((status: WebSocketServerStatus) => {
				if (!disposed && !receivedEvent) setWebSocketServerStatus(status);
			})
			.catch((e) =>
				console.error("Failed to read the WebSocket server status:", e),
			);

		return () => {
			disposed = true;
			unlisten?.();
		};
	}, [setWebSocketServerStatus]);
}
