import clsx from "clsx";
import { ProxyImage } from "@/components/custom/proxyImage";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Separator } from "@/components/ui/separator";
import { useDownloaderPageStatesStore } from "@/services/store";
import { formatBitrate, formatDurationString, formatReleaseDate, formatYtStyleCount, isObjEmpty } from "@/utils";
import { Calendar, Clock, DownloadCloud, Eye, Info, ThumbsUp, AlertCircleIcon } from "lucide-react";
import { FormatSelectionGroup, FormatSelectionGroupItem } from "@/components/custom/formatSelectionGroup";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { RawVideoInfo, VideoFormat } from "@/types/video";
// import { PlaylistToggleGroup, PlaylistToggleGroupItem } from "@/components/custom/playlistToggleGroup";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

interface VideoPreviewProps {
    videoMetadata: RawVideoInfo;
}

interface SelectiveVideoDownloadProps {
    videoMetadata: RawVideoInfo;
    audioOnlyFormats: VideoFormat[] | undefined;
    videoOnlyFormats: VideoFormat[] | undefined;
    combinedFormats: VideoFormat[] | undefined;
    qualityPresetFormats: VideoFormat[] | undefined;
    subtitleLanguages: { code: string; lang: string }[];
}

interface CombinedVideoDownloadProps {
    audioOnlyFormats: VideoFormat[] | undefined;
    videoOnlyFormats: VideoFormat[] | undefined;
    subtitleLanguages: { code: string; lang: string }[];
}

interface VideoDownloaderProps {
    videoMetadata: RawVideoInfo;
    audioOnlyFormats: VideoFormat[] | undefined;
    videoOnlyFormats: VideoFormat[] | undefined;
    combinedFormats: VideoFormat[] | undefined;
    qualityPresetFormats: VideoFormat[] | undefined;
    subtitleLanguages: { code: string; lang: string }[];
}

function VideoPreview({ videoMetadata }: VideoPreviewProps) {
    return (
        <div className="flex flex-col w-full pr-4">
            <h3 className="text-sm mb-4 mt-2 flex items-center gap-2">
                <Info className="w-4 h-4" />
                <span>Metadata</span>
            </h3>
            <div className="flex flex-col overflow-y-scroll max-h-[50vh] xl:max-h-[60vh] no-scrollbar">
                <AspectRatio ratio={16 / 9} className={clsx("w-full rounded-lg overflow-hidden mb-2 border border-border", videoMetadata.aspect_ratio && videoMetadata.aspect_ratio === 0.56 && "relative")}>
                    <ProxyImage src={videoMetadata.thumbnail} alt="thumbnail" className={clsx(videoMetadata.aspect_ratio && videoMetadata.aspect_ratio === 0.56 && "absolute h-full w-auto top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2")} />
                </AspectRatio>
                <h2 className="mb-1">{videoMetadata.title ? videoMetadata.title : 'UNTITLED'}</h2>
                <p className="text-muted-foreground text-xs mb-2">{videoMetadata.creator || videoMetadata.channel || videoMetadata.uploader || 'unknown'}</p>
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
                <div className="spacer mb-12"></div>
            </div>
        </div>
    );
}

function SelectiveVideoDownload({ videoMetadata, audioOnlyFormats, videoOnlyFormats, combinedFormats, qualityPresetFormats, subtitleLanguages }: SelectiveVideoDownloadProps) {
    const selectedDownloadFormat = useDownloaderPageStatesStore((state) => state.selectedDownloadFormat);
    const selectedSubtitles = useDownloaderPageStatesStore((state) => state.selectedSubtitles);
    const setSelectedDownloadFormat = useDownloaderPageStatesStore((state) => state.setSelectedDownloadFormat);
    const setSelectedSubtitles = useDownloaderPageStatesStore((state) => state.setSelectedSubtitles);
    const resetDownloadConfiguration = useDownloaderPageStatesStore((state) => state.resetDownloadConfiguration);

    return (
        <div className="flex flex-col overflow-y-scroll max-h-[50vh] xl:max-h-[60vh] no-scrollbar">
            {subtitleLanguages && subtitleLanguages.length > 0 && (
                <ToggleGroup
                type="multiple"
                variant="outline"
                className="flex flex-col items-start gap-2 mb-2"
                value={selectedSubtitles}
                onValueChange={(value) => setSelectedSubtitles(value)}
                // disabled={selectedFormat?.ext !== 'mp4' && selectedFormat?.ext !== 'mkv' && selectedFormat?.ext !== 'webm'}
                >
                    <p className="text-xs">Subtitle Languages</p>
                    <div className="flex gap-2 flex-wrap items-center">
                        {subtitleLanguages.map((lang) => {
                            const hasAutoSubSelected = selectedSubtitles.some(code => code.endsWith('-orig'));
                            const hasNormalSubSelected = selectedSubtitles.some(code => !code.endsWith('-orig'));
                            const isDisabled = (hasAutoSubSelected && !lang.code.endsWith('-orig')) || (hasNormalSubSelected && lang.code.endsWith('-orig'));

                            return (
                                <ToggleGroupItem
                                className="text-xs text-nowrap border-2 data-[state=on]:border-2 data-[state=on]:border-primary data-[state=on]:bg-primary/10 hover:bg-muted/70"
                                value={lang.code}
                                size="sm"
                                aria-label={lang.lang}
                                key={lang.code}
                                disabled={isDisabled}>
                                    {lang.lang}
                                </ToggleGroupItem>
                            );
                        })}
                    </div>
                </ToggleGroup>
            )}
            <FormatSelectionGroup
            value={selectedDownloadFormat}
            onValueChange={(value) => {
                setSelectedDownloadFormat(value);
                // const currentlySelectedFormat = value === 'best' ? videoMetadata?.requested_downloads[0] : allFilteredFormats.find((format) => format.format_id === value);
                // if (currentlySelectedFormat?.ext !== 'mp4' && currentlySelectedFormat?.ext !== 'mkv' && currentlySelectedFormat?.ext !== 'webm') {
                //     setSelectedSubtitles([]);
                // }
                resetDownloadConfiguration();
            }}
            >
                <p className="text-xs">Suggested</p>
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
            <div className="spacer mb-12"></div>
        </div>
    );
}

function CombinedVideoDownload({ audioOnlyFormats, videoOnlyFormats, subtitleLanguages }: CombinedVideoDownloadProps) {
    const selectedCombinableVideoFormat = useDownloaderPageStatesStore((state) => state.selectedCombinableVideoFormat);
    const selectedCombinableAudioFormat = useDownloaderPageStatesStore((state) => state.selectedCombinableAudioFormat);
    const selectedSubtitles = useDownloaderPageStatesStore((state) => state.selectedSubtitles);
    const setSelectedCombinableVideoFormat = useDownloaderPageStatesStore((state) => state.setSelectedCombinableVideoFormat);
    const setSelectedCombinableAudioFormat = useDownloaderPageStatesStore((state) => state.setSelectedCombinableAudioFormat);
    const setSelectedSubtitles = useDownloaderPageStatesStore((state) => state.setSelectedSubtitles);
    const resetDownloadConfiguration = useDownloaderPageStatesStore((state) => state.resetDownloadConfiguration);

    return (
        <div className="flex flex-col overflow-y-scroll max-h-[50vh] xl:max-h-[60vh] no-scrollbar">
            {audioOnlyFormats && audioOnlyFormats.length > 0 && videoOnlyFormats && videoOnlyFormats.length > 0 && subtitleLanguages && subtitleLanguages.length > 0 && (
                <ToggleGroup
                type="multiple"
                variant="outline"
                className="flex flex-col items-start gap-2 mb-2"
                value={selectedSubtitles}
                onValueChange={(value) => setSelectedSubtitles(value)}
                >
                    <p className="text-xs">Subtitle Languages</p>
                    <div className="flex gap-2 flex-wrap items-center">
                        {subtitleLanguages.map((lang) => {
                            const hasAutoSubSelected = selectedSubtitles.some(code => code.endsWith('-orig'));
                            const hasNormalSubSelected = selectedSubtitles.some(code => !code.endsWith('-orig'));
                            const isDisabled = (hasAutoSubSelected && !lang.code.endsWith('-orig')) || (hasNormalSubSelected && lang.code.endsWith('-orig'));

                            return (
                                <ToggleGroupItem
                                className="text-xs text-nowrap border-2 data-[state=on]:border-2 data-[state=on]:border-primary data-[state=on]:bg-primary/10 hover:bg-muted/70"
                                value={lang.code}
                                size="sm"
                                aria-label={lang.lang}
                                key={lang.code}
                                disabled={isDisabled}>
                                    {lang.lang}
                                </ToggleGroupItem>
                            );
                        })}
                    </div>
                </ToggleGroup>
            )}
            <FormatSelectionGroup
            className="mb-2"
            value={selectedCombinableAudioFormat}
            onValueChange={(value) => {
                setSelectedCombinableAudioFormat(value);
                resetDownloadConfiguration();
            }}
            >
                {videoOnlyFormats && videoOnlyFormats.length > 0 && audioOnlyFormats && audioOnlyFormats.length > 0 && (
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
            </FormatSelectionGroup>
            <FormatSelectionGroup
            value={selectedCombinableVideoFormat}
            onValueChange={(value) => {
                setSelectedCombinableVideoFormat(value);
                resetDownloadConfiguration();
            }}
            >
                {audioOnlyFormats && audioOnlyFormats.length > 0 && videoOnlyFormats && videoOnlyFormats.length > 0 && (
                <>
                    <p className="text-xs">Video</p>
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
            </FormatSelectionGroup>
            {(!videoOnlyFormats || videoOnlyFormats.length === 0 || !audioOnlyFormats || audioOnlyFormats.length === 0) && (
                <Alert>
                    <AlertCircleIcon className="size-4 stroke-primary" />
                    <AlertTitle>Unable to use Combine Mode!</AlertTitle>
                    <AlertDescription>
                        Cannot use combine mode for this video as it does not have both audio and video formats available. Use Selective Mode or try another video.
                    </AlertDescription>
                </Alert>
            )}
            <div className="spacer mb-12"></div>
        </div>
    );
}

export function VideoDownloader({ videoMetadata, audioOnlyFormats, videoOnlyFormats, combinedFormats, qualityPresetFormats, subtitleLanguages }: VideoDownloaderProps) {
    const activeDownloadModeTab = useDownloaderPageStatesStore((state) => state.activeDownloadModeTab);
    const setActiveDownloadModeTab = useDownloaderPageStatesStore((state) => state.setActiveDownloadModeTab);
    const resetDownloadConfiguration = useDownloaderPageStatesStore((state) => state.resetDownloadConfiguration);
    const videoPanelSizes = useDownloaderPageStatesStore((state) => state.videoPanelSizes);
    const setVideoPanelSizes = useDownloaderPageStatesStore((state) => state.setVideoPanelSizes);

    return (
        <div className="flex">
            <ResizablePanelGroup
            direction="horizontal"
            className="w-full"
            onLayout={(sizes) => setVideoPanelSizes(sizes)}
            >
                <ResizablePanel
                defaultSize={videoPanelSizes[0]}
                >
                    <VideoPreview videoMetadata={videoMetadata} />
                </ResizablePanel>
                <ResizableHandle />
                <ResizablePanel
                defaultSize={videoPanelSizes[1]}
                >
                    <div className="flex flex-col w-full pl-4">
                        <Tabs
                        className=""
                        value={activeDownloadModeTab}
                        onValueChange={(tab) => {
                            setActiveDownloadModeTab(tab);
                            resetDownloadConfiguration();
                        }}
                        >
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm flex items-center gap-2">
                                    <DownloadCloud className="w-4 h-4" />
                                    <span>Download Options</span>
                                </h3>
                                <TabsList>
                                    <TabsTrigger value="selective">Selective</TabsTrigger>
                                    <TabsTrigger value="combine">Combine</TabsTrigger>
                                </TabsList>
                            </div>
                            <TabsContent value="selective">
                                <SelectiveVideoDownload
                                videoMetadata={videoMetadata}
                                audioOnlyFormats={audioOnlyFormats}
                                videoOnlyFormats={videoOnlyFormats}
                                combinedFormats={combinedFormats}
                                qualityPresetFormats={qualityPresetFormats}
                                subtitleLanguages={subtitleLanguages}
                                />
                            </TabsContent>
                            <TabsContent value="combine">
                                <CombinedVideoDownload
                                audioOnlyFormats={audioOnlyFormats}
                                videoOnlyFormats={videoOnlyFormats}
                                subtitleLanguages={subtitleLanguages}
                                />
                            </TabsContent>
                        </Tabs>
                    </div>
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    );
}
