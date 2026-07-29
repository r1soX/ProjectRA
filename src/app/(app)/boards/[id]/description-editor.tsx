"use client";

import { useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Eye,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { renderMarkdown } from "@/lib/render-markdown";

/**
 * Task description field with a Markdown-subset toolbar and live preview.
 * Always emits a hidden `description` input so the surrounding task form
 * submits the current value (even in read-only mode — unchanged).
 */
export function DescriptionEditor({
  defaultValue,
  disabled,
}: {
  defaultValue: string;
  disabled: boolean;
}) {
  const [value, setValue] = useState(defaultValue);
  const [preview, setPreview] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  function wrap(marker: string, placeholder = "текст") {
    const ta = ref.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = value.slice(start, end) || placeholder;
    const next =
      value.slice(0, start) + marker + sel + marker + value.slice(end);
    setValue(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + marker.length, start + marker.length + sel.length);
    });
  }

  // Read-only viewers: render the formatted description, keep the value in the form.
  if (disabled) {
    return (
      <>
        <input type="hidden" name="description" value={value} />
        {value.trim() ? (
          <div className="whitespace-pre-wrap break-words rounded-xl border border-neutral-800 bg-neutral-950/40 px-3.5 py-3 text-base leading-relaxed text-neutral-200 sm:text-sm">
            {renderMarkdown(value)}
          </div>
        ) : (
          <p className="text-sm text-neutral-600">Описание не заполнено</p>
        )}
      </>
    );
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name="description" value={value} />
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
          className="ml-auto"
          onClick={() => setPreview((p) => !p)}
          title={preview ? "Редактировать" : "Предпросмотр"}
          active={preview}
        >
          {preview ? <Pencil className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </ToolbarBtn>
      </div>

      {preview ? (
        <div className="min-h-[13rem] whitespace-pre-wrap break-words rounded-xl border border-neutral-800 bg-neutral-950/40 px-3.5 py-3 text-base leading-relaxed text-neutral-200 sm:text-sm">
          {value.trim() ? (
            renderMarkdown(value)
          ) : (
            <span className="text-neutral-600">Нечего показывать</span>
          )}
        </div>
      ) : (
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={8}
          className="w-full resize-y rounded-xl border border-neutral-800 bg-neutral-950/40 px-3.5 py-3 text-base sm:text-sm leading-relaxed text-neutral-100 placeholder:text-neutral-600 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
          placeholder="Опишите задачу, шаги, критерии готовности…"
        />
      )}

      <p className="text-[11px] text-neutral-600">
        Форматирование: <b>**жирный**</b>, <i>*курсив*</i>,{" "}
        <u>__подчёркнутый__</u>, <s>~~зачёркнутый~~</s>, `код`
      </p>
    </div>
  );
}

function ToolbarBtn({
  children,
  onClick,
  title,
  active,
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-white/5 hover:text-neutral-200",
        active && "bg-white/10 text-sky-300",
        className,
      )}
    >
      {children}
    </button>
  );
}
