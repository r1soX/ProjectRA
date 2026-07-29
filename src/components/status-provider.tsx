"use client";

import { createContext, useContext, useMemo } from "react";
import {
  DEFAULT_STATUSES,
  defaultStatusOf,
  type StatusDef,
} from "@/lib/status";

const StatusContext = createContext<StatusDef[]>(DEFAULT_STATUSES);

export function StatusProvider({
  statuses,
  children,
}: {
  statuses: StatusDef[];
  children: React.ReactNode;
}) {
  return (
    <StatusContext.Provider value={statuses}>{children}</StatusContext.Provider>
  );
}

/** The ordered list of statuses (falls back to defaults outside a provider). */
export function useStatuses(): StatusDef[] {
  return useContext(StatusContext);
}

/** A lookup `(key) => StatusDef`, with a neutral fallback for unknown keys. */
export function useStatusOf() {
  const list = useContext(StatusContext);
  return useMemo(() => {
    const map = new Map(list.map((s) => [s.key, s]));
    return (key: string): StatusDef => map.get(key) ?? defaultStatusOf(key);
  }, [list]);
}
