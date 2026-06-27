import { Fragment } from "react";

/** Renders text with @mention tokens highlighted. */
export function renderWithMentions(text: string) {
  const parts = text.split(/(@[\w.]+)/g);
  return parts.map((part, i) =>
    /^@[\w.]+$/.test(part) ? (
      <span
        key={i}
        className="rounded bg-sky-500/20 px-0.5 font-medium text-sky-300"
      >
        {part}
      </span>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}
