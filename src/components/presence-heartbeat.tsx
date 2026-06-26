"use client";

import { useEffect } from "react";

/** Periodically pings the server so others see this user as online. */
export function PresenceHeartbeat() {
  useEffect(() => {
    let stopped = false;
    const ping = () => {
      if (document.visibilityState === "visible") {
        fetch("/api/presence", { method: "POST" }).catch(() => {});
      }
    };
    ping();
    const id = setInterval(() => {
      if (!stopped) ping();
    }, 30_000);
    const onVisible = () => ping();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return null;
}
