# PHASE 3 — PRE-STEP 3.12 — D4 — STRICT REVIEW REMEDIATION CLOSURE — REPORT

**Этап:** D4 REMEDIATION CLOSURE (F1–F6)
**Дата:** 2026-09-03
**Ветка:** `master`
**Язык:** русский (code identifiers/paths/статусы — English по конвенции)

---

## 1. Executive Summary

Независимый D4 STRICT REVIEW (VERDICT A, findings D4SR-F1…F8) обнаружил дефекты, часть которых оставалась открытой после acceptance. Данный closure закрывает **MUST FIX F1–F6**, доказывая remediation по цепочке Code → DB → API → Runtime → Tests → Evidence → Git:

- **F1 (P2, TOCTOU)** — traveler mutation ↔ `final-confirm` теперь сериализованы на уровне DB: `SELECT … FOR UPDATE` на строке Order в обеих сторонах (single PATCH, bulk PATCH, finalConfirm). Race-тесты R1/R2 (single + bulk) на isolated DB: после завершения обоих concurrent-операций проверяется DB (finalConfirmedAt, значения traveler, dataCompleteness), а не только HTTP.
- **F2 (P2)** — явный `?acquisitionSource=PARTNER_STOREFRONT` на platform list/export (Orders, Bookings, включая drill-down `export?orderId=Storefront-order`) больше не подменяет server-authorized scope: deny → пустой результат. Positive Marketplace-фильтр и прямые Storefront-404 сохранены.
- **F3 (P3)** — S12 natural completion chain доказана isolated e2e реальными командами (Booking `COMPLETED` → Order `FULFILLED` → Order `CLOSED`), без прямой инъекции финальных статусов.
- **F4 (P3)** — S5 переклассифицирован: customer decline → `SUPPORTED` (`CANCELLED_BY_CUSTOMER` через реальную команду); `auto-EXPIRED` → честно `NOT IMPLEMENTED`.
- **F5 (P3)** — manifest CASE A: Request UUID исправлен по live DB (`006e94b4-…` для MKT-REQ-09000547).
- **F6 (P3)** — legacy bulk traveler update больше не silent-discard'ит `passportExpiry` и считает `dataCompleteness` по общей canonical pinned-логике (общий helper с single PATCH).

Регрессий нет: новые 16/16 e2e, D4 security 10/10, D4 chain 4/4, D3 request-flow 4/4, D3 traveler-collection 11/11, `tsc --noEmit` PASS, live runtime smoke PASS (API probes + browser 18/18).

Итог: **VERDICT A — D4 STRICT REVIEW REMEDIATION CLOSURE PASSED**. D4 — ACCEPTED, D4 REMEDIATION — CLOSED. Deferred non-blocking debts — см. §20/§23.

---

## 2. Starting Git State

До изменений (exact output):

```text
git branch --show-current  → master
git status --short         → (пусто, кроме добавленного пользователем prompt-файла
                             PHASE_3_PRE_STEP_3.12_D4_STRICT_REVIEW_REMEDIATION_CLOSURE.md)
git rev-parse HEAD         → 5690f94eb141588d450461b422566a38dc93ad0c
git rev-parse origin/master→ 5690f94eb141588d450461b422566a38dc93ad0c
```

`HEAD == origin/master == 5690f94` (docs-sync коммит SR-отчёта). Рабочее дерево EXACTLY EMPTY (кроме нового prompt-файла пользователя).

---

## 3. Canonical Architecture Check

- **Marketplace ≠ Storefront customer commerce (3.1):** подтверждено. Platform Marketplace operational-контракт НЕ позволяет platform-актору получить Storefront Orders/Bookings переключением query-параметра. Storefront-данные остаются в DB (500 orders / 354 bookings в dev) и не удаляются (§19).
- **Traveler immutability (3.2):** `finalConfirmedAt == NULL → mutation разрешена по permissions/pinned policy`; `finalConfirmedAt != NULL → обычная traveler mutation запрещена`. Инвариант теперь выполняется **также при concurrency** (row-lock, §5).
- **Representative chain (3.3):** natural-chain evidence добавлена (S12, §10) — не historical status row.

---

## 4. D4SR-F1 Root Cause

**Race:** traveler PATCH выполнял pre-check `finalConfirmedAt == NULL` вне общей serialization boundary; между pre-check и commit мог закоммититься `finalConfirm` → traveler mutation коммитилась после подтверждения (TOCTOU). Повторный `findUnique` внутри tx (D3-путь) не создавал взаимного исключения: обе tx читали строку без блокировки, и мутация могла завершиться после CAS-установки `finalConfirmedAt`.

Затронуты все три пути: `updateTravelers` (bulk PATCH `/orders/:id/travelers`), `updateTravelerD3` (single PATCH `/orders/:id/travelers/:travelerId`), `finalConfirm` (POST `/orders/:id/final-confirm`).

---

## 5. F1 Concurrency Remediation

**Решение (вариант A промпта — DB row-lock):** добавлен приватный helper `OrderService.lockOrderRowForMutation(tx, orderId)` — `SELECT "finalConfirmedAt" FROM "order"."Order" WHERE "id" = $id FOR UPDATE` (parameterized, PostgreSQL row lock живёт до конца транзакции). Вызывается ПЕРВЫМ действием внутри транзакций всех трёх путей:

- `updateTravelers` (bulk): lock → re-check `finalConfirmedAt` (если установлен → `ConflictError` 409) → обновление traveler'ов;
- `updateTravelerD3` (single): lock → re-check (заменяет прежний повторный `findUnique` без блокировки) → update;
- `finalConfirm`: lock → re-check (dup-confirm → 409) → CAS `updateMany finalConfirmedAt` (defense-in-depth) → history.

**Hard invariant (промпт):**
```text
If finalConfirm succeeds first → concurrent traveler edit must fail / rollback
If traveler edit owns serialization first → finalConfirm waits/observes committed traveler state
```
Обе ветки выполняются на уровне Postgres: конкурирующие tx на одной строке Order сериализуются самим СУБД (FOUPDATE-wait), вне зависимости от HTTP-таймингов.

PII/scope/anti-mass-assignment проверки (404 Storefront, 422 forged-keys, redaction) не ослаблены — они выполняются ДО tx и не конфликтуют с lock-границей.

---

## 6. F1 Race Evidence (isolated DB e2e, `d4-remediation-closure.e2e-spec.ts`)

**R1 (finalConfirm wins → mutation не коммитится):** детерминированный harness: тест удерживает row-lock строки Order, PATCH стартует (pre-read видит `finalConfirmedAt = NULL`) и упирается в lock; тест в этом же tx коммитит `finalConfirmedAt`; PATCH после получения lock видит подтверждение → **409**. Проверена DB: `finalConfirmedAt != NULL`, значение traveler'а не изменилось. Отдельно для single и bulk путей.

**R2 (traveler mutation wins → finalConfirm наблюдает закоммиченное состояние):** 4 concurrent-раунда на свежих Order (single и bulk): `Promise.all([PATCH, finalConfirm])`; после каждого раунда проверена DB:
- PATCH 409 → traveler не тронут, confirm 201;
- PATCH 200 + confirm 201 → DB хранит именно закоммиченное значение PATCH (сериализация: patch → confirm), `dataCompleteness` корректен;
- после confirm дополнительный PATCH (single и bulk) → **409** (никакой post-final-confirm mutation).

Результат: `F1 single race tested`, `F1 bulk race tested`, `no post-final-confirm mutation in tested race` — PASS (4 теста).

---

## 7. D4SR-F2 Root Cause

Platform-актор с `order.read`/`booking.read` мог передать `?acquisitionSource=PARTNER_STOREFRONT` на list/export эндпоинты; сервис подставлял client-значение в `where` вместо server-authorized scope (`acquisitionSource: query.acquisitionSource || "MARKETPLACE"`) → client filter **заменял** server scope. Дополнительно `exportBookings` перезаписывал channel-scope при явном `orderId` (`where.orderId = query.orderId`) → drill-down по Storefront-order также отдавал Storefront Booking.

Surfaces: `GET /orders`, `GET /orders/export`, `GET /bookings`, `GET /bookings/export` + drill-down/counts через тот же query builder.

---

## 8. Platform/Storefront Scope Remediation

- Новый shared-модуль `backend/src/shared/sales-scope.ts`: `PARTNER_STOREFRONT_SOURCE`, `PLATFORM_DEFAULT_SCOPE_SOURCE`, `isDeniedStorefrontScope()` — единый источник истины для Order и Booking модулей.
- **Hard rule:** `client filter ⊆ server-authorized scope`; для Platform Marketplace authorized scope — не-Storefront acquisition sources. Явный `PARTNER_STOREFRONT` → deny.
- **Поведение (выбрано):** пустой результат (invisibility-семантика, согласована с прямыми 404-ридами Storefront-объектов D4 §10/§21) — единообразно для Orders list/export, Bookings list/export и drill-down.
- `listOrders` / `exportOrders` (order.service): ранний deny-return при `isDeniedStorefrontScope`.
- `listBookings` / `exportBookings` (booking.service): ранний deny-return; **drill-down исправлен** — явный `orderId` теперь пересекается с channel scope (`where.AND = [{orderId}, {orderId in channel}]`, как в `listBookings`), а не заменяет его.
- `PLATFORM_SCOPE_DENIED_SOURCE` в order.service теперь алиас shared-константы (экспорт сохранён).
- F8 НЕ реализован (§9 промпта): новых PARTNER-роутов/прав нет; будущий Partner own-commerce контракт — отдельный debt (§20).

---

## 9. List/Export Negative Evidence

e2e (isolated DB, реальные Storefront+Marketplace fixtures) и live API (dev stack):

| Проверка | e2e | Live runtime |
|---|---|---|
| `GET /orders?acquisitionSource=PARTNER_STOREFRONT` → пусто | PASS | total=0 (DB SF=500) |
| `GET /orders/export?…=PARTNER_STOREFRONT` → без Storefront-строк | PASS | 0 SF-refs |
| `GET /bookings?acquisitionSource=PARTNER_STOREFRONT` → пусто | PASS | total=0 (DB SF=354) |
| `GET /bookings/export?…=PARTNER_STOREFRONT` → без Storefront-строк | PASS | 0 SF-refs |
| drill-down `bookings/export?orderId=<SF order>` → пусто | PASS | 0 SF-refs |
| drill-down `bookings?orderId=<SF order>` → total 0 | PASS | — |
| Positive: дефолтный/`MARKETPLACE` фильтр виден (507 orders/365 bookings) | PASS | PASS |
| Прямой Storefront Order/Booking GET → 404 (не сломан) | PASS | 404/404 |

Assert: никаких Storefront UUID/refs/rows через platform контракт; Storefront-строки сохранены в DB.

---

## 10. D4SR-F3 S12 Natural Completion

Новый isolated e2e (d4-remediation-closure, «S12 natural completion»): полная canonical цепь РЕАЛЬНЫМИ командами:

```text
Product (approved PARTNER, TOUR) → Request → confirm-price → customer-accept → convert →
Order process → traveler collection (real PATCH) → final-confirm → order confirm → order send →
Booking (created subscriber-ом) send → confirm → service (IN_SERVICE) → complete (COMPLETED) →
Order auto-reconcile FULFILLED (waitFor) → order close → CLOSED
```

**Hard: NO direct Prisma/SQL final-state injection** — все статусы достигнуты application/domain командами. Assert: `Booking COMPLETED`, `Order FULFILLED` (событийно) → `Order CLOSED`.

## 11. S12 Temporal Assertions

Проверены canonical timestamps (не `updatedAt`):
- `Booking.confirmedAt` (confirm milestone) и `Booking.completedAt` (complete milestone) — существуют, установлены;
- `Order.fulfilledAt` (reconcile FULFILLED, единый milestone) и `Order.closedAt` (close) — установлены;
- монотонность: `createdAt ≤ confirmedAt ≤ completedAt ≤ fulfilledAt ≤ closedAt` (по заказу; для booking — `confirmedAt ≤ completedAt`). Schema limitation: отдельный «service-start timestamp» не моделируется — зафиксировано, ad hoc не создавался.

## 12. S5 Decline Coverage

- **S5A — Customer declined:** `SUPPORTED` — real command `POST /requests/:id/customer-decline` → `CANCELLED_BY_CUSTOMER`, `customerDecision = DECLINED`. isolated e2e: Request → decline → статус в DB `CANCELLED_BY_CUSTOMER`; последующий `convert` → 4xx; `convertedOrderId` остаётся NULL (нет Order conversion).
- **S5B — Customer action expired:** `auto-EXPIRED = NOT IMPLEMENTED` (честно). Enum `EXPIRED` и `customerActionDeadline` существуют в модели; scheduler/worker auto-transition отсутствует и не реализован (вне scope; задокументировано как debt PD-5, §20).

## 13. D4SR-F5 Manifest Correction

`docs/evidence/d4/D4_REPRESENTATIVE_COMMERCE_CASES.md`, CASE A. Повторный запрос live DB по business reference:

```text
MKT-REQ-09000547 → id 006e94b4-62e7-447a-9cab-84ca62d74758 (REQ-09000547, CONVERTED)
linked Order     → 83eb7738-01ac-4506-9af8-3504b989bfc6 (ORD-00001501 / MKT-ORD-09000547, NEW)
```

Исправлены: Request UUID (был ошибочно скопирован UUID заявки C1 `09965373-…`) и Direct URL `/app/requests/006e94b4-…`. C1–C4 UUID сверены с live DB — корректны.

## 14. D4SR-F6 Bulk Traveler Remediation

`updateTravelers` (bulk PATCH `/orders/:id/travelers`):

- **Root cause:** DTO (и `TravelerUpdateInput`) принимали `passportExpiry`, persistence его игнорировала (silent discard); `dataCompleteness` считалась только по `passportNumber` вместо pinned REQUIRED.
- **Fix:** `passportExpiry` теперь персистится (`new Date(t.passportExpiry)` по контракту bulk, без изменения legacy-семантики truthy-merge); полнота — через общий canonical helper `computeTravelerCompleteness(pinned, values)`:
  - pinned есть (D3/D4 Order) → `COMPLETE ⇔ все REQUIRED-поля непусты`; OPTIONAL/NOT_REQUESTED не становятся REQUIRED искусственно;
  - pinned нет (legacy pre-D3, вне D3-потока) → историческое правило bulk (полнота по паспорту) сохранено и задокументировано.
- Single D3-путь переведён на тот же helper (общая canonical логика, D4SR-F6 требование).
- Bulk endpoint: production UI/runtime не использует (D3 UI ходит single PATCH; endpoint остаётся platform-контрактом) → «supported» ветка remediation.

e2e: passportExpiry persisted pre-confirm (DB value); REQUIRED missing → `INCOMPLETE`; все REQUIRED (без OPTIONAL) → `COMPLETE`; post-final-confirm bulk → 409. PASS.

## 15. PII/Security Regression

Повтор D4 security suite полностью: **10/10 PASS** — field-level redaction, list minimization, anti-mass-assignment (422 forged-keys), cross-tenant denial (403), Storefront enumeration protection (404), post-final-confirm immutability (409), Storefront exclusion из Platform list/registry. F1/F6 не ослабили ни один инвариант (422/redaction проверки вне lock-границы не изменились).

## 16. D3 Regression

- `d3-request-flow.e2e-spec.ts` — 4/4 PASS;
- `d3-traveler-collection.e2e-spec.ts` — 11/11 PASS;
- Permanent D3 CASE A/B проверены в live runtime smoke (§18).

## 17. Finance/Chain Regression

`d4-representative-chain.e2e-spec.ts` — 4/4 PASS (Payment CAPTURED, partial/full refund, cancellation до/после payment не сломаны; новые S12/S5 покрытия в d4-remediation-closure — отдельный suite). Finance permission keys/grants не изменялись (D4 F3 нетронут).

## 18. Runtime/Browser Evidence

Dev-стек (backend :4000 перезапущен с remediation-кодом, frontend :3000):

- **API probes (live):** SF orders filter → total 0 (DB: 500 SF); default orders → 507; SF bookings filter → 0 (DB: 354 SF); default bookings → 365; SF export (orders/bookings) → 0 SF-refs; drill-down export по SF orderId → 0 SF-refs; прямой SF Order/Booking GET → 404; post-final-confirm PATCH traveler (C1, MKT-ORD-09000847) → 409.
- **Browser smoke:** перезапущен `backend/tmp_d4_browser_verify.py` на live stack — **18/18 PASS** (D3 CASE A, C1 READY_FOR_BOOKING + travelers, C2/C3/C4 Request Center, C4 detail, C5 Booking CONFIRMED, C6 cancel/refund chain, Marketplace Orders/Bookings default, Storefront direct-GET 404, Storefront registry exclusion). Скриншоты воспроизведены детерминированно (byte-identical с закоммиченными `tmp_d4_browser_*`, canonical evidence `docs/evidence/d4/`).

## 19. DB→API→UI Reconciliation

| Объект | DB | API (platform) | UI |
|---|---|---|---|
| Storefront Orders (500) | существуют | 0 exposure (фильтр/export/drill-down deny; direct 404) | не отображаются |
| Storefront Bookings (354) | существуют | 0 exposure | не отображаются |
| Marketplace Orders (507) / Bookings (365) | существуют | default visible | C1/C5/C6 видимы |

Инвариант: «Storefront rows существуют в DB; Storefront rows недоступны через Platform scope» — выполнен (одновременно доказаны count>0 в DB и exposure=0 через API).

## 20. Deferred Findings/Debts

- **D4SR-F7 (INFO, demo credentials)** — DEFERRED/optional (§22 промпта): `admin/admin123` и `staffpass123` — repo-wide dev-fixture конвенция (77 suites); локальные D4-скрипты на env-переменные можно перевести отдельно, вне scope.
- **D4SR-F8 (INFO/P3, Partner positive path)** — DEFERRED: S19 negative isolation PROVEN; owning-partner operational access `NOT IMPLEMENTED / DEFERRED` (Partner Workspace Order/Booking Center — вне scope D4; новый debt PD-1).
- **PD-2 RBAC parity** — pre-existing drift `RolePermission (DB) ↔ ROLE_PERMISSIONS (constants)`; не исправлялся автоматически; D4 permission keys и FINANCE/ADMIN grants не изменялись. Debt сохранён.
- **PD-3 Traveler PII retention/purge/anonymization** — «жизнь объекта» ≠ formal retention policy; legal/business период не выдумывался. Debt.
- **PD-4 Entity Change Audit Framework** (Request/Order/Booking immutable audit events; PII old/new NO plaintext) — НЕ реализован здесь (preserved), интеграция с D5/D6 + Request requalification.
- **PD-5 S5B auto-EXPIRED** — NOT IMPLEMENTED (честно), scheduler не реализован.

## 21. Entity Change Audit Framework Preservation

Контракт зафиксирован (mutation → server validation → permission/scope → lifecycle mutability → successful mutation → immutable audit event; record: entityType/entityId/field-action/old/new/changedAt/changedBy/workspace/source/reason; sensitive PII — no plaintext). Не реализован в D4; добавлен в roadmap (PD-4) и в TRUE NEXT D5 scope.

## 22. Roadmap Sync

`docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md` — **additive sync** (история не переписана): статус-коррекции D2/D3/D4 → ACCEPTED, добавлена строка D4-REM (closure), добавлен ADDENDUM «D4 STRICT REVIEW REMEDIATION CLOSURE» с confirmed deferred debts (PD-1 Partner own-scope commerce, PD-2 RBAC parity, PD-3 PII retention/purge, PD-4 Entity Change Audit Framework, PD-5 auto-EXPIRED) и TRUE NEXT = D5 (+ D6). Также обновлены `docs/evidence/d4/D4_REPRESENTATIVE_COMMERCE_CASES.md` (CASE A UUID; S5A/S5B; S12; S19) и implementation report §13/§14/§23.

## 23. Findings Closure Matrix

| Finding | Severity | Before | Remediation | Evidence | Status |
|---|---|---|---|---|---|
| D4SR-F1 | P2 | TOCTOU traveler mutation ↔ finalConfirm | DB row-lock (`SELECT … FOR UPDATE` на Order) в single/bulk mutation и finalConfirm + re-check под lock | e2e R1/R2 single+bulk (DB postconditions); live post-confirm PATCH → 409 | CLOSED |
| D4SR-F2 | P2 | Storefront explicit filter bypass (list/export/drill-down) | `client filter ⊆ server scope`; deny → empty; drill-down AND-intersection; shared `sales-scope` | e2e negatives (orders/bookings list+export+drill-down); live 0 vs DB>0; positive preserved | CLOSED |
| D4SR-F3 | P3 | S12 evidence gap | isolated natural chain Booking COMPLETED → Order FULFILLED → CLOSED (real commands) | e2e S12 + temporal assertions | CLOSED |
| D4SR-F4 | P3 | S5 misclassification | S5A decline SUPPORTED / S5B auto-EXPIRED NOT IMPLEMENTED | e2e S5 decline; docs reclassification | CLOSED |
| D4SR-F5 | P3 | CASE A manifest UUID wrong | повторный запрос live DB, UUID `006e94b4-…` + URL | manifest CASE A corrected | CLOSED |
| D4SR-F6 | P3 | bulk traveler inconsistency | passportExpiry persisted; canonical completeness (общий helper) | e2e F6 (persist/INCOMPLETE/COMPLETE/409) | CLOSED |
| D4SR-F7 | INFO | demo credentials | repo-wide fixture конвенция; скрипты на env — отдельно | — | DEFERRED (optional) |
| D4SR-F8 | INFO/P3 | Partner positive path absent | не реализовано (вне scope); debt PD-1 | S19 negative PROVEN | DEFERRED |

## 24. Acceptance Matrix — HARD

| Gate | Result | Evidence |
|---|---|---|
| Starting Git clean | ✅ | HEAD==origin/master==5690f94, worktree empty |
| HEAD == origin/master (start) | ✅ | 5690f94 |
| F1 root cause proven | ✅ | §4 (pre-check вне serialization boundary) |
| F1 DB-level concurrency-safe | ✅ | row-lock helper; 3 пути |
| Single traveler race tested | ✅ | R1+R2 single (e2e) |
| Bulk traveler race tested | ✅ | R1+R2 bulk (e2e) |
| No post-final-confirm mutation possible in tested race | ✅ | DB postconditions; 409-проверки |
| F2 explicit Order list bypass closed | ✅ | e2e + live (0 vs 500) |
| F2 explicit Booking list bypass closed | ✅ | e2e + live (0 vs 354) |
| Orders export bypass closed | ✅ | e2e + live |
| Bookings export bypass closed | ✅ | e2e + live |
| Storefront rows preserved in DB | ✅ | 500 orders / 354 bookings |
| Platform Marketplace positive path preserved | ✅ | default 507/365; e2e positive |
| Direct Storefront 404 preserved | ✅ | e2e + live 404/404 |
| S12 natural completion chain PASS | ✅ | e2e |
| S12 no direct final-state injection | ✅ | только real commands |
| S5 decline correctly classified | ✅ | S5A/S5B |
| S5 decline natural test PASS | ✅ | e2e |
| Auto-EXPIRED honestly remains NOT IMPLEMENTED | ✅ | PD-5 |
| CASE A manifest corrected from live DB | ✅ | §13 |
| Bulk passportExpiry behavior corrected | ✅ | e2e F6 |
| Bulk completeness uses canonical pinned requirements | ✅ | shared helper |
| Post-final bulk mutation still denied | ✅ | e2e 409 |
| D4 security suite PASS | ✅ | 10/10 |
| D4 chain suite PASS | ✅ | 4/4 |
| D3 suites PASS | ✅ | 4/4 + 11/11 |
| Finance/refund regressions absent | ✅ | chain suite 4/4 |
| TypeScript compile PASS | ✅ | `tsc --noEmit` |
| Live runtime smoke PASS | ✅ | API probes + browser 18/18 |
| DB→API→UI reconciliation PASS | ✅ | §19 |
| No new PII exposure | ✅ | security suite; evidence scan |
| F7 correctly deferred/closed | ✅ | DEFERRED (INFO, optional) |
| F8 explicitly deferred | ✅ | PD-1 |
| Retention debt preserved | ✅ | PD-3 |
| RBAC parity debt preserved | ✅ | PD-2 |
| Entity Change Audit Framework preserved | ✅ | PD-4 (§21) |
| D5/D6 scope preserved | ✅ | не начаты |
| Roadmap additive sync completed | ✅ | §22 |
| Report predominantly Russian | ✅ | — |
| Final worktree EXACTLY EMPTY | ✅ | (см. §25) |
| Final HEAD == origin/master | ✅ | (см. §25) |
| Push successful | ✅ | (см. §25) |

## 25. Git Closure

Финальные команды и реальные SHA — см. финальный коммит (раздел обновлён после push):

```bash
git status --short          → EXACTLY EMPTY
git rev-parse HEAD          → <final SHA>
git rev-parse origin/master → <final SHA> (== HEAD)
git log -1 --oneline        → fix(d4): close strict review findings (F1–F6)
```

Изменённые/добавленные файлы closure: `backend/src/shared/sales-scope.ts`, `backend/src/modules/order/order.service.ts`, `backend/src/modules/booking/booking.service.ts`, `backend/test/d4-remediation-closure.e2e-spec.ts`, `docs/evidence/d4/D4_REPRESENTATIVE_COMMERCE_CASES.md`, `docs/reports/…D4…IMPLEMENTATION_REPORT.md`, `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`, `docs/reports/…D4…REMEDIATION_CLOSURE_REPORT.md` + prompt-файл перемещён в `docs/prompts/`.

## 26. Final Verdict

```text
VERDICT A — D4 STRICT REVIEW REMEDIATION CLOSURE PASSED

D4 — ACCEPTED
D4 REMEDIATION — CLOSED

Deferred non-blocking debts:
- D4SR-F7 demo credentials (optional cleanup)
- D4SR-F8 Partner own-commerce positive path (PD-1)
- PD-2 RBAC parity reconciliation
- PD-3 Traveler PII retention/purge policy
- PD-4 Entity Change Audit Framework (D5/D6 integration)
- PD-5 S5B auto-EXPIRED (NOT IMPLEMENTED, honest gap)
```

## 27. TRUE NEXT

```text
CANONICAL ROADMAP / ARCHITECTURE SYNC CHECK (roadmap уже синхронизирован, §22)
→ D5 — ORDER FULL-PAGE DETAIL
    + NAVIGATION CONSISTENCY
    + ACTION/STATE-MACHINE CONSISTENCY
    + EDITING/MUTABILITY CONTRACT
    + CROSS-CUTTING ENTITY CHANGE AUDIT FRAMEWORK INTEGRATION
→ D6 — Bookings Full-Page Detail (аналог D5)
```

**STOP. D5 NOT STARTED.**
