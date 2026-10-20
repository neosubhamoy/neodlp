import { useSettingsPageStatesStore } from "@/services/store";
import * as tools from "@/services/tools";

// The PO-token server runs in the Rust backend, which also starts it at launch when enabled and
// stops it on quit. Its status reaches the UI through use-pot-events.
export default function usePotServer() {
	const potServerPort = useSettingsPageStatesStore(
		(state) => state.settings.pot_server_port,
	);

	const startPotServer = async (port?: number) => {
		try {
			await tools.startPotServer(port ?? potServerPort);
		} catch (error) {
			// The backend has already logged the reason.
			console.error("Failed to start the POT server:", error);
		}
	};

	const stopPotServer = async () => {
		try {
			await tools.stopPotServer();
		} catch (error) {
			console.error("Failed to stop the POT server:", error);
		}
	};

	return { startPotServer, stopPotServer };
}
