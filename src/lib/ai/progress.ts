import "server-only";

export type AiProgressPhase =
  | "preparing"
  | "thinking"
  | "tool"
  | "finalizing"
  | "completed"
  | "error";

export type AiProgressEvent = {
  id: string;
  phase: AiProgressPhase;
  label: string;
  status: "active" | "done" | "error";
  round?: number;
  tool?: string;
  createdAt: string;
};

export type AiProgressSnapshot = {
  active: boolean;
  events: AiProgressEvent[];
  updatedAt: number;
};

const TTL_MS = 2 * 60_000;
const MAX_EVENTS = 12;

const globalProgress = globalThis as typeof globalThis & {
  projectraAiProgress?: Map<string, AiProgressSnapshot>;
};

const progressStore: Map<string, AiProgressSnapshot> =
  globalProgress.projectraAiProgress ?? new Map<string, AiProgressSnapshot>();
globalProgress.projectraAiProgress = progressStore;

export function beginAiProgress(userId: string, label: string) {
  const snapshot: AiProgressSnapshot = {
    active: true,
    events: [progressEvent("preparing", label)],
    updatedAt: Date.now(),
  };
  progressStore.set(userId, snapshot);
}

export function advanceAiProgress(
  userId: string,
  label: string,
  meta: {
    phase?: AiProgressPhase;
    round?: number;
    tool?: string;
    status?: "active" | "done" | "error";
  } = {},
) {
  const current = progressStore.get(userId) ?? {
    active: true,
    events: [],
    updatedAt: Date.now(),
  };
  if (meta.tool && meta.status && meta.status !== "active") {
    const matchingIndex = current.events.findLastIndex(
      (event) => event.tool === meta.tool && event.status === "active",
    );
    if (matchingIndex >= 0) {
      const events = [...current.events];
      events[matchingIndex] = {
        ...events[matchingIndex],
        label,
        status: meta.status,
      };
      progressStore.set(userId, {
        active: true,
        events: events.slice(-MAX_EVENTS),
        updatedAt: Date.now(),
      });
      return;
    }
  }
  const events = current.events.map((event) =>
    event.status === "active" ? { ...event, status: "done" as const } : event,
  );
  events.push(progressEvent(meta.phase ?? "thinking", label, meta));
  progressStore.set(userId, {
    active: true,
    events: events.slice(-MAX_EVENTS),
    updatedAt: Date.now(),
  });
}

export function completeAiProgress(userId: string, label = "Ответ готов") {
  finishAiProgress(userId, "completed", label, "done");
}

export function failAiProgress(userId: string, label: string) {
  finishAiProgress(userId, "error", label, "error");
}

export function getAiProgress(userId: string): AiProgressSnapshot | null {
  const snapshot = progressStore.get(userId);
  if (!snapshot) return null;
  if (Date.now() - snapshot.updatedAt > TTL_MS) {
    progressStore.delete(userId);
    return null;
  }
  return snapshot;
}

function finishAiProgress(
  userId: string,
  phase: "completed" | "error",
  label: string,
  status: "done" | "error",
) {
  const current = progressStore.get(userId);
  const events = (current?.events ?? []).map((event) =>
    event.status === "active" ? { ...event, status: "done" as const } : event,
  );
  events.push({ ...progressEvent(phase, label), status });
  progressStore.set(userId, {
    active: false,
    events: events.slice(-MAX_EVENTS),
    updatedAt: Date.now(),
  });
}

function progressEvent(
  phase: AiProgressPhase,
  label: string,
  meta: {
    round?: number;
    tool?: string;
    status?: "active" | "done" | "error";
  } = {},
): AiProgressEvent {
  return {
    id: crypto.randomUUID(),
    phase,
    label,
    status: meta.status ?? "active",
    ...(meta.round ? { round: meta.round } : {}),
    ...(meta.tool ? { tool: meta.tool } : {}),
    createdAt: new Date().toISOString(),
  };
}
