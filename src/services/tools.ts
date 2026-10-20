// Thin client for the Rust helper tools (src-tauri/src/tools): the PO-token server, the yt-dlp
// version check and updater, and the per-platform registration. The backend runs the processes and
// copies the files; the UI only sends commands and listens for status.

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export const POT_STATE_EVENT = "pot://state";

export interface PotStatus {
	running: boolean;
	starting: boolean;
	pid: number | null;
}

export type UpdateOutcome =
	| { status: "updated"; elevated: boolean }
	/** yt-dlp ran but the update didn't succeed. */
	| { status: "failed"; message: string }
	/** The update couldn't even be attempted. */
	| { status: "error"; message: string };

export const startPotServer = (port: number) =>
	invoke<void>("start_pot_server", { port });

export const stopPotServer = () => invoke<void>("stop_pot_server");

export const getPotStatus = () => invoke<PotStatus>("get_pot_status");

/** Subscribes to PO-token server status changes; the returned function unsubscribes. */
export async function listenToPotState(
	handler: (status: PotStatus) => void,
): Promise<() => void> {
	return listen<PotStatus>(POT_STATE_EVENT, (e) => handler(e.payload));
}

export const getYtDlpVersion = () => invoke<string>("get_ytdlp_version");

export const updateYtDlp = (channel: string) =>
	invoke<UpdateOutcome>("update_ytdlp", { channel });

export const registerMacos = () => invoke<void>("register_macos");

export const registerLinux = () => invoke<void>("register_linux");
