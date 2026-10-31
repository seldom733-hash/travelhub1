# Navitravel — agent instructions

## Frontend design

For new UI screens, redesigns, or visual polish, use the `frontend-design` skill
(`.agents/skills/frontend-design/`). Preserve existing product conventions
(design tokens, RU/AZ/EN copy, accessibility) and verify the result in the
browser at desktop and mobile widths.

## Graphify

A project-scoped Graphify skill and a prebuilt code graph are available.

- Graph: `graphify-out/graph.json`
- CLI: `.venv-graphify\Scripts\graphify.exe`
- Skill: `.agents/skills/graphify/SKILL.md`
- Team guide: [`docs/GRAPHIFY.md`](docs/GRAPHIFY.md)

First-time setup / refresh:

```powershell
.\scripts\graphify-setup.cmd -Rebuild
```

or on Linux/macOS:

```bash
./scripts/graphify-setup.sh --rebuild
```

If the PowerShell execution policy blocks `.ps1`, use the `.cmd` wrapper above
or run `powershell -ExecutionPolicy Bypass -File .\scripts\graphify-setup.ps1`.

For questions about the codebase, architecture, file relationships, suppliers,
catalog, pricing, or data flow, use the `graphify` skill / CLI **before**
scanning the repository with grep:

```powershell
.\.venv-graphify\Scripts\graphify.exe query "<question>"
.\.venv-graphify\Scripts\graphify.exe explain "<symbol>"
.\.venv-graphify\Scripts\graphify.exe path "<A>" "<B>"
```

Rebuild after substantial code changes:

```powershell
.\.venv-graphify\Scripts\graphify.exe update . --force
```

`graphify-out/` and `.venv-graphify/` are local artifacts and are git-ignored.
Always verify graph answers against the actual source before changing code.
