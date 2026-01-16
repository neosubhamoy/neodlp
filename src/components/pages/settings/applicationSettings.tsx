import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBasePathsStore, useDownloaderPageStatesStore, useDownloadStatesStore, useSettingsPageStatesStore } from "@/services/store";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { BadgeCheck, BellRing, BrushCleaning, Bug, Cookie, ExternalLink, FilePen, FileVideo, Folder, FolderOpen, Github, Globe, Heart, Info, Loader2, LucideIcon, Mail, Monitor, Moon, Package, Scale, ShieldMinus, SquareTerminal, Sun, Terminal, Trash, TriangleAlert, WandSparkles, Wifi, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { open } from '@tauri-apps/plugin-dialog';
import { useSettings } from "@/helpers/use-settings";
import { useYtDlpUpdater } from "@/helpers/use-ytdlp-updater";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import * as fs from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { formatSpeed, generateID } from "@/utils";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification';
import { NeoDlpLogo } from "@/components/icons/neodlp";
import clsx from "clsx";
import { Badge } from "@/components/ui/badge";
import { config } from "@/config";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import neosubhamoyImage from "@/assets/images/neosubhamoy.jpg";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

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

function AppGeneralSettings() {
    const { saveSettingsKey } = useSettings();

    const maxParallelDownloads = useSettingsPageStatesStore(state => state.settings.max_parallel_downloads);
    const maxRetries = useSettingsPageStatesStore(state => state.settings.max_retries);
    const preferVideoOverPlaylist = useSettingsPageStatesStore(state => state.settings.prefer_video_over_playlist);
    const strictDownloadabilityCheck = useSettingsPageStatesStore(state => state.settings.strict_downloadablity_check);
    const useAria2 = useSettingsPageStatesStore(state => state.settings.use_aria2);
    const useCustomCommands = useSettingsPageStatesStore(state => state.settings.use_custom_commands);

    return (
        <>
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
        </>
    );
}

function AppAppearanceSettings() {
    const { saveSettingsKey } = useSettings();

    const appTheme = useSettingsPageStatesStore(state => state.settings.theme);
    const appColorScheme = useSettingsPageStatesStore(state => state.settings.color_scheme);

    const themeOptions: { value: string; icon: LucideIcon; label: string }[] = [
        { value: 'light', icon: Sun, label: 'Light' },
        { value: 'dark', icon: Moon, label: 'Dark' },
        { value: 'system', icon: Monitor, label: 'System' },
    ];

    const colorSchemeOptions: { value: string; label: string }[] = [
        { value: 'default', label: 'Default' },
        { value: 'blue', label: 'Blue' },
        { value: 'green', label: 'Green' },
        { value: 'orange', label: 'Orange' },
        { value: 'red', label: 'Red' },
        { value: 'rose', label: 'Rose' },
        { value: 'violet', label: 'Violet' },
        { value: 'yellow', label: 'Yellow' },
    ];

    return (
        <>
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
        <div className="app-color-scheme">
            <h3 className="font-semibold">Color Scheme</h3>
            <p className="text-xs text-muted-foreground mb-3">Choose app interface color scheme</p>
            <ToggleGroup
            type="single"
            variant="outline"
            className="flex flex-col items-start gap-2 mt-1"
            value={appColorScheme}
            onValueChange={(value) => saveSettingsKey('color_scheme', value)}
            >
                <div className="flex gap-2 flex-wrap items-center">
                    {colorSchemeOptions.map(({ value, label }) => (
                        <ToggleGroupItem
                            key={value}
                            className="text-xs text-nowrap border-2 data-[state=on]:border-2 data-[state=on]:border-primary data-[state=on]:bg-primary/10 hover:bg-muted/70"
                            size="sm"
                            value={value}
                        >
                            <span className="relative flex gap-1 items-center">
                            {
                                <span
                                    className={cn(
                                        'inline-block w-3 h-3 rounded-full border border-border',
                                        value === 'default' && 'bg-neutral-900 dark:bg-neutral-100',
                                        value === 'blue' && 'bg-blue-500',
                                        value === 'green' && 'bg-green-500',
                                        value === 'orange' && 'bg-orange-500',
                                        value === 'red' && 'bg-red-500',
                                        value === 'rose' && 'bg-rose-500',
                                        value === 'violet' && 'bg-violet-500',
                                        value === 'yellow' && 'bg-yellow-500',
                                    )}
                                />
                            }
                            {label}
                            </span>
                        </ToggleGroupItem>
                    ))}
                </div>
            </ToggleGroup>
        </div>
        </>
    );
}

function AppFolderSettings() {
    const { saveSettingsKey } = useSettings();

    const formResetTrigger = useSettingsPageStatesStore(state => state.formResetTrigger);
    const acknowledgeFormReset = useSettingsPageStatesStore(state => state.acknowledgeFormReset);

    const downloadDirPath = useBasePathsStore((state) => state.downloadDirPath);
    const tempDownloadDirPath = useBasePathsStore((state) => state.tempDownloadDirPath);
    const setPath = useBasePathsStore((state) => state.setPath);

    const filenameTemplate = useSettingsPageStatesStore(state => state.settings.filename_template);

    const downloadStates = useDownloadStatesStore(state => state.downloadStates);
    const ongoingDownloads = downloadStates.filter(state =>
        ['starting', 'downloading', 'queued'].includes(state.download_status)
    );

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

    useEffect(() => {
        if (formResetTrigger > 0) {
            filenameTemplateForm.reset();
            acknowledgeFormReset();
        }
    }, [formResetTrigger]);

    return (
        <>
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
            <p className="text-xs text-muted-foreground mb-3">Set the template for naming downloaded files (download id, file extension and playlist index will be auto-appended, changing template may cause paused downloads to re-start from begining)</p>
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
        </>
    );
}

function AppFormatSettings() {
    const { saveSettingsKey } = useSettings();

    const videoFormat = useSettingsPageStatesStore(state => state.settings.video_format);
    const audioFormat = useSettingsPageStatesStore(state => state.settings.audio_format);
    const alwaysReencodeVideo = useSettingsPageStatesStore(state => state.settings.always_reencode_video);
    const useCustomCommands = useSettingsPageStatesStore(state => state.settings.use_custom_commands);

    return (
        <>
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
        </>
    );
}

function AppEmbeddingSettings() {
    const { saveSettingsKey } = useSettings();

    const embedVideoMetadata = useSettingsPageStatesStore(state => state.settings.embed_video_metadata);
    const embedAudioMetadata = useSettingsPageStatesStore(state => state.settings.embed_audio_metadata);
    const embedVideoThumbnail = useSettingsPageStatesStore(state => state.settings.embed_video_thumbnail);
    const embedAudioThumbnail = useSettingsPageStatesStore(state => state.settings.embed_audio_thumbnail);
    const useCustomCommands = useSettingsPageStatesStore(state => state.settings.use_custom_commands);

    return (
        <>
        <div className="embed-metadata">
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
        <div className="embed-thumbnail">
            <h3 className="font-semibold">Embed Thumbnail</h3>
            <p className="text-xs text-muted-foreground mb-3">Wheather to embed thumbnail in video/audio files (as cover art)</p>
            <div className="flex items-center space-x-2 mb-3">
                <Switch
                id="embed-video-thumbnail"
                checked={embedVideoThumbnail}
                onCheckedChange={(checked) => saveSettingsKey('embed_video_thumbnail', checked)}
                disabled={useCustomCommands}
                />
                <Label htmlFor="embed-video-thumbnail">Video</Label>
            </div>
            <div className="flex items-center space-x-2">
                <Switch
                id="embed-audio-thumbnail"
                checked={embedAudioThumbnail}
                onCheckedChange={(checked) => saveSettingsKey('embed_audio_thumbnail', checked)}
                disabled={useCustomCommands}
                />
                <Label htmlFor="embed-audio-thumbnail">Audio</Label>
            </div>
        </div>
        </>
    );
}

function AppNetworkSettings() {
    const { saveSettingsKey } = useSettings();

    const formResetTrigger = useSettingsPageStatesStore(state => state.formResetTrigger);
    const acknowledgeFormReset = useSettingsPageStatesStore(state => state.acknowledgeFormReset);

    const useProxy = useSettingsPageStatesStore(state => state.settings.use_proxy);
    const proxyUrl = useSettingsPageStatesStore(state => state.settings.proxy_url);
    const useRateLimit = useSettingsPageStatesStore(state => state.settings.use_rate_limit);
    const rateLimit = useSettingsPageStatesStore(state => state.settings.rate_limit);
    const useForceInternetProtocol = useSettingsPageStatesStore(state => state.settings.use_force_internet_protocol);
    const forceInternetProtocol = useSettingsPageStatesStore(state => state.settings.force_internet_protocol);
    const useCustomCommands = useSettingsPageStatesStore(state => state.settings.use_custom_commands);

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

    useEffect(() => {
        if (formResetTrigger > 0) {
            proxyUrlForm.reset();
            rateLimitForm.reset();
            acknowledgeFormReset();
        }
    }, [formResetTrigger]);

    return (
        <>
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
                <Label htmlFor="use-force-internet-protocol">Force IPV</Label>
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
        </>
    );
}

function AppCookiesSettings() {
    const { saveSettingsKey } = useSettings();

    const useCookies = useSettingsPageStatesStore(state => state.settings.use_cookies);
    const importCookiesFrom = useSettingsPageStatesStore(state => state.settings.import_cookies_from);
    const cookiesBrowser = useSettingsPageStatesStore(state => state.settings.cookies_browser);
    const cookiesFile = useSettingsPageStatesStore(state => state.settings.cookies_file);
    const useCustomCommands = useSettingsPageStatesStore(state => state.settings.use_custom_commands);

    return (
        <>
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
        </>
    );
}

function AppSponsorblockSettings() {
    const { saveSettingsKey } = useSettings();

    const useSponsorblock = useSettingsPageStatesStore(state => state.settings.use_sponsorblock);
    const sponsorblockMode = useSettingsPageStatesStore(state => state.settings.sponsorblock_mode);
    const sponsorblockRemove = useSettingsPageStatesStore(state => state.settings.sponsorblock_remove);
    const sponsorblockMark = useSettingsPageStatesStore(state => state.settings.sponsorblock_mark);
    const sponsorblockRemoveCategories = useSettingsPageStatesStore(state => state.settings.sponsorblock_remove_categories);
    const sponsorblockMarkCategories = useSettingsPageStatesStore(state => state.settings.sponsorblock_mark_categories);
    const useCustomCommands = useSettingsPageStatesStore(state => state.settings.use_custom_commands);

    const sponsorblockCategories: { code: string; label: string }[] = [
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
        { code: 'hook', label: 'Hook' },
    ];

    return (
        <>
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
                disabled={/*!useSponsorblock || sponsorblockMode !== "remove" ||*/ useCustomCommands}
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
                disabled={/*!useSponsorblock || sponsorblockMode !== "remove" ||*/ sponsorblockRemove !== "custom" || useCustomCommands}
                >
                    <div className="flex gap-2 flex-wrap items-center">
                        {sponsorblockCategories.map((category) => (
                            category.code !== "poi_highlight" && (
                                <ToggleGroupItem
                                className="text-xs text-nowrap border-2 data-[state=on]:border-2 data-[state=on]:border-primary data-[state=on]:bg-primary/10 hover:bg-muted/70"
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
                disabled={/*!useSponsorblock || sponsorblockMode !== "mark" ||*/ useCustomCommands}
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
                disabled={/*!useSponsorblock || sponsorblockMode !== "mark" ||*/ sponsorblockMark !== "custom" || useCustomCommands}
                >
                    <div className="flex gap-2 flex-wrap items-center">
                        {sponsorblockCategories.map((category) => (
                            <ToggleGroupItem
                            className="text-xs text-nowrap border-2 data-[state=on]:border-2 data-[state=on]:border-primary data-[state=on]:bg-primary/10 hover:bg-muted/70"
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
        </>
    );
}

function AppNotificationSettings() {
    const { saveSettingsKey } = useSettings();

    const enableNotifications = useSettingsPageStatesStore(state => state.settings.enable_notifications);
    const updateNotification = useSettingsPageStatesStore(state => state.settings.update_notification);
    const downloadCompletionNotification = useSettingsPageStatesStore(state => state.settings.download_completion_notification);

    return (
        <>
        <div className="notifications">
            <h3 className="font-semibold">Desktop Notifications</h3>
            <p className="text-xs text-muted-foreground mb-3">Enable desktop notifications for app events (updates, download completions, etc.)</p>
            <div className="flex items-center space-x-2 mb-4">
                <Switch
                id="enable-notifications"
                checked={enableNotifications}
                onCheckedChange={async (checked) => {
                    if (checked) {
                        const granted = await isPermissionGranted();
                        if (!granted) {
                            const permission = await requestPermission();
                            if (permission !== 'granted') {
                                toast.error("Notification Permission Denied", {
                                    description: "You have denied the notification permission. Please enable it from your system settings to receive notifications.",
                                });
                                return;
                            }
                        }
                    }
                    saveSettingsKey('enable_notifications', checked)
                }}
                />
                <Label htmlFor="enable-notifications">Enable Notifications</Label>
            </div>
            <div className="flex flex-col gap-2 mt-5">
                <Label className="text-xs mb-1">Notification Categories</Label>
                <div className="flex items-center space-x-2 mb-1">
                    <Switch
                    id="update-notification"
                    checked={updateNotification}
                    onCheckedChange={(checked) => saveSettingsKey('update_notification', checked)}
                    disabled={!enableNotifications}
                    />
                    <Label htmlFor="update-notification">App Updates</Label>
                </div>
                <div className="flex items-center space-x-2 mb-1">
                    <Switch
                    id="download-completion-notification"
                    checked={downloadCompletionNotification}
                    onCheckedChange={(checked) => saveSettingsKey('download_completion_notification', checked)}
                    disabled={!enableNotifications}
                    />
                    <Label htmlFor="download-completion-notification">Download Completion</Label>
                </div>
            </div>
        </div>
        </>
    );
}

function AppCommandSettings() {
    const { saveSettingsKey } = useSettings();

    const formResetTrigger = useSettingsPageStatesStore(state => state.formResetTrigger);
    const acknowledgeFormReset = useSettingsPageStatesStore(state => state.acknowledgeFormReset);

    const useCustomCommands = useSettingsPageStatesStore(state => state.settings.use_custom_commands);
    const customCommands = useSettingsPageStatesStore(state => state.settings.custom_commands);

    const setDownloadConfigurationKey = useDownloaderPageStatesStore((state) => state.setDownloadConfigurationKey);
    const resetDownloadConfiguration = useDownloaderPageStatesStore((state) => state.resetDownloadConfiguration);

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

    useEffect(() => {
        if (formResetTrigger > 0) {
            addCustomCommandForm.reset();
            acknowledgeFormReset();
        }
    }, [formResetTrigger]);

    return (
        <>
        <div className="custom-commands">
            <h3 className="font-semibold">Custom Commands</h3>
            <p className="text-xs text-muted-foreground mb-3"> Run custom yt-dlp commands for your downloads</p>
            <Alert className="mb-3">
                <TriangleAlert className="size-4 stroke-primary" />
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
                                        className="focus-visible:ring-0 min-h-26"
                                        placeholder="Enter yt-dlp command line arguments (no need to start with 'yt-dlp', already passed args: url, output paths, selected formats, selected subtitles, playlist items etc.)"
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
                    <div className="flex flex-col gap-3 w-full mt-2">
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
        </>
    );
}

function AppDebugSettings() {
    const { saveSettingsKey } = useSettings();

    const debugMode = useSettingsPageStatesStore(state => state.settings.debug_mode);
    const logVerbose = useSettingsPageStatesStore(state => state.settings.log_verbose);
    const logProgress = useSettingsPageStatesStore(state => state.settings.log_progress);

    return (
        <>
        <div className="debug-mode">
            <h3 className="font-semibold">Debug Mode</h3>
            <p className="text-xs text-muted-foreground mb-3">Enable debug mode for troubleshooting issues (get debug logs, download ids, and more)</p>
            <div className="flex items-center space-x-2 mb-4">
                <Switch
                id="debug-mode"
                checked={debugMode}
                onCheckedChange={(checked) => saveSettingsKey('debug_mode', checked)}
                />
                <Label htmlFor="debug-mode">Enable Debug Mode</Label>
            </div>
            <div className="flex flex-col gap-2 mt-5">
                <Label className="text-xs mb-1">Logging Options</Label>
                <div className="flex items-center space-x-2 mb-1">
                    <Switch
                    id="log-verbose"
                    checked={logVerbose}
                    onCheckedChange={(checked) => saveSettingsKey('log_verbose', checked)}
                    disabled={!debugMode}
                    />
                    <Label htmlFor="log-verbose">Verbose Logging</Label>
                </div>
                <div className="flex items-center space-x-2 mb-1">
                    <Switch
                    id="log-progress"
                    checked={logProgress}
                    onCheckedChange={(checked) => saveSettingsKey('log_progress', checked)}
                    disabled={!debugMode}
                    />
                    <Label htmlFor="log-progress">Log Progress</Label>
                </div>
            </div>
        </div>
        </>
    );
}

function AppInfoSettings() {
    const appVersion = useSettingsPageStatesStore(state => state.appVersion);

    const binDepsList = [
        { key: 'yt-dlp', name: 'YT-DLP', desc: 'The core video/audio downloading engine', url: 'https://github.com/yt-dlp/yt-dlp', license: 'Unlicense', licenseUrl: 'https://github.com/yt-dlp/yt-dlp/blob/master/LICENSE' },
        { key: 'ffmpeg', name: 'FFmpeg', desc: 'Multimedia framework for handling video/audio processing', url: 'https://ffmpeg.org/', license: 'LGPLv2.1+', licenseUrl: 'https://ffmpeg.org/legal.html' },
        { key: 'ffprobe', name: 'FFprobe', desc: 'Multimedia stream analyzer for retrieving media information', url: 'https://ffmpeg.org/ffprobe.html', license: 'LGPLv2.1+', licenseUrl: 'https://ffmpeg.org/legal.html' },
        { key: 'deno', name: 'Deno', desc: 'The modern JavaScript/TypeScript runtime', url: 'https://deno.land/', license: 'MIT', licenseUrl: 'https://github.com/denoland/deno/blob/main/LICENSE.md' },
        { key: 'aria2', name: 'Aria2', desc: 'Lightweight multi-protocol & multi-source download utility', url: 'https://aria2.github.io/', license: 'GPLv2+', licenseUrl: 'https://github.com/aria2/aria2/blob/master/COPYING' },
    ];
    const langDepsList = [
        { key: 'tauri', name: 'Tauri', desc: 'Framework for building cross-platform, tiny and blazing fast binaries', url: 'https://tauri.app/', license: 'MIT, Apache-2.0', licenseUrl: 'https://github.com/tauri-apps/tauri/blob/dev/LICENSE_MIT' },
        { key: 'react', name: 'React', desc: 'The library for web and native user interfaces', url: 'https://reactjs.org/', license: 'MIT', licenseUrl: 'https://github.com/facebook/react/blob/main/LICENSE' },
        { key: 'rust', name: 'Rust', desc: 'A language empowering everyone to build reliable and efficient software', url: 'https://www.rust-lang.org/', license: 'MIT, Apache-2.0', licenseUrl: 'https://github.com/rust-lang/rust/blob/main/LICENSE-APACHE' },
        { key: 'typescript', name: 'TypeScript', desc: 'Typed superset of JavaScript that compiles to plain JavaScript', url: 'https://www.typescriptlang.org/', license: 'Apache-2.0', licenseUrl: 'https://github.com/microsoft/TypeScript/blob/main/LICENSE.txt' },
        { key: 'tailwindcss', name: 'Tailwind CSS', desc: 'A utility-first CSS framework for rapidly building custom designs', url: 'https://tailwindcss.com/', license: 'MIT', licenseUrl: 'https://github.com/tailwindlabs/tailwindcss/blob/main/LICENSE' },
        { key: 'vite', name: 'Vite', desc: 'Next Generation Frontend Tooling', url: 'https://vitejs.dev/', license: 'MIT', licenseUrl: 'https://github.com/vitejs/vite/blob/main/LICENSE' },
        { key: 'sqlite3', name: 'SQLite3', desc: 'A C library that implements a small, fast, self-contained SQL database engine', url: 'https://www.sqlite.org/', license: 'Public', licenseUrl: 'https://www.sqlite.org/copyright.html' },
    ];
    const libDepsList = [
        { key: 'shadcn-ui', name: 'shadcn/ui', desc: 'Beautifully designed components built with Radix UI and Tailwind CSS', url: 'https://ui.shadcn.com/', license: 'MIT', licenseUrl: 'https://github.com/shadcn-ui/ui/blob/main/LICENSE.md' },
        { key: 'lucide-icons', name: 'Lucide Icons', desc: 'A simple and consistent icon system for web applications', url: 'https://lucide.dev/', license: 'ISC', licenseUrl: 'https://github.com/lucide-icons/lucide/blob/main/LICENSE' },
        { key: 'tanstack-react-query', name: 'TanStack React Query', desc: 'Powerful asynchronous state management, server-state utilities and data fetching', url: 'https://tanstack.com/query/latest', license: 'MIT', licenseUrl: 'https://github.com/TanStack/query/blob/main/LICENSE' },
        { key: 'tanstack-react-pacer' , name: 'TanStack React Pacer', desc: 'Framework agnostic debouncing, throttling, rate limiting, queuing, and batching utilities', url: 'https://tanstack.com/pacer/latest', license: 'MIT', licenseUrl: 'https://github.com/TanStack/pacer/blob/main/LICENSE' },
        { key: 'zustand', name: 'Zustand', desc: 'A small, fast and scalable bearbones state-management solution', url: 'https://zustand-demo.pmnd.rs/', license: 'MIT', licenseUrl: 'https://github.com/pmndrs/zustand/blob/main/LICENSE' },
        { key: 'zod', name: 'Zod', desc: 'TypeScript-first schema declaration and validation library', url: 'https://zod.dev/', license: 'MIT', licenseUrl: 'https://github.com/colinhacks/zod/blob/main/LICENSE' },
        { key: 'react-router', name: 'React Router', desc: 'Declarative routing for React applications', url: 'https://reactrouter.com/', license: 'MIT', licenseUrl: 'https://github.com/remix-run/react-router/blob/main/LICENSE.md' },
        { key: 'react-hook-form', name: 'React Hook Form', desc: 'Performant, flexible and extensible forms with easy-to-use validation', url: 'https://react-hook-form.com/', license: 'MIT', licenseUrl: 'https://github.com/react-hook-form/react-hook-form/blob/master/LICENSE' },
        { key: 'sonner', name: 'Sonner', desc: 'A beautiful, simple and customizable notification library for React', url: 'https://sonner.emilkowal.ski/', license: 'MIT', licenseUrl: 'https://github.com/emilkowalski/sonner/blob/main/LICENSE.md' },
        { key: 'tokio', name: 'Tokio', desc: 'An asynchronous runtime for the Rust programming language', url: 'https://tokio.rs/', license: 'MIT', licenseUrl: 'https://github.com/tokio-rs/tokio/blob/master/LICENSE' },
        { key: 'reqwest', name: 'Reqwest', desc: 'An easy and powerful HTTP Client for Rust', url: 'https://crates.io/crates/reqwest', license: 'MIT, Apache-2.0', licenseUrl: 'https://github.com/seanmonstar/reqwest/blob/master/LICENSE-APACHE' },
        { key: 'serde', name: 'Serde', desc: 'A framework for serializing and deserializing Rust data structures', url: 'https://serde.rs/', license: 'MIT, Apache-2.0', licenseUrl: 'https://github.com/serde-rs/serde/blob/master/LICENSE-MIT' },
        { key: 'sqlx', name: 'SQLx', desc: 'An async, pure Rust SQL crate', url: 'https://crates.io/crates/sqlx', license: 'MIT, Apache-2.0', licenseUrl: 'https://github.com/launchbadge/sqlx/blob/main/LICENSE-APACHE' },
        { key: 'directories', name: 'Directories', desc: 'A Rust library for platform-specific standard locations', url: 'https://crates.io/crates/directories', license: 'MIT, Apache-2.0', licenseUrl: 'https://codeberg.org/dirs/directories-rs/src/branch/main/LICENSE-APACHE' },
    ];

    function DependencyItem(dep: { name: string; desc: string; url: string; license: string; licenseUrl: string }) {
        return (
            <div className="p-4 border border-border rounded-md flex items-center justify-between gap-4">
                <div className="flex flex-col">
                    <h4 className="font-semibold flex items-center gap-2">
                        <a href={dep.url} target="_blank" className="hover:underline">
                            {dep.name}
                        </a>
                        <a href={dep.url} target="_blank" title={`${dep.name} homepage`}>
                            <ExternalLink className="size-3 text-muted-foreground hover:text-foreground" />
                        </a>
                    </h4>
                    <p className="text-xs text-muted-foreground">{dep.desc}</p>
                </div>
                <a href={dep.licenseUrl} target="_blank">
                    <Badge className="border-input rounded-full" variant="outline"><span className="mb-0.5">{dep.license}</span></Badge>
                </a>
            </div>
        );
    }

    return (
        <>
        <div className="app-info">
            <Card className="p-4 space-y-4 flex items-center gap-4">
                <div className="flex aspect-square size-18 items-center justify-center rounded-lg m-0">
                    <NeoDlpLogo className="size-full rounded-lg border border-border [--logo-stop-color-1:#4444FF] [--logo-stop-color-2:#FF43D0] customscheme:[--logo-stop-color-1:var(--color-chart-5)] customscheme:[--logo-stop-color-2:var(--color-chart-1)]" />
                </div>
                <div className="flex flex-col justify-center gap-1">
                  <span className="truncate font-semibold">{config.appName} <Badge className="ml-1 border-primary px-1.5" variant="outline"><span className="mb-0.5">v{appVersion}</span></Badge></span>
                  <span className="truncate text-xs text-muted-foreground">The Next-Gen Truly Cross-Platform Video/Audio Downloader</span>
                  <span className="flex items-center gap-2">
                    <a href={config.appHomepage} target="_blank" className="text-sm text-foreground" title="Homepage">
                        <Globe className="size-3.5" />
                    </a>
                    <a href={'https://github.com/' + config.appRepo} target="_blank" className="text-sm text-foreground" title="GitHub">
                        <Github className="size-3.5" />
                    </a>
                    <p className="text-muted-foreground">•</p>
                    <a href={config.appHomepage + '/privacy-policy'} target="_blank" className="text-xs hover:underline">Privacy Policy</a>
                    <p className="text-muted-foreground">•</p>
                    <a href={config.appHomepage + '/terms-of-use'} target="_blank" className="text-xs hover:underline">Terms of Use</a>
                  </span>
                </div>
            </Card>
        </div>
        <div className="about-developer">
            <h3 className="font-semibold">Developer</h3>
            <p className="text-xs text-muted-foreground mb-3">Meet the Creator & Lead-Developer of NeoDLP</p>
            <Card className="p-4 space-y-4 flex items-center gap-4">
                <div className="relative w-fit m-0">
                    <Avatar className="size-11">
                        <AvatarImage src={neosubhamoyImage} />
                        <AvatarFallback>SB</AvatarFallback>
                    </Avatar>
                    <span className='absolute -bottom-1 -right-1.5'>
                        <span className='sr-only'>Verified</span>
                        <BadgeCheck className='text-background size-5 fill-primary' />
                    </span>
                </div>
                <div className="flex flex-col justify-center gap-1 m-0">
                    <span className="truncate font-semibold">{config.appAuthor}</span>
                    <p className="text-xs text-muted-foreground">Full-Stack Developer</p>
                </div>
                <div className="spacer grow"></div>
                <Button variant="ghost" size="icon" className="p-5 m-0 border border-input" title="Official Website" asChild>
                    <a href={config.appAuthorUrl} target="_blank">
                        <Globe className="size-4" />
                    </a>
                </Button>
                <Button className="py-5" title="Buy Me a Coffee" asChild>
                    <a href={config.appAuthorSponsorUrl} target="_blank">
                        <Heart className="size-4" /> Sponsor
                    </a>
                </Button>
            </Card>
        </div>
        <div className="bug-report">
            <h3 className="font-semibold">Bug Report</h3>
            <p className="text-xs text-muted-foreground mb-3">Noticed any bug or inconsistencies? Report it to help us improve</p>
            <div className="report">
                <span className="flex items-center gap-4 flex-wrap">
                    <Button className="px-4" variant="outline" size="sm" asChild>
                        <a href={'mailto:' + config.appSupportEmail + '?subject=[BUG]%20Title%20Here&body=Describe%20The%20Bug%20Here.%20Follow%20this%20issue%20template%3A%20https%3A%2F%2Fgithub.com%2Fneosubhamoy%2Fneodlp%2Fissues%2Fnew%3Ftemplate%3Dbug_report.md'} target="_blank" >
                            <Mail className="size-4" /> Write Us an Email
                        </a>
                    </Button>
                    <Button className="px-4" size="sm" asChild>
                        <a href={'https://github.com/' + config.appRepo + '/issues/new?template=bug_report.md'} target="_blank" >
                            <Bug className="size-4" /> Create a GitHub Issue
                        </a>
                    </Button>
                </span>
            </div>
        </div>
        <div className="license-and-usage">
            <h3 className="font-semibold">License and Usage</h3>
            <p className="text-xs text-muted-foreground mb-3">License and usage terms of NeoDLP</p>
            <div className="license">
                <p className="text-sm mb-3">NeoDLP is a Fully Open-Source Software Licensed under the MIT license. Anyone can view, modify, use (personal and commercial) or distribute it's sources without any extra permission (Just include the LICENSE file :)</p>
                <p className="text-sm mb-3"><TriangleAlert className="size-4 stroke-primary inline mb-1 mr-0.5" /> DISCLAIMER: NeoDLP facilitates downloading from various Online Platforms with different Policies and Terms of Use which Users must follow. We strictly do not promote any unauthorized downloading of copyrighted content. NeoDLP is only made for downloading content that the user holds the copyright to or has the authority for. Users must use the downloaded content wisely and solely at their own legal responsibility. The developer is not responsible for any action taken by the user, and takes zero direct or indirect liability for that matter.</p>
                <span className="flex items-center gap-4 flex-wrap">
                    <Button className="px-4" variant="outline" size="sm" asChild>
                        <a href={'https://github.com/' + config.appRepo + '/blob/main/LICENSE'} target="_blank" >
                            <Scale className="size-4" /> MIT License
                        </a>
                    </Button>
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                                <Package className="size-4" /> Dependencies
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[600px]">
                            <DialogHeader>
                                <DialogTitle>Dependencies</DialogTitle>
                                <DialogDescription>Major dependencies of NeoDLP</DialogDescription>
                            </DialogHeader>
                            <div className="flex flex-col gap-4 max-h-[45vh] overflow-y-auto">
                                <h4 className="text-sm font-semibold">External Binaries</h4>
                                {binDepsList.map(({key, ...dep}) => (
                                    <DependencyItem key={key} {...dep} />
                                ))}
                                <h4 className="text-sm font-semibold">Languages, Frameworks & Tooling</h4>
                                {langDepsList.map(({key, ...dep}) => (
                                    <DependencyItem key={key} {...dep} />
                                ))}
                                <h4 className="text-sm font-semibold">Notable Libraries</h4>
                                {libDepsList.map(({key, ...dep}) => (
                                    <DependencyItem key={key} {...dep} />
                                ))}
                            </div>
                        </DialogContent>
                    </Dialog>
                    <Button size="sm" className="px-4" asChild>
                        <a href="https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md" target="_blank" >
                            <ExternalLink className="size-4" /> Supported Sites
                        </a>
                    </Button>
                </span>
            </div>
        </div>
        </>
    );
}

export function ApplicationSettings() {
    const activeSubAppTab = useSettingsPageStatesStore(state => state.activeSubAppTab);
    const setActiveSubAppTab = useSettingsPageStatesStore(state => state.setActiveSubAppTab);

    const ytDlpVersion = useSettingsPageStatesStore(state => state.ytDlpVersion);
    const isFetchingYtDlpVersion = useSettingsPageStatesStore(state => state.isFetchingYtDlpVersion);
    const isUpdatingYtDlp = useSettingsPageStatesStore(state => state.isUpdatingYtDlp);
    const ytDlpUpdateChannel = useSettingsPageStatesStore(state => state.settings.ytdlp_update_channel);
    const ytDlpAutoUpdate = useSettingsPageStatesStore(state => state.settings.ytdlp_auto_update);

    const downloadStates = useDownloadStatesStore(state => state.downloadStates);
    const ongoingDownloads = downloadStates.filter(state =>
        ['starting', 'downloading', 'queued'].includes(state.download_status)
    );

    const { saveSettingsKey } = useSettings();
    const { updateYtDlp } = useYtDlpUpdater();

    const tabsList = [
        { key: 'general', label: 'General', icon: Wrench, component: <AppGeneralSettings /> },
        { key: 'appearance', label: 'Appearance', icon: WandSparkles, component: <AppAppearanceSettings /> },
        { key: 'folders', label: 'Folders', icon: Folder, component: <AppFolderSettings /> },
        { key: 'formats', label: 'Formats', icon: FileVideo, component: <AppFormatSettings /> },
        { key: 'embedding', label: 'Embedding', icon: FilePen, component: <AppEmbeddingSettings /> },
        { key: 'network', label: 'Network', icon: Wifi, component: <AppNetworkSettings /> },
        { key: 'cookies', label: 'Cookies', icon: Cookie, component: <AppCookiesSettings /> },
        { key: 'sponsorblock', label: 'Sponsorblock', icon: ShieldMinus, component: <AppSponsorblockSettings /> },
        { key: 'notifications', label: 'Notifications', icon: BellRing, component: <AppNotificationSettings /> },
        { key: 'commands', label: 'Commands', icon: SquareTerminal, component: <AppCommandSettings /> },
        { key: 'debug', label: 'Debug', icon: Bug, component: <AppDebugSettings /> },
        { key: 'info', label: 'Info', icon: Info, component: <AppInfoSettings /> },
    ];

    return (
        <>
        <Card className="p-4 space-y-4 my-4">
            <div className="w-full flex gap-4 items-center justify-between">
                <div className="flex gap-4 items-center">
                    <div className="imgwrapper w-10 h-10 flex items-center justify-center bg-linear-65 from-[#FF43D0] to-[#4444FF] customscheme:from-chart-1 customscheme:to-chart-5 rounded-md overflow-hidden border border-border">
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
                {tabsList.map((tab) => (
                    <TabsTrigger
                    key={tab.key}
                    value={tab.key}
                    className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground justify-start px-3 py-1.5 gap-2"
                    >
                        <tab.icon className="size-4" /> {tab.label}
                    </TabsTrigger>
                ))}
            </TabsList>
            <div className="min-h-full flex flex-col w-full border-l border-border pl-4">
                {tabsList.map((tab) => (
                    <TabsContent key={tab.key} value={tab.key} className={clsx("flex flex-col gap-4 min-h-[435px]", tab.key === "info" ? "max-w-[80%]" : "max-w-[70%]")}>
                        {tab.component}
                    </TabsContent>
                ))}
            </div>
        </Tabs>
        </>
    );
}
