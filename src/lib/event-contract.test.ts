/// <reference types="node" />
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));

import {
	APP_LOG_EVENT,
	DOWNLOAD_PROGRESS_EVENT,
	DOWNLOAD_REMOVED_EVENT,
	DOWNLOAD_STATE_EVENT,
} from "./download-events";
import { POT_STATE_EVENT } from "@/services/tools";

/** Event names the Rust side emits, read straight from its source so the two can't drift apart. */
function rustEventNames(file: string): Record<string, string> {
	const source = readFileSync(path.resolve(process.cwd(), file), "utf-8");
	const names: Record<string, string> = {};
	for (const match of source.matchAll(
		/pub const (\w+_EVENT): &str = "([^"]+)";/g,
	)) {
		names[match[1]] = match[2];
	}
	return names;
}

describe("backend event names", () => {
	const downloads = rustEventNames("src-tauri/src/downloader/commands.rs");
	const tools = rustEventNames("src-tauri/src/tools/commands.rs");

	it("are found in the Rust source", () => {
		expect(Object.keys(downloads).sort()).toEqual([
			"LOG_EVENT",
			"PROGRESS_EVENT",
			"REMOVED_EVENT",
			"STATE_EVENT",
		]);
		expect(Object.keys(tools)).toEqual(["POT_STATE_EVENT"]);
	});

	it("match what the frontend listens for", () => {
		expect({
			STATE_EVENT: DOWNLOAD_STATE_EVENT,
			PROGRESS_EVENT: DOWNLOAD_PROGRESS_EVENT,
			REMOVED_EVENT: DOWNLOAD_REMOVED_EVENT,
			LOG_EVENT: APP_LOG_EVENT,
		}).toEqual(downloads);
		expect({ POT_STATE_EVENT }).toEqual(tools);
	});
});
