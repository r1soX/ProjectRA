import { requireUser } from "@/lib/auth";
import { getUnreadTotal } from "@/lib/chat";
import { AppShell } from "@/components/app-shell";
import { DialogProvider } from "@/components/ui/dialog-provider";
import { NotificationCenter } from "@/components/notification-center";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const unreadTotal = await getUnreadTotal(user.id);
  return (
    <DialogProvider>
      <AppShell user={user} unreadTotal={unreadTotal}>
        {children}
      </AppShell>
      <NotificationCenter />
    </DialogProvider>
  );
}
