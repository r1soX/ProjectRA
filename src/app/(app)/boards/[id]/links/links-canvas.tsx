"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
  MarkerType,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/cn";
import { PRIORITY_META, normalizePriority } from "@/lib/priority";
import {
  createTaskLink,
  deleteTaskLink,
  setTaskPosition,
} from "../../actions";
import type { LinkNode, LinkEdge } from "@/lib/links";

type LinkType = "RELATES" | "BLOCKS" | "DEPENDS";

const EDGE_META: Record<LinkType, { color: string; label: string }> = {
  RELATES: { color: "#64748b", label: "связь" },
  BLOCKS: { color: "#ef4444", label: "блокирует" },
  DEPENDS: { color: "#f59e0b", label: "зависит" },
};

function normLink(t: string): LinkType {
  return t === "BLOCKS" || t === "DEPENDS" ? t : "RELATES";
}

function buildEdge(
  id: string,
  source: string,
  target: string,
  type: string,
): Edge {
  const lt = normLink(type);
  const meta = EDGE_META[lt];
  return {
    id,
    source,
    target,
    type: "smoothstep",
    animated: lt === "BLOCKS",
    label: meta.label,
    labelBgStyle: { fill: "#171717" },
    labelBgPadding: [4, 2],
    labelStyle: { fill: meta.color, fontSize: 10 },
    style: { stroke: meta.color, strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: meta.color },
    data: { linkType: lt },
  };
}

type TaskNodeData = {
  title: string;
  priority: string;
  color: string | null;
  column: string;
};

function TaskNode({ data }: NodeProps) {
  const d = data as unknown as TaskNodeData;
  const pr = PRIORITY_META[normalizePriority(d.priority)];
  return (
    <div
      className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 shadow-lg"
      style={{ borderLeftWidth: 3, borderLeftColor: d.color ?? pr.bar }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-neutral-900 !bg-sky-500"
      />
      <div className="flex items-center gap-1.5">
        <span className={cn("h-1.5 w-1.5 rounded-full", pr.dot)} />
        <span className="max-w-[170px] truncate text-sm text-neutral-100">
          {d.title}
        </span>
      </div>
      <p className="mt-0.5 text-[10px] text-neutral-500">{d.column}</p>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-neutral-900 !bg-sky-500"
      />
    </div>
  );
}

const nodeTypes = { task: TaskNode };

export function LinksCanvas({
  boardId,
  boardTitle,
  canEdit,
  nodes: nodeData,
  edges: edgeData,
}: {
  boardId: string;
  boardTitle: string;
  canEdit: boolean;
  nodes: LinkNode[];
  edges: LinkEdge[];
}) {
  const initialNodes = useMemo<Node[]>(
    () =>
      nodeData.map((t, i) => ({
        id: t.id,
        type: "task",
        position: { x: t.x ?? (i % 5) * 240, y: t.y ?? Math.floor(i / 5) * 150 },
        data: {
          title: t.title,
          priority: t.priority,
          color: t.color,
          column: t.columnTitle,
        },
      })),
    [nodeData],
  );
  const initialEdges = useMemo<Edge[]>(
    () => edgeData.map((e) => buildEdge(e.id, e.source, e.target, e.type)),
    [edgeData],
  );

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [linkType, setLinkType] = useState<LinkType>("RELATES");

  const onConnect = useCallback(
    (c: Connection) => {
      if (!canEdit || !c.source || !c.target || c.source === c.target) return;
      const source = c.source;
      const target = c.target;
      const tempId = `tmp-${Math.random().toString(36).slice(2)}`;
      setEdges((eds) => addEdge(buildEdge(tempId, source, target, linkType), eds));
      createTaskLink(boardId, source, target, linkType).then((res) => {
        if (res?.id)
          setEdges((eds) =>
            eds.map((e) => (e.id === tempId ? { ...e, id: res.id } : e)),
          );
      });
    },
    [canEdit, linkType, boardId, setEdges],
  );

  const onEdgesDelete = useCallback((deleted: Edge[]) => {
    for (const e of deleted) {
      if (!e.id.startsWith("tmp-")) deleteTaskLink(e.id);
    }
  }, []);

  const onNodeDragStop = useCallback(
    (_e: unknown, node: Node) => {
      if (!canEdit) return;
      setTaskPosition(
        node.id,
        Math.round(node.position.x),
        Math.round(node.position.y),
      );
    },
    [canEdit],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-neutral-800 px-4 py-3 sm:px-6">
        <Link
          href={`/boards/${boardId}`}
          className="rounded-md p-1.5 text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-200"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-neutral-100">Связи задач</h1>
          <p className="text-xs text-neutral-500">{boardTitle}</p>
        </div>

        {canEdit && (
          <div className="ml-auto flex items-center gap-1.5">
            <span className="hidden text-xs text-neutral-500 sm:inline">
              Тип новой связи:
            </span>
            {(Object.keys(EDGE_META) as LinkType[]).map((t) => (
              <button
                key={t}
                onClick={() => setLinkType(t)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition",
                  linkType === t
                    ? "border-transparent text-white"
                    : "border-neutral-700 bg-neutral-900/40 text-neutral-400 hover:bg-neutral-800/60",
                )}
                style={
                  linkType === t
                    ? { backgroundColor: EDGE_META[t].color + "33", color: EDGE_META[t].color }
                    : undefined
                }
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: EDGE_META[t].color }}
                />
                {EDGE_META[t].label}
              </button>
            ))}
          </div>
        )}
      </div>

      {canEdit && (
        <p className="border-b border-neutral-800/60 bg-neutral-900/30 px-4 py-1.5 text-xs text-neutral-500 sm:px-6">
          Потяните от правого края одной задачи к левому краю другой, чтобы
          создать связь. Выделите линию и нажмите Delete, чтобы удалить.
        </p>
      )}

      <div className="min-h-0 flex-1">
        <ReactFlow
          colorMode="dark"
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgesDelete={onEdgesDelete}
          onNodeDragStop={onNodeDragStop}
          nodeTypes={nodeTypes}
          nodesDraggable={canEdit}
          nodesConnectable={canEdit}
          edgesReconnectable={false}
          fitView
        >
          <Background />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable />
        </ReactFlow>
      </div>
    </div>
  );
}
