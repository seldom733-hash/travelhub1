# TRAVELHUB — PHASE 3 — GLOBAL WORKSPACE CONSTRUCTOR FOUNDATION — STRICT REVIEW

> **ЯЗЫК:** все ответы разработчика, промежуточные статусы, findings и итоговый summary — **на русском языке**.

## Цель

Провести независимый adversarial Strict Review реализации `PHASE 3 — GLOBAL WORKSPACE CONSTRUCTOR FOUNDATION`.

Текущий статус: `IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`. Implementation commit: `c71dec1`.

Ничего из implementation report не принимать на веру. Проверять repository-first. Production findings во время review автоматически не исправлять.

## 1. Baseline

Проверить branch/HEAD/upstream/worktree, Roadmap, architecture addendum (commit `26e1d9c`), implementation report, actual diff, Prisma schema/migration, Step 3.1 APPROVED contracts и Step 3.3 APPROVED contracts.

Заявлено: Page Registry 6 страниц; Widget Registry 29 widgets; System→Role→User resolver; `UserWorkspaceLayout`; DB uniqueness `(userId,pageId)`; migration `20260819121404_workspace_constructor_foundation`; 4 API endpoints; RBAC filtering; required-widget restoration; versioning/sanitization/config allowlist; frontend API/types/hooks. Всё перепроверить.

## 2. Global Architecture — HARD GATE

Доказать, что существует `ONE GLOBAL WORKSPACE CONSTRUCTOR`, а не Dashboard-specific implementation. Проверить отсутствие page-specific duplication layout resolver, widget/page policy, sanitization, versioning и RBAC filtering.

## 3. Page Registry — Exact Inventory

Implementation заявляет 6 страниц. Создать таблицу:

| # | pageId | Page | constructorEnabled | Required widgets | Layout version | Current rollout | Future capable? |
|---|---|---|---:|---|---:|---|---:|

Проверить unique/stable page IDs, default layout, allowed/required widgets, version.

CRM/Orders/Bookings с `constructorEnabled=false` должны означать `NOT ENABLED IN CURRENT ROLLOUT`, а не permanent architectural exclusion. Settings может оставаться fixed согласно design.

## 4. Widget Registry 18 → 29 — HARD GATE

Design addendum заявлял 18 Command Center widgets; implementation — 29. До APPROVED обязательно reconciled.

Создать exact inventory:

| # | widgetId | Type | Compatible pages | Permission | Required | Default | Removable | Movable | Resizable | Data source | Design authority |
|---|---|---|---|---|---:|---:|---:|---:|---:|---|---|

Ответить: какие 11 добавлены; зачем; имеют ли consumer/use case; не создают ли новую analytics/business authority; нет ли semantic duplicates; все ли IDs unique/stable. Unexplained scope expansion = finding.

## 5. Step 3.1 KPI Mapping

Step 3.1 имеет 21 backend KPI. Доказать: `21 BACKEND KPI ≠ AUTOMATICALLY 21 VISIBLE KPI CARDS`.

Составить mapping KPI/source → widget → default/optional/required. Widget Registry — presentation catalog, не KPI authority.

## 6. Required Reconciliation Widget

Проверить canonical reconciliation widget: permission, default presence, required policy, attempted removal/restoration.

Разрешить конфликт `required vs RBAC`: **RBAC всегда побеждает**. Forbidden widget нельзя восстанавливать пользователю только потому, что он required.

## 7. Layout Hierarchy — HARD GATE

Доказать `SYSTEM DEFAULT → ROLE DEFAULT → USER LAYOUT`.

Adversarial tests: system only; system+role; system+user; all three; user cannot bypass role/page/widget policy; RBAC выше всех levels.

Отдельно доказать, что Role Default реально реализован. Если architecture обещает Role Default, а implementation его не имеет — finding.

## 8. Persistence / DB

Проверить `UserWorkspaceLayout`: User relation, userId, pageId, layoutVersion, JSON payload, timestamps, indexes/cascade.

DB-level uniqueness `(userId,pageId)` обязательна. Service-level check недостаточен.

Review migration `20260819121404_workspace_constructor_foundation`: SQL, FK, unique index, destructive/unrelated changes, fresh DB applicability. Все migrations applied, drift 0.

## 9. Cross-User Isolation — CRITICAL SECURITY GATE

Проверить User A → GET/PUT/DELETE User B, body/query/path userId spoofing, forged ownership. Self-service API не должен доверять client-supplied owner identity.

## 10. Partner/Tenant Isolation

Saved layout/config не является scope authority. Arbitrary partnerId/entity ID/filter/data-source selector не должен обходить canonical downstream scope resolution.

## 11. RBAC — HARD GATE

Проверить unauthenticated, role without permission, authorized internal role, PARTNER, BUYER, saved forbidden widget, required-but-forbidden widget, stale layout после permission removal.

Frontend не security boundary; прямой API request должен оставаться защищённым.

## 12. Constructor Enable/Disable

Для disabled page проверить GET effective layout, widgets GET, PUT, DELETE/reset и frontend customize capability. Mutation запрещена по contract.

Доказать, что disabled-but-supported page можно позднее включить через общий framework без redesign resolver/API/persistence.

## 13. Widget Policy

Независимо проверить `available`, `visibleByDefault`, `removable`, `movable`, `resizable`, `required`. Не смешивать semantics.

## 14. Required Widget Restoration

Cases: removed, duplicate, invalid size, stale version, unknown replacement, RBAC forbidden. Resolver всегда возвращает valid effective layout; RBAC wins.

## 15. Versioning / Sanitization — HARD GATE

Проверить current/old/future/missing/malformed version.

Sanitization: unknown/duplicate widget, invalid position, negative/excessive size, incompatible page, forbidden widget, arbitrary config, malformed JSON. Corrupt layout не должен ломать page.

## 16. Config Allowlist — SECURITY GATE

Нельзя сохранять arbitrary endpoint URL, SQL, permission, userId, tenantId, partner authority, financial formula, executable config/script. `dataSource` registry/server-controlled.

## 17. API Surface

Зафиксировать реальные 4 endpoints:

| Method | Route | Auth | Permission/policy | Validation | Output |
|---|---|---|---|---|---|

Проверить registration, route conflicts, serialization и отсутствие Prisma/internal leakage.

PUT: auth/self ownership/page enabled/widget compatibility/permission/upsert/idempotency/concurrency/required policy.

DELETE/reset: `User → Role Default if exists → System Default`, idempotent/no-op safe.

## 18. Concurrency

Параллельные saves не должны давать duplicate row, leaking unique violation 500 или partial layout. Если semantics last-write-wins — документировать и тестировать.

## 19. Business Authority Boundary

Workspace пишет только configuration state. Подтвердить: sales=0, bookings=0, orders=0, payments=0, ledger=0, commission=0, analytics business writes=0, business EventBus emits=0.

## 20. Step 3.1 Compatibility — HARD GATE

Не изменены Step 3.1 endpoints, KPI formulas, multi-currency, partner isolation, trends, aggregation. Сохраняется page-level aggregation.

## 21. Step 3.3 Authority — HARD GATE

Никаких новых period/comparison/timezone resolvers, analytics formulas, reconciliation/funnel/money/currency aggregation. Constructor = presentation/configuration only.

## 22. No Per-Widget API Fan-Out

Architecture выбрала page-level aggregation. Проверить, что 29 widgets не означают 29 API calls и registry не создаёт такую модель.

## 23. Frontend Foundation

Проверить `workspace-api.ts`, types/client, `useWorkspaceLayout`, `useWorkspaceCustomize`, loading/error/save/reset/constructorEnabled.

Проверить stale state, save/reset race, duplicate requests, invalid response, error rollback/cache refresh.

## 24. Grid / Responsive

Contract: desktop 12 / tablet 8 / mobile 4. Drag/drop only desktop. Saved desktop layout не должен ломать mobile; должен существовать safe stacking/fallback contract.

## 25. Test Adequacy

35/35 workspace unit tests сами по себе не достаточны. Создать coverage matrix:

| Contract | Unit | E2E | Missing? |
|---|---:|---:|---:|

Обязательно: registry uniqueness, hierarchy, Role Default, required restoration, RBAC, disabled page, versioning, sanitization, allowlist, cross-user, DB uniqueness, reset, concurrency.

Получить точный workspace e2e count и security scenarios.

## 26. Full Serial E2E — HARD GATE

Implementation summary не сообщил full serial e2e. Выполнить canonical full serial e2e. Без этого APPROVED запрещён. Сообщить suites/tests/failures.

## 27. Full Regression

Backend: tsc, production build, full unit, full serial e2e.

Frontend: tsc, full Vitest, production build.

DB: migration count, all applied, drift 0.

Использовать реальные текущие counts, не копировать implementation summary.

## 28. Artifact Integrity — HARD GATE

Выполнить artifact checker, checker regression, `git diff --check`. Без evidence APPROVED запрещён.

## 29. Exact File Inventory

Получить точный `git diff --name-status` implementation scope. Не считать directory grouping за exact file count.

## 30. Scope / Negative Boundaries

Подтвердить:
- Step 3.2 UI implementation: 0
- Command Center visual redesign: 0
- new KPI formulas: 0
- Step 3.1 behavior changes: 0
- Step 3.3 behavior changes: 0
- new analytics/financial authority: 0
- domain business writes/events: 0
- Employee Analytics: 0
- Omnichannel/social integrations: 0
- Step 2.17B changes: 0
- frozen target changes: 0
- release: 0

Workspace persistence schema/migration — допустимое изменение этого шага.

## 31. Severity

CRITICAL — cross-user/cross-tenant exposure, material security bypass, financial/business authority corruption.

HIGH — broken RBAC, hierarchy/persistence failure, unsafe config execution, Step 3.1/3.3 authority duplication, mandatory contract failure.

MEDIUM — design/scope mismatch, robustness/test/versioning deficiency без material current security corruption.

LOW — maintainability/docs/minor consistency.

## 32. Strict Review Report

Создать `docs/prompts/PHASE_3_GLOBAL_WORKSPACE_CONSTRUCTOR_FOUNDATION_STRICT_REVIEW_REPORT.md`.

Обязательные разделы: Executive Summary; Repository Baseline; Architecture Conformance; Exact Files Changed; Page Registry Inventory; Widget Registry Inventory; 18→29 Reconciliation; Step 3.1 KPI→Widget Mapping; Layout Hierarchy; Role Defaults; Persistence; Migration; DB Uniqueness; Resolver; Enable/Disable; Disabled Future-Capable Pages; Required Widgets; RBAC; Cross-User Isolation; Partner/Tenant Isolation; Versioning; Sanitization; Config Allowlist; API Surface; Concurrency; Frontend Foundation; Grid/Responsive; Data Fetch; Step 3.1 Compatibility; Step 3.3 Boundary; Business Write Boundary; Unit/E2E Coverage; Full Backend Regression; Full Serial E2E; Full Frontend Regression; DB/Drift; Artifact Integrity; Findings; Negative Checks; Authority Gaps; Persistence/Git; Verdict; NEXT; Repository Evidence.

## 33. VERDICT A

Только если: architecture PASS; 6 pages reconciled; 29 widgets reconciled; 18→29 explained; IDs unique/stable; System→Role→User PASS; Role Default real; persistence/DB uniqueness/migration PASS; cross-user and partner/tenant isolation PASS; RBAC and required-vs-RBAC PASS; enable/disable PASS; disabled pages future-capable; versioning/sanitization/allowlist PASS; API/concurrency PASS; Step 3.1 compatibility PASS; Step 3.3 unchanged; no per-widget fan-out; frontend foundation PASS; focused tests sufficient; backend tsc/build/full unit/**full serial e2e** PASS; frontend tsc/Vitest/build PASS; DB drift 0; artifact checker/checker regression/git diff --check PASS; unresolved CRITICAL=0; unresolved HIGH=0.

Тогда:

`PHASE 3 GLOBAL WORKSPACE CONSTRUCTOR FOUNDATION STRICT REVIEW COMPLETED — APPROVED`

## 34. VERDICT B

При implementation findings:

`PHASE 3 GLOBAL WORKSPACE CONSTRUCTOR FOUNDATION STRICT REVIEW — VERDICT B — REMEDIATION REQUIRED`

Для каждого: severity, file/line, violated contract, evidence, impact, remediation, required tests.

Status: `IMPLEMENTATION COMPLETED — NOT APPROVED`.

NEXT: `PHASE 3 — GLOBAL WORKSPACE CONSTRUCTOR FOUNDATION — REMEDIATION`.

## 35. VERDICT C

Если обязательная policy не определена repository/design:

`PHASE 3 GLOBAL WORKSPACE CONSTRUCTOR FOUNDATION STRICT REVIEW — VERDICT C — AUTHORITY/DESIGN DECISION REQUIRED`

Не придумывать policy.

## 36. Review Discipline

Strict Review = review-first. Production code автоматически не исправлять. Допустимы review artifacts/docs/provenance updates по repository convention. При defects — report + VERDICT B.

## 37. Persistence

Сохранить report; минимально обновить Roadmap/status; provenance/footer sync; `git diff --check`; commit/push; verify HEAD==upstream; tracked worktree clean; unrelated untracked untouched; сообщить реальные SHA.

## 38. NEXT при APPROVED

Только при VERDICT A:

`NEXT: REPOSITORY-FIRST PHASE 3 SEQUENCING AFTER GLOBAL WORKSPACE CONSTRUCTOR FOUNDATION APPROVAL`

Ожидаемый кандидат — `PHASE 3 — STEP 3.2 — DASHBOARD / COMMAND CENTER UI`, но **не начинать Step 3.2 автоматически** до repository-first подтверждения.

## 39. Формат ответа

Весь ответ на русском. Обязательно: Verdict; status; exact Page/Widget counts; объяснение 18→29; KPI/widget mapping; System/Role/User; Role Default; persistence/migration/uniqueness; RBAC; cross-user; partner/tenant; required widget; enable/disable; future-capable pages; versioning/sanitization/allowlist; APIs/concurrency; frontend; fan-out; Step 3.1/3.3; focused tests; full backend; serial e2e; frontend build; DB/drift; artifact integrity; findings; exact files; commits/push; NEXT.

---

## Ключевой принцип

Strict Review должен доказать одновременно:

`THE CONSTRUCTOR IS TRULY GLOBAL`

`LAYOUT PERSONALIZATION CANNOT BYPASS RBAC OR DATA ISOLATION`

`SYSTEM DEFAULT → ROLE DEFAULT → USER LAYOUT`

`RBAC ALWAYS WINS`

`CONSTRUCTOR CONFIGURES PRESENTATION, NOT BUSINESS AUTHORITY`

и что foundation достаточно безопасен, чтобы **Step 3.2 стал первым визуальным consumer**.
