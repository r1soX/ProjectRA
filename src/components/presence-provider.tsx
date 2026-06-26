"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { isOnline } from "@/lib/presence";

type PresenceState = { ids: Set<string>; ready: boolean };

const PresenceContext = createContext<PresenceState>({
  ids: new Set(),
  ready: false,
});

/**
 * Online while this stream is connected. Returns live status from the server
 * (по открытым соединениям); falls back to lastSeenAt until the stream is ready.
 */
export function useOnline(
  userId: string,
  fallbackLastSeen?: string | null,
): boolean {
  const { ids, ready } = useContext(PresenceContext);
  if (ready) return ids.has(userId);
  return isOnline(fallbackLastSeen);
}

/** For lists: read the context once, then derive per-user status. */
export function usePresence(): PresenceState {
  return useContext(PresenceContext);
}
export function onlineFromState(
  state: PresenceState,
  userId: string,
  fallbackLastSeen?: string | null,
): boolean {
  return state.ready ? state.ids.has(userId) : isOnline(fallbackLastSeen);
}

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PresenceState>({
    ids: new Set(),
    ready: false,
  });

  useEffect(() => {
    const es = new EventSource("/api/presence/stream");
    es.addEventListener("init", (e) => {
      try {
        const arr: string[] = JSON.parse((e as MessageEvent).data);
        setState({ ids: new Set(arr), ready: true });
      } catch {
        /* ignore */
      }
    });
    es.addEventListener("presence", (e) => {
      try {
        const { userId, online } = JSON.parse((e as MessageEvent).data);
        setState((s) => {
          const ids = new Set(s.ids);
          if (online) ids.add(userId);
          else ids.delete(userId);
          return { ids, ready: true };
        });
      } catch {
        /* ignore */
      }
    });
    return () => es.close();
  }, []);

  const value = useMemo(() => state, [state]);
  return (
    <PresenceContext.Provider value={value}>
      {children}
    </PresenceContext.Provider>
  );
}
