"use client";

import * as React from "react";
import { Progress as ProgressPrimitive } from "@base-ui/react/progress";

import { cn } from "@/lib/utils";

interface ProgressProps extends Omit<ProgressPrimitive.Root.Props, "value"> {
	value?: number | null;
	indeterminate?: boolean;
}

const IndeterminateProgress = React.forwardRef<HTMLDivElement, ProgressProps>(
	({ className, value, indeterminate = false, ...props }, ref) => {
		const progressValue = indeterminate ? null : (value ?? 0);

		return (
			<ProgressPrimitive.Root
				ref={ref}
				value={progressValue}
				className={cn("relative w-full", className)}
				{...props}
			>
				<ProgressPrimitive.Track className="relative h-1.5 w-full overflow-hidden rounded-full bg-primary/20">
					<ProgressPrimitive.Indicator
						className={cn(
							"h-full w-full flex-1 bg-primary transition-all",
							indeterminate &&
								"animate-[indeterminate-progress_1s_infinite_linear] origin-left",
						)}
					/>
				</ProgressPrimitive.Track>
			</ProgressPrimitive.Root>
		);
	},
);
IndeterminateProgress.displayName = "IndeterminateProgress";

export { IndeterminateProgress };
