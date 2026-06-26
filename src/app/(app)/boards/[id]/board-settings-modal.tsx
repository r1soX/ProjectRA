"use client";

import { useState, useTransition } from "react";
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
  onClose,
}: {
  open: boolean;
  boardId: string;
  currentTitle: string;
  currentColor: string;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(currentTitle);
  const [color, setColor] = useState(currentColor);
  const [pending, start] = useTransition();

  function save() {
    const next = title.trim();
    if (!next) return;
    start(async () => {
      await updateBoard(boardId, next, color);
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
