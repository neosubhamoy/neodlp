import type { UpdateOutcome } from "@/services/tools";

export interface UpdateReport {
	kind: "success" | "error";
	title: string;
	description: string;
	/** Whether to remember this as the last successful update check. */
	recordCheck: boolean;
}

/** What to tell the user about a yt-dlp update attempt. */
export function describeUpdateOutcome(outcome: UpdateOutcome): UpdateReport {
	switch (outcome.status) {
		case "updated":
			return {
				kind: "success",
				title: "Update successful",
				description: "yt-dlp has been updated successfully.",
				recordCheck: true,
			};
		case "failed":
			return {
				kind: "error",
				title: "Update failed",
				description: "Failed to update yt-dlp.",
				recordCheck: false,
			};
		case "error":
			return {
				kind: "error",
				title: "Update failed",
				description: "An error occurred while updating yt-dlp.",
				recordCheck: false,
			};
	}
}
