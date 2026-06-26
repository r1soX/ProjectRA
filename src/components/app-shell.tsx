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
import { Avatar } from "@/components/ui/avatar";
import { NotificationCenter } from "@/components/notification-center";

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
              "relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
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
    <div className="relative flex h-dvh overflow-hidden">
      <div className="app-ambient" />

      {/* Desktop sidebar */}
      <aside className="glass-strong relative z-10 hidden w-60 shrink-0 flex-col border-r border-white/10 md:flex">
        <div className="flex h-16 items-center gap-2 px-5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-indigo-500 text-sm font-black text-white shadow-lg shadow-sky-500/25">
            P
          </span>
          <span className="bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-lg font-bold text-transparent">
            Projectra
          </span>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <NavLinks items={items} pathname={pathname} unreadTotal={unreadTotal} />
        </div>
        <div className="flex items-center justify-end border-t border-white/10 px-3 py-2">
          <NotificationCenter />
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
      <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="glass flex h-14 items-center gap-3 border-b border-white/10 px-4 md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="relative rounded-lg p-2 text-neutral-300 hover:bg-white/5"
          >
            <Menu className="h-5 w-5" />
            {unreadTotal > 0 && (
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.8)]" />
            )}
          </button>
          <span className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-sky-400 to-indigo-500 text-xs font-black text-white">
              P
            </span>
            <span className="bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-lg font-bold text-transparent">
              Projectra
            </span>
          </span>
          <div className="ml-auto">
            <NotificationCenter />
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
