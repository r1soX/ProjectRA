"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  useDroppable,
  type CollisionDetection,
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
  CheckCircle2,
  Download,
  LayoutGrid,
  List as ListIcon,
  Table2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import {
  createColumn,
  renameColumn,
  deleteColumn,
  createTask,
  deleteTask,
  deleteBoard,
  moveTask,
  reorderColumns,
  setColumnStatus,
} from "../actions";
import {
  useConfirm,
  usePrompt,
} from "@/components/ui/dialog-provider";
import { useToast } from "@/components/ui/toast-provider";
import { AccessDenied } from "@/components/ui/access-denied";
import { normalizePriority } from "@/lib/priority";
import { STATUS_META, STATUSES, normalizeStatus } from "@/lib/status";
import {
  BoardFilters,
  EMPTY_FILTERS,
  isFilterActive,
  type BoardFilterState,
  type SavedView,
} from "./board-filters";
import { BoardListView, BoardTableView } from "./board-views";
import { TaskModal } from "./task-modal";
import { MembersModal } from "./members-modal";
import { BoardSettingsModal } from "./board-settings-modal";
import { TaskCardBody, isTaskOverdue } from "./task-card-body";

export type BoardMemberView = {
  userId: string;
  role: string;
  shortName: string;
  initials: string;
  username: string;
  avatar: string | null;
  emoji: string | null;
};
export type DirectoryUser = {
  id: string;
  fullName: string;
  username: string;
  initials: string;
  avatar: string | null;
  emoji: string | null;
};
export type BoardTask = {
  id: string;
  columnId: string;
  title: string;
  description: string | null;
  color: string | null;
  priority: string;
  status: string;
  isPersonal: boolean;
  recurFreq: string | null;
  recurInterval: number;
  recurDays: string | null;
  recurUntil: string | null;
  startDate: string | null;
  dueDate: string | null;
  done: boolean;
  subtaskTotal: number;
  subtaskDone: number;
  createdById: string;
  createdByName: string;
  assigneeIds: string[];
  assignees: {
    userId: string;
    initials: string;
    shortName: string;
    confirmed: boolean;
    avatar: string | null;
    emoji: string | null;
  }[];
  labels: { id: string; name: string; color: string }[];
  comments: {
    id: string;
    body: string;
    authorName: string;
    authorInitials: string;
    authorAvatar: string | null;
    authorEmoji: string | null;
    userId: string;
    createdAt: string;
    reactions: { emoji: string; count: number; mine: boolean }[];
  }[];
  links: { otherTitle: string; type: string; direction: "out" | "in" }[];
};
export type BoardColumn = {
  id: string;
  title: string;
  systemKey: string | null;
  statusKey: string | null;
  tasks: BoardTask[];
};
export type BoardLabel = { id: string; name: string; color: string };
export type BoardPerms = {
  columnCreate: boolean;
  columnEdit: boolean;
  columnDelete: boolean;
  taskCreate: boolean;
  taskMove: boolean;
  taskEditAny: boolean;
  taskEditOwn: boolean;
  taskDeleteAny: boolean;
  taskDeleteOwn: boolean;
  taskAssign: boolean;
  taskComplete: boolean;
  commentCreate: boolean;
  timeLog: boolean;
  timeEditOwn: boolean;
  timeDeleteOwn: boolean;
  fileUpload: boolean;
  fileView: boolean;
  labelManage: boolean;
};

const DROP_PREFIX = "dropzone-";

/** Does a task pass the active board filters? */
function matchesFilters(t: BoardTask, f: BoardFilterState, meId: string): boolean {
  if (f.mine && !t.assigneeIds.includes(meId)) return false;
  if (f.assignees.length && !f.assignees.some((id) => t.assigneeIds.includes(id)))
    return false;
  if (f.labels.length && !f.labels.some((id) => t.labels.some((l) => l.id === id)))
    return false;
  if (f.priorities.length && !f.priorities.includes(normalizePriority(t.priority)))
    return false;
  if (f.statuses.length && !f.statuses.includes(normalizeStatus(t.status)))
    return false;
  const text = f.text.trim().toLowerCase();
  if (text && !t.title.toLowerCase().includes(text)) return false;
  if (f.due !== "any") {
    if (!t.dueDate) return f.due === "none";
    if (f.due === "none") return false;
    const todayStr = new Date().toLocaleDateString("en-CA");
    if (f.due === "today") return t.dueDate === todayStr;
    if (f.due === "overdue") return t.dueDate < todayStr && !t.done;
    if (f.due === "week") {
      const wk = new Date();
      wk.setHours(0, 0, 0, 0);
      wk.setDate(wk.getDate() + 7);
      return t.dueDate >= todayStr && t.dueDate < wk.toLocaleDateString("en-CA");
    }
  }
  return true;
}

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
  boardMembers,
  boardLabels,
  canViewTasks,
  canViewComments,
  canExportTasks,
  canExportBoard,
  perms,
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
  boardMembers: BoardMemberView[];
  boardLabels: BoardLabel[];
  canViewTasks: boolean;
  canViewComments: boolean;
  canExportTasks: boolean;
  canExportBoard: boolean;
  perms: BoardPerms;
}) {
  const canEdit = role === "OWNER" || role === "EDITOR";
  const canComment = role !== "VIEWER";
  const isOwner = role === "OWNER";

  const [cols, setCols] = useState<BoardColumn[]>(columns);
  const [activeTask, setActiveTask] = useState<BoardTask | null>(null);
  const [activeColumn, setActiveColumn] = useState<BoardColumn | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [highlightCommentId, setHighlightCommentId] = useState<string | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [, start] = useTransition();
  const router = useRouter();
  const searchParams = useSearchParams();
  const confirm = useConfirm();
  const toast = useToast();
  // Tasks pending a deferred (undoable) delete — hidden from the board until the
  // grace period elapses, then actually removed on the server.
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set());
  const draggingRef = useRef(false);
  const pendingRefreshRef = useRef(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Coalesce bursts of SSE "change" events into a single refetch.
  function requestRefresh() {
    if (draggingRef.current) {
      pendingRefreshRef.current = true;
      return;
    }
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      refreshTimer.current = null;
      router.refresh();
    }, 200);
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
    return () => {
      es.close();
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  // Re-sync local state whenever the server sends fresh data (any field),
  // except while a drag is in progress. `columns` only changes identity when
  // the page re-fetches, so this picks up every edit in real time.
  useEffect(() => {
    if (!draggingRef.current) setCols(columns);
  }, [columns]);

  const closeTask = useCallback(() => {
    setSelectedTaskId(null);
    setHighlightCommentId(null);
  }, []);

  // Open a task (and optionally highlight a comment) from a notification
  // deep-link like /boards/<id>?task=<taskId>&comment=<commentId>. The params
  // are consumed once and stripped so a refresh/back doesn't reopen the modal.
  useEffect(() => {
    const t = searchParams.get("task");
    if (!t) return;
    setSelectedTaskId(t);
    setHighlightCommentId(searchParams.get("comment"));
    const sp = new URLSearchParams(Array.from(searchParams.entries()));
    sp.delete("task");
    sp.delete("comment");
    const qs = sp.toString();
    router.replace(`/boards/${boardId}${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [searchParams, boardId, router]);

  const sensors = useSensors(
    // Desktop: start dragging after a small movement.
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    // Touch: press-and-hold to drag, so a normal swipe still scrolls.
    useSensor(TouchSensor, {
      activationConstraint: { delay: 220, tolerance: 8 },
    }),
  );

  const selectedTask = useMemo(
    () => cols.flatMap((c) => c.tasks).find((t) => t.id === selectedTaskId) ?? null,
    [cols, selectedTaskId],
  );

  // Columns with pending-deleted tasks hidden (for rendering).
  const displayCols = useMemo(
    () =>
      pendingDeletes.size === 0
        ? cols
        : cols.map((c) => ({
            ...c,
            tasks: c.tasks.filter((t) => !pendingDeletes.has(t.id)),
          })),
    [cols, pendingDeletes],
  );

  // ── Filters + saved views (per-board, persisted in localStorage) ──
  const [filters, setFilters] = useState<BoardFilterState>(EMPTY_FILTERS);
  const [views, setViews] = useState<SavedView[]>([]);
  const viewsKey = `projectra:views:${boardId}`;
  useEffect(() => {
    try {
      const raw = localStorage.getItem(viewsKey);
      if (raw) setViews(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, [viewsKey]);
  function persistViews(next: SavedView[]) {
    setViews(next);
    try {
      localStorage.setItem(viewsKey, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  // Board / List / Table view (persisted per board).
  const [view, setView] = useState<"board" | "list" | "table">("board");
  const viewKey = `projectra:view:${boardId}`;
  useEffect(() => {
    try {
      const v = localStorage.getItem(viewKey);
      if (v === "list" || v === "table" || v === "board") setView(v);
    } catch {
      /* ignore */
    }
  }, [viewKey]);
  function changeView(v: "board" | "list" | "table") {
    setView(v);
    try {
      localStorage.setItem(viewKey, v);
    } catch {
      /* ignore */
    }
  }

  const filteredCols = useMemo(() => {
    if (!isFilterActive(filters)) return displayCols;
    return displayCols.map((c) => ({
      ...c,
      tasks: c.tasks.filter((t) => matchesFilters(t, filters, currentUserId)),
    }));
  }, [displayCols, filters, currentUserId]);

  // Optimistic, undoable task delete: hide now, commit on the server after a
  // short grace period unless the user hits "Отменить".
  function requestDeleteTask(task: BoardTask) {
    setSelectedTaskId(null);
    setPendingDeletes((prev) => new Set(prev).add(task.id));
    const timer = setTimeout(() => {
      setPendingDeletes((prev) => {
        const n = new Set(prev);
        n.delete(task.id);
        return n;
      });
      deleteTask(task.id);
    }, 5000);
    toast({
      type: "info",
      message: `Задача «${task.title}» удалена`,
      duration: 5000,
      action: {
        label: "Отменить",
        onClick: () => {
          clearTimeout(timer);
          setPendingDeletes((prev) => {
            const n = new Set(prev);
            n.delete(task.id);
            return n;
          });
        },
      },
    });
  }

  function findTaskColumn(taskId: string): string | null {
    return cols.find((c) => c.tasks.some((t) => t.id === taskId))?.id ?? null;
  }
  function resolveColumn(overId: string): string | null {
    if (overId.startsWith(DROP_PREFIX)) return overId.slice(DROP_PREFIX.length);
    if (cols.some((c) => c.id === overId)) return overId; // dropped on a column
    return findTaskColumn(overId);
  }
  // For a column drag, the drop target may be another column, a dropzone, or a
  // task nested in a column — resolve all of them to a column id.
  function columnOfOver(overId: string): string | null {
    if (cols.some((c) => c.id === overId)) return overId;
    if (overId.startsWith(DROP_PREFIX)) return overId.slice(DROP_PREFIX.length);
    return findTaskColumn(overId);
  }

  // When dragging a column, only collide with other columns so they shift to
  // reveal the drop position; for tasks, use corner-based detection.
  // Stable identity (reads cols via ref) so DndContext doesn't re-init.
  const colsRef = useRef(cols);
  colsRef.current = cols;
  const collision = useCallback<CollisionDetection>((args) => {
    const isColumn = (id: string | number) =>
      colsRef.current.some((c) => c.id === id);
    if (args.active.data.current?.type === "column") {
      const columnsOnly = args.droppableContainers.filter((d) => isColumn(d.id));
      return closestCenter({ ...args, droppableContainers: columnsOnly });
    }
    // Task drag: collide only with tasks and column dropzones — never the raw
    // column container. Pointer-based detection reliably hits EMPTY columns
    // (closestCorners would snap to a neighbour's tasks instead).
    const taskTargets = args.droppableContainers.filter((d) => !isColumn(d.id));
    const pointer = pointerWithin({ ...args, droppableContainers: taskTargets });
    if (pointer.length > 0) return pointer;
    return rectIntersection({ ...args, droppableContainers: taskTargets });
  }, []);

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
      const overCol = columnOfOver(String(over.id));
      if (overCol && overCol !== active.id) {
        const oldI = cols.findIndex((c) => c.id === active.id);
        const newI = cols.findIndex((c) => c.id === overCol);
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
          // Guard: moving into "Завершённые задачи".
          if (col.systemKey === "COMPLETED") {
            const task = col.tasks[oldIndex];
            const canComplete = isAdmin || task.createdById === currentUserId;
            const allConfirmed =
              task.assignees.length === 0 ||
              task.assignees.every((a) => a.confirmed);
            if (!canComplete || !allConfirmed) {
              setCols(columns); // revert optimistic move
              confirm({
                title: "Нельзя завершить задачу",
                message: !canComplete
                  ? "Переносить в «Завершённые задачи» может только постановщик задачи или администратор."
                  : "Сначала все исполнители должны подтвердить выполнение задачи.",
                confirmLabel: "Понятно",
              });
              flushRefresh();
              return;
            }
          }
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
      <div className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
        <Link
          href="/boards"
          className="rounded-md p-1.5 text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-200"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <h1 className="max-w-[45vw] truncate text-lg font-bold text-neutral-100 sm:max-w-none">
          {title}
        </h1>
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
                <Avatar
                  key={m.userId}
                  image={m.avatar}
                  emoji={m.emoji}
                  initials={m.initials}
                  size={28}
                  title={m.shortName}
                  className="rounded-full ring-2 ring-neutral-900"
                />
              ))}
            </div>
          )}
          {!isPersonal && (
            <span className="hidden items-center gap-1 rounded-full bg-sky-500/15 px-2.5 py-1 text-xs text-sky-300 sm:flex">
              <UsersIcon className="h-3 w-3" />
              доступна всем
            </span>
          )}
          <div className="flex items-center gap-0.5 rounded-lg border border-neutral-700 bg-neutral-800/60 p-0.5">
            {(
              [
                ["board", LayoutGrid, "Канбан"],
                ["list", ListIcon, "Список"],
                ["table", Table2, "Таблица"],
              ] as const
            ).map(([v, Icon, label]) => (
              <button
                key={v}
                onClick={() => changeView(v)}
                title={label}
                aria-label={label}
                className={cn(
                  "rounded-md p-1.5 transition",
                  view === v
                    ? "bg-white/10 text-neutral-100"
                    : "text-neutral-500 hover:text-neutral-300",
                )}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
          <Link
            href={`/boards/${boardId}/links`}
            className="inline-flex h-8 items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800 px-3 text-sm text-neutral-100 transition hover:bg-neutral-700"
          >
            <Share2 className="h-4 w-4" />
            <span className="hidden sm:inline">Связи</span>
          </Link>
          {(canExportTasks || canExportBoard) && (
            <ExportMenu
              boardId={boardId}
              canExportTasks={canExportTasks}
              canExportBoard={canExportBoard}
            />
          )}
          {isOwner && (
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
      {!canViewTasks ? (
        <AccessDenied
          title="Нет доступа к задачам"
          message="У вас нет прав на просмотр задач этой доски."
          backHref={null}
        />
      ) : (
      <>
      <BoardFilters
        filters={filters}
        onChange={setFilters}
        members={assignable}
        labels={boardLabels}
        views={views}
        onSaveView={(name) =>
          persistViews([...views.filter((v) => v.name !== name), { name, filters }])
        }
        onApplyView={(v) => setFilters(v.filters)}
        onDeleteView={(name) => persistViews(views.filter((v) => v.name !== name))}
      />
      {view === "board" ? (
      <DndContext
        id="board-dnd"
        sensors={sensors}
        collisionDetection={collision}
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
        <div className="flex flex-1 gap-4 overflow-x-auto overflow-y-hidden p-4 max-sm:snap-x max-sm:snap-proximity sm:p-6">
          <SortableContext
            items={filteredCols.map((c) => c.id)}
            strategy={horizontalListSortingStrategy}
          >
            {filteredCols.map((col) => (
              <SortableColumn
                key={col.id}
                column={col}
                canEdit={canEdit}
                perms={perms}
                onOpenTask={setSelectedTaskId}
              />
            ))}
          </SortableContext>
          {canEdit && perms.columnCreate && <AddColumn boardId={boardId} />}
        </div>

        <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)" }}>
          {activeTask ? (
            <DanglingCard task={activeTask} />
          ) : activeColumn ? (
            <motion.div
              initial={{ scale: 1 }}
              animate={{ rotate: [-2.5, 2.5, -2.5] }}
              transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
              style={{ transformOrigin: "top center" }}
              className="glass-strong w-[82vw] max-w-[19rem] cursor-grabbing rounded-2xl border-sky-500/40 shadow-2xl shadow-sky-500/20 ring-2 ring-sky-500/30 sm:w-72"
            >
              <div className="flex items-center gap-2 px-3 py-2.5">
                <GripVertical className="h-4 w-4 text-sky-400" />
                <span className="truncate text-sm font-semibold text-white">
                  {activeColumn.title}
                </span>
                <span className="ml-auto rounded-full bg-white/10 px-1.5 text-xs text-neutral-300">
                  {activeColumn.tasks.length}
                </span>
              </div>
            </motion.div>
          ) : null}
        </DragOverlay>
      </DndContext>
      ) : view === "list" ? (
        <BoardListView columns={filteredCols} onOpenTask={setSelectedTaskId} />
      ) : (
        <BoardTableView columns={filteredCols} onOpenTask={setSelectedTaskId} />
      )}
      </>
      )}

      <TaskModal
        task={selectedTask}
        members={assignable}
        directory={directory}
        boardId={boardId}
        boardLabels={boardLabels}
        canViewComments={canViewComments}
        canComment={canComment}
        perms={perms}
        canEdit={
          canEdit && selectedTask
            ? perms.taskEditAny ||
              (perms.taskEditOwn && selectedTask.createdById === currentUserId)
            : false
        }
        boardCanEdit={canEdit}
        currentUserId={currentUserId}
        highlightCommentId={highlightCommentId}
        canModerate={isOwner}
        canDelete={
          canEdit && selectedTask
            ? perms.taskDeleteAny ||
              (perms.taskDeleteOwn && selectedTask.createdById === currentUserId)
            : false
        }
        onRequestDelete={requestDeleteTask}
        onClose={closeTask}
      />
      <MembersModal
        open={membersOpen}
        boardId={boardId}
        isPersonal={isPersonal}
        members={boardMembers}
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

function ExportMenu({
  boardId,
  canExportTasks,
  canExportBoard,
}: {
  boardId: string;
  canExportTasks: boolean;
  canExportBoard: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Экспорт"
        className="inline-flex h-8 items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800 px-3 text-sm text-neutral-100 transition hover:bg-neutral-700"
      >
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">Экспорт</span>
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-lg border border-neutral-700 bg-neutral-800 py-1 shadow-xl"
            >
              {canExportTasks && (
                <a
                  href={`/api/boards/${boardId}/export?format=csv`}
                  download
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-neutral-200 hover:bg-neutral-700"
                >
                  <Download className="h-3.5 w-3.5" /> Задачи (CSV)
                </a>
              )}
              {canExportBoard && (
                <a
                  href={`/api/boards/${boardId}/export?format=json`}
                  download
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-neutral-200 hover:bg-neutral-700"
                >
                  <Download className="h-3.5 w-3.5" /> Вся доска (JSON)
                </a>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
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
  perms,
  onOpenTask,
}: {
  column: BoardColumn;
  canEdit: boolean;
  perms: BoardPerms;
  onOpenTask: (id: string) => void;
}) {
  const isCompleted = column.systemKey === "COMPLETED";
  // Reordering columns is a COLUMN_EDIT action; cards moving needs TASK_MOVE.
  const canReorder = canEdit && perms.columnEdit;
  const sortable = useSortable({
    id: column.id,
    data: { type: "column" },
    disabled: !canReorder || isCompleted,
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
        "glass flex w-[82vw] max-w-[19rem] shrink-0 flex-col rounded-2xl max-sm:snap-center sm:w-72",
        isCompleted && "border-emerald-500/30 bg-emerald-500/[0.05]",
        sortable.isDragging && "opacity-40",
      )}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-1.5">
          {canReorder && !isCompleted && (
            <button
              {...sortable.listeners}
              className="cursor-grab select-none rounded p-0.5 text-neutral-600 hover:text-neutral-400 active:cursor-grabbing"
              title="Перетащить колонку"
            >
              <GripVertical className="h-4 w-4" />
            </button>
          )}
          {isCompleted && (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          )}
          {!isCompleted && column.statusKey && (
            <span
              className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                STATUS_META[normalizeStatus(column.statusKey)].dot,
              )}
              title={`Статус: ${STATUS_META[normalizeStatus(column.statusKey)].label}`}
            />
          )}
          <h3
            className={cn(
              "truncate text-sm font-semibold",
              isCompleted ? "text-emerald-300" : "text-neutral-200",
            )}
          >
            {column.title}
          </h3>
          <span className="rounded-full bg-neutral-800 px-1.5 text-xs text-neutral-400">
            {column.tasks.length}
          </span>
        </div>
        {canEdit && !isCompleted && (perms.columnEdit || perms.columnDelete) && (
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
                    {perms.columnEdit && (
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
                    )}
                    {perms.columnDelete && (
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
                    )}
                    {perms.columnEdit && (
                      <div className="mt-1 border-t border-white/5 pt-1">
                        <p className="px-3 py-1 text-[10px] uppercase tracking-wide text-neutral-600">
                          Статус колонки
                        </p>
                        {STATUSES.filter((s) => s !== "canceled").map((s) => (
                          <button
                            key={s}
                            onClick={() => {
                              setMenuOpen(false);
                              start(() => setColumnStatus(column.id, s));
                            }}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-neutral-700"
                          >
                            <span className={cn("h-2 w-2 rounded-full", STATUS_META[s].dot)} />
                            <span
                              className={cn(
                                column.statusKey === s
                                  ? "font-medium text-neutral-100"
                                  : "text-neutral-400",
                              )}
                            >
                              {STATUS_META[s].label}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
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
              canDrag={canEdit && perms.taskMove}
              onOpen={onOpenTask}
            />
          ))}
        </SortableContext>
        {column.tasks.length === 0 && (
          <div className="rounded-lg border border-dashed border-white/10 py-6 text-center text-xs text-neutral-600">
            {isCompleted ? "Завершённые задачи появятся здесь" : "Перетащите задачу сюда"}
          </div>
        )}
      </div>

      {canEdit && !isCompleted && perms.taskCreate && (
        <AddTask columnId={column.id} />
      )}
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
        "block w-full cursor-grab select-none overflow-hidden rounded-xl border text-left shadow-sm transition active:cursor-grabbing hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30",
        isTaskOverdue(task)
          ? "border-red-500/50 bg-red-500/[0.07] shadow-red-500/20 ring-1 ring-red-500/40 hover:border-red-500/70"
          : "border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.07]",
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
        className="w-full resize-none rounded-lg border border-neutral-700 bg-neutral-800 px-2.5 py-2 text-base sm:text-sm text-neutral-100 outline-none focus:border-sky-500"
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
        className="flex h-min w-[82vw] max-w-[19rem] shrink-0 items-center gap-1.5 rounded-xl border border-dashed border-white/10 px-3 py-2.5 text-sm text-neutral-500 transition hover:border-neutral-700 hover:text-neutral-300 sm:w-72"
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
