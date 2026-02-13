import * as React from "react";
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import { type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { toggleVariants } from "@/components/ui/toggle";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { ProxyImage } from "@/components/custom/proxyImage";
import { Clock } from "lucide-react";
import clsx from "clsx";
import { formatDurationString } from "@/utils";
import { RawVideoInfo } from "@/types/video";

const PlaylistToggleGroupContext = React.createContext<
  VariantProps<typeof toggleVariants> & { toggleType?: "single" | "multiple" }
>({
  size: "default",
  variant: "default",
  toggleType: "multiple",
});

type PlaylistToggleGroupProps =
  | (Omit<React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root>, "type"> &
      VariantProps<typeof toggleVariants> & { type: "single", value?: string, onValueChange?: (value: string) => void })
  | (Omit<React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root>, "type"> &
      VariantProps<typeof toggleVariants> & { type: "multiple", value?: string[], onValueChange?: (value: string[]) => void });

export const PlaylistToggleGroup = React.forwardRef<
  React.ComponentRef<typeof ToggleGroupPrimitive.Root>,
  PlaylistToggleGroupProps
>(({ className, variant, size, children, type = "multiple", ...props }, ref) => {
  if (type === "single") {
    return (
      <ToggleGroupPrimitive.Root
        ref={ref}
        type="single"
        className={cn("flex flex-col gap-2", className)}
        {...(props as any)}
      >
        <PlaylistToggleGroupContext.Provider value={{ variant, size, toggleType: "single" }}>
          {children}
        </PlaylistToggleGroupContext.Provider>
      </ToggleGroupPrimitive.Root>
    );
  }

  return (
    <ToggleGroupPrimitive.Root
      ref={ref}
      type="multiple"
      className={cn("flex flex-col gap-2", className)}
      {...(props as any)}
    >
      <PlaylistToggleGroupContext.Provider value={{ variant, size, toggleType: "multiple" }}>
        {children}
      </PlaylistToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
  );
});
PlaylistToggleGroup.displayName = "PlaylistToggleGroup";

export const PlaylistToggleGroupItem = React.forwardRef<
  React.ComponentRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> &
    VariantProps<typeof toggleVariants> & {
      video: RawVideoInfo;
    }
>(({ className, children, variant, size, video, value, ...props }, ref) => {
  return (
    <ToggleGroupPrimitive.Item
      ref={ref}
      className={cn(
        "flex w-full p-2 rounded-lg transition-colors border-2 border-border",
        "hover:bg-muted/70 data-[state=on]:bg-primary/10",
        "data-[state=on]:border-primary",
        className
      )}
      value={value}
      {...props}
    >
      <div className="flex gap-2 w-full relative">
        <div className="w-28 xl:w-40">
          <AspectRatio
            ratio={16 / 9}
            className={clsx(
              "w-full rounded overflow-hidden border border-border",
              video.aspect_ratio && video.aspect_ratio === 0.56 && "relative"
            )}
          >
            <ProxyImage
              src={video.thumbnail}
              alt="thumbnail"
              className={clsx(
                video.aspect_ratio && video.aspect_ratio === 0.56 &&
                "absolute h-full w-auto top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
              )}
            />
          </AspectRatio>
        </div>

        <div className="flex w-40 lg:w-48 xl:w-60 flex-col items-start text-start">
          <h3 className="text-sm text-nowrap w-full overflow-hidden text-ellipsis mb-1" title={video.title}>{video.title}</h3>
          <p className="text-xs text-nowrap w-full overflow-hidden text-ellipsis text-muted-foreground mb-2" title={video.creator || video.channel || video.uploader || 'unknown'}>{video.creator || video.channel || video.uploader || 'unknown'}</p>
          <div className="flex items-center">
            <span className="text-xs text-muted-foreground flex items-center pr-3">
              <Clock className="w-4 h-4 mr-2"/>
              {video.duration_string ? formatDurationString(video.duration_string) : 'unknown'}
            </span>
          </div>
        </div>
      </div>
    </ToggleGroupPrimitive.Item>
  );
});
PlaylistToggleGroupItem.displayName = "PlaylistToggleGroupItem";
