import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("sonner", () => ({ toast: { error: toastError } }));

import {
	cancelDownload,
	cancelMetadataFetch,
	fetchVideoMetadata,
	listDownloadStates,
	pauseDownload,
	resumeDownload,
	setDownloadPaths,
	shutdownDownloads,
	startDownload,
	startFailureMessage,
	toStartParams,
} from "./downloads";
import type { DownloadState } from "@/types/download";
import type { DownloadConfiguration } from "@/types/settings";

const config: DownloadConfiguration = {
	output_format: "mkv",
	embed_metadata: true,
	embed_thumbnail: null,
	square_crop_thumbnail: null,
	sponsorblock: null,
	custom_command: null,
	trim_stamps: [1.5, 20],
};

const state = { download_id: "01ABC", title: "日本語" } as DownloadState;

beforeEach(() => {
	invoke.mockReset();
	toastError.mockReset();
});

describe("toStartParams", () => {
	it("maps the UI parameters to the backend's camelCase shape", () => {
		expect(
			toStartParams({
				url: "https://x/v",
				selectedFormat: "137+140",
				downloadConfig: config,
				selectedSubtitles: "en",
				playlistItems: "1,2",
				overrideOptions: { tbr: 256, filesize: 1000 },
			}),
		).toEqual({
			url: "https://x/v",
			selectedFormat: "137+140",
			downloadConfig: config,
			selectedSubtitles: "en",
			playlistItems: "1,2",
			overrideTbr: 256,
			overrideFilesize: 1000,
		});
	});

	it("leaves optional fields undefined", () => {
		const params = toStartParams({
			url: "u",
			selectedFormat: "best",
			downloadConfig: config,
		});
		expect(params.overrideTbr).toBeUndefined();
		expect(params.playlistItems).toBeUndefined();
	});
});

describe("fetchVideoMetadata", () => {
	it("passes the search options through and returns the metadata", async () => {
		const metadata = { _type: "video", title: "t" };
		invoke.mockResolvedValue(metadata);
		const result = await fetchVideoMetadata({
			url: "https://x/v",
			formatId: "18",
			playlistIndices: "1,2",
			selectedSubtitles: "en",
		});
		expect(result).toBe(metadata);
		expect(invoke).toHaveBeenCalledWith("fetch_video_metadata", {
			params: {
				url: "https://x/v",
				formatId: "18",
				playlistIndices: "1,2",
				selectedSubtitles: "en",
				downloadConfig: undefined,
			},
		});
	});

	it("resolves to null when the backend fails, like before", async () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		invoke.mockRejectedValue("yt-dlp failed to fetch video metadata");
		await expect(fetchVideoMetadata({ url: "u" })).resolves.toBeNull();
		spy.mockRestore();
	});
});

describe("startDownload", () => {
	it("invokes the backend with the mapped parameters", async () => {
		invoke.mockResolvedValue("01ABC");
		await startDownload({
			url: "u",
			selectedFormat: "18",
			downloadConfig: config,
		});
		expect(invoke).toHaveBeenCalledWith("start_download", {
			params: expect.objectContaining({ url: "u", selectedFormat: "18" }),
		});
		expect(toastError).not.toHaveBeenCalled();
	});

	it("shows the familiar toast when metadata can't be fetched", async () => {
		invoke.mockRejectedValue("yt-dlp failed to fetch video metadata");
		await startDownload({
			url: "u",
			selectedFormat: "18",
			downloadConfig: config,
		});
		expect(toastError).toHaveBeenCalledWith("Download Failed", {
			description: "yt-dlp failed to fetch metadata. Please try again later.",
		});
	});

	it("shows other failures as they are", async () => {
		invoke.mockRejectedValue("Failed to start yt-dlp: not found");
		await startDownload({
			url: "u",
			selectedFormat: "18",
			downloadConfig: config,
		});
		expect(toastError).toHaveBeenCalledWith("Download Failed", {
			description: "Failed to start yt-dlp: not found",
		});
	});
});

describe("startFailureMessage", () => {
	it("handles strings, errors and unknown values", () => {
		expect(startFailureMessage("yt-dlp failed to fetch video metadata")).toBe(
			"yt-dlp failed to fetch metadata. Please try again later.",
		);
		expect(startFailureMessage(new Error("boom"))).toBe("boom");
		expect(startFailureMessage(undefined)).toBe(
			"Something went wrong while starting the download. Please try again later.",
		);
	});
});

describe("download controls", () => {
	it("address downloads by id", async () => {
		invoke.mockResolvedValue(undefined);
		await pauseDownload(state);
		await resumeDownload(state);
		await cancelDownload(state);
		expect(invoke.mock.calls).toEqual([
			["pause_download", { downloadId: "01ABC" }],
			["resume_download", { downloadId: "01ABC" }],
			["cancel_download", { downloadId: "01ABC" }],
		]);
	});

	it("lets backend errors reach the caller", async () => {
		invoke.mockRejectedValue("Download not found");
		await expect(pauseDownload(state)).rejects.toBe("Download not found");
	});
});

describe("other commands", () => {
	it("list, paths, shutdown and cancel-search", async () => {
		invoke.mockResolvedValue([]);
		await listDownloadStates();
		await setDownloadPaths("/tmp/dl", "/home/me/NeoDLP");
		await shutdownDownloads();
		await cancelMetadataFetch();
		expect(invoke.mock.calls).toEqual([
			["list_download_states"],
			[
				"set_download_paths",
				{ tempDir: "/tmp/dl", downloadDir: "/home/me/NeoDLP" },
			],
			["shutdown_downloads"],
			["cancel_metadata_fetch"],
		]);
	});
});
