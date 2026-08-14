# PHASE 2 — STEP 2.13A — CHARGEBACK / DISPUTE FOUNDATION — IMPLEMENTATION REPORT

## 1. Verdict
`PHASE 2 STEP 2.13A IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

## 2. Repository baseline
- Branch `master`, HEAD `3e89387`; working tree: артефакты 2.13 (незакоммичены) + 2.13A (этот проход).
- Migrations до 2.13A: 53/53, drift 0; unit 534/534; serial e2e 1093/1093 (62 suites); frontend 135/135.
- Certified: 2.10–2.13 все APPROVED; Roadmap Reconciliation `MIXED DEPENDENCY ORDER ESTABLISHED` (foundation 2.13A разрешён; real-PSP → 2.12A/2.12B; adjustments → 2.12D/2.12C/2.14A).
- Repository state соответствует reconciliation: Steps 2.12A–G NOT STARTED; 2.13 APPROVED. Mismatch: нет.

## 3. Sources inspected
Roadmap v3 (body 2.13A + prerequisites + execution sequence + Dependency Analysis), reconciliation report, 2.12/2.13 implementation+strict-review reports, payment-flow.md/refund-flow.md, schema.prisma (Payment/Refund/ProviderFee/Commission/CommissionAccrual), PaymentService/RefundService/controller/validation, EventBus/outbox, permissions.constants.ts, IdsService, sales.money.ts, api.md/events.md/ids.md, e2e harness.

## 4. Reconciliation constraints
- Foundation (dispute/evidence/liability факты) допустим после 2.13.
- real-PSP chargeback → 2.12A/2.12B (НЕ реализован, НЕ выдуман).
- ledger/commission/settlement adjustments → 2.12D/2.12C/2.14A (НЕ реализованы).
- Steps 2.12A–G НЕ начинались; 2.14+ НЕ начинался.

## 5. Canonical terminology decision
**Одна сущность `Dispute` (DSP-*).** Roadmap 2.13A «Chargeback / Dispute
Foundation» не различает Dispute и Chargeback как две модели (одна тема шага;
§5 промпта: «Не создавать одновременно Chargeback и Dispute, если Roadmap не
требует две отдельные сущности»). «chargeback» — vocabulary-категория причины
(reason), НЕ отдельная модель/статус. Это задокументировано в арх-доке §2.

## 6. Current → target reconciliation
| Аспект | Current (до 2.13A) | Target (2.13A) | Статус |
|---|---|---|---|
| Dispute модель | 0 (нет в schema/code) | finance.Dispute DSP-* | ✅ |
| Lifecycle | — | OPENED → RESOLVED \| CANCELLED | ✅ |
| PSP chargeback | — | Deferred (2.12A/2.12B) | ✅ |
| Ledger/Commission/Settlement adjustments | — | Deferred (2.12D/2.12C/2.14A) | ✅ |
| Milestones | — | openedAt/resolvedAt/cancelledAt | ✅ |
| Payment impact | CAPTURED | НЕ мутируется | ✅ |
| Order projection | — | 0 (не требуется Roadmap) | ✅ |

## 7. Ownership
Dispute — Finance-owned. Единственный writer — `DisputeService` (create +
transition). Repo-wide аудит: 0 других dispute create/update/upsert/delete в
prod (кроме cleanup e2e); 0 raw SQL; 0 cross-domain writes (order/booking/
sales/catalog/availability не упоминаются в DisputeService).

## 8. Source authority
ТОЛЬКО CAPTURED Payment (PENDING/FAILED/CANCELLED/AUTHORIZED → 422; unit +
e2e T2). currency/orderId — server-derived verbatim из Payment (0 reprice).
Client передаёт только paymentId + amount + reason. Unknown → 404.

## 9. Provider-neutral boundary
0 PSP-адаптеров, 0 webhook endpoints, 0 signature validation, 0 PSP API calls,
0 provider polling, 0 credentials, 0 provider dispute IDs, 0 automatic PSP
execution. providerRef — forbidden key (422). 0 Stripe/webhook в repo-wide
audit (только комментарии «2.12A/2.12B»).

## 10. Schema/model
`finance.Dispute`: id/code (DSP-*)/paymentId/orderId/amount DECIMAL(12,2)/
currency/status DisputeStatus{OPENED,RESOLVED,CANCELLED}/reason/version/
createdAt/updatedAt/openedAt/resolvedAt/cancelledAt/isActiveDispute +
`DisputeHistory` (audit by default). 0 speculative полей (PSP payload, bank,
card, evidence blobs, secrets, ledger/commission/settlement refs).

## 11. Migration
`20260814170000_add_chargeback_dispute_foundation` — аддитивная: enum +
Dispute + DisputeHistory + partial unique `Dispute_one_active_per_payment` +
indexes. Без backfill (новая таблица). migrate status 54/54, drift 0
(«No difference detected»), fresh replay через harness.

## 12. Money contract
amount — `Prisma.Decimal`, DECIMAL(12,2), строки; validateDisputeAmount
(> 0, ≤ 2 знаков, 0 float). Верхняя граница — `payment.amount` (frozen
captured; amount > captured → 409; unit + e2e T5). Currency verbatim.

## 13. Identifier
DSP-* через `IdsService.nextCode(tx, "DSP")` в той же транзакции; DB unique
(`code @unique`); добавлен в ids.md (таблица + summary). Коллизия code не
трактуется как idempotency (findFirst по paymentId+isActiveDispute).

## 14. Cardinality
Один активный Dispute на Payment (`isActiveDispute` + partial unique на
paymentId). НЕ paymentId+amount (спор один на платёж, не на срез — в отличие
от Refund partial-срезов). RESOLVED/CANCELLED освобождают слот (attempt 2
легален; e2e T4/T12). Future partial dispute slices — аддитивная переработка
ключа (документировано; не блокируется).

## 15. Idempotency
Identical retry (тот же amount) → no-op существующий факт (findFirst в tx;
e2e T5). **Divergent replay (другой amount) → controlled 409** (STRICT REVIEW
FIX 2.13A — класс «silent divergent idempotency success», прецедент Ledger
2.10A FIX 1; unit + e2e T5). Concurrent duplicate → P2002 → controlled 409
(e2e T6). reason — metadata, не business identity. Unknown P2002 не глотается.

## 16. State machine
Единственный authority `DisputeService.transition`: CAS `updateMany where
{id, status: OPENED, version}` → один победитель; from-guard OPENED; resolve
и cancel из терминальных → 409 (e2e T3). Milestone + history + audit + outbox
атомарны с переходом. Controllers не пишут status напрямую.

## 17. Temporal contract
openedAt = create (OPENED); resolvedAt = resolve; cancelledAt = cancel.
Server-owned UTC, first-only (CAS), атомарны. 0 backfill. updatedAt не
бизнес-дата. Milestones forbidden на create (422).

## 18. Payment interaction
Payment НЕ мутируется: status остаётся CAPTURED, paidAt/amount/currency
immutable (e2e T1/T9: payRow.status === CAPTURED, amount frozen, paidAt set).
Никакого Payment.status = DISPUTED. Dispute — отдельный Finance-owned
aggregate (предпочтительный паттерн §12 промпта).

## 19. Refund interaction
Roadmap 2.13A не определяет monetary netting → **explicit restriction**
(§13/§31): dispute amount ≤ payment.amount (captured), БЕЗ вычета processed
refunds. e2e T10: partial refund 40 + dispute 100 на payment 100 → 201
(не 60); refund-факт остаётся PROCESSED (не тронут). Netting/двойной financial
claim — DEFERRED (2.12D/2.14A), документировано в арх-доке §18 и Roadmap.

## 20. Concurrency
Concurrent duplicate create → один факт + controlled 409 (e2e T6). CAS-
transition race → один победитель, 409 без duplicate history (unit CAS-loss).
0 raw 500.

## 21. RBAC
`finance.dispute.read` — FINANCE/DIRECTOR/ANALYST/SALES_MANAGER/ADMIN
(проверено фактическим ROLE_PERMISSIONS; OPERATOR не имеет — docs
консистентны). `finance.dispute.write` (create/resolve/cancel) — FINANCE/ADMIN.
Отдельного resolve-права нет (минимальный lifecycle). e2e T7: 401/403/404,
SALES/DIRECTOR read-only, FINANCE write OK.

## 22. API
POST /finance/disputes (create), POST /finance/disputes/:code/resolve,
POST /finance/disputes/:code/cancel, GET /finance/disputes (list whitelist +
pagination ≤100), GET /finance/disputes/:code. PATCH/DELETE отсутствуют
(immutable source + action-only lifecycle). Детали — api.md.

## 23. Events
DisputeOpened/DisputeResolved/DisputeCancelled — outbox, PII-free, correlation=
server UUID, causation=null (HTTP). Ровно одно на реальный переход, 0 на
no-op (early-return до emit). Consumer-ов НЕТ (0 cross-domain projections —
Roadmap 2.13A их не требует; документировано). События не обещают PSP/ledger/
commission.

## 24. Audit/history
DisputeHistory — одна строка на реальный переход (opened/resolved/cancelled),
from/to/action, без PII/evidence/provider payload. AuditLog:
finance.dispute.opened/resolved/cancelled, USER actor, 0 дублей на no-op.

## 25. Cross-domain projections
0 Order-проекций (Roadmap 2.13A не требует; §26 промпта: если не требуется —
0 Order changes). Проверено: order.subscribers НЕ тронут (diff чист).

## 26. Ledger boundary
0 LedgerTransaction (e2e T9: ledger count неизменен). Никакого ledger impact/
double-entry/accounting reversal.

## 27. Commission boundary
0 Commission/CommissionAccrual runtime (e2e T9: counts неизменны). Никаких
reversal/platform fee recomputation.

## 28. ProviderFee/Settlement/Payout boundary
0 ProviderFee/Settlement/Payout mutation (e2e T9: counts неизменны). Никаких
автоматических adjustments.

## 29. 2.12A boundary
0 PSP adapter/provider runtime (repo audit: 0 адаптеров/вызовов).

## 30. 2.12B boundary
0 webhook/provider capture/authorization activation (AUTHORIZED reserved
unreachable; authorizedAt/capturedAt отсутствуют на Dispute и не активированы
на Payment).

## 31. 2.12C boundary
0 Commission runtime (split не реализован).

## 32. 2.12D boundary
0 Payment/Refund/Dispute → Ledger posting (e2e T9).

## 33. 2.12E boundary
0 CommissionAccrual/reversal mechanics (0 writer-ов).

## 34. 2.12F boundary
0 partial Payment implementation (PARTIALLY_PAID — только enum OrderPaymentStatus).

## 35. 2.12G boundary
0 ProviderFee feeType/granularity evolution (0 feeType в schema/code).

## 36. 2.14+ boundary
Не начаты: settlement lifecycle, payout lifecycle, invoice, reconciliation
engine, accounting engine, partner payable adjustments, bank rails (0 кода).

## 37. Write-path audit
Prod writer-ы Dispute: `DisputeService.createDispute` (create) +
`DisputeService.transition` (updateMany CAS) — единственные. 0 subscriber/job/
seed/raw SQL. status/milestone/isActiveDispute writers — только CAS.
Cross-domain writers = 0. Unsafe = 0.

## 38. Negative tests
401 (T7), 403 write для SALES/DIRECTOR (T7), 404 unknown payment/dispute
(T2/T7), non-CAPTURED 422 (T2 + unit), forged currency/status/orderId/version/
milestones/isActiveDispute/code 422 (T8 + unit), zero/negative/malformed
amount 422 (unit), amount > captured 409 (T5 + unit), duplicate no-op (T5),
concurrent duplicate один факт + controlled 409 (T6), invalid transition
resolve→resolve 409 / cancel из RESOLVED 409 (T3), CAS-loss 409 без duplicate
history (unit), 0 PSP/webhook (repo audit), Ledger/ProviderFee/Settlement/
Payout/Invoice/Commission/CommissionAccrual неизменны (T9), Payment immutable
(T1/T9), Refund не тронут (T10), Booking/availability неизменны (T9), 0
fabricated provider identity (repo audit), 0 premature 2.12A–G semantics
(boundaries §29–§35), no PII (T11), no raw 500 (T6).

## 39. Positive tests
canonical create DSP-* (T1), source Payment linkage (T1), amount/currency
verbatim (T1), OPENED + openedAt (T1), full lifecycle + first-only milestones
(T3), resolve/cancel терминальные (T3/T4), attempt 2 после RESOLVED/CANCELLED
(T4/T12), identical retry no-op (T5), concurrent duplicate один факт (T6),
RBAC (T7), refund-interaction explicit restriction (T10), events + correlation
(T3), PII-free DTO (T11), fresh replay (harness).

## 40. Race tests
T6 (concurrent duplicate → [201,409], ровно 1 факт), unit CAS-loss
(concurrent transition → 409, 0 duplicate history/event). Dispute vs Payment
terminal: Payment immutable → гонки нет (source зафиксирован до создания).

## 41. Issues found during implementation
- Foundation-тест 11 (finance-domain-foundation): `cancelledAt` теперь живёт
  на Payment (2.12) И Dispute (2.13A) — тест предполагал «только Payment».
  Легитимная эволюция (§28-паттерн, как в 2.10C/2.11/2.12/2.13): тест
  переписан (paidAt — только Payment; cancelledAt — Payment+Dispute;
  +проверка openedAt/resolvedAt — только Dispute).
- T10 тест: тип ответа не содержал `code` — исправлен (поиск по id).

## 42. Backend regression
tsc --noEmit ✓; build ✓; unit **547/547** (44 suites, +13 dispute.service.spec);
target e2e **108/108** (8 suites, --runInBand: chargeback-dispute, refund-flow,
payment-flow, finance-domain-foundation, phase2-entry-audit, order-temporal,
ledger-foundation, provider-fee-foundation, finance-temporal, rbac);
**serial e2e 1105/1105 (63 suites, +12 chargeback-dispute T1–T12)**.

## 43. Frontend regression
tsc ✓; Vitest **135/135** (23 files); production build ✓ (Compiled
successfully). Frontend не менялся (Refund/Dispute UI — вне 2.13A).

## 44. DB regression
migrate status: 54/54 up to date; fresh replay (harness drop+recreate +
migrate deploy) в serial e2e; migrate deploy (не db push); drift 0
(«No difference detected»).

## 45. Fresh migration replay
Serial e2e harness выполнил drop+recreate БД + полный replay 54 миграций —
все 63 suite (1105 тестов) зелёные с нуля.

## 46. Drift check
`prisma migrate diff --from-schema prisma/schema.prisma --to-config-datasource`
→ «No difference detected» (drift 0).

## 47. Files changed
- `backend/prisma/schema.prisma` (DisputeStatus enum + Dispute + DisputeHistory);
- `backend/prisma/migrations/20260814170000_add_chargeback_dispute_foundation/` (новая миграция);
- `backend/src/modules/finance/dispute.service.ts` (+ spec);
- `backend/src/modules/finance/finance.controller.ts` (dispute routes);
- `backend/src/modules/finance/finance.module.ts` (DisputeService);
- `backend/src/modules/finance/finance.validation.ts` (validateDisputeAmount +
  CreateDisputeDto + DISPUTE_CREATE_FORBIDDEN_KEYS + DisputeListQueryDto);
- `backend/src/eventbus/domain-events.ts` (Dispute* события + payload);
- `backend/src/security/permissions.constants.ts` + `security.service.ts`
  (finance.dispute.read/write + роли);
- `backend/test/chargeback-dispute-foundation.e2e-spec.ts` (новый, T1–T12);
- `backend/test/finance-domain-foundation.e2e-spec.ts` (тест 11 эволюция);
- `docs/architecture/chargeback-dispute-foundation.md` (новый, 27 секций);
- `docs/contracts/api.md`, `docs/contracts/events.md`, `docs/contracts/ids.md`;
- `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md` (2.13A статус).

## 48. Deferred items
real-PSP chargeback (2.12A/2.12B), won/lost liability-исход (2.12D/2.14A),
ledger/commission/settlement adjustments (2.12D/2.12C/2.14A), monetary netting
dispute vs refund (2.12D/2.14A), partial dispute slices (2.13A+/2.14+), Order-
проекция dispute state (не требуется Roadmap), evidence/liability runtime.

## 49. Architecture decision status
Архитектурных блокеров НЕТ (stop-conditions §40 отрицательны: терминология
определена; PSP identity не требуется для foundation; amount semantics —
explicit restriction без выдуманного netting; cardinality определена; lifecycle
без webhook; Payment не мутируется; 0 Ledger/Commission/Settlement; конфликт
моделей отсутствует; foundation identity эволюционируем; source authority
frozen; cross-domain ownership соблюдён; idempotency безопасна; миграция без
backfill).

## 50. Exact NEXT
`PHASE 2 — STEP 2.13A — STRICT REVIEW` (не выполняется в этом проходе).

## 51. Final conclusion
`PHASE 2 STEP 2.13A IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

Минимальный честный provider-neutral Dispute foundation: Finance-owned (DSP-*),
source = CAPTURED Payment (frozen money verbatim, 0 reprice), один активный
Dispute на Payment (idempotency + over-claim guard), lifecycle OPENED →
RESOLVED | CANCELLED (CAS, first-only milestones), 0 PSP/webhook/Ledger/
Commission/Settlement/Payout/Order-проекций, Payment/Refund/Booking/availability
не тронуты. Deferred границы явно задокументированы (reconciliation
prerequisites сохранены в Roadmap).
