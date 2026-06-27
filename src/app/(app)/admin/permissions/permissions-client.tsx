"use client";

import { useEffect, useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { Shield, Users, ChevronDown, ChevronUp, Check, X } from "lucide-react";
import {
  updateRolePerm,
  updateUserPerm,
  applyPermTemplate,
  applyRoleTemplate,
} from "./actions";
import { PERM_TEMPLATES, type PermTemplateKey } from "@/lib/perm-templates";

// ── Shared template bar ─────────────────────────────────────────────────────

function TemplateBar({
  onApply,
  pending,
  active,
}: {
  onApply: (key: PermTemplateKey) => void;
  pending: boolean;
  active: PermTemplateKey | null;
}) {
  const keys = Object.keys(PERM_TEMPLATES) as PermTemplateKey[];
  return (
    <div className="mb-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Применить шаблон прав
      </p>
      <div className="flex flex-wrap gap-2">
        {keys.map((key) => {
          const tpl = PERM_TEMPLATES[key];
          const isLoading = pending && active === key;
          return (
            <button
              key={key}
              type="button"
              disabled={pending}
              onClick={() => onApply(key)}
              className={cn(
                "flex flex-col rounded-lg border px-3 py-2 text-left transition disabled:opacity-50 hover:brightness-125",
                tpl.bg,
                tpl.border,
              )}
            >
              <span className={cn("text-xs font-semibold", tpl.color)}>
                {isLoading ? "Применяю…" : tpl.label}
              </span>
              <span className="text-[11px] text-neutral-500">{tpl.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

type PermKey = string;
type PermGroup = { group: string; items: { perm: PermKey; label: string }[] };
type PermMap = Record<string, boolean>;
type UserEntry = {
  id: string;
  username: string;
  role: string;
  fullName: string;
  initials: string;
  avatar: string | null;
  emoji: string | null;
  permMap: PermMap;
};

// ── Toggle ─────────────────────────────────────────────────────────────────

function PermToggle({
  value,
  onToggle,
  disabled,
}: {
  value: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs transition",
        value
          ? "border-emerald-500 bg-emerald-500/20 text-emerald-400"
          : "border-red-500/40 bg-red-500/10 text-red-400",
        "disabled:opacity-40",
      )}
      title={value ? "Разрешено" : "Запрещено"}
    >
      {value ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
    </button>
  );
}

// ── Role permissions panel ─────────────────────────────────────────────────

function RolePermPanel({
  role,
  label,
  permMap,
  groups,
}: {
  role: string;
  label: string;
  permMap: PermMap;
  groups: PermGroup[];
}) {
  const [map, setMap] = useState<PermMap>(permMap);
  const [pending, start] = useTransition();
  const [tplPending, startTpl] = useTransition();
  const [activeTpl, setActiveTpl] = useState<PermTemplateKey | null>(null);
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    new Set(groups.map((g) => g.group)),
  );

  // Keep in sync after the server revalidates (e.g. template applied).
  useEffect(() => {
    setMap(permMap);
  }, [permMap]);

  function toggle(perm: PermKey) {
    const newVal = !map[perm];
    setMap((m) => ({ ...m, [perm]: newVal }));
    start(() => updateRolePerm(role, perm, newVal));
  }

  function handleTemplate(key: PermTemplateKey) {
    setActiveTpl(key);
    startTpl(async () => {
      const res = await applyRoleTemplate(role, key);
      setMap(res.permMap);
      setActiveTpl(null);
    });
  }

  function toggleGroup(group: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }

  return (
    <div className="glass rounded-2xl border border-white/10 p-5">
      <div className="mb-4 flex items-center gap-2">
        <Shield className="h-5 w-5 text-sky-400" />
        <h2 className="text-base font-semibold text-neutral-100">{label}</h2>
        <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-xs text-sky-300">
          роль
        </span>
      </div>
      <TemplateBar onApply={handleTemplate} pending={tplPending} active={activeTpl} />
      <div className="space-y-3">
        {groups.map((g) => {
          const open = openGroups.has(g.group);
          return (
            <div
              key={g.group}
              className="overflow-hidden rounded-xl border border-white/[0.07]"
            >
              <button
                type="button"
                onClick={() => toggleGroup(g.group)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-neutral-300 hover:bg-white/[0.04]"
              >
                {g.group}
                {open ? (
                  <ChevronUp className="h-4 w-4 text-neutral-600" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-neutral-600" />
                )}
              </button>
              {open && (
                <div className="divide-y divide-white/[0.05]">
                  {g.items.map(({ perm, label: lbl }) => (
                    <div
                      key={perm}
                      className="flex items-center justify-between px-3 py-2"
                    >
                      <span className="text-xs text-neutral-400">{lbl}</span>
                      <PermToggle
                        value={!!map[perm]}
                        onToggle={() => toggle(perm)}
                        disabled={pending || tplPending}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── User permissions panel ─────────────────────────────────────────────────

function UserPermRow({
  user,
  groups,
}: {
  user: UserEntry;
  groups: PermGroup[];
}) {
  const [open, setOpen] = useState(false);
  const [map, setMap] = useState<PermMap>(user.permMap);
  const [pending, start] = useTransition();
  const [templatePending, startTemplate] = useTransition();
  const [activeTemplate, setActiveTemplate] = useState<PermTemplateKey | null>(null);

  // Sync when server refreshes props after template apply
  useEffect(() => {
    setMap(user.permMap);
  }, [user.permMap]);

  function toggle(perm: PermKey) {
    const newVal = !map[perm];
    setMap((m) => ({ ...m, [perm]: newVal }));
    start(() => updateUserPerm(user.id, perm, newVal));
  }

  function handleTemplate(key: PermTemplateKey) {
    setActiveTemplate(key);
    startTemplate(async () => {
      const result = await applyPermTemplate(user.id, user.role, key);
      setMap(result.permMap);
      setActiveTemplate(null);
    });
  }

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.07]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03]"
      >
        <Avatar
          image={user.avatar}
          emoji={user.emoji}
          initials={user.initials}
          size={32}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-neutral-100">
            {user.fullName}
          </p>
          <p className="text-xs text-neutral-500">@{user.username}</p>
        </div>
        <span
          className={cn(
            "rounded px-2 py-0.5 text-xs font-medium",
            user.role === "ADMIN"
              ? "bg-sky-500/20 text-sky-300"
              : "bg-neutral-800 text-neutral-400",
          )}
        >
          {user.role === "ADMIN" ? "Администратор" : "Пользователь"}
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-neutral-600" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-neutral-600" />
        )}
      </button>

      {open && (
        <div className="border-t border-white/[0.07] px-4 py-4">
          <TemplateBar
            onApply={handleTemplate}
            pending={templatePending}
            active={activeTemplate}
          />

          {/* Individual toggles */}
          <p className="mb-3 text-xs text-neutral-600">
            Или переключите права вручную — они перекрывают настройки роли.
          </p>
          <div className="grid gap-x-4 gap-y-0 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((g) => (
              <div key={g.group} className="mb-3">
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
                  {g.group}
                </p>
                {g.items.map(({ perm, label }) => (
                  <div key={perm} className="flex items-center justify-between py-1">
                    <span className="text-xs text-neutral-400">{label}</span>
                    <PermToggle
                      value={!!map[perm]}
                      onToggle={() => toggle(perm)}
                      disabled={pending || templatePending}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main client component ──────────────────────────────────────────────────

export function PermissionsClient({
  groups,
  userRoleMap,
  adminRoleMap,
  users,
}: {
  groups: PermGroup[];
  userRoleMap: PermMap;
  adminRoleMap: PermMap;
  users: UserEntry[];
}) {
  const [tab, setTab] = useState<"roles" | "users">("roles");

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="mb-2 text-2xl font-bold text-neutral-100">Права доступа</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Настройте разрешения по ролям или персонально для каждого пользователя.
      </p>

      {/* Tabs */}
      <div className="mb-6 flex w-fit gap-1 rounded-xl bg-neutral-900/60 p-1">
        {(["roles", "users"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition",
              tab === t
                ? "bg-white/10 text-neutral-100"
                : "text-neutral-500 hover:text-neutral-300",
            )}
          >
            {t === "roles" ? (
              <Shield className="h-4 w-4" />
            ) : (
              <Users className="h-4 w-4" />
            )}
            {t === "roles" ? "По ролям" : "По пользователям"}
          </button>
        ))}
      </div>

      {tab === "roles" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <RolePermPanel
            role="USER"
            label="Пользователь"
            permMap={userRoleMap}
            groups={groups}
          />
          <RolePermPanel
            role="ADMIN"
            label="Администратор"
            permMap={adminRoleMap}
            groups={groups}
          />
        </div>
      )}

      {tab === "users" && (
        <div className="space-y-2">
          {users.map((u) => (
            <UserPermRow key={u.id} user={u} groups={groups} />
          ))}
        </div>
      )}
    </div>
  );
}
