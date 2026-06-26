import { cn } from "@/lib/cn";

/**
 * Ambient animated background: soft drifting gradient blobs + dotted grid.
 * Pure CSS animations (no JS), safe to use in server components.
 */
export function Aurora({
  className,
  grid = true,
}: {
  className?: string;
  grid?: boolean;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className,
      )}
    >
      <div className="animate-blob absolute -left-32 -top-40 h-[480px] w-[480px] rounded-full bg-sky-500/30 blur-[130px]" />
      <div className="animate-blob absolute -right-24 top-1/3 h-[440px] w-[440px] rounded-full bg-indigo-600/25 blur-[130px] [animation-delay:-7s]" />
      <div className="animate-blob absolute -bottom-40 left-1/4 h-[440px] w-[440px] rounded-full bg-fuchsia-500/20 blur-[140px] [animation-delay:-14s]" />
      {grid && <div className="bg-grid absolute inset-0 opacity-60" />}
    </div>
  );
}
