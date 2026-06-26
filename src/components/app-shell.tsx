"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
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
} from "lucide-react";
import { cn } from "@/lib/cn";
import { logout } from "@/app/actions/session";
import type { SessionUser } from "@/lib/auth";
import { shortName, initials } from "@/lib/names";

type NavItem = { href: string; label: string; icon: React.ElementType };

const baseNav: NavItem[] = [
  { href: "/dashboard", label: "Дашборд", icon: LayoutDashboard },
  { href: "/boards", label: "Доски", icon: LayoutGrid },
  { href: "/search", label: "Поиск", icon: Search },
  { href: "/messages", label: "Сообщения", icon: MessageCircle },
  { href: "/calendar", label: "Календарь", icon: CalendarDays },
  { href: "/profile", label: "Профиль", icon: UserIcon },
];

const adminNav: NavItem[] = [
  { href: "/admin/users", label: "Пользователи", icon: Users },
];

function NavLinks({
  items,
  pathname,
  unreadTotal,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  unreadTotal: number;
  onNavigate?: () => void;
}) {
  return (
    <nav className="space-y-1">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        const badge = href === "/messages" && unreadTotal > 0 ? unreadTotal : 0;
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "text-white"
                : "text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200",
            )}
          >
            {active && (
              <motion.span
                layoutId="nav-active"
                className="absolute inset-0 rounded-lg bg-sky-500/15 ring-1 ring-inset ring-sky-500/30"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
            <Icon className="relative h-4 w-4 shrink-0" />
            <span className="relative">{label}</span>
            {badge > 0 && (
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

function UserCard({ user }: { user: SessionUser }) {
  return (
    <div className="flex items-center gap-3 border-t border-neutral-800 p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 text-sm font-semibold text-white">
        {initials(user)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-neutral-200">
          {shortName(user)}
        </p>
        <p className="truncate text-xs text-neutral-500">@{user.username}</p>
      </div>
      <form action={logout}>
        <button
          type="submit"
          title="Выйти"
          className="rounded-md p-2 text-neutral-500 transition-colors hover:bg-neutral-800 hover:text-red-400"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

export function AppShell({
  user,
  unreadTotal,
  children,
}: {
  user: SessionUser;
  unreadTotal: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const items = [...baseNav, ...(user.role === "ADMIN" ? adminNav : [])];

  return (
    <div className="flex min-h-dvh bg-neutral-950">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-neutral-800 bg-neutral-900/40 md:flex">
        <div className="flex h-14 items-center px-5">
          <span className="bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-xl font-bold text-transparent">
            Projectra
          </span>
        </div>
        <div className="flex-1 px-3 py-2">
          <NavLinks items={items} pathname={pathname} unreadTotal={unreadTotal} />
        </div>
        <UserCard user={user} />
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
              className="absolute left-0 top-0 flex h-full w-64 flex-col border-r border-neutral-800 bg-neutral-900"
            >
              <div className="flex h-14 items-center justify-between px-5">
                <span className="bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-xl font-bold text-transparent">
                  Projectra
                </span>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 px-3 py-2">
                <NavLinks
                  items={items}
                  pathname={pathname}
                  unreadTotal={unreadTotal}
                  onNavigate={() => setMobileOpen(false)}
                />
              </div>
              <UserCard user={user} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-neutral-800 px-4 md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="relative rounded-md p-2 text-neutral-300 hover:bg-neutral-800"
          >
            <Menu className="h-5 w-5" />
            {unreadTotal > 0 && (
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-sky-500" />
            )}
          </button>
          <span className="bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-lg font-bold text-transparent">
            Projectra
          </span>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
