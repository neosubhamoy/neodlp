import { describe, expect, it } from "vitest";
import { describeUpdateOutcome } from "./ytdlp-update";

describe("describeUpdateOutcome", () => {
	it("celebrates a successful update and records the check", () => {
		expect(
			describeUpdateOutcome({ status: "updated", elevated: false }),
		).toEqual({
			kind: "success",
			title: "Update successful",
			description: "yt-dlp has been updated successfully.",
			recordCheck: true,
		});
	});

	it("treats an elevated update the same way", () => {
		expect(
			describeUpdateOutcome({ status: "updated", elevated: true }),
		).toMatchObject({
			kind: "success",
			recordCheck: true,
		});
	});

	it("reports a failed update without recording the check", () => {
		expect(
			describeUpdateOutcome({ status: "failed", message: "denied" }),
		).toEqual({
			kind: "error",
			title: "Update failed",
			description: "Failed to update yt-dlp.",
			recordCheck: false,
		});
	});

	it("reports an update that could not be attempted", () => {
		expect(describeUpdateOutcome({ status: "error", message: "gone" })).toEqual(
			{
				kind: "error",
				title: "Update failed",
				description: "An error occurred while updating yt-dlp.",
				recordCheck: false,
			},
		);
	});
});
