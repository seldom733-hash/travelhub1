# Ledger Transaction Foundation (Phase 2 Step 2.10A)

## 1. Purpose

Immutable append-only `LedgerTransaction` foundation (Roadmap 2.10A:
«Append-only LedgerTransaction. Финансовая история не восстанавливается из
текущего Payment status»). Ledger — immutable record of financial facts, не
mutable operational object. НЕ Payment/PSP/Refund/Settlement/Payout/Commission
engine (2.12+/2.10B deferred).

## 2. Ownership

Finance — единственный owner ledger-записей. Order/Booking/Sales/Availability/
Catalog НЕ пишут ledger; Finance НЕ пишет в их таблицы. Cross-domain
interaction в будущем — только через canonical facts/events/contracts.
Write-path audit: ровно **1 production writer** (`LedgerService.create`),
0 update/updateMany/delete/deleteMany/raw SQL, 0 ссылок вне finance-модуля.

## 3. Model

`finance.LedgerTransaction`: id (UUID), code (`LTX-########`, unique), amount
(Decimal 12,2 > 0), currency (ISO 4217 снапшот), type (String classification;
словарь значений приходит с producer-шагом 2.12+), sourceType, sourceId,
sourceEventId? (provenance-only), businessRef?, correlationId?, causationId?,
actorType?, actorId?, createdAt (сервер-owned UTC). **Нет `updatedAt`**
(намеренно, append-only), нет version (нет мутации).

## 4. Immutable fields

После create неизменяемы: amount, currency, type, sourceType, sourceId,
sourceEventId, businessRef, correlationId, causationId, actorType, actorId.
Нет PATCH/DELETE/update-путей; исправление финансового факта в будущем —
только новый compensating/reversal факт (отдельный одобренный шаг; в 2.10A
reversal НЕ выдумывается).

## 5. Money / Decimal

`amount > 0`, DECIMAL(12,2) платформенный money-контракт (как
sales.money/finance.money), строковый Decimal на API, никакого float как
authority. `validateLedgerAmount`: >0, ≤2 знака. Экономический смысл несёт
`type` (не знак суммы).

## 6. Identifier

`LTX-########` через канонический `IdsService.nextCode` (атомарный upsert
счётчика events.BusinessSequence) в той же transaction, что и create. DB
unique на code. `ids.md` обновлён (LTX- из reserved → зарегистрирован).

## 7. Creation authority

Внутренний Finance service (`LedgerService.create`) — единственный canonical
path; публичного POST нет (§13 option A: Roadmap не требует manual journal
API). Вызывается будущими producer-шагами (2.12+). Read — минимальный
Finance Center ledger view.

## 8. Idempotency

DB-backed invariant `@@unique([sourceType, sourceId, type])`: replay одного
canonical source fact → существующий факт (детерминированный no-op, тот же
code/id); конкурентный duplicate — одна запись. **First-write-wins + payload-
верификация (STRICT REVIEW FIX 1):** при совпадении ключа сервис сравнивает
immutable факт-поля (amount/currency/sourceEventId/businessRef) — идентичные →
no-op (истинный replay), расходящиеся → controlled 409 (producer-баг/другое
событие НЕ маскируется молчаливым возвратом существующего). Неизвестный P2002
(например `LTX_code_key` collision) — controlled ConflictError, НЕ raw 500, НЕ
маскируется. Инвариант расширяем без destructive (additive-релаксация unique
constraint допустима при будущем multi-capture-сценарии — каждый capture обычно
отдельный Payment/sourceId).

## 9. Concurrency

Параллельные create одного факта: DB unique решает; `isUniqueViolation` +
`uniqueConstraintNames` → возврат существующего факта. Raw 500 = 0, partial
rows = 0, code не дублируется (доказано e2e #9/#10).

## 10. Transaction atomicity

В одной `$transaction`: LTX-аллокация + create + AuditLog
(`finance.ledger_transaction.created`, details `{ code }`, без PII). Нет
«code allocated, row missing» / «row exists, provenance missing».

## 11. Provenance

sourceType/sourceId (canonical refs, без mutable dump Order/Booking/Payment),
sourceEventId (provenance-only), businessRef (опциональный human-readable код,
не заменяет sourceId). PII не копируется.

## 12. Correlation/causation

Server-authoritative из request context (ADR-0010): HTTP path — correlation =
request UUID, causation = null, actor из JWT; consumer path — наследуется,
causation = source event id (в будущем). Отдельного disconnected correlation
внутри сервиса нет; вне HTTP-контекста — NULL (legacy unknown, без fake
backfill; доказано e2e #11/#12).

## 13. RBAC

`finance.ledger.read` (новое право, auto-seed через SecurityService) —
FINANCE/DIRECTOR/ANALYST/ADMIN; BUYER/PARTNER/OPERATOR/SALES_MANAGER/
MODERATOR/MARKETER → 403; anonymous → 401. Write-права нет (нет write API).
DIRECTOR — read-only, без write (доказано e2e #2).

## 14. Audit

AuditLog — кто/что/когда (security audit), LedgerTransaction — immutable
финансовый факт. Не смешиваются: ledger не хранит security audit dump;
AuditLog не заменяет ledger.

## 15. Event boundary

0 Finance business events в 2.10A (нет consumer-ов/канонического контракта;
events.md задокументировано). Будущее событие — ADR-0010 envelope + outbox/
inbox + correlation/causation.

## 16. Payment boundary

2.10A НЕ создаёт Payment, не меняет статус, не authorize/capture, не
принимает webhooks, не трогает `Order.paymentStatus`/`paidAmount`/`paidAt`.
Schema-only Payment остаётся schema-only (доказано e2e #14).

## 17. PaymentTerms boundary

Frozen terms `Quote → CheckoutIntent → Sale → OrderRequested → Order` (2.3B)
остаются authoritative; Finance PaymentTerms не становится source of truth;
материализация/recalculation НЕ выполняются.

## 18. Refund boundary

Нет Refund create/approval/PSP/auto-refund/cancellation→refund/refundedAt/
refund ledger posting (2.13 deferred).

## 19. Commission boundary

Нет расчёта/accrual/recognition/percentage/basis/partner payable/invoice
linkage/settlement posting (2.12C/E deferred).

## 20. Settlement/Payout boundary

Нет ProviderFee/Settlement/Payout/payable balances/provider reconciliation/
clearing (2.10B deferred).

## 21. Temporal boundary

**Эволюция (Step 2.10C, Finance Temporal Contract):** `LedgerTransaction`
легитимно получил `occurredAt` — бизнес-occurrence время факта (UTC),
ОТДЕЛЬНО от `createdAt` (персистенция). NULL = время наступления неизвестно
(legacy / producer не передал; без fabricated backfill). Authority:
server-валидированный ISO 8601 (для event-порождённых фактов 2.12+ —
`occurredAt` канонического события); malformed/impossible → ValidationDomainError
(никогда не становится authority). НЕ входит в replay payload-сравнение
(first-write-wins — идентичный логический replay не расходится из-за более
позднего retry, §16 2.10C). Детали —
`docs/architecture/finance-temporal-contract.md`.

По-прежнему НЕТ `authorizedAt/capturedAt/paidAt/refundedAt/settledAt/
payoutRequestedAt` — payment/lifecycle milestone-колонки не вводятся
(deferred 2.12–2.14; доказано e2e #15: колонки отсутствуют). `createdAt` —
время факта ledger-записи (персистенция), не payment milestone.

## 22. Legacy compatibility

Нет fabricated opening ledger-фактов для legacy Order/Booking/Sale/
CheckoutIntents; legacy rows остаются без выдуманной финансовой истории
(доказано e2e #17). Аддитивная миграция без backfill.

## 23. Migration

`2026…_add_ledger_transaction_foundation` — чисто аддитивная: новая таблица
`finance.LedgerTransaction` + code unique + idempotency unique
(sourceType, sourceId, type) + индексы (sourceType/sourceId, createdAt);
0 ALTER существующих таблиц; 0 db push; replay-safe (e2e globalSetup
drop+recreate + migrate deploy реальных миграций).

## 24. Explicit deferred items

Double-entry/account chart/GL/debit-credit/balances (available/pending) —
НЕ в 2.10A (без канонического контракта, §8/§34 stop-conditions); reversal/
void workflow; FX conversion (rate snapshot policy — 2.12+); tax postings;
commission postings; settlement/payout; Finance Center frontend; ledger
events; manual accounting journal.
