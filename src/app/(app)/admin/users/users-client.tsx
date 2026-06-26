"use client";

import { useActionState, useState, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Trash2,
  UserPlus,
  Shield,
  ShieldOff,
  Ban,
  CircleCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Avatar } from "@/components/ui/avatar";
import { useConfirm } from "@/components/ui/dialog-provider";
import { cn } from "@/lib/cn";
import { fullName, initials } from "@/lib/names";
import {
  createUser,
  toggleActive,
  setRole,
  resetPassword,
  deleteUser,
  type AdminState,
} from "./actions";

export type AdminUser = {
  id: string;
  username: string;
  lastName: string;
  firstName: string;
  middleName: string | null;
  birthDate: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  avatar: string | null;
  avatarEmoji: string | null;
};

function Banner({ state }: { state: AdminState }) {
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

function CreateUserModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState<AdminState, FormData>(
    async (prev, fd) => {
      const res = await createUser(prev, fd);
      return res;
    },
    {},
  );

  return (
    <Modal open={open} onClose={onClose} title="Новый пользователь">
      <form action={action} className="space-y-4">
        <Field label="Логин" htmlFor="username" hint="латиница, цифры, . _ -">
          <Input id="username" name="username" placeholder="i.ivanov" autoFocus />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Фамилия" htmlFor="cu-last">
            <Input id="cu-last" name="lastName" placeholder="Иванов" />
          </Field>
          <Field label="Имя" htmlFor="cu-first">
            <Input id="cu-first" name="firstName" placeholder="Иван" />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Отчество" htmlFor="cu-middle">
            <Input id="cu-middle" name="middleName" placeholder="необязательно" />
          </Field>
          <Field label="Дата рождения" htmlFor="cu-birth">
            <Input
              id="cu-birth"
              name="birthDate"
              type="date"
              className="[color-scheme:dark]"
            />
          </Field>
        </div>
        <Field label="Пароль" htmlFor="cu-password" hint="Минимум 6 символов">
          <Input id="cu-password" name="password" type="text" placeholder="придумайте пароль" />
        </Field>
        <Field label="Роль" htmlFor="role">
          <select
            id="role"
            name="role"
            defaultValue="USER"
            className="h-10 w-full rounded-lg border border-neutral-700 bg-neutral-900/60 px-3 text-sm text-neutral-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30"
          >
            <option value="USER">Пользователь</option>
            <option value="ADMIN">Администратор</option>
          </select>
        </Field>
        <Banner state={state} />
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" loading={pending}>
            <UserPlus className="h-4 w-4" />
            Создать
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ResetPasswordModal({
  user,
  onClose,
}: {
  user: AdminUser | null;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState<AdminState, FormData>(
    resetPassword,
    {},
  );

  return (
    <Modal
      open={!!user}
      onClose={onClose}
      title={user ? `Сброс пароля · @${user.username}` : ""}
    >
      {user && (
        <form action={action} className="space-y-4">
          <input type="hidden" name="userId" value={user.id} />
          <Field label="Новый пароль" htmlFor="rp" hint="Минимум 6 символов">
            <Input id="rp" name="password" type="text" autoFocus />
          </Field>
          <Banner state={state} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Закрыть
            </Button>
            <Button type="submit" loading={pending}>
              <KeyRound className="h-4 w-4" />
              Сбросить
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function UserRow({
  user,
  isSelf,
  onReset,
}: {
  user: AdminUser;
  isSelf: boolean;
  onReset: (u: AdminUser) => void;
}) {
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="flex flex-col gap-3 rounded-xl glass p-4 sm:flex-row sm:items-center"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar
          image={user.avatar}
          emoji={user.avatarEmoji}
          initials={initials(user)}
          size={40}
          className={cn(
            "rounded-full",
            !user.isActive && !user.avatar && !user.avatarEmoji && "grayscale",
          )}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium text-neutral-100">{fullName(user)}</p>
            {user.role === "ADMIN" && (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300">
                админ
              </span>
            )}
            {isSelf && (
              <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-xs text-sky-300">
                вы
              </span>
            )}
            {!user.isActive && (
              <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-300">
                заблокирован
              </span>
            )}
          </div>
          <p className="truncate text-sm text-neutral-500">@{user.username}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={isSelf || pending}
          onClick={() =>
            startTransition(() =>
              setRole(user.id, user.role === "ADMIN" ? "USER" : "ADMIN"),
            )
          }
          title={user.role === "ADMIN" ? "Снять админа" : "Сделать админом"}
        >
          {user.role === "ADMIN" ? (
            <ShieldOff className="h-4 w-4" />
          ) : (
            <Shield className="h-4 w-4" />
          )}
        </Button>

        <Button
          size="sm"
          variant="secondary"
          disabled={isSelf || pending}
          onClick={() => startTransition(() => toggleActive(user.id))}
          title={user.isActive ? "Заблокировать" : "Разблокировать"}
        >
          {user.isActive ? (
            <Ban className="h-4 w-4" />
          ) : (
            <CircleCheck className="h-4 w-4" />
          )}
        </Button>

        <Button
          size="sm"
          variant="secondary"
          onClick={() => onReset(user)}
          title="Сбросить пароль"
        >
          <KeyRound className="h-4 w-4" />
        </Button>

        <Button
          size="sm"
          variant="danger"
          disabled={isSelf || pending}
          onClick={async () => {
            const ok = await confirm({
              title: "Удалить пользователя?",
              message: `@${user.username} будет удалён вместе со своими данными.`,
              confirmLabel: "Удалить",
              danger: true,
            });
            if (ok) startTransition(() => deleteUser(user.id));
          }}
          title="Удалить"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
}

export function UsersClient({
  users,
  currentUserId,
}: {
  users: AdminUser[];
  currentUserId: string;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [resetUser, setResetUser] = useState<AdminUser | null>(null);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Пользователи</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Всего: {users.length}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <UserPlus className="h-4 w-4" />
          <span className="hidden sm:inline">Создать</span>
        </Button>
      </div>

      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {users.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              isSelf={u.id === currentUserId}
              onReset={setResetUser}
            />
          ))}
        </AnimatePresence>
      </div>

      <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <ResetPasswordModal user={resetUser} onClose={() => setResetUser(null)} />
    </div>
  );
}
