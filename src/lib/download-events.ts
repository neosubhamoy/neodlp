// Events pushed by the Rust downloader. The reducers are pure so they can be applied to the
// TanStack Query cache (see src/hooks/use-download-events.ts) and tested without Tauri.

import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { DownloadState } from "@/types/download";

export const DOWNLOAD_STATE_EVENT = "download://state";
export const DOWNLOAD_PROGRESS_EVENT = "download://progress";
export const DOWNLOAD_REMOVED_EVENT = "download://removed";
/** Shared by the downloader and the helper tools (POT server, yt-dlp updater). */
export const APP_LOG_EVENT = "app://log";

export interface DownloadProgressEvent {
	download_id: string;
	status: string | null;
	item: string | null;
	progress: number | null;
	speed: number | null;
	downloaded: number | null;
	total: number | null;
	eta: number | null;
	/** ffmpeg's frame counter and fps while it processes a trimmed/merged file. */
	frame: number | null;
	fps: number | null;
}

export interface DownloadLogEvent {
	level: "info" | "warning" | "error" | "progress";
	source: string;
	message: string;
}

/** Inserts a new download at the top (the list is newest first) or replaces it in place. */
export function upsertDownloadState(
	states: DownloadState[],
	incoming: DownloadState,
): DownloadState[] {
	const index = states.findIndex((s) => s.download_id === incoming.download_id);
	if (index === -1) return [incoming, ...states];
	const next = states.slice();
	next[index] = incoming;
	return next;
}

/** Applies live progress; unknown downloads leave the list untouched. */
export function patchDownloadProgress(
	states: DownloadState[],
	event: DownloadProgressEvent,
): DownloadState[] {
	const index = states.findIndex((s) => s.download_id === event.download_id);
	if (index === -1) return states;
	const current = states[index];
	const next = states.slice();
	next[index] = {
		...current,
		status: event.status,
		item: event.item ?? current.item,
		progress: event.progress,
		speed: event.speed,
		downloaded: event.downloaded,
		total: event.total,
		eta: event.eta,
		frame: event.frame,
		fps: event.fps,
	};
	return next;
}

export function removeDownloadState(
	states: DownloadState[],
	downloadId: string,
): DownloadState[] {
	const next = states.filter((s) => s.download_id !== downloadId);
	return next.length === states.length ? states : next;
}

/** Which terminal status (if any) `incoming` newly entered, for toasts and notifications. */
export function statusChange(
	previous: DownloadState | undefined,
	incoming: DownloadState,
): "completed" | "errored" | null {
	if (previous?.download_status === incoming.download_status) return null;
	return incoming.download_status === "completed" ||
		incoming.download_status === "errored"
		? incoming.download_status
		: null;
}

/** `"title"`, or `playlist "title"` when several playlist items were selected. */
function displayName(state: DownloadState): string {
	const isMultiplePlaylistItems =
		state.playlist_id !== null &&
		state.playlist_indices !== null &&
		state.playlist_indices.includes(",");
	return isMultiplePlaylistItems
		? `playlist "${state.playlist_title}"`
		: `"${state.title}"`;
}

export function completionMessage(state: DownloadState): string {
	return `The download for ${displayName(state)} has completed successfully.`;
}

export function failureMessage(state: DownloadState): string {
	return `The download for ${displayName(state)} failed because yt-dlp exited unexpectedly. Please try again later.`;
}

export interface DownloadEventHandlers {
	onState: (state: DownloadState) => void;
	onProgress: (event: DownloadProgressEvent) => void;
	onRemoved: (downloadId: string) => void;
	onLog: (event: DownloadLogEvent) => void;
}

/** Subscribes to every download event; the returned function unsubscribes from all of them. */
export async function listenToDownloadEvents(
	handlers: DownloadEventHandlers,
): Promise<() => void> {
	const unlisteners: UnlistenFn[] = await Promise.all([
		listen<DownloadState>(DOWNLOAD_STATE_EVENT, (e) =>
			handlers.onState(e.payload),
		),
		listen<DownloadProgressEvent>(DOWNLOAD_PROGRESS_EVENT, (e) =>
			handlers.onProgress(e.payload),
		),
		listen<{ download_id: string }>(DOWNLOAD_REMOVED_EVENT, (e) =>
			handlers.onRemoved(e.payload.download_id),
		),
		listen<DownloadLogEvent>(APP_LOG_EVENT, (e) => handlers.onLog(e.payload)),
	]);
	return () => {
		for (const unlisten of unlisteners) unlisten();
	};
}
