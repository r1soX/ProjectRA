import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageContainer } from "@/components/ui/page-container";
import { UsersClient, type AdminUser } from "./users-client";

export default async function AdminUsersPage() {
  const admin = await requireAdmin();

  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  const data: AdminUser[] = users.map((u) => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <PageContainer>
      <UsersClient users={data} currentUserId={admin.id} />
    </PageContainer>
  );
}
