import { ThemeProvider } from "@/providers/themeProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { AppContext } from "@/providers/appContextProvider";
import { DownloadState } from "@/types/download";
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { arch, exeExtension } from "@tauri-apps/plugin-os";
import { downloadDir, join, resourceDir, tempDir } from "@tauri-apps/api/path";
import { useBasePathsStore, useCurrentVideoMetadataStore, useDownloaderPageStatesStore, useDownloadStatesStore, useKvPairsStatesStore, useSettingsPageStatesStore } from "@/services/store";
import { determineFileType, generateDownloadId, generateSafeFilePath, generateVideoId, isObjEmpty, parseProgressLine, sanitizeFilename } from "@/utils";
import { Command } from "@tauri-apps/plugin-shell";
import { RawVideoInfo } from "@/types/video";
import { useDeleteDownloadState, useSaveDownloadState, useSavePlaylistInfo, useSaveVideoInfo, useUpdateDownloadFilePath, useUpdateDownloadStatus } from "@/services/mutations";
import { useQueryClient } from "@tanstack/react-query";
import { useFetchAllDownloadStates, useFetchAllkVPairs, useFetchAllSettings } from "@/services/queries";
import { config } from "@/config";
import * as fs from "@tauri-apps/plugin-fs";
import { useYtDlpUpdater } from "@/helpers/use-ytdlp-updater";
import { getVersion } from "@tauri-apps/api/app";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { listen } from "@tauri-apps/api/event";
import { WebSocketMessage } from "@/types/websocket";
import { useNavigate } from "react-router-dom";
import { platform } from "@tauri-apps/plugin-os";
import { useMacOsRegisterer } from "@/helpers/use-macos-registerer";
import useAppUpdater from "@/helpers/use-app-updater";
import { useToast } from "@/hooks/use-toast";

export default function App({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  
  const { data: downloadStates, isSuccess: isSuccessFetchingDownloadStates } = useFetchAllDownloadStates();
  const { data: settings, isSuccess: isSuccessFetchingSettings } = useFetchAllSettings();
  const { data: kvPairs, isSuccess: isSuccessFetchingKvPairs } = useFetchAllkVPairs();
  const [isSettingsStatePropagated, setIsSettingsStatePropagated] = useState(false);
  const [isKvPairsStatePropagated, setIsKvPairsStatePropagated] = useState(false);
  const globalDownloadStates = useDownloadStatesStore((state) => state.downloadStates);
  const setDownloadStates = useDownloadStatesStore((state) => state.setDownloadStates);
  const setPath = useBasePathsStore((state) => state.setPath);
  
  const ffmpegPath = useBasePathsStore((state) => state.ffmpegPath);
  const tempDownloadDirPath = useBasePathsStore((state) => state.tempDownloadDirPath);
  const downloadDirPath = useBasePathsStore((state) => state.downloadDirPath);

  // const isUsingDefaultSettings = useSettingsPageStatesStore((state) => state.isUsingDefaultSettings);
  const setIsUsingDefaultSettings = useSettingsPageStatesStore((state) => state.setIsUsingDefaultSettings);
  const setSettingsKey = useSettingsPageStatesStore((state) => state.setSettingsKey);
  const appVersion = useSettingsPageStatesStore(state => state.appVersion);
  const ytDlpVersion = useSettingsPageStatesStore(state => state.ytDlpVersion);
  const setYtDlpVersion = useSettingsPageStatesStore((state) => state.setYtDlpVersion);
  const setIsFetchingYtDlpVersion = useSettingsPageStatesStore((state) => state.setIsFetchingYtDlpVersion);
  const setAppVersion = useSettingsPageStatesStore((state) => state.setAppVersion);
  const setIsFetchingAppVersion = useSettingsPageStatesStore((state) => state.setIsFetchingAppVersion);
  const YTDLP_AUTO_UPDATE = useSettingsPageStatesStore(state => state.settings.ytdlp_auto_update);
  const YTDLP_UPDATE_CHANNEL = useSettingsPageStatesStore(state => state.settings.ytdlp_update_channel);
  const APP_THEME = useSettingsPageStatesStore(state => state.settings.theme);
  const MAX_PARALLEL_DOWNLOADS = useSettingsPageStatesStore(state => state.settings.max_parallel_downloads);
  const MAX_RETRIES = useSettingsPageStatesStore(state => state.settings.max_retries);
  const DOWNLOAD_DIR = useSettingsPageStatesStore(state => state.settings.download_dir);
  const PREFER_VIDEO_OVER_PLAYLIST = useSettingsPageStatesStore(state => state.settings.prefer_video_over_playlist);
  const STRICT_DOWNLOADABILITY_CHECK = useSettingsPageStatesStore(state => state.settings.strict_downloadablity_check);
  const USE_PROXY = useSettingsPageStatesStore(state => state.settings.use_proxy);
  const PROXY_URL = useSettingsPageStatesStore(state => state.settings.proxy_url);
  const USE_RATE_LIMIT = useSettingsPageStatesStore(state => state.settings.use_rate_limit);
  const RATE_LIMIT = useSettingsPageStatesStore(state => state.settings.rate_limit);
  const VIDEO_FORMAT = useSettingsPageStatesStore(state => state.settings.video_format);
  const AUDIO_FORMAT = useSettingsPageStatesStore(state => state.settings.audio_format);
  const ALWAYS_REENCODE_VIDEO = useSettingsPageStatesStore(state => state.settings.always_reencode_video);
  const EMBED_VIDEO_METADATA = useSettingsPageStatesStore(state => state.settings.embed_video_metadata);
  const EMBED_AUDIO_METADATA = useSettingsPageStatesStore(state => state.settings.embed_audio_metadata);
  const EMBED_AUDIO_THUMBNAIL = useSettingsPageStatesStore(state => state.settings.embed_audio_thumbnail);

  const isErrored = useDownloaderPageStatesStore((state) => state.isErrored);
  const isErrorExpected = useDownloaderPageStatesStore((state) => state.isErrorExpected);
  const erroredDownloadId = useDownloaderPageStatesStore((state) => state.erroredDownloadId);
  const setIsErrored = useDownloaderPageStatesStore((state) => state.setIsErrored);
  const setIsErrorExpected = useDownloaderPageStatesStore((state) => state.setIsErrorExpected);
  const setErroredDownloadId = useDownloaderPageStatesStore((state) => state.setErroredDownloadId);

  const appWindow = getCurrentWebviewWindow()
  const navigate = useNavigate();
  const { updateYtDlp } = useYtDlpUpdater();
  const { registerToMac } = useMacOsRegisterer();
  const { checkForAppUpdate } = useAppUpdater();
  const setKvPairsKey = useKvPairsStatesStore((state) => state.setKvPairsKey);
  const ytDlpUpdateLastCheck = useKvPairsStatesStore(state => state.kvPairs.ytdlp_update_last_check);
  const macOsRegisteredVersion = useKvPairsStatesStore(state => state.kvPairs.macos_registered_version);
  
  const queryClient = useQueryClient();
  const downloadStateSaver = useSaveDownloadState();
  const downloadStatusUpdater = useUpdateDownloadStatus();
  const downloadFilePathUpdater = useUpdateDownloadFilePath();
  const videoInfoSaver = useSaveVideoInfo();
  const downloadStateDeleter = useDeleteDownloadState();
  const playlistInfoSaver = useSavePlaylistInfo();
  
  const ongoingDownloads = globalDownloadStates.filter(state => state.download_status === 'downloading' || state.download_status === 'starting');
  const queuedDownloads = globalDownloadStates.filter(state => state.download_status === 'queued').sort((a, b) => a.queue_index! - b.queue_index!);

  const isProcessingQueueRef = useRef(false);
  const lastProcessedDownloadIdRef = useRef<string | null>(null);
  const hasRunYtDlpAutoUpdateRef = useRef(false);
  const isRegisteredToMacOsRef = useRef(false);
  
  const fetchVideoMetadata = async (url: string, formatId?: string, playlistIndex?: string): Promise<RawVideoInfo | null> => {
    try {
      const args = [url, '--dump-single-json', '--no-warnings'];
      if (formatId) args.push('-f', formatId);
      if (playlistIndex) args.push('--playlist-items', playlistIndex);
      if (PREFER_VIDEO_OVER_PLAYLIST) args.push('--no-playlist');
      if (STRICT_DOWNLOADABILITY_CHECK && !formatId) args.push('--check-all-formats');
      if (STRICT_DOWNLOADABILITY_CHECK && formatId) args.push('--check-formats');
      if (USE_PROXY && PROXY_URL) args.push('--proxy', PROXY_URL);
      const command = Command.sidecar('binaries/yt-dlp', args);

      let jsonOutput = '';

      return new Promise<RawVideoInfo | null>((resolve) => {
        command.stdout.on('data', line => {
          jsonOutput += line;
        });

        command.on('close', async () => {
          try {
            const data: RawVideoInfo = JSON.parse(jsonOutput);
            resolve(data);
          }
          catch (e) {
            console.error(`Failed to parse JSON: ${e}`);
            resolve(null);
          }
        });

        command.on('error', error => {
          console.error(`Error fetching metadata: ${error}`);
          resolve(null);
        });

        command.spawn().catch(e => {
          console.error(`Failed to spawn command: ${e}`);
          resolve(null);
        });
      });
    } catch (e) {
      console.error(`Failed to fetch metadata: ${e}`);
      return null;
    }
  };
  
  const startDownload = async (url: string, selectedFormat: string, selectedSubtitles?: string | null, resumeState?: DownloadState, playlistItems?: string) => {
    // set error states to default
    setIsErrored(false);
    setIsErrorExpected(false);
    setErroredDownloadId(null);

    console.log('Starting download:', { url, selectedFormat, selectedSubtitles, resumeState, playlistItems });
    if (!ffmpegPath || !tempDownloadDirPath || !downloadDirPath) {
      console.error('FFmpeg or download paths not found');
      return;
    }
    
    const isPlaylist = (playlistItems && typeof playlistItems === 'string') || (resumeState?.playlist_id && resumeState?.playlist_index) ? true : false;
    const playlistIndex = isPlaylist ? (resumeState?.playlist_index?.toString() || playlistItems) : null;
    let videoMetadata = await fetchVideoMetadata(url, selectedFormat, isPlaylist && playlistIndex && typeof playlistIndex === 'string' ? playlistIndex : undefined);
    if (!videoMetadata) {
      console.error('Failed to fetch video metadata');
      toast({
        title: 'Download Failed',
        description: 'yt-dlp failed to fetch video metadata. Please try again later.',
        variant: 'destructive',
      });
      return;
    }

    console.log('Video Metadata:', videoMetadata);
    videoMetadata = isPlaylist ? videoMetadata.entries[0] : videoMetadata;

    const fileType = determineFileType(videoMetadata.vcodec, videoMetadata.acodec);

    if (fileType !== 'unknown' && (VIDEO_FORMAT !== 'auto' || AUDIO_FORMAT !== 'auto')) {
      if (VIDEO_FORMAT !== 'auto' && (fileType === 'video+audio' || fileType === 'video')) videoMetadata.ext = VIDEO_FORMAT;
      if (AUDIO_FORMAT !== 'auto' && fileType === 'audio') videoMetadata.ext = AUDIO_FORMAT;
    }

    const videoId = resumeState?.video_id || generateVideoId(videoMetadata.id, videoMetadata.webpage_url_domain);
    const playlistId = isPlaylist ? (resumeState?.playlist_id || generateVideoId(videoMetadata.playlist_id, videoMetadata.webpage_url_domain)) : null;
    const downloadId = resumeState?.download_id || generateDownloadId(videoMetadata.id, videoMetadata.webpage_url_domain);
    const tempDownloadPathForYtdlp = await join(tempDownloadDirPath, `${downloadId}_${selectedFormat}.%(ext)s`);
    const tempDownloadPath = await join(tempDownloadDirPath, `${downloadId}_${selectedFormat}.${videoMetadata.ext}`);
    let downloadFilePath = resumeState?.filepath || await join(downloadDirPath, sanitizeFilename(`${videoMetadata.title}_${videoMetadata.resolution || 'unknown'}[${videoMetadata.id}].${videoMetadata.ext}`));
    let processPid: number | null = null;
    const args = [
      url,
      '--newline',
      '--progress-template',
      'status:%(progress.status)s,progress:%(progress._percent_str)s,speed:%(progress.speed)f,downloaded:%(progress.downloaded_bytes)d,total:%(progress.total_bytes)d,eta:%(progress.eta)d',
      '--output',
      tempDownloadPathForYtdlp,
      '--ffmpeg-location',
      ffmpegPath,
      '-f',
      selectedFormat,
      '--no-mtime',
      '--no-warnings',
      '--retries',
      MAX_RETRIES.toString(),
    ];

    if (selectedSubtitles) {
      args.push('--embed-subs', '--sub-lang', selectedSubtitles);
    }

    if (isPlaylist && playlistIndex && typeof playlistIndex === 'string') {
      args.push('--playlist-items', playlistIndex);
    }

    if (fileType !== 'unknown' && (VIDEO_FORMAT !== 'auto' || AUDIO_FORMAT !== 'auto')) {
      if (VIDEO_FORMAT !== 'auto' && fileType === 'video+audio') {
        if (ALWAYS_REENCODE_VIDEO) {
          args.push('--recode-video', VIDEO_FORMAT);
        } else {
          args.push('--merge-output-format', VIDEO_FORMAT);
        }
      }
      if (VIDEO_FORMAT !== 'auto' && fileType === 'video') {
        if (ALWAYS_REENCODE_VIDEO) {
          args.push('--recode-video', VIDEO_FORMAT);
        } else {
        args.push('--remux-video', VIDEO_FORMAT);
        }
      }
      if (AUDIO_FORMAT !== 'auto' && fileType === 'audio') {
        args.push('--extract-audio', '--audio-format', AUDIO_FORMAT);
      }
    }

    if (fileType !== 'unknown' && (EMBED_VIDEO_METADATA || EMBED_AUDIO_METADATA)) {
      if (EMBED_VIDEO_METADATA && (fileType === 'video+audio' || fileType === 'video')) {
        args.push('--embed-metadata');
      }
      if (EMBED_AUDIO_METADATA && fileType === 'audio') {
        args.push('--embed-metadata');
      }
    }

    if (EMBED_AUDIO_THUMBNAIL && fileType === 'audio') {
      args.push('--embed-thumbnail');
    }

    if (resumeState) {
      args.push('--continue');
    } else {
      args.push('--no-continue');
    }

    if (USE_PROXY && PROXY_URL) {
      args.push('--proxy', PROXY_URL);
    }

    if (USE_RATE_LIMIT && RATE_LIMIT) {
      args.push('--limit-rate', `${RATE_LIMIT}`);
    }

    console.log('Starting download with args:', args);
    const command = Command.sidecar('binaries/yt-dlp', args);

    command.on('close', async data => {
      if (data.code !== 0) {
        console.error(`Download failed with code ${data.code}`);
        if (!isErrorExpected) {
          setIsErrored(true);
          setErroredDownloadId(downloadId);
        }
      } else {
        if (await fs.exists(tempDownloadPath)) {
          downloadFilePath = await generateSafeFilePath(downloadFilePath);
          await fs.copyFile(tempDownloadPath, downloadFilePath);
          await fs.remove(tempDownloadPath);
        }
        
        downloadFilePathUpdater.mutate({ download_id: downloadId, filepath: downloadFilePath }, {
          onSuccess: (data) => {
            console.log("Download filepath updated successfully:", data);
            queryClient.invalidateQueries({ queryKey: ['download-states'] });
          },
          onError: (error) => {
            console.error("Failed to update download filepath:", error);
          }
        })
        
        downloadStatusUpdater.mutate({ download_id: downloadId, download_status: 'completed' }, {
          onSuccess: (data) => {
            console.log("Download status updated successfully:", data);
            queryClient.invalidateQueries({ queryKey: ['download-states'] });
          },
          onError: (error) => {
            console.error("Failed to update download status:", error);
          }
        })
      }
    });

    command.on('error', error => {
      console.error(`Error: ${error}`);
    });

    command.stdout.on('data', line => {
      if (line.startsWith('status:')) {
        const currentProgress = parseProgressLine(line);
        const state: DownloadState = {
          download_id: downloadId,
          download_status: 'downloading',
          video_id: videoId,
          format_id: selectedFormat,
          subtitle_id: selectedSubtitles || null,
          queue_index: null,
          playlist_id: playlistId,
          playlist_index: playlistIndex ? Number(playlistIndex) : null,
          title: videoMetadata.title,
          url: url,
          host: videoMetadata.webpage_url_domain,
          thumbnail: videoMetadata.thumbnail || null,
          channel: videoMetadata.channel || null,
          duration_string: videoMetadata.duration_string || null,
          release_date: videoMetadata.release_date || null,
          view_count: videoMetadata.view_count || null,
          like_count: videoMetadata.like_count || null,
          playlist_title: videoMetadata.playlist_title,
          playlist_url: videoMetadata.playlist_webpage_url,
          playlist_n_entries: videoMetadata.playlist_count || videoMetadata.n_entries,
          playlist_channel: videoMetadata.playlist_channel || null,
          resolution: videoMetadata.resolution || null,
          ext: videoMetadata.ext || null,
          abr: videoMetadata.abr || null,
          vbr: videoMetadata.vbr || null,
          acodec: videoMetadata.acodec || null,
          vcodec: videoMetadata.vcodec || null,
          dynamic_range: videoMetadata.dynamic_range || null,
          process_id: processPid,
          status: currentProgress.status || null,
          progress: currentProgress.progress || null,
          total: currentProgress.total || null,
          downloaded: currentProgress.downloaded || null,
          speed: currentProgress.speed || null,
          eta: currentProgress.eta || null,
          filepath: downloadFilePath,
          filetype: determineFileType(videoMetadata.vcodec, videoMetadata.acodec) || null,
          filesize: videoMetadata.filesize_approx || null
        };
        downloadStateSaver.mutate(state, {
          onSuccess: (data) => {
            console.log("Download State saved successfully:", data);
            queryClient.invalidateQueries({ queryKey: ['download-states'] });
          },
          onError: (error) => {
            console.error("Failed to save download state:", error);
          }
        })
      } else {
        console.log(line);
      }
    });

    try {
      videoInfoSaver.mutate({
        video_id: videoId,
        title: videoMetadata.title,
        url: url,
        host: videoMetadata.webpage_url_domain,
        thumbnail: videoMetadata.thumbnail || null,
        channel: videoMetadata.channel || videoMetadata.uploader || null,
        duration_string: videoMetadata.duration_string || null,
        release_date: videoMetadata.release_date || null,
        view_count: videoMetadata.view_count || null,
        like_count: videoMetadata.like_count || null
      }, {
        onSuccess: (data) => {
          console.log("Video Info saved successfully:", data);
          if (isPlaylist) {
            playlistInfoSaver.mutate({
              playlist_id: playlistId ? playlistId : '',
              playlist_title: videoMetadata.playlist_title,
              playlist_url: videoMetadata.playlist_webpage_url,
              playlist_n_entries: videoMetadata.playlist_count || videoMetadata.n_entries,
              playlist_channel: videoMetadata.playlist_channel || null
            }, {
              onSuccess: (data) => {
                console.log("Playlist Info saved successfully:", data);
              },
              onError: (error) => {
                console.error("Failed to save playlist info:", error);
              }
            })
          }
          const state: DownloadState = {
            download_id: downloadId,
            download_status: (!ongoingDownloads || ongoingDownloads && ongoingDownloads?.length < MAX_PARALLEL_DOWNLOADS) ? 'starting' : 'queued',
            video_id: videoId,
            format_id: selectedFormat,
            subtitle_id: selectedSubtitles || null,
            queue_index: (!ongoingDownloads || ongoingDownloads && ongoingDownloads?.length < MAX_PARALLEL_DOWNLOADS) ? null : (queuedDownloads?.length || 0),
            playlist_id: playlistId,
            playlist_index: playlistIndex ? Number(playlistIndex) : null,
            title: videoMetadata.title,
            url: url,
            host: videoMetadata.webpage_url_domain,
            thumbnail: videoMetadata.thumbnail || null,
            channel: videoMetadata.channel || null,
            duration_string: videoMetadata.duration_string || null,
            release_date: videoMetadata.release_date || null,
            view_count: videoMetadata.view_count || null,
            like_count: videoMetadata.like_count || null,
            playlist_title: videoMetadata.playlist_title,
            playlist_url: videoMetadata.playlist_webpage_url,
            playlist_n_entries: videoMetadata.playlist_count || videoMetadata.n_entries,
            playlist_channel: videoMetadata.playlist_channel || null,
            resolution: resumeState?.resolution || null,
            ext: resumeState?.ext || null,
            abr: resumeState?.abr || null,
            vbr: resumeState?.vbr || null,
            acodec: resumeState?.acodec || null,
            vcodec: resumeState?.vcodec || null,
            dynamic_range: resumeState?.dynamic_range || null,
            process_id: resumeState?.process_id || null,
            status: resumeState?.status || null,
            progress: resumeState?.progress || null,
            total: resumeState?.total || null,
            downloaded: resumeState?.downloaded || null,
            speed: resumeState?.speed || null,
            eta: resumeState?.eta || null,
            filepath: downloadFilePath,
            filetype: resumeState?.filetype || null,
            filesize: resumeState?.filesize || null
          }
          downloadStateSaver.mutate(state, {
            onSuccess: (data) => {
              console.log("Download State saved successfully:", data);
              queryClient.invalidateQueries({ queryKey: ['download-states'] });
            },
            onError: (error) => {
              console.error("Failed to save download state:", error);
            }
          })
        },
        onError: (error) => {
          console.error("Failed to save video info:", error);
        }
      })

      if (!ongoingDownloads || ongoingDownloads && ongoingDownloads?.length < MAX_PARALLEL_DOWNLOADS) {
        const child = await command.spawn();
        processPid = child.pid;
        return Promise.resolve();
      } else {
        console.log("Download is queued, not starting immediately.");
        return Promise.resolve();
      }
    } catch (e) {
      console.error(`Failed to start download: ${e}`);
      throw e;
    }
  };
  
  const pauseDownload = async (downloadState: DownloadState) => {
    try {
      setIsErrorExpected(true);  // Set error expected to true to handle UI state
      console.log("Killing process with PID:", downloadState.process_id);
      await invoke('kill_all_process', { pid: downloadState.process_id });
      downloadStatusUpdater.mutate({ download_id: downloadState.download_id, download_status: 'paused' }, {
        onSuccess: (data) => {
          console.log("Download status updated successfully:", data);
          queryClient.invalidateQueries({ queryKey: ['download-states'] });
          // Reset the processing flag to ensure queue can be processed
          isProcessingQueueRef.current = false;
          
          // Process the queue after a short delay to ensure state is updated
          setTimeout(() => {
            processQueuedDownloads();
          }, 1000);
        },
        onError: (error) => {
          console.error("Failed to update download status:", error);
        }
      })
      return Promise.resolve();
    } catch (e) {
      console.error(`Failed to pause download: ${e}`);
      isProcessingQueueRef.current = false;
      throw e;
    }
  };
  
  const resumeDownload = async (downloadState: DownloadState) => {
    try {
      await startDownload(
        downloadState.playlist_id && downloadState.playlist_index ? downloadState.playlist_url : downloadState.url,
        downloadState.format_id,
        downloadState.subtitle_id,
        downloadState
      );
      return Promise.resolve();
    } catch (e) {
      console.error(`Failed to resume download: ${e}`);
      throw e;
    }
  };

  const cancelDownload = async (downloadState: DownloadState) => {
    try {
      if ((downloadState.download_status === 'downloading' && downloadState.process_id) || (downloadState.download_status === 'starting' && downloadState.process_id)) {
        setIsErrorExpected(true); // Set error expected to true to handle UI state
        console.log("Killing process with PID:", downloadState.process_id);
        await invoke('kill_all_process', { pid: downloadState.process_id });
      }
      downloadStateDeleter.mutate(downloadState.download_id, {
        onSuccess: (data) => {
          console.log("Download State deleted successfully:", data);
          queryClient.invalidateQueries({ queryKey: ['download-states'] });
          // Reset processing flag and trigger queue processing
          isProcessingQueueRef.current = false;
          
          // Process the queue after a short delay
          setTimeout(() => {
            processQueuedDownloads();
          }, 1000);
        },
        onError: (error) => {
          console.error("Failed to delete download state:", error);
          isProcessingQueueRef.current = false;
        }
      })
      return Promise.resolve();
    } catch (e) {
      console.error(`Failed to cancel download: ${e}`);
      throw e;
    }
  }

  const processQueuedDownloads = useCallback(async () => {
    // Prevent concurrent processing
    if (isProcessingQueueRef.current) {
      console.log("Queue processing already in progress, skipping...");
      return;
    }

    // Check if we can process more downloads
    if (!queuedDownloads?.length || ongoingDownloads?.length >= MAX_PARALLEL_DOWNLOADS) {
      return;
    }

    try {
      isProcessingQueueRef.current = true;
      console.log("Processing download queue...");
      
      // Get the first download in queue
      const downloadToStart = queuedDownloads[0];
      
      // Skip if we just processed this download to prevent loops
      if (lastProcessedDownloadIdRef.current === downloadToStart.download_id) {
        console.log("Skipping recently processed download:", downloadToStart.download_id);
        return;
      }
      
      // Double-check current state from global state
      const currentState = globalDownloadStates.find(
        state => state.download_id === downloadToStart.download_id
      );
      
      if (!currentState || currentState.download_status !== 'queued') {
        console.log("Download no longer in queued state:", downloadToStart.download_id);
        return;
      }
      
      console.log("Starting queued download:", downloadToStart.download_id);
      lastProcessedDownloadIdRef.current = downloadToStart.download_id;
      
      // Update status to 'starting' first
      await downloadStatusUpdater.mutateAsync({
        download_id: downloadToStart.download_id,
        download_status: 'starting'
      });
      
      // Fetch latest state after status update
      await queryClient.invalidateQueries({ queryKey: ['download-states'] });

      // Start the download
      await startDownload(
        downloadToStart.url,
        downloadToStart.format_id,
        downloadToStart.subtitle_id,
        downloadToStart
      );
      
    } catch (error) {
      console.error("Error processing download queue:", error);
    } finally {
      // Important: reset the processing flag
      setTimeout(() => {
        isProcessingQueueRef.current = false;
        console.log("Queue processor released lock");
      }, 1000); // Small delay to prevent rapid re-processing
    }
  }, [queuedDownloads, ongoingDownloads, globalDownloadStates, queryClient]);

  // Prevent right click context menu in production
  if (!import.meta.env.DEV) {
    document.oncontextmenu = (event) => {
        event.preventDefault()
    }
  }

  // Check for App updates
  useEffect(() => {
    checkForAppUpdate().catch((error) => {
      console.error("Error checking for app update:", error);
    });
  }, []);
  
  // Prevent app from closing
  useEffect(() => {
    const handleCloseRequested = (event: any) => {
      event.preventDefault();
      appWindow.hide();
    };

    appWindow.onCloseRequested(handleCloseRequested);
  }, []);

  // Listen for websocket messages
  useEffect(() => {
    const unlisten = listen<WebSocketMessage>('websocket-message', (event) => {
      if(event.payload.command === 'download') {
        const handleDownload = async () => {
          appWindow.show();
          appWindow.setFocus();
          navigate('/');
          if (event.payload.url) {
            const { setRequestedUrl, setAutoSubmitSearch } = useCurrentVideoMetadataStore.getState();
            setRequestedUrl(event.payload.url);
            setAutoSubmitSearch(true);
          }
        }
        handleDownload().catch((error) => {
          console.error("Error handling download:", error);
        });
      }
    });

    return () => {
      unlisten.then(f => f());
    };
  }, []);

  // useEffect(() => {
  //   const fetchConfigPath = async () => {
  //     const configPath = await invoke('get_config_file_path');
  //     console.log("Config path fetched successfully:", configPath);
  //   };

  //   fetchConfigPath().catch((error) => {
  //     console.error("Error fetching config path:", error);
  //   });
  // }, []);

  // Fetch download states from database and sync with state
  useEffect(() => {
    if (isSuccessFetchingSettings && settings) {
      console.log("Settings fetched successfully:", settings);
      if (!isObjEmpty(settings)) {
        setIsUsingDefaultSettings(false);
        Object.keys(settings).forEach((key) => {
          setSettingsKey(key, settings[key]);
        });
      }
      else {
        setIsUsingDefaultSettings(true);
      }
      setIsSettingsStatePropagated(true);
    }
  }, [settings, isSuccessFetchingSettings]);

  // Fetch KV pairs from database and sync with state
  useEffect(() => {
    if (isSuccessFetchingKvPairs && kvPairs) {
      console.log("KvPairs fetched successfully:", kvPairs);
      if (!isObjEmpty(kvPairs)) {
        Object.keys(kvPairs).forEach((key) => {
          setKvPairsKey(key, kvPairs[key]);
        });
      }
      setIsKvPairsStatePropagated(true);
    }
  }, [kvPairs, isSuccessFetchingKvPairs]);
  
  // Initiate/Resolve base app paths
  useEffect(() => {
    const initPaths = async () => {
      try {
        const currentArch = arch();
        const currentExeExtension = exeExtension();
        const downloadDirPath = await downloadDir();
        const tempDirPath = await tempDir();
        const resourceDirPath = await resourceDir();
        
        const ffmpegPath = await join(resourceDirPath, 'binaries', `ffmpeg-${currentArch}${currentExeExtension ? '.' + currentExeExtension : ''}`);
        const tempDownloadDirPath = await join(tempDirPath, config.appPkgName, 'downloads');
        const appDownloadDirPath = await join(downloadDirPath, config.appName);

        if(!await fs.exists(tempDownloadDirPath)) fs.mkdir(tempDownloadDirPath, { recursive: true }).then(() => { console.log(`Created DIR: ${tempDownloadDirPath}`) });
        
        setPath('ffmpegPath', ffmpegPath);
        setPath('tempDownloadDirPath', tempDownloadDirPath);
        if (DOWNLOAD_DIR) {
          setPath('downloadDirPath', DOWNLOAD_DIR);
        } else {
          if(!await fs.exists(appDownloadDirPath)) fs.mkdir(appDownloadDirPath, { recursive: true }).then(() => { console.log(`Created DIR: ${appDownloadDirPath}`) });
          setPath('downloadDirPath', appDownloadDirPath);
        }
        console.log('Paths initialized:', { ffmpegPath, tempDownloadDirPath, downloadDirPath: DOWNLOAD_DIR || appDownloadDirPath });
      } catch (e) {
        console.error('Failed to fetch paths:', e);
      }
    };
    initPaths();
  }, [DOWNLOAD_DIR, setPath]);

  // Fetch app version
  useEffect(() => {
    const fetchAppVersion = async () => {
      setIsFetchingAppVersion(true);
      try {
        const version = await getVersion();
        console.log("App version fetched successfully:", version);
        setAppVersion(version);
      } catch (e) {
        console.error('Failed to fetch app version:', e);
      } finally {
        setIsFetchingAppVersion(false);
      }
    }
    fetchAppVersion();
  }, []);

  // Fetch yt-dlp version
  useEffect(() => {
    const fetchYtDlpVersion = async () => {
      setIsFetchingYtDlpVersion(true);
      try {
        const command = Command.sidecar('binaries/yt-dlp', ['--version']);
        const output = await command.execute();
        if (output.code === 0) {
          const version = output.stdout.trim();
          console.log("yt-dlp version fetched successfully:", version);
          setYtDlpVersion(version);
        } else {
          console.error("Failed to fetch yt-dlp version:", output.stderr);
        }
      } catch (e) {
        console.error('Failed to fetch yt-dlp version:', e);
      } finally {
        setIsFetchingYtDlpVersion(false);
      }
    };
    fetchYtDlpVersion();
  }, [ytDlpVersion, setYtDlpVersion]);

  // Check for yt-dlp auto-update
  useEffect(() => {
    // Only run once when both settings and KV pairs are loaded
    if (!isSettingsStatePropagated || !isKvPairsStatePropagated) {
      console.log("Skipping yt-dlp auto-update check, waiting for configs to load...");
      return;
    }
    // Skip if we've already run the auto-update once
    if (hasRunYtDlpAutoUpdateRef.current) {
      console.log("Auto-update check already performed in this session, skipping");
      return;
    }
    hasRunYtDlpAutoUpdateRef.current = true;
    console.log("Checking yt-dlp auto-update with loaded config values:", {
      autoUpdate: YTDLP_AUTO_UPDATE,
      updateChannel: YTDLP_UPDATE_CHANNEL,
      lastCheck: ytDlpUpdateLastCheck
    });
    const currentTimestamp = Date.now()
    const YTDLP_UPDATE_INTERVAL = 86400000   // 24H;
    if (YTDLP_AUTO_UPDATE && (ytDlpUpdateLastCheck === null || currentTimestamp - ytDlpUpdateLastCheck > YTDLP_UPDATE_INTERVAL)) {
      console.log("Running auto-update for yt-dlp...");
      updateYtDlp();
    } else {
      console.log("Skipping yt-dlp auto-update, either disabled or recently updated.");
    }
  }, [isSettingsStatePropagated, isKvPairsStatePropagated]);

  // Check for MacOS auto-registration
  useEffect(() => {
    // Only run once when both settings and KV pairs are loaded
    if (!isSettingsStatePropagated || !isKvPairsStatePropagated) {
      console.log("Skipping MacOS auto registration, waiting for configs to load...");
      return;
    }
    // Skip if we've already run the macos auto-registration once
    if (isRegisteredToMacOsRef.current) {
      console.log("MacOS auto registration check already performed in this session, skipping");
      return;
    }
    isRegisteredToMacOsRef.current = true;
    console.log("Checking MacOS auto registration with loaded config values:", {
      appVersion: appVersion,
      registeredVersion: macOsRegisteredVersion
    });
    const currentPlatform = platform();
    if (currentPlatform === 'macos' && (!macOsRegisteredVersion || macOsRegisteredVersion !== appVersion)) {
      console.log("Running MacOS auto registration...");
      registerToMac().then((result: { success: boolean, message: string }) => {
        if (result.success) {
          console.log("MacOS registration successful:", result.message);
        } else {
          console.error("MacOS registration failed:", result.message);
        }
      }).catch((error) => {
        console.error("Error during macOS registration:", error);
      });
    }
  }, [isSettingsStatePropagated, isKvPairsStatePropagated]);
  
  useEffect(() => {
    if (isSuccessFetchingDownloadStates && downloadStates) {
      console.log("Download States fetched successfully:", downloadStates);
      setDownloadStates(downloadStates);
    }
  }, [downloadStates, isSuccessFetchingDownloadStates, setDownloadStates]);

  // Process queued downloads
  useEffect(() => {
    // Safely process the queue when dependencies change
    const timeoutId = setTimeout(() => {
      processQueuedDownloads();
    }, 500);
    
    // Cleanup timeout if component unmounts or dependencies change
    return () => clearTimeout(timeoutId);
  }, [processQueuedDownloads, ongoingDownloads, queuedDownloads]);

  // show a toast and pause the download when yt-dlp exits unexpectedly
  useEffect(() => {
    if (isErrored && !isErrorExpected) {
      toast({
        title: "Download Failed",
        description: "yt-dlp exited unexpectedly. Please try again later",
        variant: "destructive",
      });
      if (erroredDownloadId) {
        downloadStatusUpdater.mutate({ download_id: erroredDownloadId, download_status: 'paused' }, {
          onSuccess: (data) => {
            console.log("Download status updated successfully:", data);
            queryClient.invalidateQueries({ queryKey: ['download-states'] });
          },
          onError: (error) => {
            console.error("Failed to update download status:", error);
          }
        })
        setErroredDownloadId(null);
      }
      setIsErrored(false);
      setIsErrorExpected(false);
    }
  }, [isErrored, isErrorExpected, erroredDownloadId, setIsErrored, setIsErrorExpected, setErroredDownloadId]);

  // auto reset error states after 3 seconds of expecting an error
  useEffect(() => {
    if (isErrorExpected) {
      const timeoutId = setTimeout(() => {
        setIsErrored(false);
        setIsErrorExpected(false);
        setErroredDownloadId(null);
      }, 3000);
      return () => clearTimeout(timeoutId);
    }
  }, [isErrorExpected, setIsErrorExpected]);

  return (
    <AppContext.Provider value={{ fetchVideoMetadata, startDownload, pauseDownload, resumeDownload, cancelDownload }}>
      <ThemeProvider defaultTheme={APP_THEME || "system"} storageKey="vite-ui-theme">
          <TooltipProvider delayDuration={1000}>
            {children}
            <Toaster />
          </TooltipProvider>
      </ThemeProvider>
    </AppContext.Provider>
  );
}