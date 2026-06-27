import { requireUser } from "@/lib/auth";
import {
  getRolePermMap,
  getUserPermMap,
  hasPerm,
  PERM_GROUPS,
  PERMS,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { AccessDenied } from "@/components/ui/access-denied";
import { PageContainer } from "@/components/ui/page-container";
import { shortName, initials } from "@/lib/names";
import { PermissionsClient } from "./permissions-client";

export default async function PermissionsPage() {
  const user = await requireUser();
  if (
    user.role !== "ADMIN" ||
    !(await hasPerm(user.id, user.role, PERMS.ADMIN_PERMISSIONS_MANAGE))
  ) {
    return (
      <PageContainer>
        <AccessDenied message="У вас нет прав на управление правами доступа." />
      </PageContainer>
    );
  }

  const [userRoleMap, adminRoleMap] = await Promise.all([
    getRolePermMap("USER"),
    getRolePermMap("ADMIN"),
  ]);

  const users = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: [{ role: "desc" }, { lastName: "asc" }],
    select: {
      id: true,
      username: true,
      lastName: true,
      firstName: true,
      middleName: true,
      role: true,
      avatar: true,
      avatarEmoji: true,
    },
  });

  // Build per-user perm maps
  const userPermMaps = await Promise.all(
    users.map(async (u) => ({
      userId: u.id,
      map: await getUserPermMap(u.id, u.role),
    })),
  );
  const userPermById = Object.fromEntries(
    userPermMaps.map(({ userId, map }) => [userId, map]),
  );

  return (
    <PermissionsClient
      groups={PERM_GROUPS}
      userRoleMap={userRoleMap}
      adminRoleMap={adminRoleMap}
      users={users.map((u) => ({
        id: u.id,
        username: u.username,
        role: u.role,
        fullName: shortName(u),
        initials: initials(u),
        avatar: u.avatar,
        emoji: u.avatarEmoji,
        permMap: userPermById[u.id] ?? {},
      }))}
    />
  );
}
