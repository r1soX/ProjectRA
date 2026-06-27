import { cn } from "@/lib/cn";

/** Consistent, friendly empty/zero-data state with an optional call to action. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ElementType;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-16 text-center",
        className,
      )}
    >
      {Icon && (
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04] text-neutral-400 ring-1 ring-white/10">
          <Icon className="h-7 w-7" />
        </span>
      )}
      <h3 className="text-base font-semibold text-neutral-200">{title}</h3>
      {description && (
        <p className="max-w-sm text-sm leading-relaxed text-neutral-500">
          {description}
        </p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
