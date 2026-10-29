# Graphify — code knowledge graph

Graphify builds a queryable graph of the repository (code, docs, SQL, configs).
The project skill lives in `.agents/skills/graphify/`; `AGENTS.md` tells agents
to query the graph before scanning files.

## Local setup

Windows:

```powershell
.\scripts\graphify-setup.cmd -Rebuild
```

Linux/macOS:

```bash
./scripts/graphify-setup.sh --rebuild
```

The script creates `.venv-graphify/`, installs `graphifyy[sql]`, and writes
`graphify-out/graph.json`, `graph.html` and `GRAPH_REPORT.md`.

If PowerShell blocks a `.ps1`, use the `.cmd` wrapper or:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\graphify-setup.ps1
```

## Queries

```powershell
.\.venv-graphify\Scripts\graphify.exe query "How does supplier catalog preview work?"
.\.venv-graphify\Scripts\graphify.exe explain "SupplierCatalogService"
.\.venv-graphify\Scripts\graphify.exe path "SupplierCatalogService" "Product"
.\.venv-graphify\Scripts\graphify.exe god-nodes
```

Refresh after substantial code changes:

```powershell
.\scripts\graphify-setup.cmd -Rebuild
```

## CI artifact

On every push to `master`/`main`, GitHub Actions job `graphify` builds the graph
and uploads a 7-day `graphify-out` artifact containing `graph.json`,
`graph.html`, `GRAPH_REPORT.md` and `manifest.json`.

To use it locally, download the artifact from the workflow run and replace your
local `graphify-out/` files. The graph is generated data: it is not committed
and `graphify-out/` stays in `.gitignore`.

## Limits

- Code extraction is local (tree-sitter) and needs no LLM key.
- SQL extraction uses `tree-sitter-sql`; some migration files still produce no
  symbols.
- Treat graph answers as navigation hints, then verify against source files.
