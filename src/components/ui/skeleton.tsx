import { cn } from "@/lib/cn";

/** Shimmer placeholder. `animate-pulse` is dampened by the global
 *  prefers-reduced-motion rule, so it's accessible by default. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-md bg-white/[0.06]", className)} />
  );
}
