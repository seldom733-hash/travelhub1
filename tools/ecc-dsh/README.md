# ECC → DSH curated bridge

This directory is a **curated skills bridge**, not an ECC installer.

It adapts the engineering process of [affaan-m/ECC](https://github.com/affaan-m/ECC)
to Navitravel's DSH skills catalog without importing ECC's executable surface.

## What is included

- Five project skills in `.agents/skills/`:
  - `navitravel-backend`
  - `navitravel-frontend`
  - `navitravel-verify`
  - `navitravel-security`
  - `navitravel-review`
- A pinned upstream catalog mapping in `catalog.json`.
- A read-only validator: `node scripts/check-ecc-dsh.mjs`.

## What is intentionally not included

- ECC hooks or hook runtime
- AgentShield binary
- MCP configuration
- install scripts
- automatic memory injection
- Claude/Codex marketplace lifecycle

These parts depend on another harness's lifecycle and can execute code or
modify the environment. They are out of scope until separately reviewed.

## Upstream pin

```text
4adeee6732a12d1540f49a4d50a38ce8c97f9a53
```

The local skills are project-specific adaptations, not verbatim copies. When
updating, review the upstream diff first and update `catalog.json` together
with the skill text.

## Validation

```powershell
node scripts/check-ecc-dsh.mjs
```

The validator checks that every mapped local skill exists, has valid frontmatter,
and that the catalog has not silently acquired an executable/installer field.
