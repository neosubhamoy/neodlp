import { config } from "@/config";
import { Link, useLocation } from "react-router-dom";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { CircleArrowUp, Download, Settings, SquarePlay, } from "lucide-react";
import { isActive as isActiveSidebarItem } from "@/utils";
import { RoutesObj } from "@/types/route";
import { useDownloadStatesStore, useSettingsPageStatesStore } from "@/services/store";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { NeoDlpLogo } from "@/components/icons/neodlp";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import useAppUpdater from "@/helpers/use-app-updater";

export function AppSidebar() {
  const downloadStates = useDownloadStatesStore(state => state.downloadStates);
  const ongoingDownloads = downloadStates.filter(state =>
    ['starting', 'downloading', 'queued'].includes(state.download_status)
  );
  const appVersion = useSettingsPageStatesStore(state => state.appVersion);
  const isFetchingAppVersion = useSettingsPageStatesStore(state => state.isFetchingAppVersion);
  const appUpdate = useSettingsPageStatesStore(state => state.appUpdate);
  const isUpdatingApp = useSettingsPageStatesStore(state => state.isUpdatingApp);
  const appUpdateDownloadProgress = useSettingsPageStatesStore(state => state.appUpdateDownloadProgress);
  const location = useLocation();
  const { open } = useSidebar();
  const { downloadAndInstallAppUpdate } = useAppUpdater();
  const [showBadge, setShowBadge] = useState(false);
  const [showUpdateCard, setShowUpdateCard] = useState(false);

  const topItems: Array<RoutesObj> = [
    {
      title: "Downloader",
      url: "/",
      icon: Download,
    },
    {
      title: "Library",
      url: "/library",
      icon: SquarePlay,
    }
  ];

  const bottomItems: Array<RoutesObj> = [
    {
      title: "Settings",
      url: "/settings",
      icon: Settings,
    }
  ];

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (open) {
      timeout = setTimeout(() => {
        setShowBadge(true);
        setShowUpdateCard(true);
      }, 300);
    } else {
      setShowBadge(false);
      setShowUpdateCard(false);
    }

    return () => {
      clearTimeout(timeout);
    };
  }, [open]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="#">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg">
                  <NeoDlpLogo className="size-full rounded-md border border-border [--logo-stop-color-1:#4444FF] [--logo-stop-color-2:#FF43D0] customscheme:[--logo-stop-color-1:var(--color-chart-5)] customscheme:[--logo-stop-color-2:var(--color-chart-1)]" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Neo Downloader Plus</span>
                  <span className="truncate text-xs">{isFetchingAppVersion ? 'Loading...' : `v${appVersion}`}</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      {/* <SidebarSeparator /> */}
      <SidebarContent>
        <SidebarGroup>
          {/* <SidebarGroupLabel>Tools</SidebarGroupLabel> */}
          <SidebarGroupContent>
            <SidebarMenu>
              {topItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  {!open ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton
                          isActive={isActiveSidebarItem(item.url, location.pathname, item.starts_with ? item.starts_with : false)}
                          className="relative"
                          asChild
                        >
                          <Link to={item.url}>
                            <item.icon className="stroke-primary" />
                            <span>{item.title}</span>
                            {item.title === "Library" && ongoingDownloads.length > 0 && showBadge && (
                              <Badge className="absolute right-2 inset-y-auto rounded-full font-bold bg-foreground/80">{ongoingDownloads.length}</Badge>
                            )}
                          </Link>
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <p>{item.title}</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <SidebarMenuButton
                      isActive={isActiveSidebarItem(item.url, location.pathname, item.starts_with ? item.starts_with : false)}
                      className="relative"
                      asChild
                    >
                      <Link to={item.url}>
                        <item.icon className="stroke-primary" />
                        <span>{item.title}</span>
                        {item.title === "Library" && ongoingDownloads.length > 0 && showBadge && (
                          <Badge className="absolute right-2 inset-y-auto h-5 min-w-5 rounded-full px-1 font-mono tabular-nums flex items-center justify-center">
                            <span className="mt-0.5">{ongoingDownloads.length}</span>
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        {appUpdate && !open && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost">
                <CircleArrowUp className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Update Available <br></br>(Expand sidebar to view update)</p>
            </TooltipContent>
          </Tooltip>
        )}
        {appUpdate && open && showUpdateCard && (
          <Card className="gap-4 py-0">
            <CardHeader className="p-4 pb-0">
              <CardTitle className="text-sm">Update Available (v{appUpdate?.version || '0.0.0'})</CardTitle>
              <CardDescription>
                A newer version of {config.appName} is available. Please update to the latest version for the best experience.
              </CardDescription>
              <a className="text-xs font-semibold cursor-pointer mt-1" href={`https://github.com/neosubhamoy/neodlp/releases/tag/v${appUpdate?.version || '0.0.0'}`} target="_blank">✨ Read Changelog</a>
            </CardHeader>
            <CardContent className="grid gap-2.5 p-4">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                  className="w-full"
                  size="sm"
                  disabled={ongoingDownloads.length > 0 || isUpdatingApp}
                  onClick={() => downloadAndInstallAppUpdate(appUpdate)}
                  >
                    Update Now
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader className="flex flex-col items-center text-center gap-2">
                    <CircleArrowUp className="size-7 stroke-muted-foreground" />
                    <AlertDialogTitle>Updating {config.appName}</AlertDialogTitle>
                    <AlertDialogDescription className="text-center text-xs mb-2">Updating {config.appName} to v{appUpdate?.version || '0.0.0'}, Please be patience! Do not quit the app untill the update finishes. The app will auto re-launch to complete the update, Please allow all system prompts from {config.appName} if asked.</AlertDialogDescription>
                    <Progress value={appUpdateDownloadProgress} className="w-full" />
                    <AlertDialogDescription className="text-center">Downloading update... {appUpdateDownloadProgress}%</AlertDialogDescription>
                  </AlertDialogHeader>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        )}
        <SidebarMenu>
          {bottomItems.map((item) => (
            <SidebarMenuItem key={item.title}>
              {!open ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SidebarMenuButton
                      isActive={isActiveSidebarItem(item.url, location.pathname, item.starts_with ? item.starts_with : false)}
                      asChild
                    >
                      <Link to={item.url}>
                        <item.icon className="stroke-primary" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>{item.title}</p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <SidebarMenuButton
                  isActive={isActiveSidebarItem(item.url, location.pathname, item.starts_with ? item.starts_with : false)}
                  asChild
                >
                  <Link to={item.url}>
                    <item.icon className="stroke-primary" />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              )}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
