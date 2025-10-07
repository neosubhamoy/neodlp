import { IndeterminateProgress } from "@/components/custom/indeterminateProgress";
import { ProxyImage } from "@/components/custom/proxyImage";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useAppContext } from "@/providers/appContextProvider";
import { useCurrentVideoMetadataStore, useDownloadActionStatesStore, useDownloadStatesStore, useLibraryPageStatesStore } from "@/services/store";
import { formatBitrate, formatCodec, formatDurationString, formatFileSize, formatSecToTimeString, formatSpeed } from "@/utils";
import { AudioLines, Clock, File, FileAudio2, FileQuestion, FileVideo2, FolderInput, ListVideo, Loader2, Music, Pause, Play, Search, Square, Trash2, Video, X } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import * as fs from "@tauri-apps/plugin-fs";
import { DownloadState } from "@/types/download";
import { useQueryClient } from "@tanstack/react-query";
import { useDeleteDownloadState } from "@/services/mutations";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import Heading from "@/components/heading";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useLogger } from "@/helpers/use-logger";

export default function LibraryPage() {
    const activeTab = useLibraryPageStatesStore(state => state.activeTab);
    const setActiveTab = useLibraryPageStatesStore(state => state.setActiveTab);

    const downloadStates = useDownloadStatesStore(state => state.downloadStates);
    const downloadActions = useDownloadActionStatesStore(state => state.downloadActions);
    const setIsResumingDownload = useDownloadActionStatesStore(state => state.setIsResumingDownload);
    const setIsPausingDownload = useDownloadActionStatesStore(state => state.setIsPausingDownload);
    const setIsCancelingDownload = useDownloadActionStatesStore(state => state.setIsCancelingDownload);
    const setIsDeleteFileChecked = useDownloadActionStatesStore(state => state.setIsDeleteFileChecked);

    const { pauseDownload, resumeDownload, cancelDownload } = useAppContext()

    const queryClient = useQueryClient();
    const downloadStateDeleter = useDeleteDownloadState();
    const navigate = useNavigate();
    const LOG = useLogger();

    const incompleteDownloads = downloadStates.filter(state => state.download_status !== 'completed');
    const completedDownloads = downloadStates.filter(state => state.download_status === 'completed')
    .sort((a, b) => {
        // Latest updated first
        const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return dateB - dateA;
    });
    const ongoingDownloads = downloadStates.filter(state =>
        ['starting', 'downloading', 'queued'].includes(state.download_status)
    );

    const openFile = async (filePath: string | null, app: string | null) => {
        if (filePath && await fs.exists(filePath)) {
            try {
                await invoke('open_file_with_app', { filePath: filePath, appName: app }).then(() => {
                    toast.info(`${app === 'explorer' ? 'Revealing' : 'Opening'} file`, {
                        description: `${app === 'explorer' ? 'Revealing' : 'Opening'} the file ${app === 'explorer' ? 'in' : 'with'} ${app ? app : 'default app'}.`,
                    })
                });
            } catch (e) {
                console.error(e);
                toast.error(`Failed to ${app === 'explorer' ? 'reveal' : 'open'} file`, {
                    description: `An error occurred while trying to ${app === 'explorer' ? 'reveal' : 'open'} the file.`,
                })
            }
        } else {
            toast.info("File unavailable", {
                description: `The file you are trying to ${app === 'explorer' ? 'reveal' : 'open'} does not exist.`,
            })
        }
    }

    const removeFromDownloads = async (downloadState: DownloadState, delete_file: boolean) => {
        if (delete_file && downloadState.filepath) {
            try {
                if (await fs.exists(downloadState.filepath)) {
                    await fs.remove(downloadState.filepath);
                } else {
                    console.error(`File not found: ${downloadState.filepath}`);
                }
            } catch (e) {
                console.error(e);
            }
        }

        downloadStateDeleter.mutate(downloadState.download_id, {
            onSuccess: (data) => {
                console.log("Download State deleted successfully:", data);
                queryClient.invalidateQueries({ queryKey: ['download-states'] });
                toast.success("Removed from downloads", {
                    description: "The download has been removed successfully.",
                });
            },
            onError: (error) => {
                console.error("Failed to delete download state:", error);
                toast.error("Failed to remove download", {
                    description: "An error occurred while trying to remove the download.",
                });
            }
        })
    }

    const stopOngoingDownloads = async () => {
        if (ongoingDownloads.length > 0) {
            for (const state of ongoingDownloads) {
                setIsPausingDownload(state.download_id, true);
                try {
                    await pauseDownload(state);
                } catch (e) {
                    console.error(e);
                    toast.error("Failed to stop download", {
                        description: `An error occurred while trying to stop the download for ${state.title}.`,
                    });
                } finally {
                    setIsPausingDownload(state.download_id, false);
                }
            }
            if (ongoingDownloads.length === 0) {
                toast.success("Stopped ongoing downloads", {
                    description: "All ongoing downloads have been stopped successfully.",
                });
            }
        } else {
            toast.info("No ongoing downloads", {
                description: "There are no ongoing downloads to stop.",
            });
        }
    }

    const handleSearch = async (url: string, isPlaylist: boolean) => {
        try {
            LOG.info('NEODLP', `Received search request from library for URL: ${url}`);
            navigate('/');
            const { setRequestedUrl, setAutoSubmitSearch } = useCurrentVideoMetadataStore.getState();
            setRequestedUrl(url);
            setAutoSubmitSearch(true);
            toast.info(`Initiating ${isPlaylist ? 'Playlist' : 'Video'} Search`, {
                description: `Initiating search for the selected ${isPlaylist ? 'playlist' : 'video'}.`,
            });
        } catch (e) {
            console.error(e);
            toast.error("Failed to initiate search", {
                description: "An error occurred while trying to initiate the search.",
            });
        }
    }

    return (
        <div className="container mx-auto p-4 space-y-4">
            <Heading title="Library" description="Manage all your downloads in one place" />
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="w-full flex items-center justify-between mb-4">
                    <TabsList>
                        <TabsTrigger value="completed">Completed {completedDownloads.length > 0 && (`(${completedDownloads.length})`)}</TabsTrigger>
                        <TabsTrigger value="incomplete">Incomplete {(incompleteDownloads.length > 0 && ongoingDownloads.length <= 0) && (`(${incompleteDownloads.length})`)} {ongoingDownloads.length > 0 && (<Badge className="h-4 min-w-4 rounded-full px-1 font-mono tabular-nums ml-1">{ongoingDownloads.length}</Badge>)}</TabsTrigger>
                    </TabsList>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button
                            className="w-fit"
                            variant="destructive"
                            size="sm"
                            disabled={ongoingDownloads.length <= 0}
                            >
                                <Square className="h-4 w-4" />
                                Stop
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Stop all ongoing downloads?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Are you sure you want to stop all ongoing downloads? This will pause all downloads including the download queue.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                onClick={() => stopOngoingDownloads()}
                                >Stop</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
                <TabsContent value="completed">
                    <div className="w-full flex flex-col gap-2">
                        {completedDownloads.length > 0 ? (
                            completedDownloads.map((state) => {
                                const itemActionStates = downloadActions[state.download_id] || {
                                    isResuming: false,
                                    isPausing: false,
                                    isCanceling: false,
                                    isDeleteFileChecked: false,
                                };
                                return (
                                    <div className="p-4 border border-border rounded-lg flex gap-4" key={state.download_id}>
                                        <div className="w-[30%] flex flex-col justify-between gap-2">
                                            <AspectRatio ratio={16 / 9} className="w-full rounded-lg overflow-hidden border border-border mb-2">
                                                <ProxyImage src={state.thumbnail || ""} alt="thumbnail" className="" />
                                            </AspectRatio>
                                            <span className="w-full flex items-center justify-center text-xs border border-border py-1 px-2 rounded">
                                                {state.filetype && (state.filetype === 'video' || state.filetype === 'video+audio') && (
                                                    <Video className="w-4 h-4 mr-2" />
                                                )}
                                                {state.filetype && state.filetype === 'audio' && (
                                                    <Music className="w-4 h-4 mr-2" />
                                                )}
                                                {(!state.filetype) || (state.filetype && state.filetype !== 'video' && state.filetype !== 'audio' && state.filetype !== 'video+audio') && (
                                                    <File className="w-4 h-4 mr-2" />
                                                )}
                                                {state.ext?.toUpperCase()} {state.resolution ? `(${state.resolution})` : null}
                                            </span>
                                        </div>
                                        <div className="w-full flex flex-col justify-between gap-2">
                                            <div className="flex flex-col gap-1">
                                                <h4 className="">{state.title}</h4>
                                                <p className="text-xs text-muted-foreground">{state.channel ? state.channel : 'unknown'} {state.host ? `• ${state.host}` : 'unknown'}</p>
                                                <div className="flex items-center mt-1">
                                                    <span className="text-xs text-muted-foreground flex items-center pr-3"><Clock className="w-4 h-4 mr-2"/> {state.duration_string ? formatDurationString(state.duration_string) : 'unknown'}</span>
                                                    <Separator orientation="vertical" />
                                                    <span className="text-xs text-muted-foreground flex items-center px-3">
                                                    {state.filetype && (state.filetype === 'video' || state.filetype === 'video+audio') && (
                                                        <FileVideo2 className="w-4 h-4 mr-2"/>
                                                    )}
                                                    {state.filetype && state.filetype === 'audio' && (
                                                        <FileAudio2 className="w-4 h-4 mr-2" />
                                                    )}
                                                    {(!state.filetype) || (state.filetype && state.filetype !== 'video' && state.filetype !== 'audio' && state.filetype !== 'video+audio') && (
                                                        <FileQuestion className="w-4 h-4 mr-2" />
                                                    )}
                                                    {state.filesize ? formatFileSize(state.filesize) : 'unknown'}
                                                    </span>
                                                    <Separator orientation="vertical" />
                                                    <span className="text-xs text-muted-foreground flex items-center pl-3"><AudioLines className="w-4 h-4 mr-2"/>
                                                    {state.vbr && state.abr ? (
                                                        formatBitrate(state.vbr + state.abr)
                                                    ) : state.vbr ? (
                                                        formatBitrate(state.vbr)
                                                    ) : state.abr ? (
                                                        formatBitrate(state.abr)
                                                    ) : (
                                                        'unknown'
                                                    )}
                                                    </span>
                                                </div>
                                                <div className="hidden xl:flex items-center mt-1 gap-2 flex-wrap text-xs">
                                                    {state.playlist_id && state.playlist_index && (
                                                        <span
                                                        className="border border-border py-1 px-2 rounded flex items-center cursor-pointer"
                                                        title={`${state.playlist_title ?? 'UNKNOWN PLAYLIST'}` + ' by ' + `${state.playlist_channel ?? 'UNKNOWN CHANNEL'}`}
                                                        >
                                                            <ListVideo className="w-4 h-4 mr-2" /> Playlist ({state.playlist_index} of {state.playlist_n_entries})
                                                        </span>
                                                    )}
                                                    {state.vcodec && (
                                                        <span className="border border-border py-1 px-2 rounded">{formatCodec(state.vcodec)}</span>
                                                    )}
                                                    {state.acodec && (
                                                        <span className="border border-border py-1 px-2 rounded">{formatCodec(state.acodec)}</span>
                                                    )}
                                                    {state.dynamic_range && state.dynamic_range !== 'SDR' && (
                                                        <span className="border border-border py-1 px-2 rounded">{state.dynamic_range}</span>
                                                    )}
                                                    {state.subtitle_id && (
                                                        <span
                                                        className="border border-border py-1 px-2 rounded cursor-pointer"
                                                        title={`EMBEDED SUBTITLE (${state.subtitle_id})`}
                                                        >
                                                            ESUB
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="w-full flex items-center gap-2">
                                                <Button size="sm" onClick={() => openFile(state.filepath, null)}>
                                                    <Play className="w-4 h-4" />
                                                    Open
                                                </Button>
                                                <Button size="sm" variant="outline" onClick={() => openFile(state.filepath, 'explorer')}>
                                                    <FolderInput className="w-4 h-4" />
                                                    Reveal
                                                </Button>
                                                <Button size="sm" variant="outline" onClick={() => handleSearch(state.url, state.playlist_id ? true : false)}>
                                                    <Search className="w-4 h-4" />
                                                    Search
                                                </Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button size="sm" variant="destructive">
                                                            <Trash2 className="w-4 h-4" />
                                                            Remove
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Remove from library?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Are you sure you want to remove this download from the library? You can also delete the downloaded file by cheking the box below. This action cannot be undone.
                                                            </AlertDialogDescription>
                                                            <div className="flex items-center space-x-2">
                                                                <Checkbox id="delete-file" checked={itemActionStates.isDeleteFileChecked} onCheckedChange={() => {setIsDeleteFileChecked(state.download_id, !itemActionStates.isDeleteFileChecked)}} />
                                                                <Label htmlFor="delete-file">Delete the downloaded file</Label>
                                                            </div>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={
                                                                () => removeFromDownloads(state, itemActionStates.isDeleteFileChecked).then(() => {
                                                                    setIsDeleteFileChecked(state.download_id, false);
                                                                })
                                                            }>Remove</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        ) : (
                            <div className="w-full flex flex-col items-center gap-2 justify-center mt-27">
                                <h4 className="text-4xl font-bold text-muted-foreground/80 dark:text-muted">Nothing!</h4>
                                <p className="text-lg font-semibold text-muted-foreground/50">No Completed Downloads</p>
                                <p className="max-w-[50%] text-center text-xs text-muted-foreground/70">You have not completed any downloads yet. Complete downloading something to see here :)</p>
                            </div>
                        )}
                    </div>
                </TabsContent>
                <TabsContent value="incomplete">
                    <div className="w-full flex flex-col gap-2">
                        {incompleteDownloads.length > 0 ? (
                            incompleteDownloads.map((state) => {
                                const itemActionStates = downloadActions[state.download_id] || {
                                    isResuming: false,
                                    isPausing: false,
                                    isCanceling: false,
                                    isDeleteFileChecked: false,
                                };
                                return (
                                    <div className="p-4 border border-border rounded-lg flex gap-4" key={state.download_id}>
                                        <div className="w-[30%] flex flex-col justify-between gap-2">
                                            <AspectRatio ratio={16 / 9} className="w-full rounded-lg overflow-hidden border border-border">
                                                <ProxyImage src={state.thumbnail || ""} alt="thumbnail" className="" />
                                            </AspectRatio>
                                            {state.ext && (
                                                <span className="w-full flex items-center justify-center text-xs border border-border py-1 px-2 rounded">
                                                    {state.filetype && (state.filetype === 'video' || state.filetype === 'video+audio') && (
                                                        <Video className="w-4 h-4 mr-2" />
                                                    )}
                                                    {state.filetype && state.filetype === 'audio' && (
                                                        <Music className="w-4 h-4 mr-2" />
                                                    )}
                                                    {(!state.filetype) || (state.filetype && state.filetype !== 'video' && state.filetype !== 'audio' && state.filetype !== 'video+audio') && (
                                                        <File className="w-4 h-4 mr-2" />
                                                    )}
                                                    {state.ext.toUpperCase()} {state.resolution ? `(${state.resolution})` : null}
                                                </span>
                                            )}
                                        </div>
                                        <div className="w-full flex flex-col justify-between">
                                            <div className="flex flex-col gap-1">
                                                <h4>{state.title}</h4>
                                                {((state.download_status === 'starting') || (state.download_status === 'downloading' && state.status === 'finished')) && (
                                                    <IndeterminateProgress indeterminate={true} className="w-full" />
                                                )}
                                                {(state.download_status === 'downloading' || state.download_status === 'paused') && state.progress && state.status !== 'finished' && (
                                                    <div className="w-full flex items-center gap-2">
                                                        <span className="text-sm text-nowrap">{state.progress}%</span>
                                                        <Progress value={state.progress} />
                                                        <span className="text-sm text-nowrap">{
                                                            state.downloaded && state.total
                                                            ? `(${formatFileSize(state.downloaded)} / ${formatFileSize(state.total)})`
                                                            : null
                                                        }</span>
                                                    </div>
                                                )}
                                                <div className="text-xs text-muted-foreground">{ state.download_status && (
                                                    `${state.download_status === 'downloading' && state.status === 'finished' ? 'Processing' : state.download_status.charAt(0).toUpperCase() + state.download_status.slice(1)} ${state.download_id ? `• ID: ${state.download_id.toUpperCase()}` : ""} ${state.download_status === 'downloading' && state.status !== 'finished' && state.speed ? `• Speed: ${formatSpeed(state.speed)}` : ""} ${state.download_status === 'downloading' && state.eta ? `• ETA: ${formatSecToTimeString(state.eta)}` : ""}`
                                                )}</div>
                                            </div>
                                            <div className="w-full flex items-center gap-2 mt-2">
                                                {state.download_status === 'paused' ? (
                                                    <Button
                                                    size="sm"
                                                    className="w-fill"
                                                    onClick={async () => {
                                                        setIsResumingDownload(state.download_id, true);
                                                        try {
                                                            await resumeDownload(state)
                                                            // toast.success("Resumed Download", {
                                                            //     description: "Download resumed, it will re-start shortly.",
                                                            // })
                                                        } catch (e) {
                                                            console.error(e);
                                                            toast.error("Failed to Resume Download", {
                                                                description: "An error occurred while trying to resume the download.",
                                                            })
                                                        } finally {
                                                            setIsResumingDownload(state.download_id, false);
                                                        }
                                                    }}
                                                    disabled={itemActionStates.isResuming || itemActionStates.isCanceling}
                                                    >
                                                        {itemActionStates.isResuming ? (
                                                            <>
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                                Resuming
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Play className="w-4 h-4" />
                                                                Resume
                                                            </>
                                                        )}
                                                    </Button>
                                                ) : (
                                                    <Button
                                                    size="sm"
                                                    className="w-fill"
                                                    onClick={async () => {
                                                        setIsPausingDownload(state.download_id, true);
                                                        try {
                                                            await pauseDownload(state)
                                                            // toast.success("Paused Download", {
                                                            //     description: "Download paused successfully.",
                                                            // })
                                                        } catch (e) {
                                                            console.error(e);
                                                            toast.error("Failed to Pause Download", {
                                                                description: "An error occurred while trying to pause the download."
                                                            })
                                                        } finally {
                                                            setIsPausingDownload(state.download_id, false);
                                                        }
                                                    }}
                                                    disabled={itemActionStates.isPausing || itemActionStates.isCanceling || state.download_status !== 'downloading' || (state.download_status === 'downloading' && state.status === 'finished')}
                                                    >
                                                        {itemActionStates.isPausing ? (
                                                            <>
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                                Pausing
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Pause className="w-4 h-4" />
                                                                Pause
                                                            </>
                                                        )}
                                                    </Button>
                                                )}
                                                <Button
                                                size="sm"
                                                variant="destructive"
                                                onClick={async () => {
                                                    setIsCancelingDownload(state.download_id, true);
                                                    try {
                                                        await cancelDownload(state)
                                                        toast.success("Canceled Download", {
                                                            description: "Download canceled successfully.",
                                                        })
                                                    } catch (e) {
                                                        console.error(e);
                                                        toast.error("Failed to Cancel Download", {
                                                            description: "An error occurred while trying to cancel the download.",
                                                        })
                                                    } finally {
                                                        setIsCancelingDownload(state.download_id, false);
                                                    }
                                                }}
                                                disabled={itemActionStates.isCanceling || itemActionStates.isResuming || itemActionStates.isPausing || state.download_status === 'starting' || (state.download_status === 'downloading' && state.status === 'finished')}
                                                >
                                                    {itemActionStates.isCanceling ? (
                                                        <>
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                            Canceling
                                                        </>
                                                    ) : (
                                                        <>
                                                            <X className="w-4 h-4" />
                                                            Cancel
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        ) : (
                            <div className="w-full flex flex-col items-center gap-2 justify-center mt-27">
                                <h4 className="text-4xl font-bold text-muted-foreground/80 dark:text-muted">Nothing!</h4>
                                <p className="text-lg font-semibold text-muted-foreground/50">No Incomplete Downloads</p>
                                <p className="max-w-[50%] text-center text-xs text-muted-foreground/70">You have all caught up! Sit back and relax or just spin up a new download to see here :)</p>
                            </div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
