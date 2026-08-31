# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-08-31

### Added

- Initial release of the Vibe Leading Hybrid Data Engine MCP server.
- `query_stone`: read-only SQL execution against a SQLite file (The Stone).
- `stone_cdc_tick`: CDC tick / version with changed-tables heuristic.
- `index_light`: add documents to the in-memory semantic index (The Light).
- `semantic_search`: ngram bag-of-words cosine similarity search.
- `flow_put_rows`: store columnar CSV-ish rows for analytics (The Flow).
- `flow_query`: sum/avg/min/max/count aggregates with optional grouping.
