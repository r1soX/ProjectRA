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
        "h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 text-sm text-neutral-100 placeholder:text-neutral-500 outline-none backdrop-blur transition focus:border-sky-500/70 focus:bg-white/[0.07] focus:ring-2 focus:ring-sky-500/25 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});
