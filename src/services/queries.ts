import { useQuery } from "@tanstack/react-query";
import { fetchAllKvPairs, fetchAllSettings } from "@/services/database";
import { listDownloadStates } from "@/services/downloads";

export const DOWNLOAD_STATES_QUERY_KEY = ["download-states"] as const;

export function useFetchAllDownloadStates() {
	return useQuery({
		queryKey: DOWNLOAD_STATES_QUERY_KEY,
		queryFn: () => listDownloadStates(),
		// Kept current by the downloader's events (see use-download-events). Refetching from the
		// database would only bring older progress back.
		staleTime: Number.POSITIVE_INFINITY,
		refetchOnWindowFocus: false,
	});
}

export function useFetchAllSettings() {
	return useQuery({
		queryKey: ["settings"],
		queryFn: () => fetchAllSettings(),
	});
}

export function useFetchAllkVPairs() {
	return useQuery({
		queryKey: ["kv-pairs"],
		queryFn: () => fetchAllKvPairs(),
	});
}
