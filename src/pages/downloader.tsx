import clsx from "clsx";
import { ProxyImage } from "@/components/custom/proxyImage";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAppContext } from "@/providers/appContextProvider";
import { useCurrentVideoMetadataStore, useDownloaderPageStatesStore } from "@/services/store";
import { determineFileType, fileFormatFilter, formatBitrate, formatDurationString, formatFileSize, formatReleaseDate, formatYtStyleCount, isObjEmpty, sortByBitrate } from "@/utils";
import { Calendar, Clock, DownloadCloud, Eye, Info, Loader2, Music, ThumbsUp, Video, File, ListVideo } from "lucide-react";
import { FormatSelectionGroup, FormatSelectionGroupItem } from "@/components/custom/formatSelectionGroup";
import { useEffect, useRef } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { VideoFormat } from "@/types/video";
// import { PlaylistToggleGroup, PlaylistToggleGroupItem } from "@/components/custom/playlistToggleGroup";
import { PlaylistSelectionGroup, PlaylistSelectionGroupItem } from "@/components/custom/playlistSelectionGroup";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod"
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { config } from "@/config";

const searchFormSchema = z.object({
    url: z.string().min(1, { message: "URL is required" })
    .url({message: "Invalid URL format." }),
});

export default function DownloaderPage() {
    const { fetchVideoMetadata, startDownload } = useAppContext();
    const { toast } = useToast();
    
    const videoUrl = useCurrentVideoMetadataStore((state) => state.videoUrl);
    const videoMetadata = useCurrentVideoMetadataStore((state) => state.videoMetadata);
    const isMetadataLoading = useCurrentVideoMetadataStore((state) => state.isMetadataLoading);
    const requestedUrl = useCurrentVideoMetadataStore((state) => state.requestedUrl);
    const autoSubmitSearch = useCurrentVideoMetadataStore((state) => state.autoSubmitSearch);
    const setVideoUrl = useCurrentVideoMetadataStore((state) => state.setVideoUrl);
    const setVideoMetadata = useCurrentVideoMetadataStore((state) => state.setVideoMetadata);
    const setIsMetadataLoading = useCurrentVideoMetadataStore((state) => state.setIsMetadataLoading);
    const setRequestedUrl = useCurrentVideoMetadataStore((state) => state.setRequestedUrl);
    const setAutoSubmitSearch = useCurrentVideoMetadataStore((state) => state.setAutoSubmitSearch);

    const isStartingDownload = useDownloaderPageStatesStore((state) => state.isStartingDownload);
    const selctedDownloadFormat = useDownloaderPageStatesStore((state) => state.selctedDownloadFormat);
    const selectedSubtitles = useDownloaderPageStatesStore((state) => state.selectedSubtitles);
    const selectedPlaylistVideoIndex = useDownloaderPageStatesStore((state) => state.selectedPlaylistVideoIndex);
    const setIsStartingDownload = useDownloaderPageStatesStore((state) => state.setIsStartingDownload);
    const setSelctedDownloadFormat = useDownloaderPageStatesStore((state) => state.setSelctedDownloadFormat);
    const setSelectedSubtitles = useDownloaderPageStatesStore((state) => state.setSelectedSubtitles);
    const setSelectedPlaylistVideoIndex = useDownloaderPageStatesStore((state) => state.setSelectedPlaylistVideoIndex);
    
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
            if (selctedDownloadFormat === 'best') {
                return videoMetadata?.requested_downloads[0];
            }
            return allFilteredFormats.find(
                (format) => format.format_id === selctedDownloadFormat
            );
        } else if (videoMetadata?._type === 'playlist') {
            if (selctedDownloadFormat === 'best') {
                return videoMetadata?.entries[Number(selectedPlaylistVideoIndex) - 1].requested_downloads[0];
            }
            return allFilteredFormats.find(
                (format) => format.format_id === selctedDownloadFormat
            );
        }
    })();
    const selectedFormatFileType = determineFileType(selectedFormat?.vcodec, selectedFormat?.acodec);

    const subtitles = videoMetadata?._type === 'video' ? (videoMetadata?.subtitles || {}) : videoMetadata?._type === 'playlist' ? (videoMetadata?.entries[Number(selectedPlaylistVideoIndex) - 1].subtitles || {}) : {};
    const subtitleLanguages = Object.keys(subtitles).map(langCode => ({
        code: langCode,
        lang: subtitles[langCode][0].name || langCode
    }));

    const containerRef = useRef<HTMLDivElement>(null);
    const bottomBarRef = useRef<HTMLDivElement>(null);

    const searchForm = useForm<z.infer<typeof searchFormSchema>>({
        resolver: zodResolver(searchFormSchema),
        defaultValues: {
          url: videoUrl,
        },
        mode: "onChange",
    })
    const watchedUrl = searchForm.watch("url");

    function handleSearchSubmit(values: z.infer<typeof searchFormSchema>) {
        setVideoMetadata(null);
        setIsMetadataLoading(true);
        setSelctedDownloadFormat('best');
        setSelectedSubtitles([]);
        setSelectedPlaylistVideoIndex('1');
        fetchVideoMetadata(values.url).then((metadata) => {
            if (!metadata || (metadata._type !== 'video' && metadata._type !== 'playlist') || (metadata && metadata._type === 'video' && metadata.formats.length <= 0) || (metadata && metadata._type === 'playlist' && metadata.entries.length <= 0)) {
                toast({
                    title: 'Opps! No results found',
                    description: 'The provided URL does not contain any downloadable content. Please check the URL and try again.',
                    variant: "destructive"
                });
            }
            if (metadata && (metadata._type === 'video' || metadata._type === 'playlist') && ((metadata._type === 'video' && metadata.formats.length > 0) || (metadata._type === 'playlist' && metadata.entries.length > 0))) setVideoMetadata(metadata);
            if (metadata) console.log(metadata);
            setIsMetadataLoading(false);
        });
    }

    useEffect(() => {
        const updateBottomBarWidth = (): void => {
            if (containerRef.current && bottomBarRef.current) {
                bottomBarRef.current.style.width = `${containerRef.current.offsetWidth}px`;
                const containerRect = containerRef.current.getBoundingClientRect();
                bottomBarRef.current.style.left = `${containerRect.left}px`;
            }
        };
        updateBottomBarWidth();
        const resizeObserver = new ResizeObserver(() => {
            updateBottomBarWidth();
        });
        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }
        window.addEventListener('resize', updateBottomBarWidth);
        window.addEventListener('scroll', updateBottomBarWidth);
        return () => {
            resizeObserver.disconnect();
            window.removeEventListener('resize', updateBottomBarWidth);
            window.removeEventListener('scroll', updateBottomBarWidth);
        };
    }, []);

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
                        toast({
                            title: 'Invalid URL',
                            description: 'The provided URL is not valid.',
                            variant: "destructive"
                        });
                    }
                } else {
                    // If metadata is loading, just reset the flag
                    setAutoSubmitSearch(false);
                    setRequestedUrl('');
                    toast({
                        title: 'Search in progress',
                        description: 'Search in progress, try again later.',
                        variant: "destructive"
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

    // useEffect(() => {
    //     console.log("Selected playlist items:", selectedVideos)
    // }), [selectedVideos]

    return (
        <div className="container mx-auto p-4 space-y-4 relative" ref={containerRef}>
            <Card>
                <CardHeader>
                    <CardTitle>{config.appName} Search</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Form {...searchForm}>
                        <form onSubmit={searchForm.handleSubmit(handleSearchSubmit)} className="flex gap-2 w-full" autoComplete="off">
                            <FormField
                                control={searchForm.control}
                                name="url"
                                disabled={isMetadataLoading}
                                render={({ field }) => (
                                    <FormItem className="w-full">
                                        <FormControl>
                                            <Input
                                            className="focus-visible:ring-0"
                                            placeholder="Enter URL to search..."
                                            {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button
                                type="submit"
                                disabled={!videoUrl || isMetadataLoading}
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
            {!isMetadataLoading && videoMetadata && videoMetadata._type === 'video' && (       // === Single Video ===
            <div className="flex">
                <div className="flex flex-col w-[55%] border-r border-border pr-4">
                    <h3 className="text-sm mb-4 flex items-center gap-2">
                        <Info className="w-4 h-4" />
                        <span>Metadata</span>
                    </h3>
                    <div className="flex flex-col overflow-y-scroll max-h-[53vh] no-scrollbar">
                        <AspectRatio ratio={16 / 9} className={clsx("w-full rounded-lg overflow-hidden mb-2 border border-border", videoMetadata.aspect_ratio && videoMetadata.aspect_ratio === 0.56 && "relative")}>
                            <ProxyImage src={videoMetadata.thumbnail} alt="thumbnail" className={clsx(videoMetadata.aspect_ratio && videoMetadata.aspect_ratio === 0.56 && "absolute h-full w-auto top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2")} />
                        </AspectRatio>
                        <h2 className="mb-1">{videoMetadata.title ? videoMetadata.title : 'UNTITLED'}</h2>
                        <p className="text-muted-foreground text-xs mb-2">{videoMetadata.channel || videoMetadata.uploader || 'unknown'}</p>
                        <div className="flex items-center mb-2">
                            <span className="text-xs text-muted-foreground flex items-center pr-3"><Clock className="w-4 h-4 mr-2"/> {videoMetadata.duration_string ? formatDurationString(videoMetadata.duration_string) : 'unknown'}</span>
                            <Separator orientation="vertical" />
                            <span className="text-xs text-muted-foreground flex items-center px-3"><Eye className="w-4 h-4 mr-2"/> {videoMetadata.view_count ? formatYtStyleCount(videoMetadata.view_count) : 'unknown'}</span>
                            <Separator orientation="vertical" />
                            <span className="text-xs text-muted-foreground flex items-center pl-3"><ThumbsUp className="w-4 h-4 mr-2"/> {videoMetadata.like_count ? formatYtStyleCount(videoMetadata.like_count) : 'unknown'}</span>
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-2 mb-2">
                            <Calendar className="w-4 h-4" />
                            <span className="">{videoMetadata.upload_date ? formatReleaseDate(videoMetadata.upload_date) : 'unknown'}</span>
                        </p>
                        <div className="flex flex-wrap gap-2 text-xs mb-2">
                            {videoMetadata.resolution && (
                                <span className="border border-border py-1 px-2 rounded">{videoMetadata.resolution}</span>
                            )}
                            {videoMetadata.tbr && (
                                <span className="border border-border py-1 px-2 rounded">{formatBitrate(videoMetadata.tbr)}</span>
                            )}
                            {videoMetadata.fps && (
                                <span className="border border-border py-1 px-2 rounded">{videoMetadata.fps} fps</span>
                            )}
                            {videoMetadata.subtitles && !isObjEmpty(videoMetadata.subtitles) && (
                                <span className="border border-border py-1 px-2 rounded">SUB</span>
                            )}
                            {videoMetadata.dynamic_range && videoMetadata.dynamic_range !== 'SDR' && (
                                <span className="border border-border py-1 px-2 rounded">{videoMetadata.dynamic_range}</span>
                            )}
                        </div>
                        <div className="flex items-center text-muted-foreground">
                            <Info className="w-3 h-3 mr-2" />
                            <span className="text-xs">Extracted from {videoMetadata.extractor ? videoMetadata.extractor.charAt(0).toUpperCase() + videoMetadata.extractor.slice(1) : 'Unknown'}</span>
                        </div>
                        <div className="spacer mb-14"></div>
                    </div>
                </div>
                <div className="flex flex-col w-full pl-4">
                    <h3 className="text-sm mb-4 flex items-center gap-2">
                        <DownloadCloud className="w-4 h-4" />
                        <span>Download Options</span>
                    </h3>
                    <div className="flex flex-col overflow-y-scroll max-h-[53vh] no-scrollbar">
                        {subtitles && !isObjEmpty(subtitles) && (
                            <ToggleGroup
                            type="multiple"
                            variant="outline"
                            className="flex flex-col items-start gap-2 mb-2"
                            value={selectedSubtitles}
                            onValueChange={(value) => setSelectedSubtitles(value)}
                            disabled={selectedFormat?.ext !== 'mp4' && selectedFormat?.ext !== 'mkv' && selectedFormat?.ext !== 'webm'}
                            >
                                <p className="text-xs">Subtitle Languages</p>
                                <div className="flex gap-2 flex-wrap items-center">
                                    {subtitleLanguages.map((lang) => (
                                        <ToggleGroupItem
                                        className="text-xs text-nowrap border-2 data-[state=on]:border-2 data-[state=on]:border-primary data-[state=on]:bg-muted/70 hover:bg-muted/70"
                                        value={lang.code}
                                        size="sm"
                                        aria-label={lang.lang}
                                        key={lang.code}>
                                            {lang.lang}
                                        </ToggleGroupItem>
                                    ))}
                                </div>
                            </ToggleGroup>
                        )}
                        <FormatSelectionGroup
                        value={selctedDownloadFormat}
                        onValueChange={(value) => {
                            setSelctedDownloadFormat(value);
                            const currentlySelectedFormat = value === 'best' ? videoMetadata?.requested_downloads[0] : allFilteredFormats.find((format) => format.format_id === value);
                            if (currentlySelectedFormat?.ext !== 'mp4' && currentlySelectedFormat?.ext !== 'mkv' && currentlySelectedFormat?.ext !== 'webm') {
                                setSelectedSubtitles([]);
                            }
                        }}
                        >
                            <p className="text-xs">Suggested (Best)</p>
                            <div className="">
                                <FormatSelectionGroupItem
                                key="best"
                                value="best"
                                format={videoMetadata.requested_downloads[0]}
                                />
                            </div>
                            {qualityPresetFormats && qualityPresetFormats.length > 0 && (
                            <>
                                <p className="text-xs">Quality Presets</p>
                                <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">
                                    {qualityPresetFormats.map((format) => (
                                        <FormatSelectionGroupItem
                                        key={format.format_id}
                                        value={format.format_id}
                                        format={format}
                                        />
                                    ))}
                                </div>
                            </>
                            )}
                            {audioOnlyFormats && audioOnlyFormats.length > 0 && (
                            <>
                                <p className="text-xs">Audio</p>
                                <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">
                                    {audioOnlyFormats.map((format) => (
                                        <FormatSelectionGroupItem
                                        key={format.format_id}
                                        value={format.format_id}
                                        format={format}
                                        />
                                    ))}
                                </div>
                            </>
                            )}
                            {videoOnlyFormats && videoOnlyFormats.length > 0 && (
                            <>
                                <p className="text-xs">Video {videoOnlyFormats.every(format => format.acodec === 'none') ? '(no audio)' : ''}</p>
                                <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">
                                    {videoOnlyFormats.map((format) => (
                                        <FormatSelectionGroupItem
                                        key={format.format_id}
                                        value={format.format_id}
                                        format={format}
                                        />
                                    ))}
                                </div>
                            </>
                            )}
                            {combinedFormats && combinedFormats.length > 0 && (
                            <>
                                <p className="text-xs">Video</p>
                                <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">
                                    {combinedFormats.map((format) => (
                                        <FormatSelectionGroupItem
                                        key={format.format_id}
                                        value={format.format_id}
                                        format={format}
                                        />
                                    ))}
                                </div>
                            </>
                            )}
                        </FormatSelectionGroup>
                        <div className="spacer mb-14"></div>
                    </div>
                </div>
            </div>
            )}
            {!isMetadataLoading && videoMetadata && videoMetadata._type === 'playlist' && (       // === Playlists ===
                <div className="flex">
                    <div className="flex flex-col w-[55%] border-r border-border pr-4">
                        <h3 className="text-sm mb-4 flex items-center gap-2">
                            <ListVideo className="w-4 h-4" />
                            <span>Playlist ({videoMetadata.entries[0].n_entries})</span>
                        </h3>
                        <div className="flex flex-col overflow-y-scroll max-h-[53vh] no-scrollbar">
                            <h2 className="mb-1">{videoMetadata.entries[0].playlist_title ? videoMetadata.entries[0].playlist_title : 'UNTITLED'}</h2>
                            <p className="text-muted-foreground text-xs mb-4">{videoMetadata.entries[0].playlist_channel || videoMetadata.entries[0].playlist_uploader || 'unknown'}</p>
                            {/* <PlaylistToggleGroup
                                className="mb-2"
                                type="multiple"
                                value={selectedVideos}
                                onValueChange={setSelectedVideos}
                            >
                                {videoMetadata.entries.map((entry) => entry ? (
                                    <PlaylistToggleGroupItem
                                        key={entry.playlist_index} 
                                        value={entry.playlist_index.toString()}
                                        video={entry}
                                    />
                                ) : null)}
                            </PlaylistToggleGroup> */}
                            <PlaylistSelectionGroup
                            className="mb-2"
                            value={selectedPlaylistVideoIndex}
                            onValueChange={(value) => {
                                setSelectedPlaylistVideoIndex(value);
                                setSelctedDownloadFormat('best');
                                setSelectedSubtitles([]);
                            }}
                            >
                                {videoMetadata.entries.map((entry) => entry ? (
                                    <PlaylistSelectionGroupItem
                                    key={entry.playlist_index}
                                    value={entry.playlist_index.toString()}
                                    video={entry}
                                    />
                                ) : null)}
                            </PlaylistSelectionGroup>
                            <div className="flex items-center text-muted-foreground">
                                <Info className="w-3 h-3 mr-2" />
                                <span className="text-xs">Extracted from {videoMetadata.entries[0].extractor ? videoMetadata.entries[0].extractor.charAt(0).toUpperCase() + videoMetadata.entries[0].extractor.slice(1) : 'Unknown'}</span>
                            </div>
                            <div className="spacer mb-14"></div>
                        </div>
                    </div>
                    <div className="flex flex-col w-full pl-4">
                        <h3 className="text-sm mb-4 flex items-center gap-2">
                            <DownloadCloud className="w-4 h-4" />
                            <span>Download Options</span>
                        </h3>
                        <div className="flex flex-col overflow-y-scroll max-h-[53vh] no-scrollbar">
                            {subtitles && !isObjEmpty(subtitles) && (
                                <ToggleGroup
                                type="multiple"
                                variant="outline"
                                className="flex flex-col items-start gap-2 mb-2"
                                value={selectedSubtitles}
                                onValueChange={(value) => setSelectedSubtitles(value)}
                                disabled={selectedFormat?.ext !== 'mp4' && selectedFormat?.ext !== 'mkv' && selectedFormat?.ext !== 'webm'}
                                >
                                    <p className="text-xs">Subtitle Languages</p>
                                    <div className="flex gap-2 flex-wrap items-center">
                                        {subtitleLanguages.map((lang) => (
                                            <ToggleGroupItem
                                            className="text-xs text-nowrap border-2 data-[state=on]:border-2 data-[state=on]:border-primary data-[state=on]:bg-muted/70 hover:bg-muted/70"
                                            value={lang.code}
                                            size="sm"
                                            aria-label={lang.lang}
                                            key={lang.code}>
                                                {lang.lang}
                                            </ToggleGroupItem>
                                        ))}
                                    </div>
                                </ToggleGroup>
                            )}
                            <FormatSelectionGroup
                            value={selctedDownloadFormat}
                            onValueChange={(value) => {
                                setSelctedDownloadFormat(value);
                                const currentlySelectedFormat = value === 'best' ? videoMetadata?.entries[Number(value) - 1].requested_downloads[0] : allFilteredFormats.find((format) => format.format_id === value);
                                if (currentlySelectedFormat?.ext !== 'mp4' && currentlySelectedFormat?.ext !== 'mkv' && currentlySelectedFormat?.ext !== 'webm') {
                                    setSelectedSubtitles([]);
                                }
                            }}
                            >
                                <p className="text-xs">Suggested (Best)</p>
                                <div className="">
                                    <FormatSelectionGroupItem
                                    key="best"
                                    value="best"
                                    format={videoMetadata.entries[Number(selectedPlaylistVideoIndex) - 1].requested_downloads[0]}
                                    />
                                </div>
                                {qualityPresetFormats && qualityPresetFormats.length > 0 && (
                                <>
                                    <p className="text-xs">Quality Presets</p>
                                    <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">
                                        {qualityPresetFormats.map((format) => (
                                            <FormatSelectionGroupItem
                                            key={format.format_id}
                                            value={format.format_id}
                                            format={format}
                                            />
                                        ))}
                                    </div>
                                </>
                                )}
                                {audioOnlyFormats && audioOnlyFormats.length > 0 && (
                                <>
                                    <p className="text-xs">Audio</p>
                                    <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">
                                        {audioOnlyFormats.map((format) => (
                                            <FormatSelectionGroupItem
                                            key={format.format_id}
                                            value={format.format_id}
                                            format={format}
                                            />
                                        ))}
                                    </div>
                                </>
                                )}
                                {videoOnlyFormats && videoOnlyFormats.length > 0 && (
                                <>
                                    <p className="text-xs">Video {videoOnlyFormats.every(format => format.acodec === 'none') ? '(no audio)' : ''}</p>
                                    <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">
                                        {videoOnlyFormats.map((format) => (
                                            <FormatSelectionGroupItem
                                            key={format.format_id}
                                            value={format.format_id}
                                            format={format}
                                            />
                                        ))}
                                    </div>
                                </>
                                )}
                                {combinedFormats && combinedFormats.length > 0 && (
                                <>
                                    <p className="text-xs">Video</p>
                                    <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">
                                        {combinedFormats.map((format) => (
                                            <FormatSelectionGroupItem
                                            key={format.format_id}
                                            value={format.format_id}
                                            format={format}
                                            />
                                        ))}
                                    </div>
                                </>
                                )}
                            </FormatSelectionGroup>
                            <div className="spacer mb-14"></div>
                        </div>
                    </div>
                </div>
            )}
            {!isMetadataLoading && videoMetadata && selctedDownloadFormat && (       // === Bottom Bar ===
                <div className="flex justify-between items-center gap-2 fixed bottom-0 right-0 p-4 w-full bg-background rounded-t-lg border-t border-border z-20" ref={bottomBarRef}>
                    <div className="flex items-center gap-4">
                        <div className="flex justify-center items-center p-3 rounded-md border border-border">
                            {selectedFormatFileType && (selectedFormatFileType === 'video' || selectedFormatFileType === 'video+audio') && (
                                <Video className="w-4 h-4" />
                            )}
                            {selectedFormatFileType && selectedFormatFileType === 'audio' && (
                                <Music className="w-4 h-4" />
                            )}
                            {(!selectedFormatFileType) || (selectedFormatFileType && selectedFormatFileType !== 'video' && selectedFormatFileType !== 'audio' && selectedFormatFileType !== 'video+audio') && (
                                <File className="w-4 h-4" />
                            )}
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-sm text-nowrap max-w-[30rem] xl:max-w-[50rem] overflow-hidden text-ellipsis">{videoMetadata._type === 'video' ? videoMetadata.title : videoMetadata._type === 'playlist' ? videoMetadata.entries[Number(selectedPlaylistVideoIndex) - 1].title : 'Unknown' }</span>
                            <span className="text-xs text-muted-foreground">{selectedFormat?.ext ? selectedFormat.ext.toUpperCase() : 'unknown'} ({selectedFormat?.resolution ? selectedFormat.resolution : 'unknown'}) {selectedFormat?.dynamic_range && selectedFormat.dynamic_range !== 'SDR' ? selectedFormat.dynamic_range : null } {selectedSubtitles.length > 0 ? `• ESUB` : null} • {selectedFormat?.filesize_approx ? formatFileSize(selectedFormat?.filesize_approx) : 'unknown filesize'}</span>
                        </div>
                    </div>
                    <Button
                    onClick={async () => {
                        setIsStartingDownload(true);
                        try {
                            if (videoMetadata._type === 'playlist') {
                                await startDownload(
                                    videoMetadata.original_url,
                                    selctedDownloadFormat === 'best' ? videoMetadata.entries[Number(selectedPlaylistVideoIndex) - 1].requested_downloads[0].format_id : selctedDownloadFormat,
                                    selectedSubtitles.length > 0 ? selectedSubtitles.join(',') : null,
                                    undefined,
                                    selectedPlaylistVideoIndex
                                );
                            } else if (videoMetadata._type === 'video') {
                                await startDownload(
                                    videoMetadata.webpage_url,
                                    selctedDownloadFormat === 'best' ? videoMetadata.requested_downloads[0].format_id : selctedDownloadFormat,
                                    selectedSubtitles.length > 0 ? selectedSubtitles.join(',') : null
                                );
                            }
                            // toast({
                            //     title: 'Download Initiated',
                            //     description: 'Download initiated, it will start shortly.',
                            // });
                        } catch (error) {
                            console.error('Download failed to start:', error);
                            toast({
                                title: 'Failed to Start Download',
                                description: 'There was an error initiating the download.',
                                variant: "destructive"
                            });
                        } finally {
                            setIsStartingDownload(false);
                        }
                    }}
                    disabled={isStartingDownload}
                    >
                        {isStartingDownload ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Starting
                            </>
                        ) : (
                            'Start Download'
                        )}
                    </Button>
                </div>
            )}
        </div>
    );
}