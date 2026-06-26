import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageContainer } from "@/components/ui/page-container";
import { ProfileForms } from "./profile-form";

export default async function ProfilePage() {
  const session = await requireUser();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.id },
    select: {
      username: true,
      lastName: true,
      firstName: true,
      middleName: true,
      birthDate: true,
    },
  });

  return (
    <PageContainer className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-neutral-100">
        Настройки профиля
      </h1>
      <ProfileForms
        username={user.username}
        lastName={user.lastName}
        firstName={user.firstName}
        middleName={user.middleName}
        birthDate={user.birthDate ? user.birthDate.toISOString().slice(0, 10) : null}
      />
    </PageContainer>
  );
}
