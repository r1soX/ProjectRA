import "server-only";
import { prisma } from "./prisma";

/** Record an admin action. Never throws — auditing must not break the action. */
export async function logAudit(
  userId: string,
  action: string,
  target?: string | null,
  meta?: Record<string, unknown>,
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        target: target ?? null,
        meta: meta ? JSON.stringify(meta) : null,
      },
    });
  } catch {
    /* ignore audit failures */
  }
}

export const AUDIT_LABELS: Record<string, string> = {
  "user.create": "Создал пользователя",
  "user.delete": "Удалил пользователя",
  "user.role": "Изменил роль",
  "user.activate": "Сменил активность",
  "user.reset_password": "Сбросил пароль",
  "perm.role": "Изменил право роли",
  "perm.user": "Изменил право пользователя",
  "perm.template": "Применил шаблон прав",
  "template.create": "Создал шаблон доски",
  "template.update": "Изменил шаблон доски",
  "template.delete": "Удалил шаблон доски",
};
