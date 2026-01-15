import { IndeterminateProgress } from "@/components/custom/indeterminateProgress";
import { ProxyImage } from "@/components/custom/proxyImage";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useAppContext } from "@/providers/appContextProvider";
import { useDownloadActionStatesStore, useSettingsPageStatesStore } from "@/services/store";
import { formatFileSize, formatSecToTimeString, formatSpeed } from "@/utils";
import { ArrowUpRightIcon, CircleCheck, File, Info, ListVideo, Loader2, Music, Pause, Play, RotateCw, Video, X } from "lucide-react";
import { DownloadState } from "@/types/download";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { useNavigate } from "react-router-dom";

interface IncompleteDownloadProps {
    state: DownloadState;
}

interface IncompleteDownloadsProps {
    downloads: DownloadState[];
}

export function IncompleteDownload({ state }: IncompleteDownloadProps) {
    const downloadActions = useDownloadActionStatesStore(state => state.downloadActions);
    const setIsResumingDownload = useDownloadActionStatesStore(state => state.setIsResumingDownload);
    const setIsPausingDownload = useDownloadActionStatesStore(state => state.setIsPausingDownload);
    const setIsCancelingDownload = useDownloadActionStatesStore(state => state.setIsCancelingDownload);

    const debugMode = useSettingsPageStatesStore(state => state.settings.debug_mode);

    const { pauseDownload, resumeDownload, cancelDownload } = useAppContext()

    const itemActionStates = downloadActions[state.download_id] || {
        isResuming: false,
        isPausing: false,
        isCanceling: false,
        isDeleteFileChecked: false,
    };

    const isPlaylist = state.playlist_id !== null && state.playlist_indices !== null;
    const isMutilplePlaylistItems = isPlaylist && state.playlist_indices && state.playlist_indices.includes(',');

    return (
        <div className="p-4 border border-border rounded-lg flex gap-4" key={state.download_id}>
            <div className="w-[30%] flex flex-col justify-between gap-2">
                {isMutilplePlaylistItems ? (
                    <div className="w-full relative flex items-center justify-center mt-2">
                        <AspectRatio ratio={16 / 9} className="w-full rounded-lg overflow-hidden border border-border mb-2 z-20">
                            <ProxyImage src={state.thumbnail || ""} alt="thumbnail" className="" />
                        </AspectRatio>
                        <div className="w-[95%] aspect-video absolute -top-1 rounded-lg overflow-hidden border border-border mb-2 z-10">
                            <ProxyImage src={state.thumbnail || ""} alt="thumbnail" className="blur-xs brightness-75" />
                        </div>
                        <div className="w-[87%] aspect-video absolute -top-2 rounded-lg overflow-hidden border border-border mb-2 z-0">
                            <ProxyImage src={state.thumbnail || ""} alt="thumbnail" className="blur-sm brightness-50" />
                        </div>
                    </div>
                ) : (
                    <AspectRatio ratio={16 / 9} className="w-full rounded-lg overflow-hidden border border-border mb-2">
                        <ProxyImage src={state.thumbnail || ""} alt="thumbnail" className="" />
                    </AspectRatio>
                )}
                {isMutilplePlaylistItems ? (
                    <span className="w-full flex items-center justify-center text-xs border border-border py-1 px-2 rounded">
                        <ListVideo className="w-4 h-4 mr-2 stroke-primary" /> Playlist ({state.playlist_indices?.split(',').length})
                    </span>
                ) : state.ext ? (
                    <span className="w-full flex items-center justify-center text-xs border border-border py-1 px-2 rounded">
                        {state.filetype && (state.filetype === 'video' || state.filetype === 'video+audio') && (
                            <Video className="w-4 h-4 mr-2 stroke-primary" />
                        )}
                        {state.filetype && state.filetype === 'audio' && (
                            <Music className="w-4 h-4 mr-2 stroke-primary" />
                        )}
                        {(!state.filetype) || (state.filetype && state.filetype !== 'video' && state.filetype !== 'audio' && state.filetype !== 'video+audio') && (
                            <File className="w-4 h-4 mr-2 stroke-primary" />
                        )}
                        {state.ext ? state.ext.toUpperCase() : 'Unknown'} {state.resolution ? `(${state.resolution})` : null}
                    </span>
                ) : (
                    <span className="w-full flex items-center justify-center text-xs border border-border py-1 px-2 rounded">
                        {state.download_status === 'starting' ? (
                            <><Loader2 className="h-4 w-4 mr-2 stroke-primary animate-spin" /> Processing...</>
                        ) : (
                            <><File className="w-4 h-4 mr-2 stroke-primary" /> Unknown</>
                        )}
                    </span>
                )}
            </div>
            <div className="w-full flex flex-col justify-between">
                <div className="flex flex-col gap-1">
                    <h4>{isMutilplePlaylistItems ? state.playlist_title : state.title}</h4>
                    {((state.download_status === 'starting') || (state.download_status === 'downloading' && state.status === 'finished')) && (
                        <IndeterminateProgress indeterminate={true} className="w-full" />
                    )}
                    {(state.download_status === 'downloading' || state.download_status === 'paused' || state.download_status === 'errored') && state.progress && state.status !== 'finished' && (
                        <div className="w-full flex items-center gap-2">
                            {isMutilplePlaylistItems && state.item ? (
                                <span className="text-sm text-nowrap">({state.item})</span>
                            ) : null}
                            <span className="text-sm text-nowrap">{state.progress}%</span>
                            <Progress value={state.progress} />
                            <span className="text-sm text-nowrap">{
                                state.downloaded && state.total
                                ? `(${formatFileSize(state.downloaded)} / ${formatFileSize(state.total)})`
                                : null
                            }</span>
                        </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                        {state.download_status && state.download_status === 'downloading' && state.status === 'finished' ? (
                            <span>Processing</span>
                        ) : state.download_status && state.download_status === 'errored' ? (
                            <span className="text-destructive"><Info className="inline size-3 mb-1 mr-0.5" /> Errored</span>
                        ) : (
                            <span>{state.download_status.charAt(0).toUpperCase() + state.download_status.slice(1)}</span>
                        )} {
                        (debugMode && state.download_id) || (state.download_status === 'errored' && state.download_id) && (
                            <><span className="text-primary">•</span> ID: {state.download_id.toUpperCase()}</>
                        )} {
                        state.download_status === 'downloading' && state.status !== 'finished' && state.speed && (
                            <><span className="text-primary">•</span> Speed: {formatSpeed(state.speed)}</>
                        )} {state.download_status === 'downloading' && state.eta && (
                            <><span className="text-primary">•</span> ETA: {formatSecToTimeString(state.eta)}</>
                        )}
                    </div>
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
                                    description: `An error occurred while trying to resume the download for "${state.title}".`,
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
                    ) : state.download_status === 'errored' ? (
                        <Button
                        size="sm"
                        className="w-fill"
                        onClick={async () => {
                            setIsResumingDownload(state.download_id, true);
                            try {
                                await resumeDownload(state);
                            } catch (e) {
                                console.error(e);
                                toast.error("Failed to Restart Download", {
                                    description: `An error occurred while trying to restart the download for "${state.title}".`,
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
                                    Retrying
                                </>
                            ) : (
                                <>
                                    <RotateCw className="w-4 h-4" />
                                    Retry
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
                                    description: `An error occurred while trying to pause the download for "${state.title}".`,
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
                                description: `The download for "${state.title}" has been canceled.`,
                            })
                        } catch (e) {
                            console.error(e);
                            toast.error("Failed to Cancel Download", {
                                description: `An error occurred while trying to cancel the download for "${state.title}".`,
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
    );
}

export function IncompleteDownloads({ downloads }: IncompleteDownloadsProps) {
    const navigate = useNavigate();

    return (
        <div className="w-full flex flex-col gap-2">
            {downloads.length > 0 ? (
                downloads.map((state) => {
                    return (
                        <IncompleteDownload key={state.download_id} state={state} />
                    );
                })
            ) : (
                <Empty className="mt-10">
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <CircleCheck />
                        </EmptyMedia>
                        <EmptyTitle>No Incomplete Downloads</EmptyTitle>
                        <EmptyDescription>
                        You have all caught up! Sit back and relax or just spin up a new download to see here :)
                        </EmptyDescription>
                    </EmptyHeader>
                    <Button
                        variant="link"
                        className="text-muted-foreground"
                        size="sm"
                        onClick={() => navigate("/")}
                    >
                        Spin Up a New Download  <ArrowUpRightIcon />
                    </Button>
                </Empty>
            )}
        </div>
    );
}
