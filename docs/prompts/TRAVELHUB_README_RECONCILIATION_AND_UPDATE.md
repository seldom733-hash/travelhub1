# TRAVELHUB — README RECONCILIATION & UPDATE — DOCUMENTATION PASS

## 0. MODE

**DOCUMENTATION ONLY · REPOSITORY-FIRST · NO PRODUCTION CODE CHANGES**

Update the canonical root `README.md` so that it accurately describes the **current TravelHub repository**, not an earlier Phase 1/MVP state.

This is not a business-domain implementation step.

Do not change production TypeScript, Prisma schema, migrations, CI workflows, Docker/runtime configuration, frontend code, or tests merely to make them match the README.

**Runtime/repository truth wins. README must be corrected to reality — not reality changed to fit stale README text.**

---

# 1. OBJECTIVE

Produce a root README that is a reliable onboarding/source-of-truth entry point for a new engineer.

It must accurately explain:

- what TravelHub is;
- which application is current;
- repository layout;
- backend/frontend package roots;
- active technology stack;
- active database/provider;
- PostgreSQL multi-schema architecture;
- current business domains/modules;
- event-driven integration model;
- migrations;
- local development;
- build/test commands;
- Docker/runtime dependencies;
- security/configuration basics;
- CI entry point/status;
- legacy directory status;
- where Roadmap/architecture/contracts live;
- what is intentionally incomplete/deferred.

Do not turn README into the full architecture specification. Link to canonical docs for details.

---

# 2. REQUIRED SOURCES

Inspect the actual repository, not previous summaries.

At minimum:

- root directory;
- root `README.md`;
- root package/lock/workspace files if any;
- `backend/package.json`;
- `frontend/package.json`;
- backend/frontend lockfiles;
- active Docker Compose files;
- `.env.example` / config templates;
- `.github/workflows/**`;
- `backend/prisma/schema.prisma`;
- backend Prisma config;
- migration directory;
- backend `AppModule`;
- actual modules/controllers;
- frontend routes/app structure;
- current Roadmap v3;
- current Architecture Master/Baseline;
- `docs/contracts/api.md`;
- `docs/contracts/events.md`;
- `docs/contracts/ids.md`;
- ADR directory;
- `legacy/`;
- scripts used for build/test/dev/migration.

Do not assume commands from historical docs still work.

---

# 3. BASELINE RECORD

Before editing README record:

- branch;
- HEAD;
- dirty/untracked state;
- current root layout;
- active package roots;
- active DB provider;
- migration count/status;
- current frontend/backend framework versions from package manifests;
- whether root `package.json` exists;
- whether CI currently targets root/backend/frontend correctly;
- current status/purpose of `legacy/`.

Do not clean unrelated working-tree changes.

---

# 4. README STALENESS AUDIT

Create a Current → Actual → Fix matrix for every material README claim.

At minimum audit:

| Area | README says | Repository truth | Action |
|---|---|---|---|
| Product description | | | |
| Backend root | | | |
| Frontend root | | | |
| Node/package commands | | | |
| Database | | | |
| Prisma | | | |
| Docker services | | | |
| Business domains | | | |
| Finance | | | |
| Sales | | | |
| Reverse Marketplace | | | |
| Communication | | | |
| CRM | | | |
| EventBus/outbox/inbox | | | |
| Migrations | | | |
| Tests | | | |
| CI | | | |
| Legacy | | | |
| Documentation links | | | |

Any README statement not supported by current repository must be removed, corrected, or explicitly marked historical/deferred.

---

# 5. PRODUCT DESCRIPTION

Describe TravelHub at its actual current architectural scope.

Do not call it merely a tour catalog or simple booking MVP if the current system includes broader domains.

The description should reflect actual implemented/current modules such as, where confirmed:

- Catalog;
- CRM;
- Sales;
- Reverse Marketplace;
- Order;
- Booking;
- Communication;
- Finance;
- Security / access infrastructure.

Only list modules actually present.

Separate:

- implemented/current;
- planned/deferred;
- frontend UI coverage.

Do not imply every backend domain has complete production UI.

---

# 6. REPOSITORY LAYOUT

Document the actual repository structure.

At minimum classify:

- `/backend`;
- `/frontend`;
- `/docs`;
- `/legacy`;
- `/.github`;
- migrations/config directories.

For each give one-line purpose.

If root is **not** an npm package, state this clearly:

> Run npm commands from the appropriate package directory (`backend/` or `frontend/`), not repository root.

Do not fabricate a workspace setup if none exists.

---

# 7. ACTIVE APPLICATION VS LEGACY

README must make the source of truth unambiguous.

If `legacy/` is not part of current production build/runtime:

state explicitly:

- it is historical/legacy;
- it is not the current backend/frontend authority;
- current CI/build/deploy must not use it;
- its SQLite/package/config files are not current application configuration;
- contributors should not copy runtime commands/configuration from it.

Do not delete `legacy/` in this pass.

Do not expose any credentials/secrets found inside it.

If legacy is still production-reachable, stop and report rather than describing it as inactive.

---

# 8. TECHNOLOGY STACK

Read exact versions/configuration from current manifests.

Document concisely:

### Backend
- NestJS;
- Prisma;
- PostgreSQL;
- other major runtime dependencies only where useful.

### Frontend
- Next.js;
- React;
- test stack.

### Infrastructure
- PostgreSQL;
- Redis only if current application actually uses it;
- Docker Compose if current.

Do not list historical SQLite as active.

Do not copy old version numbers from stale README.

---

# 9. DATABASE ARCHITECTURE

Document actual current DB model.

If confirmed:

- PostgreSQL;
- Prisma;
- `multiSchema`;
- domain-owned schemas;
- migrations via Prisma;
- no `db push` for canonical migration workflow.

Explain at a high level that domains own their data and cross-domain interaction follows current architecture/event contracts.

Do not enumerate every model.

Link to Architecture/ADR/contracts.

---

# 10. BUSINESS DOMAINS

Generate the domain list from actual code/schema/AppModule.

For each major domain provide one concise purpose.

Example structure only:

| Domain | Responsibility |
|---|---|
| Catalog | Product/service master data |
| CRM | Customer/relationship data |
| Sales | Lead → Opportunity → Quote → Sale |
| Reverse | Buyer-request / proposal marketplace |
| Order | Order aggregate/lifecycle |
| Booking | Supplier/service booking lifecycle |
| Communication | Conversations/messages |
| Finance | Payment, Refund, Dispute, Commission policy/facts, etc. |

Do not claim deferred functionality is fully operational.

For Finance especially distinguish implemented foundation/runtime from future PSP/accounting/UI work.

---

# 11. EVENT-DRIVEN ARCHITECTURE

Describe only what actual code proves.

If applicable:

- transactional Outbox;
- Inbox deduplication;
- domain events;
- correlation/causation;
- cross-domain ownership boundaries.

Avoid claiming “guaranteed durable retry” if the independent retry worker is not yet implemented.

If retry/background publisher remains a Step 2.17 hardening item, state the limitation honestly or link to Roadmap.

Do not advertise dead code as production reliability.

---

# 12. LOCAL DEVELOPMENT

Derive commands from actual package scripts.

Document exact steps, for example:

1. clone;
2. configure environment;
3. start dependencies;
4. install backend dependencies;
5. migrate DB;
6. start backend;
7. install frontend dependencies;
8. start frontend.

Use actual commands only.

Do not put `npm ci` at repository root if no root package exists.

---

# 13. ENVIRONMENT VARIABLES

Document safe required categories from `.env.example` / config validation.

Do not include secrets.

Clearly mark:

- DB URL / DB config;
- application URLs/ports;
- JWT secrets;
- Redis if applicable;
- provider keys only if actually supported.

Never copy real credentials from legacy or local files.

---

# 14. MIGRATIONS

Document canonical migration workflow:

- generate/create only according to project conventions;
- deploy/apply;
- status;
- fresh replay expectations.

Explicitly warn against `prisma db push` if current governance forbids it.

Do not publish internal test credentials.

---

# 15. TESTING

Derive actual scripts.

Document separately:

### Backend
- typecheck;
- unit;
- targeted/full e2e;
- production build.

### Frontend
- typecheck;
- Vitest/test command;
- production build.

If full e2e requires PostgreSQL and global setup applies real migrations, state that.

Do not hardcode stale test counts as permanent README claims unless current project intentionally tracks them there.

Prefer commands and expectations over volatile counts.

---

# 16. CI/CD STATUS

Inspect actual `.github/workflows/**`.

README must distinguish:

- canonical intended CI;
- currently functioning CI;
- known hardening work if CI remains broken.

Do not claim CI is green unless repository workflow is actually valid.

If current CI still runs `npm ci` at root without a package or uses SQLite against PostgreSQL multiSchema backend, document that CI repair is owned by:

`PHASE 2 — STEP 2.17 — PLATFORM HARDENING GATE`

until that step is completed.

If CI has already been repaired, document the actual workflow instead.

---

# 17. SECURITY / AUTH NOTES

Keep README high level.

Document:

- authentication exists;
- RBAC exists;
- permissions are backend-enforced;
- PII handling is role-aware where confirmed.

Do not advertise unresolved JWT/session/rate-limit issues as solved.

Link detailed security architecture/docs.

---

# 18. CURRENT DEVELOPMENT STATUS

Add a concise status section.

It should point to the canonical Roadmap rather than duplicating 185+ steps.

Example:

> The authoritative implementation sequence and current NEXT item are maintained in `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`.

Do not hardcode a NEXT value unless README policy intentionally tracks it and the pass updates it consistently.

Prefer “see Roadmap” to avoid future staleness.

---

# 19. DOCUMENTATION MAP

Provide links to actual current files/folders:

- Roadmap;
- architecture;
- ADRs;
- API contract;
- event contract;
- ID policy;
- Screen Design;
- implementation/review reports if useful.

Do not link nonexistent files.

README should be the navigation hub, not duplicate the documentation content.

---

# 20. KNOWN LIMITATIONS / DEFERRED WORK

Only mention high-level material limitations.

Potential examples if still current:

- provider-specific PSP integration;
- background Outbox retry/publisher hardening;
- Finance UI coverage;
- certain commission collection/accounting flows;
- platform hardening Step 2.17.

Verify current status before listing.

Avoid a huge backlog inside README.

---

# 21. README STYLE

Use a professional GitHub README structure.

Recommended shape:

1. TravelHub
2. Overview
3. Architecture at a glance
4. Repository structure
5. Tech stack
6. Business domains
7. Getting started
8. Environment
9. Database & migrations
10. Running locally
11. Testing
12. CI/CD
13. Documentation
14. Legacy directory
15. Current development status
16. Known limitations

Keep it concise enough for onboarding.

---

# 22. NO ARCHITECTURE REWRITE

This pass must not use README cleanup to change:

- domain ownership;
- lifecycle;
- event semantics;
- RBAC;
- DB schema;
- package layout;
- CI;
- Docker;
- runtime.

If README exposes a real repository defect, record it for its owner step rather than fixing code here.

---

# 23. REQUIRED CROSS-CHECKS

Before completion prove:

1. all documented commands exist;
2. all linked files exist;
3. all listed package roots exist;
4. DB provider is correct;
5. legacy status is truthful;
6. module/domain names match code;
7. no secrets present;
8. no stale SQLite claim as current;
9. no root npm command if root is not a package;
10. no false CI claim;
11. no false “fully implemented UI” claim;
12. no false durable-retry claim.

---

# 24. CHANGES ALLOWED

Allowed:

- root `README.md`;
- documentation-only status note if needed;
- README reconciliation report;
- Roadmap only if a documentation ownership gap is discovered and current governance requires it.

Not allowed:

- production code;
- workflow YAML;
- package manifests;
- schema/migrations;
- test behavior;
- Docker/config runtime changes.

---

# 25. REQUIRED REPORT

Create:

`docs/prompts/TRAVELHUB_README_RECONCILIATION_AND_UPDATE_REPORT.md`

Include:

1. Verdict
2. Repository baseline
3. README stale claims found
4. Current package roots
5. Current application vs legacy
6. Current stack
7. Current database architecture
8. Current domains
9. Event architecture wording
10. Local dev commands verified
11. Migration commands verified
12. Test commands verified
13. CI status
14. Security wording
15. Documentation links verified
16. Known limitations
17. README changes
18. Negative checks
19. Files changed
20. Follow-up owners
21. Exact next project step remains unchanged

---

# 26. FINAL VERDICT

Use:

`TRAVELHUB README RECONCILIATION COMPLETED — README UPDATED TO CURRENT REPOSITORY TRUTH`

If the current/legacy application authority cannot be determined:

`TRAVELHUB README RECONCILIATION BLOCKED — SOURCE-OF-TRUTH DECISION REQUIRED`

If repository state is inconsistent enough that README cannot be truthfully updated:

`TRAVELHUB README RECONCILIATION BLOCKED — REPOSITORY BASELINE INCONSISTENT`

---

# 27. HARD STOP

After README + report:

STOP.

Do not fix CI/CD.
Do not delete legacy.
Do not refactor `sales.service.ts`.
Do not start the next business implementation step.

This documentation pass must leave the current Roadmap NEXT item unchanged.
