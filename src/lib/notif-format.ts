import {
  Bell,
  MessageCircle,
  AtSign,
  CalendarClock,
  UserPlus,
  CheckCheck,
} from "lucide-react";

export type NotifType =
  | "message"
  | "mention_comment"
  | "mention_message"
  | "deadline"
  | "task_assigned"
  | "task_completed"
  | "task_moved";

export function notifMeta(
  type: NotifType,
  payload: Record<string, unknown>,
): { icon: React.ElementType; color: string; title: string; body: string } {
  const from = String(payload.fromName ?? "");
  const task = String(payload.taskTitle ?? "");
  const board = String(payload.boardTitle ?? "");
  const days = Number(payload.daysLeft ?? 0);
  const dueTime = payload.dueTime ? String(payload.dueTime) : "";

  switch (type) {
    case "mention_comment":
      return {
        icon: AtSign,
        color: "text-sky-400",
        title: "Упоминание в комментарии",
        body: `${from} упомянул вас в задаче «${task}»`,
      };
    case "mention_message":
      return {
        icon: AtSign,
        color: "text-sky-400",
        title: "Упоминание в сообщении",
        body: `${from} упомянул вас в чате`,
      };
    case "task_assigned":
      return {
        icon: UserPlus,
        color: "text-emerald-400",
        title: "Вас назначили исполнителем",
        body: `${from} назначил вас на «${task}»`,
      };
    case "task_completed":
      return {
        icon: CheckCheck,
        color: "text-emerald-400",
        title: "Задача завершена",
        body: `«${task}» завершена`,
      };
    case "deadline":
      return {
        icon: CalendarClock,
        color: "text-amber-400",
        title:
          (days < 0
            ? "Просрочено!"
            : days === 0
              ? "Дедлайн сегодня"
              : `Дедлайн ${days === 1 ? "завтра" : `через ${days} дн.`}`) +
          (dueTime ? ` · ${dueTime}` : ""),
        body: `«${task}»${board ? ` · ${board}` : ""}`,
      };
    case "message":
      return {
        icon: MessageCircle,
        color: "text-indigo-400",
        title: "Новое сообщение",
        body: String(payload.preview ?? ""),
      };
    default:
      return {
        icon: Bell,
        color: "text-neutral-400",
        title: "Уведомление",
        body: task,
      };
  }
}

export function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "только что";
  if (mins < 60) return `${mins} мин назад`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ч назад`;
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
}
