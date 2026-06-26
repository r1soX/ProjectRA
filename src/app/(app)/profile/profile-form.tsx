"use client";

import { useActionState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import {
  updateProfile,
  changePassword,
  type FormState,
} from "./actions";

function StatusBanner({ state }: { state: FormState }) {
  return (
    <AnimatePresence>
      {(state.error || state.ok) && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className={
            state.error
              ? "flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
              : "flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300"
          }
        >
          {state.error ? (
            <AlertCircle className="h-4 w-4 shrink-0" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          )}
          {state.error ?? state.message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5 sm:p-6">
      <h2 className="mb-4 text-lg font-semibold text-neutral-100">{title}</h2>
      {children}
    </section>
  );
}

export function ProfileForms({
  username,
  lastName,
  firstName,
  middleName,
  birthDate,
}: {
  username: string;
  lastName: string;
  firstName: string;
  middleName: string | null;
  birthDate: string | null;
}) {
  const [profileState, profileAction, profilePending] = useActionState<
    FormState,
    FormData
  >(updateProfile, {});
  const [pwState, pwAction, pwPending] = useActionState<FormState, FormData>(
    changePassword,
    {},
  );

  return (
    <div className="space-y-6">
      <Card title="Профиль">
        <form action={profileAction} className="space-y-4">
          <Field label="Логин">
            <Input value={username} disabled readOnly />
          </Field>
          <Field label="Фамилия" htmlFor="lastName">
            <Input id="lastName" name="lastName" defaultValue={lastName} />
          </Field>
          <Field label="Имя" htmlFor="firstName">
            <Input id="firstName" name="firstName" defaultValue={firstName} />
          </Field>
          <Field label="Отчество" htmlFor="middleName">
            <Input
              id="middleName"
              name="middleName"
              defaultValue={middleName ?? ""}
              placeholder="необязательно"
            />
          </Field>
          <Field label="Дата рождения" htmlFor="birthDate">
            <Input
              id="birthDate"
              name="birthDate"
              type="date"
              defaultValue={birthDate ?? ""}
              className="[color-scheme:dark]"
            />
          </Field>
          <StatusBanner state={profileState} />
          <Button type="submit" loading={profilePending}>
            Сохранить
          </Button>
        </form>
      </Card>

      <Card title="Смена пароля">
        <form action={pwAction} className="space-y-4">
          <Field label="Текущий пароль" htmlFor="current">
            <Input id="current" name="current" type="password" autoComplete="current-password" />
          </Field>
          <Field label="Новый пароль" htmlFor="next" hint="Минимум 6 символов">
            <Input id="next" name="next" type="password" autoComplete="new-password" />
          </Field>
          <Field label="Повторите новый пароль" htmlFor="confirm">
            <Input id="confirm" name="confirm" type="password" autoComplete="new-password" />
          </Field>
          <StatusBanner state={pwState} />
          <Button type="submit" loading={pwPending}>
            Изменить пароль
          </Button>
        </form>
      </Card>
    </div>
  );
}
