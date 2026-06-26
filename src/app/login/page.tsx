import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const user = await getSession();
  if (user) redirect("/dashboard");

  return (
    <main className="flex min-h-screen flex-1 items-center justify-center bg-neutral-950 px-4">
      <LoginForm />
    </main>
  );
}
