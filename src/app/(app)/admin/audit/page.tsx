import { requireAdmin } from "@/lib/auth";
import { hasPerm, PERMS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { AUDIT_LABELS } from "@/lib/audit";
import { shortName } from "@/lib/names";
import { PageContainer } from "@/components/ui/page-container";
import { AccessDenied } from "@/components/ui/access-denied";
import { EmptyState } from "@/components/ui/empty-state";
import { ScrollText } from "lucide-react";

function fmt(d: Date) {
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AuditPage() {
  const user = await requireAdmin();
  if (!(await hasPerm(user.id, user.role, PERMS.ADMIN_AUDIT_VIEW))) {
    return (
      <PageContainer>
        <AccessDenied message="У вас нет прав на просмотр журнала действий." />
      </PageContainer>
    );
  }
  const rows = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: { select: { lastName: true, firstName: true, middleName: true } },
    },
  });

  return (
    <PageContainer>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-neutral-100">Журнал действий</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Последние действия администраторов.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="Журнал пуст"
          description="Действия администраторов (создание пользователей, изменение прав, шаблонов) появятся здесь."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/[0.07]">
          {rows.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 border-b border-white/[0.05] px-4 py-3 text-sm last:border-b-0"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/5 text-neutral-400">
                <ScrollText className="h-3.5 w-3.5" />
              </span>
              <span className="shrink-0 font-medium text-neutral-200">
                {shortName(r.user)}
              </span>
              <span className="text-neutral-400">
                {AUDIT_LABELS[r.action] ?? r.action}
              </span>
              {r.target && (
                <span className="min-w-0 flex-1 truncate text-neutral-300">
                  {r.target}
                </span>
              )}
              <span className="ml-auto shrink-0 text-xs text-neutral-600">
                {fmt(r.createdAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
