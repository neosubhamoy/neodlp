import * as React from "react";
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";
import { type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { toggleVariants } from "@/components/ui/toggle";
import { VideoFormat } from "@/types/video";
import {
	determineFileType,
	formatBitrate,
	formatCodec,
	formatFileSize,
} from "@/lib/utils";
import { Music, Video, File } from "lucide-react";

const FormatToggleGroupContext = React.createContext<
	VariantProps<typeof toggleVariants>
>({
	size: "default",
	variant: "default",
});

type FormatToggleGroupProps = Omit<
	ToggleGroupPrimitive.Props<string>,
	"value" | "onValueChange"
> &
	VariantProps<typeof toggleVariants> & {
		value?: readonly string[];
		onValueChange?: (value: string[]) => void;
	};

export const FormatToggleGroup = React.forwardRef<
	HTMLDivElement,
	FormatToggleGroupProps
>(
	(
		{ className, variant, size, children, value, onValueChange, ...props },
		ref,
	) => {
		return (
			<ToggleGroupPrimitive
				ref={ref}
				value={value}
				onValueChange={onValueChange}
				data-slot="format-toggle-group"
				className={cn("flex flex-col gap-2", className)}
				{...props}
			>
				<FormatToggleGroupContext.Provider value={{ variant, size }}>
					{children}
				</FormatToggleGroupContext.Provider>
			</ToggleGroupPrimitive>
		);
	},
);
FormatToggleGroup.displayName = "FormatToggleGroup";

export const FormatToggleGroupItem = React.forwardRef<
	HTMLButtonElement,
	TogglePrimitive.Props<string> &
		VariantProps<typeof toggleVariants> & {
			format: VideoFormat;
		}
>(({ className, children, variant, size, format, value, ...props }, ref) => {
	const determineFileTypeIcon = (format: VideoFormat) => {
		const fileFormat = determineFileType(
			/*format.video_ext, format.audio_ext,*/ format.vcodec,
			format.acodec,
		);
		switch (fileFormat) {
			case "video+audio":
				return (
					<span className="absolute flex items-center right-2 bottom-2">
						<Video className="w-3 h-3 mr-2" />
						<Music className="w-3 h-3" />
					</span>
				);
			case "video":
				return <Video className="w-3 h-3 absolute right-2 bottom-2" />;
			case "audio":
				return <Music className="w-3 h-3 absolute right-2 bottom-2" />;
			default:
				return <File className="w-3 h-3 absolute right-2 bottom-2" />;
		}
	};

	return (
		<TogglePrimitive
			ref={ref}
			data-slot="format-toggle-group-item"
			className={cn(
				"relative flex w-full p-2 rounded-lg border-2 border-border bg-background px-3 py-2 shadow-sm transition-all",
				"hover:bg-muted/70 data-pressed:bg-primary/10",
				"data-pressed:border-primary",
				className,
			)}
			value={value}
			{...props}
		>
			<div className="flex flex-col items-start text-start gap-1">
				<h5 className="text-sm">{format.format}</h5>
				<p className="text-muted-foreground text-xs">
					{format.filesize_approx
						? formatFileSize(format.filesize_approx)
						: "unknown"}{" "}
					{format.tbr ? formatBitrate(format.tbr) : "unknown"}
				</p>
				<p className="text-muted-foreground text-xs">
					{format.ext ? format.ext.toUpperCase() : "unknown"}{" "}
					{((format.vcodec && format.vcodec !== "none") ||
						(format.acodec && format.acodec !== "none")) &&
						`(${format.vcodec && format.vcodec !== "none" ? formatCodec(format.vcodec) : ""}${format.vcodec && format.vcodec !== "none" && format.acodec && format.acodec !== "none" ? " " : ""}${format.acodec && format.acodec !== "none" ? formatCodec(format.acodec) : ""})`}
				</p>
				{determineFileTypeIcon(format)}
			</div>
		</TogglePrimitive>
	);
});
FormatToggleGroupItem.displayName = "FormatToggleGroupItem";
