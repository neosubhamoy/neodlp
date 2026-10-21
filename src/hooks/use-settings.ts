import { toast } from "sonner";
import { useResetSettings, useSaveSettingsKey } from "@/services/mutations";
import { useSettingsPageStatesStore } from "@/services/store";
import { useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import usePotServer from "@/hooks/use-pot-server";

export function useSettings() {
	const queryClient = useQueryClient();
	const { syncPotServer } = usePotServer();
	const setSettingsKey = useSettingsPageStatesStore(
		(state) => state.setSettingsKey,
	);
	const resetSettingsState = useSettingsPageStatesStore(
		(state) => state.resetSettings,
	);
	const triggerFormReset = useSettingsPageStatesStore(
		(state) => state.triggerFormReset,
	);
	const settingsKeySaver = useSaveSettingsKey();
	const settingsReseter = useResetSettings();

	/** Resolves once the value is stored (true) or the save failed (false); never rejects. */
	const saveSettingsKey = async (key: string, value: unknown) => {
		try {
			const data = await settingsKeySaver.mutateAsync({ key, value });
			setSettingsKey(key, value);
			console.log("Settings key saved successfully:", data);
			queryClient.invalidateQueries({ queryKey: ["settings"] });
			return true;
		} catch (error) {
			console.error("Error saving settings key:", error);
			queryClient.invalidateQueries({ queryKey: ["settings"] });
			toast.error("Failed to update settings", {
				description: `Failed to update ${key}`,
			});
			return false;
		}
	};

	const resetSettings = () => {
		settingsReseter.mutate(undefined, {
			onSuccess: async () => {
				try {
					await invoke("reset_config");
					// The defaults have PO tokens off; the backend stops the server if it was on.
					await syncPotServer();
					resetSettingsState();
					triggerFormReset();
					console.log("Settings reset successfully");
					queryClient.invalidateQueries({ queryKey: ["settings"] });
					toast.success("Settings reset successfully", {
						description: "All settings have been reset to default.",
					});
				} catch (error) {
					console.error("Error resetting settings:", error);
					toast.error("Failed to reset settings", {
						description: "Failed to reset settings to default.",
					});
					return;
				}
			},
			onError: (error) => {
				console.error("Error resetting settings:", error);
				toast.error("Failed to reset settings", {
					description: "Failed to reset settings to default.",
				});
			},
		});
	};

	return { saveSettingsKey, resetSettings };
}
