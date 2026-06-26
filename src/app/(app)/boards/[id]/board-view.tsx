"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Users as UsersIcon,
  Lock,
  GripVertical,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  createColumn,
  renameColumn,
  deleteColumn,
  createTask,
  deleteBoard,
  moveTask,
  reorderColumns,
} from "../actions";
import { useConfirm, usePrompt } from "@/components/ui/dialog-provider";
import { TaskModal } from "./task-modal";
import { MembersModal } from "./members-modal";
import { BoardSettingsModal } from "./board-settings-modal";
import { TaskCardBody } from "./task-card-body";

export type BoardMemberView = {
  userId: string;
  role: string;
  shortName: string;
  initials: string;
  username: string;
};
export type DirectoryUser = {
  id: string;
  fullName: string;
  username: string;
  initials: string;
};
export type BoardTask = {
  id: string;
  columnId: string;
  title: string;
  description: string | null;
  color: string | null;
  priority: string;
  isPersonal: boolean;
  startDate: string | null;
  dueDate: string | null;
  createdById: string;
  createdByName: string;
  assigneeIds: string[];
  assignees: { initials: string; shortName: string }[];
  labels: { id: string; name: string; color: string }[];
  comments: {
    id: string;
    body: string;
    authorName: string;
    authorInitials: string;
    userId: string;
    createdAt: string;
  }[];
  links: { otherTitle: string; type: string; direction: "out" | "in" }[];
};
export type BoardColumn = { id: string; title: string; tasks: BoardTask[] };

const DROP_PREFIX = "dropzone-";

export function BoardView({
  boardId,
  title,
  color,
  isPersonal,
  role,
  currentUserId,
  isAdmin,
  columns,
  members,
  assignable,
  directory,
}: {
  boardId: string;
  title: string;
  color: string;
  isPersonal: boolean;
  role: string;
  currentUserId: string;
  isAdmin: boolean;
  columns: BoardColumn[];
  members: BoardMemberView[];
  assignable: BoardMemberView[];
  directory: DirectoryUser[];
}) {
  const canEdit = role === "OWNER" || role === "EDITOR";
  const isOwner = role === "OWNER";

  const [cols, setCols] = useState<BoardColumn[]>(columns);
  const [activeTask, setActiveTask] = useState<BoardTask | null>(null);
  const [activeColumn, setActiveColumn] = useState<BoardColumn | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [, start] = useTransition();
  const router = useRouter();
  const confirm = useConfirm();
  const draggingRef = useRef(false);
  const pendingRefreshRef = useRef(false);

  function requestRefresh() {
    if (draggingRef.current) pendingRefreshRef.current = true;
    else router.refresh();
  }
  function flushRefresh() {
    draggingRef.current = false;
    if (pendingRefreshRef.current) {
      pendingRefreshRef.current = false;
      router.refresh();
    }
  }

  // Live updates: refresh server data when anyone changes this board.
  useEffect(() => {
    const es = new EventSource(`/api/boards/${boardId}/stream`);
    es.addEventListener("change", () => requestRefresh());
    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  // Re-sync local state when the server sends fresh data.
  const signature = useMemo(
    () =>
      JSON.stringify(
        columns.map((c) => [
          c.id,
          c.title,
          c.tasks.map((t) => [
            t.id,
            t.title,
            t.color,
            t.priority,
            t.startDate,
            t.dueDate,
            t.assigneeIds.join(","),
            t.labels.map((l) => l.id).join(","),
            t.comments.length,
          ]),
        ]),
      ),
    [columns],
  );
  useEffect(() => {
    setCols(columns);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const sensors = useSensors(
    // Desktop: start dragging after a small movement.
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    // Touch: press-and-hold to drag, so a normal swipe still scrolls.
    useSensor(TouchSensor, {
      activationConstraint: { delay: 220, tolerance: 8 },
    }),
  );

  const selectedTask = useMemo(
    () => cols.flatMap((c) => c.tasks).find((t) => t.id === selectedTaskId) ?? null,
    [cols, selectedTaskId],
  );

  function findTaskColumn(taskId: string): string | null {
    return cols.find((c) => c.tasks.some((t) => t.id === taskId))?.id ?? null;
  }
  function resolveColumn(overId: string): string | null {
    if (overId.startsWith(DROP_PREFIX)) return overId.slice(DROP_PREFIX.length);
    return findTaskColumn(overId);
  }

  function onDragStart(e: DragStartEvent) {
    draggingRef.current = true;
    const type = e.active.data.current?.type;
    if (type === "task") {
      setActiveTask(
        cols.flatMap((c) => c.tasks).find((t) => t.id === e.active.id) ?? null,
      );
    } else if (type === "column") {
      setActiveColumn(cols.find((c) => c.id === e.active.id) ?? null);
    }
  }

  function onDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over || active.data.current?.type !== "task") return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const fromCol = findTaskColumn(activeId);
    const toCol = resolveColumn(overId);
    if (!fromCol || !toCol || fromCol === toCol) return;

    setCols((prev) => {
      const from = prev.find((c) => c.id === fromCol);
      const to = prev.find((c) => c.id === toCol);
      if (!from || !to) return prev;
      const moving = from.tasks.find((t) => t.id === activeId);
      if (!moving) return prev;

      const overIndex = overId.startsWith(DROP_PREFIX)
        ? to.tasks.length
        : to.tasks.findIndex((t) => t.id === overId);
      const insertAt = overIndex < 0 ? to.tasks.length : overIndex;

      return prev.map((c) => {
        if (c.id === fromCol)
          return { ...c, tasks: c.tasks.filter((t) => t.id !== activeId) };
        if (c.id === toCol) {
          const next = [...c.tasks];
          next.splice(insertAt, 0, { ...moving, columnId: toCol });
          return { ...c, tasks: next };
        }
        return c;
      });
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    const activeType = active.data.current?.type;
    setActiveTask(null);
    setActiveColumn(null);

    // Compute next state, then update + persist OUTSIDE the state updater
    // (calling actions inside a setState updater is an illegal side effect).
    if (over && activeType === "column") {
      if (active.id !== over.id) {
        const oldI = cols.findIndex((c) => c.id === active.id);
        const newI = cols.findIndex((c) => c.id === over.id);
        if (oldI >= 0 && newI >= 0) {
          const next = arrayMove(cols, oldI, newI);
          setCols(next);
          start(() => reorderColumns(boardId, next.map((c) => c.id)));
        }
      }
    } else if (over && activeType === "task") {
      const activeId = String(active.id);
      const overId = String(over.id);
      const toCol = resolveColumn(overId);
      const col = toCol ? cols.find((c) => c.id === toCol) : null;
      if (toCol && col) {
        const oldIndex = col.tasks.findIndex((t) => t.id === activeId);
        if (oldIndex >= 0) {
          const newIndex = overId.startsWith(DROP_PREFIX)
            ? col.tasks.length - 1
            : col.tasks.findIndex((t) => t.id === overId);
          const tasks =
            newIndex >= 0 && newIndex !== oldIndex
              ? arrayMove(col.tasks, oldIndex, newIndex)
              : col.tasks;
          const next = cols.map((c) => (c.id === toCol ? { ...c, tasks } : c));
          setCols(next);
          start(() => moveTask(activeId, toCol, tasks.map((t) => t.id)));
        }
      }
    }

    flushRefresh();
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-neutral-800 px-4 py-3 sm:px-6">
        <Link
          href="/boards"
          className="rounded-md p-1.5 text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-200"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
        <h1 className="text-lg font-bold text-neutral-100">{title}</h1>
        <span
          className={cn(
            "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs",
            isPersonal
              ? "bg-neutral-800 text-neutral-400"
              : "bg-sky-500/15 text-sky-300",
          )}
        >
          {isPersonal ? <Lock className="h-3 w-3" /> : <UsersIcon className="h-3 w-3" />}
          {isPersonal ? "личная" : "общая"}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {members.length > 0 && (
            <div className="hidden -space-x-2 sm:flex">
              {members.slice(0, 5).map((m) => (
                <span
                  key={m.userId}
                  title={m.shortName}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-neutral-900 bg-gradient-to-br from-sky-500 to-indigo-500 text-[10px] font-semibold text-white"
                >
                  {m.initials}
                </span>
              ))}
            </div>
          )}
          {!isPersonal && (
            <span className="hidden items-center gap-1 rounded-full bg-sky-500/15 px-2.5 py-1 text-xs text-sky-300 sm:flex">
              <UsersIcon className="h-3 w-3" />
              доступна всем
            </span>
          )}
          <Link
            href={`/boards/${boardId}/links`}
            className="inline-flex h-8 items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800 px-3 text-sm text-neutral-100 transition hover:bg-neutral-700"
          >
            <Share2 className="h-4 w-4" />
            <span className="hidden sm:inline">Связи</span>
          </Link>
          {isOwner && isPersonal && (
            <Button size="sm" variant="secondary" onClick={() => setMembersOpen(true)}>
              <UsersIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Участники</span>
            </Button>
          )}
          {isOwner && (
            <>
              <Button
                size="sm"
                variant="ghost"
                title="Настройки доски"
                onClick={() => setSettingsOpen(true)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                title="Удалить доску"
                onClick={async () => {
                  const ok = await confirm({
                    title: "Удалить доску?",
                    message: "Доска и все её задачи будут удалены безвозвратно.",
                    confirmLabel: "Удалить",
                    danger: true,
                  });
                  if (ok) start(() => deleteBoard(boardId));
                }}
              >
                <Trash2 className="h-4 w-4 text-red-400" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Columns */}
      <DndContext
        id="board-dnd"
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setActiveTask(null);
          setActiveColumn(null);
          setCols(columns);
          flushRefresh();
        }}
      >
        <div className="flex flex-1 gap-4 overflow-x-auto overflow-y-hidden p-4 sm:p-6">
          <SortableContext
            items={cols.map((c) => c.id)}
            strategy={horizontalListSortingStrategy}
          >
            {cols.map((col) => (
              <SortableColumn
                key={col.id}
                column={col}
                canEdit={canEdit}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                onOpenTask={setSelectedTaskId}
              />
            ))}
          </SortableContext>
          {canEdit && <AddColumn boardId={boardId} />}
        </div>

        <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)" }}>
          {activeTask ? (
            <DanglingCard task={activeTask} />
          ) : activeColumn ? (
            <div className="w-[82vw] max-w-[19rem] rotate-2 rounded-xl border border-sky-500/40 bg-neutral-900/90 px-3 py-2.5 shadow-2xl sm:w-72">
              <span className="text-sm font-semibold text-neutral-200">
                {activeColumn.title}
              </span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <TaskModal
        task={selectedTask}
        members={assignable}
        canEdit={
          selectedTask
            ? isAdmin || selectedTask.createdById === currentUserId
            : false
        }
        currentUserId={currentUserId}
        canModerate={isOwner}
        canDelete={
          selectedTask
            ? isAdmin || selectedTask.createdById === currentUserId
            : false
        }
        onClose={() => setSelectedTaskId(null)}
      />
      <MembersModal
        open={membersOpen}
        boardId={boardId}
        members={members}
        directory={directory}
        onClose={() => setMembersOpen(false)}
      />
      <BoardSettingsModal
        open={settingsOpen}
        boardId={boardId}
        currentTitle={title}
        currentColor={color}
        currentIsPersonal={isPersonal}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}

/** The grabbed card hangs from the cursor and gently sways. */
function DanglingCard({ task }: { task: BoardTask }) {
  return (
    <div className="pointer-events-none w-[78vw] max-w-[17rem]">
      <div className="mx-auto h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_8px_2px_rgba(56,189,248,0.6)]" />
      <div className="mx-auto h-3 w-px bg-sky-400/70" />
      <motion.div
        animate={{ rotate: [-7, 7, -7] }}
        transition={{ repeat: Infinity, duration: 1.1, ease: "easeInOut" }}
        style={{ transformOrigin: "top center" }}
        className="overflow-hidden rounded-lg border border-sky-500/50 bg-neutral-800 shadow-2xl shadow-black/60 ring-2 ring-sky-500/30"
      >
        <TaskCardBody task={task} />
      </motion.div>
    </div>
  );
}

function SortableColumn({
  column,
  canEdit,
  currentUserId,
  isAdmin,
  onOpenTask,
}: {
  column: BoardColumn;
  canEdit: boolean;
  currentUserId: string;
  isAdmin: boolean;
  onOpenTask: (id: string) => void;
}) {
  const sortable = useSortable({
    id: column.id,
    data: { type: "column" },
    disabled: !canEdit,
  });
  const droppable = useDroppable({
    id: DROP_PREFIX + column.id,
    data: { type: "column", columnId: column.id },
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [, start] = useTransition();
  const confirm = useConfirm();
  const promptText = usePrompt();

  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };

  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      {...sortable.attributes}
      className={cn(
        "flex w-[82vw] max-w-[19rem] shrink-0 flex-col rounded-xl border border-neutral-800 bg-neutral-900/30 sm:w-72",
        sortable.isDragging && "opacity-40",
      )}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-1.5">
          {canEdit && (
            <button
              {...sortable.listeners}
              className="cursor-grab select-none rounded p-0.5 text-neutral-600 hover:text-neutral-400 active:cursor-grabbing"
              title="Перетащить колонку"
            >
              <GripVertical className="h-4 w-4" />
            </button>
          )}
          <h3 className="truncate text-sm font-semibold text-neutral-200">
            {column.title}
          </h3>
          <span className="rounded-full bg-neutral-800 px-1.5 text-xs text-neutral-400">
            {column.tasks.length}
          </span>
        </div>
        {canEdit && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            <AnimatePresence>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-lg border border-neutral-700 bg-neutral-800 py-1 shadow-xl"
                  >
                    <button
                      onClick={async () => {
                        setMenuOpen(false);
                        const next = await promptText({
                          title: "Переименовать колонку",
                          label: "Название колонки",
                          defaultValue: column.title,
                          confirmLabel: "Сохранить",
                        });
                        if (next) start(() => renameColumn(column.id, next));
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-neutral-200 hover:bg-neutral-700"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Переименовать
                    </button>
                    <button
                      onClick={async () => {
                        setMenuOpen(false);
                        const ok = await confirm({
                          title: "Удалить колонку?",
                          message: "Колонка и все её задачи будут удалены.",
                          confirmLabel: "Удалить",
                          danger: true,
                        });
                        if (ok) start(() => deleteColumn(column.id));
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-red-300 hover:bg-neutral-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Удалить
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      <div
        ref={droppable.setNodeRef}
        className="flex-1 space-y-2 overflow-y-auto overflow-x-hidden px-2 pb-2"
      >
        <SortableContext
          items={column.tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {column.tasks.map((task) => (
            <SortableTask
              key={task.id}
              task={task}
              canDrag={isAdmin || task.createdById === currentUserId}
              onOpen={onOpenTask}
            />
          ))}
        </SortableContext>
        {column.tasks.length === 0 && (
          <div className="rounded-lg border border-dashed border-neutral-800 py-6 text-center text-xs text-neutral-600">
            Перетащите задачу сюда
          </div>
        )}
      </div>

      {canEdit && <AddTask columnId={column.id} />}
    </div>
  );
}

function SortableTask({
  task,
  canDrag,
  onOpen,
}: {
  task: BoardTask;
  canDrag: boolean;
  onOpen: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { type: "task" }, disabled: !canDrag });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(task.id)}
      className={cn(
        "block w-full cursor-pointer select-none overflow-hidden rounded-lg border border-neutral-800 bg-neutral-800/60 text-left transition-colors hover:border-neutral-600 hover:bg-neutral-800",
        isDragging && "opacity-40",
      )}
    >
      <TaskCardBody task={task} />
    </div>
  );
}

function AddTask({ columnId }: { columnId: string }) {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");
  const [, start] = useTransition();

  function submit() {
    const title = value.trim();
    if (title) start(() => createTask(columnId, title));
    setValue("");
    setAdding(false);
  }

  if (!adding) {
    return (
      <button
        onClick={() => setAdding(true)}
        className="m-2 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-300"
      >
        <Plus className="h-4 w-4" /> Добавить задачу
      </button>
    );
  }
  return (
    <div className="p-2">
      <textarea
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
          if (e.key === "Escape") setAdding(false);
        }}
        onBlur={submit}
        rows={2}
        placeholder="Название задачи…"
        className="w-full resize-none rounded-lg border border-neutral-700 bg-neutral-800 px-2.5 py-2 text-sm text-neutral-100 outline-none focus:border-sky-500"
      />
    </div>
  );
}

function AddColumn({ boardId }: { boardId: string }) {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");
  const [, start] = useTransition();

  function submit() {
    const title = value.trim();
    if (title) start(() => createColumn(boardId, title));
    setValue("");
    setAdding(false);
  }

  if (!adding) {
    return (
      <button
        onClick={() => setAdding(true)}
        className="flex h-min w-[82vw] max-w-[19rem] shrink-0 items-center gap-1.5 rounded-xl border border-dashed border-neutral-800 px-3 py-2.5 text-sm text-neutral-500 transition hover:border-neutral-700 hover:text-neutral-300 sm:w-72"
      >
        <Plus className="h-4 w-4" /> Добавить колонку
      </button>
    );
  }
  return (
    <div className="w-[82vw] max-w-[19rem] shrink-0 sm:w-72">
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") setAdding(false);
        }}
        onBlur={submit}
        placeholder="Название колонки…"
        className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-neutral-100 outline-none focus:border-sky-500"
      />
    </div>
  );
}
