import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center bg-neutral-950 text-neutral-100">
      <div className="max-w-xl px-6 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900 px-4 py-1.5 text-sm text-neutral-400">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Этап 0 · каркас готов
        </div>
        <h1 className="bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-6xl font-bold tracking-tight text-transparent">
          Tandem
        </h1>
        <p className="mt-4 text-lg text-neutral-400">
          Командный таск-менеджер: доски с перетягиванием, мессенджер, календарь,
          визуальные связи задач и общая работа.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/login"
            className="rounded-lg bg-sky-500 px-5 py-2.5 font-medium text-white transition hover:bg-sky-400"
          >
            Войти
          </Link>
          <span className="text-sm text-neutral-600">
            Регистрация — только через администратора
          </span>
        </div>
      </div>
    </main>
  );
}
