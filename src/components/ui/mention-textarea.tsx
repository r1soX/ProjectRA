"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ChangeEvent,
} from "react";
import { Avatar } from "@/components/ui/avatar";

interface MentionUser {
  id: string;
  username: string;
  fullName: string;
  initials: string;
  avatar: string | null;
  emoji: string | null;
}

interface Props {
  name?: string;
  value: string;
  onChange: (v: string) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
  boardId?: string; // used to fetch board members for suggestions
  users?: MentionUser[]; // pre-loaded list (preferred over boardId fetch)
  autoFocus?: boolean;
}

export function MentionTextarea({
  name,
  value,
  onChange,
  onKeyDown,
  placeholder,
  className,
  rows = 3,
  users = [],
  autoFocus,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [suggestions, setSuggestions] = useState<MentionUser[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [query, setQuery] = useState("");

  // Detect @ trigger
  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    onChange(v);

    const pos = e.target.selectionStart ?? v.length;
    // find the last @ before cursor that isn't preceded by a word char
    const before = v.slice(0, pos);
    const match = before.match(/(^|[\s\n])@([\w.]*)$/);
    if (match) {
      const q = match[2].toLowerCase();
      setQuery(q);
      setMentionStart(before.lastIndexOf("@"));
      const filtered = users.filter(
        (u) =>
          u.username.toLowerCase().includes(q) ||
          u.fullName.toLowerCase().includes(q),
      );
      setSuggestions(filtered.slice(0, 6));
      setActiveIdx(0);
    } else {
      setSuggestions([]);
      setMentionStart(null);
    }
  }

  function insertMention(user: MentionUser) {
    if (mentionStart === null) return;
    const before = value.slice(0, mentionStart) + "@" + user.username + " ";
    const after = value.slice(
      (textareaRef.current?.selectionStart ?? value.length),
    );
    const next = before + after;
    onChange(next);
    setSuggestions([]);
    setMentionStart(null);
    setTimeout(() => {
      const ta = textareaRef.current;
      if (ta) {
        ta.focus();
        ta.selectionStart = ta.selectionEnd = before.length;
      }
    }, 0);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => (i - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(suggestions[activeIdx]);
        return;
      }
      if (e.key === "Escape") {
        setSuggestions([]);
        return;
      }
    }
    onKeyDown?.(e);
  }

  // Close on outside click
  useEffect(() => {
    if (!suggestions.length) return;
    function onDown(e: MouseEvent) {
      if (textareaRef.current && !textareaRef.current.contains(e.target as Node)) {
        setSuggestions([]);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [suggestions.length]);

  void query; // used implicitly via users filter

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        name={name}
        value={value}
        autoFocus={autoFocus}
        rows={rows}
        placeholder={placeholder}
        className={className}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
      {suggestions.length > 0 && (
        <div className="glass-strong absolute bottom-full left-0 z-30 mb-1 w-64 overflow-hidden rounded-xl shadow-2xl">
          {suggestions.map((u, i) => (
            <button
              key={u.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(u);
              }}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition ${
                i === activeIdx ? "bg-sky-500/20" : "hover:bg-white/5"
              }`}
            >
              <Avatar
                image={u.avatar}
                emoji={u.emoji}
                initials={u.initials}
                size={28}
              />
              <div className="min-w-0">
                <p className="truncate text-sm text-neutral-100">{u.fullName}</p>
                <p className="text-xs text-neutral-500">@{u.username}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
