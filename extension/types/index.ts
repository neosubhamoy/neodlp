export type OS = "windows" | "macos" | "linux" | "android" | "ios" | "unknown";

export interface Settings {
	theme: "system" | "dark" | "light";
	autofill_url: boolean;
}

export interface WebsocketMessage {
	url: string;
	command: string;
	argument: string;
}
