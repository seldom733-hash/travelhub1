# PHASE 2 — STEP 2.10C — FINANCE TEMPORAL CONTRACT — IMPLEMENTATION REPORT

**Verdict:** `PHASE 2 STEP 2.10C IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`
**Date:** 2026-08-14
**NEXT:** `PHASE 2 — STEP 2.10C — STRICT REVIEW` (НЕ выполняется в этом проходе)

---

## 1. Verdict

**`PHASE 2 STEP 2.10C IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`**

Step 2.10C реализован консервативно: из всего Roadmap-визиона temporal
милстоунов обоснован и реализован РОВНО ОДИН — `LedgerTransaction.occurredAt`
(единственный факт, чей агрегат, producer и authority уже каноничны в 2.10A).
Все payment/refund/settlement/payout милстоуны признаны DEFERRED
(stop-conditions §39: нет producer-а/разрешённой семантики — не выдумываются).
0 архитектурных блокеров. 0 новых доменных событий. Миграция аддитивная,
replay-proof, без backfill. Регрессия полная и зелёная.

## 2. Repository baseline

- branch: `master`; HEAD: совпадает с origin/master (без новых коммитов в этом
  проходе; изменения только в working tree).
- Dirty на старте: изменения schema.prisma/ledger.service/finance.validation/
  тестов + untracked миграция и prompt-файл (наследие начатого прохода).
- Миграции: **50** каталогов (включая новую `20260814090000_add_ledger_occurred_at`);
  dev-БД `travelhub1` до прохода 49/49 → **50/50** после `migrate deploy`, drift 0.
- Backend unit baseline 495/495 → **497/497**; serial e2e baseline 1055/1055 →
  **1057/1057** (59 suites); frontend 135/135 (без изменений фронта).
- Roadmap: 2.10/2.10A APPROVED, 2.10B APPROVED WITH REVIEW FIXES, 2.10C был
  не начат (описание визиона), NEXT после 2.10B = 2.10C. Не относящиеся к
  шагу изменения не производились.

## 3. Sources inspected

Roadmap v3; 2.10/2.10A/2.10B implementation + strict-review артефакты
(промпты, отчёты, review-отчёты); 2.9A Booking Temporal Contract (структурный
прецедент); `schema.prisma` (finance.* модели); все finance-миграции;
`finance.validation.ts`/`finance.controller.ts`/`finance.service.ts`;
`ledger.service.ts`; `settlement.service.ts`; `permissions.constants.ts`;
`security.service.ts` (seeding); `ids.service.ts`/`ids.md`; `finance.money.ts`;
`docs/contracts/api.md`/`events.md`/`ids.md`; `docs/architecture/*` (finance-
domain-foundation, ledger-transaction-foundation, provider-fee-settlement-
payout-foundation, temporal-readiness, booking-temporal-contract,
order-temporal-contract); e2e `finance-domain-foundation`,
`ledger-transaction-foundation`, `provider-fee-settlement-payout-foundation`,
`temporal-readiness`, `phase2-entry-audit`; e2e harness (global-setup/env/db-config).

## 4. Current → Target reconciliation

| Модель | Текущее (до 2.10C) | Целевое (2.10C) |
|---|---|---|
| LedgerTransaction | createdAt = время факта (персистенция); милстоуны deferred | **+ occurredAt** (бизнес-occurrence) |
| Payment/Refund/Invoice/Commission(Accrual) | schema-only, createdAt | без изменений (милстоуны 2.12–2.14) |
| ProviderFee/Settlement/Payout | immutable факты 2.10B, createdAt | без изменений (милстоуны 2.14A/2.14B) |
| Currency/ExchangeRate/Tax/TaxRule | master data | без изменений |

## 5. Finance entity classification

1. master/reference: Currency, ExchangeRate, Tax, TaxRule, PaymentTerms;
2. immutable financial fact: **LedgerTransaction** (2.10A), ProviderFee,
   Settlement, Payout (2.10B);
3. future mutable lifecycle aggregate: Payment, Refund, Invoice;
4. ledger/history fact: LedgerTransaction (append-only, без balances);
5. future runtime model без producer-а: Commission, CommissionAccrual.

## 6. Temporal vocabulary audit

Каждый кандидат Roadmap (§5 2.10C) проверен по 14 вопросам:
authorizedAt/capturedAt/paidAt/failedAt/cancelledAt (Payment) — нет агрегата/
перехода/authority → **DEFER 2.12**; refundedAt/requestedAt/approvedAt/
processedAt (Refund) → **DEFER 2.13**; issuedAt/dueAt (Invoice) → **DEFER 2.14**;
accruedAt (Commission) → **DEFER 2.12C/E** (stop-condition: recognition policy);
eligibleAt/calculatedAt/settledAt (Settlement) → **DEFER 2.14A** (stop-condition:
settlement version); scheduledAt/processingAt/paidAt/failedAt (Payout) →
**DEFER 2.14B** (stop-condition: payout attempt); occurredAt (Ledger) — агрегат,
producer и authority каноничны → **IMPLEMENTED**. Ни одно поле не добавлено
«на всякий случай».

## 7. Implemented milestones

Единственное: `LedgerTransaction.occurredAt` — бизнес-occurrence время факта
(UTC instant). NULL = неизвестно (legacy/producer не передал). Authority —
server-валидированный ISO 8601 (для event-порождённых фактов 2.12+ —
occurredAt канонического события). First-only.

## 8. Deferred milestones

Все прочие (см. §6) — задокументированы в `finance-temporal-contract.md`
(§4/§6) и в Roadmap как визион 2.12–2.14. В schema НЕ введены. Обязательства
будущих producer-шагов — §24 арх-дока.

## 9. Technical time vs business time

`createdAt` = персистенция (на Ledger — immutable время записи факта);
`occurredAt` = бизнес-occurrence, отдельно; `updatedAt` у Ledger отсутствует
(append-only) и нигде не используется как милстоун; Outbox occurredAt =
время события по event-контракту (для 2.12+ — authority для event-borne
ledger фактов); provider timestamps не принимаются (нет PSP-контракта).

## 10. Ownership

`occurredAt` пишет ТОЛЬКО `LedgerService.create` (единственный canonical
writer 2.10A). Cross-domain запись запрещена и не реализована (Order/Booking/
Sales/фронт не пишут Finance милстоуны; LedgerService не мутирует Payment/
Settlement/Payout).

## 11. Canonical occurrence authority

`validateOccurredAt(value: string|null|undefined): Date|null`:
- `null/undefined` → `null` (unknown, без fabrication);
- валидный ISO 8601 UTC → `Date` (хранится как UTC TIMESTAMP(3));
- malformed/impossible (`"abc"`, `""`, `2026-13-01`, hour 25, не-строка) →
  `ValidationDomainError` (controlled 422), никогда не authority.
Provider time не принимается (нет контракта — §14 2.10C не требует).

## 12. Schema changes

Одна аддитивная nullable-колонка: `LedgerTransaction.occurredAt DateTime?`
(комментарий в schema.prisma фиксирует семантику: отдельно от createdAt,
NULL = unknown, authority server-валидированный ISO, только LedgerService,
immutable, identical replay → существующий факт). Без `@default(now())`.

## 13. Migration

`20260814090000_add_ledger_occurred_at`:
`ALTER TABLE "finance"."LedgerTransaction" ADD COLUMN "occurredAt" TIMESTAMP(3);`
Чисто аддитивная, 0 destructive ALTER, 0 `db push`. Fresh replay доказан
e2e globalSetup (drop + recreate + `migrate deploy` реальных миграций);
dev-БД 50/50, `migrate status` = up to date (drift 0).

## 14. Backfill policy

**Нет backfill.** Время наступления исторических фактов неизвестно —
честный NULL. Источник exact timestamps отсутствует (гейт §6/§14 2.10C).
NULL предпочтительнее ложной исторической точности.

## 15. First-only semantics

Idempotency key `@@unique(sourceType, sourceId, type)` (2.10A) сохранён:
identical replay возвращает существующий факт. `occurredAt` **исключён из
replay payload-сравнения** (retry позже не расходится с первым вхождением —
§16 2.10C; e2e 3C: первое occurrence сохраняется). Divergent immutable payload
→ 409 (FIX 1 2.10A не тронут).

## 16. Atomicity

Факт + occurredAt + audit пишутся одним `create` в одной транзакции. Для
будущих producer-шагов (2.12–2.14) задокументирована обязанность
«transition + milestone + history/outbox атомарно» — не изобреталась сейчас.

## 17. Idempotency

Инварианты 2.10A (no-op replay, controlled 409 для divergent/unknown P2002) и
2.10B (без изменений — милстоуны не добавлены) сохранены. occurredAt вне
replay-сравнения (см. §15) — точное требование §16 2.10C.

## 18. Concurrency

Конкурентные duplicate-создания на idempotency key — один факт, остальные
получают существующий (e2e 2.10A concurrency, теперь и с occurredAt);
без raw 500, без overwrite. Новых lifecycle-гонок не создано (lifecycle не
вводился).

## 19. Temporal ordering

Глобальной цепочки Finance-времён нет. Известное: occurredAt ≤ createdAt
(occurrence до персистенции; семантически верно, НЕ закодировано DB-
констрейнтом — producer/server clock skew легитимен). Deferred (2.12–2.14):
authorizedAt ≤ capturedAt ≤ paidAt; refund occurrence ≥ payment occurrence;
settlement ≥ payment — задокументированы, не закодированы.

## 20. Mass assignment

Публичного write-пути у LedgerTransaction нет вообще (POST/PATCH/DELETE →
404). `occurredAt` отсутствует во всех клиентских DTO. Конвенция loud
rejection (`assertNoForbiddenKeys` → 422) сохранена для master-data;
occurredAt недоступен для forge по построению.

## 21. RBAC

Новых прав нет (нет `finance.temporal.write`/`finance.milestone.manage`).
Read — существующий контракт `finance.ledger.read` (FINANCE/DIRECTOR/ANALYST/
ADMIN); BUYER/PARTNER/... → 403; anonymous → 401. occurredAt — часть read-
модели ledger для этих ролей.

## 22. API contract

`docs/contracts/api.md` обновлён (Finance — LedgerTransaction): occurredAt —
`string|null`, UTC ISO 8601, nullable (NULL = unknown legacy), server-owned,
смысл «время наступления факта, отдельно от createdAt», immutable,
malformed → 422. Deferred милстоуны НЕ экспонируются.

## 23. Event contract

**0 новых событий** (§22 2.10C). Audit `finance.ledger_transaction.created`
не изменён (минимальные метаданные, без PII). ADR-0010 не затронут.
`docs/contracts/events.md` изменений не требует (Ledger-события по-прежнему
отсутствуют — нет consumer-ов).

## 24. Ledger boundary

2.10A инварианты доказаны без изменений: один writer (LedgerService), append-
only, 0 auto-posting, 0 balance/double-entry. occurredAt — данные факта, не
триггер постинга.

## 25. ProviderFee boundary

ProviderFee ≠ Commission; immutable факт без status; idempotency 2.10B без
изменений; 0 новых полей. Эволюция fee-type discriminator — 2.12G (не
пре-реализована).

## 26. Settlement boundary

Settlement ≠ Payout; immutable; 0 милстоунов/lifecycle; idempotency
sourceType+sourceId без изменений. Version-семантика — 2.14A (deferred).

## 27. Payout boundary

Payout immutable foundation; 0 милстоунов/status; idempotency без изменений.
Attempt-семантика — 2.14B (deferred).

## 28. Payment/Refund/Invoice/Commission boundary

Никакого runtime-поведения: 0 PSP, 0 authorize/capture, 0 refund/invoice/
commission engines, 0 status-словаря, 0 милстоунов. Write-пути по-прежнему
404. Schema не тронута.

## 29. Legacy compatibility

Существующие строки читаемы; новое поле NULL у legacy-фактов; add-on
nullable не ломает старых API-consumers (e2e 17: legacy rows читаемы;
e2e 3B: NULL occurredAt).

## 30. PII/secrets

0 новых PII/секретов: occurredAt — время, без bank/card/PSP/token/passport
данных. AuditLog — только код факта (без изменений).

## 31. Write-path audit

- canonical writer: `LedgerService.create` (ledger.service.ts) — 1;
- canonical consumer: Finance ledger read (`toLedgerDto` → controller) — 1;
- migration/backfill: 0 (без backfill);
- test fixture: `createLedgerFact` (e2e-helper), unit validation spec;
- unsafe/obsolete writer: **0**.
Deferred милстоуны: 0 production writers (корректно).

## 32. Negative coverage

1. anonymous → 401 (существующий RBAC e2e); 2. unauthorized → 403 (сущ.);
3. unknown → 404 (сущ.); 4. forged server-owned → 422 (сущ. master-data);
5. client не может overwrite milestone (нет write-путей → 404);
6. replay не перезаписывает первое occurrence — **e2e 3C (новый)**;
7. legacy NULL не фабрикуется — **e2e 3B** (NULL occurredAt);
8. malformed timestamp не становится authority — **e2e 3B** (not-a-date,
   month 13 → reject, 0 строк создано) + unit;
9–10. updatedAt/AuditLog не используются как бизнес-время — 0 кода-источника
   (проектная инвариантность, e2e 15: только occurredAt/createdAt на Ledger);
11. Ledger createdAt не копируется в чужие милстоуны — структ. невозможно
   (чужих милстоунов нет);
12. нет скрытого ledger-автопостинга — e2e 14 (ноль cross-domain мутаций);
13. нет Order/Booking/Sales/Reverse мутаций — e2e 14;
14. ProviderFee/Settlement/Payout immutability — 2.10B e2e без изменений;
15. нет преждевременных status/lifecycle-роутов — e2e #7 (404) + #11
   (колонок нет);
16. 0 новых событий без consumer-а — events.md не изменён;
17. нет raw 500 при replay/concurrency — 2.10A e2e (без изменений);
18. миграция не бэкфиллит unknown — миграция SQL (ADD COLUMN только),
   e2e 3B legacy NULL.

## 33. Positive coverage

1. read возвращает occurredAt со стабильной формой — e2e 3B (DTO ISO с Z);
2. милстоун — UTC instant — e2e 3B (ISO + DB TIMESTAMP match);
3. первое canonical occurrence ставится ровно один раз — e2e 3C;
4. identical replay сохраняет его — e2e 3C (count = 1, первый occurredAt);
5. поздний unrelated update сохраняет (append-only: update нет);
6. legacy row → NULL — e2e 3B;
7. canonical event occurrence time сохраняется (authority для 2.12+) —
   задокументировано (арх-док §9); runtime-событий нет;
8. concurrency — один truthful first occurrence (2.10A e2e, без изменений);
9. master-data CRUD работает — finance e2e 1–9 (без изменений);
10. Ledger 2.10A регрессии зелёные — ledger e2e 20/20;
11. ProviderFee/Settlement/Payout 2.10B регрессии зелёные — 13/13;
12. Order/Booking temporal-контракты не затронуты — полный serial e2e.

## 34. Unit tests

`finance.validation.spec.ts` +2: validateOccurredAt — валидные ISO/UTC
(в т.ч. без миллисекунд), null/undefined → null, malformed/impossible
(`"abc"`, `""`, month 13, hour 25, non-string) → ValidationDomainError.
Итого unit 497/497 (было 495).

## 35. Backend regression

- `tsc --noEmit` — PASS;
- unit — **497/497** (42 suites);
- target e2e finance/ledger/temporal/provider-fee — PASS;
- полный serial e2e — **1057/1057, 59 suites** (baseline 1055, +2 новые:
  e2e 3B, 3C; тест 15 эволюционирован).

## 36. Frontend regression

Фронт не изменён (git diff — 0 frontend файлов), но по требованию прогнано:
`tsc --noEmit` — PASS; Vitest — **135/135 (23 files)**; `next build`
(production) — PASS.

## 37. DB regression

- миграции: **50/50** применены (dev `travelhub1`), `migrate status` up to date;
- fresh replay: e2e globalSetup drop+recreate + `migrate deploy` реальных
  миграций — PASS (все e2e стартуют на пересозданной БД);
- drift: 0 (status + schema согласованы; миграция аддитивная, generate
  выполнен в рамках сборки/тестов).

## 38. Issues found

1. **E2E 3B flaky/некорректная метка времени:** тест использовал
   `t0 = 2026-08-14T10:00:00Z` — будущее относительно машинного времени
   прогона → инвариант `occurredAt <= createdAt` ломался. Не баг реализации,
   а баг теста.
2. temporal-тесты (finance #11) содержали комментарий «2.10C deferred»,
   требовавший эволюции после реализации 2.10C (§28).

## 39. Fixes applied

1. E2E 3B: `t0` заменено на `2026-08-01T10:00:00.000Z` (прошлое относительно
   прогона) с поясняющим комментарием; инвариант `occurredAt ≤ createdAt`
   сохранён и теперь стабилен на любых часах.
2. finance-domain-foundation e2e #11 эволюционирован (§28): различает
   легитимно введённое 2.10C поле (`occurredAt` существует ТОЛЬКО на
   LedgerTransaction) и всё ещё запрещённые lifecycle-милстоуны
   (paidAt/authorizedAt/capturedAt/failedAt/cancelledAt/settledAt = 0 колонок
   по всей finance-схеме). Ledger e2e #15 переформулирован аналогично.

## 40. Architecture decision status

Архитектурных блокеров НЕТ (все stop-conditions отрицательны либо
переведены в явный DEFER): accrual recognition (2.12C/E), settlement version
(2.14A), payout attempt (2.14B) — задокументированы как deferred, не
угаданы. Отдельный ARCHITECTURE DECISION REQUIRED не требуется.

## 41. Deferred work

Все payment/refund/invoice/commission/settlement/payout милстоуны +
producer-шаги 2.12–2.14; ledger-автопостинг; balances/double-entry; события
Finance; Finance Center frontend; FX/tax engine.

## 42. Out-of-scope confirmation

Не реализовано: Payment PSP runtime, authorize/capture, Refund/Invoice/
Commission engines, double-entry/chart/balances, auto-posting, provider
reconciliation, Settlement lifecycle/versioning, Payout attempts, bank rails,
Finance frontend, 2.12+ функциональность, 2.17 hardening, несвязанные
рефакторинги.

## 43. Exact files changed

Backend:
- `backend/prisma/schema.prisma` — `LedgerTransaction.occurredAt DateTime?` (+док);
- `backend/prisma/migrations/20260814090000_add_ledger_occurred_at/migration.sql` — новый;
- `backend/src/modules/finance/finance.validation.ts` — `validateOccurredAt`;
- `backend/src/modules/finance/finance.validation.spec.ts` — unit +2;
- `backend/src/modules/finance/ledger.service.ts` — `LedgerCreateInput.occurredAt`,
  валидация, create, replay-сравнение без occurredAt, DTO;
- `backend/test/ledger-transaction-foundation.e2e-spec.ts` — e2e 3B/3C новые,
  #15 эволюционирован, фикс t0;
- `backend/test/finance-domain-foundation.e2e-spec.ts` — #11 эволюционирован.

Docs:
- `docs/architecture/finance-temporal-contract.md` — НОВЫЙ (25 секций);
- `docs/architecture/ledger-transaction-foundation.md` — §21 temporal evolution;
- `docs/architecture/temporal-readiness.md` — source-of-truth row (occurredAt);
- `docs/contracts/api.md` — Ledger read-модель + occurredAt контракт;
- `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md` — статус 2.10C;
- `docs/prompts/PHASE_2_STEP_2.10C_FINANCE_TEMPORAL_CONTRACT_IMPLEMENTATION.md` —
  prompt-файл (был untracked).

Не тронуты: `docs/contracts/events.md`, `docs/contracts/ids.md` (0 новых
событий; идентификаторы не изменились), frontend (0 файлов).

## 44. Roadmap update

Step 2.10C → `🚧 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW
(2026-08-14)` (с кратким саммари реализации). Визион будущих милстоунов
сохранён и явно помечен как producer-шаги 2.12–2.14, НЕ реализованные в 2.10C.

## 45. Exact NEXT item

`PHASE 2 — STEP 2.10C — STRICT REVIEW` — отдельный adversarial-промпт;
в этом проходе НЕ выполняется (hard stop §41/§43 соблюдён).
