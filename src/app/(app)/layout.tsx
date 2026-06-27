import { requireUser } from "@/lib/auth";
import { getUnreadTotal } from "@/lib/chat";
import { hasPerm, PERMS } from "@/lib/permissions";
import { AppShell, type NavCaps } from "@/components/app-shell";
import { DialogProvider } from "@/components/ui/dialog-provider";
import { PresenceProvider } from "@/components/presence-provider";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const unreadTotal = await getUnreadTotal(user.id);

  // Capabilities that decide which nav sections are shown — no dead links.
  const isAdmin = user.role === "ADMIN";
  const [
    boards,
    messages,
    tasks,
    adminUsers,
    adminPerms,
    adminTemplates,
  ] = await Promise.all([
    hasPerm(user.id, user.role, PERMS.BOARD_VIEW),
    hasPerm(user.id, user.role, PERMS.MESSAGE_VIEW),
    hasPerm(user.id, user.role, PERMS.TASK_VIEW),
    isAdmin ? hasPerm(user.id, user.role, PERMS.ADMIN_USERS_VIEW) : Promise.resolve(false),
    isAdmin ? hasPerm(user.id, user.role, PERMS.ADMIN_PERMISSIONS_MANAGE) : Promise.resolve(false),
    isAdmin ? hasPerm(user.id, user.role, PERMS.ADMIN_TEMPLATES_MANAGE) : Promise.resolve(false),
  ]);
  const caps: NavCaps = {
    boards,
    messages,
    tasks,
    adminUsers,
    adminPerms,
    adminTemplates,
  };

  return (
    <DialogProvider>
      <PresenceProvider>
        <AppShell user={user} unreadTotal={unreadTotal} caps={caps}>
          {children}
        </AppShell>
      </PresenceProvider>
    </DialogProvider>
  );
}
