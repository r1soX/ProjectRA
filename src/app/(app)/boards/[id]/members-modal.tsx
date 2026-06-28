"use client";

import { useState, useTransition } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Avatar } from "@/components/ui/avatar";
import { addMember, removeMember } from "../actions";
import type { BoardMemberView, DirectoryUser } from "./board-view";

type Role = "EDITOR" | "COMMENTER" | "VIEWER";

export function MembersModal({
  open,
  boardId,
  isPersonal,
  members,
  directory,
  onClose,
}: {
  open: boolean;
  boardId: string;
  isPersonal: boolean;
  members: BoardMemberView[];
  directory: DirectoryUser[];
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [query, setQuery] = useState("");

  const roleByUser = new Map(members.map((m) => [m.userId, m.role]));
  const filtered = directory.filter((u) =>
    `${u.fullName} ${u.username}`.toLowerCase().includes(query.toLowerCase()),
  );

  function change(userId: string, value: string) {
    if (value === "default") start(() => removeMember(boardId, userId));
    else start(() => addMember(boardId, userId, value as Role));
  }

  return (
    <Modal open={open} onClose={onClose} title="Участники и роли">
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
            const current = (roleByUser.get(u.id) as string) ?? "default";
            return (
              <div
                key={u.id}
                className="flex items-center gap-3 rounded-lg glass p-2.5"
              >
                <Avatar
                  image={u.avatar}
                  emoji={u.emoji}
                  initials={u.initials}
                  size={32}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-neutral-100">{u.fullName}</p>
                  <p className="truncate text-xs text-neutral-500">@{u.username}</p>
                </div>
                <select
                  value={current}
                  disabled={pending}
                  onChange={(e) => change(u.id, e.target.value)}
                  className="rounded-lg border border-neutral-700 bg-neutral-900/60 px-2 py-1.5 text-xs text-neutral-100 outline-none focus:border-sky-500 disabled:opacity-50"
                >
                  <option value="default">
                    {isPersonal ? "Нет доступа" : "По умолчанию"}
                  </option>
                  <option value="EDITOR">Редактор</option>
                  <option value="COMMENTER">Комментатор</option>
                  <option value="VIEWER">Наблюдатель</option>
                </select>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="py-6 text-center text-sm text-neutral-500">
              Никого не найдено
            </p>
          )}
        </div>

        <p className="text-xs leading-relaxed text-neutral-500">
          {isPersonal
            ? "Приглашённые получают доступ к этой личной доске в выбранной роли."
            : "Общая доска доступна всем как редакторам. Здесь можно понизить роль конкретным людям (Комментатор — только комментарии, Наблюдатель — только просмотр)."}
        </p>
      </div>
    </Modal>
  );
}
