import { DownloadState } from '@/types/download';
import { DownloadConfiguration } from '@/types/settings';
import { RawVideoInfo } from '@/types/video';
import { createContext, useContext } from 'react';

interface AppContextType {
  fetchVideoMetadata: (url: string, formatId?: string, playlistIndex?: string, selectedSubtitles?: string | null, resumeState?: DownloadState) => Promise<RawVideoInfo | null>;
  startDownload: (url: string, selectedFormat: string, downloadConfig: DownloadConfiguration, selectedSubtitles?: string | null, resumeState?: DownloadState, playlistItems?: string) => Promise<void>;
  pauseDownload: (state: DownloadState) => Promise<void>;
  resumeDownload: (state: DownloadState) => Promise<void>;
  cancelDownload: (state: DownloadState) => Promise<void>;
}

export const AppContext = createContext<AppContextType>({
  fetchVideoMetadata: async () => (null),
  startDownload: async () => {},
  pauseDownload: async () => {},
  resumeDownload: async () => {},
  cancelDownload: async () => {}
});

export const useAppContext = () => useContext(AppContext);
