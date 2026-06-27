import { Fragment } from "react";

// Inline tokens: `code`, **bold**, *italic*, http(s) links, @mentions.
const TOKEN =
  /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|https?:\/\/[^\s]+|@[\w.]+)/g;

/** Renders text with @mentions highlighted + light markdown (bold/italic/code/links). */
export function renderWithMentions(text: string) {
  const out: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(text)) !== null) {
    if (m.index > last) {
      out.push(<Fragment key={i++}>{text.slice(last, m.index)}</Fragment>);
    }
    const tok = m[0];
    if (tok.startsWith("`")) {
      out.push(
        <code
          key={i++}
          className="rounded bg-white/10 px-1 py-0.5 font-mono text-[0.85em] text-neutral-200"
        >
          {tok.slice(1, -1)}
        </code>,
      );
    } else if (tok.startsWith("**")) {
      out.push(
        <strong key={i++} className="font-semibold text-neutral-100">
          {tok.slice(2, -2)}
        </strong>,
      );
    } else if (tok.startsWith("*")) {
      out.push(<em key={i++}>{tok.slice(1, -1)}</em>);
    } else if (tok.startsWith("http")) {
      out.push(
        <a
          key={i++}
          href={tok}
          target="_blank"
          rel="noreferrer"
          className="text-sky-400 underline underline-offset-2 hover:text-sky-300"
        >
          {tok}
        </a>,
      );
    } else {
      out.push(
        <span
          key={i++}
          className="rounded bg-sky-500/20 px-0.5 font-medium text-sky-300"
        >
          {tok}
        </span>,
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) {
    out.push(<Fragment key={i++}>{text.slice(last)}</Fragment>);
  }
  return out;
}
