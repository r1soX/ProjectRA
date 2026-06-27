import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPerm, PERMS } from "@/lib/permissions";
import { PageContainer } from "@/components/ui/page-container";
import { TemplatesClient, type TemplateView } from "./templates-client";

export default async function AdminTemplatesPage() {
  const admin = await requireAdmin();
  if (!(await hasPerm(admin.id, admin.role, PERMS.ADMIN_TEMPLATES_MANAGE))) {
    redirect("/dashboard");
  }

  const templates = await prisma.boardTemplate.findMany({
    orderBy: { createdAt: "asc" },
    include: { columns: { orderBy: { order: "asc" }, select: { title: true } } },
  });

  const data: TemplateView[] = templates.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    isSystem: t.isSystem,
    columns: t.columns.map((c) => c.title),
  }));

  return (
    <PageContainer>
      <TemplatesClient templates={data} />
    </PageContainer>
  );
}
