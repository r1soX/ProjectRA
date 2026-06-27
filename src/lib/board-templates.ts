import "server-only";
import { prisma } from "./prisma";

/** Built-in board templates seeded once, marked isSystem (read-only in the UI). */
export const SYSTEM_BOARD_TEMPLATES: {
  name: string;
  description: string;
  columns: string[];
}[] = [
  {
    name: "Канбан",
    description: "Классическая доска: к работе → в процессе → готово",
    columns: ["К работе", "В процессе", "Готово"],
  },
  {
    name: "Спринт разработки",
    description: "Скрам-спринт от бэклога до готового",
    columns: ["Бэклог", "В работе", "Ревью", "Тестирование", "Готово"],
  },
  {
    name: "Баг-трекер",
    description: "Отслеживание и разбор ошибок",
    columns: ["Новые", "Подтверждённые", "В работе", "На проверке", "Закрыты"],
  },
  {
    name: "Контент-план",
    description: "Производство контента",
    columns: ["Идеи", "В работе", "На согласовании", "Запланировано", "Опубликовано"],
  },
  {
    name: "Воронка продаж",
    description: "CRM-пайплайн сделок",
    columns: ["Лиды", "Контакт", "Презентация", "Переговоры", "Сделка"],
  },
  {
    name: "Найм",
    description: "Подбор и наём сотрудников",
    columns: ["Отклики", "Скрининг", "Интервью", "Оффер", "Принят"],
  },
  {
    name: "Личные задачи",
    description: "Простой список дел",
    columns: ["Сегодня", "На неделе", "Когда-нибудь", "Сделано"],
  },
];

/**
 * Seed the built-in templates once. Idempotent: does nothing if any system
 * template already exists.
 */
export async function ensureSystemBoardTemplates() {
  const existing = await prisma.boardTemplate.findFirst({
    where: { isSystem: true },
    select: { id: true },
  });
  if (existing) return;

  const owner = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  if (!owner) return; // no admin yet → nothing to attribute them to

  for (const t of SYSTEM_BOARD_TEMPLATES) {
    await prisma.boardTemplate.create({
      data: {
        name: t.name,
        description: t.description,
        isSystem: true,
        createdById: owner.id,
        columns: { create: t.columns.map((title, i) => ({ title, order: i })) },
      },
    });
  }
}
