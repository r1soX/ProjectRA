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
  Eye,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Markdown } from "./markdown";

/** Controlled Markdown textarea with a formatting toolbar and preview toggle. */
export function MarkdownEditor({
  value,
  onChange,
  placeholder = "Текст… Поддерживается Markdown.",
  rows = 6,
  autoFocus = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  function wrap(marker: string, placeholderText = "текст") {
    const ta = ref.current;
    if (!ta) return;
    const src = ta.value;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const sel = src.slice(s, e) || placeholderText;
    onChange(src.slice(0, s) + marker + sel + marker + src.slice(e));
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(s + marker.length, s + marker.length + sel.length);
    });
  }

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
    onChange(src.slice(0, from) + block + src.slice(to));
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(from, from + block.length);
    });
  }

  function insertLink() {
    const ta = ref.current;
    if (!ta) return;
    const src = ta.value;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const sel = src.slice(s, e) || "текст";
    onChange(src.slice(0, s) + `[${sel}](url)` + src.slice(e));
    requestAnimationFrame(() => {
      ta.focus();
      const at = s + sel.length + 3;
      ta.setSelectionRange(at, at + 3);
    });
  }

  function insertFence() {
    const ta = ref.current;
    if (!ta) return;
    const src = ta.value;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const sel = src.slice(s, e) || "код";
    onChange(src.slice(0, s) + "```\n" + sel + "\n```" + src.slice(e));
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(s + 4, s + 4 + sel.length);
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-0.5">
        <Btn onClick={() => wrap("**")} title="Жирный"><Bold className="h-4 w-4" /></Btn>
        <Btn onClick={() => wrap("*")} title="Курсив"><Italic className="h-4 w-4" /></Btn>
        <Btn onClick={() => wrap("~~")} title="Зачёркнутый"><Strikethrough className="h-4 w-4" /></Btn>
        <Btn onClick={() => wrap("`")} title="Код"><Code className="h-4 w-4" /></Btn>
        <Sep />
        <Btn onClick={() => prefixLines("## ")} title="Заголовок"><Heading2 className="h-4 w-4" /></Btn>
        <Btn onClick={() => prefixLines("- ")} title="Список"><List className="h-4 w-4" /></Btn>
        <Btn onClick={() => prefixLines("1. ")} title="Нумерованный"><ListOrdered className="h-4 w-4" /></Btn>
        <Btn onClick={() => prefixLines("> ")} title="Цитата"><Quote className="h-4 w-4" /></Btn>
        <Sep />
        <Btn onClick={insertLink} title="Ссылка"><Link2 className="h-4 w-4" /></Btn>
        <Btn onClick={insertFence} title="Блок кода"><SquareCode className="h-4 w-4" /></Btn>
        <Btn
          className={cn("ml-auto", preview && "bg-white/10 text-sky-300")}
          onClick={() => setPreview((p) => !p)}
          title={preview ? "Редактировать" : "Предпросмотр"}
        >
          {preview ? <Pencil className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Btn>
      </div>

      {preview ? (
        <div className="min-h-[8rem] rounded-xl border border-neutral-800 bg-neutral-950/40 px-3.5 py-3 text-neutral-200">
          {value.trim() ? (
            <Markdown>{value}</Markdown>
          ) : (
            <span className="text-sm text-neutral-600">Нечего показывать</span>
          )}
        </div>
      ) : (
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={autoFocus}
          rows={rows}
          placeholder={placeholder}
          className="w-full resize-y rounded-xl border border-neutral-800 bg-neutral-950/40 px-3.5 py-3 text-base sm:text-sm leading-relaxed text-neutral-100 placeholder:text-neutral-600 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
        />
      )}
    </div>
  );
}

function Sep() {
  return <span className="mx-0.5 h-5 w-px shrink-0 bg-white/10" />;
}

function Btn({
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
