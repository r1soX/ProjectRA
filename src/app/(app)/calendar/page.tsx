import { requireUser } from "@/lib/auth";
import { getCalendarTasks } from "@/lib/calendar";
import { hasPerm, PERMS } from "@/lib/permissions";
import { AccessDenied } from "@/components/ui/access-denied";
import { CalendarClient } from "./calendar-client";

export default async function CalendarPage() {
  const me = await requireUser();
  if (!(await hasPerm(me.id, me.role, PERMS.TASK_VIEW))) {
    return <AccessDenied message="У вас нет прав на просмотр задач." />;
  }
  const tasks = await getCalendarTasks(me.id, me.role === "ADMIN");

  return (
    <CalendarClient
      tasks={tasks}
      currentUserId={me.id}
      isAdmin={me.role === "ADMIN"}
    />
  );
}
