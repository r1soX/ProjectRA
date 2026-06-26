"use client";

import { useActionState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AlertCircle, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { loginAction, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    loginAction,
    {},
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="w-full max-w-sm"
    >
      <div className="mb-8 text-center">
        <h1 className="bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-4xl font-bold tracking-tight text-transparent">
          Projectra
        </h1>
        <p className="mt-2 text-sm text-neutral-500">Вход в рабочее пространство</p>
      </div>

      <form action={action} className="space-y-4">
        <Field label="Логин" htmlFor="username">
          <Input
            id="username"
            name="username"
            autoComplete="username"
            autoFocus
            placeholder="например, v.smolin"
          />
        </Field>

        <Field label="Пароль" htmlFor="password">
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
          />
        </Field>

        <AnimatePresence>
          {state.error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              {state.error}
            </motion.div>
          )}
        </AnimatePresence>

        <Button type="submit" loading={pending} className="w-full">
          {!pending && <LogIn className="h-4 w-4" />}
          Войти
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-neutral-600">
        Регистрация доступна только администратору
      </p>
    </motion.div>
  );
}
