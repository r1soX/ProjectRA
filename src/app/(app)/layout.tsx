import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { DialogProvider } from "@/components/ui/dialog-provider";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return (
    <DialogProvider>
      <AppShell user={user}>{children}</AppShell>
    </DialogProvider>
  );
}
