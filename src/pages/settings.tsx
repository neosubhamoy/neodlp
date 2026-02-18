import Heading from "@/components/heading";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSettingsPageStatesStore } from "@/services/store";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { useEffect } from "react";
import { useTheme } from "@/providers/themeProvider";
import { useSettings } from "@/helpers/use-settings";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ExtensionSettings } from "@/components/pages/settings/extensionSettings";
import { ApplicationSettings } from "@/components/pages/settings/applicationSettings";
import usePotServer from "@/helpers/use-pot-server";

export default function SettingsPage() {
    const { setTheme } = useTheme();

    const activeTab = useSettingsPageStatesStore(state => state.activeTab);
    const setActiveTab = useSettingsPageStatesStore(state => state.setActiveTab);

    const isUsingDefaultSettings = useSettingsPageStatesStore(state => state.isUsingDefaultSettings);
    const isRunningPotServer = useSettingsPageStatesStore(state => state.isRunningPotServer);
    const appTheme = useSettingsPageStatesStore(state => state.settings.theme);
    const appColorScheme = useSettingsPageStatesStore(state => state.settings.color_scheme);

    const { resetSettings } = useSettings();
    const { stopPotServer } = usePotServer();

    useEffect(() => {
        const updateTheme = async () => {
            setTheme(appTheme, appColorScheme);
        }
        updateTheme().catch(console.error);
    }, [appTheme, appColorScheme]);

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
                                    async () => {
                                        resetSettings();
                                        if (isRunningPotServer) {
                                            await stopPotServer();
                                        }
                                    }
                                }>Reset</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
                <TabsContent value="app">
                    <ApplicationSettings />
                </TabsContent>
                <TabsContent value="extension">
                    <ExtensionSettings />
                </TabsContent>
            </Tabs>
        </div>
    )
}
