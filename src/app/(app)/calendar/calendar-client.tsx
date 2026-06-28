"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import { PRIORITY_META, normalizePriority } from "@/lib/priority";
import { setTaskDue } from "../boards/actions";
import type { CalendarTask } from "@/lib/calendar";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function keyOf(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function startOfWeek(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // Monday-first
  return x;
}

type CalView = "month" | "week" | "day";

export function CalendarClient({
  tasks: initial,
  currentUserId,
  isAdmin,
}: {
  tasks: CalendarTask[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initial);
  const [anchor, setAnchor] = useState(() => new Date());
  const [view, setView] = useState<CalView>("month");
  useEffect(() => {
    try {
      const v = localStorage.getItem("projectra:cal-view");
      if (v === "week" || v === "day" || v === "month") setView(v);
    } catch {
      /* ignore */
    }
  }, []);
  function changeView(v: CalView) {
    setView(v);
    try {
      localStorage.setItem("projectra:cal-view", v);
    } catch {
      /* ignore */
    }
  }
  const [active, setActive] = useState<CalendarTask | null>(null);
  const [selected, setSelected] = useState<CalendarTask | null>(null);
  const [dayOpen, setDayOpen] = useState<string | null>(null);
  const [, start] = useTransition();

  useEffect(() => {
    const es = new EventSource("/api/calendar/stream");
    es.addEventListener("change", () => router.refresh());
    return () => es.close();
  }, [router]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 220, tolerance: 8 },
    }),
  );

  // Re-sync when server sends new data.
  const sig = useMemo(
    () => initial.map((t) => `${t.id}:${t.dueDate}`).join("|"),
    [initial],
  );
  useEffect(() => {
    setTasks(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  const byDay = useMemo(() => {
    const m = new Map<string, CalendarTask[]>();
    for (const t of tasks) {
      const arr = m.get(t.dueDate) ?? [];
      arr.push(t);
      m.set(t.dueDate, arr);
    }
    return m;
  }, [tasks]);

  const cells = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(anchor));
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [anchor]);

  const weekDays = useMemo(() => {
    const ws = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  }, [anchor]);

  const todayKey = keyOf(new Date());

  function navigate(delta: number) {
    if (view === "month") setAnchor(addMonths(anchor, delta));
    else if (view === "week") setAnchor(addDays(anchor, delta * 7));
    else setAnchor(addDays(anchor, delta));
  }

  const title =
    view === "month"
      ? anchor.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })
      : view === "day"
        ? anchor.toLocaleDateString("ru-RU", {
            day: "2-digit",
            month: "long",
            weekday: "long",
          })
        : (() => {
            const ws = startOfWeek(anchor);
            const we = addDays(ws, 6);
            return `${ws.getDate()} ${ws.toLocaleDateString("ru-RU", { month: "short" })} — ${we.getDate()} ${we.toLocaleDateString("ru-RU", { month: "short", year: "numeric" })}`;
          })();

  function canModify(t: CalendarTask) {
    return isAdmin || t.createdById === currentUserId;
  }

  function onDragStart(e: DragStartEvent) {
    setActive((e.active.data.current?.task as CalendarTask) ?? null);
  }
  function onDragEnd(e: DragEndEvent) {
    const task = e.active.data.current?.task as CalendarTask | undefined;
    setActive(null);
    if (!task || !e.over) return;
    const toDay = String(e.over.id);
    if (toDay === task.dueDate || !canModify(task)) return;
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, dueDate: toDay } : t)),
    );
    start(() => setTaskDue(task.id, toDay));
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
        <h1 className="min-w-0 truncate text-base font-bold capitalize text-neutral-100 sm:text-lg">
          {title}
        </h1>

        <div className="flex items-center gap-0.5 rounded-lg border border-neutral-700 bg-neutral-800/60 p-0.5 text-xs">
          {(
            [
              ["month", "Месяц"],
              ["week", "Неделя"],
              ["day", "День"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              onClick={() => changeView(v)}
              className={cn(
                "rounded-md px-2.5 py-1 transition",
                view === v
                  ? "bg-white/10 text-neutral-100"
                  : "text-neutral-500 hover:text-neutral-300",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setAnchor(new Date())}>
            Сегодня
          </Button>
          <Button size="sm" variant="ghost" onClick={() => navigate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Weekday row (month & week) */}
      {view !== "day" && (
        <div className="grid grid-cols-7 border-b border-white/10 text-center text-xs text-neutral-500">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-2">
              {w}
            </div>
          ))}
        </div>
      )}

      {/* Grid */}
      <DndContext
        id="calendar-dnd"
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        {view === "month" ? (
          <div className="grid flex-1 grid-cols-7 grid-rows-6 overflow-y-auto">
            {cells.map((d) => {
              const k = keyOf(d);
              return (
                <DayCell
                  key={k}
                  dateKey={k}
                  day={d.getDate()}
                  inMonth={d.getMonth() === anchor.getMonth()}
                  isToday={k === todayKey}
                  tasks={byDay.get(k) ?? []}
                  onOpenTask={setSelected}
                  onMore={() => setDayOpen(k)}
                  canModify={canModify}
                />
              );
            })}
          </div>
        ) : view === "week" ? (
          <div className="grid flex-1 grid-cols-7 overflow-y-auto">
            {weekDays.map((d) => {
              const k = keyOf(d);
              return (
                <WeekColumn
                  key={k}
                  dateKey={k}
                  day={d.getDate()}
                  isToday={k === todayKey}
                  tasks={byDay.get(k) ?? []}
                  onOpenTask={setSelected}
                  canModify={canModify}
                />
              );
            })}
          </div>
        ) : (
          <DayView
            dateKey={keyOf(anchor)}
            tasks={byDay.get(keyOf(anchor)) ?? []}
            onOpenTask={setSelected}
          />
        )}

        <DragOverlay>
          {active && (
            <div className="w-40">
              <ChipBody task={active} dragging />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <TaskDetailModal
        task={selected}
        canModify={selected ? canModify(selected) : false}
        onClose={() => setSelected(null)}
        onReschedule={(date) => {
          if (!selected) return;
          setTasks((prev) =>
            prev.map((t) =>
              t.id === selected.id ? { ...t, dueDate: date } : t,
            ),
          );
          start(() => setTaskDue(selected.id, date));
          setSelected((s) => (s ? { ...s, dueDate: date } : s));
        }}
      />

      <DayModal
        dateKey={dayOpen}
        tasks={dayOpen ? (byDay.get(dayOpen) ?? []) : []}
        onClose={() => setDayOpen(null)}
        onOpenTask={(t) => {
          setDayOpen(null);
          setSelected(t);
        }}
      />
    </div>
  );
}

function DayCell({
  dateKey,
  day,
  inMonth,
  isToday,
  tasks,
  onOpenTask,
  onMore,
  canModify,
}: {
  dateKey: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  tasks: CalendarTask[];
  onOpenTask: (t: CalendarTask) => void;
  onMore: () => void;
  canModify: (t: CalendarTask) => boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dateKey });
  const visible = tasks.slice(0, 3);
  const more = tasks.length - visible.length;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[64px] flex-col gap-1 border-b border-r border-white/[0.06] p-1 sm:min-h-[110px] sm:p-1.5",
        !inMonth && "bg-neutral-950/40",
        isOver && "bg-sky-500/10 ring-1 ring-inset ring-sky-500/40",
      )}
    >
      <span
        className={cn(
          "inline-flex h-6 w-6 items-center justify-center self-start rounded-full text-xs sm:mb-0.5",
          isToday
            ? "bg-sky-500 font-semibold text-white"
            : inMonth
              ? "text-neutral-400"
              : "text-neutral-700",
        )}
      >
        {day}
      </span>

      {/* Tablet / desktop: full chips */}
      <div className="hidden flex-col gap-1 sm:flex">
        {visible.map((t) => (
          <TaskChip
            key={t.id}
            task={t}
            draggable={canModify(t)}
            onOpen={() => onOpenTask(t)}
          />
        ))}
        {more > 0 && (
          <button
            onClick={onMore}
            className="rounded px-1 text-left text-[11px] text-neutral-500 hover:text-neutral-300"
          >
            +{more} ещё
          </button>
        )}
      </div>

      {/* Mobile: dots, tap the day to see the list */}
      {tasks.length > 0 && (
        <button
          onClick={onMore}
          className="mt-auto flex flex-wrap gap-1 p-0.5 sm:hidden"
          aria-label="Задачи дня"
        >
          {tasks.slice(0, 8).map((t, i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full"
              style={{
                backgroundColor:
                  t.color ?? PRIORITY_META[normalizePriority(t.priority)].bar,
              }}
            />
          ))}
        </button>
      )}
    </div>
  );
}

function WeekColumn({
  dateKey,
  day,
  isToday,
  tasks,
  onOpenTask,
  canModify,
}: {
  dateKey: string;
  day: number;
  isToday: boolean;
  tasks: CalendarTask[];
  onOpenTask: (t: CalendarTask) => void;
  canModify: (t: CalendarTask) => boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dateKey });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-full flex-col gap-1 border-r border-white/[0.06] p-1.5",
        isOver && "bg-sky-500/10 ring-1 ring-inset ring-sky-500/40",
      )}
    >
      <span
        className={cn(
          "mb-1 inline-flex h-7 w-7 items-center justify-center self-start rounded-full text-sm",
          isToday ? "bg-sky-500 font-semibold text-white" : "text-neutral-400",
        )}
      >
        {day}
      </span>
      <div className="flex flex-col gap-1">
        {tasks.map((t) => (
          <TaskChip key={t.id} task={t} draggable={canModify(t)} onOpen={() => onOpenTask(t)} />
        ))}
        {tasks.length === 0 && (
          <span className="px-1 text-[11px] text-neutral-700">—</span>
        )}
      </div>
    </div>
  );
}

function DayView({
  dateKey,
  tasks,
  onOpenTask,
}: {
  dateKey: string;
  tasks: CalendarTask[];
  onOpenTask: (t: CalendarTask) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dateKey });
  return (
    <div
      ref={setNodeRef}
      className={cn("flex-1 overflow-y-auto p-4 sm:p-6", isOver && "bg-sky-500/[0.05]")}
    >
      <div className="mx-auto max-w-2xl space-y-1.5">
        {tasks.length === 0 ? (
          <p className="py-16 text-center text-sm text-neutral-500">
            На этот день задач нет.
          </p>
        ) : (
          tasks.map((t) => (
            <button key={t.id} onClick={() => onOpenTask(t)} className="block w-full text-left">
              <ChipBody task={t} />
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function TaskChip({
  task,
  draggable,
  onOpen,
}: {
  task: CalendarTask;
  draggable: boolean;
  onOpen: () => void;
}) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: task.id,
    data: { task },
    disabled: !draggable,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      className={cn(
        "cursor-pointer select-none",
        isDragging && "opacity-40",
      )}
    >
      <ChipBody task={task} />
    </div>
  );
}

function ChipBody({
  task,
  dragging,
}: {
  task: CalendarTask;
  dragging?: boolean;
}) {
  const pr = PRIORITY_META[normalizePriority(task.priority)];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdue = new Date(task.dueDate) < today;
  return (
    <div
      className={cn(
        "flex items-center gap-1 overflow-hidden rounded border-l-2 px-1.5 py-1 text-[11px]",
        overdue
          ? "bg-red-500/15 text-red-200 ring-1 ring-red-500/40"
          : "bg-neutral-800/80 text-neutral-200",
        dragging && "border border-sky-500/50 shadow-xl",
      )}
      style={{ borderLeftColor: overdue ? "#ef4444" : (task.color ?? pr.bar) }}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", overdue ? "bg-red-400" : pr.dot)} />
      <span className="truncate">{task.title}</span>
    </div>
  );
}

function TaskDetailModal({
  task,
  canModify,
  onClose,
  onReschedule,
}: {
  task: CalendarTask | null;
  canModify: boolean;
  onClose: () => void;
  onReschedule: (date: string) => void;
}) {
  const pr = task ? PRIORITY_META[normalizePriority(task.priority)] : null;
  return (
    <Modal open={!!task} onClose={onClose} title="Задача">
      {task && pr && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium",
                pr.badge,
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", pr.dot)} />
              {pr.label}
            </span>
            <span
              className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-neutral-300"
              style={{ backgroundColor: task.boardColor + "22" }}
            >
              {task.boardTitle}
            </span>
          </div>

          <p className="text-base font-medium text-neutral-100">{task.title}</p>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="mb-1 text-xs text-neutral-500">Срок</p>
              {canModify ? (
                <input
                  type="date"
                  defaultValue={task.dueDate}
                  onChange={(e) =>
                    e.target.value && onReschedule(e.target.value)
                  }
                  className="h-9 w-full rounded-lg border border-neutral-700 bg-neutral-900/60 px-2 text-sm text-neutral-100 [color-scheme:dark] focus:border-sky-500"
                />
              ) : (
                <p className="text-neutral-200">{task.dueDate}</p>
              )}
            </div>
            {task.assignees.length > 0 && (
              <div>
                <p className="mb-1 text-xs text-neutral-500">Исполнители</p>
                <div className="flex -space-x-1.5">
                  {task.assignees.map((a, i) => (
                    <Avatar
                      key={i}
                      image={a.avatar}
                      emoji={a.emoji}
                      initials={a.initials}
                      size={24}
                      className="rounded-full ring-2 ring-neutral-950"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <Link
            href={`/boards/${task.boardId}`}
            className="inline-flex items-center gap-1.5 text-sm text-sky-400 hover:text-sky-300"
          >
            <ExternalLink className="h-4 w-4" />
            Открыть доску
          </Link>
        </div>
      )}
    </Modal>
  );
}

function DayModal({
  dateKey,
  tasks,
  onClose,
  onOpenTask,
}: {
  dateKey: string | null;
  tasks: CalendarTask[];
  onClose: () => void;
  onOpenTask: (t: CalendarTask) => void;
}) {
  const title = dateKey
    ? new Date(dateKey).toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "long",
      })
    : "";
  return (
    <Modal open={!!dateKey} onClose={onClose} title={title}>
      <div className="space-y-1.5">
        <AnimatePresence>
          {tasks.map((t) => (
            <motion.button
              key={t.id}
              layout
              onClick={() => onOpenTask(t)}
              className="block w-full text-left"
            >
              <ChipBody task={t} />
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </Modal>
  );
}
