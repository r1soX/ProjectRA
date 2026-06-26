"use client";

import { useState, useTransition } from "react";
import { Lock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/cn";
import { BOARD_COLORS } from "../boards-client";
import { updateBoard } from "../actions";

export function BoardSettingsModal({
  open,
  boardId,
  currentTitle,
  currentColor,
  currentIsPersonal,
  onClose,
}: {
  open: boolean;
  boardId: string;
  currentTitle: string;
  currentColor: string;
  currentIsPersonal: boolean;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(currentTitle);
  const [color, setColor] = useState(currentColor);
  const [isPersonal, setIsPersonal] = useState(currentIsPersonal);
  const [pending, start] = useTransition();

  function save() {
    const next = title.trim();
    if (!next) return;
    start(async () => {
      await updateBoard(boardId, next, color, isPersonal);
      onClose();
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Настройки доски">
      <div className="space-y-4">
        <Field label="Название" htmlFor="bs-title">
          <Input
            id="bs-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </Field>

        <Field label="Цвет">
          <div className="flex flex-wrap gap-2">
            {BOARD_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                style={{ backgroundColor: c }}
                className={cn(
                  "h-8 w-8 rounded-full transition",
                  color === c
                    ? "ring-2 ring-white ring-offset-2 ring-offset-neutral-900"
                    : "opacity-70 hover:opacity-100",
                )}
              />
            ))}
          </div>
        </Field>

        <Field label="Видимость">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setIsPersonal(false)}
              className={cn(
                "flex items-center gap-2 rounded-lg border p-3 text-sm transition",
                !isPersonal
                  ? "border-sky-500/50 bg-sky-500/10 text-sky-200"
                  : "border-neutral-700 bg-neutral-900/40 text-neutral-400 hover:bg-neutral-800/60",
              )}
            >
              <Users className="h-4 w-4 shrink-0" />
              <span className="text-left">Общая</span>
            </button>
            <button
              type="button"
              onClick={() => setIsPersonal(true)}
              className={cn(
                "flex items-center gap-2 rounded-lg border p-3 text-sm transition",
                isPersonal
                  ? "border-sky-500/50 bg-sky-500/10 text-sky-200"
                  : "border-neutral-700 bg-neutral-900/40 text-neutral-400 hover:bg-neutral-800/60",
              )}
            >
              <Lock className="h-4 w-4 shrink-0" />
              <span className="text-left">Личная</span>
            </button>
          </div>
          {!isPersonal && currentIsPersonal && (
            <p className="mt-2 text-xs text-amber-400">
              Доска станет видна всем сотрудникам.
            </p>
          )}
          {isPersonal && !currentIsPersonal && (
            <p className="mt-2 text-xs text-neutral-500">
              Доступ будет только у вас и приглашённых участников.
            </p>
          )}
        </Field>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button type="button" loading={pending} onClick={save}>
            Сохранить
          </Button>
        </div>
      </div>
    </Modal>
  );
}
