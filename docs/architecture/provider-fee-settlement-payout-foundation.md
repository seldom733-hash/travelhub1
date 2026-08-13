# PHASE 2 — Step 2.10B — Provider Fee / Settlement / Payout Foundation

Статус: **STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES** (2026-08-14).
Baseline: `master` @ `147d4fa` (v0.17.0), Roadmap 2.10/2.10A APPROVED, 2.10B NEXT.
Отчёт: `docs/prompts/PHASE_2_STEP_2.10B_PROVIDER_FEE_SETTLEMENT_PAYOUT_FOUNDATION_STRICT_REVIEW.md`.

## 1. Ownership boundary

`finance.*` — Finance-owned. ProviderFee / Settlement / Payout создаются
**только** внутренним `SettlementService` (единственный canonical creation
path). Публичного POST нет; PATCH/DELETE маршрутов нет → 404. Read —
Finance Center view для staff (`finance.provider_fee.read` /
`finance.settlement.read` / `finance.payout.read`).

Write-path audit (Step 2.10B):
- ровно 3 production writers: `tx.providerFee.create`, `tx.settlement.create`,
  `tx.payout.create` — все в `settlement.service.ts`;
- zero update/delete/upsert/raw SQL/seed/job для новых моделей;
- zero ссылок вне `src/modules/finance`;
- LedgerTransaction: **новых writers нет** — единственный ledger writer
  остаётся `LedgerService` (2.10A append-only не нарушен; e2e #9).

## 2. Domain semantics (Screen Design)

- **ProviderFee** — immutable факт комиссии внешнего провайдера (PSP/bank),
  ОТДЕЛЬНО от TravelHub Commission (2.12C/E). Не вычисляется «по проценту»
  без canonical source fact. `providerRef` — провенанс, НЕ PSP-интеграция.
- **Settlement** — durable факт сведения денежных обязательств. Без
  balance/net-payable/periods/status (lifecycle/engine — будущие шаги).
- **Payout** — операционная запись выплаты Partner (bank rail). Без реальных
  PSP calls, bank credentials/PII, Stripe Connect assumptions.
- Payment Buyer и Payout Partner — разные rails (НЕ связываются; e2e #10).

## 3. Schema (`finance.*`, additive migration)

`20260813140508_add_provider_fee_settlement_payout_foundation` — 3 таблицы,
6 unique-индексов, 0 ALTER (чисто аддитивная; replay-proof):

- `ProviderFee`: `code PFE-*` UNIQUE, `provider`, `amount DECIMAL(12,2) > 0`,
  `currency` (ISO 4217 снапшот против `finance.Currency`, без FK),
  `providerRef?`, `sourceType/sourceId` (provenance),
  `correlationId/causationId/actorType/actorId` (ADR-0010), `createdAt` UTC,
  **НЕТ `updatedAt`** (immutable fact), `@@unique([sourceType, sourceId, provider])`.
- `Settlement`: `code STL-*` UNIQUE, `amount`, `currency`, `sourceType/sourceId`,
  correlation/causation/actor, `createdAt` UTC, НЕТ `updatedAt`,
  `@@unique([sourceType, sourceId])`.
- `Payout`: `code POT-*` UNIQUE, `amount`, `currency`, `providerRef?`,
  `sourceType/sourceId`, correlation/causation/actor, `createdAt` UTC,
  НЕТ `updatedAt`, `@@unique([sourceType, sourceId])`.

Никаких FK между схемами; никаких PSP-колонок, bank details, milestones,
Settlement↔Payout связи (e2e #10).

## 4. Money / currency contract

- Никогда float: `Prisma.Decimal` DECIMAL(12,2); API — Decimal-строки.
- `amount > 0`, ≤2 знака (валидация `validateLedgerAmount`, unit-покрыта).
- `currency` — ISO 4217 3-буквенный код, **обязательно** зарегистрирован в
  `finance.Currency` (иначе controlled 422) — снапшот durable (переживает
  деактивацию/переименование валюты).

## 5. Idempotency / concurrency

- DB-unique инвариант: ProviderFee `(sourceType, sourceId, provider)`;
  Settlement/Payout `(sourceType, sourceId)`.
- `SettlementService.idempotentCreate` (конвенция Ledger 2.10A STRICT REVIEW
  FIX 1): identical replay → существующий факт (no-op); divergent payload
  (amount/currency/providerRef) → **controlled 409**; неизвестный P2002 →
  controlled conflict; non-P2002 → rethrow. Raw 500 = 0 (e2e #6, #7, #7b:
  concurrent duplicate → одна запись, проигравший divergent — 409, без 500).
- `IdsService.nextCode` (PFE-/STL-/POT-) в той же transaction, что и create —
  атомарно, без дубликатов.

### 5.1 Будущая эволюция idempotency-ключей (foundation = консервативный инвариант)

Ключи 2.10B — **консервативные foundation-инварианты** при нуле producer-ов
(таблицы пусты, единственный writer — внутренний SettlementService). Это НЕ
заморозка будущих producer-семантик: эволюция ключей — аддитивная и безопасная
(swap unique-constraint на пустой таблице, 0 строк миграции данных):

- **ProviderFee** `(sourceType, sourceId, provider)`: Roadmap 2.12G определяет
  processing/FX/cross-border/payout fees как «отдельные факты». Если будущий
  producer (2.12G) зафиксирует НЕСКОЛЬКО fee-фактов одного провайдера на одном
  source-факте (напр. processing + FX на одном Payment) — добавляется
  discriminator (напр. nullable `feeType`/`type`, как `LedgerTransaction.type`)
  и ключ расширяется до `(sourceType, sourceId, provider, feeType)`;
  альтернатива — granularity sourceId на уровне конкретного fee-факта
  провайдера (выбор — за 2.12G, не фиксируется здесь).
- **Settlement** `(sourceType, sourceId)`: Roadmap 2.14A (Settlement Engine)
  определит, является ли settlement результатом пересчёта/перевыставления для
  одного source-агрегата (тогда добавляется версия/результат-discriminator).
  До producer-шага инвариант «один settlement на source» предотвращает
  дубликаты-факты без fabricated state.
- **Payout** `(sourceType, sourceId)`: Roadmap 2.10C вводит payout-milestones
  (`failedAt` и др.) — ретраи/замена неудачной попытки и split/multi-currency
  payouts (один Settlement → N Payout) являются будущей легитимной семантикой
  2.14B/2.14D. Тогда ключ эволюционирует (attempt/sequence/rail discriminator
  + status lifecycle в 2.14B). Здесь lifecycle/status НЕ фабрикуются (нет
  canonical vocabulary), поэтому foundation фиксирует факт «одна выплата на
  source» и честно документирует точку расширения.

## 6. Correlation / provenance

`correlationId/causationId/actorType/actorId` — server-authoritative из
request context (ADR-0010); HTTP не может подделать (e2e #8). Вне контекста
— NULL.

## 7. RBAC

- `finance.provider_fee.read` / `finance.settlement.read` / `finance.payout.read`
  — FINANCE/DIRECTOR/ANALYST/ADMIN (auto-seed, проверено).
- BUYER/PARTNER/OPERATOR/SALES_MANAGER/MODERATOR/MARKETER → 403;
  anonymous → 401 (e2e #1/#2). Write-права нет; write-surface отсутствует.

## 8. Events / ledger

- 0 доменных событий (нет consumer-ов; registry не расширен).
- LedgerTransaction НЕ пишется из этих фактов: ledger-автопостинг —
  отдельный canonical engine (2.12+), здесь НЕ реализуется (e2e #9:
  ledger count неизменен).
- AuditLog: `finance.provider_fee.created` / `finance.settlement.created` /
  `finance.payout.created` — minimal metadata `{ code }`, без PII.

## 9. Deferred (не реализовано)

Payment runtime, PSP integration, TravelHub Commission (2.12C/E), Settlement
lifecycle/engine/statuses, Payout lifecycle/statuses/rail, milestones
(2.10C), temporal contract (2.10C), balance/double-entry, events.

## 10. Tests

- e2e `provider-fee-settlement-payout-foundation` 11/11: RBAC/401/404,
  Decimal/currency/provenance, filters/pagination, amount validation,
  idempotency (identical → no-op, divergent → 409), concurrent duplicate,
  correlation server-authoritative, zero cross-domain mutations + zero ledger
  autoposting, no runtime Payment/PSP/milestones/link, migration fresh-replay.
- Unit: money/validation helpers (finance.validation.spec.ts).
