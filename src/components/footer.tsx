import { useLocation } from "react-router-dom";
import { isActive } from "@/utils";
import { config } from "@/config";
import { useSettingsPageStatesStore } from "@/services/store";
import { Github, Globe, Heart } from "lucide-react";

export default function Footer() {
    const location = useLocation();
    const isSettingsPage = isActive("/settings", location.pathname, true);
    const appVersion = useSettingsPageStatesStore(state => state.appVersion);

    return (
        <>
        {isSettingsPage ? (
            <div className="flex items-center justify-between p-4 border-t border-border">
                <div className="flex flex-col gap-1">
                    <span className="text-sm">{config.appName} v{appVersion} - &copy; {new Date().getFullYear()} &nbsp;|&nbsp; <a href={'https://github.com/' + config.appRepo + '/blob/main/LICENSE'} target="_blank">MIT License</a></span>
                    <span className="text-xs text-muted-foreground">Made with <Heart className="inline size-3 mb-0.5 fill-primary stroke-primary"/> by <a href={config.appAuthorUrl} target="_blank">{config.appAuthor}</a></span>
                </div>
                <div className="flex items-center gap-2">
                    <a href={config.appHomepage} target="_blank" className="text-sm text-muted-foreground hover:text-foreground" title="Homepage">
                        <Globe className="w-4 h-4" />
                    </a>
                    <a href={'https://github.com/' + config.appRepo} target="_blank" className="text-sm text-muted-foreground hover:text-foreground" title="GitHub">
                        <Github className="w-4 h-4" />
                    </a>
                </div>
            </div>
        ) : (
            <></>
        )}
        </>
    )
}
