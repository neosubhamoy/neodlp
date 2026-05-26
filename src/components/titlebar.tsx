import { useState } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { MaximizeIcon } from "@/components/icons/maximize";
import { MinimizeIcon } from "@/components/icons/minimize";
import { CloseIcon } from "@/components/icons/close";
import { UnmaximizeIcon } from "@/components/icons/unmaximize";
import { useDownloadActionStatesStore, useDownloadStatesStore, useSettingsPageStatesStore } from "@/services/store";
import { useAppContext } from "@/providers/appContextProvider";

export default function TitleBar() {
    const [maximized, setMaximized] = useState<boolean>(false);
    const appWindow = getCurrentWebviewWindow();
    const quitOnClose = useSettingsPageStatesStore(state => state.settings.quit_on_close);

    const downloadStates = useDownloadStatesStore(state => state.downloadStates);
    const ongoingDownloads = downloadStates.filter(state =>
        ['starting', 'downloading', 'queued'].includes(state.download_status)
    );
    const setIsPausingDownload = useDownloadActionStatesStore(state => state.setIsPausingDownload);
    const { pauseDownload } = useAppContext();

    const stopOngoingDownloads = async () => {
        if (ongoingDownloads.length > 0) {
            for (const state of ongoingDownloads) {
                setIsPausingDownload(state.download_id, true);
                try {
                    await pauseDownload(state);
                } catch (e) {
                    console.error(e);
                } finally {
                    setIsPausingDownload(state.download_id, false);
                }
            }
        }
    }

    return (
        <div className="titlebar flex items-center justify-between border-b bg-background">
            <div className="flex items-center justify-center grow px-4 py-2.5" data-tauri-drag-region>
                <h1 className="text-sm text-primary font-semibold">NeoDLP</h1>
            </div>
            <div className="controls flex items-center justify-center">
                <button
                className="px-4 py-3 hover:bg-muted"
                id="titlebar-minimize"
                title="Minimize"
                onClick={() => appWindow.minimize()}
                >
                    <MinimizeIcon />
                </button>
                <button
                className="px-4 py-3 hover:bg-muted"
                id="titlebar-maximize"
                title={maximized ? "Unmaximize" : "Maximize"}
                onClick={async () => {
                    const isMaximized = await appWindow.isMaximized();
                    if (isMaximized) {
                        await appWindow.unmaximize();
                        setMaximized(false);
                    } else {
                        await appWindow.maximize();
                        setMaximized(true);
                    }
                }}
                >
                    {maximized ? (
                        <UnmaximizeIcon />
                    ) : (
                        <MaximizeIcon />
                    )}
                </button>
                <button
                className="px-4 py-3 hover:bg-destructive"
                id="titlebar-close"
                title="Close"
                onClick={async () => {
                    if (quitOnClose) {
                        if (ongoingDownloads.length > 0) {
                            await stopOngoingDownloads();
                        }
                        await appWindow.destroy();
                    } else {
                        await appWindow.hide()
                    }
                }}
                >
                    <CloseIcon />
                </button>
            </div>
        </div>
    );
}
