import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { cn } from "@/lib/cn";

// ── @mention remark plugin ──────────────────────────────────────────────────
// Splits @username tokens inside plain-text nodes into link nodes tagged with a
// class, so they survive Markdown parsing (and never fire inside code blocks —
// those aren't `text` nodes). Rendered as a styled, non-navigating span below.

interface MdNode {
  type: string;
  value?: string;
  url?: string;
  children?: MdNode[];
  data?: { hProperties?: Record<string, unknown> };
}

const MENTION = /@[\w.]+/g;

function splitMentions(value: string): MdNode[] {
  const out: MdNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  MENTION.lastIndex = 0;
  while ((m = MENTION.exec(value)) !== null) {
    if (m.index > last) out.push({ type: "text", value: value.slice(last, m.index) });
    out.push({
      type: "link",
      url: "#",
      data: { hProperties: { className: "md-mention" } },
      children: [{ type: "text", value: m[0] }],
    });
    last = m.index + m[0].length;
  }
  if (last < value.length) out.push({ type: "text", value: value.slice(last) });
  return out;
}

function walk(node: MdNode) {
  if (!node.children) return;
  const next: MdNode[] = [];
  for (const child of node.children) {
    if (child.type === "text" && child.value) {
      next.push(...splitMentions(child.value));
    } else {
      walk(child);
      next.push(child);
    }
  }
  node.children = next;
}

function remarkMentions() {
  return (tree: unknown) => walk(tree as MdNode);
}

// ── Component overrides ─────────────────────────────────────────────────────

const components: Components = {
  a({ href, className, children, ...props }) {
    if (className?.includes("md-mention")) {
      return <span className="md-mention">{children}</span>;
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    );
  },
};

// remark-breaks: a single newline becomes a line break (what users type in a
// textarea), matching GitHub-comment behaviour.
const PLUGINS = [remarkGfm, remarkBreaks, remarkMentions];

/**
 * Full GitHub-flavoured Markdown renderer (headings, lists, tables, task lists,
 * code blocks, quotes, links) + @mentions. Safe: no raw HTML, links open in a
 * new tab. Styling lives in `.prose-md` (globals.css); `compact` tightens it
 * for chat/comments.
 */
export function Markdown({
  children,
  compact = false,
  className,
}: {
  children: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("prose-md", compact && "compact", className)}>
      <ReactMarkdown remarkPlugins={PLUGINS} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
