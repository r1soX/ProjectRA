import Link from "next/link";
import { Aurora } from "@/components/visual/aurora";

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-neutral-950 px-4 text-center">
      <Aurora />
      <div className="relative z-10">
        <p className="bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-7xl font-black text-transparent">
          404
        </p>
        <h1 className="mt-4 text-2xl font-bold text-neutral-100">
          Страница не найдена
        </h1>
        <p className="mt-2 text-neutral-400">
          Возможно, ссылка устарела или у вас нет доступа.
        </p>
        <Link
          href="/dashboard"
          className="mt-8 inline-flex rounded-xl bg-sky-500 px-6 py-3 font-medium text-white transition hover:bg-sky-400"
        >
          На главную
        </Link>
      </div>
    </main>
  );
}
