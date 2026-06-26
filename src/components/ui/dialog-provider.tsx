"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "./modal";
import { Button } from "./button";
import { Input } from "./input";

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};
type PromptOptions = {
  title: string;
  label?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
};

type DialogState =
  | { kind: "confirm"; opts: ConfirmOptions }
  | { kind: "prompt"; opts: PromptOptions }
  | null;

type DialogCtx = {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  prompt: (opts: PromptOptions) => Promise<string | null>;
};

const Ctx = createContext<DialogCtx | null>(null);

export function useConfirm() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useConfirm must be used within <DialogProvider>");
  return ctx.confirm;
}
export function usePrompt() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePrompt must be used within <DialogProvider>");
  return ctx.prompt;
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DialogState>(null);
  const [value, setValue] = useState("");
  const resolver = useRef<((v: unknown) => void) | null>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve as (v: unknown) => void;
        setState({ kind: "confirm", opts });
      }),
    [],
  );

  const prompt = useCallback(
    (opts: PromptOptions) =>
      new Promise<string | null>((resolve) => {
        resolver.current = resolve as (v: unknown) => void;
        setValue(opts.defaultValue ?? "");
        setState({ kind: "prompt", opts });
      }),
    [],
  );

  const finish = useCallback((result: boolean | string | null) => {
    resolver.current?.(result);
    resolver.current = null;
    setState(null);
  }, []);

  return (
    <Ctx.Provider value={{ confirm, prompt }}>
      {children}

      <Modal
        open={state?.kind === "confirm"}
        onClose={() => finish(false)}
        title={state?.kind === "confirm" ? state.opts.title : ""}
      >
        {state?.kind === "confirm" && (
          <div className="space-y-5">
            <div className="flex gap-3">
              {state.opts.danger && (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-400">
                  <AlertTriangle className="h-5 w-5" />
                </span>
              )}
              {state.opts.message && (
                <p className="text-sm leading-6 text-neutral-400">
                  {state.opts.message}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => finish(false)}>
                {state.opts.cancelLabel ?? "Отмена"}
              </Button>
              <Button
                variant={state.opts.danger ? "danger" : "primary"}
                onClick={() => finish(true)}
              >
                {state.opts.confirmLabel ?? "Подтвердить"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={state?.kind === "prompt"}
        onClose={() => finish(null)}
        title={state?.kind === "prompt" ? state.opts.title : ""}
      >
        {state?.kind === "prompt" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              finish(value.trim() ? value.trim() : null);
            }}
            className="space-y-4"
          >
            {state.opts.label && (
              <label className="block text-sm font-medium text-neutral-300">
                {state.opts.label}
              </label>
            )}
            <Input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={state.opts.placeholder}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => finish(null)}>
                Отмена
              </Button>
              <Button type="submit">
                {state.opts.confirmLabel ?? "ОК"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </Ctx.Provider>
  );
}
