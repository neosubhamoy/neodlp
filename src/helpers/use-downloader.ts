import { DownloadState } from "@/types/download";
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useRef } from "react";
import { useBasePathsStore, useCurrentVideoMetadataStore, useDownloaderPageStatesStore, useDownloadStatesStore, useSettingsPageStatesStore } from "@/services/store";
import { determineFileType, extractPlaylistItemProgress, generateVideoId, parseProgressLine } from "@/utils";
import { Command } from "@tauri-apps/plugin-shell";
import { RawVideoInfo } from "@/types/video";
import { useDeleteDownloadState, useSaveDownloadState, useSavePlaylistInfo, useSaveVideoInfo, useUpdateDownloadFilePath, useUpdateDownloadPlaylistItem, useUpdateDownloadStatus } from "@/services/mutations";
import { useQueryClient } from "@tanstack/react-query";
import { platform } from "@tauri-apps/plugin-os";
import { toast } from "sonner";
import { useLogger } from "@/helpers/use-logger";
import { ulid } from "ulid";
import { sendNotification } from '@tauri-apps/plugin-notification';
import { FetchVideoMetadataParams, StartDownloadParams } from "@/providers/appContextProvider";
import { useDebouncedCallback } from '@tanstack/react-pacer/debouncer';

export default function useDownloader() {
    const globalDownloadStates = useDownloadStatesStore((state) => state.downloadStates);

    const ffmpegPath = useBasePathsStore((state) => state.ffmpegPath);
    const tempDownloadDirPath = useBasePathsStore((state) => state.tempDownloadDirPath);
    const downloadDirPath = useBasePathsStore((state) => state.downloadDirPath);

    const setSearchPid = useCurrentVideoMetadataStore((state) => state.setSearchPid);

    const {
        max_parallel_downloads: MAX_PARALLEL_DOWNLOADS,
        max_retries: MAX_RETRIES,
        prefer_video_over_playlist: PREFER_VIDEO_OVER_PLAYLIST,
        strict_downloadablity_check: STRICT_DOWNLOADABILITY_CHECK,
        use_proxy: USE_PROXY,
        proxy_url: PROXY_URL,
        use_rate_limit: USE_RATE_LIMIT,
        rate_limit: RATE_LIMIT,
        video_format: VIDEO_FORMAT,
        audio_format: AUDIO_FORMAT,
        always_reencode_video: ALWAYS_REENCODE_VIDEO,
        embed_video_metadata: EMBED_VIDEO_METADATA,
        embed_audio_metadata: EMBED_AUDIO_METADATA,
        embed_video_thumbnail: EMBED_VIDEO_THUMBNAIL,
        embed_audio_thumbnail: EMBED_AUDIO_THUMBNAIL,
        use_cookies: USE_COOKIES,
        import_cookies_from: IMPORT_COOKIES_FROM,
        cookies_browser: COOKIES_BROWSER,
        cookies_file: COOKIES_FILE,
        use_sponsorblock: USE_SPONSORBLOCK,
        sponsorblock_mode: SPONSORBLOCK_MODE,
        sponsorblock_remove: SPONSORBLOCK_REMOVE,
        sponsorblock_mark: SPONSORBLOCK_MARK,
        sponsorblock_remove_categories: SPONSORBLOCK_REMOVE_CATEGORIES,
        sponsorblock_mark_categories: SPONSORBLOCK_MARK_CATEGORIES,
        use_aria2: USE_ARIA2,
        use_force_internet_protocol: USE_FORCE_INTERNET_PROTOCOL,
        force_internet_protocol: FORCE_INTERNET_PROTOCOL,
        use_custom_commands: USE_CUSTOM_COMMANDS,
        custom_commands: CUSTOM_COMMANDS,
        filename_template: FILENAME_TEMPLATE,
        debug_mode: DEBUG_MODE,
        log_verbose: LOG_VERBOSE,
        log_progress: LOG_PROGRESS,
        enable_notifications: ENABLE_NOTIFICATIONS,
        download_completion_notification: DOWNLOAD_COMPLETION_NOTIFICATION
    } = useSettingsPageStatesStore(state => state.settings);

    const expectedErrorDownloadIds = useDownloaderPageStatesStore((state) => state.expectedErrorDownloadIds);
    const addErroredDownload = useDownloaderPageStatesStore((state) => state.addErroredDownload);
    const removeErroredDownload = useDownloaderPageStatesStore((state) => state.removeErroredDownload);
    const addExpectedErrorDownload = useDownloaderPageStatesStore((state) => state.addExpectedErrorDownload);
    const removeExpectedErrorDownload = useDownloaderPageStatesStore((state) => state.removeExpectedErrorDownload);

    const LOG = useLogger();
    const currentPlatform = platform();

    const queryClient = useQueryClient();
    const downloadStateSaver = useSaveDownloadState();
    const downloadStatusUpdater = useUpdateDownloadStatus();
    const downloadFilePathUpdater = useUpdateDownloadFilePath();
    const playlistItemUpdater = useUpdateDownloadPlaylistItem();
    const videoInfoSaver = useSaveVideoInfo();
    const downloadStateDeleter = useDeleteDownloadState();
    const playlistInfoSaver = useSavePlaylistInfo();

    const ongoingDownloads = globalDownloadStates.filter(state => state.download_status === 'downloading' || state.download_status === 'starting');
    const queuedDownloads = globalDownloadStates.filter(state => state.download_status === 'queued').sort((a, b) => a.queue_index! - b.queue_index!);

    const isProcessingQueueRef = useRef(false);
    const lastProcessedDownloadIdRef = useRef<string | null>(null);

    const updateDownloadProgress =  useDebouncedCallback((state: DownloadState) => {
        downloadStateSaver.mutate(state, {
            onSuccess: (_data) => {
                // console.log("Download State saved successfully:", data);
                queryClient.invalidateQueries({ queryKey: ['download-states'] });
            },
            onError: (error) => {
                console.error("Failed to save download state:", error);
            }
        });
    }, { key: 'update-download-progress', wait: 500 });

    const fetchVideoMetadata = async (params: FetchVideoMetadataParams): Promise<RawVideoInfo | null> => {
        const { url, formatId, playlistIndices, selectedSubtitles, resumeState, downloadConfig } = params;
        try {
            const args = [url, '--dump-single-json', '--no-warnings'];
            if (formatId) args.push('--format', formatId);
            if (selectedSubtitles) {
                const isAutoSub = selectedSubtitles.split(',').some(lang => lang.endsWith('-orig'));
                if (isAutoSub) args.push('--write-auto-sub');
                args.push('--embed-subs', '--sub-lang', selectedSubtitles);
            }
            if (playlistIndices) args.push('--playlist-items', playlistIndices);
            if (PREFER_VIDEO_OVER_PLAYLIST && !playlistIndices) args.push('--no-playlist');
            if (STRICT_DOWNLOADABILITY_CHECK && !formatId) args.push('--check-all-formats');
            if (STRICT_DOWNLOADABILITY_CHECK && formatId) args.push('--check-formats');

            if (currentPlatform === 'macos') {
                args.push('--ffmpeg-location', '/Applications/NeoDLP.app/Contents/MacOS', '--js-runtimes', 'deno:/Applications/NeoDLP.app/Contents/MacOS/deno');
            }

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

    const startDownload = async (params: StartDownloadParams) => {
        const { url, selectedFormat, downloadConfig, selectedSubtitles, resumeState, playlistItems, overrideOptions } = params;
        LOG.info('NEODLP', `Initiating yt-dlp download for URL: ${url}`);

        console.log('Starting download:', { url, selectedFormat, downloadConfig, selectedSubtitles, resumeState, playlistItems });
        if (!ffmpegPath || !tempDownloadDirPath || !downloadDirPath) {
            console.error('FFmpeg or download paths not found');
            return;
        }

        const isPlaylist = (playlistItems && typeof playlistItems === 'string') || (resumeState?.playlist_id && resumeState?.playlist_indices) ? true : false;
        const playlistIndices = isPlaylist ? (resumeState?.playlist_indices || playlistItems) : null;
        const isMultiplePlaylistItems = isPlaylist && playlistIndices && typeof playlistIndices === 'string' && playlistIndices.includes(',');
        let videoMetadata = await fetchVideoMetadata({
            url,
            formatId: (!isPlaylist || (isPlaylist && selectedFormat !== 'best')) ? selectedFormat : undefined,
            playlistIndices: isPlaylist && playlistIndices && typeof playlistIndices === 'string' ? playlistIndices : undefined,
            selectedSubtitles,
            resumeState
        });
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

        // Clear any existing errored/expected error states for this download
        removeErroredDownload(downloadId);
        removeExpectedErrorDownload(downloadId);

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
            '--windows-filenames',
            '--restrict-filenames',
            '--exec',
            'after_move:echo Finalpath: {}',
            '--no-mtime',
            '--retries',
            MAX_RETRIES.toString(),
        ];

        if (currentPlatform === 'macos') {
            args.push('--ffmpeg-location', '/Applications/NeoDLP.app/Contents/MacOS', '--js-runtimes', 'deno:/Applications/NeoDLP.app/Contents/MacOS/deno');
        }

        if (isMultiplePlaylistItems) {
            args.push('--output', `%(playlist_title|Unknown)s[${downloadId}]/[%(playlist_index|0)d]_${FILENAME_TEMPLATE}.%(ext)s`);
        } else {
            args.push('--output', `${FILENAME_TEMPLATE}[${downloadId}].%(ext)s`);
        }

        if (isMultiplePlaylistItems) {
            const playlistLength = playlistIndices.split(',').length;
            if (playlistLength > 5 && playlistLength < 100) {
                args.push('--sleep-requests', '1', '--sleep-interval', '5', '--max-sleep-interval', '15');
            } else if (playlistLength >= 100 && playlistLength < 500) {
                args.push('--sleep-requests', '1.5', '--sleep-interval', '10', '--max-sleep-interval', '40');
            } else if (playlistLength >= 500) {
                args.push('--sleep-requests', '2.5', '--sleep-interval', '20', '--max-sleep-interval', '60');
            }
        }

        if (!isPlaylist || (isPlaylist && selectedFormat !== 'best')) {
            args.push('--format', selectedFormat);
        }

        if (DEBUG_MODE && LOG_VERBOSE) {
            args.push('--verbose');
        } else {
            args.push('--no-warnings');
        }

        if (selectedSubtitles) {
            const isAutoSub = selectedSubtitles.split(',').some(lang => lang.endsWith('-orig'));
            if (isAutoSub) args.push('--write-auto-sub');
            args.push('--embed-subs', '--sub-lang', selectedSubtitles);
        }

        if (isPlaylist && playlistIndices && typeof playlistIndices === 'string') {
            args.push('--playlist-items', playlistIndices);
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
                args.push('--extract-audio', '--audio-format', format || AUDIO_FORMAT, '--audio-quality', '0');
            }
            // Handle unknown filetype
            else if (fileType === 'unknown' && format) {
                if (['mkv', 'mp4', 'webm'].includes(format)) {
                    args.push(recodeOrRemux, formatToUse);
                } else if (['mp3', 'm4a', 'opus'].includes(format)) {
                    args.push('--extract-audio', '--audio-format', format, '--audio-quality', '0');
                }
            }
        }

        let embedMetadata = 0;
        if ((!USE_CUSTOM_COMMANDS && !resumeState?.custom_command) && (downloadConfig.embed_metadata || resumeState?.embed_metadata || EMBED_VIDEO_METADATA || EMBED_AUDIO_METADATA)) {
            const shouldEmbedMetaForVideo = (fileType === 'video+audio' || fileType === 'video') && (downloadConfig.embed_metadata || resumeState?.embed_metadata || (EMBED_VIDEO_METADATA && downloadConfig.embed_metadata === null));
            const shouldEmbedMetaForAudio = fileType === 'audio' && (downloadConfig.embed_metadata || resumeState?.embed_metadata || (EMBED_AUDIO_METADATA && downloadConfig.embed_metadata === null));
            const shouldEmbedMetaForUnknown = fileType === 'unknown' && (downloadConfig.embed_metadata || resumeState?.embed_metadata);

            if (shouldEmbedMetaForUnknown || shouldEmbedMetaForVideo || shouldEmbedMetaForAudio) {
                embedMetadata = 1;
                args.push('--embed-metadata');
            }
        }

        let embedThumbnail = 0;
        let squareCropThumbnail = 0;
        if ((!USE_CUSTOM_COMMANDS && !resumeState?.custom_command) && (downloadConfig.embed_thumbnail || resumeState?.embed_thumbnail || EMBED_VIDEO_THUMBNAIL || EMBED_AUDIO_THUMBNAIL)) {
            const shouldEmbedThumbForVideo = (fileType === 'video+audio' || fileType === 'video') && (downloadConfig.embed_thumbnail || resumeState?.embed_thumbnail || (EMBED_VIDEO_THUMBNAIL && downloadConfig.embed_thumbnail === null));
            const shouldEmbedThumbForAudio = fileType === 'audio' && (downloadConfig.embed_thumbnail || resumeState?.embed_thumbnail || (EMBED_AUDIO_THUMBNAIL && downloadConfig.embed_thumbnail === null));
            const shouldEmbedThumbForUnknown = fileType === 'unknown' && (downloadConfig.embed_thumbnail || resumeState?.embed_thumbnail);

            if (shouldEmbedThumbForUnknown || shouldEmbedThumbForVideo || shouldEmbedThumbForAudio) {
                embedThumbnail = 1;
                args.push('--embed-thumbnail', '--convert-thumbnail', 'jpg');

                if (downloadConfig.square_crop_thumbnail || resumeState?.square_crop_thumbnail) {
                    squareCropThumbnail = 1;
                    args.push('--postprocessor-args', 'ThumbnailsConvertor+FFmpeg_o:-c:v mjpeg -qmin 1 -qscale:v 1 -vf crop="\'min(iw,ih)\':\'min(iw,ih)\'"');
                }
            }
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
        if ((!USE_CUSTOM_COMMANDS && !resumeState?.custom_command) && ((downloadConfig.sponsorblock && downloadConfig.sponsorblock !== 'auto') || resumeState?.sponsorblock_remove || resumeState?.sponsorblock_mark || USE_SPONSORBLOCK)) {
            if (downloadConfig?.sponsorblock === 'remove' || resumeState?.sponsorblock_remove || (SPONSORBLOCK_MODE === 'remove' && !downloadConfig.sponsorblock)) {
                sponsorblockRemove = resumeState?.sponsorblock_remove || (SPONSORBLOCK_REMOVE === 'custom' ? (
                    SPONSORBLOCK_REMOVE_CATEGORIES.length > 0 ? SPONSORBLOCK_REMOVE_CATEGORIES.join(',') : 'default'
                ) : (SPONSORBLOCK_REMOVE));
                args.push('--sponsorblock-remove', sponsorblockRemove);
            } else if (downloadConfig?.sponsorblock === 'mark' || resumeState?.sponsorblock_mark || (SPONSORBLOCK_MODE === 'mark' && !downloadConfig.sponsorblock)) {
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
                if (!expectedErrorDownloadIds.has(downloadId)) addErroredDownload(downloadId);
            } else {
                LOG.info(`YT-DLP Download ${downloadId}`, `yt-dlp exited with code ${data.code}`);
            }
        });

        command.on('error', error => {
            console.error(`Error: ${error}`);
            LOG.error(`YT-DLP Download ${downloadId}`, `Error occurred: ${error}`);
            addErroredDownload(downloadId);
        });

        command.stdout.on('data', async line => {
            if (line.startsWith('status:') || line.startsWith('[#')) {
                // console.log(line);
                if (DEBUG_MODE && LOG_PROGRESS) LOG.progress(`YT-DLP Download ${downloadId}`, line);
                const currentProgress = await parseProgressLine(line, downloadId);
                const state: DownloadState = {
                    download_id: downloadId,
                    download_status: 'downloading',
                    video_id: videoId,
                    format_id: selectedFormat,
                    subtitle_id: selectedSubtitles || null,
                    queue_index: null,
                    playlist_id: playlistId,
                    playlist_indices: playlistIndices ?? null,
                    title: videoMetadata.title,
                    url: url,
                    host: videoMetadata.webpage_url_domain,
                    thumbnail: videoMetadata.thumbnail || null,
                    channel: videoMetadata.creator || videoMetadata.channel || videoMetadata.uploader || null,
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
                    abr: resumeState?.abr || overrideOptions?.tbr/2 || videoMetadata.abr || null,
                    vbr: resumeState?.vbr || overrideOptions?.tbr/2 || videoMetadata.vbr || null,
                    acodec: videoMetadata.acodec || null,
                    vcodec: videoMetadata.vcodec || null,
                    dynamic_range: videoMetadata.dynamic_range || null,
                    process_id: processPid,
                    status: currentProgress.status || null,
                    item: currentProgress.item || null,
                    progress: currentProgress.progress || null,
                    total: currentProgress.total || null,
                    downloaded: currentProgress.downloaded || null,
                    speed: currentProgress.speed || null,
                    eta: currentProgress.eta || null,
                    filepath: downloadFilePath,
                    filetype: determineFileType(videoMetadata.vcodec, videoMetadata.acodec) || null,
                    filesize: resumeState?.filesize || overrideOptions?.filesize || videoMetadata.filesize_approx || null,
                    output_format: outputFormat,
                    embed_metadata: embedMetadata,
                    embed_thumbnail: embedThumbnail,
                    square_crop_thumbnail: squareCropThumbnail,
                    sponsorblock_remove: sponsorblockRemove,
                    sponsorblock_mark: sponsorblockMark,
                    use_aria2: useAria2,
                    custom_command: customCommandArgs,
                    queue_config: null
                };
                updateDownloadProgress(state);
            } else {
                // console.log(line);
                if (line.trim() !== '') LOG.info(`YT-DLP Download ${downloadId}`, line);

                if (isPlaylist && line.startsWith('[download] Downloading item')) {
                    const playlistItemProgress = extractPlaylistItemProgress(line);
                    setTimeout(async () => {
                        playlistItemUpdater.mutate({ download_id: downloadId, item: playlistItemProgress as string }, {
                            onSuccess: (data) => {
                                console.log("Playlist item progress updated successfully:", data);
                                queryClient.invalidateQueries({ queryKey: ['download-states'] });
                            },
                            onError: (error) => {
                                console.error("Failed to update playlist item progress:", error);
                            }
                        });
                    }, 1500);
                }

                if (isPlaylist && line.startsWith('Finalpath: ')) {
                    downloadFilePath = line.replace('Finalpath: ', '').trim().replace(/^"|"$/g, '');
                    const downloadedFileExt = downloadFilePath.split('.').pop();

                    setTimeout(async () => {
                        downloadFilePathUpdater.mutate({ download_id: downloadId, filepath: downloadFilePath as string, ext: downloadedFileExt as string }, {
                            onSuccess: (data) => {
                                console.log("Download filepath updated successfully:", data);
                                queryClient.invalidateQueries({ queryKey: ['download-states'] });
                            },
                            onError: (error) => {
                                console.error("Failed to update download filepath:", error);
                            }
                        });
                    }, 1500);
                }

                if (isPlaylist && line.startsWith('[download] Finished downloading playlist:')) {
                    // Update completion status after a short delay to ensure database states are propagated correctly
                    console.log(`Playlist download completed with ID: ${downloadId}, updating status after 2s delay...`);
                    setTimeout(async () => {
                        LOG.info('NEODLP', `yt-dlp download completed with id: ${downloadId}`);
                        downloadStatusUpdater.mutate({ download_id: downloadId, download_status: 'completed' }, {
                            onSuccess: (data) => {
                                console.log("Download status updated successfully:", data);
                                queryClient.invalidateQueries({ queryKey: ['download-states'] });
                            },
                            onError: (error) => {
                                console.error("Failed to update download status:", error);
                            }
                        });

                        toast.success(`${isMultiplePlaylistItems ? 'Playlist ' : ''}Download Completed`, {
                            description: `The download for ${isMultiplePlaylistItems ? 'playlist ' : ''}"${isMultiplePlaylistItems ? videoMetadata.playlist_title : videoMetadata.title}" has completed successfully.`,
                        });

                        if (ENABLE_NOTIFICATIONS && DOWNLOAD_COMPLETION_NOTIFICATION) {
                            sendNotification({
                                title: `${isMultiplePlaylistItems ? 'Playlist ' : ''}Download Completed`,
                                body: `The download for ${isMultiplePlaylistItems ? 'playlist ' : ''}"${isMultiplePlaylistItems ? videoMetadata.playlist_title : videoMetadata.title}" has completed successfully.`,
                            });
                        }
                    }, 2000);
                }

                if (!isPlaylist && line.startsWith('Finalpath: ')) {
                    downloadFilePath = line.replace('Finalpath: ', '').trim().replace(/^"|"$/g, '');
                    const downloadedFileExt = downloadFilePath.split('.').pop();

                    // Update completion status after a short delay to ensure database states are propagated correctly
                    console.log(`Download completed with ID: ${downloadId}, updating filepath and status after 2s delay...`);
                    setTimeout(async () => {
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

                        toast.success("Download Completed", {
                            description: `The download for "${videoMetadata.title}" has completed successfully.`,
                        });

                        if (ENABLE_NOTIFICATIONS && DOWNLOAD_COMPLETION_NOTIFICATION) {
                            sendNotification({
                                title: "Download Completed",
                                body: `The download for "${videoMetadata.title}" has completed successfully.`,
                            });
                        }
                    }, 2000);
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
                channel: videoMetadata.creator || videoMetadata.channel || videoMetadata.uploader || null,
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
                            playlist_channel: videoMetadata.playlist_creator || videoMetadata.playlist_channel || videoMetadata.playlist_uploader || null
                        }, {
                            onSuccess: (data) => {
                                console.log("Playlist Info saved successfully:", data);
                            },
                            onError: (error) => {
                                console.error("Failed to save playlist info:", error);
                            }
                        });
                    }
                    const state: DownloadState = {
                        download_id: downloadId,
                        download_status: (!ongoingDownloads || ongoingDownloads && ongoingDownloads?.length < MAX_PARALLEL_DOWNLOADS) ? 'starting' : 'queued',
                        video_id: videoId,
                        format_id: selectedFormat,
                        subtitle_id: selectedSubtitles || null,
                        queue_index: (!ongoingDownloads || ongoingDownloads && ongoingDownloads?.length < MAX_PARALLEL_DOWNLOADS) ? null : (queuedDownloads?.length || 0),
                        playlist_id: playlistId,
                        playlist_indices: playlistIndices ?? null,
                        title: videoMetadata.title,
                        url: url,
                        host: videoMetadata.webpage_url_domain,
                        thumbnail: videoMetadata.thumbnail || null,
                        channel: videoMetadata.creator || videoMetadata.channel || videoMetadata.uploader || null,
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
                        abr: resumeState?.abr || overrideOptions?.tbr/2 || null,
                        vbr: resumeState?.vbr || overrideOptions?.tbr/2 || null,
                        acodec: resumeState?.acodec || null,
                        vcodec: resumeState?.vcodec || null,
                        dynamic_range: resumeState?.dynamic_range || null,
                        process_id: resumeState?.process_id || null,
                        status: resumeState?.status || null,
                        item: resumeState?.item || null,
                        progress: resumeState?.progress || null,
                        total: resumeState?.total || null,
                        downloaded: resumeState?.downloaded || null,
                        speed: resumeState?.speed || null,
                        eta: resumeState?.eta || null,
                        filepath: downloadFilePath,
                        filetype: resumeState?.filetype || null,
                        filesize: resumeState?.filesize || overrideOptions?.filesize || null,
                        output_format: resumeState?.output_format || null,
                        embed_metadata: resumeState?.embed_metadata || 0,
                        embed_thumbnail: resumeState?.embed_thumbnail || 0,
                        square_crop_thumbnail: resumeState?.square_crop_thumbnail || 0,
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
                    });
                },
                onError: (error) => {
                    console.error("Failed to save video info:", error);
                }
            });

            if (!ongoingDownloads || ongoingDownloads && ongoingDownloads?.length < MAX_PARALLEL_DOWNLOADS) {
                LOG.info('NEODLP', `Starting yt-dlp download with args: ${args.join(' ')}`);
                if (!DEBUG_MODE || (DEBUG_MODE && !LOG_PROGRESS)) LOG.warning('NEODLP', `Progress logs are hidden. Enable 'Debug Mode > Log Progress' in Settings to unhide.`);
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
                addExpectedErrorDownload(downloadState.download_id); // Mark as error expected to handle UI state
                console.log("Killing process with PID:", downloadState.process_id);
                await invoke('kill_all_process', { pid: downloadState.process_id });
            }

            return new Promise<void>((resolve, reject) => {
                setTimeout(() => {
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
                            resolve();
                        },
                        onError: (error) => {
                            console.error("Failed to update download status:", error);
                            isProcessingQueueRef.current = false;
                            reject(error);
                        }
                    });
                }, 1500);
            });
        } catch (e) {
            console.error(`Failed to pause download: ${e}`);
            LOG.error('NEODLP', `Failed to pause download with id: ${downloadState.download_id} with error: ${e}`);
            isProcessingQueueRef.current = false;
            removeExpectedErrorDownload(downloadState.download_id);
            throw e;
        }
    };

    const resumeDownload = async (downloadState: DownloadState) => {
        try {
            LOG.info('NEODLP', `Resuming yt-dlp download with id: ${downloadState.download_id} (as per user request)`);
            await startDownload({
                url: downloadState.playlist_id && downloadState.playlist_indices ? downloadState.playlist_url : downloadState.url,
                selectedFormat: downloadState.format_id,
                downloadConfig: downloadState.queue_config ? JSON.parse(downloadState.queue_config) : {
                    output_format: null,
                    embed_metadata: null,
                    embed_thumbnail: null,
                    square_crop_thumbnail: null,
                    sponsorblock: null,
                    custom_command: null
                },
                selectedSubtitles: downloadState.subtitle_id,
                resumeState: downloadState
            });
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
                addExpectedErrorDownload(downloadState.download_id); // Mark as error expected to handle UI state
                console.log("Killing process with PID:", downloadState.process_id);
                await invoke('kill_all_process', { pid: downloadState.process_id });
            }

            return new Promise<void>((resolve, reject) => {
                setTimeout(() => {
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
                            resolve();
                        },
                        onError: (error) => {
                            console.error("Failed to delete download state:", error);
                            isProcessingQueueRef.current = false;
                            reject(error);
                        }
                    });
                }, 1500);
            });
        } catch (e) {
            console.error(`Failed to cancel download: ${e}`);
            LOG.error('NEODLP', `Failed to cancel download with id: ${downloadState.download_id} with error: ${e}`);
            isProcessingQueueRef.current = false;
            removeExpectedErrorDownload(downloadState.download_id);
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

            await downloadStatusUpdater.mutateAsync({
                download_id: downloadToStart.download_id,
                download_status: 'starting'
            });

            await queryClient.invalidateQueries({ queryKey: ['download-states'] });

            await startDownload({
                url: downloadToStart.url,
                selectedFormat: downloadToStart.format_id,
                downloadConfig: downloadToStart.queue_config ? JSON.parse(downloadToStart.queue_config) : {
                    output_format: null,
                    embed_metadata: null,
                    embed_thumbnail: null,
                    square_crop_thumbnail: null,
                    sponsorblock: null,
                    custom_command: null
                },
                selectedSubtitles: downloadToStart.subtitle_id,
                resumeState: downloadToStart
            });
        } catch (error) {
            console.error("Error processing download queue:", error);
            LOG.error('NEODLP', `Error processing download queue: ${error}`);
        } finally {
            // Important: reset the processing flag
            setTimeout(() => {
                isProcessingQueueRef.current = false;
                console.log("Queue processor released lock");
            }, 1000);
        }
    }, [queuedDownloads, ongoingDownloads, globalDownloadStates, queryClient]);

    return { fetchVideoMetadata, startDownload, pauseDownload, resumeDownload, cancelDownload, processQueuedDownloads };
}
