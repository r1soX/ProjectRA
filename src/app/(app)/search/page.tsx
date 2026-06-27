import { requireUser } from "@/lib/auth";
import { search } from "@/lib/search";
import { hasPerm, PERMS } from "@/lib/permissions";
import { PageContainer } from "@/components/ui/page-container";
import { AccessDenied } from "@/components/ui/access-denied";
import { SearchClient } from "./search-client";

export const metadata = { title: "Поиск · Projectra" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const me = await requireUser();
  if (!(await hasPerm(me.id, me.role, PERMS.BOARD_VIEW))) {
    return (
      <PageContainer className="max-w-3xl">
        <AccessDenied message="У вас нет прав на поиск по доскам и задачам." />
      </PageContainer>
    );
  }
  const { q = "" } = await searchParams;
  const { tasks, boards } = await search(me.id, me.role === "ADMIN", q);

  return (
    <PageContainer className="max-w-3xl">
      <SearchClient query={q} tasks={tasks} boards={boards} />
    </PageContainer>
  );
}
