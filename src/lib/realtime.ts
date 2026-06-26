import "server-only";
import { EventEmitter } from "node:events";

// A single process-wide event bus. Stored on globalThis so it survives
// dev hot-reloads and is shared between server actions and route handlers.
const g = globalThis as unknown as {
  __projectraBus?: EventEmitter;
  __projectraPresence?: Map<string, number>;
};
const bus = g.__projectraBus ?? (g.__projectraBus = new EventEmitter());
bus.setMaxListeners(0);

// userId → number of open presence connections (online if > 0)
const presence = g.__projectraPresence ?? (g.__projectraPresence = new Map());

export type PresenceEvent = { userId: string; online: boolean };

/** Register a presence connection. Returns true if the user just came online. */
export function presenceConnect(userId: string): boolean {
  const n = (presence.get(userId) ?? 0) + 1;
  presence.set(userId, n);
  return n === 1;
}

/** Drop a presence connection. Returns true if the user just went offline. */
export function presenceDisconnect(userId: string): boolean {
  const n = (presence.get(userId) ?? 1) - 1;
  if (n <= 0) {
    presence.delete(userId);
    return true;
  }
  presence.set(userId, n);
  return false;
}

export function onlineUserIds(): string[] {
  return [...presence.keys()];
}

export function publishPresence(userId: string, online: boolean) {
  bus.emit("presence", { userId, online } satisfies PresenceEvent);
}

export function subscribePresence(cb: (e: PresenceEvent) => void) {
  bus.on("presence", cb);
  return () => bus.off("presence", cb);
}

function channel(boardId: string) {
  return `board:${boardId}`;
}

/** Notify all subscribers that a board changed. */
export function publishBoard(boardId: string) {
  bus.emit(channel(boardId));
}

/** Subscribe to a board's changes. Returns an unsubscribe function. */
export function subscribeBoard(boardId: string, cb: () => void) {
  const ch = channel(boardId);
  bus.on(ch, cb);
  return () => bus.off(ch, cb);
}

/** Notify subscribers that a chat channel got a new message. */
export function publishChannel(channelId: string) {
  bus.emit(`channel:${channelId}`);
}

export function subscribeChannel(channelId: string, cb: () => void) {
  const ch = `channel:${channelId}`;
  bus.on(ch, cb);
  return () => bus.off(ch, cb);
}

export type UserEvent = {
  type: "message";
  channelId: string;
  fromName: string;
  preview: string;
  title: string; // conversation title (sender for DM, board name for board chat)
  isBoard: boolean;
};

/** Notify a specific user (cross-channel, for toasts + unread badge). */
export function publishUser(userId: string, payload: UserEvent) {
  bus.emit(`user:${userId}`, payload);
}

export function subscribeUser(
  userId: string,
  cb: (payload: UserEvent) => void,
) {
  const ch = `user:${userId}`;
  bus.on(ch, cb);
  return () => bus.off(ch, cb);
}
