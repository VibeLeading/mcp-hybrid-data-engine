#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type Row = Record<string, string | number | null>;

interface Table {
  columns: string[];
  rows: Row[];
}

type AggregateOp = "sum" | "avg" | "min" | "max" | "count";

/**
 * The Flow: an in-memory columnar store that accepts CSV-ish rows and runs
 * simple aggregate queries over column arrays. Persisted to `data/flow.json`.
 *
 * This is a zero-dependency default intended to demonstrate the *shape* of the
 * analytical plane. In production, back this interface with DuckDB / Parquet so
 * the HUD can be fed in milliseconds.
 */
export class AnalyticsEngine {
  private readonly path: string;
  private tables: Map<string, Table> = new Map();

  constructor() {
    const raw = process.env.MCP_FLOW_PATH ?? "data/flow.json";
    this.path = resolve(raw);
    mkdirSync(resolve(dirnameOf(this.path)), { recursive: true });
    this.load();
  }

  private load(): void {
    if (!existsSync(this.path)) return;
    try {
      const parsed = JSON.parse(readFileSync(this.path, "utf8")) as Record<
        string,
        Table
      >;
      for (const [name, table] of Object.entries(parsed)) {
        this.tables.set(name, table);
      }
    } catch {
      // Corrupt or missing persistence file: start empty.
    }
  }

  private persist(): void {
    const data = Object.fromEntries(this.tables.entries());
    writeFileSync(this.path, JSON.stringify(data, null, 2), "utf8");
  }

  putRows(table: string, columns: string[], rows: unknown[]): number {
    const typedRows: Row[] = [];
    for (const row of rows) {
      if (typeof row !== "object" || row === null) continue;
      const record = row as Row;
      const normalized: Row = {};
      for (const col of columns) {
        const value = record[col] ?? (record as Record<string, unknown>)[String(col)] ?? null;
        const n =
          typeof value === "number"
            ? value
            : typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))
              ? Number(value)
              : typeof value === "string" || value === null
                ? value
                : null;
        normalized[col] = n;
      }
      typedRows.push(normalized);
    }
    const existing = this.tables.get(table) ?? { columns, rows: [] };
    existing.columns = columns;
    existing.rows.push(...typedRows);
    this.tables.set(table, existing);
    this.persist();
    return typedRows.length;
  }

  query(
    table: string,
    operation: AggregateOp,
    column: string,
    groupBy?: string,
  ): unknown {
    const t = this.tables.get(table);
    if (!t) throw new Error(`flow: unknown table "${table}"`);
    if (!t.columns.includes(column)) {
      throw new Error(`flow: unknown column "${column}"`);
    }
    if (groupBy && !t.columns.includes(groupBy)) {
      throw new Error(`flow: unknown groupBy column "${groupBy}"`);
    }

    const groups = groupBy
      ? new Map<string, Row[]>()
      : new Map<string, Row[]>([["__all__", t.rows]]);
    if (groupBy) {
      for (const row of t.rows) {
        const key = String(row[groupBy] ?? "null");
        const bucket = groups.get(key) ?? [];
        bucket.push(row);
        groups.set(key, bucket);
      }
    }

    const out: { group: string; [key: string]: unknown }[] = [];
    for (const [key, rows] of groups) {
      out.push({ group: key, result: this.aggregate(rows, operation, column) });
    }
    return out;
  }

  private aggregate(
    rows: Row[],
    op: AggregateOp,
    column: string,
  ): string | number {
    if (op === "count") return rows.length;
    const values = rows
      .map((r) => r[column])
      .filter((v): v is number => typeof v === "number");
    if (values.length === 0) return op === "avg" ? 0 : 0;
    switch (op) {
      case "sum":
        return values.reduce((a, b) => a + b, 0);
      case "avg":
        return values.reduce((a, b) => a + b, 0) / values.length;
      case "min":
        return Math.min(...values);
      case "max":
        return Math.max(...values);
    }
  }
}

function dirnameOf(p: string): string {
  const idx = p.lastIndexOf("/");
  return idx >= 0 ? p.slice(0, idx) : ".";
}
