export const PERM_TEMPLATES = {
  observer: {
    label: "Наблюдатель",
    description: "Только просмотр",
    color: "text-neutral-400",
    bg: "bg-neutral-800/60",
    border: "border-neutral-700",
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
} as const;

export type PermTemplateKey = keyof typeof PERM_TEMPLATES;
