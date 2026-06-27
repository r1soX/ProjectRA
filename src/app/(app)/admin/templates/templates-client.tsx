"use client";

import { useState, useTransition } from "react";
import { motion } from "motion/react";
import { Plus, Pencil, Trash2, LayoutTemplate, Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useConfirm } from "@/components/ui/dialog-provider";
import { createTemplate, updateTemplate, deleteTemplate } from "./actions";

export type TemplateView = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  columns: string[];
};

function TemplateModal({
  open,
  initial,
  onClose,
}: {
  open: boolean;
  initial: TemplateView | null;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [columns, setColumns] = useState("");
  const [pending, start] = useTransition();

  // Re-seed the form whenever a different template is opened.
  const [seededFor, setSeededFor] = useState<string | null>(null);
  const key = initial?.id ?? "new";
  if (open && seededFor !== key) {
    setName(initial?.name ?? "");
    setDescription(initial?.description ?? "");
    setColumns((initial?.columns ?? ["К работе", "В процессе", "Готово"]).join("\n"));
    setSeededFor(key);
  }
  if (!open && seededFor !== null) setSeededFor(null);

  function submit() {
    const cols = columns.split("\n");
    start(async () => {
      if (initial) await updateTemplate(initial.id, name, description, cols);
      else await createTemplate(name, description, cols);
      onClose();
    });
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Изменить шаблон" : "Новый шаблон"}>
      <div className="space-y-4">
        <Field label="Название" htmlFor="tpl-name">
          <Input
            id="tpl-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например, Спринт разработки"
            autoFocus
          />
        </Field>
        <Field label="Описание" htmlFor="tpl-desc">
          <Input
            id="tpl-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Необязательно"
          />
        </Field>
        <Field label="Колонки (по одной на строку)" htmlFor="tpl-cols">
          <textarea
            id="tpl-cols"
            value={columns}
            onChange={(e) => setColumns(e.target.value)}
            rows={5}
            placeholder={"К работе\nВ процессе\nГотово"}
            className="w-full resize-y rounded-xl border border-neutral-700 bg-neutral-900/60 px-3 py-2 text-base sm:text-sm text-neutral-100 outline-none focus:border-sky-500"
          />
        </Field>
        <p className="text-xs text-neutral-500">
          Колонка «Завершённые задачи» добавляется автоматически.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button type="button" loading={pending} disabled={!name.trim()} onClick={submit}>
            <Plus className="h-4 w-4" />
            {initial ? "Сохранить" : "Создать"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function TemplatesClient({ templates }: { templates: TemplateView[] }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TemplateView | null>(null);
  const [, start] = useTransition();
  const confirm = useConfirm();

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(t: TemplateView) {
    setEditing(t);
    setModalOpen(true);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Шаблоны досок</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Готовые наборы колонок для быстрого создания досок.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Создать</span>
        </Button>
      </div>

      {templates.length === 0 ? (
        <button
          onClick={openNew}
          className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/30 py-20 text-neutral-500 transition hover:border-sky-500/40 hover:text-neutral-300"
        >
          <LayoutTemplate className="h-8 w-8" />
          Создайте первый шаблон
        </button>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
              className="glass group flex flex-col rounded-2xl p-5"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="flex items-center gap-2 font-semibold text-neutral-100">
                  {t.name}
                  {t.isSystem && (
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-400">
                      встроенный
                    </span>
                  )}
                </h2>
                {!t.isSystem && (
                  <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                    <button
                      onClick={() => openEdit(t)}
                      title="Изменить"
                      className="rounded-lg p-1.5 text-neutral-500 transition hover:bg-white/5 hover:text-sky-400"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={async () => {
                        const ok = await confirm({
                          title: "Удалить шаблон?",
                          message: `«${t.name}» будет удалён.`,
                          confirmLabel: "Удалить",
                          danger: true,
                        });
                        if (ok) start(() => deleteTemplate(t.id));
                      }}
                      title="Удалить"
                      className="rounded-lg p-1.5 text-neutral-500 transition hover:bg-white/5 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
              {t.description && (
                <p className="mt-1 text-sm text-neutral-500">{t.description}</p>
              )}
              <div className="mt-4 flex flex-wrap gap-1.5">
                {t.columns.map((c, idx) => (
                  <span
                    key={idx}
                    className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-neutral-300"
                  >
                    {c}
                  </span>
                ))}
                {t.columns.length === 0 && (
                  <span className="flex items-center gap-1 text-xs text-neutral-600">
                    <Columns3 className="h-3.5 w-3.5" /> без колонок
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <TemplateModal
        open={modalOpen}
        initial={editing}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
