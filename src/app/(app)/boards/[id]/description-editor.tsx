"use client";

import { useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Check,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { renderMarkdown } from "@/lib/render-markdown";

/**
 * Task description field. Opens in read view (formatted Markdown); an editor
 * with a formatting toolbar appears only after clicking the pencil. Always
 * emits a hidden `description` input so the surrounding task form submits the
 * current value.
 */
export function DescriptionEditor({
  defaultValue,
  disabled,
}: {
  defaultValue: string;
  disabled: boolean;
}) {
  // Normalize CRLF → LF so the state length matches the textarea's selection
  // offsets (the browser measures selection against LF-normalized content).
  const [value, setValue] = useState(defaultValue.replace(/\r\n?/g, "\n"));
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  function wrap(marker: string, placeholder = "текст") {
    const ta = ref.current;
    if (!ta) return;
    // Slice the textarea's OWN value: its selectionStart/End are guaranteed to
    // line up with it, whereas the React state could differ (e.g. stray \r).
    const src = ta.value;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = src.slice(start, end) || placeholder;
    const next = src.slice(0, start) + marker + sel + marker + src.slice(end);
    setValue(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + marker.length, start + marker.length + sel.length);
    });
  }

  const readView = value.trim() ? (
    <div className="whitespace-pre-wrap break-words text-base leading-relaxed text-neutral-200 sm:text-sm">
      {renderMarkdown(value)}
    </div>
  ) : (
    <p className="text-sm text-neutral-600">Описание не заполнено</p>
  );

  // Read-only viewers: just the formatted description (no pencil).
  if (disabled) {
    return (
      <>
        <input type="hidden" name="description" value={value} />
        <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 px-3.5 py-3">
          {readView}
        </div>
      </>
    );
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name="description" value={value} />

      {editing ? (
        <>
          <div className="flex items-center gap-0.5">
            <ToolbarBtn onClick={() => wrap("**")} title="Жирный">
              <Bold className="h-4 w-4" />
            </ToolbarBtn>
            <ToolbarBtn onClick={() => wrap("*")} title="Курсив">
              <Italic className="h-4 w-4" />
            </ToolbarBtn>
            <ToolbarBtn onClick={() => wrap("__")} title="Подчёркнутый">
              <Underline className="h-4 w-4" />
            </ToolbarBtn>
            <ToolbarBtn onClick={() => wrap("~~")} title="Зачёркнутый">
              <Strikethrough className="h-4 w-4" />
            </ToolbarBtn>
            <ToolbarBtn onClick={() => wrap("`")} title="Моноширинный">
              <Code className="h-4 w-4" />
            </ToolbarBtn>
            <ToolbarBtn
              className="ml-auto text-emerald-400"
              onClick={() => setEditing(false)}
              title="Готово"
            >
              <Check className="h-4 w-4" />
            </ToolbarBtn>
          </div>
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
            rows={8}
            className="w-full resize-y rounded-xl border border-neutral-800 bg-neutral-950/40 px-3.5 py-3 text-base sm:text-sm leading-relaxed text-neutral-100 placeholder:text-neutral-600 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
            placeholder="Опишите задачу, шаги, критерии готовности…"
          />
          <p className="text-[11px] text-neutral-600">
            Форматирование: <b>**жирный**</b>, <i>*курсив*</i>,{" "}
            <u>__подчёркнутый__</u>, <s>~~зачёркнутый~~</s>, `код`
          </p>
        </>
      ) : (
        <div className="group relative rounded-xl border border-neutral-800 bg-neutral-950/40 px-3.5 py-3">
          <button
            type="button"
            onClick={() => setEditing(true)}
            title="Редактировать описание"
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg text-neutral-500 opacity-70 transition hover:bg-white/5 hover:text-neutral-200 group-hover:opacity-100"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <div className="pr-8">{readView}</div>
        </div>
      )}
    </div>
  );
}

function ToolbarBtn({
  children,
  onClick,
  title,
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-white/5 hover:text-neutral-200",
        className,
      )}
    >
      {children}
    </button>
  );
}
