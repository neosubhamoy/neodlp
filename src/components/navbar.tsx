import { useLocation } from "react-router-dom";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { getRouteName } from "@/utils";
// import { Button } from "@/components/ui/button";
// import { Terminal } from "lucide-react";
// import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export default function Navbar() {
    const location = useLocation();
    
    return (
        <nav className="flex justify-between items-center py-3 px-4 sticky top-0 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b z-50">
            <div className="flex justify-center">
                <SidebarTrigger />
                <h1 className="text-lg text-primary font-semibold ml-4">{getRouteName(location.pathname)}</h1>
            </div>
            <div className="flex justify-center items-center">
                {/* <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="outline" size="icon">
                            <Terminal />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                    <p>Logs</p>
                    </TooltipContent>
                </Tooltip> */}
            </div>
        </nav>
    )
}
