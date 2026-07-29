import { requireAdmin } from "@/lib/auth";
import { hasPerm, PERMS } from "@/lib/permissions";
import { getStatuses } from "@/lib/statuses";
import { PageContainer } from "@/components/ui/page-container";
import { AccessDenied } from "@/components/ui/access-denied";
import { StatusesClient } from "./statuses-client";

export default async function StatusesPage() {
  const user = await requireAdmin();
  if (!(await hasPerm(user.id, user.role, PERMS.ADMIN_STATUSES_MANAGE))) {
    return (
      <PageContainer>
        <AccessDenied message="У вас нет прав на управление статусами." />
      </PageContainer>
    );
  }
  const statuses = await getStatuses();

  return (
    <PageContainer className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-100">Статусы задач</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Название и цвет статусов. Встроенные статусы можно переименовать и
          перекрасить, но не удалить. Свои — добавляйте и удаляйте свободно.
        </p>
      </div>
      <StatusesClient
        statuses={statuses.map((s) => ({
          id: s.id ?? s.key,
          key: s.key,
          label: s.label,
          color: s.color,
          isSystem: !!s.isSystem,
        }))}
      />
    </PageContainer>
  );
}
