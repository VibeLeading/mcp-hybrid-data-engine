#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { StoneEngine } from "./sql-engine.js";
import { VectorStore } from "./vector-store.js";
import { AnalyticsEngine } from "./analytics-engine.js";

async function main() {
  const stone = new StoneEngine();
  const light = new VectorStore();
  const flow = new AnalyticsEngine();

  const server = new McpServer({
    name: "mcp-hybrid-data-engine",
    version: "0.1.0",
  });

  server.tool(
    "query_stone",
    "Executes read-only SQL against a SQLite file (The Stone). " +
      "Only SELECT/PRAGMA/WITH/EXPLAIN statements are allowed.",
    { sql: z.string(), database: z.string().optional() },
    async ({ sql, database }) => {
      try {
        const rows = stone.query(sql, database);
        return {
          content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: (err as Error).message }],
        };
      }
    },
  );

  server.tool(
    "stone_cdc_tick",
    "Returns the current CDC tick / version and a changed-tables heuristic for The Stone.",
    {},
    async () => {
      const tick = stone.changes();
      return {
        content: [{ type: "text", text: JSON.stringify(tick, null, 2) }],
      };
    },
  );

  server.tool(
    "index_light",
    "Adds a document to the Light semantic vector index.",
    { id: z.string(), text: z.string(), metadata: z.string().optional() },
    async ({ id, text, metadata }) => {
      light.add(id, text, metadata);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ indexed: id, count: light.size() }),
          },
        ],
      };
    },
  );

  server.tool(
    "semantic_search",
    "Returns ranked matches from The Light vector index with similarity scores.",
    {
      query: z.string(),
      top_k: z.number().int().positive().optional(),
      threshold: z.number().min(0).max(1).optional(),
    },
    async ({ query, top_k, threshold }) => {
      const results = light.search(query, top_k ?? 5, threshold ?? 0);
      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    },
  );

  server.tool(
    "flow_put_rows",
    "Stores CSV-ish rows into The Flow columnar store for analytics.",
    {
      table: z.string(),
      columns: z.array(z.string()),
      rows: z.array(z.unknown()),
    },
    async ({ table, columns, rows }) => {
      const written = flow.putRows(table, columns, rows);
      return {
        content: [{ type: "text", text: JSON.stringify(written) }],
      };
    },
  );

  server.tool(
    "flow_query",
    "Runs an aggregate query over The Flow columnar store.",
    {
      table: z.string(),
      operation: z.enum(["sum", "avg", "min", "max", "count"]),
      column: z.string(),
      groupBy: z.string().optional(),
    },
    async ({ table, operation, column, groupBy }) => {
      try {
        const result = flow.query(table, operation, column, groupBy);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: (err as Error).message }],
        };
      }
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("[mcp-hybrid-data-engine] fatal:", err);
  process.exit(1);
});
