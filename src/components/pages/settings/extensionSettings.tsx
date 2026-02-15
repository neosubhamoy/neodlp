import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSettingsPageStatesStore } from "@/services/store";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowRight, EthernetPort, Loader2, Radio, RotateCw } from "lucide-react";
import { useSettings } from "@/helpers/use-settings";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod"
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { invoke } from "@tauri-apps/api/core";
import { SlidingButton } from "@/components/custom/slidingButton";
import clsx from "clsx";
import { NumberInput } from "@/components/custom/numberInput";

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
});

function ExtInstallSettings() {
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

    return (
        <div className="install-neodlp-extension">
            <h3 className="font-semibold">NeoDLP Extension</h3>
            <p className="text-xs text-muted-foreground mb-4">Integrate NeoDLP with your favourite browser</p>
            <div className="flex items-center gap-4 mb-4">
                <SlidingButton
                    slidingContent={
                        <div className="flex items-center justify-center gap-2 text-primary-foreground">
                            <ArrowRight className="size-4" />
                            <span>Get Now</span>
                        </div>
                    }
                    onClick={() => openLink('https://chromewebstore.google.com/detail/neo-downloader-plus/mehopeailfjmiloiiohgicphlcgpompf', 'chrome')}
                    >
                    <span className="font-semibold flex items-center gap-2">
                        <svg className="size-4 fill-primary-foreground" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
                            <path d="M0 256C0 209.4 12.5 165.6 34.3 127.1L144.1 318.3C166 357.5 207.9 384 256 384C270.3 384 283.1 381.7 296.8 377.4L220.5 509.6C95.9 492.3 0 385.3 0 256zM365.1 321.6C377.4 302.4 384 279.1 384 256C384 217.8 367.2 183.5 340.7 160H493.4C505.4 189.6 512 222.1 512 256C512 397.4 397.4 511.1 256 512L365.1 321.6zM477.8 128H256C193.1 128 142.3 172.1 130.5 230.7L54.2 98.5C101 38.5 174 0 256 0C350.8 0 433.5 51.5 477.8 128V128zM168 256C168 207.4 207.4 168 256 168C304.6 168 344 207.4 344 256C344 304.6 304.6 344 256 344C207.4 344 168 304.6 168 256z"/>
                        </svg>
                        Get Chrome Extension
                    </span>
                    <span className="text-xs">from Chrome Web Store</span>
                </SlidingButton>
                <SlidingButton
                    slidingContent={
                        <div className="flex items-center justify-center gap-2 text-primary-foreground">
                            <ArrowRight className="size-4" />
                            <span>Get Now</span>
                        </div>
                    }
                    onClick={() => openLink('https://addons.mozilla.org/en-US/firefox/addon/neo-downloader-plus', 'firefox')}
                    >
                    <span className="font-semibold flex items-center gap-2">
                        <svg className="size-4 fill-primary-foreground" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
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
                <Button variant="outline" onClick={() => openLink('https://chromewebstore.google.com/detail/neo-downloader-plus/mehopeailfjmiloiiohgicphlcgpompf', 'vivaldi')}>Vivaldi</Button>
                <Button variant="outline" onClick={() => openLink('https://addons.mozilla.org/en-US/firefox/addon/neo-downloader-plus', 'zen')}>Zen</Button>
            </div>
            <p className="text-xs text-muted-foreground mb-2">* These links opens with coresponding browsers only. Make sure the browser is installed before clicking the link</p>
        </div>
    );
}

function ExtPortSettings() {
    const formResetTrigger = useSettingsPageStatesStore(state => state.formResetTrigger);
    const acknowledgeFormReset = useSettingsPageStatesStore(state => state.acknowledgeFormReset);

    const websocketPort = useSettingsPageStatesStore(state => state.settings.websocket_port);
    const isChangingWebSocketPort = useSettingsPageStatesStore(state => state.isChangingWebSocketPort);
    const setIsChangingWebSocketPort = useSettingsPageStatesStore(state => state.setIsChangingWebSocketPort);
    const isRestartingWebSocketServer = useSettingsPageStatesStore(state => state.isRestartingWebSocketServer);

    const { saveSettingsKey } = useSettings();

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
        if (formResetTrigger > 0) {
            websocketPortForm.reset();
            acknowledgeFormReset();
        }
    }, [formResetTrigger]);

    return (
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
                                        <NumberInput
                                        className="w-full"
                                        placeholder="Enter port number"
                                        min={0}
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
    );
}

export function ExtensionSettings() {
    const activeSubExtTab = useSettingsPageStatesStore(state => state.activeSubExtTab);
    const setActiveSubExtTab = useSettingsPageStatesStore(state => state.setActiveSubExtTab);

    const isChangingWebSocketPort = useSettingsPageStatesStore(state => state.isChangingWebSocketPort);
    const isRestartingWebSocketServer = useSettingsPageStatesStore(state => state.isRestartingWebSocketServer);
    const setIsRestartingWebSocketServer = useSettingsPageStatesStore(state => state.setIsRestartingWebSocketServer);

    const tabsList = [
        { key: "install", label: "Install", icon: ArrowDownToLine, component: <ExtInstallSettings /> },
        { key: "port", label: "Port", icon: EthernetPort, component: <ExtPortSettings /> },
    ];

    return (
        <>
        <Card className="p-4 space-y-4 my-4">
            <div className="w-full flex gap-4 items-center justify-between">
                <div className="flex gap-4 items-center">
                    <div className="imgwrapper w-10 h-10 flex items-center justify-center bg-linear-65 from-[#FF43D0] to-[#4444FF] customscheme:from-chart-1 customscheme:to-chart-5 rounded-md overflow-hidden border border-border">
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
                    <TabsContent key={tab.key} value={tab.key} className={clsx("flex flex-col gap-4 min-h-37.5", tab.key === "install" ? "max-w-[90%]" : "max-w-[70%]")}>
                        {tab.component}
                    </TabsContent>
                ))}
            </div>
        </Tabs>
        </>
    );
}
