import { cn } from "@/lib/utils";
import React, { type ReactNode } from "react";

export const SlidingButton = ({
  children,
  slidingContent,
  as: Tag = "button",
  href,
  target,
  className,
  ...props
}: {
    children: ReactNode;
    slidingContent: ReactNode;
    as?: React.ElementType;
    href?: string;
    target?: string;
    className?: string;
} & (
  | React.ComponentPropsWithoutRef<"a">
  | React.ComponentPropsWithoutRef<"button">
)) => {
    return (
      <Tag
        className={cn(
          "px-4 py-2 rounded-md bg-primary text-primary-foreground text-center relative overflow-hidden cursor-pointer flex justify-center",
          `group/sliding-button`,
          className
        )}
        href={href}
        target={target}
        {...props}
      >
        <span
          className={cn(
            'text-center transition duration-500 flex flex-col justify-center items-center',
            `group-hover/sliding-button:translate-x-60`
          )}
        >
          {children}
        </span>
        <div
          className={cn(
            'flex items-center justify-center absolute inset-0 transition duration-500 text-primary-foreground z-20',
            `-translate-x-60 group-hover/sliding-button:translate-x-0`
          )}
        >
          {slidingContent}
        </div>
      </Tag>
    );
};
