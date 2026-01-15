import { useDownloaderPageStatesStore } from "@/services/store";
import { DownloadCloud, Info, ListVideo, AlertCircleIcon } from "lucide-react";
import { FormatSelectionGroup, FormatSelectionGroupItem } from "@/components/custom/formatSelectionGroup";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { RawVideoInfo, VideoFormat } from "@/types/video";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { PlaylistToggleGroup, PlaylistToggleGroupItem } from "@/components/custom/playlistToggleGroup";
import { getMergedBestFormat } from "@/utils";
import { Switch } from "@/components/ui/switch";

interface PlaylistPreviewSelectionProps {
    videoMetadata: RawVideoInfo;
}

interface SelectivePlaylistDownloadProps {
    videoMetadata: RawVideoInfo;
    audioOnlyFormats: VideoFormat[] | undefined;
    videoOnlyFormats: VideoFormat[] | undefined;
    combinedFormats: VideoFormat[] | undefined;
    qualityPresetFormats: VideoFormat[] | undefined;
    subtitleLanguages: { code: string; lang: string }[];
}

interface CombinedPlaylistDownloadProps {
    audioOnlyFormats: VideoFormat[] | undefined;
    videoOnlyFormats: VideoFormat[] | undefined;
    subtitleLanguages: { code: string; lang: string }[];
}

interface PlaylistDownloaderProps {
    videoMetadata: RawVideoInfo;
    audioOnlyFormats: VideoFormat[] | undefined;
    videoOnlyFormats: VideoFormat[] | undefined;
    combinedFormats: VideoFormat[] | undefined;
    qualityPresetFormats: VideoFormat[] | undefined;
    subtitleLanguages: { code: string; lang: string }[];
}

function PlaylistPreviewSelection({ videoMetadata }: PlaylistPreviewSelectionProps) {
    const selectedPlaylistVideos = useDownloaderPageStatesStore((state) => state.selectedPlaylistVideos);
    const setSelectedDownloadFormat = useDownloaderPageStatesStore((state) => state.setSelectedDownloadFormat);
    const setSelectedCombinableVideoFormat = useDownloaderPageStatesStore((state) => state.setSelectedCombinableVideoFormat);
    const setSelectedCombinableAudioFormat = useDownloaderPageStatesStore((state) => state.setSelectedCombinableAudioFormat);
    const setSelectedSubtitles = useDownloaderPageStatesStore((state) => state.setSelectedSubtitles);
    const setSelectedPlaylistVideos = useDownloaderPageStatesStore((state) => state.setSelectedPlaylistVideos);
    const resetDownloadConfiguration = useDownloaderPageStatesStore((state) => state.resetDownloadConfiguration);

    const totalVideos = videoMetadata.entries.filter((entry) => entry).length;
    const allVideoIndices = videoMetadata.entries.filter((entry) => entry).map((entry) => entry.playlist_index.toString());

    return (
        <div className="flex flex-col w-full pr-4">
            <div className="flex items-center justify-between mb-4 mt-2">
                <h3 className="text-sm flex items-center gap-2">
                    <ListVideo className="w-4 h-4" />
                    <span>Playlist ({videoMetadata.entries[0].n_entries})</span>
                </h3>
                <div className="flex items-center space-x-2">
                    <Switch
                    id="select-all-videos"
                    checked={selectedPlaylistVideos.length === totalVideos && totalVideos > 0}
                    onCheckedChange={(checked) => {
                        if (checked) {
                            setSelectedPlaylistVideos(allVideoIndices);
                        } else {
                            setSelectedPlaylistVideos(["1"]);
                        }
                        setSelectedDownloadFormat('best');
                        setSelectedSubtitles([]);
                        setSelectedCombinableVideoFormat('');
                        setSelectedCombinableAudioFormat('');
                        resetDownloadConfiguration();
                    }}
                    disabled={totalVideos <= 1}
                    />
                </div>
            </div>
            <div className="flex flex-col overflow-y-scroll max-h-[50vh] xl:max-h-[60vh] no-scrollbar">
                <h2 className="mb-1">{videoMetadata.entries[0].playlist_title ? videoMetadata.entries[0].playlist_title : 'UNTITLED'}</h2>
                <p className="text-muted-foreground text-xs mb-4">{videoMetadata.entries[0].playlist_creator || videoMetadata.entries[0].playlist_channel || videoMetadata.entries[0].playlist_uploader || 'unknown'}</p>
                <PlaylistToggleGroup
                    className="mb-2"
                    type="multiple"
                    value={selectedPlaylistVideos}
                    onValueChange={(value: string[]) => {
                        if (value.length > 0) {
                            setSelectedPlaylistVideos(value);
                            setSelectedDownloadFormat('best');
                            setSelectedSubtitles([]);
                            setSelectedCombinableVideoFormat('');
                            setSelectedCombinableAudioFormat('');
                            resetDownloadConfiguration();
                        }
                    }}
                >
                    {videoMetadata.entries.map((entry) => entry ? (
                        <PlaylistToggleGroupItem
                            key={entry.playlist_index}
                            value={entry.playlist_index.toString()}
                            video={entry}
                        />
                    ) : null)}
                </PlaylistToggleGroup>
                <div className="flex items-center text-muted-foreground">
                    <Info className="w-3 h-3 mr-2" />
                    <span className="text-xs">Extracted from {videoMetadata.entries[0].extractor ? videoMetadata.entries[0].extractor.charAt(0).toUpperCase() + videoMetadata.entries[0].extractor.slice(1) : 'Unknown'}</span>
                </div>
                <div className="spacer mb-12"></div>
            </div>
        </div>
    );
}

function SelectivePlaylistDownload({ videoMetadata, audioOnlyFormats, videoOnlyFormats, combinedFormats, qualityPresetFormats, subtitleLanguages }: SelectivePlaylistDownloadProps) {
    const selectedDownloadFormat = useDownloaderPageStatesStore((state) => state.selectedDownloadFormat);
    const selectedSubtitles = useDownloaderPageStatesStore((state) => state.selectedSubtitles);
    const selectedPlaylistVideos = useDownloaderPageStatesStore((state) => state.selectedPlaylistVideos);
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
                // const currentlySelectedFormat = value === 'best' ? videoMetadata?.entries[Number(value) - 1].requested_downloads[0] : allFilteredFormats.find((format) => format.format_id === value);
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
                    format={getMergedBestFormat(videoMetadata.entries, selectedPlaylistVideos) as VideoFormat}
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

function CombinedPlaylistDownload({ audioOnlyFormats, videoOnlyFormats, subtitleLanguages }: CombinedPlaylistDownloadProps) {
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

export function PlaylistDownloader({ videoMetadata, audioOnlyFormats, videoOnlyFormats, combinedFormats, qualityPresetFormats, subtitleLanguages }: PlaylistDownloaderProps) {
    const activeDownloadModeTab = useDownloaderPageStatesStore((state) => state.activeDownloadModeTab);
    const setActiveDownloadModeTab = useDownloaderPageStatesStore((state) => state.setActiveDownloadModeTab);
    const playlistPanelSizes = useDownloaderPageStatesStore((state) => state.playlistPanelSizes);
    const setPlaylistPanelSizes = useDownloaderPageStatesStore((state) => state.setPlaylistPanelSizes);
    const resetDownloadConfiguration = useDownloaderPageStatesStore((state) => state.resetDownloadConfiguration);

    return (
        <div className="flex">
            <ResizablePanelGroup
            direction="horizontal"
            className="w-full"
            onLayout={(sizes) => setPlaylistPanelSizes(sizes)}
            >
                <ResizablePanel
                defaultSize={playlistPanelSizes[0]}
                >
                    <PlaylistPreviewSelection videoMetadata={videoMetadata} />
                </ResizablePanel>
                <ResizableHandle />
                <ResizablePanel
                defaultSize={playlistPanelSizes[1]}
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
                                <SelectivePlaylistDownload
                                videoMetadata={videoMetadata}
                                audioOnlyFormats={audioOnlyFormats}
                                videoOnlyFormats={videoOnlyFormats}
                                combinedFormats={combinedFormats}
                                qualityPresetFormats={qualityPresetFormats}
                                subtitleLanguages={subtitleLanguages}
                                />
                            </TabsContent>
                            <TabsContent value="combine">
                                <CombinedPlaylistDownload
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
