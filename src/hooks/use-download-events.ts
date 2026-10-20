import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { sendNotification } from "@tauri-apps/plugin-notification";
import { toast } from "sonner";
import { useLogger } from "@/hooks/use-logger";
import {
	completionMessage,
	failureMessage,
	listenToDownloadEvents,
	patchDownloadProgress,
	removeDownloadState,
	statusChange,
	upsertDownloadState,
} from "@/lib/download-events";
import { DOWNLOAD_STATES_QUERY_KEY } from "@/services/queries";
import { useSettingsPageStatesStore } from "@/services/store";
import type { DownloadState } from "@/types/download";

function announceCompletion(state: DownloadState) {
	toast.success("Download Completed", {
		description: completionMessage(state),
	});

	const { enable_notifications, download_completion_notification } =
		useSettingsPageStatesStore.getState().settings;
	if (enable_notifications && download_completion_notification) {
		sendNotification({
			title: "Download Completed",
			body: completionMessage(state),
		});
	}
}

/**
 * Keeps the cached download list in sync with the Rust downloader and shows the toasts and
 * notifications that go with its status changes. Mount once, near the root.
 */
export function useDownloadEvents() {
	const queryClient = useQueryClient();
	const logger = useLogger();
	const loggerRef = useRef(logger);
	loggerRef.current = logger;

	useEffect(() => {
		let disposed = false;
		let unlisten: (() => void) | undefined;

		// Before the first load there is nothing to patch; that load already reflects these changes.
		const update = (change: (states: DownloadState[]) => DownloadState[]) =>
			queryClient.setQueryData<DownloadState[]>(
				DOWNLOAD_STATES_QUERY_KEY,
				(states) => (states ? change(states) : states),
			);

		listenToDownloadEvents({
			onState: (state) => {
				const previous = queryClient
					.getQueryData<DownloadState[]>(DOWNLOAD_STATES_QUERY_KEY)
					?.find((s) => s.download_id === state.download_id);
				update((states) => upsertDownloadState(states, state));

				const change = statusChange(previous, state);
				if (change === "completed") {
					announceCompletion(state);
				} else if (change === "errored") {
					toast.error("Download Failed", {
						description: failureMessage(state),
					});
				}
			},
			onProgress: (event) =>
				update((states) => patchDownloadProgress(states, event)),
			onRemoved: (downloadId) =>
				update((states) => removeDownloadState(states, downloadId)),
			onLog: ({ level, source, message }) =>
				loggerRef.current[level](source, message),
		})
			.then((stop) => {
				if (disposed) stop();
				else unlisten = stop;
			})
			.catch((e) => console.error("Failed to listen for download events:", e));

		return () => {
			disposed = true;
			unlisten?.();
		};
	}, [queryClient]);
}
