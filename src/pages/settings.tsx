import Heading from "@/components/heading";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBasePathsStore, useDownloadStatesStore, useSettingsPageStatesStore } from "@/services/store";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, FolderOpen, Loader2, LucideIcon, Monitor, Moon, Radio, RotateCcw, RotateCw, Sun, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect } from "react";
import { useTheme } from "@/providers/themeProvider";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { open } from '@tauri-apps/plugin-dialog';
import { useSettings } from "@/helpers/use-settings";
import { useYtDlpUpdater } from "@/helpers/use-ytdlp-updater";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod"
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { invoke } from "@tauri-apps/api/core";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const websocketPortSchema = z.object({
    port: z.coerce.number({
        required_error: "Websocket Port is required",
        invalid_type_error: "Websocket Port must be a valid number",
    }).min(50000, {
        message: "Websocket Port must be at least 50000"
    }).max(60000, {
        message: "Websocket Port must be at most 60000"
    }),
})

const proxyUrlSchema = z.object({
    url: z.string().min(1, { message: "Proxy URL is required" }).url({ message: "Invalid URL format" })
});

export default function SettingsPage() {
    const { toast } = useToast();
    const { setTheme } = useTheme();

    const activeTab = useSettingsPageStatesStore(state => state.activeTab);
    const setActiveTab = useSettingsPageStatesStore(state => state.setActiveTab);

    const isUsingDefaultSettings = useSettingsPageStatesStore(state => state.isUsingDefaultSettings);
    const ytDlpVersion = useSettingsPageStatesStore(state => state.ytDlpVersion);
    const isFetchingYtDlpVersion = useSettingsPageStatesStore(state => state.isFetchingYtDlpVersion);
    const isUpdatingYtDlp = useSettingsPageStatesStore(state => state.isUpdatingYtDlp);
    const ytDlpUpdateChannel = useSettingsPageStatesStore(state => state.settings.ytdlp_update_channel);
    const ytDlpAutoUpdate = useSettingsPageStatesStore(state => state.settings.ytdlp_auto_update);
    const appTheme = useSettingsPageStatesStore(state => state.settings.theme);
    const maxParallelDownloads = useSettingsPageStatesStore(state => state.settings.max_parallel_downloads);
    const preferVideoOverPlaylist = useSettingsPageStatesStore(state => state.settings.prefer_video_over_playlist);
    const useProxy = useSettingsPageStatesStore(state => state.settings.use_proxy);
    const proxyUrl = useSettingsPageStatesStore(state => state.settings.proxy_url);
    const websocketPort = useSettingsPageStatesStore(state => state.settings.websocket_port);
    const isChangingWebSocketPort = useSettingsPageStatesStore(state => state.isChangingWebSocketPort);
    const setIsChangingWebSocketPort = useSettingsPageStatesStore(state => state.setIsChangingWebSocketPort);
    const isRestartingWebSocketServer = useSettingsPageStatesStore(state => state.isRestartingWebSocketServer);
    const setIsRestartingWebSocketServer = useSettingsPageStatesStore(state => state.setIsRestartingWebSocketServer);
    
    const downloadStates = useDownloadStatesStore(state => state.downloadStates);
    const ongoingDownloads = downloadStates.filter(state => 
        ['starting', 'downloading', 'queued'].includes(state.download_status)
    );

    const downloadDirPath = useBasePathsStore((state) => state.downloadDirPath);
    const setPath = useBasePathsStore((state) => state.setPath);
    const { saveSettingsKey, resetSettings } = useSettings();
    const { updateYtDlp } = useYtDlpUpdater();


    const themeOptions: { value: string; icon: LucideIcon; label: string }[] = [
        { value: 'light', icon: Sun, label: 'Light' },
        { value: 'dark', icon: Moon, label: 'Dark' },
        { value: 'system', icon: Monitor, label: 'System' },
    ];

    const proxyUrlForm = useForm<z.infer<typeof proxyUrlSchema>>({
        resolver: zodResolver(proxyUrlSchema),
        defaultValues: {
            url: proxyUrl,
        },
        mode: "onChange",
    });
    const watchedProxyUrl = proxyUrlForm.watch("url");
    const { errors: proxyUrlFormErrors } = proxyUrlForm.formState;

    function handleProxyUrlSubmit(values: z.infer<typeof proxyUrlSchema>) {
        try {
            saveSettingsKey('proxy_url', values.url);
            toast({
                title: "Proxy URL updated",
                description: `Proxy URL changed to ${values.url}`,
            });
        } catch (error) {
            console.error("Error changing proxy URL:", error);
            toast({
                title: "Failed to change proxy URL",
                description: "Please try again.",
                variant: "destructive",
            });
        }
    }

    interface Config {
        port: number;
    }

    const websocketPortForm = useForm<z.infer<typeof websocketPortSchema>>({
        resolver: zodResolver(websocketPortSchema),
        defaultValues: {
            port: websocketPort,
        },
        mode: "onChange",
    });
    const watchedPort = websocketPortForm.watch("port");
    const { errors: websocketPortFormErrors } = websocketPortForm.formState;

    async function handleWebsocketPortSubmit(values: z.infer<typeof websocketPortSchema>) {
        setIsChangingWebSocketPort(true);
        try {
            // const port = parseInt(values.port, 10);
            const updatedConfig: Config = await invoke("update_config", {
                newConfig: {
                    port: values.port,
                }
            });
            saveSettingsKey('websocket_port', updatedConfig.port);
            toast({
                title: "Websocket port updated",
                description: `Websocket port changed to ${values.port}`,
            });
        } catch (error) {
            console.error("Error changing websocket port:", error);
            toast({
                title: "Failed to change websocket port",
                description: "Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsChangingWebSocketPort(false);
        }
    }

    useEffect(() => {
        const updateTheme = async () => {
            setTheme(appTheme);
        }
        updateTheme().catch(console.error);
    }, [appTheme]);

    return (
        <div className="container mx-auto p-4 space-y-4 min-h-screen">
            <Heading title="Settings" description="Manage your preferences and app settings" />
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="general">General</TabsTrigger>
                    <TabsTrigger value="extension">Extension</TabsTrigger>
                </TabsList>
                <TabsContent value="general">
                    <Card className="p-4 space-y-4 my-4">
                        <div className="w-full flex gap-4 items-center justify-between">
                            <div className="flex gap-4 items-center">
                                <div className="imgwrapper w-10 h-10 flex items-center justify-center bg-linear-65 from-[#FF43D0] to-[#4444FF] rounded-md overflow-hidden border border-border">
                                    <Terminal className="size-5 text-white" />
                                </div>
                                <div className="flex flex-col">
                                    <h3 className="flex items-center gap-2">
                                        <span>YT-DLP</span>
                                        <a href="https://github.com/yt-dlp/yt-dlp" className="" title="yt-dlp homepage" target="_blank">
                                            <ExternalLink className="size-3 text-muted-foreground hover:text-foreground" />
                                        </a>
                                    </h3>
                                    <p className="text-xs text-muted-foreground">Version: {isFetchingYtDlpVersion ? 'Loading...' : ytDlpVersion ?? 'unknown'}</p>
                                </div>
                            </div>
                            <div className="flex gap-4 items-center">
                                <div className="flex items-center space-x-2">
                                    <Switch
                                    id="ytdlp-auto-update"
                                    checked={ytDlpAutoUpdate}
                                    onCheckedChange={(checked) => saveSettingsKey('ytdlp_auto_update', checked)}
                                    />
                                    <Label htmlFor="ytdlp-auto-update">Auto Update</Label>
                                </div>
                                <Select
                                value={ytDlpUpdateChannel}
                                onValueChange={(value) => saveSettingsKey('ytdlp_update_channel', value)}
                                >
                                    <SelectTrigger className="w-[150px] ring-0 focus:ring-0">
                                        <SelectValue placeholder="Select update channel" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectGroup>
                                            <SelectLabel>Update Channels</SelectLabel>
                                            <SelectItem value="stable">Stable</SelectItem>
                                            <SelectItem value="nightly">Nightly</SelectItem>
                                        </SelectGroup>
                                    </SelectContent>
                                </Select>
                                <Button
                                disabled={ytDlpAutoUpdate || isUpdatingYtDlp || ongoingDownloads.length > 0}
                                onClick={async () => await updateYtDlp()}
                                >
                                    {isUpdatingYtDlp ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Updating
                                        </>
                                    ) : (
                                        <>
                                            Update
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </Card>
                    <div className="flex flex-col w-[50%] gap-4">
                        <div className="app-theme">
                            <h3 className="font-semibold">Theme</h3>
                            <p className="text-sm text-muted-foreground mb-3">Choose app interface theme</p>
                            <div className={cn('inline-flex gap-1 rounded-lg p-1 bg-muted')}>
                                {themeOptions.map(({ value, icon: Icon, label }) => (
                                    <button
                                        key={value}
                                        onClick={() => saveSettingsKey('theme', value)}
                                        className={cn(
                                            'flex items-center rounded-md px-3.5 py-1.5 transition-colors',
                                            appTheme === value
                                                ? 'bg-white shadow-xs dark:bg-neutral-700 dark:text-neutral-100'
                                                : 'text-neutral-500 hover:bg-neutral-200/60 hover:text-black dark:text-neutral-400 dark:hover:bg-neutral-700/60',
                                        )}
                                    >
                                        <Icon className="-ml-1 h-4 w-4" />
                                        <span className="ml-1.5 text-sm">{label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="download-dir">
                            <h3 className="font-semibold">Download Directory</h3>
                            <p className="text-sm text-muted-foreground mb-3">Set default download directory</p>
                            <div className="flex items-center gap-4">
                                <Input className="focus-visible:ring-0" type="text" placeholder="Select download directory" value={downloadDirPath ?? 'Unknown'} readOnly/>
                                <Button
                                variant="outline"
                                onClick={async () => {
                                    try {
                                        const folder = await open({
                                            multiple: false,
                                            directory: true,
                                        });
                                        if (folder) {
                                            saveSettingsKey('download_dir', folder);
                                            setPath('downloadDirPath', folder);
                                        }
                                    } catch (error) {
                                        console.error("Error selecting folder:", error);
                                        toast({
                                            title: "Failed to select folder",
                                            description: "Please try again.",
                                            variant: "destructive",
                                        });
                                    }
                                }}
                                >
                                    <FolderOpen className="w-4 h-4" /> Browse
                                </Button>
                            </div>
                        </div>
                        <div className="max-parallel-downloads">
                            <h3 className="font-semibold">Max Parallel Downloads</h3>
                            <p className="text-sm text-muted-foreground mb-3">Set maximum number of allowed parallel downloads</p>
                            <Slider
                            id="max-parallel-downloads"
                            className="w-[350px] mb-2"
                            value={[maxParallelDownloads]}
                            min={1}
                            max={5}
                            onValueChange={(value) => saveSettingsKey('max_parallel_downloads', value[0])}
                            />
                            <Label htmlFor="max-parallel-downloads" className="text-xs text-muted-foreground">(Current: {maxParallelDownloads}) (Default: 2, Maximum: 5)</Label>
                        </div>
                        <div className="prefer-video-over-playlist">
                            <h3 className="font-semibold">Prefer Video Over Playlist</h3>
                            <p className="text-sm text-muted-foreground mb-3">Prefer only the video, if the URL refers to a video and a playlist</p>
                            <Switch
                            id="prefer-video-over-playlist"
                            checked={preferVideoOverPlaylist}
                            onCheckedChange={(checked) => saveSettingsKey('prefer_video_over_playlist', checked)}
                            />
                        </div>
                        <div className="proxy">
                            <h3 className="font-semibold">Proxy</h3>
                            <p className="text-sm text-muted-foreground mb-3">Use proxy for downloads, Unblocks blocked sites in your region (Download speed may affect, Some sites may not work)</p>
                            <div className="flex items-center space-x-2 mb-4">
                                <Switch
                                id="use-proxy"
                                checked={useProxy}
                                onCheckedChange={(checked) => saveSettingsKey('use_proxy', checked)}
                                />
                                <Label htmlFor="use-proxy">Use Proxy</Label>
                            </div>
                            <div className="flex items-center gap-4">
                                <Form {...proxyUrlForm}>
                                    <form onSubmit={proxyUrlForm.handleSubmit(handleProxyUrlSubmit)} className="flex gap-4 w-full" autoComplete="off">
                                        <FormField
                                            control={proxyUrlForm.control}
                                            name="url"
                                            disabled={!useProxy}
                                            render={({ field }) => (
                                                <FormItem className="w-full">
                                                    <FormControl>
                                                        <Input
                                                        className="focus-visible:ring-0"
                                                        placeholder="Enter proxy URL"
                                                        {...field}
                                                        />
                                                    </FormControl>
                                                    <Label htmlFor="url" className="text-xs text-muted-foreground">(Configured: {proxyUrl ? 'Yes' : 'No'}, Status: {useProxy ? 'Enabled' : 'Disabled'})</Label>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <Button
                                            type="submit"
                                            disabled={!watchedProxyUrl || watchedProxyUrl === proxyUrl || Object.keys(proxyUrlFormErrors).length > 0 || !useProxy}
                                        >
                                            Save
                                        </Button>
                                    </form>
                                </Form>
                            </div>
                        </div>
                    </div>
                </TabsContent>
                <TabsContent value="extension">
                    <Card className="p-4 space-y-4 my-4">
                        <div className="w-full flex gap-4 items-center justify-between">
                            <div className="flex gap-4 items-center">
                                <div className="imgwrapper w-10 h-10 flex items-center justify-center bg-linear-65 from-[#FF43D0] to-[#4444FF] rounded-md overflow-hidden border border-border">
                                    <Radio className="size-5 text-white" />
                                </div>
                                <div className="flex flex-col">
                                    <h3 className="">Extension Websocket Server</h3>
                                    <p className="text-xs text-muted-foreground">{isChangingWebSocketPort || isRestartingWebSocketServer ? 'Restarting...' : 'Running' }</p>
                                </div>
                            </div>
                            <div className="flex gap-4 items-center">
                                <Button
                                onClick={async () => {
                                    setIsRestartingWebSocketServer(true);
                                    try {
                                        await invoke("restart_websocket_server");
                                        toast({
                                            title: "Websocket server restarted",
                                            description: "Websocket server restarted successfully.",
                                        });
                                    } catch (error) {
                                        console.error("Error restarting websocket server:", error);
                                        toast({
                                            title: "Failed to restart websocket server",
                                            description: "Please try again.",
                                            variant: "destructive",
                                        });
                                    } finally {
                                        setIsRestartingWebSocketServer(false);
                                    }
                                }}
                                disabled={isRestartingWebSocketServer || isChangingWebSocketPort}
                                >
                                    {isRestartingWebSocketServer ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Restarting
                                        </>
                                    ) : (
                                        <>
                                            <RotateCw className="h-4 w-4" />
                                            Restart
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </Card>
                    <div className="flex flex-col w-[50%] gap-4">
                        <div className="websocket-port">
                            <h3 className="font-semibold">Websocket Port</h3>
                            <p className="text-sm text-muted-foreground mb-3">Change extension websocket server port</p>
                            <div className="flex items-center gap-4">
                                <Form {...websocketPortForm}>
                                    <form onSubmit={websocketPortForm.handleSubmit(handleWebsocketPortSubmit)} className="flex gap-4 w-full" autoComplete="off">
                                        <FormField
                                            control={websocketPortForm.control}
                                            name="port"
                                            disabled={isChangingWebSocketPort}
                                            render={({ field }) => (
                                                <FormItem className="w-full">
                                                    <FormControl>
                                                        <Input
                                                        className="focus-visible:ring-0"
                                                        placeholder="Enter port number"
                                                        {...field}
                                                        />
                                                    </FormControl>
                                                    <Label htmlFor="port" className="text-xs text-muted-foreground">(Current: {websocketPort}) (Default: 53511, Range: 50000-60000)</Label>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <Button
                                            type="submit"
                                            disabled={!watchedPort || Number(watchedPort) === websocketPort || Object.keys(websocketPortFormErrors).length > 0 || isChangingWebSocketPort || isRestartingWebSocketServer}
                                        >
                                            {isChangingWebSocketPort ? (
                                                <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Changing
                                                </>
                                            ) : (
                                                'Change'
                                            )}
                                        </Button>
                                    </form>
                                </Form>
                            </div>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
            <div className="flex flex-col">
                <h3 className="font-semibold">Reset Settings</h3>
                <p className="text-sm text-muted-foreground mb-3">Reset all setting to default</p>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button
                        className="w-fit"
                        variant="destructive"
                        disabled={isUsingDefaultSettings}
                        >
                            <RotateCcw className="h-4 w-4" />
                            Reset Default
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action cannot be undone! it will permanently reset all settings to default.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={
                                () => resetSettings()
                            }>Reset</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    )
}
