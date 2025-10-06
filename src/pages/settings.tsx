import Heading from "@/components/heading";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBasePathsStore, useDownloaderPageStatesStore, useDownloadStatesStore, useSettingsPageStatesStore } from "@/services/store";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowRight, BrushCleaning, Cookie, EthernetPort, ExternalLink, FileVideo, Folder, FolderOpen, Info, Loader2, LucideIcon, Monitor, Moon, Radio, RotateCcw, RotateCw, ShieldMinus, SquareTerminal, Sun, Terminal, Trash, TriangleAlert, WandSparkles, Wifi, Wrench } from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import * as fs from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { formatSpeed, generateID } from "@/utils";
import { ToggleGroup, ToggleGroupItem } from "@/components/custom/legacyToggleGroup";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const websocketPortSchema = z.object({
    port: z.coerce.number<number>({
        error: (issue) => issue.input === undefined || issue.input === null || issue.input === ""
        ? "Websocket Port is required"
        : "Websocket Port must be a valid number"
    }).int({
        message: "Websocket Port must be an integer"
    }).min(50000, {
        message: "Websocket Port must be at least 50000"
    }).max(60000, {
        message: "Websocket Port must be at most 60000"
    }),
})

const proxyUrlSchema = z.object({
    url: z.url({
        error: (issue) => issue.input === undefined || issue.input === null || issue.input === ""
        ? "Proxy URL is required"
        : "Invalid URL format"
    })
});

const rateLimitSchema = z.object({
    rate_limit: z.coerce.number<number>({
        error: (issue) => issue.input === undefined || issue.input === null || issue.input === ""
        ? "Rate Limit is required"
        : "Rate Limit must be a valid number"
    }).int({
        message: "Rate Limit must be an integer"
    }).min(1024, {
        message: "Rate Limit must be at least 1024 bytes/s (1 KB/s)"
    }).max(104857600, {
        message: "Rate Limit must be at most 104857600 bytes/s (100 MB/s)"
    }),
});

const addCustomCommandSchema = z.object({
    label: z.string().min(1, { message: "Label is required" }),
    args: z.string().min(1, { message: "Arguments are required" }),
});

const filenameTemplateShcema = z.object({
    template: z.string().min(1, { message: "Filename Template is required" }),
});

export default function SettingsPage() {
    const { setTheme } = useTheme();

    const activeTab = useSettingsPageStatesStore(state => state.activeTab);
    const activeSubAppTab = useSettingsPageStatesStore(state => state.activeSubAppTab);
    const activeSubExtTab = useSettingsPageStatesStore(state => state.activeSubExtTab);
    const setActiveTab = useSettingsPageStatesStore(state => state.setActiveTab);
    const setActiveSubAppTab = useSettingsPageStatesStore(state => state.setActiveSubAppTab);
    const setActiveSubExtTab = useSettingsPageStatesStore(state => state.setActiveSubExtTab);

    const isUsingDefaultSettings = useSettingsPageStatesStore(state => state.isUsingDefaultSettings);
    const ytDlpVersion = useSettingsPageStatesStore(state => state.ytDlpVersion);
    const isFetchingYtDlpVersion = useSettingsPageStatesStore(state => state.isFetchingYtDlpVersion);
    const isUpdatingYtDlp = useSettingsPageStatesStore(state => state.isUpdatingYtDlp);
    const ytDlpUpdateChannel = useSettingsPageStatesStore(state => state.settings.ytdlp_update_channel);
    const ytDlpAutoUpdate = useSettingsPageStatesStore(state => state.settings.ytdlp_auto_update);
    const appTheme = useSettingsPageStatesStore(state => state.settings.theme);
    const maxParallelDownloads = useSettingsPageStatesStore(state => state.settings.max_parallel_downloads);
    const maxRetries = useSettingsPageStatesStore(state => state.settings.max_retries);
    const preferVideoOverPlaylist = useSettingsPageStatesStore(state => state.settings.prefer_video_over_playlist);
    const strictDownloadabilityCheck = useSettingsPageStatesStore(state => state.settings.strict_downloadablity_check);
    const useProxy = useSettingsPageStatesStore(state => state.settings.use_proxy);
    const proxyUrl = useSettingsPageStatesStore(state => state.settings.proxy_url);
    const useRateLimit = useSettingsPageStatesStore(state => state.settings.use_rate_limit);
    const rateLimit = useSettingsPageStatesStore(state => state.settings.rate_limit);
    const videoFormat = useSettingsPageStatesStore(state => state.settings.video_format);
    const audioFormat = useSettingsPageStatesStore(state => state.settings.audio_format);
    const alwaysReencodeVideo = useSettingsPageStatesStore(state => state.settings.always_reencode_video);
    const embedVideoMetadata = useSettingsPageStatesStore(state => state.settings.embed_video_metadata);
    const embedAudioMetadata = useSettingsPageStatesStore(state => state.settings.embed_audio_metadata);
    const embedAudioThumbnail = useSettingsPageStatesStore(state => state.settings.embed_audio_thumbnail);
    const useCookies = useSettingsPageStatesStore(state => state.settings.use_cookies);
    const importCookiesFrom = useSettingsPageStatesStore(state => state.settings.import_cookies_from);
    const cookiesBrowser = useSettingsPageStatesStore(state => state.settings.cookies_browser);
    const cookiesFile = useSettingsPageStatesStore(state => state.settings.cookies_file);
    const useSponsorblock = useSettingsPageStatesStore(state => state.settings.use_sponsorblock);
    const sponsorblockMode = useSettingsPageStatesStore(state => state.settings.sponsorblock_mode);
    const sponsorblockRemove = useSettingsPageStatesStore(state => state.settings.sponsorblock_remove);
    const sponsorblockMark = useSettingsPageStatesStore(state => state.settings.sponsorblock_mark);
    const sponsorblockRemoveCategories = useSettingsPageStatesStore(state => state.settings.sponsorblock_remove_categories);
    const sponsorblockMarkCategories = useSettingsPageStatesStore(state => state.settings.sponsorblock_mark_categories);
    const useAria2 = useSettingsPageStatesStore(state => state.settings.use_aria2);
    const useForceInternetProtocol = useSettingsPageStatesStore(state => state.settings.use_force_internet_protocol);
    const forceInternetProtocol = useSettingsPageStatesStore(state => state.settings.force_internet_protocol);
    const useCustomCommands = useSettingsPageStatesStore(state => state.settings.use_custom_commands);
    const customCommands = useSettingsPageStatesStore(state => state.settings.custom_commands);
    const filenameTemplate = useSettingsPageStatesStore(state => state.settings.filename_template);

    const websocketPort = useSettingsPageStatesStore(state => state.settings.websocket_port);
    const isChangingWebSocketPort = useSettingsPageStatesStore(state => state.isChangingWebSocketPort);
    const setIsChangingWebSocketPort = useSettingsPageStatesStore(state => state.setIsChangingWebSocketPort);
    const isRestartingWebSocketServer = useSettingsPageStatesStore(state => state.isRestartingWebSocketServer);
    const setIsRestartingWebSocketServer = useSettingsPageStatesStore(state => state.setIsRestartingWebSocketServer);

    const setDownloadConfigurationKey = useDownloaderPageStatesStore((state) => state.setDownloadConfigurationKey);
    const resetDownloadConfiguration = useDownloaderPageStatesStore((state) => state.resetDownloadConfiguration);

    const downloadStates = useDownloadStatesStore(state => state.downloadStates);
    const ongoingDownloads = downloadStates.filter(state =>
        ['starting', 'downloading', 'queued'].includes(state.download_status)
    );

    const downloadDirPath = useBasePathsStore((state) => state.downloadDirPath);
    const tempDownloadDirPath = useBasePathsStore((state) => state.tempDownloadDirPath);
    const setPath = useBasePathsStore((state) => state.setPath);
    const { saveSettingsKey, resetSettings } = useSettings();
    const { updateYtDlp } = useYtDlpUpdater();


    const themeOptions: { value: string; icon: LucideIcon; label: string }[] = [
        { value: 'light', icon: Sun, label: 'Light' },
        { value: 'dark', icon: Moon, label: 'Dark' },
        { value: 'system', icon: Monitor, label: 'System' },
    ];

    const sponsorblockCategories = [
        { code: 'sponsor', label: 'Sponsorship' },
        { code: 'intro', label: 'Intro' },
        { code: 'outro', label: 'Outro' },
        { code: 'interaction', label: 'Interaction' },
        { code: 'selfpromo', label: 'Self Promotion' },
        { code: 'music_offtopic', label: 'Music Offtopic' },
        { code: 'preview', label: 'Preview' },
        { code: 'filler', label: 'Filler' },
        { code: 'poi_highlight', label: 'Point of Interest' },
        { code: 'chapter', label: 'Chapter' },
    ];

    const openLink = async (url: string, app: string | null) => {
        try {
            await invoke('open_file_with_app', { filePath: url, appName: app }).then(() => {
                toast.info("Opening link", {
                    description: `Opening link with ${app ? app : 'default app'}.`,
                })
            });
        } catch (e) {
            console.error(e);
            toast.error("Failed to open link", {
                description: "An error occurred while trying to open the link.",
            })
        }
    }

    const cleanTemporaryDownloads = async () => {
        const tempFiles = await fs.readDir(tempDownloadDirPath ?? '');
        if (tempFiles.length > 0) {
            try {
                for (const file of tempFiles) {
                    if (file.isFile) {
                        const filePath = await join(tempDownloadDirPath ?? '', file.name);
                        await fs.remove(filePath);
                    }
                }
                toast.success("Temporary Downloads Cleaned", {
                    description: "All temporary downloads have been successfully cleaned up.",
                });
            } catch (e) {
                toast.error("Temporary Downloads Cleanup Failed", {
                    description: "An error occurred while trying to clean up temporary downloads. Please try again.",
                });
            }
        } else {
            toast.info("No Temporary Downloads", {
                description: "There are no temporary downloads to clean up.",
            });
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
            toast.success("Proxy URL updated", {
                description: `Proxy URL changed to ${values.url}`,
            });
        } catch (error) {
            console.error("Error changing proxy URL:", error);
            toast.error("Failed to change proxy URL", {
                description: "An error occurred while trying to change the proxy URL. Please try again.",
            });
        }
    }

    const rateLimitForm = useForm<z.infer<typeof rateLimitSchema>>({
        resolver: zodResolver(rateLimitSchema),
        defaultValues: {
            rate_limit: rateLimit,
        },
        mode: "onChange",
    });
    const watchedRateLimit = rateLimitForm.watch("rate_limit");
    const { errors: rateLimitFormErrors } = rateLimitForm.formState;

    function handleRateLimitSubmit(values: z.infer<typeof rateLimitSchema>) {
        try {
            saveSettingsKey('rate_limit', values.rate_limit);
            toast.success("Rate Limit updated", {
                description: `Rate Limit changed to ${values.rate_limit} bytes/s`,
            });
        } catch (error) {
            console.error("Error changing rate limit:", error);
            toast.error("Failed to change rate limit", {
                description: "An error occurred while trying to change the rate limit. Please try again.",
            });
        }
    }

    const addCustomCommandForm = useForm<z.infer<typeof addCustomCommandSchema>>({
        resolver: zodResolver(addCustomCommandSchema),
        defaultValues: {
            label: '',
            args: '',
        },
        mode: "onChange",
    });
    const watchedLabel = addCustomCommandForm.watch("label");
    const watchedArgs = addCustomCommandForm.watch("args");
    const { errors: addCustomCommandFormErrors } = addCustomCommandForm.formState;

    function handleAddCustomCommandSubmit(values: z.infer<typeof addCustomCommandSchema>) {
        try {
            const newCommand = {
                id: generateID(),
                label: values.label,
                args: values.args,
            };
            const updatedCommands = [...customCommands, newCommand];
            saveSettingsKey('custom_commands', updatedCommands);
            toast.success("Custom Command added", {
                description: `Custom Command "${values.label}" added.`,
            });
            addCustomCommandForm.reset();
        } catch (error) {
            console.error("Error adding custom command:", error);
            toast.error("Failed to add custom command", {
                description: "An error occurred while trying to add the custom command. Please try again.",
            });
        }
    }

    function handleRemoveCustomCommandSubmit(commandId: string) {
        try {
            const removedCommand = customCommands.find(command => command.id === commandId);
            const updatedCommands = customCommands.filter(command => command.id !== commandId);
            saveSettingsKey('custom_commands', updatedCommands);
            setDownloadConfigurationKey('custom_command', null);
            toast.success("Custom Command removed", {
                description: `Custom Command "${removedCommand?.label}" removed.`,
            });
        } catch (error) {
            console.error("Error removing custom command:", error);
            toast.error("Failed to remove custom command", {
                description: "An error occurred while trying to remove the custom command. Please try again.",
            });
        }
    }

    const filenameTemplateForm = useForm<z.infer<typeof filenameTemplateShcema>>({
        resolver: zodResolver(filenameTemplateShcema),
        defaultValues: {
            template: filenameTemplate,
        },
        mode: "onChange",
    });
    const watchedFilenameTemplate = filenameTemplateForm.watch("template");
    const { errors: filenameTemplateFormErrors } = filenameTemplateForm.formState;

    function handleFilenameTemplateSubmit(values: z.infer<typeof filenameTemplateShcema>) {
        try {
            saveSettingsKey('filename_template', values.template);
            toast.success("Filename Template updated", {
                description: `Filename Template changed to ${values.template}`,
            });
        } catch (error) {
            console.error("Error changing filename template:", error);
            toast.error("Failed to change filename template", {
                description: "An error occurred while trying to change the filename template. Please try again.",
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
            toast.success("Websocket port updated", {
                description: `Websocket port changed to ${values.port}`,
            });
        } catch (error) {
            console.error("Error changing websocket port:", error);
            toast.error("Failed to change websocket port", {
                description: "An error occurred while trying to change the websocket port. Please try again.",
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
                                    () => {
                                        resetSettings()
                                        proxyUrlForm.reset();
                                        rateLimitForm.reset();
                                        addCustomCommandForm.reset();
                                        filenameTemplateForm.reset();
                                        websocketPortForm.reset();
                                    }
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
                    className="w-full flex flex-row items-start gap-4 mt-7"
                    orientation="vertical"
                    value={activeSubAppTab}
                    onValueChange={setActiveSubAppTab}
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
                                key="formats"
                                value="formats"
                                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground justify-start px-3 py-1.5 gap-2"
                            ><FileVideo className="size-4" /> Formats</TabsTrigger>
                            <TabsTrigger
                                key="metadata"
                                value="metadata"
                                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground justify-start px-3 py-1.5 gap-2"
                            ><Info className="size-4" /> Metadata</TabsTrigger>
                            <TabsTrigger
                                key="network"
                                value="network"
                                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground justify-start px-3 py-1.5 gap-2"
                            ><Wifi className="size-4" /> Network</TabsTrigger>
                            <TabsTrigger
                                key="cookies"
                                value="cookies"
                                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground justify-start px-3 py-1.5 gap-2"
                            ><Cookie className="size-4" /> Cookies</TabsTrigger>
                            <TabsTrigger
                                key="sponsorblock"
                                value="sponsorblock"
                                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground justify-start px-3 py-1.5 gap-2"
                            ><ShieldMinus className="size-4" /> Sponsorblock</TabsTrigger>
                            <TabsTrigger
                                key="commands"
                                value="commands"
                                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground justify-start px-3 py-1.5 gap-2"
                            ><SquareTerminal className="size-4" /> Commands</TabsTrigger>
                        </TabsList>
                        <div className="min-h-full flex flex-col max-w-[55%] w-full border-l border-border pl-4">
                            <TabsContent key="general" value="general" className="flex flex-col gap-4 min-h-[350px]">
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
                                <div className="strict-downloadability-check">
                                    <h3 className="font-semibold">Strict Downloadablity Check</h3>
                                    <p className="text-xs text-muted-foreground mb-3">Only show streams that are actualy downloadable, also check formats before downloading (high quality results, takes longer time to search)</p>
                                    <Switch
                                    id="strict-downloadablity-check"
                                    checked={strictDownloadabilityCheck}
                                    onCheckedChange={(checked) => saveSettingsKey('strict_downloadablity_check', checked)}
                                    />
                                </div>
                                <div className="max-retries">
                                    <h3 className="font-semibold">Max Retries</h3>
                                    <p className="text-xs text-muted-foreground mb-3">Set maximum number of retries for a download before giving up</p>
                                    <Slider
                                    id="max-retries"
                                    className="w-[350px] mb-2"
                                    value={[maxRetries]}
                                    min={1}
                                    max={100}
                                    onValueChange={(value) => saveSettingsKey('max_retries', value[0])}
                                    />
                                    <Label htmlFor="max-retries" className="text-xs text-muted-foreground">(Current: {maxRetries}) (Default: 5, Maximum: 100)</Label>
                                </div>
                                <div className="aria2">
                                    <h3 className="font-semibold">Aria2</h3>
                                    <p className="text-xs text-muted-foreground mb-3">Use aria2c as external downloader (recommended only if you are experiancing too slow download speeds with native downloader, you need to install aria2 via homebrew if you are on macos to use this feature)</p>
                                    <Switch
                                    id="aria2"
                                    checked={useAria2}
                                    onCheckedChange={(checked) => saveSettingsKey('use_aria2', checked)}
                                    disabled={useCustomCommands}
                                    />
                                </div>
                            </TabsContent>
                            <TabsContent key="appearance" value="appearance" className="flex flex-col gap-4 min-h-[350px]">
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
                            <TabsContent key="folders" value="folders" className="flex flex-col gap-4 min-h-[350px]">
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
                                                toast.error("Failed to select folder", {
                                                    description: "An error occurred while trying to select the download folder. Please try again.",
                                                });
                                            }
                                        }}
                                        >
                                            <FolderOpen className="w-4 h-4" /> Browse
                                        </Button>
                                    </div>
                                </div>
                                <div className="temporary-download-dir">
                                    <h3 className="font-semibold">Temporary Download Folder</h3>
                                    <p className="text-xs text-muted-foreground mb-3">Clean up temporary downloads (broken, cancelled, paused downloads)</p>
                                    <div className="flex items-center gap-4">
                                        <Input className="focus-visible:ring-0" type="text" placeholder="Temporary download directory" value={tempDownloadDirPath ?? 'Unknown'} readOnly/>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button
                                                variant="destructive"
                                                disabled={ongoingDownloads.length > 0}
                                                >
                                                    <BrushCleaning className="size-4" /> Clean
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Clean up all temporary downloads?</AlertDialogTitle>
                                                    <AlertDialogDescription>Are you sure you want to clean up all temporary downloads? This will remove all broken, cancelled and paused downloads from the temporary folder. Paused downloads will re-start from the begining. This action cannot be undone!</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction
                                                    onClick={() => cleanTemporaryDownloads()}
                                                    >Clean</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </div>
                                <div className="filename-template">
                                    <h3 className="font-semibold">Filename Template</h3>
                                    <p className="text-xs text-muted-foreground mb-3">Set the template for naming downloaded files (download id and file extension will be auto-appended at the end, changing template may cause paused downloads to re-start from begining)</p>
                                    <Form {...filenameTemplateForm}>
                                        <form onSubmit={filenameTemplateForm.handleSubmit(handleFilenameTemplateSubmit)} className="flex gap-4 w-full" autoComplete="off">
                                            <FormField
                                                control={filenameTemplateForm.control}
                                                name="template"
                                                render={({ field }) => (
                                                    <FormItem className="w-full">
                                                        <FormControl>
                                                            <Input
                                                            className="focus-visible:ring-0"
                                                            placeholder="Enter filename template"
                                                            {...field}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <Button
                                                type="submit"
                                                disabled={!watchedFilenameTemplate || watchedFilenameTemplate === filenameTemplate || Object.keys(filenameTemplateFormErrors).length > 0}
                                            >
                                                Save
                                            </Button>
                                        </form>
                                    </Form>
                                </div>
                            </TabsContent>
                            <TabsContent key="formats" value="formats" className="flex flex-col gap-4 min-h-[350px]">
                                <div className="video-format">
                                    <h3 className="font-semibold">Video Format</h3>
                                    <p className="text-xs text-muted-foreground mb-3">Choose in which format the final video file will be saved</p>
                                    <RadioGroup
                                    orientation="horizontal"
                                    className="flex items-center gap-4"
                                    value={videoFormat}
                                    onValueChange={(value) => saveSettingsKey('video_format', value)}
                                    disabled={useCustomCommands}
                                    >
                                        <div className="flex items-center gap-3">
                                            <RadioGroupItem value="auto" id="v-auto" />
                                            <Label htmlFor="v-auto">Auto (Default)</Label>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <RadioGroupItem value="mp4" id="v-mp4" />
                                            <Label htmlFor="v-mp4">MP4</Label>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <RadioGroupItem value="webm" id="v-webm" />
                                            <Label htmlFor="v-webm">WEBM</Label>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <RadioGroupItem value="mkv" id="v-mkv" />
                                            <Label htmlFor="v-mkv">MKV</Label>
                                        </div>
                                    </RadioGroup>
                                </div>
                                <div className="audio-format">
                                    <h3 className="font-semibold">Audio Format</h3>
                                    <p className="text-xs text-muted-foreground mb-3">Choose in which format the final audio file will be saved</p>
                                    <RadioGroup
                                    orientation="horizontal"
                                    className="flex items-center gap-4"
                                    value={audioFormat}
                                    onValueChange={(value) => saveSettingsKey('audio_format', value)}
                                    disabled={useCustomCommands}
                                    >
                                        <div className="flex items-center gap-3">
                                            <RadioGroupItem value="auto" id="a-auto" />
                                            <Label htmlFor="a-auto">Auto (Default)</Label>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <RadioGroupItem value="m4a" id="a-m4a" />
                                            <Label htmlFor="a-m4a">M4A</Label>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <RadioGroupItem value="opus" id="a-opus" />
                                            <Label htmlFor="a-opus">OPUS</Label>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <RadioGroupItem value="mp3" id="a-mp3" />
                                            <Label htmlFor="a-mp3">MP3</Label>
                                        </div>
                                    </RadioGroup>
                                </div>
                                <div className="always-reencode-video">
                                    <h3 className="font-semibold">Always Re-Encode Video</h3>
                                    <p className="text-xs text-muted-foreground mb-3">Instead of remuxing (simple container change) always re-encode the video to the target format with best compatible codecs (better compatibility, takes longer processing time)</p>
                                    <Switch
                                    id="always-reencode-video"
                                    checked={alwaysReencodeVideo}
                                    onCheckedChange={(checked) => saveSettingsKey('always_reencode_video', checked)}
                                    disabled={useCustomCommands}
                                    />
                                </div>
                            </TabsContent>
                            <TabsContent key="metadata" value="metadata" className="flex flex-col gap-4 min-h-[350px]">
                                <div className="embed-video-metadata">
                                    <h3 className="font-semibold">Embed Metadata</h3>
                                    <p className="text-xs text-muted-foreground mb-3">Wheather to embed metadata in video/audio files (info, chapters)</p>
                                    <div className="flex items-center space-x-2 mb-3">
                                        <Switch
                                        id="embed-video-metadata"
                                        checked={embedVideoMetadata}
                                        onCheckedChange={(checked) => saveSettingsKey('embed_video_metadata', checked)}
                                        disabled={useCustomCommands}
                                        />
                                        <Label htmlFor="embed-video-metadata">Video</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Switch
                                        id="embed-audio-metadata"
                                        checked={embedAudioMetadata}
                                        onCheckedChange={(checked) => saveSettingsKey('embed_audio_metadata', checked)}
                                        disabled={useCustomCommands}
                                        />
                                        <Label htmlFor="embed-audio-metadata">Audio</Label>
                                    </div>
                                </div>
                                <div className="embed-audio-thumbnail">
                                    <h3 className="font-semibold">Embed Thumbnail in Audio</h3>
                                    <p className="text-xs text-muted-foreground mb-3">Wheather to embed thumbnail in audio files (as cover art)</p>
                                    <Switch
                                    id="embed-audio-thumbnail"
                                    checked={embedAudioThumbnail}
                                    onCheckedChange={(checked) => saveSettingsKey('embed_audio_thumbnail', checked)}
                                    disabled={useCustomCommands}
                                    />
                                </div>
                            </TabsContent>
                            <TabsContent key="network" value="network" className="flex flex-col gap-4 min-h-[350px]">
                                <div className="proxy">
                                    <h3 className="font-semibold">Proxy</h3>
                                    <p className="text-xs text-muted-foreground mb-3">Use proxy for downloads, Unblocks blocked sites in your region (download speed may affect, some sites may not work)</p>
                                    <div className="flex items-center space-x-2 mb-4">
                                        <Switch
                                        id="use-proxy"
                                        checked={useProxy}
                                        onCheckedChange={(checked) => saveSettingsKey('use_proxy', checked)}
                                        disabled={useCustomCommands}
                                        />
                                        <Label htmlFor="use-proxy">Use Proxy</Label>
                                    </div>
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
                                                            readOnly={useCustomCommands}
                                                            {...field}
                                                            />
                                                        </FormControl>
                                                        <Label htmlFor="url" className="text-xs text-muted-foreground">(Configured: {proxyUrl ? 'Yes' : 'No'}, Status: {useProxy && !useCustomCommands ? 'Enabled' : 'Disabled'})</Label>
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
                                <div className="rate-limit">
                                    <h3 className="font-semibold">Rate Limit</h3>
                                    <p className="text-xs text-muted-foreground mb-3">Limit download speed to prevent network congestion. Rate limit is applied per-download basis (not in the whole app)</p>
                                    <div className="flex items-center space-x-2 mb-4">
                                        <Switch
                                        id="use-rate-limit"
                                        checked={useRateLimit}
                                        onCheckedChange={(checked) => saveSettingsKey('use_rate_limit', checked)}
                                        disabled={useCustomCommands}
                                        />
                                        <Label htmlFor="use-rate-limit">Use Rate Limit</Label>
                                    </div>
                                    <Form {...rateLimitForm}>
                                        <form onSubmit={rateLimitForm.handleSubmit(handleRateLimitSubmit)} className="flex gap-4 w-full" autoComplete="off">
                                            <FormField
                                                control={rateLimitForm.control}
                                                name="rate_limit"
                                                disabled={!useRateLimit}
                                                render={({ field }) => (
                                                    <FormItem className="w-full">
                                                        <FormControl>
                                                            <Input
                                                            className="focus-visible:ring-0"
                                                            placeholder="Enter rate limit in bytes/s"
                                                            readOnly={useCustomCommands}
                                                            {...field}
                                                            />
                                                        </FormControl>
                                                        <Label htmlFor="rate_limit" className="text-xs text-muted-foreground">(Configured: {rateLimit ? `${rateLimit} = ${formatSpeed(rateLimit)}` : 'No'}, Status: {useRateLimit && !useCustomCommands ? 'Enabled' : 'Disabled'}) (Default: 1048576, Range: 1024-104857600)</Label>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <Button
                                                type="submit"
                                                disabled={!watchedRateLimit || Number(watchedRateLimit) === rateLimit || Object.keys(rateLimitFormErrors).length > 0 || !useRateLimit}
                                            >
                                                Save
                                            </Button>
                                        </form>
                                    </Form>
                                </div>
                                <div className="force-internet-protocol">
                                    <h3 className="font-semibold">Force Internet Protocol</h3>
                                    <p className="text-xs text-muted-foreground mb-3">Force use a specific internet protocol (ipv4/ipv6) for all downloads, useful if your network supports only one (some sites may not work)</p>
                                    <div className="flex items-center space-x-2 mb-4">
                                        <Switch
                                        id="use-force-internet-protocol"
                                        checked={useForceInternetProtocol}
                                        onCheckedChange={(checked) => saveSettingsKey('use_force_internet_protocol', checked)}
                                        disabled={useCustomCommands}
                                        />
                                        <Label htmlFor="use-force-internet-protocol">Force</Label>
                                    </div>
                                    <RadioGroup
                                    orientation="horizontal"
                                    className="flex items-center gap-4 mb-2"
                                    value={forceInternetProtocol}
                                    onValueChange={(value) => saveSettingsKey('force_internet_protocol', value)}
                                    disabled={!useForceInternetProtocol || useCustomCommands}
                                    >
                                        <div className="flex items-center gap-3">
                                            <RadioGroupItem value="ipv4" id="force-ipv4" />
                                            <Label htmlFor="force-ipv4">Use IPv4 Only</Label>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <RadioGroupItem value="ipv6" id="force-ipv6" />
                                            <Label htmlFor="force-ipv6">Use IPv6 Only</Label>
                                        </div>
                                    </RadioGroup>
                                    <Label className="text-xs text-muted-foreground">(Forced: {forceInternetProtocol === "ipv4" ? 'IPv4' : 'IPv6'}, Status: {useForceInternetProtocol && !useCustomCommands ? 'Enabled' : 'Disabled'})</Label>
                                </div>
                            </TabsContent>
                            <TabsContent key="cookies" value="cookies" className="flex flex-col gap-4 min-h-[350px]">
                                <div className="cookies">
                                    <h3 className="font-semibold">Cookies</h3>
                                    <p className="text-xs text-muted-foreground mb-3">Use cookies to access exclusive/private (login-protected) contents from sites (use wisely, over-use can even block/ban your account)</p>
                                    <div className="flex items-center space-x-2 mb-4">
                                        <Switch
                                        id="use-cookies"
                                        checked={useCookies}
                                        onCheckedChange={(checked) => saveSettingsKey('use_cookies', checked)}
                                        disabled={useCustomCommands}
                                        />
                                        <Label htmlFor="use-cookies">Use Cookies</Label>
                                    </div>
                                    <RadioGroup
                                    orientation="horizontal"
                                    className="flex items-center gap-4"
                                    value={importCookiesFrom}
                                    onValueChange={(value) => saveSettingsKey('import_cookies_from', value)}
                                    disabled={!useCookies || useCustomCommands}
                                    >
                                        <div className="flex items-center gap-3">
                                            <RadioGroupItem value="browser" id="cookies-browser" />
                                            <Label htmlFor="cookies-browser">Import from Browser</Label>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <RadioGroupItem value="file" id="cookies-file" />
                                            <Label htmlFor="cookies-file">Import from Text File</Label>
                                        </div>
                                    </RadioGroup>
                                    <div className="flex flex-col gap-2 mt-5 mb-2">
                                        <Label className="text-xs">Import Cookies from Browser</Label>
                                        <Select
                                        value={cookiesBrowser}
                                        onValueChange={(value) => saveSettingsKey('cookies_browser', value)}
                                        disabled={importCookiesFrom !== "browser" || !useCookies || useCustomCommands}
                                        >
                                            <SelectTrigger className="w-[230px] ring-0 focus:ring-0">
                                                <SelectValue placeholder="Select browser to import cookies" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectGroup>
                                                    <SelectLabel>Browsers</SelectLabel>
                                                    <SelectItem value="firefox">Firefox (Recommended)</SelectItem>
                                                    <SelectItem value="chrome">Chrome</SelectItem>
                                                    <SelectItem value="chromium">Chromium</SelectItem>
                                                    <SelectItem value="safari">Safari</SelectItem>
                                                    <SelectItem value="brave">Brave</SelectItem>
                                                    <SelectItem value="edge">Edge</SelectItem>
                                                    <SelectItem value="opera">Opera</SelectItem>
                                                    <SelectItem value="vivaldi">Vivaldi</SelectItem>
                                                    <SelectItem value="whale">Whale</SelectItem>
                                                </SelectGroup>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex flex-col gap-2 mt-3 mb-2">
                                        <Label className="text-xs">Import Cookies from Text File (Netscape format)</Label>
                                        <div className="flex items-center gap-4">
                                            <Input className="focus-visible:ring-0" type="text" placeholder="Select cookies text file" value={cookiesFile ?? ''} disabled={importCookiesFrom !== "file" || !useCookies} readOnly/>
                                            <Button
                                            variant="outline"
                                            disabled={importCookiesFrom !== "file" || !useCookies || useCustomCommands}
                                            onClick={async () => {
                                                try {
                                                    const file = await open({
                                                        multiple: false,
                                                        directory: false,
                                                        filters: [
                                                            { name: 'Text', extensions: ['txt'] },
                                                        ],
                                                    });
                                                    if (file && typeof file === 'string') {
                                                        saveSettingsKey('cookies_file', file);
                                                    }
                                                } catch (error) {
                                                    console.error("Error selecting file:", error);
                                                    toast.error("Failed to select file", {
                                                        description: "An error occurred while trying to select the cookies text file. Please try again.",
                                                    });
                                                }
                                            }}
                                            >
                                                <FolderOpen className="w-4 h-4" /> Browse
                                            </Button>
                                        </div>
                                    </div>
                                    <Label className="text-xs text-muted-foreground">(Configured: {importCookiesFrom === "browser" ? 'Yes' : cookiesFile ? 'Yes' : 'No'}, From: {importCookiesFrom === "browser" ? 'Browser' : 'Text'}, Status: {useCookies && !useCustomCommands ? 'Enabled' : 'Disabled'})</Label>
                                </div>
                            </TabsContent>
                            <TabsContent key="sponsorblock" value="sponsorblock" className="flex flex-col gap-4 min-h-[350px]">
                                <div className="sponsorblock">
                                    <h3 className="font-semibold">Sponsor Block</h3>
                                    <p className="text-xs text-muted-foreground mb-3">Use sponsorblock to remove/mark unwanted segments in videos (sponsorships, intros, outros, etc.)</p>
                                    <div className="flex items-center space-x-2 mb-4">
                                        <Switch
                                        id="use-sponsorblock"
                                        checked={useSponsorblock}
                                        onCheckedChange={(checked) => saveSettingsKey('use_sponsorblock', checked)}
                                        disabled={useCustomCommands}
                                        />
                                        <Label htmlFor="use-sponsorblock">Use Sponsorblock</Label>
                                    </div>
                                    <RadioGroup
                                    orientation="horizontal"
                                    className="flex items-center gap-4"
                                    value={sponsorblockMode}
                                    onValueChange={(value) => saveSettingsKey('sponsorblock_mode', value)}
                                    disabled={!useSponsorblock || useCustomCommands}
                                    >
                                        <div className="flex items-center gap-3">
                                            <RadioGroupItem value="remove" id="sponsorblock-remove" />
                                            <Label htmlFor="sponsorblock-remove">Remove Segments</Label>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <RadioGroupItem value="mark" id="sponsorblock-mark" />
                                            <Label htmlFor="sponsorblock-mark">Mark Segments</Label>
                                        </div>
                                    </RadioGroup>
                                    <div className="flex flex-col gap-2 mt-5">
                                        <Label className="text-xs mb-1">Sponsorblock Remove Categories</Label>
                                        <RadioGroup
                                        orientation="horizontal"
                                        className="flex items-center gap-4"
                                        value={sponsorblockRemove}
                                        onValueChange={(value) => saveSettingsKey('sponsorblock_remove', value)}
                                        disabled={!useSponsorblock || sponsorblockMode !== "remove" || useCustomCommands}
                                        >
                                            <div className="flex items-center gap-3">
                                                <RadioGroupItem value="default" id="sponsorblock-remove-default" />
                                                <Label htmlFor="sponsorblock-remove-default">Default</Label>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <RadioGroupItem value="all" id="sponsorblock-remove-all" />
                                                <Label htmlFor="sponsorblock-remove-all">All</Label>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <RadioGroupItem value="custom" id="sponsorblock-remove-custom" />
                                                <Label htmlFor="sponsorblock-remove-custom">Custom</Label>
                                            </div>
                                        </RadioGroup>
                                        <ToggleGroup
                                        type="multiple"
                                        variant="outline"
                                        className="flex flex-col items-start gap-2 mt-1"
                                        value={sponsorblockRemove === "custom" ? sponsorblockRemoveCategories : sponsorblockRemove === "default" ? sponsorblockCategories.filter((cat) => cat.code !== 'poi_highlight' && cat.code !== 'filler').map((cat) => cat.code) : sponsorblockRemove === "all" ? sponsorblockCategories.filter((cat) => cat.code !== 'poi_highlight').map((cat) => cat.code) : []}
                                        onValueChange={(value) => saveSettingsKey('sponsorblock_remove_categories', value)}
                                        disabled={!useSponsorblock || sponsorblockMode !== "remove" || sponsorblockRemove !== "custom" || useCustomCommands}
                                        >
                                            <div className="flex gap-2 flex-wrap items-center">
                                                {sponsorblockCategories.map((category) => (
                                                    category.code !== "poi_highlight" && (
                                                        <ToggleGroupItem
                                                        className="text-xs text-nowrap border-2 data-[state=on]:border-2 data-[state=on]:border-primary data-[state=on]:bg-muted/70 hover:bg-muted/70"
                                                        value={category.code}
                                                        size="sm"
                                                        aria-label={category.label}
                                                        key={category.code}
                                                        >
                                                            {category.label}
                                                        </ToggleGroupItem>
                                                    )
                                                ))}
                                            </div>
                                        </ToggleGroup>
                                    </div>
                                    <div className="flex flex-col gap-2 mt-4">
                                        <Label className="text-xs mb-1">Sponsorblock Mark Categories</Label>
                                        <RadioGroup
                                        orientation="horizontal"
                                        className="flex items-center gap-4"
                                        value={sponsorblockMark}
                                        onValueChange={(value) => saveSettingsKey('sponsorblock_mark', value)}
                                        disabled={!useSponsorblock || sponsorblockMode !== "mark" || useCustomCommands}
                                        >
                                            <div className="flex items-center gap-3">
                                                <RadioGroupItem value="default" id="sponsorblock-mark-default" />
                                                <Label htmlFor="sponsorblock-mark-default">Default</Label>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <RadioGroupItem value="all" id="sponsorblock-mark-all" />
                                                <Label htmlFor="sponsorblock-mark-all">All</Label>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <RadioGroupItem value="custom" id="sponsorblock-mark-custom" />
                                                <Label htmlFor="sponsorblock-mark-custom">Custom</Label>
                                            </div>
                                        </RadioGroup>
                                        <ToggleGroup
                                        type="multiple"
                                        variant="outline"
                                        className="flex flex-col items-start gap-2 mt-1 mb-2"
                                        value={sponsorblockMark === "custom" ? sponsorblockMarkCategories : sponsorblockMark === "default" ? sponsorblockCategories.map((cat) => cat.code) : sponsorblockMark === "all" ? sponsorblockCategories.map((cat) => cat.code) : []}
                                        onValueChange={(value) => saveSettingsKey('sponsorblock_mark_categories', value)}
                                        disabled={!useSponsorblock || sponsorblockMode !== "mark" || sponsorblockMark !== "custom" || useCustomCommands}
                                        >
                                            <div className="flex gap-2 flex-wrap items-center">
                                                {sponsorblockCategories.map((category) => (
                                                    <ToggleGroupItem
                                                    className="text-xs text-nowrap border-2 data-[state=on]:border-2 data-[state=on]:border-primary data-[state=on]:bg-muted/70 hover:bg-muted/70"
                                                    value={category.code}
                                                    size="sm"
                                                    aria-label={category.label}
                                                    key={category.code}
                                                    >
                                                        {category.label}
                                                    </ToggleGroupItem>
                                                ))}
                                            </div>
                                        </ToggleGroup>
                                    </div>
                                    <Label className="text-xs text-muted-foreground">(Configured: {sponsorblockMode === "remove" && sponsorblockRemove === "custom" && sponsorblockRemoveCategories.length <= 0 ? 'No' : sponsorblockMode === "mark" && sponsorblockMark === "custom" && sponsorblockMarkCategories.length <= 0 ? 'No' : 'Yes'}, Mode: {sponsorblockMode === "remove" ? 'Remove' : 'Mark'}, Status: {useSponsorblock && !useCustomCommands ? 'Enabled' : 'Disabled'})</Label>
                                </div>
                            </TabsContent>
                            <TabsContent key="commands" value="commands" className="flex flex-col gap-4 min-h-[350px]">
                                <div className="custom-commands">
                                    <h3 className="font-semibold">Custom Commands</h3>
                                    <p className="text-xs text-muted-foreground mb-3"> Run custom yt-dlp commands for your downloads</p>
                                    <Alert className="mb-3">
                                        <TriangleAlert />
                                        <AlertTitle className="text-sm">Most Settings will be Disabled!</AlertTitle>
                                        <AlertDescription className="text-xs">
                                            This feature is intended for advanced users only. Turning it on will disable most other settings in the app. Make sure you know what you are doing before using this feature, otherwise things could break easily.
                                        </AlertDescription>
                                    </Alert>
                                    <div className="flex items-center space-x-2 mb-4">
                                        <Switch
                                        id="use-custom-commands"
                                        checked={useCustomCommands}
                                        onCheckedChange={(checked) => {
                                            saveSettingsKey('use_custom_commands', checked)
                                            resetDownloadConfiguration();
                                        }}
                                        />
                                        <Label htmlFor="use-custom-commands">Use Custom Commands</Label>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <Form {...addCustomCommandForm}>
                                            <form onSubmit={addCustomCommandForm.handleSubmit(handleAddCustomCommandSubmit)} className="flex flex-col gap-3" autoComplete="off">
                                                <FormField
                                                    control={addCustomCommandForm.control}
                                                    name="args"
                                                    disabled={!useCustomCommands}
                                                    render={({ field }) => (
                                                        <FormItem className="w-full">
                                                            <FormControl>
                                                                <Textarea
                                                                className="focus-visible:ring-0"
                                                                placeholder="Enter yt-dlp command line arguments (no need to start with 'yt-dlp', already passed args: url, output paths, selected formats, selected subtitles, playlist item. also, bulk downloading is not supported)"
                                                                {...field}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <div className="flex gap-4 w-full">
                                                    <FormField
                                                        control={addCustomCommandForm.control}
                                                        name="label"
                                                        disabled={!useCustomCommands}
                                                        render={({ field }) => (
                                                            <FormItem className="w-full">
                                                                <FormControl>
                                                                    <Input
                                                                    className="focus-visible:ring-0"
                                                                    placeholder="Enter template label"
                                                                    {...field}
                                                                    />
                                                                </FormControl>
                                                                {/* <Label htmlFor="label" className="text-xs text-muted-foreground">(Configured: {rateLimit ? `${rateLimit} = ${formatSpeed(rateLimit)}` : 'No'}, Status: {useRateLimit ? 'Enabled' : 'Disabled'}) (Default: 1048576, Range: 1024-104857600)</Label> */}
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <Button
                                                        type="submit"
                                                        disabled={!watchedLabel || !watchedArgs || Object.keys(addCustomCommandFormErrors).length > 0 || !useCustomCommands}
                                                    >
                                                        Add
                                                    </Button>
                                                </div>
                                            </form>
                                        </Form>
                                    </div>
                                    <div className="flex-flex-col gap-2 mt-4">
                                        <Label className="text-xs mb-3">Custom Command Templates</Label>
                                        {customCommands.length === 0 ? (
                                            <p className="text-sm text-muted-foreground">NO CUSTOM COMMAND TEMPLATE ADDED YET!</p>
                                        ) : (
                                            <div className="flex flex-col gap-3 w-full">
                                                {customCommands.map((command) => (
                                                    <div key={command.id} className="p-2 flex justify-between gap-2 border border-border rounded-md">
                                                        <div className="flex flex-col">
                                                            <h5 className="text-sm mb-1">{command.label}</h5>
                                                            <p className="text-xs font-mono text-muted-foreground">{command.args}</p>
                                                        </div>
                                                        <div className="flex">
                                                            <Button
                                                            variant="destructive"
                                                            size="icon"
                                                            disabled={!useCustomCommands}
                                                            onClick={() => {
                                                                handleRemoveCustomCommandSubmit(command.id);
                                                            }}
                                                            >
                                                                <Trash className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
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
                                    <div className="text-xs flex items-center">
                                        {isChangingWebSocketPort || isRestartingWebSocketServer ? (
                                            <><div className="h-1.5 w-1.5 rounded-full bg-amber-600 dark:bg-amber-500 mr-1.5 mt-0.5" /><span className="text-amber-600 dark:text-amber-500">Restarting...</span></>
                                        ) : (
                                            <><div className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-500 mr-1.5 mt-0.5" /><span className="text-emerald-600 dark:text-emerald-500">Running</span></>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-4 items-center">
                                <Button
                                onClick={async () => {
                                    setIsRestartingWebSocketServer(true);
                                    try {
                                        await invoke("restart_websocket_server");
                                        toast.success("Websocket server restarted", {
                                            description: "Websocket server restarted successfully.",
                                        });
                                    } catch (error) {
                                        console.error("Error restarting websocket server:", error);
                                        toast.error("Failed to restart websocket server", {
                                            description: "An error occurred while trying to restart the websocket server. Please try again.",
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
                    className="w-full flex flex-row items-start gap-4 mt-7"
                    orientation="vertical"
                    value={activeSubExtTab}
                    onValueChange={setActiveSubExtTab}
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
                                    <p className="text-xs text-muted-foreground mb-2">* These links opens with coresponding browsers only. Make sure the browser is installed before clicking the link</p>
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
