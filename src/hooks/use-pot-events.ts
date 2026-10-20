import { useEffect } from "react";
import { useSettingsPageStatesStore } from "@/services/store";
import {
	getPotStatus,
	listenToPotState,
	type PotStatus,
} from "@/services/tools";

/** Mirrors the backend's PO-token server status into the settings store. Mount once, near the root. */
export function usePotEvents() {
	const setIsRunningPotServer = useSettingsPageStatesStore(
		(state) => state.setIsRunningPotServer,
	);
	const setIsStartingPotServer = useSettingsPageStatesStore(
		(state) => state.setIsStartingPotServer,
	);
	const setPotServerPid = useSettingsPageStatesStore(
		(state) => state.setPotServerPid,
	);

	useEffect(() => {
		let disposed = false;
		let receivedEvent = false;
		let unlisten: (() => void) | undefined;

		const apply = (status: PotStatus) => {
			setIsRunningPotServer(status.running);
			setIsStartingPotServer(status.starting);
			setPotServerPid(status.pid);
		};

		listenToPotState((status) => {
			receivedEvent = true;
			apply(status);
		})
			.then((stop) => {
				if (disposed) stop();
				else unlisten = stop;
			})
			.catch((e) =>
				console.error("Failed to listen for POT server status:", e),
			);

		// The backend may have started the server before this page loaded. An event that
		// arrives first is newer than this snapshot, so it wins.
		getPotStatus()
			.then((status) => {
				if (!disposed && !receivedEvent) apply(status);
			})
			.catch((e) => console.error("Failed to read the POT server status:", e));

		return () => {
			disposed = true;
			unlisten?.();
		};
	}, [setIsRunningPotServer, setIsStartingPotServer, setPotServerPid]);
}
