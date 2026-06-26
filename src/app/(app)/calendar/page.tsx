import { requireUser } from "@/lib/auth";
import { getCalendarTasks } from "@/lib/calendar";
import { CalendarClient } from "./calendar-client";

export default async function CalendarPage() {
  const me = await requireUser();
  const tasks = await getCalendarTasks(me.id, me.role === "ADMIN");

  return (
    <CalendarClient
      tasks={tasks}
      currentUserId={me.id}
      isAdmin={me.role === "ADMIN"}
    />
  );
}
