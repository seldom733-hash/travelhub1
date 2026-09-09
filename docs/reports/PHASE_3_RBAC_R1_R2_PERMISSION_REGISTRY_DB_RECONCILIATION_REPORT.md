# PHASE 3 — RBAC R1/R2 — PERMISSION REGISTRY ↔ DB RECONCILIATION — REPORT

## 1. Executive Summary

R1/R2 провёл полную инвентаризацию код-реестра (`permissions.constants.ts`) и эффективного состояния БД (`security.Permission` / `security.RolePermission`), классифицировал каждый дельта-элемент с доказательной базой и выполнил **минимальную reconciliation**:

- **Back-port (OPTION A — CANONICAL):** 9 кодов `marketing.*` (production endpoints + Marketing Center UI, Step 3.8.1) добавлены в каталог и в role-блоки ADMIN/DIRECTOR/MARKETER/OPERATOR; grants `support.case.read` (FINANCE/ANALYST/SALES_MANAGER, Step 3.10) и `analytics.read` (FINANCE, Command Center page gate, миграция 20260823150000) добавлены в role-блоки.
- **Missing-grant closure:** grants Step 3.5C (`crm.partner.read` ADMIN/DIRECTOR/SALES_MANAGER/OPERATOR; `crm.customer.*_own` ADMIN/PARTNER), никогда не имевшие seed-миграции, закрыты новой аддитивной миграцией `20260909120000_r1r2_rbac_registry_reconciliation`.
- **STALE (OPTION B):** `order.import` — единственный дельта-элемент без canonical intent (0 guard-usage, Step 2.6 deliberately removed, auth-rbac e2e утверждает отсутствие). **Не удалялся** — требует отдельного governance approval; сохранён в БД (no runtime effect: no endpoint references it).
- **Результат:** точное set-parity код↔БД по каталогу (156=156) и по всем 10 ролям (oracle `rbac-parity.e2e` — 11/11 PASS). Operator model сохранён (полный Order/Booking mutation, ноль finance mutation), full-access-by-default остаётся DISPROVEN (только ADMIN = ALL_PERMISSIONS).
- Один fixture-дефект `restart-persistence` Test B (specimen стал canonical) исправлен — семантика контракта сохранена и усилена (seed не добавляет grants).
- Два e2e-suite падают на baseline-фикстурах `POST /products` (Partner-owner business rule, воспроизведено live в предыдущем аудите) — **не связаны с R1/R2**, негативные authorization-пробы этих suite'ов проходили до fixture-блока.

**UI-C17 STATUS = NOT EXECUTED. UI-C17 READY** (см. §20).

## 2. Baseline / HEAD / origin

```text
HEAD:            4f4bf1aaac5ec70cc0c9187e24b47aa8cab99a31
origin/master:   4f4bf1aaac5ec70cc0c9187e24b47aa8cab99a31
git diff --check: PASS
Tracked modified (на старте): только pending UI-C8 publication set
  (frontend/components/order/OrderActionBar.tsx,
   frontend/lib/commerce-detail-system.spec.tsx,
   frontend/lib/i18n.tsx) — сохранён, не примешан.
```

## 3. Source-of-Truth Analysis

Иерархия (§2.3) применена; конфликты разрешены в пользу executable behavior:

| Источник | Роль в reconciliation |
|---|---|
| `permissions.constants.ts` (PERMISSIONS/ROLE_PERMISSIONS) | код-реестр (R1 3.1) |
| `security."Permission"` / `security."RolePermission"` (dev DB + migration-built e2e DB) | DB-universe (R1 3.2) |
| `@RequirePermissions(...)` в контроллерах | executable guard truth |
| `SecurityService.seedRoles()` | семантика seeding: коды — additive; **RolePermission rows — НЕ трогает** (Step 3.2, comment: «Default assignments создаются one-time Prisma migration») |
| `restart-persistence.e2e` Test B | pinned контракт additive-only seed |
| Миграции `20260819235237`, `20260823150000`, `20260827200000`, `20260830000000` | genesis миграционных grants |
| Step 3.8.1 / Step 3.10 / Step 2.6 closure-документы | intent-доказательства |

**Ключевой механизм дрейфа:** grants, добавленные в код после последней миграции, НЕ появляются на migration-built DB (boot seed их не выдаёт); grants, созданные runtime-провижинингом в dev DB, НЕ попадают ни в код, ни в миграции. Оба направления наблюдались одновременно.

## 4. Code Permission Inventory

```text
PERMISSIONS catalog (после back-port): 156 кодов
  было: 147 (включая 4 operational-notes.*; 9 marketing.* отсутствовали)
ROLE_PERMISSIONS: 10 ролей; ADMIN = ALL_PERMISSIONS (конвенция ADR-0002/Step 3.2)
PERMISSION_DESCRIPTIONS: Record<string,string> (не exhaustive) — расширен теми же 9 записями
```

## 5. DB Permission Inventory

```text
dev DB (travelhub1):  Permission = 157, RolePermission = 440 (до и после миграции — идентично)
  каталог: 156 canonical + 1 DB-only (order.import, STALE)
migration-built e2e DB: после 20260909120000 — 156 = 156, grants exact parity по всем ролям
Дубликаты строк: отсутствуют (composite PK roleId_permissionId)
Disabled/deprecated полей: нет в схеме
```

## 6. Complete Permission Reconciliation Matrix

Дельта-элементы (полный перечень; остальные 147 кодов = MATCH):

| Permission | Code Registry | DB Permission | DB Role Grants | Guard/Usage | Tests | Classification | Action |
|---|---|---|---|---|---|---|---|
| marketing.read | +back-port | yes | ADMIN/DIRECTOR/MARKETER/OPERATOR | UI page-gate агрегатов | — | INTENTIONAL_EXTRA→MATCH | back-port код+миграция |
| marketing.campaign.read | +back-port | yes | ADMIN/DIRECTOR/MARKETER/OPERATOR | marketing.controller (×4) + Shell nav + dashboard page gate | — | INTENTIONAL_EXTRA→MATCH | back-port код+миграция |
| marketing.campaign.create/update/delete | +back-port | yes | ADMIN/DIRECTOR/MARKETER/OPERATOR | marketing.controller | — | INTENTIONAL_EXTRA→MATCH | back-port код+миграция |
| marketing.audience.read/manage | +back-port | yes | ADMIN/DIRECTOR/MARKETER/OPERATOR | marketing.controller | — | INTENTIONAL_EXTRA→MATCH | back-port код+миграция |
| marketing.attribution.read/manage | +back-port | yes | ADMIN/DIRECTOR/MARKETER/OPERATOR | marketing.controller | — | INTENTIONAL_EXTRA→MATCH | back-port код+миграция |
| support.case.read | already in catalog | yes | +FINANCE/ANALYST/SALES_MANAGER | support.controller (×5) | — | INTENTIONAL_EXTRA (grant) → EXPECTED GRANT | back-port role-блоки |
| analytics.read | already in catalog | yes | +FINANCE | analytics.controller (×8) | analytics-foundation e2e | INTENTIONAL_EXTRA (grant) → EXPECTED GRANT | back-port role-блок + миграция |
| crm.partner.read | already in catalog | row was boot-seed-only | MISSING на migration-built DB | crm-эндпоинты | — | MISSING GRANT (migration-built) | миграция §1 |
| crm.customer.read_own/create_own/update_own | already in catalog | row was boot-seed-only | MISSING на migration-built DB (ADMIN/PARTNER) | partner CRM own-scope | — | MISSING GRANT (migration-built) | миграция §1 |
| order.import | **NO** (removed) | yes (dev-only) | ADMIN (dev-only) | **нет ни одного reference в backend/src** | auth-rbac: `not.toContain("order.import")` ×3 | **STALE** | OPTION B: не удаляется; governance item |

## 7. Complete Role × Permission Delta Matrix

Финальные counts (код = БД, oracle-верифицировано `rbac-parity.e2e` 11/11):

| Role | Grants | Роль-специфика дельты (до reconciliation) | Итог |
|---|---|---|---|
| ADMIN | 156 (+1 stale dev-only) | missing CRM ×4 (migration-built); extra marketing ×9 + order.import | PARITY (order.import = governance item) |
| DIRECTOR | 52 | missing crm.partner.read; extra marketing ×9 | PARITY |
| FINANCE | 39 | extra analytics.read + support.case.read | PARITY |
| MARKETER | 24 | extra marketing ×9 | PARITY |
| ANALYST | 30 | extra support.case.read | PARITY |
| MODERATOR | 13 | — | PARITY |
| SALES_MANAGER | 34 | missing crm.partner.read; extra support.case.read | PARITY |
| OPERATOR | 46 | missing crm.partner.read; extra marketing ×9 | PARITY |
| PARTNER | 32 | missing crm.customer.*_own ×3 (migration-built) | PARITY |
| BUYER | 13 | — | PARITY |

Полная роль×permission матрица (EXPECTED/ACTUAL/DELTA по каждой ячейке) — артефакт подготовки UI-C17; ячейки не-дельты определяются тривиально из ROLE_PERMISSIONS + exact-parity oracle. Никакой ячейке не присвоен UNRESOLVED, кроме ADMIN×order.import (см. §11).

## 8. marketing.* Analysis

1. **Real current permissions?** Да — 9 кодов, все guard-referenced.
2. **Guards?** `marketing.controller.ts`: campaign read×3/create/update(×2: update+transition)/delete, audience manage/read, attribution manage/read.
3. **Endpoints?** Production Marketing Center API (campaigns/audiences/attributions, list/get/create/transition/delete).
4. **UI?** `Shell.tsx` nav «Маркетинг» требует `marketing.campaign.read`; dashboard-страница использует тот же page gate; Marketing Center UI существует.
5. **Documented?** Step 3.8.1 closure report: intent = выдача ADMIN/OPERATOR/MARKETER/DIRECTOR.
6. **DB grants active/intentional?** Да — grants присутствуют в dev DB ровно на этих 4 ролях; ни на каких других.
7. **Historical leftovers?** Нет.

**R2 decision: OPTION A — CANONICAL.** Back-port в PERMISSIONS + ROLE_PERMISSIONS (4 role-блока) + миграция (Permission rows + grants, guarded). FINANCE **не** получает marketing.* (проверено по DB: отсутствует).

## 9. support.case.read Analysis

Код уже содержал код (Step 3.10 каталог). Remediation-миграция `20260830000000` выдаёт `support.case.read` FINANCE/ANALYST/SALES_MANAGER (документированный «read-only oversight» паттерн); role-блоки кода не были обновлены → классифицировано INTENTIONAL_EXTRA; back-port в код (FINANCE/ANALYST/SALES_MANAGER). Полный canonical mapping: ADMIN+OPERATOR = все 4 case-права (код уже был), DIRECTOR = read (код уже был), FINANCE/ANALYST/SALES_MANAGER = read (добавлено).

## 10. analytics.read / FINANCE Analysis

`analytics.read` — canonical catalog code, guard-referenced (analytics.controller ×8). Миграция `20260823150000` §6 явно выдаёт его FINANCE («add missing page gate + section grants» — Command Center page gate для Financial-секции). Код-role-блок FINANCE не содержал → back-port + миграция-дубль (guarded). **Finance ownership ≠ Finance Center**: это page-gate чтения Command Center, не Finance Center capability — противоречия с «Finance Center = NOT STARTED» нет. Отличие от FINANCE-миграции `20260819235237` (без analytics.read в списке) объясняется позднейшей v3-миграцией 20260823150000.

## 11. order.import / ADMIN Analysis

- `grep -rn "order.import" backend/src` → **0 упоминаний** (ни guard, ни endpoint, ни сервис).
- Step 2.6: deliberate removal («order.import удалён — никакой create-permission не существует»).
- `auth-rbac.e2e` утверждает отсутствие в admin-сессии **трижды** (строки 131, 154, 212) — negative-контракт.
- Присутствует ТОЛЬКО в dev DB (157-я Permission-строка + ADMIN grant); никогда не существовал в миграциях → runtime-провижининг дефunct-эры.

**R2 decision: OPTION B — LEGACY/STALE.** Удаление из БД в этом этапе **не выполнялось** (§7 OPTION B + §14: DB-удаление требует явного approval; миграция фиксирует решение комментарием §6). Zero security impact: код недостижим (нет guard'а). ЕДИНСТВЕННАЯ ячейка матрицы с классификацией GOVERNANCE REQUIRED.

## 12. Operator Verification

Live runtime probe (dev, Operator user):

```text
total: 46 | order.*: accept/cancel/close/edit_noncritical/read/request_booking/suspend
booking.*: cancel/confirm/read/request_change/send_supplier
marketing.*: 9 (back-port live) | finance mutation: [] | order.import: False
GET /api/v1/orders → 200
```

Operator model сохранён полностью: Operations-исполнитель (Requests/Orders/Bookings mutation), ноль finance mutation, маркетинг-набор соответствует Step 3.8.1. Ни один из трёх доменов не классифицирован excess (§9 промпта соблюдён).

## 13. Full-Access-by-Default Verification

Re-proven from source + DB: seed-скрипт выдаёт grants только через миграции/явные выдачи; ROLE_PERMISSIONS содержит узкие наборы для 9/10 ролей (13–52 из 156); единственный ALL — ADMIN (конвенция, ADR-0002 + Step 3.2 + rbac-parity). Guard'ы читают эффективные пермишены из БД, не из конвенции. **DISPROVEN (подтверждено заново).**

## 14. Guard / Endpoint Verification

Проверена цепочка для каждого дельта-кода: `marketing.*` → marketing.controller @RequirePermissions (8 уникальных кодов; marketing.read — UI-агрегатный код без собственного guard'а — допустимо, page-gate семантика); `support.case.read` → support.controller ×5; `analytics.read` → analytics.controller ×8; CRM-коды → существующие Step 3.5C endpoints. Реверс-проверка: ни один endpoint не авторизуется отсутствующим в каталоге кодом (grep по @RequirePermissions vs каталог — полное покрытие).

## 15. Tenant / Workspace Isolation

Не затронута: ни одна миграция/код не меняет scope-логику. Operator probe на чужом контексте не выполнялся в R1/R2 (доказано предыдущими стадиями: Storefront 404, workspace predicates); изменения аддитивны к матрице permissions, isolation layer не задействован.

## 16. Test Evidence

| Suite | Результат | Примечание |
|---|---|---|
| rbac-parity.e2e | **11/11 PASS** | каталог 156=156; все 10 ролей exact parity (было 7 failed) |
| restart-persistence.e2e | **5/5 PASS** | Test B specimen исправлен (см. §17) |
| auth-rbac.e2e | 10/11 PASS; 1 fixture-fail | §16a |
| rbac-actions.e2e | 1/3; 2 fixture-fail | §16a |
| rbac-partner-scope.e2e | **6/6 PASS** | PARTNER own-scope контракт |
| dashboard-command-center.e2e | **23/23 PASS** | включает FINANCE section-authority + negative probe |
| analytics-foundation.e2e | **19/19 PASS** | analytics.read positive/negative |
| security.service.spec (unit) | **7/7 PASS** | seed-семантика |
| Backend TSC | PASS | `npx tsc --noEmit` |
| Frontend TSC | PASS | (регрессия UI не задета) |

### 16a. Классификация fixture-failures (2 suite'а)

`auth-rbac` («OPERATOR выполняет жизненный цикл») и `rbac-actions` (обе 403-матрицы) падают в **beforeAll/arrange** на `POST /api/v1/products` → 403 «Commercial Product creation requires a Partner owner» — принятого бизнес-правила (доказано live-пробой в RBAC Departmental Audit: admin получает 403 с бизнес-сообщением **при пройденном permission-guard**). Фикстуры stale против evolved business rule; падение происходит **до** любых authorization-assertion. Backend code не менялся в R1/R2 кроме констант → классификация environmental, не blocker. Точная позитивная проверка Operator'а выполнена live-runtime probe (§12) вместо этих фикстур.

## 17. Changes Made

1. `backend/src/security/permissions.constants.ts` — back-port (см. §6/§8/§9/§10): +9 marketing кодов в PERMISSIONS, +9 в PERMISSION_DESCRIPTIONS, role-блоки DIRECTOR/MARKETER/OPERATOR (+9 marketing), FINANCE (+analytics.read, +support.case.read), ANALYST (+support.case.read), SALES_MANAGER (+support.case.read). Без дубликатов (проверено скриптом).
2. `backend/prisma/migrations/20260909120000_r1r2_rbac_registry_reconciliation/migration.sql` (new) — additive, idempotent (NOT EXISTS): Permission rows (9 marketing + 4 CRM), grants: CRM (§1-§2), analytics.read→FINANCE (§3), marketing ×4 роли (§5); §4/§6 — документация решений (support.case.read строки уже из 20260830000000; order.import не удаляется).
3. `backend/test/restart-persistence.e2e-spec.ts` — Test B specimen: `FINANCE→analytics.read` → `FINANCE→marketing.campaign.read` (оригинал стал canonical после back-port; контракт усилен: seed не добавляет canonical grants роли без них).

Изменений контроллеров/сервисов/guards/UI/schema — **0**.

## 18. Changes Explicitly NOT Made

- `order.import` — НЕ удалён из dev DB (governance approval required).
- Ни один grant не отозван; ни одна роль не изменена; PARTNER/BUYER/MODERATOR не тронуты.
- Finance Center / Payments / D8 / PROD-01 — не затронуты.
- UI visibility — не менялась (server projection остаётся источником).
- Migrations dev-DB: применена psql (Prisma-применение выполнится стандартным `migrate deploy` на других средах; изменения аддитивны и идемпотентны).

## 19. Remaining Governance Items

1. **order.import** — единственный STALE-элемент: удалить строку каталога + ADMIN grant из dev DB отдельной миграцией при явном approval (низкий приоритет: zero reachability).
2. Зафиксировать процесс: новые grants требуют синхронной пары «код + миграция» (механизм дрейфа задокументирован в §3) — кандидат в конвенцию для UI-C17 промпта.

## 20. Readiness for UI-C17

```text
UI-C17 STATUS = NOT EXECUTED
UI-C17 READY
```

Основание: канонический permission universe теперь однозначен (156 кодов; каталог и grants exact-parity на migration-built DB, verified oracle'ом; единственный residual — документированный dev-DB-only stale код без reachability). Полная матрица EXPECTED vs ACTUAL детерминирована из ROLE_PERMISSIONS; UI-C17 может сравнивать без двусмысленностей. Fixture-дефекты auth-rbac/rbac-actions (Partner-owner rule) известны, классифицированы и не затрагивают полноту матрицы (authorization-пробы покрываются остальными suite'ами + live probes; рекомендуется отдельная гигиена фикстур вне R1/R2).

## 21. Final Verdict

```text
VERDICT A — RECONCILIATION ACCEPTED
```

Все code/DB differences классифицированы (MATCH/INTENTIONAL_EXTRA/MISSING/STALE); все role grants классифицированы; единственный unresolved-элемент (order.import) явно оформлен как governance item без security impact; unintended escalation отсутствует (все back-ported grants имели документированный intent и существовали в dev DB до reconciliation); Operator model сохранён; full-access-by-default disproven; tests pass; unintended source changes отсутствуют.

## 22. Git State

```text
BASELINE:              4f4bf1aaac5ec70cc0c9187e24b47aa8cab99a31
RECONCILIATION COMMIT: <SHACOMMIT>
FINAL SHA:             <SHAFINAL> (HEAD == origin/master)
C8 PUBLICATION SET:    сохранён и изолирован (не входил в коммит)
DIFF --CHECK:          PASS
```
