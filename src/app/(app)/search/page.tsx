import { requireUser } from "@/lib/auth";
import { search } from "@/lib/search";
import { PageContainer } from "@/components/ui/page-container";
import { SearchClient } from "./search-client";

export const metadata = { title: "Поиск · Projectra" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const me = await requireUser();
  const { q = "" } = await searchParams;
  const { tasks, boards } = await search(me.id, me.role === "ADMIN", q);

  return (
    <PageContainer className="max-w-3xl">
      <SearchClient query={q} tasks={tasks} boards={boards} />
    </PageContainer>
  );
}
