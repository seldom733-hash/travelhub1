# PHASE 2 — STEP 2.10A — LEDGER TRANSACTION FOUNDATION — STRICT REVIEW REPORT

## 1. Verdict
**`PHASE 2 STEP 2.10A STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`**

Независимая adversarial-проверка по фактическому коду, SQL-миграции и runtime:
найден и исправлен **1 подтверждённый дефект** (молчаливый возврат существующего
факта при совпадении idempotency-ключа с РАЗНЫМ финансовым payload). Все
остальные HARD GATEs пройдены. `ARCHITECTURE DECISION REQUIRED` — **не требуется**.

## 2. Repository baseline
`master` @ `edaf0ae` (v0.17.0) = origin/master (синхрон). 18 dirty/untracked
(Step 2.10A implementation + review). Migrations **48/48 up-to-date**, diff
live→schema = **No difference** (EXIT=0). Roadmap: 2.10A = IMPLEMENTATION
COMPLETED — WAITING FOR STRICT REVIEW (до ревью); NEXT = STRICT REVIEW 2.10A.
2.10B/2.10C/2.12+ **не начаты**: ProviderFee/Settlement/Payout отсутствуют в
схеме; milestones отсутствуют; Payment/Refund/Commission writers = 0.

## 3. Sources inspected
Roadmap v3 (2.10A), Step 2.10 prompt/report/arch, Step 2.10A prompt/report,
`schema.prisma` (LedgerTransaction + finance.* + Order), migration SQL
`20260813121555_add_ledger_transaction_foundation` (полностью), `ledger.service/
controller/validation`, `finance.module/service`, `permissions.constants.ts`,
`security.service.ts` (seed/reconcile), `ids.service.ts`, `prisma-errors.ts`,
`exception.filter.ts`, `request-context.ts` (ADR-0010), `sales.payment-terms.ts`,
api/events/ids.md, arch doc, e2e harness (`e2e.global-setup.ts`), ledger e2e (18),
finance 2.10 e2e (12), remove-bootstrap-order.

## 4. Current → Target reconciliation
| Area | Active (2.10A) | Deferred |
|---|---|---|
| LedgerTransaction | immutable foundation + read API | — |
| writer authority | LedgerService.create (единственный) | producer-шаги 2.12+ |
| Payment | schema-only (0 writers) | 2.12 |
| Refund | schema-only (0 writers) | 2.13 |
| Commission/Accrual | schema-only (0 writers) | 2.12C/E |
| Settlement/Payout/ProviderFee | отсутствуют | 2.10B |
| temporal milestones | нет | 2.10C |
| balances | нет | нет контракта |
| double-entry | нет (без контракта) | — |
| FX conversion | нет | 2.12+ |
| Tax postings | нет | 2.12+ |

## 5. Ledger ownership — HARD GATE PASS
Repository-wide классификация каждого `ledgerTransaction.*` обращения:
**ровно 1 production writer** — `ledger.service.ts:94` `tx.ledgerTransaction.create`
(canonical Finance path). Zero update/updateMany/upsert/delete/deleteMany; zero
raw SQL; zero seed/job; zero Order/Booking/Sales/Availability/Catalog writers
(grep по src вне finance-модуля = 0 ссылок). Cross-domain writer = 0.

## 6. Write-path audit — PASS
`grep ledgerTransaction.(create|update|updateMany|upsert|delete|deleteMany)` по
src (excl generated/spec): единственный match — create в LedgerService. Raw SQL
по `LedgerTransaction` = 0.

## 7. Append-only guarantee — CRITICAL HARD GATE PASS
- Нет `update/updateMany/upsert/delete/deleteMany` production-путей (§6);
- нет subscriber/cleanup/admin-путей (глобальный поиск по src);
- **нет cascade-delete риска**: `LedgerTransaction` не имеет relations
  (`@relation` отсутствует), ни один parent не ссылается на него — каскадное
  удаление физически невозможно;
- e2e test-helper cleanup существует ТОЛЬКО в тестовом afterAll (тестовая БД
  пересоздаётся globalSetup каждый прогон) — не production path;
- schema не имеет `updatedAt` — тип сам не допускает его чтения (компилируется
  без поля; колоночный proof — e2e #15).

## 8. Schema inventory
`finance.LedgerTransaction`: id (UUID PK), code (`LTX-########`, unique),
amount (DECIMAL(12,2) NOT NULL > 0), currency (String, ISO 4217 снапшот),
type (String NOT NULL, классификация), sourceType (String NOT NULL), sourceId
(String NOT NULL), sourceEventId (String?), businessRef (String?),
correlationId (String?), causationId (String?), actorType (String?), actorId
(String?), createdAt (server-owned UTC, NOT NULL). Индексы: `code` unique,
`(sourceType, sourceId, type)` unique (idempotency), `(sourceType, sourceId)`,
`(createdAt)`. Authority: все факт-поля — server-written; nullable — provenance
legacy/unknown без backfill.

## 9. Migration review — HARD GATE PASS
`20260813121555_add_ledger_transaction_foundation`: чисто аддитивная (1 новая
таблица + 3 индекса), 0 ALTER существующих, 0 backfill, 0 db push. Fresh-deploy:
e2e globalSetup drop+recreate + `migrate deploy` реальных миграций — полный
прогон 1042/1042 = replay-proof. Upgrade-safe: `migrate status` 48/48, diff clean.

## 10. Immutability enforcement level
**Schema-level** (нет `updatedAt`, нет relations → нет cascade) + **code-level**
(нет update/delete методов/маршрутов). НЕ DB-trigger enforcement (честно:
append-only обеспечивается отсутствием путей мутации, а не DB-триггером —
задокументировано).

## 11. Identifier contract — HARD GATE PASS
`LTX-########` через канонический `IdsService.nextCode` (атомарный upsert
events.BusinessSequence) в той же transaction, что и create; DB unique; никаких
MAX()+1/random; concurrency-safe (транзакционная аллокация). `ids.md`: LTX- —
зарегистрирован (PFE/STL/POT остаются reserved для 2.10B).

## 12. Decimal/money contract — HARD GATE PASS
DECIMAL(12,2) DB; Prisma Decimal; string serialization (Decimal.js нормализует
trailing zeros — контракт «строка + числовая семантика»); `validateLedgerAmount`
>0, ≤2dp; никакого float-как-authority и unsafe `parseFloat`/`Number()` в
сервисе (Number() только в валидаторе-строке). **Sign не блокирует будущее**:
reversal/adjustment = новый compensating факт с положительным amount + новый
type (не отрицательный amount) — семантика не зафиксирована преждевременно.

## 13. Type semantics
`type` — String, non-empty (assertNonEmpty), произвольные значения возможны
(cловарь приходит с producer-шагом 2.12+); namespace/версионирование через
строку безопасно (аддитивно). Никакого producer-а сейчас — фейковых значений нет.

## 14. Direction/sign semantics
Type-only классификация; `amount > 0`; **нет** скрытой pseudo-accounting
конвенции (нет debit/credit/направления). Экономический смысл — в `type`.

## 15. Double-entry boundary — HARD GATE PASS
`debit/credit/account/balance/posting/journal` по src: 0 финансового кода
(только комментарии-документация + несвязанный PartnerApplication «journal» —
история заявки, не финансовая). Псевдо-double-entry не изобретался (Roadmap
требует только append-only).

## 16. Balance boundary — PASS
Нет persisted/derived balance authority (нет контракта). Балансы — при
approved contract.

## 17. Currency authority — CRITICAL HARD GATE PASS
Снапшот-строка ISO 4217 (без FK) + валидация существования в `finance.Currency`
(read-by-code; inactive допустим). **История durable**: снапшот переживает
деактивацию/переименование валюты (нет FK → нет cascade/update-propagation);
историческая интерпретация по коду сохранена. Никакой конвертации.

## 18. Provenance model — PASS
sourceType/sourceId — canonical refs (без mutable dump Order/Booking/Payment);
sourceEventId — provenance-only (НЕ idempotency key); businessRef — optional
human-readable (не заменяет sourceId). PII не хранится. Факт объясняет «почему»
без снапшотов коммерческих данных.

## 19. Idempotency unique review — CRITICAL PASS (с документацией)
`@@unique(sourceType, sourceId, type)`. Adversarial:
- один source факт может легитимно породить один факт данного типа — инвариант
  соответствует текущему контракту (0 producer-ов, key выбран детерминированно);
- multi-capture/split: каждый capture/платёж — отдельный `Payment`/sourceId
  (Roadmap 2.12: PAY-* на попытку/сплит), поэтому ключ не блокирует; edge-кейс
  «несколько фактов одного типа на один source» решается расширением type-словаря
  ИЛИ additive-релаксацией unique (не-destructive) — зафиксировано в arch doc;
- sourceEventId НЕ участвует: ключ — доменный (source-факт), не технический
  (event); один source-факт может дать несколько событий, но один ledger-факт.
Не является блокером: инвариант не конфликтует с утверждённым будущим
коммерческим флоу; расширяем без destructive.

## 20. Duplicate conflicting-payload behavior — FIX 1 (см. Issues/Fixes)
Ранее: совпадение ключа → молчаливый возврат существующего факта при ЛЮБОМ
payload. Исправлено: **first-write-wins + payload-верификация** — при
совпадении ключа сравниваются immutable факт-поля
(amount/currency/sourceEventId/businessRef); идентичные → no-op (истинный
replay); расходящиеся → controlled 409 (producer-баг/другое событие НЕ
маскируется). Correlation/causation/actor в сравнении НЕ участвуют (могут
легитимно отличаться между retry).

## 21. P2002 handling — HARD GATE PASS
Известный idempotency-constraint → duplicate-обработка (no-op при идентичном
payload, 409 при расходящемся); LTX code collision → controlled ConflictError
(sequence-безопасен, но не маскируется); неизвестный unique violation →
controlled ConflictError; не-P2002 → rethrow (не глотается). Raw Prisma 500 = 0
(полный прогон подтверждает).

## 22. Concurrency — PASS
Параллельные create одного факта (e2e #10): один победитель, оба code/id
равны, count = 1, raw 500 = 0. Конкурентный conflicting payload: первый
выигрывает, второй получает controlled 409 (детерминированный loser, e2e #9A
последовательный + #10 идентичный).

## 23. Creation authority — HARD GATE PASS
Нет create-маршрута/alias/manual-journal transport/subscriber/cross-domain
caller (e2e #1: POST/PATCH/DELETE → 404). `LedgerService.create` — внутренний
Finance API; задокументирован как persistence/service foundation, НЕ активный
posting workflow (0 production-вызовов — что честно для foundation).

## 24. Read API — PASS
`finance.ledger.read`: `GET /ledger-transactions` (list) + `/:code` (detail).
401 anonymous; 403 запрещённые роли; 404 unknown; whitelist-DTO без PII/
внутренних деталей (проекция фиксированная).

## 25. Read filters/pagination — PASS
Whitelist-фильтры sourceType/type/currency (LedgerListQueryDto), page/pageSize
(1..100, @Type Number — без implicit conversion), детерминированная сортировка
(createdAt desc, code asc), total + hasMore (конвенция Sales).

## 26. RBAC — HARD GATE PASS
`finance.ledger.read` в PERMISSIONS + ROLE_PERMISSIONS (FINANCE/DIRECTOR/ANALYST;
ADMIN = ALL); auto-seed через SecurityService.onModuleInit (идемпотентный
upsert + stale-revoke). BUYER/PARTNER/OPERATOR/SALES_MANAGER/MODERATOR/MARKETER
→ 403; anonymous → 401; FINANCE/DIRECTOR/ANALYST/ADMIN → 200 (e2e #1/#2).
Read-only остаётся read-only; ledger write-права нет.

## 27. Mass assignment / write-surface absence — PASS
Публичного write-endpoint нет → HTTP физически не может подделать
id/code/amount/currency/type/provenance/actor/correlation/causation/createdAt.
Сервисный вход — типизированный TS-контракт; server-owned поля
(code/createdAt/correlation/causation/actor) НЕ принимаются параметрами.
Write-endpoint для тестов НЕ создавался.

## 28. Correlation/causation — CRITICAL PASS
`LedgerService.create` читает `getRequestContext()` (ALS) — единственный
источник; параметры `correlationId/causationId` НЕ принимаются. Trust boundary:
correlation/causation — server-authoritative (middleware/guard/EventBus
устанавливают), произвольный production-вызов не может их подделать (не-HTTP
вызовы вне контекста получают NULL — legacy unknown). Валидация входных refs
(assertNonEmpty для sourceType/sourceId/type) на месте.

## 29. Actor provenance — PASS
actorType/actorId из typed `BusinessEventActor` (USER/SYSTEM/UNKNOWN); USER —
canonical id (без username/email/PII); SYSTEM-факты не фабрикуют USER-актора;
вне контекста — NULL. Соответствует ADR-0010.

## 30. Audit vs ledger — PASS
AuditLog — кто/что (security audit); LedgerTransaction — immutable финансовый
факт; не смешиваются (ledger не хранит audit dump; AuditLog не заменяет ledger;
e2e #13: audit minimal `{ code }`, без PII/сумм).

## 31. Events boundary — PASS
0 Finance событий: domain-events registry/outbox/subscribers — 0 ledger-событий
(grep). Событие «на будущее» не создано; events.md задокументировано.

## 32. Payment boundary — HARD GATE PASS
Нет Payment create/update/authorize/capture; нет PSP/Stripe (0 кода); нет
`Order.paymentStatus/paidAmount/paidAt` мутации (e2e #14). 2.12 deferred.

## 33. PaymentTerms boundary — PASS
Finance PaymentTerms остаётся schema-only; frozen 2.3B terms — authority;
материализация/recalculation не выполняются (0 изменений).

## 34. Refund boundary — PASS
Нет Refund workflow/auto-refund/refund postings (2.13 deferred; Refund count
неизменен — e2e #14).

## 35. Commission boundary — PASS
Нет расчёта/accrual/recognition/автоматических postings (2.12C/E deferred;
e2e #14).

## 36. Settlement/Payout boundary — PASS
Нет ProviderFee/Settlement/Payout/balances (2.10B deferred; модели отсутствуют).

## 37. Temporal 2.10C boundary — PASS
Нет payment milestones; `createdAt` — время факта (e2e #15: колонки
paidAt/authorizedAt/capturedAt/refundedAt/settledAt/payoutRequestedAt
отсутствуют; updatedAt отсутствует).

## 38. FX/Tax boundary — PASS
Нет выбора FX/конвертации/gain-loss (0 кода); TaxRule/расчёт налога/tax postings
не используются (0 кода). Frozen Sale/Order price не меняется.

## 39. Order/Booking/Availability isolation — PASS
Zero мутаций Order payment/lifecycle, Booking, Availability, Catalog/Pricing,
acquisition (e2e #14: counts + paymentStatus/paidAmount неизменны; grep: 0
обращений).

## 40. Legacy compatibility — PASS
Нет fabricated ledger backfill; legacy Order/Booking/Sale/CheckoutIntent без
ledger-строк остаются валидными (e2e #17: legacy Order без ledger-строк,
читаем). Аддитивная миграция.

## 41. Negative coverage — PASS (с добавленным FIX-тестом)
1. anonymous 401 ✓ (#1); 2. forbidden 403 ✓ (#2); 3. FINANCE/DIRECTOR/ANALYST/
ADMIN read ✓ (#2); 4. unknown 404 ✓ (#4); 5. malformed filters — whitelist/400
(DTO); 6. invalid amount ✓ (#6); 7. zero/negative ✓ (#6); 8. unknown currency ✓
(#7); 9. sequential duplicate ✓ (#9); 10. concurrent duplicate ✓ (#10);
11. dup key + diff amount → 409 ✓ (**#9A, добавлен**); 12. dup key + diff
currency → 409 ✓ (**#9A, добавлен**); 13. unknown P2002 → controlled conflict
(код: non-idempotency P2002 → ConflictError); 14. PATCH absent ✓ (#1/#8);
15. DELETE absent ✓ (#1/#8); 16. POST absent ✓ (#1); 17–18. no Order/Booking
mutation ✓ (#14); 19. no Availability mutation ✓ (#14); 20. no
Payment/Refund/Settlement/Payout ✓ (#14); 21. no Finance milestones ✓ (#15);
22. no raw 500 ✓ (полный прогон).

## 42. Positive coverage — PASS
1. valid internal create ✓ (#3); 2. canonical LTX ✓ (#3); 3. exact Decimal ✓
(#3); 4. currency ✓ (#3); 5. type ✓ (#3); 6. provenance sourceType/sourceId ✓
(#3); 7. sourceEventId — create с eventId (покрыт сервисным контрактом, #3
путь); 8. businessRef — nullable контракт; 9. correlation ✓ (#11); 10. causation
✓ (#11); 11. actor ✓ (#11); 12. createdAt ✓ (серверный, #3); 13. immutable
readback ✓ (#8); 14. replay identical → same fact ✓ (#9/#9A); 15. concurrent
replay → one fact ✓ (#10); 16. list ✓ (#4); 17. detail ✓ (#4); 18. filters ✓
(#5); 19. pagination ✓ (#5); 20. RBAC reads ✓ (#2); 21. migration replay ✓ (#16
+ полный прогон); 22. zero cross-domain side effects ✓ (#14).

## 43. Backend regression (фактические прогоны)
`tsc --noEmit` clean; unit **492/492** (41 suites); **full serial e2e 1042/1042**
(58 suites; +1 review test) — включая ledger 18/18, finance 12/12, RBAC, IDs,
event-envelope, order/booking lifecycle, sales/payment-terms, acquisition,
temporal-readiness, phase2-entry, remove-bootstrap-order.

## 44. Frontend regression
tsc clean; vitest **135/135**; `next build` ✓. Frontend не изменён.

## 45. DB regression
Migrations **48/48 up-to-date**; `migrate diff` = **No difference**; fresh replay
(globalSetup) — полный e2e прогон; no db push; SQL проверен вручную.

## 46. Issues found
1. **[REAL DEFECT — FIX 1]** Молчаливый возврат существующего факта при
   совпадении idempotency-ключа с РАЗНЫМ payload: для ledger-факта расходящиеся
   amount/currency могли быть замаскированы как успех (producer-баг скрыт).
   Risk: high (финансовая корректность). Root cause: catch-ветка возвращала
   existing без сравнения payload. Patch: first-write-wins + payload-верификация
   (amount/currency/sourceEventId/businessRef) → no-op только при идентичном,
   409 при расходящемся.
2. **[COVERAGE GAP — FIX 2]** §39.11/12 (dup key + diff amount/currency) не были
   покрыты тестами — добавлен e2e #9A.

## 47. Review fixes applied
FIX 1 (production): `ledger.service.ts` — payload-верификация в idempotency-ветке.
FIX 2 (tests): `ledger-transaction-foundation.e2e-spec.ts` +9A (dup key + diff
amount/currency → rejects; идентичный replay → no-op; count = 1).
FIX 3 (docs): arch doc §8 (first-write-wins + payload-верификация + future-safe
инвариант); Roadmap (APPROVED, NEXT = 2.10B). Все targeted rerun (18/18) + full
rerun (1042/1042) зелёные.

## 48. Architecture decision status
`ARCHITECTURE DECISION REQUIRED` — **не требуется**: idempotency-инвариант не
блокирует утверждённые будущие факты (документировано, additive-релаксация
допустима); sign — не конфликтует (reversal = компенсирующий факт); currency
history durable; append-only не нарушен (cascade = 0); trust boundary безопасен;
double-entry/balance не требуются Roadmap-ом; fixes не требуют 2.10B/C/2.12+;
competing authority с mutable Payment нет; legacy PSP writer нет; миграция не
компрометирует историю.

## 49. Documentation status
api.md (ledger read API + факт-контракт), events.md (0 событий), ids.md
(LTX- зарегистрирован), arch doc (обновлён §8), Roadmap (APPROVED, NEXT=2.10B),
implementation report, этот отчёт. Docs соответствуют runtime.

## 50. Roadmap update
Step 2.10A → **✅ APPROVED (STRICT REVIEW, 2026-08-13; FIX 1: duplicate key с
разным payload → 409)**; NEXT = `PHASE 2 — STEP 2.10B — PROVIDER FEE /
SETTLEMENT / PAYOUT FOUNDATION` (из текущего Roadmap; не начинается).

## 51. Deferred / extension points
2.10B ProviderFee/Settlement/Payout; 2.10C temporal milestones; 2.12 Payment/PSP;
2.13 Refund; 2.14 Invoice; commission accrual; balances (после контракта);
double-entry/account chart; reversal workflow (как новый approved type);
ledger events (при появлении producer/consumer); Finance Center frontend.

## 52. Out-of-scope confirmation
НЕ реализованы: 2.10B, 2.10C, 2.12 Payment/PSP/authorize/capture, 2.13 Refund,
2.14 Invoice, commission accrual, balances, double-entry account system, FX
conversion, tax engine, Finance Center frontend, reversal workflow.

## 53. Exact files changed during review
- `backend/src/modules/finance/ledger.service.ts` (FIX 1)
- `backend/test/ledger-transaction-foundation.e2e-spec.ts` (+9A; 18 тестов)
- `docs/architecture/ledger-transaction-foundation.md` (§8 обновлён)
- `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md` (approval)

## 54. Exact NEXT item
`PHASE 2 — STEP 2.10B — PROVIDER FEE / SETTLEMENT / PAYOUT FOUNDATION` — по
отдельному prompt; в этом проходе **не начинается** (STOP).

`PHASE 2 STEP 2.10A STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`
