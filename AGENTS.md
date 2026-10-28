# Navitravel — agent instructions

## Graphify

A project-scoped Graphify skill and a prebuilt code graph are available.

- Graph: `graphify-out/graph.json`
- CLI: `.venv-graphify\Scripts\graphify.exe`
- Skill: `.agents/skills/graphify/SKILL.md`

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
