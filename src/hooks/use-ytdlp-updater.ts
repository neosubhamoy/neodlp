import { useSettingsPageStatesStore } from "@/services/store";
import { useKvPairs } from "@/hooks/use-kvpairs";
import { toast } from "sonner";
import { describeUpdateOutcome } from "@/lib/ytdlp-update";
import * as tools from "@/services/tools";

// The update itself (choosing the right command per platform, the Windows elevation fallback and
// the logging) happens in the Rust backend; this reports the result.
export function useYtDlpUpdater() {
	const { saveKvPair } = useKvPairs();
	const ytDlpUpdateChannel = useSettingsPageStatesStore(
		(state) => state.settings.ytdlp_update_channel,
	);
	const setIsUpdatingYtDlp = useSettingsPageStatesStore(
		(state) => state.setIsUpdatingYtDlp,
	);
	const setYtDlpVersion = useSettingsPageStatesStore(
		(state) => state.setYtDlpVersion,
	);

	const updateYtDlp = async () => {
		const CURRENT_TIMESTAMP = Date.now();
		setIsUpdatingYtDlp(true);
		try {
			const outcome = await tools.updateYtDlp(ytDlpUpdateChannel);
			const report = describeUpdateOutcome(outcome);
			if (report.recordCheck) {
				saveKvPair("ytdlp_update_last_check", CURRENT_TIMESTAMP);
				setYtDlpVersion(null); // re-read after the update
			}
			const notify = report.kind === "success" ? toast.success : toast.error;
			notify(report.title, { description: report.description });
		} catch (e) {
			// Only when an update is already running; that one still owns the "updating" state.
			console.error("Failed to start the yt-dlp update:", e);
			toast.error("Update failed", { description: String(e) });
			return;
		}
		setIsUpdatingYtDlp(false);
	};

	return { updateYtDlp };
}
