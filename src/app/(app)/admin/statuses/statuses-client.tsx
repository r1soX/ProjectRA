"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Check, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/dialog-provider";
import { statusBadgeStyle, statusDotStyle } from "@/lib/status";
import { createStatus, updateStatus, deleteStatus } from "./actions";

type Row = {
  id: string;
  key: string;
  label: string;
  color: string;
  isSystem: boolean;
};

export function StatusesClient({ statuses }: { statuses: Row[] }) {
  const router = useRouter();
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState("#38bdf8");
  const [, start] = useTransition();

  function add() {
    const label = newLabel.trim();
    if (!label) return;
    start(async () => {
      await createStatus(label, newColor);
      setNewLabel("");
      setNewColor("#38bdf8");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-white/[0.07]">
        {statuses.map((s) => (
          <StatusRow key={s.id} status={s} />
        ))}
      </div>

      {/* Add new */}
      <div className="glass rounded-2xl p-4">
        <p className="mb-3 text-sm font-semibold text-neutral-200">
          Новый статус
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="h-9 w-12 shrink-0 cursor-pointer rounded-lg border border-neutral-700 bg-transparent"
            title="Цвет"
          />
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Название, напр. «Согласование»"
            maxLength={40}
            className="h-9 min-w-0 flex-1 rounded-lg border border-neutral-700 bg-neutral-900/60 px-3 text-sm text-neutral-100 outline-none focus:border-sky-500"
          />
          <Button onClick={add} disabled={!newLabel.trim()}>
            <Plus className="h-4 w-4" />
            Добавить
          </Button>
        </div>
      </div>
    </div>
  );
}

function StatusRow({ status }: { status: Row }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [label, setLabel] = useState(status.label);
  const [color, setColor] = useState(status.color);
  const [, start] = useTransition();
  const dirty = label.trim() !== status.label || color !== status.color;

  function save() {
    if (!dirty || !label.trim()) return;
    start(async () => {
      await updateStatus(status.id, label, color);
      router.refresh();
    });
  }

  async function remove() {
    const ok = await confirm({
      title: `Удалить статус «${status.label}»? Задачи и колонки с ним вернутся к «К работе».`,
      confirmLabel: "Удалить",
      danger: true,
    });
    if (ok) start(async () => {
      await deleteStatus(status.id);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-3 border-b border-white/[0.05] px-4 py-3 last:border-b-0">
      <input
        type="color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        className="h-8 w-10 shrink-0 cursor-pointer rounded-lg border border-neutral-700 bg-transparent"
        title="Цвет"
      />
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && save()}
        maxLength={40}
        className="h-8 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 text-sm text-neutral-100 outline-none focus:border-neutral-700 focus:bg-neutral-900/60"
      />
      {/* Live preview chip */}
      <span
        className="hidden items-center gap-1.5 rounded-lg px-2 py-0.5 text-xs font-medium sm:inline-flex"
        style={statusBadgeStyle(color)}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={statusDotStyle(color)} />
        {label || "—"}
      </span>

      {dirty && (
        <button
          onClick={save}
          title="Сохранить"
          className="rounded-lg p-1.5 text-emerald-400 transition hover:bg-emerald-500/10"
        >
          <Check className="h-4 w-4" />
        </button>
      )}
      {status.isSystem ? (
        <span
          className="p-1.5 text-neutral-600"
          title="Встроенный статус — нельзя удалить"
        >
          <Lock className="h-4 w-4" />
        </span>
      ) : (
        <button
          onClick={remove}
          title="Удалить статус"
          className="rounded-lg p-1.5 text-neutral-500 transition hover:bg-white/5 hover:text-red-400"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
