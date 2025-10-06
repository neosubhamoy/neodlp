import { ThemeProvider } from "@/providers/themeProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppContext } from "@/providers/appContextProvider";
import { DownloadState } from "@/types/download";
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { arch, exeExtension } from "@tauri-apps/plugin-os";
import { downloadDir, join, resourceDir, tempDir } from "@tauri-apps/api/path";
import { useBasePathsStore, useCurrentVideoMetadataStore, useDownloaderPageStatesStore, useDownloadStatesStore, useKvPairsStatesStore, useSettingsPageStatesStore } from "@/services/store";
import { determineFileType, generateVideoId, isObjEmpty, parseProgressLine } from "@/utils";
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
import { Toaster as Sonner } from "@/components/ui/sonner";
import { toast } from "sonner";
import { useLogger } from "@/helpers/use-logger";
import { DownloadConfiguration } from "@/types/settings";
import { ulid } from "ulid";

export default function App({ children }: { children: React.ReactNode }) {
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

  const setSearchPid = useCurrentVideoMetadataStore((state) => state.setSearchPid);

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
  const USE_COOKIES = useSettingsPageStatesStore(state => state.settings.use_cookies);
  const IMPORT_COOKIES_FROM = useSettingsPageStatesStore(state => state.settings.import_cookies_from);
  const COOKIES_BROWSER = useSettingsPageStatesStore(state => state.settings.cookies_browser);
  const COOKIES_FILE = useSettingsPageStatesStore(state => state.settings.cookies_file);
  const USE_SPONSORBLOCK = useSettingsPageStatesStore(state => state.settings.use_sponsorblock);
  const SPONSORBLOCK_MODE = useSettingsPageStatesStore(state => state.settings.sponsorblock_mode);
  const SPONSORBLOCK_REMOVE = useSettingsPageStatesStore(state => state.settings.sponsorblock_remove);
  const SPONSORBLOCK_MARK = useSettingsPageStatesStore(state => state.settings.sponsorblock_mark);
  const SPONSORBLOCK_REMOVE_CATEGORIES = useSettingsPageStatesStore(state => state.settings.sponsorblock_remove_categories);
  const SPONSORBLOCK_MARK_CATEGORIES = useSettingsPageStatesStore(state => state.settings.sponsorblock_mark_categories);
  const USE_ARIA2 = useSettingsPageStatesStore(state => state.settings.use_aria2);
  const USE_FORCE_INTERNET_PROTOCOL = useSettingsPageStatesStore(state => state.settings.use_force_internet_protocol);
  const FORCE_INTERNET_PROTOCOL = useSettingsPageStatesStore(state => state.settings.force_internet_protocol);
  const USE_CUSTOM_COMMANDS = useSettingsPageStatesStore(state => state.settings.use_custom_commands);
  const CUSTOM_COMMANDS = useSettingsPageStatesStore(state => state.settings.custom_commands);

  const isErrored = useDownloaderPageStatesStore((state) => state.isErrored);
  const isErrorExpected = useDownloaderPageStatesStore((state) => state.isErrorExpected);
  const erroredDownloadId = useDownloaderPageStatesStore((state) => state.erroredDownloadId);
  const setIsErrored = useDownloaderPageStatesStore((state) => state.setIsErrored);
  const setIsErrorExpected = useDownloaderPageStatesStore((state) => state.setIsErrorExpected);
  const setErroredDownloadId = useDownloaderPageStatesStore((state) => state.setErroredDownloadId);

  const appWindow = getCurrentWebviewWindow()
  const navigate = useNavigate();
  const LOG = useLogger();
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

  const fetchVideoMetadata = async (url: string, formatId?: string, playlistIndex?: string, selectedSubtitles?: string | null, resumeState?: DownloadState, downloadConfig?: DownloadConfiguration): Promise<RawVideoInfo | null> => {
    try {
      const args = [url, '--dump-single-json', '--no-warnings'];
      if (formatId) args.push('-f', formatId);
      if (selectedSubtitles) args.push('--embed-subs', '--sub-lang', selectedSubtitles);
      if (playlistIndex) args.push('--playlist-items', playlistIndex);
      if (PREFER_VIDEO_OVER_PLAYLIST && !playlistIndex) args.push('--no-playlist');
      if (STRICT_DOWNLOADABILITY_CHECK && !formatId) args.push('--check-all-formats');
      if (STRICT_DOWNLOADABILITY_CHECK && formatId) args.push('--check-formats');

      if ((USE_CUSTOM_COMMANDS && CUSTOM_COMMANDS && downloadConfig?.custom_command) || resumeState?.custom_command) {
        let customCommandArgs = null;
        if (resumeState?.custom_command) {
          customCommandArgs = resumeState.custom_command;
        } else if (CUSTOM_COMMANDS.find(cmd => cmd.id === downloadConfig?.custom_command)) {
          let customCommand = CUSTOM_COMMANDS.find(cmd => cmd.id === downloadConfig?.custom_command);
          customCommandArgs = customCommand ? customCommand.args : '';
        }
        if (customCommandArgs && customCommandArgs.trim() !== '') args.push(...customCommandArgs.split(' '));
      }

      if ((!USE_CUSTOM_COMMANDS && !resumeState?.custom_command) && USE_PROXY && PROXY_URL) args.push('--proxy', PROXY_URL);
      if ((!USE_CUSTOM_COMMANDS && !resumeState?.custom_command) && USE_FORCE_INTERNET_PROTOCOL && FORCE_INTERNET_PROTOCOL) {
        if (FORCE_INTERNET_PROTOCOL === 'ipv4') {
          args.push('--force-ipv4');
        } else if (FORCE_INTERNET_PROTOCOL === 'ipv6') {
          args.push('--force-ipv6');
        }
      }
      if ((!USE_CUSTOM_COMMANDS && !resumeState?.custom_command) && USE_COOKIES) {
        if (IMPORT_COOKIES_FROM === 'browser' && COOKIES_BROWSER) {
          args.push('--cookies-from-browser', COOKIES_BROWSER);
        } else if (IMPORT_COOKIES_FROM === 'file' && COOKIES_FILE) {
          args.push('--cookies', COOKIES_FILE);
        }
      }
      if ((!USE_CUSTOM_COMMANDS && !resumeState?.custom_command) && (USE_SPONSORBLOCK || (resumeState?.sponsorblock_remove || resumeState?.sponsorblock_mark))) {
        if (SPONSORBLOCK_MODE === 'remove' || resumeState?.sponsorblock_remove) {
          let sponsorblockRemove = resumeState?.sponsorblock_remove || (SPONSORBLOCK_REMOVE === 'custom' ? (
          SPONSORBLOCK_REMOVE_CATEGORIES.length > 0 ? SPONSORBLOCK_REMOVE_CATEGORIES.join(',') : 'default'
          ) : (SPONSORBLOCK_REMOVE));
          args.push('--sponsorblock-remove', sponsorblockRemove);
        } else if (SPONSORBLOCK_MODE === 'mark' || resumeState?.sponsorblock_mark) {
          let sponsorblockMark = resumeState?.sponsorblock_mark || (SPONSORBLOCK_MARK === 'custom' ? (
          SPONSORBLOCK_MARK_CATEGORIES.length > 0 ? SPONSORBLOCK_MARK_CATEGORIES.join(',') : 'default'
          ) : (SPONSORBLOCK_MARK));
          args.push('--sponsorblock-mark', sponsorblockMark);
        }
      };
      const command = Command.sidecar('binaries/yt-dlp', args);

      let jsonOutput = '';

      return new Promise<RawVideoInfo | null>((resolve) => {
        command.stdout.on('data', line => {
          jsonOutput += line;
        });

        command.on('close', async (data) => {
          if (data.code !== 0) {
            console.error(`yt-dlp failed to fetch metadata with code ${data.code}`);
            LOG.error('NEODLP', `yt-dlp exited with code ${data.code} while fetching metadata for URL: ${url} (ignore if you manually cancelled)`);
            resolve(null);
          } else {
            try {
              const matchedJson = jsonOutput.match(/{.*}/);
              if (!matchedJson) {
                console.error(`Failed to match JSON: ${jsonOutput}`);
                LOG.error('NEODLP', `Failed to parse metadata JSON for URL: ${url})`);
                resolve(null);
                return;
              }
              const parsedJson: RawVideoInfo = JSON.parse(matchedJson[0]);
              resolve(parsedJson);
            }
            catch (e) {
              console.error(`Failed to parse JSON: ${e}`);
              LOG.error('NEODLP', `Failed to parse metadata JSON for URL: ${url}) with error: ${e}`);
              resolve(null);
            }
          }
        });

        command.on('error', error => {
          console.error(`Error fetching metadata: ${error}`);
          LOG.error('NEODLP', `Error occurred while fetching metadata for URL: ${url} : ${error}`);
          resolve(null);
        });

        LOG.info('NEODLP', `Fetching metadata for URL: ${url}, with args: ${args.join(' ')}`);
        command.spawn().then(child => {
          setSearchPid(child.pid);
        }).catch(e => {
          console.error(`Failed to spawn command: ${e}`);
          LOG.error('NEODLP', `Failed to spawn yt-dlp process for fetching metadata for URL: ${url} : ${e}`);
          resolve(null);
        });
      });
    } catch (e) {
      console.error(`Failed to fetch metadata: ${e}`);
      LOG.error('NEODLP', `Failed to fetch metadata for URL: ${url} : ${e}`);
      return null;
    }
  };

  const startDownload = async (url: string, selectedFormat: string, downloadConfig: DownloadConfiguration, selectedSubtitles?: string | null, resumeState?: DownloadState, playlistItems?: string) => {
    LOG.info('NEODLP', `Initiating yt-dlp download for URL: ${url}`);
    // set error states to default
    setIsErrored(false);
    setIsErrorExpected(false);
    setErroredDownloadId(null);

    console.log('Starting download:', { url, selectedFormat, downloadConfig, selectedSubtitles, resumeState, playlistItems });
    if (!ffmpegPath || !tempDownloadDirPath || !downloadDirPath) {
      console.error('FFmpeg or download paths not found');
      return;
    }

    const isPlaylist = (playlistItems && typeof playlistItems === 'string') || (resumeState?.playlist_id && resumeState?.playlist_index) ? true : false;
    const playlistIndex = isPlaylist ? (resumeState?.playlist_index?.toString() || playlistItems) : null;
    let videoMetadata = await fetchVideoMetadata(url, selectedFormat, isPlaylist && playlistIndex && typeof playlistIndex === 'string' ? playlistIndex : undefined, selectedSubtitles, resumeState);
    if (!videoMetadata) {
      console.error('Failed to fetch video metadata');
      toast.error("Download Failed", {
        description: "yt-dlp failed to fetch video metadata. Please try again later.",
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

    let configOutputFormat = null;
    if (downloadConfig.output_format && downloadConfig.output_format !== 'auto') {
      videoMetadata.ext = downloadConfig.output_format;
      configOutputFormat = downloadConfig.output_format;
    }
    if (resumeState && resumeState.output_format) videoMetadata.ext = resumeState.output_format;

    const videoId = resumeState?.video_id || generateVideoId(videoMetadata.id, videoMetadata.webpage_url_domain);
    const playlistId = isPlaylist ? (resumeState?.playlist_id || generateVideoId(videoMetadata.playlist_id, videoMetadata.webpage_url_domain)) : null;
    const downloadId = resumeState?.download_id || ulid() /*generateDownloadId(videoMetadata.id, videoMetadata.webpage_url_domain)*/;
    // const tempDownloadPathForYtdlp = await join(tempDownloadDirPath, `${downloadId}_${selectedFormat}.%(ext)s`);
    // const tempDownloadPath = await join(tempDownloadDirPath, `${downloadId}_${selectedFormat}.${videoMetadata.ext}`);
    // let downloadFilePath = resumeState?.filepath || await join(downloadDirPath, sanitizeFilename(`${videoMetadata.title}_${videoMetadata.resolution || 'unknown'}[${videoMetadata.id}].${videoMetadata.ext}`));
    let downloadFilePath: string | null = null;
    let processPid: number | null = null;
    const args = [
      url,
      '--newline',
      '--progress-template',
      'status:%(progress.status)s,progress:%(progress._percent_str)s,speed:%(progress.speed)f,downloaded:%(progress.downloaded_bytes)d,total:%(progress.total_bytes)d,eta:%(progress.eta)d',
      '--paths',
      `temp:${tempDownloadDirPath}`,
      '--paths',
      `home:${downloadDirPath}`,
      '--output',
      `%(title)s_%(resolution|unknown)s[${downloadId}].%(ext)s`,
      '--windows-filenames',
      '--restrict-filenames',
      '--exec',
      'after_move:echo Finalpath: {}',
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

    let customCommandArgs = null;
    if ((USE_CUSTOM_COMMANDS && CUSTOM_COMMANDS && downloadConfig.custom_command) || resumeState?.custom_command) {
        if (resumeState?.custom_command) {
            customCommandArgs = resumeState.custom_command;
        } else if (CUSTOM_COMMANDS.find(cmd => cmd.id === downloadConfig.custom_command)) {
            let customCommand = CUSTOM_COMMANDS.find(cmd => cmd.id === downloadConfig.custom_command);
            customCommandArgs = customCommand ? customCommand.args : '';
        }

        if (customCommandArgs && customCommandArgs.trim() !== '') args.push(...customCommandArgs.split(' '));
    }

    let outputFormat = null;
    if ((!USE_CUSTOM_COMMANDS && !resumeState?.custom_command) && ((fileType !== 'unknown' && (VIDEO_FORMAT !== 'auto' || AUDIO_FORMAT !== 'auto')) || configOutputFormat || resumeState?.output_format)) {
        const format = resumeState?.output_format || configOutputFormat;

        if (format) {
            outputFormat = format;
        } else if (fileType === 'audio' && AUDIO_FORMAT !== 'auto') {
            outputFormat = AUDIO_FORMAT;
        } else if ((fileType === 'video' || fileType === 'video+audio') && VIDEO_FORMAT !== 'auto') {
            outputFormat = VIDEO_FORMAT;
        }

        const recodeOrRemux = ALWAYS_REENCODE_VIDEO ? '--recode-video' : '--remux-video';
        const formatToUse = format || VIDEO_FORMAT;

        // Handle video+audio
        if (fileType === 'video+audio' && (VIDEO_FORMAT !== 'auto' || format)) {
            args.push(ALWAYS_REENCODE_VIDEO ? '--recode-video' : '--merge-output-format', formatToUse);
        }
        // Handle video only
        else if (fileType === 'video' && (VIDEO_FORMAT !== 'auto' || format)) {
            args.push(recodeOrRemux, formatToUse);
        }
        // Handle audio only
        else if (fileType === 'audio' && (AUDIO_FORMAT !== 'auto' || format)) {
            args.push('--extract-audio', '--audio-format', format || AUDIO_FORMAT);
        }
        // Handle unknown filetype
        else if (fileType === 'unknown' && format) {
            if (['mkv', 'mp4', 'webm'].includes(format)) {
                args.push(recodeOrRemux, formatToUse);
            } else if (['mp3', 'm4a', 'opus'].includes(format)) {
                args.push('--extract-audio', '--audio-format', format);
            }
        }
    }

    let embedMetadata = 0;
    if ((!USE_CUSTOM_COMMANDS && !resumeState?.custom_command) && (downloadConfig.embed_metadata || resumeState?.embed_metadata || EMBED_VIDEO_METADATA || EMBED_AUDIO_METADATA)) {
        const shouldEmbedForVideo = (fileType === 'video+audio' || fileType === 'video') && (downloadConfig.embed_metadata || resumeState?.embed_metadata || (EMBED_VIDEO_METADATA && downloadConfig.embed_metadata === null));
        const shouldEmbedForAudio = fileType === 'audio' && (downloadConfig.embed_metadata || resumeState?.embed_metadata || (EMBED_AUDIO_METADATA && downloadConfig.embed_metadata === null));
        const shouldEmbedForUnknown = fileType === 'unknown' && (downloadConfig.embed_metadata || resumeState?.embed_metadata);

        if (shouldEmbedForUnknown || shouldEmbedForVideo || shouldEmbedForAudio) {
            embedMetadata = 1;
            args.push('--embed-metadata');
        }
    }

    let embedThumbnail = 0;
    if ((!USE_CUSTOM_COMMANDS && !resumeState?.custom_command) && (downloadConfig.embed_thumbnail || resumeState?.embed_thumbnail || (fileType === 'audio' && EMBED_AUDIO_THUMBNAIL && downloadConfig.embed_thumbnail === null))) {
      embedThumbnail = 1;
      args.push('--embed-thumbnail');
    }

    if ((!USE_CUSTOM_COMMANDS && !resumeState?.custom_command) && USE_PROXY && PROXY_URL) {
      args.push('--proxy', PROXY_URL);
    }

    if ((!USE_CUSTOM_COMMANDS && !resumeState?.custom_command) && USE_RATE_LIMIT && RATE_LIMIT) {
      args.push('--limit-rate', `${RATE_LIMIT}`);
    }

    if ((!USE_CUSTOM_COMMANDS && !resumeState?.custom_command) && USE_FORCE_INTERNET_PROTOCOL && FORCE_INTERNET_PROTOCOL) {
      if (FORCE_INTERNET_PROTOCOL === 'ipv4') {
        args.push('--force-ipv4');
      } else if (FORCE_INTERNET_PROTOCOL === 'ipv6') {
        args.push('--force-ipv6');
      }
    }

    if ((!USE_CUSTOM_COMMANDS && !resumeState?.custom_command) && USE_COOKIES) {
      if (IMPORT_COOKIES_FROM === 'browser' && COOKIES_BROWSER) {
        args.push('--cookies-from-browser', COOKIES_BROWSER);
      } else if (IMPORT_COOKIES_FROM === 'file' && COOKIES_FILE) {
        args.push('--cookies', COOKIES_FILE);
      }
    }

    let sponsorblockRemove = null;
    let sponsorblockMark = null;
    if ((!USE_CUSTOM_COMMANDS && !resumeState?.custom_command) && (USE_SPONSORBLOCK || (resumeState?.sponsorblock_remove || resumeState?.sponsorblock_mark))) {
      if (SPONSORBLOCK_MODE === 'remove' || resumeState?.sponsorblock_remove) {
        sponsorblockRemove = resumeState?.sponsorblock_remove || (SPONSORBLOCK_REMOVE === 'custom' ? (
          SPONSORBLOCK_REMOVE_CATEGORIES.length > 0 ? SPONSORBLOCK_REMOVE_CATEGORIES.join(',') : 'default'
        ) : (SPONSORBLOCK_REMOVE));
        args.push('--sponsorblock-remove', sponsorblockRemove);
      } else if (SPONSORBLOCK_MODE === 'mark' || resumeState?.sponsorblock_mark) {
        sponsorblockMark = resumeState?.sponsorblock_mark || (SPONSORBLOCK_MARK === 'custom' ? (
          SPONSORBLOCK_MARK_CATEGORIES.length > 0 ? SPONSORBLOCK_MARK_CATEGORIES.join(',') : 'default'
        ) : (SPONSORBLOCK_MARK));
        args.push('--sponsorblock-mark', sponsorblockMark);
      }
    }

    let useAria2 = 0;
    if ((!USE_CUSTOM_COMMANDS && !resumeState?.custom_command) && (USE_ARIA2 || resumeState?.use_aria2)) {
      useAria2 = 1;
      args.push(
        '--downloader', 'aria2c',
        '--downloader', 'dash,m3u8:native',
        '--downloader-args', 'aria2c:-c -j 16 -x 16 -s 16 -k 1M --check-certificate=false'
      );
      LOG.warning('NEODLP', `Looks like you are using aria2 for this yt-dlp download: ${downloadId}. Make sure aria2 is installed on your system if you are on macOS for this to work. Also, pause/resume might not work as expected especially on windows (using aria2 is not recommended for most downloads).`);
    }

    if (resumeState || (!USE_CUSTOM_COMMANDS && USE_ARIA2)) {
      args.push('--continue');
    } else {
      args.push('--no-continue');
    }

    console.log('Starting download with args:', args);
    const command = Command.sidecar('binaries/yt-dlp', args);

    command.on('close', async (data) => {
      if (data.code !== 0) {
        console.error(`Download failed with code ${data.code}`);
        LOG.error(`YT-DLP Download ${downloadId}`, `yt-dlp exited with code ${data.code} (ignore if you manually paused or cancelled the download)`);
        if (!isErrorExpected) {
          setIsErrored(true);
          setErroredDownloadId(downloadId);
        }
      } else {
        LOG.info(`YT-DLP Download ${downloadId}`, `yt-dlp exited with code ${data.code}`);
      }
    });

    command.on('error', error => {
      console.error(`Error: ${error}`);
      LOG.error(`YT-DLP Download ${downloadId}`, `Error occurred: ${error}`);
      setIsErrored(true);
      setErroredDownloadId(downloadId);
    });

    command.stdout.on('data', line => {
      if (line.startsWith('status:') || line.startsWith('[#')) {
        console.log(line);
        LOG.info(`YT-DLP Download ${downloadId}`, line);
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
          filesize: videoMetadata.filesize_approx || null,
          output_format: outputFormat,
          embed_metadata: embedMetadata,
          embed_thumbnail: embedThumbnail,
          sponsorblock_remove: sponsorblockRemove,
          sponsorblock_mark: sponsorblockMark,
          use_aria2: useAria2,
          custom_command: customCommandArgs,
          queue_config: null
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
        if (line.trim() !== '') LOG.info(`YT-DLP Download ${downloadId}`, line);

        if (line.startsWith('Finalpath: ')) {
            downloadFilePath = line.replace('Finalpath: ', '').trim().replace(/^"|"$/g, '');
            const downloadedFileExt = downloadFilePath.split('.').pop();

            // Update completion status after a short delay to ensure database states are propagated correctly
            console.log(`Download completed with ID: ${downloadId}, updating filepath and status after 1s delay...`);
            setTimeout(() => {
                LOG.info('NEODLP', `yt-dlp download completed with id: ${downloadId}`);
                downloadFilePathUpdater.mutate({ download_id: downloadId, filepath: downloadFilePath as string, ext: downloadedFileExt as string }, {
                    onSuccess: (data) => {
                        console.log("Download filepath updated successfully:", data);
                        queryClient.invalidateQueries({ queryKey: ['download-states'] });
                    },
                    onError: (error) => {
                        console.error("Failed to update download filepath:", error);
                    }
                });

                downloadStatusUpdater.mutate({ download_id: downloadId, download_status: 'completed' }, {
                    onSuccess: (data) => {
                        console.log("Download status updated successfully:", data);
                        queryClient.invalidateQueries({ queryKey: ['download-states'] });
                    },
                    onError: (error) => {
                        console.error("Failed to update download status:", error);
                    }
                });
            }, 1000);
        }
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
            filesize: resumeState?.filesize || null,
            output_format: resumeState?.output_format || null,
            embed_metadata: resumeState?.embed_metadata || 0,
            embed_thumbnail: resumeState?.embed_thumbnail || 0,
            sponsorblock_remove: resumeState?.sponsorblock_remove || null,
            sponsorblock_mark: resumeState?.sponsorblock_mark || null,
            use_aria2: resumeState?.use_aria2 || 0,
            custom_command: resumeState?.custom_command || null,
            queue_config: resumeState?.queue_config || ((!ongoingDownloads || ongoingDownloads && ongoingDownloads?.length < MAX_PARALLEL_DOWNLOADS) ? null : JSON.stringify(downloadConfig))
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
        LOG.info('NEODLP', `Starting yt-dlp download with args: ${args.join(' ')}`);
        const child = await command.spawn();
        processPid = child.pid;
        return Promise.resolve();
      } else {
        console.log("Download is queued, not starting immediately.");
        LOG.info('NEODLP', `Download queued with id: ${downloadId}`);
        return Promise.resolve();
      }
    } catch (e) {
      console.error(`Failed to start download: ${e}`);
      LOG.error('NEODLP', `Failed to start download for URL: ${url} with error: ${e}`);
      throw e;
    }
  };

  const pauseDownload = async (downloadState: DownloadState) => {
    try {
      LOG.info('NEODLP', `Pausing yt-dlp download with id: ${downloadState.download_id} (as per user request)`);
      if ((downloadState.download_status === 'downloading' && downloadState.process_id) || (downloadState.download_status === 'starting' && downloadState.process_id)) {
        setIsErrorExpected(true);  // Set error expected to true to handle UI state
        console.log("Killing process with PID:", downloadState.process_id);
        await invoke('kill_all_process', { pid: downloadState.process_id });
      }
      downloadStatusUpdater.mutate({ download_id: downloadState.download_id, download_status: 'paused' }, {
        onSuccess: (data) => {
          console.log("Download status updated successfully:", data);
          queryClient.invalidateQueries({ queryKey: ['download-states'] });

          /* re-check if the download is properly paused (if not try again after a small delay)
          as the pause opertion happens within high throughput of operations and have a high chgance of failure.
          */
          if (isSuccessFetchingDownloadStates && downloadStates.find(state => state.download_id === downloadState.download_id)?.download_status !== 'paused') {
            console.log("Download status not updated to paused yet, retrying...");
            setTimeout(() => {
              downloadStatusUpdater.mutate({ download_id: downloadState.download_id, download_status: 'paused' }, {
                onSuccess: (data) => {
                  console.log("Download status updated successfully on retry:", data);
                  queryClient.invalidateQueries({ queryKey: ['download-states'] });
                },
                onError: (error) => {
                  console.error("Failed to update download status:", error);
                }
              });
            }, 200);
          }

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
      LOG.error('NEODLP', `Failed to pause download with id: ${downloadState.download_id} with error: ${e}`);
      isProcessingQueueRef.current = false;
      throw e;
    }
  };

  const resumeDownload = async (downloadState: DownloadState) => {
    try {
      LOG.info('NEODLP', `Resuming yt-dlp download with id: ${downloadState.download_id} (as per user request)`);
      await startDownload(
        downloadState.playlist_id && downloadState.playlist_index ? downloadState.playlist_url : downloadState.url,
        downloadState.format_id,
        downloadState.queue_config ? JSON.parse(downloadState.queue_config) : {
          output_format: null,
          embed_metadata: null,
          embed_thumbnail: null,
          custom_command: null
        },
        downloadState.subtitle_id,
        downloadState
      );
      return Promise.resolve();
    } catch (e) {
      console.error(`Failed to resume download: ${e}`);
      LOG.error('NEODLP', `Failed to resume download with id: ${downloadState.download_id} with error: ${e}`);
      throw e;
    }
  };

  const cancelDownload = async (downloadState: DownloadState) => {
    try {
      LOG.info('NEODLP', `Cancelling yt-dlp download with id: ${downloadState.download_id} (as per user request)`);
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
      LOG.error('NEODLP', `Failed to cancel download with id: ${downloadState.download_id} with error: ${e}`);
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
      LOG.info('NEODLP', `Starting queued download with id: ${downloadToStart.download_id}`);
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
        downloadToStart.queue_config ? JSON.parse(downloadToStart.queue_config) : {
          output_format: null,
          embed_metadata: null,
          embed_thumbnail: null,
          custom_command: null
        },
        downloadToStart.subtitle_id,
        downloadToStart
      );

    } catch (error) {
      console.error("Error processing download queue:", error);
      LOG.error('NEODLP', `Error processing download queue: ${error}`);
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
            LOG.info('NEODLP', `Received download request from neodlp browser extension for URL: ${event.payload.url}`);
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
      LOG.info('NEODLP', 'Updating yt-dlp to latest version (triggered because auto-update is enabled)');
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
      LOG.info('NEODLP', 'Running macOS registration');
      registerToMac().then((result: { success: boolean, message: string }) => {
        if (result.success) {
          console.log("MacOS registration successful:", result.message);
          LOG.info('NEODLP', 'macOS registration successful');
        } else {
          console.error("MacOS registration failed:", result.message);
          LOG.error('NEODLP', `macOS registration failed: ${result.message}`);
        }
      }).catch((error) => {
        console.error("Error during macOS registration:", error);
        LOG.error('NEODLP', `Error during macOS registration: ${error}`);
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
      toast.error("Download Failed", {
        description: "yt-dlp exited unexpectedly. Please try again later",
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
            <Sonner closeButton />
          </TooltipProvider>
      </ThemeProvider>
    </AppContext.Provider>
  );
}
