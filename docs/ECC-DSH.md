# ECC → DSH adapter

## Decision

Use a **curated skills bridge**, not a full ECC wrapper.

ECC is built primarily around Claude Code's plugin and hook lifecycle. DSH has a
different tool/skill lifecycle. Copying ECC wholesale would import commands,
hooks, and installers that cannot be trusted to run here.

## Implemented

- Five DSH skills under `.agents/skills/`:
  - `navitravel-backend`
  - `navitravel-frontend`
  - `navitravel-verify`
  - `navitravel-security`
  - `navitravel-review`
- Catalog mapping: `tools/ecc-dsh/catalog.json`
- Validator: `scripts/check-ecc-dsh.mjs`
- Upstream pin and attribution: `tools/ecc-dsh/NOTICE.md`

## Workflow embedded

```text
plan → test → implement → review → verify → report
```

The skills make the agent:

- read the existing module pattern before editing;
- preserve RBAC, finance invariants, and localization;
- verify cross-stack parameter flow, not just compilation;
- review security boundaries for money/PII;
- state what was and was not verified.

## Not ported

```text
hooks / PreToolUse / Stop
AgentShield runtime
MCP servers
install.sh / install.ps1
automatic memory injection
Claude/Codex marketplace
```

## Update procedure

1. Review upstream changes at the pinned commit or newer.
2. Update `tools/ecc-dsh/catalog.json` (`commit` and mappings).
3. Adapt only the relevant guidance; do not copy executable code.
4. Run `node scripts/check-ecc-dsh.mjs`.
5. Smoke-test by asking the agent to use a skill on a small task.

## Why not a DSH plugin package yet

A DSH plugin has a package/manifest/lifecycle contract. This bridge intentionally
uses project skills, which DSH already discovers, so it adds value without
creating a new install path or executing third-party code.
