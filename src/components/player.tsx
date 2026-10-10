import { MediaPlayer, MediaProvider } from "@vidstack/react";
import {
	PlyrLayout,
	plyrLayoutIcons,
} from "@vidstack/react/player/layouts/plyr";
import "@vidstack/react/player/styles/base.css";
import "@vidstack/react/player/styles/plyr/theme.css";

interface PlayerProps {
	src: string;
	title?: string;
	thumbnail?: string;
	storyboard?: string;
}

export function Player({ src, title, thumbnail, storyboard }: PlayerProps) {
	return (
		<div className="w-full aspect-video flex items-center justify-center">
			<MediaPlayer
				title={title}
				src={src}
				poster={thumbnail}
				playsInline
				className="[--plyr-color-main:#FF43D0] customscheme:[--plyr-color-main:var(--primary)]"
			>
				<MediaProvider />
				<PlyrLayout thumbnails={storyboard} icons={plyrLayoutIcons} />
			</MediaPlayer>
		</div>
	);
}
