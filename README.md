# @vibeleading/mcp-hybrid-data-engine

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
npm install -g @vibeleading/mcp-hybrid-data-engine
# or run directly without installing:
npx -y @vibeleading/mcp-hybrid-data-engine
# or run straight from the GitHub source (builds automatically):
npx -y github:VibeLeading/mcp-hybrid-data-engine
```

## Requirements

- **Node.js >= 22** — required. The Stone relies on the built-in `node:sqlite`
  module, which does not exist in older Node versions. If the server cannot
  start (missing build or old Node), MCP clients report a generic
  "connection closed" error.
- No other runtime dependencies — everything ships with the package.

## Quick Start (Agent Setup)

Give your agent the full VibeLeading methodology in one paste:

> **Give me the Vibe Leading methodology: install the 5 agent skills so I can lead AI agents by intent + real-time telemetry, and add the 4 MCP servers so I get hands in the corporate engine.**
>
> **SKILLS (npx skills add):**
> `npx skills add VibeLeading/mission-script VibeLeading/ira-prompting VibeLeading/hud-setup VibeLeading/pit-stop-audit VibeLeading/org-geometry`
>
> **MCP SERVERS (@vibeleading scope, add to YOUR agent's MCP config):**
> `@vibeleading/mcp-hybrid-data-engine`
> `@vibeleading/mcp-document-architect`
> `@vibeleading/mcp-real-time-scout`
> `@vibeleading/mcp-privacy-shield`
>
> **ENV VARS:**
> `MCP_STONE_PATH=data/stone.db`
> `MCP_LIGHT_PATH=data/light.json`
> `MCP_FLOW_PATH=data/flow.json`
> `MCP_DOCS_ROOT=~/.vlb-docs`
> `MCP_SHIELD_NAMES=1`
>
> **NOTE: MCP installation method varies by agent. Examples:**
> - **OpenCode:** `opencode mcp add hybrid-data-engine -- npx -y @vibeleading/mcp-hybrid-data-engine`
> - **Claude Code / Cursor:** add to `.mcp.json` / `claude_desktop_config.json` with `command=npx, args=[-y, @vibeleading/mcp-hybrid-data-engine]`
> - **Codex:** configure via its MCP settings UI
> Use the method appropriate for your agent.

Paste the block above into your AI agent (OpenCode, Claude Code, Cursor, Codex, etc.). It will install the skills, write the MCP config, and you're ready to lead.

## Client configuration

Add to your MCP client config (e.g. Claude Code `.mcp.json` or Cursor `mcp.json`):

```json
{
  "mcpServers": {
    "hybrid-data-engine": {
      "command": "npx",
      "args": ["-y", "@vibeleading/mcp-hybrid-data-engine"]
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

## Publishing

Published to the npm registry via **OIDC trusted publishing** — no npm tokens stored
anywhere. Pushing a version tag triggers the `.github/workflows/publish.yml` workflow:

```bash
npm version patch -m "release: v%s"
git push origin main --follow-tags
```

- **One-time bootstrap.** The very first published version cannot use trusted
  publishing (the trust relationship attaches to an existing package). Publish
  `0.1.1` once manually (`npm publish` after `npm login`, or a short-lived
  publish-scoped token), then configure **Trusted Publisher** on npmjs.com → the
  package → Settings → Trusted publishing → GitHub Actions → owner
  `VibeLeading`, repo `mcp-hybrid-data-engine`, workflow `publish.yml`, action
  `allow npm publish` (requires 2FA once per package).
- Requires **Node.js >= 22** and npm >= 11.5.1 on the runner (handled by the workflow).

## License & Attribution

MIT — Copyright (c) 2026 Jean Machuca (see [LICENSE](LICENSE)).

This server implements concepts from the book **_Vibe Leading The AI: The Corporate Race
Against Machines_** by Jean Machuca (ISBN 9798252505008, © 2026 Jean Machuca). The book
is copyrighted commercial material; this repository does not republish its text. Buy the
book at [https://vibeleading.org](https://vibeleading.org) or
[https://a.co/d/04L5YatK](https://a.co/d/04L5YatK). Author website: [jeanmachuca.com](https://jeanmachuca.com) · Support on GitHub Sponsors: [github.com/sponsors/jeanmachuca](https://github.com/sponsors/jeanmachuca). See [NOTICE](NOTICE).
