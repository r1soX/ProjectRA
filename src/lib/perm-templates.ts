export const PERM_TEMPLATES = {
  standard: {
    label: "Стандарт",
    description: "Сбросить к правам роли по умолчанию",
    color: "text-neutral-200",
    bg: "bg-white/[0.05]",
    border: "border-white/15",
  },
  observer: {
    label: "Наблюдатель",
    description: "Только просмотр",
    color: "text-neutral-400",
    bg: "bg-neutral-800/60",
    border: "border-neutral-700",
  },
  commenter: {
    label: "Комментатор",
    description: "Просмотр + комментарии и чат",
    color: "text-cyan-300",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/30",
  },
  executor: {
    label: "Исполнитель",
    description: "Задачи и комментарии",
    color: "text-sky-300",
    bg: "bg-sky-500/10",
    border: "border-sky-500/30",
  },
  manager: {
    label: "Менеджер",
    description: "Полный доступ пользователя",
    color: "text-emerald-300",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
  },
  lead: {
    label: "Руководитель",
    description: "Менеджер + любые правки, экспорт, всё время",
    color: "text-violet-300",
    bg: "bg-violet-500/10",
    border: "border-violet-500/30",
  },
} as const;

export type PermTemplateKey = keyof typeof PERM_TEMPLATES;

/** "standard" is special — it resets to role defaults instead of applying a set. */
export type PermTemplateSetKey = Exclude<PermTemplateKey, "standard">;
