import * as React from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { toggleVariants } from "@/components/ui/toggle";
import { Checkbox } from "@/components/ui/checkbox";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { ProxyImage } from "@/components/custom/proxyImage";
import { Clock } from "lucide-react";
import clsx from "clsx";
import { formatDurationString } from "@/utils";
import { RawVideoInfo } from "@/types/video";

// Create a context to share toggle group props
const PlaylistToggleGroupContext = React.createContext<
  VariantProps<typeof toggleVariants> & { toggleType?: "single" | "multiple" }
>({
  size: "default",
  variant: "default",
  toggleType: "multiple",
});

// Helper type for the PlaylistToggleGroup
type PlaylistToggleGroupProps = 
  | (Omit<React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root>, "type"> & 
      VariantProps<typeof toggleVariants> & { type: "single", value?: string, onValueChange?: (value: string) => void })
  | (Omit<React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root>, "type"> & 
      VariantProps<typeof toggleVariants> & { type: "multiple", value?: string[], onValueChange?: (value: string[]) => void });

// Main PlaylistToggleGroup component with proper type handling
export const PlaylistToggleGroup = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Root>,
  PlaylistToggleGroupProps
>(({ className, variant, size, children, type = "multiple", ...props }, ref) => {
  // Pass props based on the type
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

// Rest of your component remains the same
// PlaylistToggleGroupItem component with checkbox and item layout
export const PlaylistToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> &
    VariantProps<typeof toggleVariants> & {
      video: RawVideoInfo;
    }
>(({ className, children, variant, size, video, value, ...props }, ref) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const [checked, setChecked] = React.useState(false);
  
  // Instead of a ref + useEffect approach
  const [itemElement, setItemElement] = React.useState<HTMLButtonElement | null>(null);
  
  // Handle checkbox click separately by simulating a click on the parent item
  const handleCheckboxClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    
    // Manually trigger the item's click to toggle selection
    if (itemElement) {
      // This simulates a click on the toggle item itself
      itemElement.click();
    }
  };

  // Use an effect that triggers when itemElement changes
  React.useEffect(() => {
    if (itemElement) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.attributeName === 'data-state') {
            setChecked(itemElement.getAttribute('data-state') === 'on');
          }
        });
      });
      
      setChecked(itemElement.getAttribute('data-state') === 'on');
      observer.observe(itemElement, { attributes: true });
      
      return () => observer.disconnect();
    }
  }, [itemElement]);

  return (
    <ToggleGroupPrimitive.Item
      ref={(el) => {
        // Handle both our ref and the forwarded ref
        if (typeof ref === 'function') {
          ref(el);
        } else if (ref) {
          ref.current = el;
        }
        setItemElement(el);
      }}
      className={cn(
        "flex w-full p-2 rounded-md transition-colors border-2 border-border",
        "hover:bg-muted/50 data-[state=on]:bg-muted/70",
        "data-[state=on]:border-primary",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      value={value}
      {...props}
    >
      
      <div className="flex gap-2 w-full relative">
        <div className="absolute top-2 left-2 z-10">
            <Checkbox 
            checked={checked}
            onClick={handleCheckboxClick}
            className={cn(
                "transition-opacity",
                isHovered || checked ? "opacity-100" : "opacity-0"
            )}
            />
        </div>
        <div className="w-[7rem] xl:w-[10rem]">
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
        
        <div className="flex w-[10rem] lg:w-[12rem] xl:w-[15rem] flex-col items-start text-start">
          <h3 className="text-sm text-nowrap w-full overflow-hidden text-ellipsis mb-1">{video.title}</h3>
          <p className="text-xs text-muted-foreground mb-2">{video.channel || video.uploader || 'unknown'}</p>
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