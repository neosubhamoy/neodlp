import type { LucideProps } from "lucide-react";

// ---Route Types---

export interface RoutesObj {
	title: string;
	url: string;
	icon: React.ForwardRefExoticComponent<
		Omit<LucideProps, "ref"> & React.RefAttributes<SVGSVGElement>
	>;
	starts_with?: boolean | null;
}

// ---Log Types---

export interface Log {
	timestamp: number;
	level: "info" | "warning" | "error" | "debug" | "progress";
	context: string;
	message: string;
}

// ---WebSocket Types---

export interface WebSocketMessage {
	url: string;
	command: string;
	argument: string;
}
