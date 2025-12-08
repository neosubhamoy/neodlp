import { toast } from "sonner";
import { useResetSettings, useSaveSettingsKey } from "@/services/mutations";
import { useSettingsPageStatesStore } from "@/services/store";
import { useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";

export function useSettings() {
  const queryClient = useQueryClient();
  const setSettingsKey = useSettingsPageStatesStore(state => state.setSettingsKey);
  const resetSettingsState = useSettingsPageStatesStore(state => state.resetSettings);
  const triggerFormReset = useSettingsPageStatesStore(state => state.triggerFormReset);
  const settingsKeySaver = useSaveSettingsKey();
  const settingsReseter = useResetSettings();

  const saveSettingsKey = (key: string, value: unknown) => {
    settingsKeySaver.mutate({ key, value }, {
      onSuccess: (data) => {
        setSettingsKey(key, value);
        console.log("Settings key saved successfully:", data);
        queryClient.invalidateQueries({ queryKey: ["settings"] });
      },
      onError: (error) => {
        console.error("Error saving settings key:", error);
        queryClient.invalidateQueries({ queryKey: ["settings"] });
        toast.error("Failed to update settings", {
          description: `Failed to update ${key}`,
        });
      }
    });
  };

  const resetSettings = () => {
    settingsReseter.mutate(undefined, {
      onSuccess: async () => {
        try {
          await invoke("reset_config");
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
      }
    });
  };

  return { saveSettingsKey, resetSettings };
}
