import { createContext, useContext } from "react";
import type {
	FetchVideoMetadataParams,
	StartDownloadParams,
} from "@/services/downloads";
import type { DownloadState } from "@/types/download";
import type { RawVideoInfo } from "@/types/video";

export type { FetchVideoMetadataParams, StartDownloadParams };

interface AppContextType {
	fetchVideoMetadata: (
		params: FetchVideoMetadataParams,
	) => Promise<RawVideoInfo | null>;
	startDownload: (params: StartDownloadParams) => Promise<void>;
	pauseDownload: (state: DownloadState) => Promise<void>;
	resumeDownload: (state: DownloadState) => Promise<void>;
	cancelDownload: (state: DownloadState) => Promise<void>;
}

export const AppContext = createContext<AppContextType>({
	fetchVideoMetadata: async () => null,
	startDownload: async () => {},
	pauseDownload: async () => {},
	resumeDownload: async () => {},
	cancelDownload: async () => {},
});

export const useAppContext = () => useContext(AppContext);
