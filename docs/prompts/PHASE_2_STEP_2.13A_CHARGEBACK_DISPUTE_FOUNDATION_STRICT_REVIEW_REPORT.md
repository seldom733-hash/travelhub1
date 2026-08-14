# PHASE 2 — STEP 2.13A — CHARGEBACK / DISPUTE FOUNDATION — STRICT REVIEW REPORT

## 1. Verdict
`PHASE 2 STEP 2.13A STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`

## 2. Repository baseline
- Branch `master`, HEAD `3e89387`; origin in sync (push не выполнялся в этом проходе).
- Working tree: артефакты 2.13 (незакоммичены) + 2.13A (реализация + ревью) — всё относится к шагам; посторонних файлов нет.
- Migrations: 54/54 applied; latest `20260814170000_add_chargeback_dispute_foundation`; drift 0 («No difference detected»).
- Reported baseline подтверждён до fix-а: unit 547/547, serial e2e 1105/1105 (63 suites), frontend 135/135. После REVIEW FIX: unit 548/548 (+1 divergent-тест).
- Roadmap: Step 2.13A → ✅ APPROVED WITH REVIEW FIXES; NEXT (фактический по Roadmap) — Step 2.14 (Invoice / Commission Flow), не начинается.

## 3. Sources inspected
- Промпт strict review 2.13A (52 секции, создан в этом проходе), имплементационный отчёт, арх-док `chargeback-dispute-foundation.md`.
- Roadmap v3 (2.13A + reconciliation prerequisites + execution sequence), reconciliation report.
- `schema.prisma` (Dispute/DisputeHistory/DisputeStatus), `20260814170000_add_chargeback_dispute_foundation/migration.sql` (фактический SQL).
- `dispute.service.ts` (фактический код) + `dispute.service.spec.ts`; `finance.validation.ts`; `finance.controller.ts`; `finance.module.ts`.
- `payment.service.ts`, `refund.service.ts`, `settlement.service.ts`, `ledger.service.ts` (контроль boundaries).
- `order.subscribers.ts` (0 Dispute-проекций), `domain-events.ts` (Dispute* + payload), `eventbus.service.ts`.
- `permissions.constants.ts` + `security.service.ts` (ROLE_PERMISSIONS фактический).
- e2e `chargeback-dispute-foundation.e2e-spec.ts` (T1–T12), эволюционированный foundation-тест 11.
- Документация: api.md, events.md, ids.md.

## 4. Terminology decision
PASS. Одна сущность **Dispute** (DSP-*). Roadmap 2.13A «Chargeback / Dispute
Foundation» не различает Dispute и Chargeback как две модели (одна тема шага);
промпт §5 запрещает создавать обе без требования. «chargeback» — vocabulary-
категория причины (reason), не отдельная сущность/статус. Отдельного Chargeback
lifecycle не изобретено. Screen Design (Reconciliation/Exceptions: «chargebacks»)
не задаёт модель — не конфликт. Fail-условий терминологии нет.

## 5. Ownership/write-path audit — HARD GATE PASS
Repo-wide перечислены все Dispute writer-ы:
- `dispute.service.ts`: `tx.dispute.create` (createDispute) + `tx.dispute.updateMany` (transition CAS) + `tx.disputeHistory.create` — единственные prod writer-ы.
- `dispute.service.spec.ts` — моки; e2e `chargeback-dispute-foundation` — cleanup (`deleteMany` в afterAll).
- 0 raw SQL (`$executeRaw`/`$queryRaw` отсутствуют), 0 seed/cron/job/subscriber, 0 тестовых helper-ов в prod.
- Cross-domain writers = 0 (order/booking/sales/catalog/availability не упоминаются в DisputeService).

## 6. Source authority — PASS
- `payment.status !== "CAPTURED"` → ValidationDomainError 422 (PENDING/FAILED/CANCELLED/AUTHORIZED — unit + e2e T2).
- Unknown Payment → NotFoundError 404 (e2e T2).
- AUTHORIZED/REFUNDED остаются reserved: PaymentService не мутируется; Dispute-путь не активирует их (e2e T1/T9: payRow.status === CAPTURED).
- Enum-присутствие ≠ runtime-reachability: подтверждено кодом.

## 7. Frozen money contract — PASS
- currency/orderId — server-derived verbatim из Payment (0 клиентского ввода; forged → 422 forbidden keys).
- 0 re-read mutable Product/Tariff/Tax/FX (grep: 0 обращений в DisputeService; только комментарии).
- amount — `Prisma.Decimal`, validateDisputeAmount (> 0, ≤ 2 знаков, 0 float), DECIMAL(12,2).
- `0 < amount ≤ payment.amount`: amount > captured → ConflictError 409 (unit + e2e T5: 101 → 409).
- Forged server-owned поля (amount/currency/status/orderId/version/milestones) → 422 raw-body (e2e T8).

## 8. Refund interaction — CRITICAL SCOPE GATE PASS
- Hidden netting поиск: 0 вычислений «payment.amount − refunds», 0 refundedAmount subtraction, 0 available dispute balance, 0 refund cancellation от Dispute (repo grep).
- **Explicit restriction** (документирована в арх-доке §18, отчёте §19, Roadmap prerequisites): dispute amount ≤ captured (payment.amount), БЕЗ вычета processed refunds; monetary netting deferred (2.12D/2.14A).
- e2e T10: partial processed refund 40 + dispute 100 на payment 100 → 201 (не 60); refund остаётся PROCESSED (не тронут).
- Refund не мутируется; Dispute не мутируется Refund-ом (0 cross-writes).

## 9. Cardinality — PASS
- DB invariant: partial unique `Dispute_one_active_per_payment` ON (paymentId) WHERE isActiveDispute = true.
- ≤1 активный Dispute на Payment; RESOLVED/CANCELLED освобождают слот (transition: `isActiveDispute: !TERMINAL.includes(to)`).
- Attempt 2 после RESOLVED (e2e T12) и CANCELLED (e2e T4) — новый факт.
- Uniqueness scoped на paymentId, НЕ (paymentId, amount) — спор на платёж, не на срез (документировано).
- Active с разными amount конфликтуют (DB backstop; см. §10 fix).

## 10. Idempotency — REVIEW FIX
**DEFECT FOUND (HIGH, класс «silent divergent idempotency success» — §9 Case B / §51 #1, прецедент Ledger 2.10A FIX 1):** `createDispute` при существующем активном Dispute возвращал `disputeDto(existing)` БЕЗ сравнения amount — запрос с ДРУГИМ amount молча получал 200 с чужой суммой (факт amount=60, retry amount=30 → 200/60).

**FIX:** при найденном existing:
- `existing.amount.equals(amountDecimal)` → no-op (identical retry, тот же факт);
- divergent amount → `ConflictError` 409 (controlled, НЕ raw).
- reason — descriptive metadata (как Refund.reason), НЕ часть business identity (не сравнивается — документировано).
- Unknown P2002 не глотается (throw err; вне known-constraint catch).

**Тесты:** unit «divergent amount при активном Dispute → 409» (+1), e2e T5 расширен (после identical no-op: create amount=30 → 409, count 1).

## 11. Concurrency create — PASS (после fix)
- Case A (same payload 40+40): e2e T6 — [201,409]/[201,201], ровно 1 факт, controlled.
- Case B (divergent amount): sequential → 409 (fix, e2e T5); concurrent divergent → один факт (DB partial unique; проигравший P2002 → 409, catch).
- Case C (divergent reason): reason — metadata, не business identity (как Refund) — документировано, не «silent incompatible fact».
- 0 raw 500 во всех расах.

## 12. Lifecycle/CAS — PASS
- Матрица: OPENED → RESOLVED | CANCELLED; RESOLVED → ∅; CANCELLED → ∅; RESOLVED↔CANCELLED → 409.
- Нет won/lost (deferred), нет provider-статусов, нет Payment-мутации как side effect.
- CAS: `updateMany where {id, status: OPENED, version}` → count 1; иначе ConflictError 409 (unit CAS-loss).
- Невалидные переходы → controlled 409 (e2e T3: resolve→resolve 409, cancel из RESOLVED 409).
- 0 raw 500.

## 13. Temporal contract — PASS
- openedAt = create (born-OPENED, атомарно с create в той же tx); resolvedAt = resolve; cancelledAt = cancel.
- Server-owned UTC instants, first-only (CAS), атомарны с переходом (milestone в том же updateMany).
- Клиент не может forge (forbidden keys → 422; e2e T8 resolvedAt → 422).
- 0 backfill; ordering: openedAt ≤ resolvedAt (resolved), openedAt ≤ cancelledAt (cancelled) — гарантировано временем перехода после create (e2e T3/T4 assert).
- updatedAt не бизнес-дата.

## 14. Payment isolation — PASS
- 0 Payment.status/milestones/amount/currency/isActivePayment/history mutation в DisputeService (grep).
- Нет DISPUTED-статуса; REFUNDED reserved не активируется.
- e2e T1/T9: payRow.status === CAPTURED, amount frozen, paidAt set, code неизменен.

## 15. Refund isolation — PASS
- 0 Refund create/approve/process/fail/milestone/isActiveRefund/amount в DisputeService.
- RefundService не пишет Dispute (repo grep: 0 dispute упоминаний вне dispute-файлов).
- e2e T10: refund PROCESSED, amount 40 неизменен.

## 16. Order/Booking/Availability isolation — PASS
- 0 Order.paymentStatus/paidAmount/refundedAmount/иных Order полей в Dispute-пути; 0 Order-проекций (order.subscribers diff чист — 0 Dispute-хендлеров).
- 0 Booking/availability mutation (e2e T9: bookings/availabilityReservation counts неизменны).
- Новых проекций нет — fail-условие отсутствует.

## 17. Ledger boundary — PASS
- 0 LedgerTransaction create/writer-вызовов/reversal/balance в Dispute-пути (grep + e2e T9: ledger count неизменен).
- 0 Ledger-упоминаний в DisputeService.

## 18. ProviderFee/Settlement/Payout boundary — PASS
- 0 ProviderFee/Settlement/Payout mutation (e2e T9: counts неизменны). Никаких holds/reversals (2.14A deferred).

## 19. Commission/Invoice boundary — PASS
- 0 Commission/CommissionAccrual/Invoice (e2e T9: counts неизменны). Никаких reversal/fee allocation (2.12C/E, 2.14 deferred).

## 20. PSP/webhook boundary — HARD GATE PASS
- Repo-wide: 0 Stripe/Adyen/иных provider-API, 0 webhook-маршрутов, 0 signature verification, 0 provider event mapping, 0 external dispute ID requirement (providerRef — forbidden key), 0 credentials/secrets, 0 auto-sync.
- 2.12A/2.12B prerequisite semantics: chargeback от provider — deferred; foundation честно provider-neutral.

## 21. 2.12A–G containment — PASS (все)
- 2.12A: 0 PSP adapter/provider runtime (repo audit).
- 2.12B: 0 webhook/provider payment lifecycle (AUTHORIZED reserved unreachable).
- 2.12C: 0 Commission semantics (e2e T9).
- 2.12D: 0 Ledger posting (e2e T9).
- 2.12E: 0 CommissionAccrual (e2e T9).
- 2.12F: 0 partial Payment (PARTIALLY_PAID только в enum OrderPaymentStatus).
- 2.12G: 0 feeType/granularity (0 feeType в schema/code).

## 22. Events — PASS
- DisputeOpened/DisputeResolved/DisputeCancelled — имена по конвенции, canonical envelope (toOutboxEnvelope), payload: disputeId/code/paymentId/orderId/amount/currency/reason (refs + frozen money, без PII/secrets).
- Ровно одно на реальный переход; 0 на failed transition/no-op (early-return до emit; 409 до emit).
- Outbox атомарен с мутацией (emit в той же tx).
- Consumer-ов реально 0 (repo: 0 подписок на Dispute*); docs не обещают side effects.

## 23. AuditLog — PASS
- snake_case: `finance.dispute.opened/resolved/cancelled` (0 toLowerCase-дрейфа — класс 2.10B проверен).
- Payload минимальный (code/paymentId/orderId/amount/currency или from/to), без PII.

## 24. History — PASS
- DisputeHistory: одна строка на реальный переход (opened/resolved/cancelled); 0 на replay/no-op (unit CAS-loss: history не создаётся).
- action/from/to когерентны; actor/correlation по конвенции; без PII; без публичного mutation surface (только cascade cleanup).

## 25. RBAC — PASS (фактический ROLE_PERMISSIONS)
- `finance.dispute.read`: FINANCE (281), DIRECTOR (242), ANALYST (332), SALES_MANAGER (399), ADMIN (ALL_PERMISSIONS).
- `finance.dispute.write`: FINANCE (282), ADMIN.
- OPERATOR: НЕ имеет finance.dispute.* (проверено фактическим списком — отсутствует).
- e2e T7: аноним 401, SALES/DIRECTOR write 403, FINANCE write 201, read 200, 404 unknown.
- Docs (api.md/арх-док/Roadmap/отчёт) консистентны с фактической матрицей — stale-docs дефекта нет.

## 26. Mass assignment — PASS
- `DISPUTE_CREATE_FORBIDDEN_KEYS` (raw-body, loud 422): id/code/status/currency/orderId/customerId/version/createdAt/updatedAt/openedAt/resolvedAt/cancelledAt/isActiveDispute/providerRef.
- ValidationPipe whitelist silent-strip исключён: `assertNoForbiddenKeys(req.body, ...)` на raw body (e2e T8: 7 forged → 422).

## 27. Read API — PASS
- list/detail: pagination whitelist (DisputeListQueryDto @Min(1) page, pageSize ≤ 100), stable ordering (createdAt desc, code asc), фильтры paymentId/orderId/status (whitelist), Decimal → string.
- page=0/pageSize=101/page=abc → 400 через DTO-валидацию (паттерн подтверждён в provider-fee-foundation e2e; тот же механизм).
- Unknown code → 404 (e2e T7). Без произвольных Prisma filter/sort объектов.

## 28. IDs — PASS
- DSP-######## через `IdsService.nextCode(tx, "DSP")` в той же tx, что create; DB unique; ids.md зарегистрирован (таблица + summary).
- Коллизия code не трактуется как idempotency (findFirst по paymentId+isActiveDispute, не по code).

## 29. Migration review — PASS
- Аддитивная: CREATE TYPE DisputeStatus + CREATE TABLE Dispute + DisputeHistory + индексы + partial unique; 0 destructive ALTER существующих Finance/Payment/Refund таблиц; 0 backfill.
- migrate status 54/54 up to date; migrate deploy (не db push); schema↔live diff = «No difference detected».

## 30. Fresh replay — PASS
- Serial e2e harness: drop+recreate БД + реальные миграционные файлы через migrate deploy — все 63 suite (1105 тестов) зелёные с нуля.

## 31. Schema-evolution tests — PASS (легитимная эволюция)
- Foundation-тест 11 изменён: `cancelledAt` теперь живёт на Payment (2.12) И Dispute (2.13A) — легитимная эволюция (новый терминальный milestone Dispute), НЕ ослабление: paidAt остаётся уникальным для Payment; добавлена проверка openedAt/resolvedAt — только Dispute; failedAt — Payment+Refund; occurredAt — только LedgerTransaction.
- Payment/Refund temporal contracts не ослаблены; deferred поля (authorizedAt/capturedAt/settledAt/refundedAt) остаются запрещёнными (assert forbidden.length === 0).

## 32. Error normalization — PASS
- Duplicate active → 409 (fix + P2002 catch); unknown P2002 → throw (не глотается); CAS-loss → 409; invalid transition → 409; invalid Payment state → 422; amount overflow/invalid Decimal → 422 (validateDisputeAmount); unknown resource → 404.
- 0 raw Prisma errors/raw 500 для ожидаемых business races (e2e T6/T8, unit).
- Unit: unknown P2002 путь — наследуется throw (как Refund/Payment паттерн; прямой unit-тест отсутствует, но путь идентичен approved Ledger/Refund).

## 33. Race matrix — PASS
1. create/create identical: e2e T6 (один факт, controlled).
2. create/create divergent amount: sequential → 409 (fix, e2e T5); concurrent → DB backstop (partial unique) + P2002 catch.
3. create/create divergent reason: reason — metadata (документировано, не silent-incompatible).
4. resolve/resolve: 409 (e2e T3).
5. cancel/cancel: 409 (unit).
6. resolve/cancel: 409 terminal (e2e T3).
7. terminal + second create: RESOLVED → слот освобождён → новый факт (e2e T12); CANCELLED → новый факт (e2e T4). Инварианты: никогда 2 активных (DB), терминальный освобождает, 0 невозможных lifecycle/history, 0 raw 500.
- Тесты invariant-based, не scheduler-order-based.

## 34. Active-slot release atomicity — PASS
- `updateMany` data: `{ status: to, version: increment, [milestone]: now, isActiveDispute: !TERMINAL.includes(to) }` — status + milestone + slot-release в ОДНОМ атомарном UPDATE.
- Невозможны состояния RESOLVED+active=true / CANCELLED+active=true / OPENED+active=false (проверено unit: resolve/cancel → isActiveDispute false; e2e T3/T4 assert).

## 35. Event/history atomicity — PASS
- Outbox — transaction-scoped (emit в той же tx, что CAS); history создаётся в той же tx после count===1.
- Победитель не может закоммитить state без history/outbox (всё в одной транзакции).
- AuditLog — в той же tx (security.audit(tx, ...)), как Payment/Refund паттерн.

## 36. Provenance — PASS
- correlation=server UUID, causation=null для HTTP-команд (ADR-0010); actor=USER из JWT (контекст JwtAuthGuard → request-context).
- 0 клиентского forgin'а (actor/correlation/causation — forbidden).
- Provenance не влияет на business identity (amount — единственный divergent-компаратор).

## 37. Security/PII — PASS
- reason — free-text ≤255, descriptive; без passport/credentials/bank/evidence-blob; в DTO/events/history/audit — без raw body, без PII-эхо (e2e T11: keys не содержат pan/cvv/cardNumber/secret/firstName/passport).
- Evidence handling deferred — никакого evidence-blob в схеме.

## 38. API/docs consistency — PASS
- api.md/арх-док/Roadmap/отчёт ↔ фактический runtime: routes, request/response поля, статусы, Decimal-строки, permissions, error codes, deferred boundaries — консистентны (сверено).
- Документация расхождений не требует фикса (после обновления §9/§15 divergent semantics).

## 39. Roadmap consistency — PASS
- 2.12A–G НЕ помечены complete (остаются ⏳ NOT STARTED later extensions).
- Reconciliation prerequisites сохранены в записи 2.13A.
- Step 2.13A → ✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES.
- NEXT из фактического Roadmap: **Step 2.14 — Invoice / Commission Flow** (не начинается).

## 40. Review fixes
**FIX 1 (HIGH, production):** silent divergent idempotency success в `createDispute` —
divergent amount при активном Dispute теперь → controlled 409 (был молчаливый
no-op с чужой суммой; класс Ledger 2.10A FIX 1). Файлы: `dispute.service.ts`,
`dispute.service.spec.ts` (+1 unit), `chargeback-dispute-foundation.e2e-spec.ts`
(T5 расширен), арх-док §9, имплементационный отчёт §15. Тесты: unit 14/14,
e2e T5 → 409 assert, target e2e 108/108, serial e2e 1105/1105.

## 41. Deferred boundaries
real-PSP chargeback (2.12A/2.12B), won/lost liability-исход (2.12D/2.14A),
ledger/commission/settlement adjustments (2.12D/2.12C/2.14A), monetary netting
dispute vs refund (2.12D/2.14A), partial dispute slices (2.13A+/2.14+), Order-
проекция dispute state (не требуется Roadmap), evidence/liability runtime.

## 42. Exact NEXT item
`PHASE 2 — STEP 2.14 — INVOICE / COMMISSION FLOW` (не начинается в этом проходе).

## 43. Final certification
`PHASE 2 STEP 2.13A STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`

Независимый adversarial-аудит по промпту (52 секции): все hard gates PASS
(терминология, ownership/write-path, source authority, frozen money, cardinality,
CAS/lifecycle, temporal, изоляция Payment/Refund/Order/Booking, Ledger/ProviderFee/
Settlement/Commission/Invoice boundaries, PSP/webhook boundary, 2.12A–G containment,
events/audit/history/RBAC/mass-assignment/read-API/IDs/migration/fresh-replay).
Найден и исправлен 1 HIGH-дефект (silent divergent idempotency success — класс
прецедента Ledger 2.10A FIX 1). Финальная регрессия: unit 548/548, serial e2e
1105/1105 (63 suites), frontend 135/135 + build, migrate 54/54 drift 0.
