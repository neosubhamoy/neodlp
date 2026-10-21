import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());
const listen = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen }));

import {
	getPotStatus,
	getYtDlpVersion,
	listenToPotState,
	POT_STATE_EVENT,
	registerLinux,
	registerMacos,
	stopPotServer,
	syncPotServer,
	updateYtDlp,
	type PotStatus,
} from "./tools";

beforeEach(() => {
	invoke.mockReset();
	listen.mockReset();
});

describe("PO-token server commands", () => {
	it("sync, stop and status take no arguments: the backend decides from its own state", async () => {
		invoke.mockResolvedValue(undefined);
		await syncPotServer();
		await stopPotServer();
		await getPotStatus();
		expect(invoke.mock.calls).toEqual([
			["sync_pot_server"],
			["stop_pot_server"],
			["get_pot_status"],
		]);
	});

	it("lets sync failures reach the caller", async () => {
		invoke.mockRejectedValue("Error starting POT Server: not found");
		await expect(syncPotServer()).rejects.toBe(
			"Error starting POT Server: not found",
		);
	});
});

describe("yt-dlp commands", () => {
	it("reads the version", async () => {
		invoke.mockResolvedValue("2026.10.10.233141");
		await expect(getYtDlpVersion()).resolves.toBe("2026.10.10.233141");
		expect(invoke).toHaveBeenCalledWith("get_ytdlp_version");
	});

	it("updates on the given channel and returns the outcome", async () => {
		invoke.mockResolvedValue({ status: "updated", elevated: false });
		await expect(updateYtDlp("nightly")).resolves.toEqual({
			status: "updated",
			elevated: false,
		});
		expect(invoke).toHaveBeenCalledWith("update_ytdlp", { channel: "nightly" });
	});
});

describe("registration commands", () => {
	it("call the platform commands", async () => {
		invoke.mockResolvedValue(undefined);
		await registerMacos();
		await registerLinux();
		expect(invoke.mock.calls).toEqual([["register_macos"], ["register_linux"]]);
	});
});

describe("listenToPotState", () => {
	it("forwards status payloads and returns the unlisten function", async () => {
		const unlisten = vi.fn();
		let callback: (e: { payload: PotStatus }) => void = () => {};
		listen.mockImplementation(async (_name: string, cb: typeof callback) => {
			callback = cb;
			return unlisten;
		});
		const handler = vi.fn();

		const stop = await listenToPotState(handler);
		const status: PotStatus = { running: true, starting: false, pid: 42 };
		callback({ payload: status });

		expect(listen).toHaveBeenCalledWith(POT_STATE_EVENT, expect.any(Function));
		expect(POT_STATE_EVENT).toBe("pot://state");
		expect(handler).toHaveBeenCalledWith(status);
		stop();
		expect(unlisten).toHaveBeenCalledTimes(1);
	});
});
