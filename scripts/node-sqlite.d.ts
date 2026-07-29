// Minimal types for the experimental `node:sqlite` module (not yet in
// @types/node). Only what the migration script uses.
declare module "node:sqlite" {
  interface Statement {
    all(...params: unknown[]): Record<string, unknown>[];
    get(...params: unknown[]): Record<string, unknown> | undefined;
    run(...params: unknown[]): unknown;
  }
  export class DatabaseSync {
    constructor(path: string, options?: Record<string, unknown>);
    prepare(sql: string): Statement;
    close(): void;
  }
}
