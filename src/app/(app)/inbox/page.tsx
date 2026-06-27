import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageContainer } from "@/components/ui/page-container";
import { InboxClient, type InboxNotif } from "./inbox-client";

export const metadata = { title: "Входящие · Projectra" };

export default async function InboxPage() {
  const user = await requireUser();
  const rows = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const data: InboxNotif[] = rows.map((n) => ({
    id: n.id,
    type: n.type,
    payload: n.payload ? JSON.parse(n.payload) : {},
    link: n.link,
    isRead: n.isRead,
    createdAt: n.createdAt.toISOString(),
  }));

  return (
    <PageContainer className="max-w-3xl">
      <InboxClient initial={data} />
    </PageContainer>
  );
}
