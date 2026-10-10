import * as React from "react";
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";
import { type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { toggleVariants } from "@/components/ui/toggle";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { ProxyImage } from "@/components/custom/proxy-image";
import { Clock } from "lucide-react";
import { formatDurationString } from "@/lib/utils";
import { RawVideoInfo } from "@/types/video";

type PlaylistToggleGroupProps = Omit<
	ToggleGroupPrimitive.Props<string>,
	"value" | "onValueChange"
> &
	VariantProps<typeof toggleVariants> & {
		value?: readonly string[];
		onValueChange?: (value: string[]) => void;
	};

export const PlaylistToggleGroup = React.forwardRef<
	HTMLDivElement,
	PlaylistToggleGroupProps
>(({ className, variant, size, children, ...props }, ref) => {
	return (
		<ToggleGroupPrimitive
			ref={ref}
			multiple
			data-slot="playlist-toggle-group"
			className={cn("flex flex-col gap-2", className)}
			{...props}
		>
			{children}
		</ToggleGroupPrimitive>
	);
});
PlaylistToggleGroup.displayName = "PlaylistToggleGroup";

export const PlaylistToggleGroupItem = React.forwardRef<
	HTMLButtonElement,
	TogglePrimitive.Props<string> &
		VariantProps<typeof toggleVariants> & {
			video: RawVideoInfo;
		}
>(({ className, children, variant, size, video, value, ...props }, ref) => {
	return (
		<TogglePrimitive
			ref={ref}
			data-slot="playlist-toggle-group-item"
			className={cn(
				"flex w-full p-2 rounded-lg transition-colors border-2 border-border",
				"hover:bg-muted/70 data-pressed:bg-primary/10",
				"data-pressed:border-primary",
				className,
			)}
			value={value}
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
		</TogglePrimitive>
	);
});
PlaylistToggleGroupItem.displayName = "PlaylistToggleGroupItem";
