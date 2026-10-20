import { describe, expect, it, vi } from "vitest";

// utils.ts imports a Tauri-bound module at load time; stub it for the node environment.
vi.mock("@tauri-apps/plugin-fs", () => ({ exists: vi.fn() }));

import {
	arraysEqual,
	determineFileType,
	formatBitrate,
	formatCodec,
	formatDuration,
	formatDurationString,
	formatFileSize,
	formatReleaseDate,
	formatSecToTimeString,
	formatSpeed,
	formatYtStyleCount,
	generateVideoId,
	isActive,
	isObjEmpty,
	paginate,
	sanitizeFilename,
	sortByBitrate,
} from "./utils";
import type { VideoFormat } from "@/types/video";

describe("arraysEqual / isActive / isObjEmpty", () => {
	it("compares arrays by value and order", () => {
		expect(arraysEqual([1, 2], [1, 2])).toBe(true);
		expect(arraysEqual([1, 2], [2, 1])).toBe(false);
		expect(arraysEqual([1], [1, 2])).toBe(false);
	});

	it("matches routes exactly or by prefix", () => {
		expect(isActive("/library", "/library")).toBe(true);
		expect(isActive("/library", "/library/x")).toBe(false);
		expect(isActive("/library", "/library/x", true)).toBe(true);
	});

	it("detects empty objects", () => {
		expect(isObjEmpty({})).toBe(true);
		expect(isObjEmpty({ a: 1 })).toBe(false);
	});
});

describe("formatters", () => {
	it("formatSpeed", () => {
		expect(formatSpeed(0)).toBe("0 B/s");
		expect(formatSpeed(1024)).toBe("1.00 KB/s");
		expect(formatSpeed(5 * 1024 * 1024)).toBe("5.00 MB/s");
	});

	it("formatFileSize", () => {
		expect(formatFileSize(0)).toBe("Unknown");
		expect(formatFileSize(1536)).toBe("1.50 KB");
		expect(formatFileSize(1024 ** 3)).toBe("1.00 GB");
	});

	it("formatYtStyleCount", () => {
		expect(formatYtStyleCount(999)).toBe(999);
		expect(formatYtStyleCount(1500)).toBe("1.5 K");
		expect(formatYtStyleCount(2_500_000)).toBe("2.5 M");
	});

	it("formatDurationString pads missing hour part", () => {
		expect(formatDurationString("1:02:03")).toBe("1:02:03");
		expect(formatDurationString("12:34")).toBe("12:34");
		expect(formatDurationString("45")).toBe("00:45");
	});

	it("formatDuration / formatSecToTimeString", () => {
		expect(formatDuration(65)).toBe("01:05");
		expect(formatDuration(3661)).toBe("1:01:01");
		expect(formatSecToTimeString(65)).toBe("01:05");
		expect(formatSecToTimeString(3661)).toBe("1:01:01");
	});

	it("formatReleaseDate", () => {
		expect(formatReleaseDate("20240305")).toBe("05 Mar 2024");
		expect(formatReleaseDate("20241305")).toBe("05 Unknown 2024");
	});

	it("formatBitrate", () => {
		expect(formatBitrate(128)).toBe("128.0 Kbps");
		expect(formatBitrate(2500)).toBe("2.5 Mbps");
	});

	it("formatCodec keeps only the family name, uppercased", () => {
		expect(formatCodec("avc1.64001F")).toBe("AVC1");
		expect(formatCodec("opus")).toBe("OPUS");
	});
});

describe("generateVideoId", () => {
	it("drops the TLD and joins remaining host parts", () => {
		expect(generateVideoId("abc", "youtube.com")).toBe("youtube_abc");
		expect(generateVideoId("abc", " www.example.co.uk ")).toBe(
			"www_example_co_abc",
		);
	});
});

describe("sanitizeFilename", () => {
	it("replaces illegal characters and collapses repeats", () => {
		expect(sanitizeFilename('a<b>:"c"')).toBe("a_b_c_");
	});

	it("keeps non-ASCII characters intact", () => {
		expect(sanitizeFilename("日本語のタイトル.mp4")).toBe(
			"日本語のタイトル.mp4",
		);
		expect(sanitizeFilename("Привет мир")).toBe("Привет мир");
	});

	it("prefixes Windows reserved names", () => {
		expect(sanitizeFilename("CON")).toBe("_CON");
		expect(sanitizeFilename("nul.txt")).toBe("_nul.txt");
	});

	it("falls back to unnamed_file when nothing is left", () => {
		expect(sanitizeFilename("...")).toBe("unnamed_file");
	});

	it("truncates but preserves the extension", () => {
		const out = sanitizeFilename(`${"a".repeat(300)}.mp4`);
		expect(out).toHaveLength(255);
		expect(out.endsWith(".mp4")).toBe(true);
	});

	it("validates its arguments", () => {
		expect(() => sanitizeFilename("")).toThrow();
		expect(() => sanitizeFilename("a", "ab")).toThrow();
		expect(() => sanitizeFilename("a", "/")).toThrow();
		expect(() => sanitizeFilename("a", "_", 0)).toThrow();
	});
});

describe("determineFileType", () => {
	it("classifies by codec presence", () => {
		expect(determineFileType("avc1", "mp4a")).toBe("video+audio");
		expect(determineFileType("avc1", "none")).toBe("video");
		expect(determineFileType("none", "opus")).toBe("audio");
		expect(determineFileType(null, undefined)).toBe("unknown");
	});
});

describe("sortByBitrate", () => {
	const f = (format_id: string, tbr?: number | null) =>
		({ format_id, tbr }) as unknown as VideoFormat;

	it("sorts by tbr descending, formats without tbr last", () => {
		const sorted = sortByBitrate([f("a", 100), f("b"), f("c", 500)]);
		expect(sorted?.map((x) => x.format_id)).toEqual(["c", "a", "b"]);
	});

	it("passes through undefined", () => {
		expect(sortByBitrate(undefined)).toBeUndefined();
	});
});

describe("paginate", () => {
	const items = Array.from({ length: 25 }, (_, i) => i + 1);

	it("returns the requested page with 1-indexed from/to", () => {
		const p = paginate(items, 2, 10);
		expect(p.data).toEqual(items.slice(10, 20));
		expect(p.current_page).toBe(2);
		expect(p.from).toBe(11);
		expect(p.to).toBe(20);
	});

	it("clamps out-of-range pages", () => {
		expect(paginate(items, 99, 10).current_page).toBe(3);
		expect(paginate(items, -5, 10).current_page).toBe(1);
	});

	it("handles empty input", () => {
		const p = paginate([], 1, 10);
		expect(p.data).toEqual([]);
		expect(p.from).toBe(0);
		expect(p.to).toBe(0);
	});
});
