"use client";

import { useState, useTransition } from "react";
import { UserPlus, UserMinus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/cn";
import { addMember, removeMember } from "../actions";
import type { BoardMemberView, DirectoryUser } from "./board-view";

export function MembersModal({
  open,
  boardId,
  members,
  directory,
  onClose,
}: {
  open: boolean;
  boardId: string;
  members: BoardMemberView[];
  directory: DirectoryUser[];
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [query, setQuery] = useState("");

  const memberIds = new Set(members.map((m) => m.userId));
  const filtered = directory.filter((u) =>
    `${u.fullName} ${u.username}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <Modal open={open} onClose={onClose} title="Участники доски">
      <div className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по сотрудникам…"
            className="pl-9"
          />
        </div>

        <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
          {filtered.map((u) => {
            const isMember = memberIds.has(u.id);
            return (
              <div
                key={u.id}
                className="flex items-center gap-3 rounded-lg glass p-2.5"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 text-xs font-semibold text-white">
                  {u.initials}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-neutral-100">{u.fullName}</p>
                  <p className="truncate text-xs text-neutral-500">@{u.username}</p>
                </div>
                {isMember ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() => start(() => removeMember(boardId, u.id))}
                  >
                    <UserMinus className="h-4 w-4" />
                    <span className="hidden sm:inline">Убрать</span>
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() => start(() => addMember(boardId, u.id, "EDITOR"))}
                  >
                    <UserPlus className="h-4 w-4" />
                    <span className="hidden sm:inline">Добавить</span>
                  </Button>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="py-6 text-center text-sm text-neutral-500">
              Никого не найдено
            </p>
          )}
        </div>

        <p className={cn("text-xs text-neutral-500")}>
          Приглашённые получают доступ к этой личной доске и могут
          редактировать задачи.
        </p>
      </div>
    </Modal>
  );
}
