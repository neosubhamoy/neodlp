import { LucideProps } from "lucide-react";

export interface RoutesObj {
    title: string;
    url: string;
    icon: React.ForwardRefExoticComponent<Omit<LucideProps, "ref"> & React.RefAttributes<SVGSVGElement>>;
    starts_with?: boolean | null;
}