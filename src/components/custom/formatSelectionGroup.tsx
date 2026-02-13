import * as React from "react"
import { RadioGroup as RadioGroupPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"
import { VideoFormat } from "@/types/video"
import { determineFileType, formatBitrate, formatCodec, formatFileSize } from "@/utils"
import { File, Music, Video } from "lucide-react"

interface FormatSelectionGroupItemProps extends
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item> {
  format: VideoFormat
}

const FormatSelectionGroup = React.forwardRef<
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
FormatSelectionGroup.displayName = "FormatSelectionGroup"

const FormatSelectionGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  FormatSelectionGroupItemProps
>(({ className, format, ...props }, ref) => {
  const determineFileTypeIcon = (format: VideoFormat) => {
    const fileFormat = determineFileType(/*format.video_ext, format.audio_ext,*/ format.vcodec, format.acodec)
    switch (fileFormat) {
      case 'video+audio':
        return (
          <span className="absolute flex items-center right-2 bottom-2">
            <Video className="w-3 h-3 mr-2" />
            <Music className="w-3 h-3" />
          </span>
        )
      case 'video':
        return (
          <Video className="w-3 h-3 absolute right-2 bottom-2" />
        )
      case 'audio':
        return (
          <Music className="w-3 h-3 absolute right-2 bottom-2" />
        )
      default:
        return (
          <File className="w-3 h-3 absolute right-2 bottom-2" />
        )
    }
  }

  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        "relative w-full rounded-lg border-2 border-border bg-background px-3 py-2 shadow-sm transition-all",
        "data-[state=checked]:border-primary data-[state=checked]:bg-primary/10",
        "hover:bg-muted/70",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <div className="flex flex-col items-start text-start gap-1">
        <h5 className="text-sm">{format.format}</h5>
        <p className="text-muted-foreground text-xs">{format.filesize_approx ? formatFileSize(format.filesize_approx) : 'unknown'} {format.tbr ? formatBitrate(format.tbr) : 'unknown'}</p>
        <p className="text-muted-foreground text-xs">{format.ext ? format.ext.toUpperCase() : 'unknown'} {
        ((format.vcodec && format.vcodec !== 'none') || (format.acodec && format.acodec !== 'none')) && (
            `(${format.vcodec && format.vcodec !== 'none' ? formatCodec(format.vcodec) : ''}${format.vcodec && format.vcodec !== 'none' && format.acodec && format.acodec !== 'none' ? ' ' : ''}${format.acodec && format.acodec !== 'none' ? formatCodec(format.acodec) : ''})`
        )}</p>
        {determineFileTypeIcon(format)}
      </div>
    </RadioGroupPrimitive.Item>
  )
})
FormatSelectionGroupItem.displayName = "FormatSelectionGroupItem"

export { FormatSelectionGroup, FormatSelectionGroupItem }
