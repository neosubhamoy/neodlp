import { Download, Puzzle, Settings, SquarePlay } from "lucide-react";
import { RoutesObj } from "@/types/route";

export const AllRoutes: Array<RoutesObj> = [
    {
        title: "Downloader",
        url: "/",
        icon: Download,
    },
    {
        title: "Library",
        url: "/library",
        icon: SquarePlay,
    },
    {
        title: "Extension",
        url: "/extension",
        icon: Puzzle,
    },
    {
        title: "Settings",
        url: "/settings",
        icon: Settings,
    }
];