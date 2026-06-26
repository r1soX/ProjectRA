import "server-only";
import { prisma } from "./prisma";

// ── Permission keys ────────────────────────────────────────────────────────
// Format: "<resource>.<action>[.<scope>]"
// scope: "own" = only your own, "any" = any

export const PERMS = {
  // Boards
  BOARD_VIEW:           "board.view",
  BOARD_CREATE:         "board.create",
  BOARD_EDIT:           "board.edit",
  BOARD_DELETE:         "board.delete",
  BOARD_MANAGE_MEMBERS: "board.manage_members",

  // Tasks
  TASK_VIEW:        "task.view",
  TASK_CREATE:      "task.create",
  TASK_EDIT_OWN:    "task.edit.own",
  TASK_EDIT_ANY:    "task.edit.any",
  TASK_DELETE_OWN:  "task.delete.own",
  TASK_DELETE_ANY:  "task.delete.any",
  TASK_MOVE:        "task.move",
  TASK_ASSIGN:      "task.assign",
  TASK_COMPLETE:    "task.complete",

  // Comments
  COMMENT_VIEW:       "comment.view",
  COMMENT_CREATE:     "comment.create",
  COMMENT_EDIT_OWN:   "comment.edit.own",
  COMMENT_EDIT_ANY:   "comment.edit.any",
  COMMENT_DELETE_OWN: "comment.delete.own",
  COMMENT_DELETE_ANY: "comment.delete.any",

  // Messages
  MESSAGE_VIEW:       "message.view",
  MESSAGE_SEND:       "message.send",
  MESSAGE_EDIT_OWN:   "message.edit.own",
  MESSAGE_DELETE_OWN: "message.delete.own",
  MESSAGE_DELETE_ANY: "message.delete.any",

  // Columns
  COLUMN_CREATE:  "column.create",
  COLUMN_EDIT:    "column.edit",
  COLUMN_DELETE:  "column.delete",

  // Labels
  LABEL_CREATE: "label.create",
  LABEL_EDIT:   "label.edit",
  LABEL_DELETE: "label.delete",

  // Files & attachments
  FILE_UPLOAD: "file.upload",
  FILE_VIEW:   "file.view",

  // Time tracking
  TIME_LOG:       "time.log",
  TIME_VIEW_OWN:  "time.view.own",
  TIME_VIEW_ALL:  "time.view.all",
  TIME_EDIT_OWN:  "time.edit.own",
  TIME_DELETE_OWN:"time.delete.own",

  // Export
  EXPORT_BOARD: "export.board",
  EXPORT_TASKS: "export.tasks",

  // Admin
  ADMIN_USERS_VIEW:        "admin.users.view",
  ADMIN_USERS_CREATE:      "admin.users.create",
  ADMIN_USERS_EDIT:        "admin.users.edit",
  ADMIN_USERS_DELETE:      "admin.users.delete",
  ADMIN_USERS_ACTIVATE:    "admin.users.activate",
  ADMIN_PERMISSIONS_MANAGE:"admin.permissions.manage",
  ADMIN_TEMPLATES_MANAGE:  "admin.templates.manage",
} as const;

export type PermKey = (typeof PERMS)[keyof typeof PERMS];

// ── Default permissions per role ───────────────────────────────────────────

const USER_DEFAULTS: PermKey[] = [
  PERMS.BOARD_VIEW, PERMS.BOARD_CREATE, PERMS.BOARD_EDIT, PERMS.BOARD_DELETE,
  PERMS.BOARD_MANAGE_MEMBERS,
  PERMS.TASK_VIEW, PERMS.TASK_CREATE, PERMS.TASK_EDIT_OWN, PERMS.TASK_EDIT_ANY,
  PERMS.TASK_DELETE_OWN, PERMS.TASK_MOVE, PERMS.TASK_ASSIGN, PERMS.TASK_COMPLETE,
  PERMS.COMMENT_VIEW, PERMS.COMMENT_CREATE,
  PERMS.COMMENT_EDIT_OWN, PERMS.COMMENT_DELETE_OWN,
  PERMS.MESSAGE_VIEW, PERMS.MESSAGE_SEND,
  PERMS.MESSAGE_EDIT_OWN, PERMS.MESSAGE_DELETE_OWN,
  PERMS.COLUMN_CREATE, PERMS.COLUMN_EDIT, PERMS.COLUMN_DELETE,
  PERMS.LABEL_CREATE, PERMS.LABEL_EDIT, PERMS.LABEL_DELETE,
  PERMS.FILE_UPLOAD, PERMS.FILE_VIEW,
  PERMS.TIME_LOG, PERMS.TIME_VIEW_OWN, PERMS.TIME_EDIT_OWN, PERMS.TIME_DELETE_OWN,
  PERMS.EXPORT_BOARD, PERMS.EXPORT_TASKS,
];

const ADMIN_EXTRAS: PermKey[] = [
  PERMS.TASK_EDIT_ANY, PERMS.TASK_DELETE_ANY,
  PERMS.COMMENT_EDIT_ANY, PERMS.COMMENT_DELETE_ANY,
  PERMS.MESSAGE_DELETE_ANY,
  PERMS.TIME_VIEW_ALL,
  PERMS.ADMIN_USERS_VIEW, PERMS.ADMIN_USERS_CREATE, PERMS.ADMIN_USERS_EDIT,
  PERMS.ADMIN_USERS_DELETE, PERMS.ADMIN_USERS_ACTIVATE,
  PERMS.ADMIN_PERMISSIONS_MANAGE, PERMS.ADMIN_TEMPLATES_MANAGE,
];

const ADMIN_DEFAULTS: PermKey[] = [...USER_DEFAULTS, ...ADMIN_EXTRAS];

function roleDefaults(role: string): Set<PermKey> {
  return new Set(role === "ADMIN" ? ADMIN_DEFAULTS : USER_DEFAULTS);
}

// ── Cache (simple in-memory, invalidated on change) ───────────────────────

const cache = new Map<string, Set<PermKey>>();

export function invalidatePermCache(userId?: string) {
  if (userId) cache.delete(userId);
  else cache.clear();
}

// ── Main check function ───────────────────────────────────────────────────

export async function hasPerm(
  userId: string,
  role: string,
  perm: PermKey,
): Promise<boolean> {
  // 1. Try cache
  let userPerms = cache.get(userId);
  if (!userPerms) {
    userPerms = await buildPermSet(userId, role);
    cache.set(userId, userPerms);
  }
  return userPerms.has(perm);
}

async function buildPermSet(userId: string, role: string): Promise<Set<PermKey>> {
  const defaults = roleDefaults(role);

  // Load role-level overrides from DB
  const roleOverrides = await prisma.rolePermission.findMany({ where: { role } });
  for (const r of roleOverrides) {
    const p = r.perm as PermKey;
    if (r.granted) defaults.add(p);
    else defaults.delete(p);
  }

  // Load user-level overrides from DB
  const userOverrides = await prisma.userPermission.findMany({ where: { userId } });
  for (const u of userOverrides) {
    const p = u.perm as PermKey;
    if (u.granted) defaults.add(p);
    else defaults.delete(p);
  }

  return defaults;
}

// ── Get all perms for a user (for admin UI) ───────────────────────────────

export async function getUserPermMap(
  userId: string,
  role: string,
): Promise<Record<PermKey, boolean>> {
  const set = await buildPermSet(userId, role);
  return Object.fromEntries(
    Object.values(PERMS).map((p) => [p, set.has(p as PermKey)])
  ) as Record<PermKey, boolean>;
}

// ── Get role-level perm map ───────────────────────────────────────────────

export async function getRolePermMap(role: string): Promise<Record<PermKey, boolean>> {
  const defaults = roleDefaults(role);
  const overrides = await prisma.rolePermission.findMany({ where: { role } });
  for (const r of overrides) {
    const p = r.perm as PermKey;
    if (r.granted) defaults.add(p);
    else defaults.delete(p);
  }
  return Object.fromEntries(
    Object.values(PERMS).map((p) => [p, defaults.has(p as PermKey)])
  ) as Record<PermKey, boolean>;
}

// ── Save overrides ────────────────────────────────────────────────────────

export async function setUserPerm(userId: string, perm: PermKey, granted: boolean | null) {
  if (granted === null) {
    await prisma.userPermission.deleteMany({ where: { userId, perm } });
  } else {
    await prisma.userPermission.upsert({
      where: { userId_perm: { userId, perm } },
      create: { userId, perm, granted },
      update: { granted },
    });
  }
  invalidatePermCache(userId);
}

export async function setRolePerm(role: string, perm: PermKey, granted: boolean | null) {
  if (granted === null) {
    await prisma.rolePermission.deleteMany({ where: { role, perm } });
  } else {
    await prisma.rolePermission.upsert({
      where: { role_perm: { role, perm } },
      create: { role, perm, granted },
      update: { granted },
    });
  }
  invalidatePermCache();
}

// ── Human-readable labels ─────────────────────────────────────────────────

export const PERM_GROUPS: {
  group: string;
  items: { perm: PermKey; label: string }[];
}[] = [
  {
    group: "Доски",
    items: [
      { perm: PERMS.BOARD_VIEW,           label: "Просматривать доски" },
      { perm: PERMS.BOARD_CREATE,         label: "Создавать доски" },
      { perm: PERMS.BOARD_EDIT,           label: "Редактировать доски" },
      { perm: PERMS.BOARD_DELETE,         label: "Удалять доски" },
      { perm: PERMS.BOARD_MANAGE_MEMBERS, label: "Управлять участниками" },
    ],
  },
  {
    group: "Задачи",
    items: [
      { perm: PERMS.TASK_VIEW,       label: "Просматривать задачи" },
      { perm: PERMS.TASK_CREATE,     label: "Создавать задачи" },
      { perm: PERMS.TASK_EDIT_OWN,   label: "Редактировать свои задачи" },
      { perm: PERMS.TASK_EDIT_ANY,   label: "Редактировать любые задачи" },
      { perm: PERMS.TASK_DELETE_OWN, label: "Удалять свои задачи" },
      { perm: PERMS.TASK_DELETE_ANY, label: "Удалять любые задачи" },
      { perm: PERMS.TASK_MOVE,       label: "Перемещать задачи" },
      { perm: PERMS.TASK_ASSIGN,     label: "Назначать исполнителей" },
      { perm: PERMS.TASK_COMPLETE,   label: "Завершать задачи" },
    ],
  },
  {
    group: "Комментарии",
    items: [
      { perm: PERMS.COMMENT_VIEW,       label: "Просматривать комментарии" },
      { perm: PERMS.COMMENT_CREATE,     label: "Писать комментарии" },
      { perm: PERMS.COMMENT_EDIT_OWN,   label: "Редактировать свои" },
      { perm: PERMS.COMMENT_EDIT_ANY,   label: "Редактировать любые" },
      { perm: PERMS.COMMENT_DELETE_OWN, label: "Удалять свои" },
      { perm: PERMS.COMMENT_DELETE_ANY, label: "Удалять любые" },
    ],
  },
  {
    group: "Сообщения",
    items: [
      { perm: PERMS.MESSAGE_VIEW,       label: "Просматривать сообщения" },
      { perm: PERMS.MESSAGE_SEND,       label: "Отправлять сообщения" },
      { perm: PERMS.MESSAGE_EDIT_OWN,   label: "Редактировать свои" },
      { perm: PERMS.MESSAGE_DELETE_OWN, label: "Удалять свои" },
      { perm: PERMS.MESSAGE_DELETE_ANY, label: "Удалять любые" },
    ],
  },
  {
    group: "Колонки",
    items: [
      { perm: PERMS.COLUMN_CREATE, label: "Создавать колонки" },
      { perm: PERMS.COLUMN_EDIT,   label: "Переименовывать колонки" },
      { perm: PERMS.COLUMN_DELETE, label: "Удалять колонки" },
    ],
  },
  {
    group: "Метки",
    items: [
      { perm: PERMS.LABEL_CREATE, label: "Создавать метки" },
      { perm: PERMS.LABEL_EDIT,   label: "Редактировать метки" },
      { perm: PERMS.LABEL_DELETE, label: "Удалять метки" },
    ],
  },
  {
    group: "Файлы",
    items: [
      { perm: PERMS.FILE_UPLOAD, label: "Загружать файлы" },
      { perm: PERMS.FILE_VIEW,   label: "Просматривать файлы" },
    ],
  },
  {
    group: "Учёт времени",
    items: [
      { perm: PERMS.TIME_LOG,        label: "Вносить время" },
      { perm: PERMS.TIME_VIEW_OWN,   label: "Видеть своё время" },
      { perm: PERMS.TIME_VIEW_ALL,   label: "Видеть время всех" },
      { perm: PERMS.TIME_EDIT_OWN,   label: "Редактировать свои записи" },
      { perm: PERMS.TIME_DELETE_OWN, label: "Удалять свои записи" },
    ],
  },
  {
    group: "Экспорт",
    items: [
      { perm: PERMS.EXPORT_BOARD, label: "Экспорт доски" },
      { perm: PERMS.EXPORT_TASKS, label: "Экспорт задач" },
    ],
  },
  {
    group: "Администрирование",
    items: [
      { perm: PERMS.ADMIN_USERS_VIEW,         label: "Просматривать пользователей" },
      { perm: PERMS.ADMIN_USERS_CREATE,       label: "Создавать пользователей" },
      { perm: PERMS.ADMIN_USERS_EDIT,         label: "Редактировать пользователей" },
      { perm: PERMS.ADMIN_USERS_DELETE,       label: "Удалять пользователей" },
      { perm: PERMS.ADMIN_USERS_ACTIVATE,     label: "Активировать / деактивировать" },
      { perm: PERMS.ADMIN_PERMISSIONS_MANAGE, label: "Управлять правами" },
      { perm: PERMS.ADMIN_TEMPLATES_MANAGE,   label: "Управлять шаблонами досок" },
    ],
  },
];
