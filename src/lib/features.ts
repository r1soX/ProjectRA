/**
 * Feature flags.
 *
 * These features are temporarily hidden from the UI (product decision, июль
 * 2026) but the code behind them is kept intact. To bring one back, flip its
 * flag to `true` — every render site is gated on these constants, so nothing
 * else needs to change.
 */
export const FEATURES = {
  subtasks: false,
  timeTracking: false,
  labels: false,
} as const;
