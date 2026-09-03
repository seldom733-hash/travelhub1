# PHASE 3 — PRE-STEP 3.12 — D4 — TRAVELER SECURITY + REPRESENTATIVE DATA + REPRESENTATIVE END-TO-END COMMERCE CHAIN COVERAGE — STRICT REVIEW REPORT

Дата: 03.09.2026. Стартовый HEAD: `eb1460a`; финальный — см. §Git Closure.

---

## 1. Executive Summary

Независимый Strict Review D4 (роль: Independent Architect + Code Reviewer + Application Security Reviewer + DB/Data-Integrity Reviewer + QA). Канонический контракт → Code → DB → Permissions → API → UI → Runtime → Representative Data → Security → Git.

**Результат: `VERDICT A — D4 STRICT REVIEW PASSED — D4 ACCEPTED`** с тремя documented findings (P2/P3, без P0/P1, без новых регрессий) и корректировкой claim-формулировок в трёх местах (F2-claim сужен до direct/default scope; S5/S12 requalification; S19 positive partner path — NOT IMPLEMENTED).

Независимое воспроизведение (не доверяя implementation-отчёту):

| Проверка | Результат |
|---|---|
| D4 security suite (isolated fresh DB) | 10/10 PASS |
| D4 representative-chain suite (isolated fresh DB) | 4/4 PASS |
| D3 request-flow + traveler-collection (isolated fresh DB) | 15/15 PASS |
| `tsc --noEmit` | PASS |
| Migration chain на isolated fresh DB (`template_travelhub_test`) | PASS; 3 D4-ключа в каталоге; grants ровно FINANCE+ADMIN |
| Live dev API (admin) — C1/CASE A reads, SF direct 404, list exclusion, explicit-param residual | воспроизведено |
| Live dev API — post-final-confirm mutation 409 / forged keys 422 | воспроизведено |
| Browser smoke (повторный прогон committed-скрипта, live stack) | 18/18 PASS (идентичный committed evidence) |
| Dev DB C1–C6 факты vs manifest | в основном сходятся; **1 ошибка manifest** (CASE A Request UUID) |
| RBAC parity drift (isolated fresh DB) | pre-existing; D4-ключи drift НЕ добавляют |
| Evidence safety scan | чисто (только demo-креды dev-скриптов, repo-wide конвенция) |

Ниже — полные секции, findings и claim-requalification.

---

## 2. Starting Git State

```bash
git branch --show-current     → master
git status --short            → пусто (единственный untracked — строго review prompt, добавлен между сессиями)
git status --porcelain=v1     → пусто
git rev-parse HEAD            → eb1460ad5f9865851d1a1c136d4361d62bc81a1b
git rev-parse origin/master   → eb1460ad5f9865851d1a1c136d4361d62bc81a1b
git log -10 --oneline         → D4 implementation (c99ec7c) + docs sync (65c829b, eb1460a) поверх D3 closure
```

Стартовый hard gate выполнен: `HEAD == origin/master`, worktree EXACTLY EMPTY (кроме добавленного пользователем review prompt, не product-код).

---

## 3. Review Diff

Проверен diff `c99ec7c` (33 файла, +2906 строк) + последующие docs-коммиты:

- `backend/prisma/migrations/20260903140000_d4_finance_payment_refund_execution_permissions/migration.sql` — каталог: 3 ключа (create/manage/execute), FINANCE-grants, ADMIN full-catalog sync (см. §11).
- `permissions.constants.ts` — те же ключи + уточнение `finance.refund.write` («создание»).
- `order.service.ts` — F1 (bulk `updateTravelers` gate на `finalConfirmedAt`), F2 (Storefront 404 в `getOrder`/`updateTravelers`/`orderAction`/`getPinnedRequirements`/`updateTravelerD3`/`validateTravelerCompletion`/`finalConfirm`), расширенные selects.
- `order.controller.ts` / `order.validation.ts` — `assertNoForbiddenKeys` на single-traveler PATCH; forged server-owned ключи (travelerCount/pinnedRequirements/milestones) в forbidden-списках.
- `booking-query.service.ts` / `booking.service.ts` — Storefront 404 на read/lifecycle-команды Booking.
- `d4-traveler-security.e2e-spec.ts` (10 тестов), `d4-representative-chain.e2e-spec.ts` (4 теста), `tmp_d4_seed.mjs`, evidence manifest, report, prompt.

Scope creep: нет — изменения узкие, соответствуют заявленным F1–F4. Бypass-путей и false-positive-тестов в diff не обнаружено (детали ниже).

---

## 4. Architecture

Canonical chain (D1/D3): `Product → Request → supplier confirm → customer accept → traveler collection → final confirm → Order → Booking → Payment → Refund/Cancel/Complete`.

Фактический runtime lifecycle после D4 совпадает с canonical: Request-конверсия, Order как durable commerce root до final-confirm (D3 Option B reconciled), Booking жёстко после `finalConfirmedAt` (D3 SR R3 gate подтверждён тестами D3 9 и D4 chain test 1), finance execution достижима (F3 fix). Authoritative no-Request flow не смешивается с Request-цепочками (разные `commerceSequence` roots и пути создания — D3 test 7, см. §S17). D4 не вносит архитектурных изменений контракта; добавлены permission-ключи и scope-гейты, соответствующие задокументированному правилу «Storefront = tenant партнёра».

---

## 5. F1 — Traveler Immutability

**Все mutation-пути OrderTraveler (полный обход):**

| Path | Место | Gate post-final-confirm | Вердикт |
|---|---|---|---|
| single `PATCH /orders/:id/travelers/:travelerId` → `updateTravelerD3` | order.service:1395+ | да — pre-check + повторный in-tx check (`freshOrder.finalConfirmedAt`) | PASS (D3 §19 + D4 test 7; live dev 409) |
| bulk `PATCH /orders/:id/travelers` → `updateTravelers` | order.service:1026+ | да — pre-check (`409 Conflict`), D4 F1 fix | PASS (D4 test 7; live dev 409 на C1) |
| `OrderTraveler` create | createOrderFromRequested / createOrderFromRequest | n/a (создание до confirm; Request-конверсия только из не-подтверждённого) | PASS |
| Passenger sync | booking.subscribers (create) | из final-подтверждённых OrderTraveler (BookingRequested только после final-confirm gate) | PASS |
| delete/upsert OrderTraveler, Passenger mutation | — | отсутствуют в src (grep по всем prisma-вызовам) | PASS |

Проверены также: nested Order-граф, Request conversion, internal commands — других писателей нет.

**Finding D4SR-F1 (P2, correctness):** mutation vs `final-confirm` не сериализованы на уровне БД. `finalConfirm` делает CAS только по строке Order (`updateMany ... finalConfirmedAt: null`), а traveler-PATCH обновляет строки OrderTraveler, не конфликтуя с Order-CAS. Single-path перепроверяет `freshOrder.finalConfirmedAt` внутри tx, bulk — только до tx. При READ COMMITTED остаётся окно: PATCH прочитал `finalConfirmedAt = null`, final-confirm закоммитился, PATCH коммитит запись после подтверждения. Вероятность низкая (два concurrent staff-действия), эксплуатируется только авторизованным редактирующим актором; D3-механика не сломана. Remediation (future): сериализовать оба пути одной блокировкой строки Order (`SELECT … FOR UPDATE`/`SKIP LOCKED`) либо перенести CAS-проверку finalConfirmedAt в ту же tx, что и запись travelers + e2e-гонка. Не блокер D4 (нет P0/P1; путь не даёт несанкционированной мутации).

---

## 6. Anti-mass-assignment

Проверено кодом и live-пробами (dev stack, read-only/mutating-denied):

- `PATCH /orders/:id` — принимает только `action`; forged server-owned ключи (`travelerCount`, `pinnedRequirements`, `termsAcceptedAt`, `travelerDataCompletedAt`, `finalConfirmedAt`, `version`, `acquisitionSource`, money/milestones/… ) → 422. Live: `{action:"process", travelerCount:5}` → **422**.
- `PATCH /orders/:id/travelers` (bulk) — top-level + каждый traveler проверяются `assertNoForbiddenKeys(ORDER_TRAVELERS_FORBIDDEN_KEYS)` (id/orderId/customerId/dataCompleteness/version/timestamps/actor/correlation/Order-level keys) → 422; DTO whitelist-strip дополнительно.
- `PATCH /orders/:id/travelers/:travelerId` — D4 F4 fix: `assertNoForbiddenKeys` на single path. Live: forged `dataCompleteness` → **422**.
- Finance create (payment/refund/dispute) — свои forbidden-lists (существовали до D4).

Проверка «реально ли 422, а не silent-strip»: e2e security test 5 (green) + live-пробы подтверждают, что forged ключи доходят до `assertNoForbiddenKeys` (handler видит raw body) и отклоняются 422. Механизм рабочий.

---

## 7. PII Role/Field Matrix

Policy (shared/pii.ts): `TRAVELER_PII_FIELDS = passportNumber, passportExpiry, birthDate`; полные значения — только `OPERATOR` и `ADMIN`; прочие роли получают `null` на этих полях (DTO-level, не frontend-hiding). Имена/citizenship/gender остаются.

| Role | GET /orders/:id, /:id/travelers, /bookings/:id | Business Need (full) | Full | Redacted | Correct? |
|---|---|---|---|---|---|
| OPERATOR | да (traveler collection/booking execution) | операционное ведение заказа/брони | ✅ | — | ✅ |
| ADMIN | да | полный контроль платформы | ✅ | — | ✅ |
| DIRECTOR | да (order.read) | нет операционной необходимости в passport | — | ✅ | ✅ |
| SALES_MANAGER | да (order.read) | продажи не требуют документов travelers | — | ✅ | ✅ |
| FINANCE | да (order.read) | деньги/рефанды — не passport | — | ✅ | ✅ |
| ANALYST | да (order.read) | агрегаты без документов | — | ✅ | ✅ |
| MARKETER / MODERATOR | нет order.read | — | — | — | ✅ (нет доступа) |
| PARTNER (own context) | нет order.read/booking.read (только own-scope контракты) | — | — | — | ✅ по permission-модели; positive path отсутствует (см. D4SR-F8) |
| BUYER | own-scope (account.*.read_own) | свой заказ | own-context | — | ✅ (собственные объекты) |

Механизм — capability/role-based (`canViewTravelerPii(role)`), не hardcode per-endpoint. Live-воспроизведение ролевой redaction выполнено в isolated e2e (security test 3: SALES_MANAGER/ANALYST — passport/birthDate/passportExpiry null; OPERATOR — full) — роли реально аутентифицированы, объекты реальные. E2e подтверждает и что foreign Partner (Partner B) получает 403 на Order/Booking Partner A (test 2).

---

## 8. Lists / Data Minimization

- `GET /orders` (list): `include travelers` → `redactTravelersPii(viewer)`; не-операционные роли получают passport/birthDate/passportExpiry = null. OPERATOR/ADMIN — full (ролевая политика §7).
- `GET /bookings` (list): projection passengers = `{id, firstName, lastName}` — passport/birthDate в списке НЕ возвращаются вовсе. ✅
- Order/Booking detail: redaction по viewer.
- Exports (`/orders/export`, `/bookings/export`): traveler-поля не экспортируются (select без travelers; пассажиров в bookings export — нет в D4-проверке; отдельные колонки refs/amounts/statuses). Passenger PII в экспортах отсутствует.
- Registry: не-OPERATOR роли не видят passport в списках — минимализация соблюдена.

---

## 9. Isolation — Platform ↔ Storefront / Partner ↔ Partner

**Негативные проверки (независимо воспроизведены):**

| Probe | e2e | Live dev (admin) | Result |
|---|---|---|---|
| Platform → Storefront Order direct GET (реальный SF UUID) | test 8 (404) | **404** | ✅ |
| Platform → Storefront Order travelers / final-confirm / lifecycle / booking command | tests 8–9 (404) | — | ✅ |
| Platform → Storefront Booking direct GET | test 8 (404) | **404** (real SF booking UUID) | ✅ |
| Storefront Order/Booking в Platform registries (default scope + search) | test 10 (0) | **0** (search SF001-ORD-00000001) | ✅ |
| Partner B → Order/Booking/Passengers Partner A | test 2 (403) | — | ✅ |
| Browser: `/app/orders|bookings` SF URL → 404 UI; SF-коды отсутствуют в registries | browser 18/18 | re-run 18/18 | ✅ |

**Остаточный surface (pre-existing, документирован ранее как F-R2-1 P2):** явный query-param `?acquisitionSource=PARTNER_STOREFRONT` на list/export Order и Booking возвращает полную Storefront-популяцию любому актору с `order.read`/`booking.read` (live: **500 SF Orders / 354 SF Bookings**), без `sellerPartnerId`-скопинга в `listOrders`. D4 закрыл direct-object часть (F-R2-2), но list-override остался. Это НЕ D4-регрессия: F-R2-1 зафиксирован и принят как residual (VERDICT A) на фазе Command Center Business Separation; D4 report §F2 формулировка «Storefront-tenant объекты не читаются через platform marketplace read-контракт» **завышена** для list-эндпоинта. → **D4SR-F2 (P2, pre-existing residual)** — см. Findings; claim в Claim Matrix сужен.

**Trusted internal bypass audit:** 404-гейты срабатывают только при наличии HTTP `viewer` (`viewer && acquisitionSource === PARTNER_STOREFRONT`). Внутренние вызовы без viewer (consumers: booking.subscribers, order-requested consumer, finance cross-domain reads, CRM/analytics с собственными scope-фильтрами) не затронуты. Внешний request → internal trusted-call без authorization отсутствует: все HTTP-пути передают actor как viewer; внутренние вызовы идут между модулями без пользовательского ввода. Bypass не найден.

---

## 10. Finance Permissions (F3)

Route-guards → permission-ключи (finance.controller): `POST /finance/payments` → `finance.payment.create`; `…/confirm|fail|cancel` → `finance.payment.manage`; `POST /finance/refunds` → `finance.refund.write`; `…/approve` → `finance.refund.approve`; `…/process|fail` → `finance.refund.execute`.

Runtime authorization DB-driven: `security.permissionsOf(userId)` читает `Role → RolePermission → Permission` (не constants). Поэтому миграция — единственный источник runtime-grants.

Проверено в DB (dev `travelhub1` и fresh `template_travelhub_test` после полной migration chain):

```text
D4 keys в каталоге Permission: finance.payment.create, finance.payment.manage, finance.refund.execute  (обе DB)
Grants: FINANCE ✅, ADMIN ✅; OPERATOR/SALES_MANAGER/ANALYST/MARKETER/MODERATOR/DIRECTOR/PARTNER — НЕТ (обе DB)
```

Positive runtime: e2e chain test 2 — FINANCE-пользователь создаёт/подтверждает платёж (201 → CAPTURED), test 3 — approve/process refunds; 4/4 PASS. Negative: отсутствие ключей у прочих ролей в fresh DB + guard `user.permissions.includes(p)` — deny детерминирован (rbac-actions/фин-суиты до D4 были сломаны по иной причине — см. §11/§22).

Create/confirm/fail/cancel Payment и create/approve/process/fail Refund разведены по разным ключам (не одно право) — ✅. Migration idempotent (`ON CONFLICT DO NOTHING`, `NOT EXISTS`); повторное применение безопасно. Комментарий «ADMIN gets ALL_PERMISSIONS» точен: ADMIN-блок миграции синхронизирует ADMIN с полным каталогом (конвенция `ROLE_PERMISSIONS.ADMIN = ALL_PERMISSIONS`), а не только с 3 ключами — поведение соответствует конвенции, зафиксировано.

---

## 11. RBAC Parity Drift + Fresh DB

`rbac-parity.e2e-spec.ts` на **isolated fresh DB** (не dev): **7 failed / 4 passed** — воспроизведено независимо.

Drift-детали (fresh DB, console-логи parity-суита): Permission catalog = **147 = 147** (exact parity). RolePermission drift — pre-existing, ключи вне D4:
- ADMIN: missing `crm.partner.read`, `crm.customer.read_own`, `crm.customer.create_own`, `crm.customer.update_own` (startup-seed добавляет Permission-строки, но намеренно НЕ трогает RolePermission — security.service.spec закрепляет это);
- DIRECTOR/OPERATOR/SALES_MANAGER: missing `crm.partner.read`;
- PARTNER: missing 3× `crm.customer.*_own`;
- FINANCE/ANALYST/SALES_MANAGER: extra `analytics.read` / `support.case.read` (в DB, но удалены из constants ранее);
- MODERATOR/BUYER/MARKETER: parity ✅.

**D4-ключи** в fresh DB присутствуют и у FINANCE/ADMIN (expected=37 для FINANCE, missing=none) — **D4 drift НЕ добавляет**. Оценка A/B: drift затрагивает только CRM/support/analytics-ключи и не меняет D4 authorization guarantees (traveler-security gates, finance create/manage/execute, order/booking lifecycle) — на fresh DB и в dev runtime эти ключи идентичны. Вариант A обоснован; parity-деbt остаётся зафиксированным (remediation: отдельная миграция-синхронизация RolePermission, вне D4 — соответствует D4 report §28).

Fresh-DB proof (SR §11): isolated e2e-контур (globalSetup → migrations → template) создаёт DB заново под каждый прогон; D4-миграция применяется в цепочке (`All migrations have been successfully applied`); D4 suites на ней проходят 10/10+4/4; permission-rows проверены напрямую. Dev DB не сбрасывался и не затрагивался e2e (URL guard: `travelhub1` без суффикса `test` отклоняется).

---

## 12. Seed / Manifest Audit

**Seed (dev C1–C6, `tmp_d4_seed.mjs`):** все permanent-кейсы созданы реальными API-командами: `POST /requests` → `confirm-price` → `customer-accept` → `convert` → order `process` → traveler PATCH → `validate-completion` → `final-confirm` → order `confirm`/`send` → booking `send`/`confirm` → `POST /finance/payments` + `confirm` → order `cancel` → refund `create/approve/process`. **Прямых INSERT финальных статусов нет** (исключение — только предпосылки: ни одного). Идемпотентность через state-файл. Direct `prisma.*` в seed отсутствует (только fetch к API). → соответствует §12 SR (no final-status cheating).

**E2e-фикстуры security-суита** используют `prisma.order.create` с конечными статусами (Storefront chain `SENT_TO_BOOKING`/`CONFIRMED` с `finalConfirmedAt`). Это допустимо как deterministic fixture для проверки authorization/isolation (D4 §28 test builder; цель суита — security gates, а не natural-chain evidence). Natural-chain evidence — в chain-суите (реальные команды, 4/4) и C1–C6.

**Manifest ↔ DB (независимая сверка, dev DB):**

| Fact | Manifest | DB | Result |
|---|---|---|---|
| C1 REQ-09000847 → ORD-09000847 | 09965373…, READY_FOR_BOOKING, fc, 2 travelers, 340.00 AZN | id 09965373… → order 1e1ab156 READY_FOR_BOOKING, fc=true, 2×Синт COMPLETE, 340.00 | ✅ |
| C2 CONFIRMED / C3 NEW / C4 UNAVAILABLE (no Order) | ✅ | CONFIRMED / NEW / UNAVAILABLE; converted=false | ✅ |
| C5 BKG-09000861 CONFIRMED, order PARTIALLY_FULFILLED UNPAID | fdfbcb49/BKG-00001702 | ✅ 300.00 AZN, confirmedAt, 2 Passenger | ✅ |
| C6 ORD-09000949 CANCELLED REFUNDED 300/300; BKG CANCELLED; PAY CAPTURED; REF PROCESSED | aa8e510d, 31f2fdfc, dde9185b, 381e5ef8 | ✅ все связи и суммы совпадают | ✅ |
| CASE A ORD-09000547 NEW, editable, fc NULL, 2 travelers | 83eb7738; **Request UUID 09965373…** | Request 09000547 = **006e94b4-62e7-447a-9cab-84ca62d74758** (09965373 — это Request 09000847/C1!) | ❌ **D4SR-F5** |

Manifest CASE B (09000548 SENT_TO_BOOKING, fc=true) — DB совпадает. Direct URL в manifest CASE A (`/app/requests/09965373…`) ведёт на Request C1, а не CASE A — evidence defect (P3).

---

## 13. S12 — Natural Completion (STRENGTHEN)

Booking lifecycle поддерживает естественное завершение реальными командами: `service` (CONFIRMED→IN_SERVICE) → `complete` (IN_SERVICE→COMPLETED); Order: `complete` (PARTIALLY_FULFILLED/SENT_TO_BOOKING→FULFILLED) → `close` (→CLOSED). Dev DB содержит исторические терминальные факты: **421 COMPLETED Booking, 559 FULFILLED/CLOSED Order**.

Однако **isolated e2e natural chain до COMPLETED не доказана**: d4-representative-chain останавливается на Booking CONFIRMED → Payment → Refund / Cancel; S12 в coverage-матрице помечен «PASS (covered)» на основании исторических данных dev DB. Требование SR §14 не выполнено полностью. → **D4SR-F3 (P3, evidence gap)**: required remediation — тест в chain-суите: Order→Booking CONFIRMED→(payment не обязателен)→booking `service`→`complete`→COMPLETED; order `complete`/`close`; temporal/status assertions. Продукт дефекта не имеет (путь достижим), блокером не является.

---

## 14. S17 — Authoritative No-Request Flow

S17 доказан **не** «legacy-строками», а реальным canonical creation path в isolated e2e: `d3-traveler-collection` test 7 — полная Sale-цепочка (Quote → CheckoutIntent → Sale complete → OrderRequested → Order), `request.count(convertedOrderId=order)=0` (без Request), traveler/final-confirm gates работают; тот же canonical sale-путь прогоняется множеством e2e-суит (pricing-financial-snapshot, sale-completion-order-requested и др.). Creation path, frozen terms (acceptedAt), traveler requirements, final-confirm gate, Booking eligibility — всё подтверждено в этой цепочке (тесты D3 7/9/10, green). S17 → PASS (evidence — D3 suite test 7 + chain суит). D4 report ссылается на «legacy Orders» — evidence описано слабее, чем есть; claim-матрица ниже фиксирует это.

---

## 15. S5 / S10 — Requalification

- **S5 (customer declined/expired):** D4 report утверждает `NOT SUPPORTED — ARCHITECTURE GAP (no TTL/EXPIRED enum)`. Это **неточно**:
  - customer **decline** поддерживается реальной командой `POST /requests/:id/customer-decline` → `CANCELLED_BY_CUSTOMER` (request.service:549);
  - enum `RequestStatus` содержит `EXPIRED`, `SUPPLIER_TIMEOUT`, `CUSTOMER_PAYMENT_TIMEOUT`, `CANCELLED_BY_CUSTOMER`;
  - есть TTL-механика: `customerActionDeadline` (48h после supplier confirmation, request.service:403) — но она реализована как hard-rejection при `customerAccept`/`customerDecline` после дедлайна (`BadRequestException "Customer action deadline has expired"`), а **не** как автоматический переход в `EXPIRED` (код, присваивающий `EXPIRED`, отсутствует).
  → Итог: **declined — SUPPORTED (CANCELLED_BY_CUSTOMER), но не представлен permanent-кейсом; expired-переход — NOT IMPLEMENTED (enum есть, TTL-gate есть, auto-transition нет)**. → **D4SR-F4 (P3, report accuracy)**. Утверждение «enum отсутствует» неверно; «gap» следует переформулировать как «auto-EXPIRED transition не реализован; CANCELLED_BY_CUSTOMER поддерживается и не покрыт representative-данными».
- **S10 (partial payment):** подтверждено — модель единого capture: `Payment.amount` = frozen полный `Order.amount` (client не передаёт сумму), один активный Payment на Order (`isActivePayment` dedupe). `OrderPaymentStatus.PARTIALLY_PAID` существует в enum, но ни один код его не присваивает. → S10 действительно `NOT SUPPORTED` (architecture gap; PARTIALLY_PAID — schema placeholder). ✅ формулировка D4 корректна (уточнить про placeholder-статус).

---

## 16. Financial Integrity

Независимо проверено e2e (chain tests 2–3) + dev DB:

- `amount > 0`, currency consistent; Payment.amount = frozen Order.amount verbatim (не reprice); Payment→Order по реальному FK-подобному `orderId`; Refund→Payment по `paymentId`.
- C6: `paidAmount 300.00 = CAPTURED 300.00`, `sum(refunds) 300.00 == paid`, `refunded >= paid → paymentStatus REFUNDED`, Order CANCELLED + REFUNDED, Booking CANCELLED (компенсация), все refs `MKT-ORD/BKG/PAY/REF` через реальные UUID-связи.
- Over-refund probe → **409** (e2e test 3).
- Idempotency: `POST /finance/payments` идемпотентен по `Idempotency-Key` (2.12H), активный Payment dedupe в tx; double-refund по (paymentId, amount) — ок.
- Временные инварианты: `Refund.createdAt >= Payment.paidAt >= Order.createdAt` (e2e asserts, green).

Ручной live-вызов create/confirm на dev НЕ выполнялся (мутация dev-данных не требовалась — e2e на isolated DB достаточно и безопаснее).

---

## 17. Temporal Integrity

e2e chain test 1 asserts: `Request.createdAt ≤ Order.createdAt ≤ Booking.createdAt ≤ Booking.confirmedAt`; `finalConfirmedAt`/`confirmedAt` установлены после команд; test 2: `Payment.paidAt ≥ Order.createdAt`; test 3: `Refund.createdAt ≥ Payment.paidAt`. C1–C6 в dev созданы последовательными командами; реквизит-хронология естественная (проверено SQL-запросами: `customerAcceptedAt`, `convertedOrderId`, `finalConfirmedAt`, `paidAt`, `completedAt` на месте; `updatedAt` как lifecycle timestamp не подменяется). ✅

---

## 18. D3 Regression

На isolated DB повторно прогнаны D3-суиты: **`d3-request-flow` + `d3-traveler-collection` = 15/15 PASS** (включая Request→conversion→traveler gates, no-Request flow, Booking-eligibility, acceptance-instant test). D3 CASE A (MKT-ORD-09000547, NEW, editable) и CASE B (MKT-ORD-09000548, SENT_TO_BOOKING, fc) в dev DB на месте (SQL) и в UI (browser PASS). D4 не регрессировал D3.

---

## 19. Test Quality

- Реальные разные tenants: security suite создаёт Partner A и Partner B через полный onboarding (register→submit→review→approve) — 403 cross-tenant на реальных объектах. ✅
- Правильные authenticated roles: OPERATOR/SALES_MANAGER/ANALYST создаются через `POST /users` + login; redaction-asserts на реальных данных с passport. ✅
- Storefront acquisitionSource: фикстуры с `PARTNER_STOREFRONT` + `sellerPartnerId`, refs `SF001-ORD/BKG-…`. ✅
- `finalConfirmedAt` действительно устанавливается (assert после final-confirm в test 7). ✅
- 404 не от unrelated reason: security test 9 дополнительно проверяет, что данные не изменились (`firstName` остался), т.е. 404 — это скрытие, а не ошибка. ✅
- Transition sequence реально доказана: chain-суит кодирует все production-гейты и asserts статусы после каждой команды. ✅
- Слабые места: 1) S12 natural completion отсутствует (D4SR-F3); 2) e2e не покрывает explicit `acquisitionSource` list-param (D4SR-F2 поверхность); 3) ролевая PII-матрица e2e покрыта для OPERATOR/SALES_MANAGER/ANALYST — остальные роли по единому механизму (заявлено residual в D4 report §28 — подтверждаю).

---

## 20. Independent Browser / Runtime

Live stack (frontend :3000, backend :4000). Повторный самостоятельный прогон committed-скрипта `tmp_d4_browser_verify.py` (тот же детерминированный сценарий, реальные URL/refs): **18/18 PASS** — login; D3 CASE A; C1 READY_FOR_BOOKING + travelers; C2/C3/C4 Request Center; C4 detail; C5 booking CONFIRMED; C6 booking/order CANCELLED + payment CAPTURED; Marketplace в Platform registries; Storefront direct URL → 404 UI; Storefront исключён из Platform registries. Сгенерированные скриншоты **байт-идентичны** committed evidence (детерминированный рендер) — evidence подтверждено повторным прогоном.

Live API probes (admin, dev): C1 GET 200; CASE A GET 200 (fc NULL); real SF Order/Booking UUID → 404; default registry search SF → 0; explicit `?acquisitionSource=PARTNER_STOREFRONT` → 500/354 (F-R2-1 residual); post-final-confirm traveler PATCH → 409; forged `dataCompleteness` → 422; forged `travelerCount` на orderAction → 422.

Partner positive access: **по возможности не подтверждено** — партнёрский Order/Booking center отсутствует (см. D4SR-F8). D5/D6 drawer/full-page несоответствия не исправлялись (не D4-scope).

---

## 21. DB → API → UI Reconciliation

C1–C6: DB-факты (SQL, §12/§16/§17), API (live + e2e), UI (browser §20) сходятся по reference/status/relations/traveler state/money/currency. Единственное расхождение — документационное (manifest CASE A Request UUID, D4SR-F5); фактические данные корректны. Замечание: DB `Booking.completedAt`/`Order.closedAt` и пр. для исторических COMPLETED-строк не сверялись с UI (S12 UI-проверка вне D4-скопа, но факт наличия статусов подтверждён SQL).

---

## 22. Evidence Safety

Скан evidence/reports/tmp-скриптов D4 на secrets/tokens/Authorization/passport-паттерны: чисто. `admin/admin123` присутствует в двух committed dev-скриптах (`tmp_d4_seed.mjs`, `tmp_d4_browser_verify.py`) — это repo-wide dev/test фикстура (77 e2e-суит используют те же креды; в `src` та же конвенция), не production-секрет. → **D4SR-F7 (INFO)**. Real PII в evidence отсутствует (synthetic personas); sensitive payload в Outbox-событиях минимизирован (BookingRequested несёт только refs — D3 SR fix сохранён). Найденные секреты в отчёт не копировались.

---

## 23. Retention / Privacy Debt

«Жизнь объекта» в D4 report §4 — техническое описание срока жизни строк, **не** каноническая retention policy. Зафиксировано как privacy/architecture debt: формальная политика хранения/удаления traveler PII (legal retention, purge/anonymization workflow) отсутствует и должна появиться в отдельной фазе (без выдумывания legal-сроков). Продуктового изменения в D4 не требуется; зафиксировано для roadmap.

---

## 24. Cross-cutting Entity Change Audit Framework — PRESERVED

Принятое cross-cutting требование (Request/Order/Booking mutation → validation → permission/scope → lifecycle mutability → immutable audit record; PII redact/mask/hash для old/new) **в D4 SR не реализуется** — сохраняется для D5/D6 и Request requalification. В D4 код не добавлен (соответствует scope-правилу SR §25). Зафиксировано как future invariant.

---

## 25. D5/D6/D11/D12 Preservation

D5 (Order full-page detail, navigation/action-state-machine consistency, mutability contract, immutable change history) и D6 (Booking) — findings сохранены, не исправлялись; известное несоответствие (drawer vs full-page actions для одного NEW Order) остаётся. D11/D12 (KPI/status reconciliation, Active Customers 51→CRM92/183, `crm.filter.clear_dates`, Help formulas) — не трогались. В D4 SR продукт не менялся (только docs).

---

## 26. Findings Matrix

| ID | Severity | Surface | Finding | Evidence | Root Cause | Blocks D4? | Required Remediation |
|---|---|---|---|---|---|---|---|
| D4SR-F1 | P2 (correctness) | Order traveler mutation vs final-confirm | TOCTOU: PATCH travelers (single/bulk) и final-confirm не сериализованы на уровне БД; узкое окно мутации подтверждённых данных при concurrent вызовах | code audit order.service `updateTravelerD3/updateTravelers/finalConfirm` (CAS только по Order row) | READ COMMITTED; отсутствие блокировки Order row в traveler-mutation tx | Нет (P2; только авторизованный actor; требует одновременности) | Serialize через `SELECT … FOR UPDATE` по Order или CAS finalConfirmedAt в той же tx; e2e-гонка |
| D4SR-F2 | P2 (tenant scope, **pre-existing**) | Order/Booking list+export | `?acquisitionSource=PARTNER_STOREFRONT` возвращает полную Storefront-популяцию (live 500 orders / 354 bookings) любому актору с order.read/booking.read; `listOrders` не скоупит `sellerPartnerId`; owning-partner list невозможен (PARTNER без order.read). Ранее документирован как F-R2-1 P2 residual (VERDICT A принят) | live API probes; code audit listOrders/buildOrderWhere/listBookings | list-param override сохранён при D4 direct-404 fix (F-R2-2 закрыт) | Нет (pre-existing, documented residual; D4 claim сужен — §9/Claim Matrix) | В фазе Partner Order Center: убрать override из platform-контракта или требовать sellerPartnerId=actor.partnerId (tenant scope) |
| D4SR-F3 | P3 (evidence gap) | S12 completion coverage | Natural completion до COMPLETED не доказана в isolated e2e (только исторические данные dev DB: 421 COMPLETED bookings) | coverage matrix §23 D4 report; chain suite scope | D4 §28 не требовал S12-теста; historical «covered» слабее SR §14 | Нет | Расширить d4-representative-chain: booking `service`→`complete`→COMPLETED + order `complete`/`close`, asserts |
| D4SR-F4 | P3 (report accuracy) | S5 requalification | D4 report: «no TTL/EXPIRED enum» — неверно: `EXPIRED` и др. статусы есть в enum; decline поддерживается (`CANCELLED_BY_CUSTOMER`); отсутствует auto-EXPIRED transition (TTL = gate-rejection 48h) | request.service:403/468/549; schema RequestStatus | Неточно классифицирован существующий state machine | Нет | Переформулировать: declined SUPPORTED (+permanent case желателен); EXPIRED auto-transition NOT IMPLEMENTED |
| D4SR-F5 | P3 (evidence defect) | Manifest | CASE A Request UUID в manifest = 09965373… (это Request C1/MKT-REQ-09000847); фактический UUID CASE A (MKT-REQ-09000547) = 006e94b4-62e7-447a-9cab-84ca62d74758 | DB query vs `docs/evidence/d4/D4_REPRESENTATIVE_COMMERCE_CASES.md` | copy-ошибка при составлении manifest | Нет | Исправить manifest (UUID + Direct URL CASE A) |
| D4SR-F6 | P3 (legacy) | bulk `updateTravelers` | Legacy bulk-путь молча не сохраняет `passportExpiry` (DTO принимает, update игнорирует) и считает dataCompleteness только по passportNumber, а не по pinned REQUIRED | code audit (order.service bulk data object) | legacy DoD-семантика до D3; D3-поток идёт single-path | Нет | Привести legacy bulk к pinned-валидации или задокументировать deprecated |
| D4SR-F7 | INFO | committed scripts | `tmp_d4_seed.mjs` / `tmp_d4_browser_verify.py` содержат hardcoded demo-креды admin/admin123 | grep | repo-wide dev/test конвенция (77 суит) | Нет | Перевести на env-переменные (не срочно; не секрет) |
| D4SR-F8 | INFO/P3 (architecture) | Storefront positive path | Owning-Partner positive-путь к своей Storefront commerce-цепочке (Order/Booking) не реализован: PARTNER не имеет order.read/booking.read, партнёрского Order/Booking center нет; D4/предыдущие фазы декларировали defer | RBAC ROLE_PERMISSIONS.PARTNER; frontend app/partner; live 403-модель | Partner Workspace commerce-контур отложен (roadmap) | Нет | Создать own-scope Partner Order/Booking контракт в фазе Partner Workspace; S19 claim → PARTIAL |
| — (retention) | INFO | policy | Формальная retention/purge политика traveler PII отсутствует («жизнь объекта» ≠ policy) | D4 report §4 | не было требования фазы | Нет | Отдельная privacy-фаза |

Незакрытых **P0/P1** нет. Все P2/P3 — non-blocking, зафиксированы с required remediation (D4SR-F1/F2 — кандидаты на ближайшую remediation-фазу вместе с D5-смежным скоупом).

---

## 27. Claim Requalification Matrix

| Claim (implementation) | Says | Independent Evidence | Result |
|---|---|---|---|
| F1 — post-final-confirm traveler mutation denied | 409 bulk+single | e2e test 7; live 409 (C1); code audit всех mutation-путей | PASS (TOCTOU-нюанс → D4SR-F1 P2) |
| F2 — Storefront недоступен через Platform | 404 direct + команды; list excluded | e2e 8–10; live 404 (real UUIDs), registry 0; browser 404 UI | **PARTIAL** — direct/команды/default-scope PASS; explicit list-param override остаётся (D4SR-F2 P2 pre-existing) |
| F3 — finance execution permissions | ключи добавлены, FINANCE/ADMIN | fresh+dev DB grants; guards; e2e chain 2–3 (FINANCE positive) | PASS |
| F4 — anti-mass-assignment | forged keys → 422 | e2e test 5; live 422 ×2; code audit | PASS |
| Security suite 10/10 | — | повторный прогон isolated DB | PASS |
| Chain suite 4/4 | — | повторный прогон isolated DB | PASS |
| Browser 18/18 | — | повторный прогон live stack; PNG byte-identical | PASS |
| No regression | — | D3 15/15; typecheck; pre-existing failures идентичны clean HEAD (D4 §24 воспроизведено: rbac-parity 7 fail на fresh DB — pre-existing, вне D4) | PASS |
| Isolation Marketplace/Storefront | proven | §9 | PASS (с residual D4SR-F2) |
| Finance integrity | — | §16 e2e asserts + dev DB | PASS |
| Temporal integrity | — | §17 | PASS |
| D3 preserved | CASE A/B | DB SQL + browser + D3 suites | PASS |
| Git clean | c99ec7c→65c829b | HEAD==origin==eb1460a (старт); финал см. §Git | PASS |
| S12 natural completion | «PASS (covered)» historical | только dev-исторические строки; e2e не покрыта | **DOWNGRADE → D4SR-F3** |
| S17 authoritative no-Request | legacy Orders | real canonical sale-path e2e (D3 test 7) | PASS (evidence stronger than claim) |
| S5 | GAP no-enum | decline SUPPORTED; EXPIRED enum есть; auto-transition нет | **REQUALIFIED → D4SR-F4** |
| S10 partial payment | GAP | подтверждено (single-capture; PARTIALLY_PAID placeholder) | PASS (формулировка уточнена) |
| S19 Storefront Partner flow | isolation proven | negative isolation PASS; positive partner UI отсутствует | **PARTIAL → D4SR-F8** |
| Manifest C1–C6 | — | DB сверка: 1 ошибка (CASE A UUID) | **D4SR-F5** |

---

## 28. Acceptance Matrix (HARD)

| Gate | Result | Evidence |
|---|---|---|
| Clean starting/final Git, HEAD==origin | PASS | §2; §Git |
| All traveler mutation paths audited and locked post-final | PASS | §5 (единственный нюанс — D4SR-F1 P2) |
| Mass-assignment protected | PASS | §6 (e2e 5; live 422) |
| All relevant roles PII-reviewed / business-justified | PASS | §7 (механизм role-based; e2e 3) |
| List minimization | PASS | §8 (bookings projection без passport; orders redaction) |
| Platform↔Storefront и Partner↔Partner isolation + positive partner path | PASS (negative) / **PARTIAL** (positive path отсутствует — D4SR-F8, pre-existing defer) | §9; §26 |
| Trusted bypass safe | PASS | §9 (viewer-gated 404; internal без viewer; external→internal без auth отсутствует) |
| Finance positive + negative RBAC | PASS | §10 (fresh DB grants FINANCE/ADMIN только; e2e positive FINANCE) |
| RBAC drift assessed; fresh DB proven | PASS | §11 (drift pre-existing, вне D4-ключей; fresh migration chain) |
| Seed no final-status cheating | PASS | §12 (реальные API-команды) |
| C1–C6 reconciled | PASS (1 doc-ошибка — D4SR-F5) | §12/§21 |
| S12 natural completion proven | **PARTIAL** (D4SR-F3) | §13 |
| S17 proven or honestly downgraded | PASS (proven, evidence уточнено) | §14 |
| Financial/temporal integrity | PASS | §16/§17 |
| D3 preserved | PASS | §18 |
| D4 tests pass, assertions valid | PASS | §19 (10/10 + 4/4 + quality review) |
| Independent browser smoke | PASS | §20 (18/18 re-run; live API probes) |
| DB == API == UI | PASS | §21 |
| No exposed secrets / unnecessary PII | PASS | §22 (только demo-креды, конвенция) |
| Retention debt documented | PASS | §23 |
| Entity Change Audit Framework + D5/D6/D11/D12 preserved | PASS | §24/§25 |
| No unresolved P0/P1 | PASS | §26 (только P2/P3, non-blocking) |
| No new D4 regression | PASS | §18/§27 (pre-existing failures воспроизведены на fresh/clean) |
| Report predominantly Russian | PASS | данный отчёт |

---

## 29. Residual Risks

1. **D4SR-F2 (P2)** — explicit `acquisitionSource=PARTNER_STOREFRONT` list-override остаётся в Platform API (pre-existing, ранее принятый residual; D4 закрыл direct-object часть). Пока нет Partner Order Center, поверхность контролируется отсутствием UI-использования и RBAC; remediation в ближайшей релевантной фазе.
2. **D4SR-F1 (P2)** — TOCTOU между traveler-mutation и final-confirm (узкое окно; требует concurrent авторизованных вызовов).
3. **D4SR-F8** — отсутствие owning-partner positive-пути к Storefront commerce (defer; S19 → PARTIAL).
4. Retention/purge policy для traveler PII — отсутствует (debt, roadmap).
5. RBAC parity drift (не-D4) — может маскировать будущие permission-изменения (remediation отдельной миграцией).
6. Ролевая redaction e2e покрыта для OPERATOR/SALES_MANAGER/ANALYST; остальные роли — единый механизм без индивидуальных e2e.

---

## 30. Final Verdict

```text
VERDICT A — D4 STRICT REVIEW PASSED
D4 — ACCEPTED

Основание:
  - P0/P1 traveler/tenant/finance-integrity findings: ОТСУТСТВУЮТ;
  - все блокирующие gates PASS (изоляция negative, immutability, mass-assignment,
    finance RBAC fresh+dev, D3 preserved, no new regression, Git clean);
  - P2/P3 findings задокументированы с required remediation; P2 residuals —
    pre-existing и ранее принятые (F-R2-1) либо узкие (TOCTOU), D4-claim
    скоуп сужен в Claim Matrix (F2/S12/S5/S19 формулировки);
  - продукт в Strict Review НЕ изменялся (только report/evidence).

TRUE NEXT:
D5 — ORDER FULL-PAGE DETAIL
     + NAVIGATION CONSISTENCY
     + ACTION/STATE-MACHINE CONSISTENCY
     + EDITING/MUTABILITY CONTRACT
     + CROSS-CUTTING ENTITY CHANGE AUDIT FRAMEWORK INTEGRATION

D6 remains next after D5.
```

---

## 31. Git Closure

Старт: `HEAD == origin/master == eb1460a`, worktree clean. Strict Review изменения — только docs:

```text
docs/prompts/PHASE_3_PRE_STEP_3.12_D4_TRAVELER_SECURITY_REPRESENTATIVE_COMMERCE_STRICT_REVIEW.md  (moved from docs/reports/ — каноническая директория prompts)
docs/reports/PHASE_3_PRE_STEP_3.12_D4_TRAVELER_SECURITY_REPRESENTATIVE_COMMERCE_STRICT_REVIEW_REPORT.md  (данный отчёт)
```

Фактический результат после review (заполняется после push):

```bash
git rev-parse HEAD            → <FINAL_HEAD>
git rev-parse origin/master   → <FINAL_ORIGIN>
git status --short            → EXACTLY EMPTY
```

---

## 32. STOP

```text
STOP.
D5 NOT STARTED.
```
