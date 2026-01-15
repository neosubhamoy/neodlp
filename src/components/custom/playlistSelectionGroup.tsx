import * as React from "react"
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"
import { cn } from "@/lib/utils"
import { RawVideoInfo } from "@/types/video"
import { formatDurationString} from "@/utils"
import { Clock } from "lucide-react"
import { AspectRatio } from "@/components/ui/aspect-ratio"
import { ProxyImage } from "@/components/custom/proxyImage"
import clsx from "clsx"

interface PlaylistSelectionGroupItemProps extends
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item> {
  video: RawVideoInfo;
}

const PlaylistSelectionGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Root
      className={cn("grid gap-3", className)}
      {...props}
      ref={ref}
    />
  )
})
PlaylistSelectionGroup.displayName = "PlaylistSelectionGroup"

const PlaylistSelectionGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  PlaylistSelectionGroupItemProps
>(({ className, video, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        "relative w-full rounded-lg border-2 border-border bg-background p-2 shadow-sm transition-all",
        "data-[state=checked]:border-primary data-[state=checked]:bg-primary/10",
        "hover:bg-muted/70",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
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
    </RadioGroupPrimitive.Item>
  )
})
PlaylistSelectionGroupItem.displayName = "PlaylistSelectionGroupItem"

export { PlaylistSelectionGroup, PlaylistSelectionGroupItem }
