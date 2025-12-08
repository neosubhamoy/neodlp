import { ProxyImage } from "@/components/custom/proxyImage";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useCurrentVideoMetadataStore, useDownloadActionStatesStore } from "@/services/store";
import { formatBitrate, formatCodec, formatDurationString, formatFileSize } from "@/utils";
import { ArrowUpRightIcon, AudioLines, CircleArrowDown, Clock, File, FileAudio2, FileQuestion, FileVideo2, FolderInput, ListVideo, Music, Play, Search, Trash2, Video } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import * as fs from "@tauri-apps/plugin-fs";
import { DownloadState } from "@/types/download";
import { useQueryClient } from "@tanstack/react-query";
import { useDeleteDownloadState } from "@/services/mutations";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { useLogger } from "@/helpers/use-logger";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

interface CompletedDownloadProps {
    state: DownloadState;
}

interface CompletedDownloadsProps {
    downloads: DownloadState[];
}

export function CompletedDownload({ state }: CompletedDownloadProps) {
    const downloadActions = useDownloadActionStatesStore(state => state.downloadActions);
    const setIsDeleteFileChecked = useDownloadActionStatesStore(state => state.setIsDeleteFileChecked);

    const queryClient = useQueryClient();
    const downloadStateDeleter = useDeleteDownloadState();
    const navigate = useNavigate();
    const LOG = useLogger();

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
                    console.error(`File not found: "${downloadState.filepath}"`);
                }
            } catch (e) {
                console.error(e);
            }
        }

        downloadStateDeleter.mutate(downloadState.download_id, {
            onSuccess: (data) => {
                console.log("Download State deleted successfully:", data);
                queryClient.invalidateQueries({ queryKey: ['download-states'] });
                if (delete_file  && downloadState.filepath) {
                    toast.success("Deleted from downloads", {
                        description: `The download for "${downloadState.title}" has been deleted successfully.`,
                    });
                } else {
                    toast.success("Removed from downloads", {
                        description: `The download for "${downloadState.title}" has been removed successfully.`,
                    });
                }
            },
            onError: (error) => {
                console.error("Failed to delete download state:", error);
                if (delete_file  && downloadState.filepath) {
                    toast.error("Failed to delete download", {
                        description: `An error occurred while trying to delete the download for "${downloadState.title}".`,
                    });
                } else {
                    toast.error("Failed to remove download", {
                        description: `An error occurred while trying to remove the download for "${downloadState.title}".`,
                    });
                }
            }
        })
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
            </div>
            <div className="w-full flex flex-col justify-between gap-2">
                <div className="flex flex-col gap-1">
                    <h4 className="">{state.title}</h4>
                    <p className="text-xs text-muted-foreground">{state.channel ? state.channel : 'unknown'} {state.host ? <><span className="text-primary">•</span> {state.host}</> : 'unknown'}</p>
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
    );
}

export function CompletedDownloads({ downloads }: CompletedDownloadsProps) {
    const navigate = useNavigate();

    return (
        <div className="w-full flex flex-col gap-2">
            {downloads.length > 0 ? (
                downloads.map((state) => {
                    return (
                        <CompletedDownload key={state.download_id} state={state} />
                    );
                })
            ) : (
                <Empty className="mt-10">
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <CircleArrowDown />
                        </EmptyMedia>
                        <EmptyTitle>No Completed Downloads</EmptyTitle>
                        <EmptyDescription>
                        You have not completed any downloads yet! Complete downloading something to see here :)
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
