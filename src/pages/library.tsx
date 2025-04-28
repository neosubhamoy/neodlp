import { IndeterminateProgress } from "@/components/custom/indeterminateProgress";
import { ProxyImage } from "@/components/custom/proxyImage";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAppContext } from "@/providers/appContextProvider";
import { useDownloadActionStatesStore, useDownloadStatesStore } from "@/services/store";
import { formatBitrate, formatCodec, formatDurationString, formatFileSize, formatSecToTimeString, formatSpeed } from "@/utils";
import { AudioLines, CircleArrowDown, CircleCheck, Clock, File, FileAudio2, FileQuestion, FileVideo2, FolderInput, ListVideo, Loader2, Music, Pause, Play, Trash2, Video, X } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import * as fs from "@tauri-apps/plugin-fs";
import { DownloadState } from "@/types/download";
import { useQueryClient } from "@tanstack/react-query";
import { useDeleteDownloadState } from "@/services/mutations";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import Heading from "@/components/heading";


export default function LibraryPage() {
    const downloadStates = useDownloadStatesStore(state => state.downloadStates);
    const downloadActions = useDownloadActionStatesStore(state => state.downloadActions);
    const setIsResumingDownload = useDownloadActionStatesStore(state => state.setIsResumingDownload);
    const setIsPausingDownload = useDownloadActionStatesStore(state => state.setIsPausingDownload);
    const setIsCancelingDownload = useDownloadActionStatesStore(state => state.setIsCancelingDownload);
    const setIsDeleteFileChecked = useDownloadActionStatesStore(state => state.setIsDeleteFileChecked);

    const { pauseDownload, resumeDownload, cancelDownload } = useAppContext()
    const { toast } = useToast();

    const queryClient = useQueryClient();
    const downloadStateDeleter = useDeleteDownloadState();

    const incompleteDownloads = downloadStates.filter(state => state.download_status !== 'completed');
    const completedDownloads = downloadStates.filter(state => state.download_status === 'completed');

    const openFile = async (filePath: string | null, app: string | null) => {
        if (filePath && await fs.exists(filePath)) {
            try {
                await invoke('open_file_with_app', { filePath: filePath, appName: app }).then(() => {
                    toast({
                        title: 'Opening file',
                        description: `Opening the file with ${app ? app : 'default app'}.`,
                    })
                });
            } catch (e) {
                console.error(e);
                toast({
                    title: 'Failed to open file',
                    description: 'An error occurred while trying to open the file.',
                    variant: "destructive"
                })
            }
        } else {
            toast({
                title: 'File unavailable',
                description: 'The file you are trying to open does not exist.',
                variant: "destructive"
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
                toast({
                    title: 'Removed from downloads',
                    description: 'The download has been removed successfully.',
                })
            },
            onError: (error) => {
                console.error("Failed to delete download state:", error);
                toast({
                    title: 'Failed to remove download',
                    description: 'An error occurred while trying to remove the download.',
                    variant: "destructive"
                })
            }
        })
    }

    return (
        <div className="container mx-auto p-4 space-y-4">
            <Heading title="Library" description="Manage all your downloads in one place" />
            <div className="w-full fle flex-col">
                <div className="flex w-full items-center gap-2 mb-2">
                    <CircleArrowDown className="size-4" />
                    <h3 className="text-nowrap font-semibold">Incomplete Downloads</h3>
                </div>
                <Separator orientation="horizontal" className="" />
            </div>
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
                                            `${state.download_status === 'downloading' && state.status === 'finished' ? 'Processing' : state.download_status.charAt(0).toUpperCase() + state.download_status.slice(1)} ${state.download_status === 'downloading' && state.status !== 'finished' && state.speed ? `• Speed: ${formatSpeed(state.speed)}` : ""} ${state.download_status === 'downloading' && state.eta ? `• ETA: ${formatSecToTimeString(state.eta)}` : ""}`
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
                                                    // toast({
                                                    //     title: 'Resumed Download',
                                                    //     description: 'Download resumed, it will re-start shortly.',
                                                    // })
                                                } catch (e) {
                                                    console.error(e);
                                                    toast({
                                                        title: 'Failed to Resume Download',
                                                        description: 'An error occurred while trying to resume the download.',
                                                        variant: "destructive"
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
                                                    // toast({
                                                    //     title: 'Paused Download',
                                                    //     description: 'Download paused successfully.',
                                                    // })
                                                } catch (e) {
                                                    console.error(e);
                                                    toast({
                                                        title: 'Failed to Pause Download',
                                                        description: 'An error occurred while trying to pause the download.',
                                                        variant: "destructive"
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
                                                toast({
                                                    title: 'Canceled Download',
                                                    description: 'Download canceled successfully.',
                                                })
                                            } catch (e) {
                                                console.error(e);
                                                toast({
                                                    title: 'Failed to Cancel Download',
                                                    description: 'An error occurred while trying to cancel the download.',
                                                    variant: "destructive"
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
                    <div className="w-full flex items-center justify-center text-muted-foreground text-sm">No Incomplete downloads!</div>
                )}
            </div>
            <div className="w-full fle flex-col">
                <div className="flex w-full items-center gap-2 mb-2">
                    <CircleCheck className="size-4" />
                    <h3 className="text-nowrap font-semibold">Completed Downloads</h3>
                </div>
                <Separator orientation="horizontal" className="" />
            </div>
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
                                            Open in Explorer
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
                                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This action cannot be undone! it will permanently remove this from downloads.
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
                    <div className="w-full flex items-center justify-center text-muted-foreground text-sm">No Completed downloads!</div>
                )}
            </div>
        </div>
    );
}