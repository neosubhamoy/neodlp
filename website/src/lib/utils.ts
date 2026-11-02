import type { OS } from "@/types/index";

export { cn } from "cn";

export function getOS(): OS {
	const userAgent = window.navigator.userAgent;
	const platform =
		(window.navigator as any)?.userAgentData?.platform ||
		window.navigator.platform;

	const macosPlatforms = ["Macintosh", "MacIntel", "MacPPC", "Mac68K", "macOS"];
	const windowsPlatforms = ["Win32", "Win64", "Windows", "WinCE"];
	const iosPlatforms = ["iPhone", "iPad", "iPod"];

	if (macosPlatforms.includes(platform)) {
		return "macos";
	} else if (iosPlatforms.includes(platform)) {
		return "ios";
	} else if (windowsPlatforms.includes(platform)) {
		return "windows";
	} else if (/Android/.test(userAgent)) {
		return "android";
	} else if (/Linux/.test(platform)) {
		return "linux";
	} else {
		return "unknown";
	}
}
