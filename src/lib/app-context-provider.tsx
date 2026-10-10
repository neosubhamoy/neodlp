import { createContext, useContext } from "react";
import type { DownloadState } from "@/types/download";
import type { DownloadConfiguration } from "@/types/settings";
import type { RawVideoInfo } from "@/types/video";

export interface FetchVideoMetadataParams {
	url: string;
	formatId?: string;
	playlistIndices?: string;
	selectedSubtitles?: string | null;
	resumeState?: DownloadState;
	downloadConfig?: DownloadConfiguration;
}

export interface StartDownloadParams {
	url: string;
	selectedFormat: string;
	downloadConfig: DownloadConfiguration;
	selectedSubtitles?: string | null;
	resumeState?: DownloadState;
	playlistItems?: string;
	overrideOptions?: {
		[key: string]: any;
	};
}

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
