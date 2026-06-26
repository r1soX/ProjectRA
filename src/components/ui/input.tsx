import * as React from "react";
import { cn } from "@/lib/cn";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-lg border border-neutral-700 bg-neutral-900/60 px-3 text-sm text-neutral-100 placeholder:text-neutral-500 outline-none transition-colors focus:border-sky-500 focus:bg-neutral-900 focus:ring-2 focus:ring-sky-500/30 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});
