import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAppContext } from "@/providers/appContextProvider";
import { useCurrentVideoMetadataStore, useDownloaderPageStatesStore, useSettingsPageStatesStore } from "@/services/store";
import { determineFileType, fileFormatFilter, sortByBitrate } from "@/utils";
import { Loader2, PackageSearch, X, Clipboard } from "lucide-react";
import { useEffect, useRef } from "react";
import { VideoFormat } from "@/types/video";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod"
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { config } from "@/config";
import { invoke } from "@tauri-apps/api/core";
import { readText } from '@tauri-apps/plugin-clipboard-manager';
import { useTheme } from "@/providers/themeProvider";
import { VideoDownloader } from "@/components/pages/downloader/videoDownloader";
import { PlaylistDownloader } from "@/components/pages/downloader/playlistDownloader";
import { BottomBar } from "@/components/pages/downloader/bottomBar";

const searchFormSchema = z.object({
    url: z.url({
        error: (issue) => issue.input === undefined || issue.input === null || issue.input === ""
        ? "URL is required"
        : "Invalid URL format"
    }),
});

export default function DownloaderPage() {
    const { fetchVideoMetadata } = useAppContext();
    const { setTheme } = useTheme();

    const videoUrl = useCurrentVideoMetadataStore((state) => state.videoUrl);
    const videoMetadata = useCurrentVideoMetadataStore((state) => state.videoMetadata);
    const isMetadataLoading = useCurrentVideoMetadataStore((state) => state.isMetadataLoading);
    const requestedUrl = useCurrentVideoMetadataStore((state) => state.requestedUrl);
    const autoSubmitSearch = useCurrentVideoMetadataStore((state) => state.autoSubmitSearch);
    const searchPid = useCurrentVideoMetadataStore((state) => state.searchPid);
    const setVideoUrl = useCurrentVideoMetadataStore((state) => state.setVideoUrl);
    const setVideoMetadata = useCurrentVideoMetadataStore((state) => state.setVideoMetadata);
    const setIsMetadataLoading = useCurrentVideoMetadataStore((state) => state.setIsMetadataLoading);
    const setRequestedUrl = useCurrentVideoMetadataStore((state) => state.setRequestedUrl);
    const setAutoSubmitSearch = useCurrentVideoMetadataStore((state) => state.setAutoSubmitSearch);
    const setSearchPid = useCurrentVideoMetadataStore((state) => state.setSearchPid);
    const setShowSearchError = useCurrentVideoMetadataStore((state) => state.setShowSearchError);

    const selectedDownloadFormat = useDownloaderPageStatesStore((state) => state.selectedDownloadFormat);
    const selectedCombinableVideoFormat = useDownloaderPageStatesStore((state) => state.selectedCombinableVideoFormat);
    const selectedCombinableAudioFormat = useDownloaderPageStatesStore((state) => state.selectedCombinableAudioFormat);
    const selectedPlaylistVideoIndex = useDownloaderPageStatesStore((state) => state.selectedPlaylistVideoIndex);
    const setSelectedDownloadFormat = useDownloaderPageStatesStore((state) => state.setSelectedDownloadFormat);
    const setSelectedCombinableVideoFormat = useDownloaderPageStatesStore((state) => state.setSelectedCombinableVideoFormat);
    const setSelectedCombinableAudioFormat = useDownloaderPageStatesStore((state) => state.setSelectedCombinableAudioFormat);
    const setSelectedSubtitles = useDownloaderPageStatesStore((state) => state.setSelectedSubtitles);
    const setSelectedPlaylistVideoIndex = useDownloaderPageStatesStore((state) => state.setSelectedPlaylistVideoIndex);
    const resetDownloadConfiguration = useDownloaderPageStatesStore((state) => state.resetDownloadConfiguration);

    const appTheme = useSettingsPageStatesStore(state => state.settings.theme);
    const appColorScheme = useSettingsPageStatesStore(state => state.settings.color_scheme);

    const containerRef = useRef<HTMLDivElement>(null);

    const audioOnlyFormats = videoMetadata?._type === 'video' ? sortByBitrate(videoMetadata?.formats.filter(fileFormatFilter('audio'))) : videoMetadata?._type === 'playlist' ? sortByBitrate(videoMetadata?.entries[Number(selectedPlaylistVideoIndex) - 1].formats.filter(fileFormatFilter('audio'))) : [];
    const videoOnlyFormats = videoMetadata?._type === 'video' ? sortByBitrate(videoMetadata?.formats.filter(fileFormatFilter('video'))) : videoMetadata?._type === 'playlist' ? sortByBitrate(videoMetadata?.entries[Number(selectedPlaylistVideoIndex) - 1].formats.filter(fileFormatFilter('video'))) : [];
    const combinedFormats = videoMetadata?._type === 'video' ? sortByBitrate(videoMetadata?.formats.filter(fileFormatFilter('video+audio'))) : videoMetadata?._type === 'playlist' ? sortByBitrate(videoMetadata?.entries[Number(selectedPlaylistVideoIndex) - 1].formats.filter(fileFormatFilter('video+audio'))) : [];

    const av1VideoFormats = videoMetadata?.webpage_url_domain === 'youtube.com' && videoMetadata?._type === 'video' ? sortByBitrate(videoMetadata?.formats.filter((format) => format.vcodec?.startsWith('av01'))) : videoMetadata?.webpage_url_domain === 'youtube.com' && videoMetadata?._type === 'playlist' ? sortByBitrate(videoMetadata?.entries[Number(selectedPlaylistVideoIndex) - 1].formats.filter((format) => format.vcodec?.startsWith('av01'))) : [];
    const opusAudioFormats = videoMetadata?.webpage_url_domain === 'youtube.com' && videoMetadata?._type === 'video' ? sortByBitrate(videoMetadata?.formats.filter((format) => format.acodec?.startsWith('opus'))) : videoMetadata?.webpage_url_domain === 'youtube.com' && videoMetadata?._type === 'playlist' ? sortByBitrate(videoMetadata?.entries[Number(selectedPlaylistVideoIndex) - 1].formats.filter((format) => format.acodec?.startsWith('opus'))) : [];
    const qualityPresetFormats: VideoFormat[] | undefined = videoMetadata?.webpage_url_domain === 'youtube.com' ?
        av1VideoFormats && opusAudioFormats ?
            av1VideoFormats.map((av1Format) => {
                const opusFormat = av1Format.format_note.startsWith('144p') || av1Format.format_note.startsWith('240p') ? opusAudioFormats[opusAudioFormats.length - 1] : opusAudioFormats[0]
                return {
                    ...av1Format,
                    format: `${av1Format.format}+${opusFormat?.format}`,
                    format_id: `${av1Format.format_id}+${opusFormat?.format_id}`,
                    format_note: `${av1Format.format_note}+${opusFormat?.format_note}`,
                    filesize_approx: av1Format.filesize_approx && opusFormat.filesize_approx ? av1Format.filesize_approx + opusFormat.filesize_approx : null,
                    acodec: opusFormat?.acodec,
                    audio_ext: opusFormat.audio_ext,
                    ext: 'webm',
                    tbr: av1Format.tbr && opusFormat.tbr ? av1Format.tbr + opusFormat.tbr : null,
                };
            })
        : []
    : [];

    const allFilteredFormats = [...(audioOnlyFormats || []), ...(videoOnlyFormats || []), ...(combinedFormats || []), ...(qualityPresetFormats || [])];
    const selectedFormat = (() => {
        if (videoMetadata?._type === 'video') {
            if (selectedDownloadFormat === 'best') {
                return videoMetadata?.requested_downloads[0];
            }
            return allFilteredFormats.find(
                (format) => format.format_id === selectedDownloadFormat
            );
        } else if (videoMetadata?._type === 'playlist') {
            if (selectedDownloadFormat === 'best') {
                return videoMetadata?.entries[Number(selectedPlaylistVideoIndex) - 1].requested_downloads[0];
            }
            return allFilteredFormats.find(
                (format) => format.format_id === selectedDownloadFormat
            );
        }
    })();
    const selectedFormatFileType = determineFileType(selectedFormat?.vcodec, selectedFormat?.acodec);
    const selectedVideoFormat = (() => {
        if (videoMetadata?._type === 'video') {
            return allFilteredFormats.find(
                (format) => format.format_id === selectedCombinableVideoFormat
            );
        } else if (videoMetadata?._type === 'playlist') {
            return allFilteredFormats.find(
                (format) => format.format_id === selectedCombinableVideoFormat
            );
        }
    })();
    const selectedAudioFormat = (() => {
        if (videoMetadata?._type === 'video') {
            return allFilteredFormats.find(
                (format) => format.format_id === selectedCombinableAudioFormat
            );
        } else if (videoMetadata?._type === 'playlist') {
            return allFilteredFormats.find(
                (format) => format.format_id === selectedCombinableAudioFormat
            );
        }
    })();

    const subtitles = videoMetadata?._type === 'video' ? (videoMetadata?.subtitles || {}) : videoMetadata?._type === 'playlist' ? (videoMetadata?.entries[Number(selectedPlaylistVideoIndex) - 1].subtitles || {}) : {};
    const subtitleLanguages = Object.keys(subtitles).map(langCode => ({
        code: langCode,
        lang: subtitles[langCode][0].name || langCode
    }));

    const searchForm = useForm<z.infer<typeof searchFormSchema>>({
        resolver: zodResolver(searchFormSchema),
        defaultValues: {
          url: videoUrl,
        },
        mode: "onChange",
    })
    const watchedUrl = searchForm.watch("url");
    const { errors: searchFormErrors } = searchForm.formState;

    function handleSearchSubmit(values: z.infer<typeof searchFormSchema>) {
        setVideoMetadata(null);
        setSearchPid(null);
        setShowSearchError(true);
        setIsMetadataLoading(true);
        setSelectedDownloadFormat('best');
        setSelectedCombinableVideoFormat('');
        setSelectedCombinableAudioFormat('');
        setSelectedSubtitles([]);
        setSelectedPlaylistVideoIndex('1');
        resetDownloadConfiguration();

        fetchVideoMetadata({ url: values.url }).then((metadata) => {
            if (!metadata || (metadata._type !== 'video' && metadata._type !== 'playlist') || (metadata && metadata._type === 'video' && metadata.formats.length <= 0) || (metadata && metadata._type === 'playlist' && metadata.entries.length <= 0)) {
                const showSearchError = useCurrentVideoMetadataStore.getState().showSearchError;
                if (showSearchError) {
                    toast.error("Oops! No results found", {
                        description: "The provided URL does not contain any downloadable content or you are not connected to the internet. Please check the URL, your network connection and try again.",
                    });
                }
            }
            if (metadata && (metadata._type === 'video' || metadata._type === 'playlist') && ((metadata._type === 'video' && metadata.formats.length > 0) || (metadata._type === 'playlist' && metadata.entries.length > 0))) setVideoMetadata(metadata);
            if (metadata) console.log(metadata);
            setIsMetadataLoading(false);
        });
    }

    const cancelSearch = async (pid: number | null) => {
        setShowSearchError(false);
        if (pid) {
            console.log("Killing process with PID:", pid);
            await invoke('kill_all_process', { pid: pid });
        }
        setVideoMetadata(null);
        setIsMetadataLoading(false);
    };

    useEffect(() => {
        if (watchedUrl !== videoUrl) {
            setVideoUrl(watchedUrl);
        }
    }, [watchedUrl, videoUrl, setVideoUrl]);

    useEffect(() => {
        const handleAutoSubmitRequest = async () => {
            // Update form and state when requestedUrl changes
            if (requestedUrl && requestedUrl !== searchForm.getValues("url") && !isMetadataLoading) {
                searchForm.setValue("url", requestedUrl);
                setVideoUrl(requestedUrl);
            }

            // Auto-submit the form if the flag is set
            if (autoSubmitSearch && requestedUrl) {
                if (!isMetadataLoading) {
                    // trigger a validation check on the URL field first then get the result
                    await searchForm.trigger("url");
                    const isValidUrl = !searchForm.getFieldState("url").invalid;

                    if (isValidUrl) {
                        // Reset the flag first to prevent loops
                        setAutoSubmitSearch(false);

                        // Submit the form with a small delay to ensure UI is ready
                        setTimeout(() => {
                            handleSearchSubmit({ url: requestedUrl });
                            setRequestedUrl('');
                        }, 300);
                    } else {
                        // If URL is invalid, just reset the flag
                        setAutoSubmitSearch(false);
                        setRequestedUrl('');
                        toast.error("Invalid URL", {
                            description: "The provided URL is not valid.",
                        });
                    }
                } else {
                    // If metadata is loading, just reset the flag
                    setAutoSubmitSearch(false);
                    setRequestedUrl('');
                    toast.info("Search in progress", {
                        description: "There's a search in progress, Please try again later.",
                    });
                }
            } else {
                // If auto-submit is not set, reset the flag
                setAutoSubmitSearch(false);
                setRequestedUrl('');
            }
        }
        handleAutoSubmitRequest();
    }, [requestedUrl, autoSubmitSearch, isMetadataLoading]);

    useEffect(() => {
        const updateTheme = async () => {
            setTheme(appTheme, appColorScheme);
        }
        updateTheme().catch(console.error);
    }, [appTheme, appColorScheme]);

    return (
        <div className="container mx-auto p-4 space-y-4 relative" ref={containerRef}>
            <Card className="gap-4">
                <CardHeader>
                    <CardTitle className="flex items-center"><PackageSearch className="size-5 mr-3 stroke-primary" />{config.appName} Search</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Form {...searchForm}>
                        <form onSubmit={searchForm.handleSubmit(handleSearchSubmit)} className="flex gap-2 w-full" autoComplete="off">
                            <FormField
                                control={searchForm.control}
                                name="url"
                                disabled={isMetadataLoading}
                                render={({ field }) => (
                                    <FormItem className="grow">
                                        <FormControl>
                                            <Input
                                            className="focus-visible:ring-0"
                                            placeholder="Enter Video URL to Search"
                                            {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            {isMetadataLoading && (
                                <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                disabled={!isMetadataLoading}
                                onClick={() => cancelSearch(searchPid)}
                                >
                                    <X className="size-4" />
                                </Button>
                            )}
                            {!isMetadataLoading && !videoUrl && (
                                <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                disabled={isMetadataLoading}
                                onClick={async () => {
                                    const text = await readText();
                                    if (text) {
                                        searchForm.setValue("url", text);
                                        setVideoUrl(text);
                                    }
                                }}
                                >
                                    <Clipboard className="size-4" />
                                </Button>
                            )}
                            {!isMetadataLoading && videoUrl && (
                                <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                disabled={isMetadataLoading}
                                onClick={() => {
                                    searchForm.setValue("url", '');
                                    setVideoUrl('');
                                }}
                                >
                                    <X className="size-4" />
                                </Button>
                            )}
                            <Button
                                type="submit"
                                disabled={!videoUrl || Object.keys(searchFormErrors).length > 0 || isMetadataLoading}
                            >
                                {isMetadataLoading ? (
                                    <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Searching
                                    </>
                                ) : (
                                    'Search'
                                )}
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>
            {!isMetadataLoading && videoMetadata && videoMetadata._type === 'video' && (
                <VideoDownloader
                videoMetadata={videoMetadata}
                audioOnlyFormats={audioOnlyFormats}
                videoOnlyFormats={videoOnlyFormats}
                combinedFormats={combinedFormats}
                qualityPresetFormats={qualityPresetFormats}
                subtitleLanguages={subtitleLanguages}
                />
            )}
            {!isMetadataLoading && videoMetadata && videoMetadata._type === 'playlist' && (
                <PlaylistDownloader
                videoMetadata={videoMetadata}
                audioOnlyFormats={audioOnlyFormats}
                videoOnlyFormats={videoOnlyFormats}
                combinedFormats={combinedFormats}
                allFilteredFormats={allFilteredFormats}
                qualityPresetFormats={qualityPresetFormats}
                subtitleLanguages={subtitleLanguages}
                selectedFormat={selectedFormat}
                />
            )}
            {!isMetadataLoading && videoMetadata && selectedDownloadFormat && (
                <BottomBar
                videoMetadata={videoMetadata}
                selectedFormat={selectedFormat}
                selectedFormatFileType={selectedFormatFileType}
                selectedVideoFormat={selectedVideoFormat}
                selectedAudioFormat={selectedAudioFormat}
                containerRef={containerRef}
                />
            )}
        </div>
    );
}
