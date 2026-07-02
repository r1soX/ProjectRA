import { requireUser } from "@/lib/auth";
import { getUnreadTotal } from "@/lib/chat";
import { getUserBoards } from "@/lib/boards";
import { prisma } from "@/lib/prisma";
import { hasPerm, PERMS } from "@/lib/permissions";
import { AppShell, type NavCaps } from "@/components/app-shell";
import { DialogProvider } from "@/components/ui/dialog-provider";
import { ToastProvider } from "@/components/ui/toast-provider";
import { PresenceProvider } from "@/components/presence-provider";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const [unreadTotal, notifUnread] = await Promise.all([
    getUnreadTotal(user.id),
    prisma.notification.count({ where: { userId: user.id, isRead: false } }),
  ]);

  // Capabilities that decide which nav sections are shown — no dead links.
  const isAdmin = user.role === "ADMIN";
  const [
    boards,
    messages,
    tasks,
    adminUsers,
    adminPerms,
    adminTemplates,
    adminAnalytics,
    adminAudit,
  ] = await Promise.all([
    hasPerm(user.id, user.role, PERMS.BOARD_VIEW),
    hasPerm(user.id, user.role, PERMS.MESSAGE_VIEW),
    hasPerm(user.id, user.role, PERMS.TASK_VIEW),
    isAdmin ? hasPerm(user.id, user.role, PERMS.ADMIN_USERS_VIEW) : Promise.resolve(false),
    isAdmin ? hasPerm(user.id, user.role, PERMS.ADMIN_PERMISSIONS_MANAGE) : Promise.resolve(false),
    isAdmin ? hasPerm(user.id, user.role, PERMS.ADMIN_TEMPLATES_MANAGE) : Promise.resolve(false),
    isAdmin ? hasPerm(user.id, user.role, PERMS.ADMIN_ANALYTICS_VIEW) : Promise.resolve(false),
    isAdmin ? hasPerm(user.id, user.role, PERMS.ADMIN_AUDIT_VIEW) : Promise.resolve(false),
  ]);
  const caps: NavCaps = {
    boards,
    messages,
    tasks,
    adminUsers,
    adminPerms,
    adminTemplates,
    adminAnalytics,
    adminAudit,
  };

  const sidebarBoards = boards
    ? (await getUserBoards(user.id)).map((b) => ({
        id: b.id,
        title: b.title,
        color: b.color ?? "#0ea5e9",
      }))
    : [];

  return (
    <DialogProvider>
      <ToastProvider>
        <PresenceProvider>
          <AppShell
            user={user}
            unreadTotal={unreadTotal}
            notifUnread={notifUnread}
            caps={caps}
            boards={sidebarBoards}
          >
            {children}
          </AppShell>
        </PresenceProvider>
      </ToastProvider>
    </DialogProvider>
  );
}
