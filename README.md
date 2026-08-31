# mcp-hybrid-data-engine

The Memory Hub.

An MCP server implementing the **Vibe Leading Hybrid Data Engine** — the integration
of the three data planes described in *Vibe Leading The AI*:

| Plane   | Role                                              | This server            | Production backend          |
|---------|---------------------------------------------------|------------------------|-----------------------------|
| Stone   | Legacy SQL / Oracle, fact ledger                  | `query_stone` (SQLite) | Oracle / Postgres + CDC     |
| Light   | Vector semantic context                          | `index_light` / `semantic_search` | Pinecone / Milvus + embeddings |
| Flow    | Analytical columnar for the HUD (milliseconds)   | `flow_put_rows` / `flow_query` | DuckDB / Parquet            |

## Installation

```bash
npm install -g mcp-hybrid-data-engine
# or run directly without installing:
npx mcp-hybrid-data-engine
```

## Client configuration

Add to your MCP client config (e.g. Claude Code `.mcp.json` or Cursor `mcp.json`):

```json
{
  "mcpServers": {
    "hybrid-data-engine": {
      "command": "npx",
      "args": ["mcp-hybrid-data-engine"]
    }
  }
}
```

## Tools

| Tool               | Description                                            | Key args                                        |
|--------------------|--------------------------------------------------------|-------------------------------------------------|
| `query_stone`      | Read-only SQL against a SQLite file (Stone)           | `sql`, `database?`                              |
| `stone_cdc_tick`   | CDC version + changed-tables heuristic                | —                                               |
| `index_light`      | Add a doc to the semantic index (Light)               | `id`, `text`, `metadata?`                       |
| `semantic_search`  | Ranked cosine-similarity matches                      | `query`, `top_k?`, `threshold?`                 |
| `flow_put_rows`    | Store columnar rows for analytics (Flow)              | `table`, `columns`, `rows`                      |
| `flow_query`       | sum/avg/min/max/count with optional grouping          | `table`, `operation`, `column`, `groupBy?`      |

## Environment variables

| Variable          | Default           | Purpose                                  |
|-------------------|-------------------|------------------------------------------|
| `MCP_STONE_PATH`  | `data/stone.db`   | SQLite file used by The Stone            |
| `MCP_LIGHT_PATH`  | `data/light.json` | Persistence file for The Light index     |
| `MCP_FLOW_PATH`   | `data/flow.json`  | Persistence file for The Flow store      |

## Notes

- **Stone**: read-only by design. Statement prefixes are validated; anything
  outside SELECT/PRAGMA/WITH/EXPLAIN is rejected. The `stone_cdc_tick` reports a
  coarse WAL-based heuristic — a production deployment should wire a real CDC
  adapter (Debezium + Oracle) behind the same surface.
- **Light**: uses a deterministic bag-of-character-ngrams hashed-vector
  embedding with cosine similarity. Swap in a real embedding provider
  (OpenAI / voyage) and a real vector DB (Pinecone / Milvus) behind the
  `Embedder` interface in `src/vector-store.ts`.
- **Flow**: an in-memory columnar store persisted to JSON. See
  `src/analytics-engine.ts` for the interface that a DuckDB / Parquet backend
  would implement.

## License

MIT — Copyright (c) 2026 Jean Machuca
