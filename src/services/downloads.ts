// Thin client for the Rust downloader (src-tauri/src/downloader). All download work happens in the
// backend; the UI only sends commands and listens to events (see src/lib/download-events.ts).

import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import type { DownloadState } from "@/types/download";
import type { DownloadConfiguration } from "@/types/settings";
import type { RawVideoInfo } from "@/types/video";

export interface FetchVideoMetadataParams {
	url: string;
	formatId?: string;
	playlistIndices?: string;
	selectedSubtitles?: string | null;
	downloadConfig?: DownloadConfiguration;
}

export interface StartDownloadParams {
	url: string;
	selectedFormat: string;
	downloadConfig: DownloadConfiguration;
	selectedSubtitles?: string | null;
	playlistItems?: string;
	/** Estimates from the selected formats, used until yt-dlp reports real values. */
	overrideOptions?: { tbr?: number; filesize?: number };
}

/** The backend's `StartParams` (serde camelCase). */
export function toStartParams(params: StartDownloadParams) {
	return {
		url: params.url,
		selectedFormat: params.selectedFormat,
		downloadConfig: params.downloadConfig,
		selectedSubtitles: params.selectedSubtitles,
		playlistItems: params.playlistItems,
		overrideTbr: params.overrideOptions?.tbr,
		overrideFilesize: params.overrideOptions?.filesize,
	};
}

export function startFailureMessage(error: unknown): string {
	const message =
		typeof error === "string"
			? error
			: error instanceof Error
				? error.message
				: "";
	if (message.includes("fetch video metadata")) {
		return "yt-dlp failed to fetch metadata. Please try again later.";
	}
	return (
		message ||
		"Something went wrong while starting the download. Please try again later."
	);
}

/** Resolves to `null` when yt-dlp can't fetch anything for the URL (the search page shows an error). */
export async function fetchVideoMetadata(
	params: FetchVideoMetadataParams,
): Promise<RawVideoInfo | null> {
	try {
		return await invoke<RawVideoInfo>("fetch_video_metadata", {
			params: {
				url: params.url,
				formatId: params.formatId,
				playlistIndices: params.playlistIndices,
				selectedSubtitles: params.selectedSubtitles,
				downloadConfig: params.downloadConfig,
			},
		});
	} catch (e) {
		console.error(`Failed to fetch metadata for ${params.url}:`, e);
		return null;
	}
}

/** Kills an in-flight metadata fetch (the search page's cancel button). */
export const cancelMetadataFetch = () => invoke<void>("cancel_metadata_fetch");

/** Starts (or queues) a download. Failures are reported with a toast. */
export async function startDownload(
	params: StartDownloadParams,
): Promise<void> {
	try {
		await invoke<string>("start_download", { params: toStartParams(params) });
	} catch (e) {
		console.error("Failed to start download:", e);
		toast.error("Download Failed", { description: startFailureMessage(e) });
	}
}

export const pauseDownload = (state: DownloadState) =>
	invoke<void>("pause_download", { downloadId: state.download_id });

export const resumeDownload = (state: DownloadState) =>
	invoke<void>("resume_download", { downloadId: state.download_id });

/** Cancels a running download, or deletes a stored one (queued, paused, errored, completed). */
export const cancelDownload = (state: DownloadState) =>
	invoke<void>("cancel_download", { downloadId: state.download_id });

export const listDownloadStates = () =>
	invoke<DownloadState[]>("list_download_states");

/** Tells the backend where yt-dlp keeps partial files and puts finished ones. */
export const setDownloadPaths = (tempDir: string, downloadDir: string) =>
	invoke<void>("set_download_paths", { tempDir, downloadDir });

/** Pauses every download; call before the app quits. */
export const shutdownDownloads = () => invoke<void>("shutdown_downloads");
