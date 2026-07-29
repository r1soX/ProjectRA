import React from "react";

/**
 * Renders a small, safe Markdown-style subset used in task descriptions.
 * Content flows through React text nodes (never dangerouslySetInnerHTML), so
 * it's XSS-safe by construction.
 *
 * Supported inline: **bold**, *italic*, __underline__, ~~strike~~, `code`.
 * Line breaks are preserved.
 */

// Order matters: multi-char markers (**, __, ~~) are tried before single *.
const INLINE =
  /(\*\*([^*\n]+?)\*\*)|(__([^_\n]+?)__)|(~~([^~\n]+?)~~)|(`([^`\n]+?)`)|(\*([^*\n]+?)\*)/g;

function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  INLINE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = INLINE.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const key = `${keyBase}-${i++}`;
    if (m[1]) nodes.push(<strong key={key}>{m[2]}</strong>);
    else if (m[3]) nodes.push(<u key={key}>{m[4]}</u>);
    else if (m[5]) nodes.push(<s key={key}>{m[6]}</s>);
    else if (m[7])
      nodes.push(
        <code
          key={key}
          className="rounded bg-white/10 px-1 py-0.5 font-mono text-[0.85em]"
        >
          {m[8]}
        </code>,
      );
    else if (m[9]) nodes.push(<em key={key}>{m[10]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function renderMarkdown(text: string): React.ReactNode {
  return text.split(/\r?\n/).map((line, i) => (
    <React.Fragment key={i}>
      {i > 0 && <br />}
      {renderInline(line, String(i))}
    </React.Fragment>
  ));
}
