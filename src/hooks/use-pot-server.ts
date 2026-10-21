import * as tools from "@/services/tools";

// The PO-token server is owned by the Rust backend: it starts it at launch, restarts it when the
// saved settings change, and stops it on quit. The UI only reports "settings changed" and shows the
// status it receives through use-pot-events; it never decides whether to start or stop.
export default function usePotServer() {
	/** Call after saving a PO-token or custom-command setting. */
	const syncPotServer = async () => {
		try {
			await tools.syncPotServer();
		} catch (error) {
			// The backend has already logged the reason.
			console.error("Failed to apply the POT server settings:", error);
		}
	};

	/** Stops the server (a no-op when none runs), e.g. before the installer replaces its binary. */
	const stopPotServer = async () => {
		try {
			await tools.stopPotServer();
		} catch (error) {
			console.error("Failed to stop the POT server:", error);
		}
	};

	return { syncPotServer, stopPotServer };
}
