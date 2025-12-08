import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAppContext } from "@/providers/appContextProvider";
import { useDownloadActionStatesStore, useDownloadStatesStore, useLibraryPageStatesStore } from "@/services/store";
import { Square } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import Heading from "@/components/heading";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CompletedDownloads } from "@/components/pages/library/completedDownloads";
import { IncompleteDownloads } from "@/components/pages/library/incompleteDownloads";

export default function LibraryPage() {
    const activeTab = useLibraryPageStatesStore(state => state.activeTab);
    const setActiveTab = useLibraryPageStatesStore(state => state.setActiveTab);

    const downloadStates = useDownloadStatesStore(state => state.downloadStates);
    const setIsPausingDownload = useDownloadActionStatesStore(state => state.setIsPausingDownload);

    const { pauseDownload } = useAppContext();

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

    return (
        <div className="container mx-auto p-4 space-y-4">
            <Heading title="Library" description="Manage all your downloads in one place" />
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="w-full flex items-center justify-between mb-4">
                    <TabsList>
                        <TabsTrigger value="completed">Completed {completedDownloads.length > 0 && (`(${completedDownloads.length})`)}</TabsTrigger>
                        <TabsTrigger value="incomplete">Incomplete {(incompleteDownloads.length > 0 && ongoingDownloads.length <= 0) && (`(${incompleteDownloads.length})`)} {ongoingDownloads.length > 0 && (<Badge className="h-4 min-w-4 rounded-full px-1 font-mono tabular-nums ml-1.5 mt-0.5">{ongoingDownloads.length}</Badge>)}</TabsTrigger>
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
                    <CompletedDownloads downloads={completedDownloads} />
                </TabsContent>
                <TabsContent value="incomplete">
                    <IncompleteDownloads downloads={incompleteDownloads} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
