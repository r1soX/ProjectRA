import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageContainer } from "@/components/ui/page-container";
import { UsersClient, type AdminUser } from "./users-client";

export default async function AdminUsersPage() {
  const admin = await requireAdmin();

  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { lastName: "asc" }],
    select: {
      id: true,
      username: true,
      lastName: true,
      firstName: true,
      middleName: true,
      birthDate: true,
      role: true,
      isActive: true,
      createdAt: true,
      avatar: true,
      avatarEmoji: true,
    },
  });

  const data: AdminUser[] = users.map((u) => ({
    ...u,
    birthDate: u.birthDate ? u.birthDate.toISOString().slice(0, 10) : null,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <PageContainer>
      <UsersClient users={data} currentUserId={admin.id} />
    </PageContainer>
  );
}
