"use client";

import { motion } from "motion/react";
import {
  LayoutDashboard,
  MessageSquare,
  CalendarDays,
  Share2,
} from "lucide-react";

const features = [
  { icon: LayoutDashboard, title: "Доски с перетягиванием", text: "Канбан, задачи, исполнители и сроки" },
  { icon: MessageSquare, title: "Встроенный мессенджер", text: "Чат по доскам и личные сообщения" },
  { icon: CalendarDays, title: "Календарь", text: "Все дедлайны команды в одном виде" },
  { icon: Share2, title: "Связи задач", text: "Визуальная карта зависимостей" },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.2 } },
};
const item = {
  hidden: { opacity: 0, x: -16 },
  show: { opacity: 1, x: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

export function BrandPanel() {
  return (
    <div className="relative z-10 flex h-full flex-col justify-between">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center gap-2"
      >
        <span className="bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-2xl font-bold text-transparent">
          Tandem
        </span>
      </motion.div>

      <div>
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="max-w-md text-4xl font-bold leading-tight tracking-tight text-white"
        >
          Командная работа{" "}
          <span className="bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">
            в одном ритме
          </span>
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-4 max-w-md text-neutral-400"
        >
          Задачи, обсуждения, сроки и связи проектов — на одной платформе.
        </motion.p>

        <motion.ul
          variants={container}
          initial="hidden"
          animate="show"
          className="mt-10 space-y-4"
        >
          {features.map(({ icon: Icon, title, text }) => (
            <motion.li key={title} variants={item} className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sky-300">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="font-medium text-neutral-100">{title}</p>
                <p className="text-sm text-neutral-500">{text}</p>
              </div>
            </motion.li>
          ))}
        </motion.ul>
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="text-xs text-neutral-600"
      >
        © {new Date().getFullYear()} Tandem — корпоративная система управления проектами
      </motion.p>
    </div>
  );
}
