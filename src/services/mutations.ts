import { useMutation } from "@tanstack/react-query";
import {
	deleteKvPair,
	resetSettings,
	saveKvPair,
	saveSettingsKey,
} from "@/services/database";

export function useSaveSettingsKey() {
	return useMutation({
		mutationFn: (data: { key: string; value: unknown }) =>
			saveSettingsKey(data.key, data.value),
	});
}

export function useResetSettings() {
	return useMutation({
		mutationFn: () => resetSettings(),
	});
}

export function useSaveKvPair() {
	return useMutation({
		mutationFn: (data: { key: string; value: unknown }) =>
			saveKvPair(data.key, data.value),
	});
}

export function useDeleteKvPair() {
	return useMutation({
		mutationFn: (key: string) => deleteKvPair(key),
	});
}
