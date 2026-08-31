#!/usr/bin/env node
import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const READ_ONLY_PREFIXES = ["SELECT", "PRAGMA", "WITH", "EXPLAIN"];

/**
 * The Stone: executes read-only SQL against a SQLite database file using the
 * built-in `node:sqlite` module (Node 22+). The database file path is read from
 * the `MCP_STONE_PATH` environment variable, or defaults to `data/stone.db`.
 *
 * Statements that would modify data are rejected. We guard by checking the
 * leading keyword. This mirrors the "legacy SQL/Oracle database surface" from
 * Vibe Leading The AI: a trusted, read-only window onto the general ledger of
 * facts.
 */
export class StoneEngine {
  private readonly dataDir: string;

  constructor() {
    this.dataDir = resolve(
      dirname(process.env.MCP_STONE_PATH ?? "data/stone.db"),
    );
    mkdirSync(this.dataDir, { recursive: true });
  }

  private path(database?: string): string {
    const base = process.env.MCP_STONE_PATH ?? "data/stone.db";
    return database ? resolve(dirname(base), database) : resolve(base);
  }

  private open(database?: string): DatabaseSync {
    const db = new DatabaseSync(this.path(database));
    db.exec("PRAGMA journal_mode = WAL;");
    return db;
  }

  private static firstKeyword(sql: string): string {
    const match = sql.trim().match(/^([a-zA-Z]+)/);
    return match ? match[1].toUpperCase() : "";
  }

  query(sql: string, database?: string): unknown[] {
    const keyword = StoneEngine.firstKeyword(sql);
    if (!READ_ONLY_PREFIXES.includes(keyword)) {
      throw new Error(
        `query_stone only allows read-only statements (${READ_ONLY_PREFIXES.join(
          ", ",
        )}); got "${keyword || "(none)"}".`,
      );
    }
    const db = this.open(database);
    try {
      return db.prepare(sql).all() as unknown[];
    } finally {
      db.close();
    }
  }

  /**
   * Returns a CDC tick: a coarse version counter for the default stone file
   * plus a heuristic set of "changed" tables. Because a WAL journal exists
   * while a write transaction is in flight, we treat its presence as a signal
   * of recent change; this is intentionally simple and documented as a
   * placeholder for a real CDC adapter (e.g. Debezium + Oracle).
   */
  changes(): { version: number; walPresent: boolean; tables: string[] } {
    const stonePath = resolve(process.env.MCP_STONE_PATH ?? "data/stone.db");
    const walPath = `${stonePath}-wal`;
    const walPresent = existsSync(walPath);

    let tables: string[] = [];
    let version = 0;
    if (existsSync(stonePath)) {
      const db = new DatabaseSync(stonePath);
      try {
        tables = (
          db
            .prepare(
              "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
            )
            .all() as { name: string }[]
        ).map((r) => r.name);
      } finally {
        db.close();
      }
    }

    if (walPresent) {
      version = Date.now();
    }
    return { version, walPresent, tables };
  }
}
