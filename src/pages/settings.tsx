import Heading from "@/components/heading";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBasePathsStore, useDownloadStatesStore, useSettingsPageStatesStore } from "@/services/store";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowDownToLine, ArrowRight, EthernetPort, ExternalLink, Folder, FolderOpen, Loader2, LucideIcon, Monitor, Moon, Radio, RotateCcw, RotateCw, Sun, Terminal, WandSparkles, Wifi, Wrench } from "lucide-react";
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
import { SlidingButton } from "@/components/custom/slidingButton";

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

    const openLink = async (url: string, app: string | null) => {
        try {
            await invoke('open_file_with_app', { filePath: url, appName: app }).then(() => {
                toast({
                    title: 'Opening Link',
                    description: `Opening link with ${app ? app : 'default app'}.`,
                })
            });
        } catch (e) {
            console.error(e);
            toast({
                title: 'Failed to open link',
                description: 'An error occurred while trying to open the link.',
                variant: "destructive"
            })
        }
    }

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
                <div className="w-full flex items-center justify-between">
                    <TabsList>
                        <TabsTrigger value="app">Application</TabsTrigger>
                        <TabsTrigger value="extension">Extension</TabsTrigger>
                    </TabsList>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button
                            className="w-fit"
                            variant="destructive"
                            size="sm"
                            disabled={isUsingDefaultSettings}
                            >
                                <RotateCcw className="h-4 w-4" />
                                Reset
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Reset settings to default?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Are you sure you want to reset all settings to their default values? This action cannot be undone!
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
                <TabsContent value="app">
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
                    <Tabs
                    orientation="vertical"
                    defaultValue="general"
                    className="w-full flex flex-row items-start gap-4 mt-10"
                    >
                        <TabsList className="shrink-0 grid grid-cols-1 gap-1 p-0 bg-background min-w-45">
                            <TabsTrigger
                                key="general"
                                value="general"
                                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground justify-start px-3 py-1.5 gap-2"
                            ><Wrench className="size-4" /> General</TabsTrigger>
                            <TabsTrigger
                                key="appearance"
                                value="appearance"
                                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground justify-start px-3 py-1.5 gap-2"
                            ><WandSparkles className="size-4" /> Appearance</TabsTrigger>
                            <TabsTrigger
                                key="folders"
                                value="folders"
                                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground justify-start px-3 py-1.5 gap-2"
                            ><Folder className="size-4" /> Folders</TabsTrigger>
                            <TabsTrigger
                                key="network"
                                value="network"
                                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground justify-start px-3 py-1.5 gap-2"
                            ><Wifi className="size-4" /> Network</TabsTrigger>
                        </TabsList>
                        <div className="min-h-full flex flex-col max-w-[55%] w-full border-l border-border pl-4">
                            <TabsContent key="general" value="general" className="flex flex-col gap-4 min-h-[150px]">
                                <div className="max-parallel-downloads">
                                    <h3 className="font-semibold">Max Parallel Downloads</h3>
                                    <p className="text-xs text-muted-foreground mb-3">Set maximum number of allowed parallel downloads</p>
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
                                    <p className="text-xs text-muted-foreground mb-3">Prefer only the video, if the URL refers to a video and a playlist</p>
                                    <Switch
                                    id="prefer-video-over-playlist"
                                    checked={preferVideoOverPlaylist}
                                    onCheckedChange={(checked) => saveSettingsKey('prefer_video_over_playlist', checked)}
                                    />
                                </div>
                            </TabsContent>
                            <TabsContent key="appearance" value="appearance" className="flex flex-col gap-4 min-h-[150px]">
                                <div className="app-theme">
                                    <h3 className="font-semibold">Theme</h3>
                                    <p className="text-xs text-muted-foreground mb-3">Choose app interface theme</p>
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
                            </TabsContent>
                            <TabsContent key="folders" value="folders" className="flex flex-col gap-4 min-h-[150px]">
                                <div className="download-dir">
                                    <h3 className="font-semibold">Download Folder</h3>
                                    <p className="text-xs text-muted-foreground mb-3">Set default download folder (directory)</p>
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
                            </TabsContent>
                            <TabsContent key="network" value="network" className="flex flex-col gap-4 min-h-[150px]">
                                <div className="proxy">
                                    <h3 className="font-semibold">Proxy</h3>
                                    <p className="text-xs text-muted-foreground mb-3">Use proxy for downloads, Unblocks blocked sites in your region (Download speed may affect, Some sites may not work)</p>
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
                            </TabsContent>
                        </div>
                    </Tabs>
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
                    <Tabs
                    orientation="vertical"
                    defaultValue="install"
                    className="w-full flex flex-row items-start gap-4 mt-10"
                    >
                        <TabsList className="shrink-0 grid grid-cols-1 gap-1 p-0 bg-background min-w-45">
                            <TabsTrigger
                                key="install"
                                value="install"
                                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground justify-start px-3 py-1.5 gap-2"
                            ><ArrowDownToLine className="size-4" /> Install</TabsTrigger>
                            <TabsTrigger
                                key="port"
                                value="port"
                                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground justify-start px-3 py-1.5 gap-2"
                            ><EthernetPort className="size-4" /> Port</TabsTrigger>
                        </TabsList>
                        <div className="min-h-full flex flex-col w-full border-l border-border pl-4">
                            <TabsContent key="install" value="install" className="flex flex-col gap-4 min-h-[150px] max-w-[90%]">
                                <div className="install-neodlp-extension">
                                    <h3 className="font-semibold">NeoDLP Extension</h3>
                                    <p className="text-xs text-muted-foreground mb-4">Integrate NeoDLP with your favourite browser</p>
                                    <div className="flex items-center gap-4 mb-4">
                                        <SlidingButton
                                            slidingContent={
                                                <div className="flex items-center justify-center gap-2 text-white dark:text-black">
                                                    <ArrowRight className="size-4" />
                                                    <span>Get Now</span>
                                                </div>
                                            }
                                            onClick={() => openLink('https://chromewebstore.google.com/detail/neo-downloader-plus/mehopeailfjmiloiiohgicphlcgpompf', 'chrome')}
                                            >
                                            <span className="font-semibold flex items-center gap-2">
                                                <svg className="size-4 fill-white dark:fill-black" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
                                                    <path d="M0 256C0 209.4 12.5 165.6 34.3 127.1L144.1 318.3C166 357.5 207.9 384 256 384C270.3 384 283.1 381.7 296.8 377.4L220.5 509.6C95.9 492.3 0 385.3 0 256zM365.1 321.6C377.4 302.4 384 279.1 384 256C384 217.8 367.2 183.5 340.7 160H493.4C505.4 189.6 512 222.1 512 256C512 397.4 397.4 511.1 256 512L365.1 321.6zM477.8 128H256C193.1 128 142.3 172.1 130.5 230.7L54.2 98.5C101 38.5 174 0 256 0C350.8 0 433.5 51.5 477.8 128V128zM168 256C168 207.4 207.4 168 256 168C304.6 168 344 207.4 344 256C344 304.6 304.6 344 256 344C207.4 344 168 304.6 168 256z"/>
                                                </svg>
                                                Get Chrome Extension
                                            </span>
                                            <span className="text-xs">from Chrome Web Store</span>
                                        </SlidingButton>
                                        <SlidingButton
                                            slidingContent={
                                                <div className="flex items-center justify-center gap-2 text-white dark:text-black">
                                                    <ArrowRight className="size-4" />
                                                    <span>Get Now</span>
                                                </div>
                                            }
                                            onClick={() => openLink('https://addons.mozilla.org/en-US/firefox/addon/neo-downloader-plus', 'firefox')}
                                            >
                                            <span className="font-semibold flex items-center gap-2">
                                                <svg className="size-4 fill-white dark:fill-black" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
                                                    <path d="M130.2 127.5C130.4 127.6 130.3 127.6 130.2 127.5V127.5zM481.6 172.9C471 147.4 449.6 119.9 432.7 111.2C446.4 138.1 454.4 165 457.4 185.2C457.4 185.3 457.4 185.4 457.5 185.6C429.9 116.8 383.1 89.1 344.9 28.7C329.9 5.1 334 3.5 331.8 4.1L331.7 4.2C285 30.1 256.4 82.5 249.1 126.9C232.5 127.8 216.2 131.9 201.2 139C199.8 139.6 198.7 140.7 198.1 142C197.4 143.4 197.2 144.9 197.5 146.3C197.7 147.2 198.1 148 198.6 148.6C199.1 149.3 199.8 149.9 200.5 150.3C201.3 150.7 202.1 151 203 151.1C203.8 151.1 204.7 151 205.5 150.8L206 150.6C221.5 143.3 238.4 139.4 255.5 139.2C318.4 138.7 352.7 183.3 363.2 201.5C350.2 192.4 326.8 183.3 304.3 187.2C392.1 231.1 368.5 381.8 247 376.4C187.5 373.8 149.9 325.5 146.4 285.6C146.4 285.6 157.7 243.7 227 243.7C234.5 243.7 256 222.8 256.4 216.7C256.3 214.7 213.8 197.8 197.3 181.5C188.4 172.8 184.2 168.6 180.5 165.5C178.5 163.8 176.4 162.2 174.2 160.7C168.6 141.2 168.4 120.6 173.5 101.1C148.5 112.5 129 130.5 114.8 146.4H114.7C105 134.2 105.7 93.8 106.3 85.3C106.1 84.8 99 89 98.1 89.7C89.5 95.7 81.6 102.6 74.3 110.1C58 126.7 30.1 160.2 18.8 211.3C14.2 231.7 12 255.7 12 263.6C12 398.3 121.2 507.5 255.9 507.5C376.6 507.5 478.9 420.3 496.4 304.9C507.9 228.2 481.6 173.8 481.6 172.9z"/>
                                                </svg>
                                                Get Firefox Extension
                                            </span>
                                            <span className="text-xs">from Mozilla Addons Store</span>
                                        </SlidingButton>
                                    </div>
                                    <div className="flex gap-2 mb-4">
                                        <Button variant="outline" onClick={() => openLink('https://chromewebstore.google.com/detail/neo-downloader-plus/mehopeailfjmiloiiohgicphlcgpompf', 'msedge')}>Edge</Button>
                                        <Button variant="outline" onClick={() => openLink('https://chromewebstore.google.com/detail/neo-downloader-plus/mehopeailfjmiloiiohgicphlcgpompf', 'opera')}>Opera</Button>
                                        <Button variant="outline" onClick={() => openLink('https://chromewebstore.google.com/detail/neo-downloader-plus/mehopeailfjmiloiiohgicphlcgpompf', 'brave')}>Brave</Button>
                                        <Button variant="outline" onClick={() => openLink('https://chromewebstore.google.com/detail/neo-downloader-plus/mehopeailfjmiloiiohgicphlcgpompf', 'arc')}>Arc</Button>
                                        <Button variant="outline" onClick={() => openLink('https://addons.mozilla.org/en-US/firefox/addon/neo-downloader-plus', 'zen')}>Zen</Button>
                                    </div>
                                    <p className="text-xs text-muted-foreground mb-2">* These links opens with coresponding browsers only. Make sure the browser is installed befor clicking the link</p>
                                </div>
                            </TabsContent>
                            <TabsContent key="port" value="port" className="flex flex-col gap-4 min-h-[150px] max-w-[70%]">
                                <div className="websocket-port">
                                    <h3 className="font-semibold">Websocket Port</h3>
                                    <p className="text-xs text-muted-foreground mb-3">Change extension websocket server port</p>
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
                            </TabsContent>
                        </div>
                    </Tabs>
                </TabsContent>
            </Tabs>
        </div>
    )
}
