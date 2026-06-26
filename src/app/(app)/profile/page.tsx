import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { initials as initialsOf } from "@/lib/names";
import { PageContainer } from "@/components/ui/page-container";
import { ProfileForms } from "./profile-form";
import { AvatarEditor } from "./avatar-editor";

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
      avatar: true,
      avatarEmoji: true,
    },
  });

  return (
    <PageContainer className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-neutral-100">
        Настройки профиля
      </h1>

      <section className="glass mb-6 rounded-xl p-5 sm:p-6">
        <h2 className="mb-4 text-lg font-semibold text-neutral-100">Аватар</h2>
        <AvatarEditor
          avatar={user.avatar}
          emoji={user.avatarEmoji}
          initials={initialsOf(user)}
        />
      </section>

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
