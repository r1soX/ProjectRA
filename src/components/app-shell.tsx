"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence, MotionConfig } from "motion/react";
import {
  LayoutDashboard,
  LayoutGrid,
  MessageCircle,
  CalendarDays,
  Search,
  Users,
  User as UserIcon,
  LogOut,
  Menu,
  X,
  Shield,
  BarChart2,
  LayoutTemplate,
  Inbox,
  BarChart3,
  ScrollText,
  Star,
  PanelLeftClose,
  PanelLeftOpen,
  MoreHorizontal,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { logout } from "@/app/actions/session";
import type { SessionUser } from "@/lib/auth";
import { shortName, initials } from "@/lib/names";
import { Avatar } from "@/components/ui/avatar";
import { NotificationCenter } from "@/components/notification-center";
import { CommandPalette } from "@/components/command-palette";

function openCommand() {
  window.dispatchEvent(new Event("projectra:command"));
}

export type NavCaps = {
  boards: boolean;
  messages: boolean;
  tasks: boolean;
  adminUsers: boolean;
  adminPerms: boolean;
  adminTemplates: boolean;
};

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  // Capability required to show this item; omitted = always visible.
  cap?: keyof NavCaps;
};

const baseNav: NavItem[] = [
  // Обзор
  { href: "/dashboard", label: "Дашборд", icon: LayoutDashboard },
  // Работа и планирование
  { href: "/boards", label: "Доски", icon: LayoutGrid, cap: "boards" },
  { href: "/calendar", label: "Календарь", icon: CalendarDays, cap: "tasks" },
  { href: "/workload", label: "Нагрузка", icon: BarChart2, cap: "tasks" },
  // Коммуникации
  { href: "/inbox", label: "Входящие", icon: Inbox },
  { href: "/messages", label: "Сообщения", icon: MessageCircle, cap: "messages" },
  // Утилиты / справка / аккаунт
  { href: "/search", label: "Поиск", icon: Search, cap: "boards" },
  { href: "/docs", label: "Справка", icon: BookOpen },
  { href: "/profile", label: "Профиль", icon: UserIcon },
];

const adminNav: NavItem[] = [
  // Управление
  { href: "/admin/users", label: "Пользователи", icon: Users, cap: "adminUsers" },
  { href: "/admin/permissions", label: "Права доступа", icon: Shield, cap: "adminPerms" },
  { href: "/admin/templates", label: "Шаблоны", icon: LayoutTemplate, cap: "adminTemplates" },
  // Аналитика и аудит
  { href: "/admin/analytics", label: "Аналитика", icon: BarChart3 },
  { href: "/admin/audit", label: "Журнал", icon: ScrollText },
];

// Primary destinations surfaced in the mobile bottom bar (in priority order).
const MOBILE_PRIMARY = ["/dashboard", "/boards", "/inbox", "/messages"];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function NavLinks({
  items,
  pathname,
  unreadTotal,
  notifUnread,
  collapsed,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  unreadTotal: number;
  notifUnread: number;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className="space-y-1">
      {items.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        const badge =
          href === "/messages" ? unreadTotal : href === "/inbox" ? notifUnread : 0;
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            title={collapsed ? label : undefined}
            aria-label={collapsed ? label : undefined}
            className={cn(
              "relative flex items-center rounded-xl text-sm font-medium transition-colors",
              collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2",
              active
                ? "text-white"
                : "text-neutral-400 hover:bg-white/5 hover:text-neutral-100",
            )}
          >
            {active && (
              <motion.span
                layoutId="nav-active"
                className="absolute inset-0 rounded-xl border border-white/10 bg-gradient-to-r from-sky-500/25 to-indigo-500/15 shadow-lg shadow-sky-500/10"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
            <span className="relative">
              <Icon className="h-4 w-4 shrink-0" />
              {collapsed && badge > 0 && (
                <span className="absolute -right-1.5 -top-1.5 h-2 w-2 rounded-full bg-sky-400 ring-2 ring-neutral-950" />
              )}
            </span>
            {!collapsed && <span className="relative">{label}</span>}
            {!collapsed && badge > 0 && (
              <span className="relative ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-500 px-1.5 text-xs font-semibold text-white">
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export type SidebarBoard = { id: string; title: string; color: string };

const PIN_KEY = "projectra:pinned-boards";

function BoardsNav({
  boards,
  pathname,
  collapsed,
  onNavigate,
}: {
  boards: SidebarBoard[];
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const [pins, setPins] = useState<string[]>([]);
  useEffect(() => {
    try {
      const r = localStorage.getItem(PIN_KEY);
      if (r) setPins(JSON.parse(r));
    } catch {
      /* ignore */
    }
  }, []);
  function togglePin(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setPins((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem(PIN_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }
  if (boards.length === 0) return null;
  const pinned = boards.filter((b) => pins.includes(b.id));
  const rest = boards.filter((b) => !pins.includes(b.id));
  const ordered = [...pinned, ...rest].slice(0, 14);

  if (collapsed) {
    return (
      <div className="mt-3 space-y-0.5 border-t border-white/5 pt-3">
        {ordered.map((b) => {
          const active = pathname === `/boards/${b.id}`;
          return (
            <Link
              key={b.id}
              href={`/boards/${b.id}`}
              onClick={onNavigate}
              title={b.title}
              aria-label={b.title}
              className={cn(
                "flex items-center justify-center rounded-lg py-2 transition",
                active ? "bg-white/10" : "hover:bg-white/5",
              )}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: b.color }}
              />
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-0.5">
      <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-600">
        Доски
      </p>
      {ordered.map((b) => {
        const active = pathname === `/boards/${b.id}`;
        const isPinned = pins.includes(b.id);
        return (
          <Link
            key={b.id}
            href={`/boards/${b.id}`}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition",
              active
                ? "bg-white/10 text-neutral-100"
                : "text-neutral-400 hover:bg-white/5 hover:text-neutral-200",
            )}
          >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: b.color }} />
            <span className="min-w-0 flex-1 truncate">{b.title}</span>
            <button
              onClick={(e) => togglePin(b.id, e)}
              aria-label={isPinned ? "Открепить" : "Закрепить"}
              className={cn(
                "shrink-0 rounded p-0.5 transition",
                isPinned
                  ? "text-amber-400"
                  : "text-neutral-700 opacity-0 hover:text-neutral-400 group-hover:opacity-100",
              )}
            >
              <Star className="h-3.5 w-3.5" fill={isPinned ? "currentColor" : "none"} />
            </button>
          </Link>
        );
      })}
    </div>
  );
}

function UserCard({ user, collapsed }: { user: SessionUser; collapsed?: boolean }) {
  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2 border-t border-white/10 p-2">
        <Avatar
          image={user.avatar}
          emoji={user.avatarEmoji}
          initials={initials(user)}
          size={32}
          ring
        />
        <form action={logout}>
          <button
            type="submit"
            title="Выйти"
            className="rounded-lg p-2 text-neutral-500 transition hover:bg-white/5 hover:text-red-400"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </form>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 border-t border-white/10 p-3">
      <Avatar
        image={user.avatar}
        emoji={user.avatarEmoji}
        initials={initials(user)}
        size={36}
        ring
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-neutral-100">
          {shortName(user)}
        </p>
        <p className="truncate text-xs text-neutral-500">@{user.username}</p>
      </div>
      <form action={logout}>
        <button
          type="submit"
          title="Выйти"
          className="rounded-lg p-2 text-neutral-500 transition hover:bg-white/5 hover:text-red-400"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

const COLLAPSE_KEY = "projectra:sidebar-collapsed";

function BottomNav({
  items,
  pathname,
  unreadTotal,
  notifUnread,
  onMore,
}: {
  items: NavItem[];
  pathname: string;
  unreadTotal: number;
  notifUnread: number;
  onMore: () => void;
}) {
  const primary = MOBILE_PRIMARY.map((h) => items.find((i) => i.href === h)).filter(
    (i): i is NavItem => Boolean(i),
  );
  return (
    <nav className="glass-strong relative z-10 flex shrink-0 items-stretch border-t border-white/10 pb-[env(safe-area-inset-bottom)] md:hidden">
      {primary.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        const badge =
          href === "/messages" ? unreadTotal : href === "/inbox" ? notifUnread : 0;
        return (
          <Link
            key={href}
            href={href}
            className="relative flex flex-1 flex-col items-center gap-0.5 py-2"
          >
            {active && (
              <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-sky-400" />
            )}
            <span className="relative">
              <Icon
                className={cn(
                  "h-5 w-5 transition-colors",
                  active ? "text-sky-300" : "text-neutral-400",
                )}
              />
              {badge > 0 && (
                <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-500 px-1 text-[10px] font-semibold text-white">
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </span>
            <span
              className={cn(
                "text-[10px] font-medium transition-colors",
                active ? "text-sky-300" : "text-neutral-500",
              )}
            >
              {label}
            </span>
          </Link>
        );
      })}
      <button
        onClick={onMore}
        aria-label="Ещё"
        className="relative flex flex-1 flex-col items-center gap-0.5 py-2"
      >
        <MoreHorizontal className="h-5 w-5 text-neutral-400" />
        <span className="text-[10px] font-medium text-neutral-500">Ещё</span>
      </button>
    </nav>
  );
}

export function AppShell({
  user,
  unreadTotal,
  notifUnread,
  caps,
  boards,
  children,
}: {
  user: SessionUser;
  unreadTotal: number;
  notifUnread: number;
  caps: NavCaps;
  boards: SidebarBoard[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const items = [...baseNav, ...(user.role === "ADMIN" ? adminNav : [])].filter(
    (i) => !i.cap || caps[i.cap],
  );

  return (
    <MotionConfig reducedMotion="user">
    <div className="relative flex h-dvh overflow-hidden">
      <div className="app-ambient" />

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "glass-strong relative z-10 hidden shrink-0 flex-col border-r border-white/10 transition-[width] duration-200 md:flex",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <div
          className={cn(
            "flex h-16 items-center",
            collapsed ? "justify-center px-2" : "gap-2 px-5",
          )}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-indigo-500 text-sm font-black text-white shadow-lg shadow-sky-500/25">
            P
          </span>
          {!collapsed && (
            <span className="bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-lg font-bold text-transparent">
              Projectra
            </span>
          )}
          {!collapsed && (
            <button
              onClick={toggleCollapsed}
              title="Свернуть меню"
              aria-label="Свернуть меню"
              className="ml-auto rounded-lg p-1.5 text-neutral-500 transition hover:bg-white/5 hover:text-neutral-300"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>
        {collapsed ? (
          <div className="flex justify-center px-2 pt-1">
            <button
              onClick={toggleCollapsed}
              title="Развернуть меню"
              aria-label="Развернуть меню"
              className="rounded-lg p-2 text-neutral-500 transition hover:bg-white/5 hover:text-neutral-300"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="px-3 pt-1">
            <button
              onClick={openCommand}
              className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-neutral-500 transition hover:bg-white/5 hover:text-neutral-300"
            >
              <Search className="h-4 w-4" />
              <span>Поиск…</span>
              <kbd className="ml-auto rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px]">
                ⌘K
              </kbd>
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <NavLinks
            items={items}
            pathname={pathname}
            unreadTotal={unreadTotal}
            notifUnread={notifUnread}
            collapsed={collapsed}
          />
          <BoardsNav boards={boards} pathname={pathname} collapsed={collapsed} />
        </div>
        {!collapsed && (
          <div className="flex items-center justify-end border-t border-white/10 px-3 py-2">
            <NotificationCenter variant="desktop" />
          </div>
        )}
        <UserCard user={user} collapsed={collapsed} />
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 34 }}
              className="glass-strong absolute left-0 top-0 flex h-full w-64 flex-col border-r border-white/10"
            >
              <div className="flex h-16 items-center justify-between px-5">
                <span className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-indigo-500 text-sm font-black text-white shadow-lg shadow-sky-500/25">
                    P
                  </span>
                  <span className="bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-lg font-bold text-transparent">
                    Projectra
                  </span>
                </span>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg p-1.5 text-neutral-400 hover:bg-white/5"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-2">
                <NavLinks
                  items={items}
                  pathname={pathname}
                  unreadTotal={unreadTotal}
                  notifUnread={notifUnread}
                  onNavigate={() => setMobileOpen(false)}
                />
                <BoardsNav
                  boards={boards}
                  pathname={pathname}
                  onNavigate={() => setMobileOpen(false)}
                />
              </div>
              <UserCard user={user} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="glass flex h-14 items-center gap-3 border-b border-white/10 px-4 md:hidden">
          <span className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-sky-400 to-indigo-500 text-xs font-black text-white">
              P
            </span>
            <span className="bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-lg font-bold text-transparent">
              Projectra
            </span>
          </span>
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={openCommand}
              aria-label="Поиск"
              className="rounded-lg p-2 text-neutral-300 transition hover:bg-white/5"
            >
              <Search className="h-5 w-5" />
            </button>
            <NotificationCenter variant="mobile" />
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
        <BottomNav
          items={items}
          pathname={pathname}
          unreadTotal={unreadTotal}
          notifUnread={notifUnread}
          onMore={() => setMobileOpen(true)}
        />
      </div>

      <CommandPalette caps={caps} />
    </div>
    </MotionConfig>
  );
}
