import Link from "next/link";
import { ShieldAlert } from "lucide-react";

/**
 * Explicit "you don't have permission" state. Used instead of silently showing
 * an empty page / notFound when a view permission is missing, so the user
 * understands *why* there's nothing here.
 */
export function AccessDenied({
  title = "Недостаточно прав",
  message = "У вас нет доступа к этому разделу. Если это ошибка — обратитесь к администратору.",
  backHref = "/dashboard",
  backLabel = "На дашборд",
}: {
  title?: string;
  message?: string;
  backHref?: string | null;
  backLabel?: string;
}) {
  return (
    <div className="flex min-h-[60vh] flex-1 flex-col items-center justify-center gap-4 px-6 py-20 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20">
        <ShieldAlert className="h-8 w-8" />
      </span>
      <h2 className="text-xl font-semibold text-neutral-100">{title}</h2>
      <p className="max-w-sm text-sm leading-relaxed text-neutral-500">{message}</p>
      {backHref && (
        <Link
          href={backHref}
          className="mt-1 rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm text-neutral-200 transition hover:bg-neutral-700"
        >
          {backLabel}
        </Link>
      )}
    </div>
  );
}
