import { requireUser } from "@/lib/auth";
import { PageContainer } from "@/components/ui/page-container";
import { ProfileForms } from "./profile-form";

export default async function ProfilePage() {
  const user = await requireUser();

  return (
    <PageContainer className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-neutral-100">
        Настройки профиля
      </h1>
      <ProfileForms username={user.username} name={user.name} />
    </PageContainer>
  );
}
