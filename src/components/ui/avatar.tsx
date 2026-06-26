import { cn } from "@/lib/cn";

export function Avatar({
  image,
  emoji,
  initials,
  size = 36,
  online,
  ring,
  className,
}: {
  image?: string | null;
  emoji?: string | null;
  initials: string;
  size?: number;
  online?: boolean;
  ring?: boolean;
  className?: string;
}) {
  const dot = Math.max(8, Math.round(size * 0.28));
  return (
    <span
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          className={cn(
            "h-full w-full rounded-full object-cover",
            ring && "ring-2 ring-white/15",
          )}
        />
      ) : emoji ? (
        <span
          className={cn(
            "flex h-full w-full items-center justify-center rounded-full bg-white/10",
            ring && "ring-2 ring-white/15",
          )}
          style={{ fontSize: size * 0.55 }}
        >
          {emoji}
        </span>
      ) : (
        <span
          className={cn(
            "flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 font-semibold text-white",
            ring && "ring-2 ring-white/15",
          )}
          style={{ fontSize: size * 0.36 }}
        >
          {initials}
        </span>
      )}
      {online !== undefined && (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full border-2 border-neutral-900",
            online ? "bg-emerald-400" : "bg-neutral-600",
          )}
          style={{ width: dot, height: dot }}
          title={online ? "в сети" : "не в сети"}
        />
      )}
    </span>
  );
}
