import { useLocation } from "react-router-dom";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { getRouteName } from "@/utils";
import { Button } from "@/components/ui/button";
import { Terminal } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useLogger } from "@/helpers/use-logger";

export default function Navbar() {
    const location = useLocation();
    const logs = useLogger().getLogs();

    return (
        <nav className="flex justify-between items-center py-3 px-4 sticky top-0 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b z-50">
            <div className="flex justify-center">
                <SidebarTrigger />
                <h1 className="text-lg text-primary font-semibold ml-4">{getRouteName(location.pathname)}</h1>
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
                    <DialogContent className="sm:max-w-[600px]">
                        <DialogHeader>
                            <DialogTitle>Log Viewer</DialogTitle>
                            <DialogDescription>Monitor real-time app session logs (latest on top)</DialogDescription>
                        </DialogHeader>
                        <div className="flex flex-col gap-2 p-2 max-h-[300px] overflow-y-scroll overflow-x-hidden bg-muted">
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
                    </DialogContent>
                </Dialog>
            </div>
        </nav>
    )
}
