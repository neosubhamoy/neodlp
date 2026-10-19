import { resolveAdapterType } from "@videojs/react";
import { NeutralVideoSkin, Video, VideoPlayer } from "@videojs/react/video";
import { YouTubeVideo } from "@videojs/react/media/youtube-video";
import "@videojs/react/video/neutral-skin.css";

interface PlayerProps {
	src: string;
	title?: string;
	thumbnail?: string;
	storyboard?: string;
}

// Video.js doesn't pick a playback engine from the source, so choose the media component here
function Media({ src, storyboard }: Pick<PlayerProps, "src" | "storyboard">) {
	if (resolveAdapterType(src) === "youtube") {
		return <YouTubeVideo src={src} />;
	}
	return (
		<Video src={src} playsInline>
			{storyboard && (
				<track kind="metadata" label="thumbnails" src={storyboard} default />
			)}
		</Video>
	);
}

export function Player({ src, title, thumbnail, storyboard }: PlayerProps) {
	return (
		<div className="w-full aspect-video flex items-center justify-center">
			<VideoPlayer title={title} poster={thumbnail}>
				{/* Like Vidstack, the YouTube iframe is made 10x taller and centered, so YouTube's title bar, watermark and
				"More videos" overlays fall outside the clipped player. pointer-events-none lets the skin handle clicks.
				Captions are hidden too: the captions button and the settings menu's captions row (always its last row).
				These target the packaged skin's internal classes, so recheck them after Video.js updates. */}
				<NeutralVideoSkin className="relative overflow-hidden w-full aspect-video [&_iframe]:absolute [&_iframe]:left-0 [&_iframe]:top-1/2 [&_iframe]:-translate-y-1/2 [&_iframe]:w-full [&_iframe]:h-[1000%] [&_iframe]:pointer-events-none [&_.media-captions-button]:hidden! [&_.media-menu-popup>.media-menu-content>.media-menu-trigger-item:last-of-type]:hidden! [--media-accent-color:#FF43D0] [--media-accent-text-color:white] customscheme:[--media-accent-color:var(--primary)] customscheme:[--media-accent-text-color:var(--primary-foreground)]">
					<Media key={src} src={src} storyboard={storyboard} />
				</NeutralVideoSkin>
			</VideoPlayer>
		</div>
	);
}
