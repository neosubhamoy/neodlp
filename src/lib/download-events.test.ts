import { beforeEach, describe, expect, it, vi } from "vitest";

const listen = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/event", () => ({ listen }));

import {
	completionMessage,
	APP_LOG_EVENT,
	DOWNLOAD_PROGRESS_EVENT,
	DOWNLOAD_REMOVED_EVENT,
	DOWNLOAD_STATE_EVENT,
	failureMessage,
	listenToDownloadEvents,
	patchDownloadProgress,
	removeDownloadState,
	statusChange,
	upsertDownloadState,
	type DownloadProgressEvent,
} from "./download-events";
import type { DownloadState } from "@/types/download";

function download(
	id: string,
	overrides: Partial<DownloadState> = {},
): DownloadState {
	return {
		download_id: id,
		download_status: "queued",
		title: `Title ${id}`,
		playlist_id: null,
		playlist_indices: null,
		playlist_title: "",
		item: null,
		progress: null,
		speed: null,
		downloaded: null,
		total: null,
		eta: null,
		status: null,
		...overrides,
	} as DownloadState;
}

const progress = (
	id: string,
	p: Partial<DownloadProgressEvent> = {},
): DownloadProgressEvent => ({
	download_id: id,
	status: "downloading",
	item: null,
	progress: 50,
	speed: 1000,
	downloaded: 500,
	total: 1000,
	eta: 3,
	frame: null,
	fps: null,
	...p,
});

describe("upsertDownloadState", () => {
	it("puts a new download first (the list is newest first)", () => {
		const list = [download("a"), download("b")];
		expect(
			upsertDownloadState(list, download("c")).map((d) => d.download_id),
		).toEqual(["c", "a", "b"]);
	});

	it("replaces an existing download in place", () => {
		const list = [download("a"), download("b")];
		const next = upsertDownloadState(
			list,
			download("b", { download_status: "completed" }),
		);
		expect(next.map((d) => d.download_id)).toEqual(["a", "b"]);
		expect(next[1].download_status).toBe("completed");
	});

	it("does not mutate its input", () => {
		const list = [download("a")];
		upsertDownloadState(list, download("a", { download_status: "paused" }));
		expect(list[0].download_status).toBe("queued");
	});
});

describe("patchDownloadProgress", () => {
	it("updates live fields", () => {
		const next = patchDownloadProgress([download("a")], progress("a"));
		expect(next[0]).toMatchObject({
			status: "downloading",
			progress: 50,
			speed: 1000,
			downloaded: 500,
			total: 1000,
			eta: 3,
		});
	});

	it("carries ffmpeg frame and fps, and clears them on the next normal update", () => {
		const processing = patchDownloadProgress(
			[download("a")],
			progress("a", { status: "finished", frame: 11456, fps: 49 }),
		);
		expect(processing[0]).toMatchObject({ frame: 11456, fps: 49 });
		const back = patchDownloadProgress(processing, progress("a"));
		expect(back[0]).toMatchObject({ frame: null, fps: null });
	});

	it("keeps the current playlist item unless the event carries one", () => {
		const list = [download("a", { item: "2/5" })];
		expect(
			patchDownloadProgress(list, progress("a", { item: null }))[0].item,
		).toBe("2/5");
		expect(
			patchDownloadProgress(list, progress("a", { item: "3/5" }))[0].item,
		).toBe("3/5");
	});

	it("ignores unknown downloads without allocating", () => {
		const list = [download("a")];
		expect(patchDownloadProgress(list, progress("zzz"))).toBe(list);
	});

	it("only touches the matching download", () => {
		const list = [download("a"), download("b")];
		const next = patchDownloadProgress(list, progress("b"));
		expect(next[0]).toBe(list[0]);
		expect(next[1]).not.toBe(list[1]);
	});
});

describe("removeDownloadState", () => {
	it("removes by id", () => {
		const list = [download("a"), download("b")];
		expect(removeDownloadState(list, "a").map((d) => d.download_id)).toEqual([
			"b",
		]);
	});

	it("returns the same list when nothing matches", () => {
		const list = [download("a")];
		expect(removeDownloadState(list, "x")).toBe(list);
	});
});

describe("statusChange", () => {
	it("reports transitions into completed and errored only", () => {
		const running = download("a", { download_status: "downloading" });
		expect(
			statusChange(running, download("a", { download_status: "completed" })),
		).toBe("completed");
		expect(
			statusChange(running, download("a", { download_status: "errored" })),
		).toBe("errored");
		expect(
			statusChange(running, download("a", { download_status: "paused" })),
		).toBeNull();
		expect(
			statusChange(running, download("a", { download_status: "downloading" })),
		).toBeNull();
	});

	it("does not repeat a status that was already known", () => {
		const done = download("a", { download_status: "completed" });
		expect(
			statusChange(done, download("a", { download_status: "completed" })),
		).toBeNull();
	});

	it("treats an unknown previous download as a change", () => {
		expect(
			statusChange(undefined, download("a", { download_status: "errored" })),
		).toBe("errored");
	});
});

describe("messages", () => {
	it("name a single video by its title", () => {
		const d = download("a", { title: "日本語 café" });
		expect(completionMessage(d)).toBe(
			'The download for "日本語 café" has completed successfully.',
		);
		expect(failureMessage(d)).toBe(
			'The download for "日本語 café" failed because yt-dlp exited unexpectedly. Please try again later.',
		);
	});

	it("name a multi-item playlist by its title", () => {
		const d = download("a", {
			playlist_id: "yt_PL",
			playlist_indices: "1,2,3",
			playlist_title: "My List",
		});
		expect(completionMessage(d)).toBe(
			'The download for playlist "My List" has completed successfully.',
		);
	});

	it("treat a single selected playlist item as a video", () => {
		const d = download("a", {
			playlist_id: "yt_PL",
			playlist_indices: "4",
			playlist_title: "My List",
		});
		expect(completionMessage(d)).toBe(
			'The download for "Title a" has completed successfully.',
		);
	});
});

describe("listenToDownloadEvents", () => {
	beforeEach(() => listen.mockReset());

	it("routes each backend event to its handler and returns a combined unlisten", async () => {
		const callbacks = new Map<string, (e: { payload: unknown }) => void>();
		const unlisteners: Array<ReturnType<typeof vi.fn>> = [];
		listen.mockImplementation(
			async (name: string, cb: (e: { payload: unknown }) => void) => {
				callbacks.set(name, cb);
				const off = vi.fn();
				unlisteners.push(off);
				return off;
			},
		);
		const handlers = {
			onState: vi.fn(),
			onProgress: vi.fn(),
			onRemoved: vi.fn(),
			onLog: vi.fn(),
		};

		const unlisten = await listenToDownloadEvents(handlers);

		const state = download("a");
		callbacks.get(DOWNLOAD_STATE_EVENT)?.({ payload: state });
		callbacks.get(DOWNLOAD_PROGRESS_EVENT)?.({ payload: progress("a") });
		callbacks.get(DOWNLOAD_REMOVED_EVENT)?.({ payload: { download_id: "a" } });
		callbacks.get(APP_LOG_EVENT)?.({
			payload: { level: "info", source: "NEODLP", message: "hello" },
		});

		expect(handlers.onState).toHaveBeenCalledWith(state);
		expect(handlers.onProgress).toHaveBeenCalledWith(progress("a"));
		expect(handlers.onRemoved).toHaveBeenCalledWith("a");
		expect(handlers.onLog).toHaveBeenCalledWith({
			level: "info",
			source: "NEODLP",
			message: "hello",
		});

		unlisten();
		expect(unlisteners).toHaveLength(4);
		for (const off of unlisteners) expect(off).toHaveBeenCalledTimes(1);
	});

	it("uses the event names the backend emits", () => {
		expect([
			DOWNLOAD_STATE_EVENT,
			DOWNLOAD_PROGRESS_EVENT,
			DOWNLOAD_REMOVED_EVENT,
			APP_LOG_EVENT,
		]).toEqual([
			"download://state",
			"download://progress",
			"download://removed",
			"app://log",
		]);
	});
});
