"use client";

import { useRef, useState } from "react";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  SquareCode,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Link2,
  Check,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Markdown } from "@/components/ui/markdown";

/**
 * Task description field. Opens in read view (rendered Markdown); the editor
 * with a formatting toolbar appears after clicking the pencil. Always emits a
 * hidden `description` input so the surrounding task form submits the value.
 */
export function DescriptionEditor({
  defaultValue,
  disabled,
}: {
  defaultValue: string;
  disabled: boolean;
}) {
  // Normalize CRLF → LF so state length matches the textarea's selection offsets.
  const [value, setValue] = useState(defaultValue.replace(/\r\n?/g, "\n"));
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  /** Wrap the current selection in an inline marker (bold/italic/…). */
  function wrap(marker: string, placeholder = "текст") {
    const ta = ref.current;
    if (!ta) return;
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

  /** Prefix every selected line (headings, lists, quotes). */
  function prefixLines(prefix: string) {
    const ta = ref.current;
    if (!ta) return;
    const src = ta.value;
    const from = src.lastIndexOf("\n", ta.selectionStart - 1) + 1;
    const nl = src.indexOf("\n", ta.selectionEnd);
    const to = nl === -1 ? src.length : nl;
    const numbered = prefix === "1. ";
    const block = src
      .slice(from, to)
      .split("\n")
      .map((ln, i) => (numbered ? `${i + 1}. ` : prefix) + ln)
      .join("\n");
    const next = src.slice(0, from) + block + src.slice(to);
    setValue(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(from, from + block.length);
    });
  }

  function insertLink() {
    const ta = ref.current;
    if (!ta) return;
    const src = ta.value;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = src.slice(start, end) || "текст";
    const next = src.slice(0, start) + `[${sel}](url)` + src.slice(end);
    setValue(next);
    requestAnimationFrame(() => {
      ta.focus();
      const urlAt = start + sel.length + 3; // after "[sel]("
      ta.setSelectionRange(urlAt, urlAt + 3);
    });
  }

  function insertFence() {
    const ta = ref.current;
    if (!ta) return;
    const src = ta.value;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = src.slice(start, end) || "код";
    const next = src.slice(0, start) + "```\n" + sel + "\n```" + src.slice(end);
    setValue(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + 4, start + 4 + sel.length);
    });
  }

  const readView = value.trim() ? (
    <Markdown>{value}</Markdown>
  ) : (
    <p className="text-sm text-neutral-600">Описание не заполнено</p>
  );

  // Read-only viewers: just the rendered description (no pencil).
  if (disabled) {
    return (
      <>
        <input type="hidden" name="description" value={value} />
        <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 px-3.5 py-3 text-neutral-200">
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
          <div className="flex flex-wrap items-center gap-0.5">
            <ToolbarBtn onClick={() => wrap("**")} title="Жирный">
              <Bold className="h-4 w-4" />
            </ToolbarBtn>
            <ToolbarBtn onClick={() => wrap("*")} title="Курсив">
              <Italic className="h-4 w-4" />
            </ToolbarBtn>
            <ToolbarBtn onClick={() => wrap("~~")} title="Зачёркнутый">
              <Strikethrough className="h-4 w-4" />
            </ToolbarBtn>
            <ToolbarBtn onClick={() => wrap("`")} title="Код (строка)">
              <Code className="h-4 w-4" />
            </ToolbarBtn>
            <Divider />
            <ToolbarBtn onClick={() => prefixLines("## ")} title="Заголовок">
              <Heading2 className="h-4 w-4" />
            </ToolbarBtn>
            <ToolbarBtn onClick={() => prefixLines("- ")} title="Список">
              <List className="h-4 w-4" />
            </ToolbarBtn>
            <ToolbarBtn onClick={() => prefixLines("1. ")} title="Нумерованный список">
              <ListOrdered className="h-4 w-4" />
            </ToolbarBtn>
            <ToolbarBtn onClick={() => prefixLines("> ")} title="Цитата">
              <Quote className="h-4 w-4" />
            </ToolbarBtn>
            <Divider />
            <ToolbarBtn onClick={insertLink} title="Ссылка">
              <Link2 className="h-4 w-4" />
            </ToolbarBtn>
            <ToolbarBtn onClick={insertFence} title="Блок кода">
              <SquareCode className="h-4 w-4" />
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
            rows={9}
            className="w-full resize-y rounded-xl border border-neutral-800 bg-neutral-950/40 px-3.5 py-3 text-base sm:text-sm leading-relaxed text-neutral-100 placeholder:text-neutral-600 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
            placeholder="Опишите задачу… Поддерживается полный Markdown."
          />
          <p className="text-[11px] leading-snug text-neutral-600">
            Markdown: <code># заголовки</code>, <code>- списки</code>,{" "}
            <b>**жирный**</b>, <i>*курсив*</i>, <s>~~зачёркнутый~~</s>,{" "}
            <code>`код`</code>, <code>&gt; цитата</code>,{" "}
            <code>[ссылка](url)</code>, таблицы, <code>```блоки```</code>,
            списки задач <code>- [ ]</code>.
          </p>
        </>
      ) : (
        <div className="group relative rounded-xl border border-neutral-800 bg-neutral-950/40 px-3.5 py-3 text-neutral-200">
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

function Divider() {
  return <span className="mx-0.5 h-5 w-px shrink-0 bg-white/10" />;
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
