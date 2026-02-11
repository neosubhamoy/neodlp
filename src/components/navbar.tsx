import { useState } from "react";
import { useLocation } from "react-router-dom";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { getRouteName } from "@/utils";
import { Button } from "@/components/ui/button";
import { BrushCleaning, Check, Copy, Terminal } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useLogger } from "@/helpers/use-logger";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import TitleBar from "@/components/titlebar";
import { platform } from "@tauri-apps/plugin-os";

export default function Navbar() {
    const [copied, setCopied] = useState(false);
    const location = useLocation();
    const currentPlatform = platform();
    const logger = useLogger();
    const logs = logger.getLogs();
    const logText = logs.map(log => `${new Date(log.timestamp).toLocaleTimeString()} [${log.level.toUpperCase()}] ${log.context}: ${log.message}`).join('\n');

    const handleCopyLogs = async () => {
        await writeText(logText);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    }

    return (
        <div className="sticky top-0 z-50">
            {currentPlatform === "windows" || currentPlatform === "linux" ? (
                <TitleBar />
            ) : (
                null
            )}
            <nav className="flex justify-between items-center py-3 px-4 backdrop-blur supports-backdrop-filter:bg-background/60 border-b">
                <div className="flex justify-center">
                    <SidebarTrigger />
                    <h1 className="text-lg font-semibold ml-4">{getRouteName(location.pathname)}</h1>
                </div>
                <div className="flex justify-center items-center">
                    <Dialog>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="icon">
                                        <Terminal />
                                    </Button>
                                </DialogTrigger>
                            </TooltipTrigger>
                            <TooltipContent>
                            <p>Logs</p>
                            </TooltipContent>
                        </Tooltip>
                        <DialogContent className="sm:max-w-150">
                            <DialogHeader>
                                <DialogTitle>Log Viewer</DialogTitle>
                                <DialogDescription>Monitor real-time app session logs (latest on top)</DialogDescription>
                            </DialogHeader>
                            <div className="flex flex-col gap-2 p-2 max-h-75 overflow-y-scroll overflow-x-hidden bg-muted">
                                {logs.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">NO LOGS TO SHOW!</p>
                                ) : (
                                    logs.slice().reverse().map((log, index) => (
                                        <div key={index} className={`flex flex-col ${log.level === 'error' ? 'text-red-500' : log.level === 'warning' ? 'text-amber-500' : log.level === 'debug' ? 'text-sky-500' : log.level === 'progress' ? 'text-emerald-500' : 'text-foreground'}`}>
                                            <p className="text-xs"><strong>{new Date(log.timestamp).toLocaleTimeString()}</strong> [{log.level.toUpperCase()}] <em>{log.context}</em> :</p>
                                            <p className="text-xs font-mono break-all">{log.message}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                            <DialogFooter>
                                <Button
                                variant="destructive"
                                disabled={logs.length === 0}
                                onClick={() => logger.clearLogs()}
                                >
                                    <BrushCleaning className="size-4" />
                                    Clear Logs
                                </Button>
                                <Button
                                className="transition-all duration-300"
                                disabled={logs.length === 0}
                                onClick={() => handleCopyLogs()}
                                >
                                    {copied ? (
                                        <Check className="size-4" />
                                    ) : (
                                        <Copy className="size-4" />
                                    )}
                                    Copy Logs
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </nav>
        </div>
    )
}
