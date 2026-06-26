import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Aurora } from "@/components/visual/aurora";
import { LoginForm } from "./login-form";
import { BrandPanel } from "./brand-panel";

export default async function LoginPage() {
  const user = await getSession();
  if (user) redirect("/dashboard");

  return (
    <main className="relative flex min-h-screen bg-neutral-950">
      {/* Left brand panel (desktop only) */}
      <section className="relative hidden flex-1 overflow-hidden border-r border-white/5 p-12 lg:block">
        <Aurora />
        <BrandPanel />
      </section>

      {/* Right: form */}
      <section className="relative flex w-full items-center justify-center overflow-hidden px-4 py-10 lg:w-[clamp(420px,38vw,560px)]">
        <Aurora className="lg:hidden" />
        <div className="relative z-10 w-full max-w-sm rounded-2xl border border-white/10 bg-neutral-900/60 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
