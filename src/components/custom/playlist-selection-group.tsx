import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import { cn } from "@/lib/utils";
import { RawVideoInfo } from "@/types/video";
import { formatDurationString } from "@/lib/utils";
import { Clock } from "lucide-react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { ProxyImage } from "@/components/custom/proxy-image";

interface PlaylistSelectionGroupItemProps extends RadioPrimitive.Root.Props {
	video: RawVideoInfo;
}

function PlaylistSelectionGroup({
	className,
	...props
}: RadioGroupPrimitive.Props) {
	return (
		<RadioGroupPrimitive
			data-slot="playlist-selection-group"
			className={cn("grid gap-3", className)}
			{...props}
		/>
	);
}

function PlaylistSelectionGroupItem({
	className,
	video,
	...props
}: PlaylistSelectionGroupItemProps) {
	return (
		<RadioPrimitive.Root
			data-slot="playlist-selection-group-item"
			className={cn(
				"relative w-full rounded-lg border-2 border-border bg-background p-2 shadow-sm transition-all",
				"data-checked:border-primary data-checked:bg-primary/10",
				"hover:bg-muted/70",
				"disabled:cursor-not-allowed disabled:opacity-50",
				className,
			)}
			{...props}
		>
			<div className="flex gap-2 w-full relative">
				<div className="w-28 xl:w-40">
					<AspectRatio
						ratio={16 / 9}
						className={cn(
							"w-full rounded overflow-hidden border border-border",
							video.aspect_ratio && video.aspect_ratio === 0.56 && "relative",
						)}
					>
						<ProxyImage
							src={video.thumbnail}
							alt="thumbnail"
							className={cn(
								video.aspect_ratio &&
									video.aspect_ratio === 0.56 &&
									"absolute h-full w-auto top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2",
							)}
						/>
					</AspectRatio>
				</div>

				<div className="flex w-40 lg:w-48 xl:w-60 flex-col items-start text-start">
					<h3
						className="text-sm text-nowrap w-full overflow-hidden text-ellipsis mb-1"
						title={video.title}
					>
						{video.title}
					</h3>
					<p
						className="text-xs text-nowrap w-full overflow-hidden text-ellipsis text-muted-foreground mb-2"
						title={
							video.creator || video.channel || video.uploader || "unknown"
						}
					>
						{video.creator || video.channel || video.uploader || "unknown"}
					</p>
					<div className="flex items-center">
						<span className="text-xs text-muted-foreground flex items-center pr-3">
							<Clock className="w-4 h-4 mr-2" />
							{video.duration_string
								? formatDurationString(video.duration_string)
								: "unknown"}
						</span>
					</div>
				</div>
			</div>
		</RadioPrimitive.Root>
	);
}

export { PlaylistSelectionGroup, PlaylistSelectionGroupItem };
