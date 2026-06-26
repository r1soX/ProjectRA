import "server-only";
import { EventEmitter } from "node:events";

// A single process-wide event bus. Stored on globalThis so it survives
// dev hot-reloads and is shared between server actions and route handlers.
const g = globalThis as unknown as { __projectraBus?: EventEmitter };
const bus = g.__projectraBus ?? (g.__projectraBus = new EventEmitter());
bus.setMaxListeners(0);

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
