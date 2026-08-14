# PHASE 2 — STEP 2.13 — REFUND FLOW — STRICT REVIEW REPORT

## 1. Verdict
`PHASE 2 STEP 2.13 STRICT REVIEW COMPLETED — APPROVED (NO REVIEW FIXES REQUIRED)`

## 2. Repository baseline
- Branch `master`, HEAD `3e89387` (docs: Step 2.12 STRICT REVIEW), origin in sync (push не выполнялся в этом проходе).
- Working tree: изменения 2.13 (13 modified + 8 untracked) — всё относится к Step 2.13; никаких посторонних файлов.
- Migrations: 53/53 applied; latest `20260814150000_add_refund_runtime`; drift 0 («No difference detected»).
- Reported baseline подтверждён: unit **534/534**, serial e2e **1093/1093 (62 suites)**, frontend **135/135**, build ✓, migrate 53/53, drift 0.
- Roadmap: Step 2.13 → ✅ APPROVED; exact NEXT — Step 2.13A (Chargeback / Dispute Foundation), не начинается.

## 3. Sources inspected
- Roadmap v3 (§2.13/2.13A), промпт 2.13 (implementation + strict review), имплементационный отчёт.
- `schema.prisma`: Refund/RefundHistory модели, Order.refundedAmount, RefundStatus enum.
- `20260814150000_add_refund_runtime/migration.sql` (фактический SQL).
- `refund.service.ts` (фактический код), `refund.service.spec.ts`, `finance.validation.ts` (validateRefundAmount/REFUND_CREATE_FORBIDDEN_KEYS/CreateRefundDto/RefundListQueryDto), `finance.controller.ts` (refund routes), `finance.module.ts`.
- `order.subscribers.ts` (onRefundProcessed — Order-owned projection), `payment.service.ts` (контроль REFUNDED unreachable).
- `eventbus.service.ts` (emit/publishPending/outbox order), `domain-events.ts` (Refund* события + payload).
- `permissions.constants.ts` + `security.service.ts` (finance.refund.* RBAC-каталог).
- e2e `refund-flow.e2e-spec.ts` (T1–T13), эволюционированные foundation-тесты, phase2-entry-audit.
- Документация: `refund-flow.md`, `api.md`, `events.md`, `ids.md`.

## 4. Current→Target
| Аспект | Current (2.12/2.10 foundation) | Target (2.13) | Статус |
|---|---|---|---|
| Refund создание | schema-only, 0 writer-ов | Finance-owned RefundService (RFD-*) | ✅ |
| Lifecycle | — | REQUESTED → APPROVED → PROCESSED \| FAILED | ✅ |
| PSP refund | — | Deferred (2.13A+) | ✅ |
| Partial refunds | — | В scope (разные суммы — независимые факты) | ✅ |
| Milestones | — | requestedAt/approvedAt/processedAt/failedAt | ✅ |
| Payment impact | CAPTURED | НЕ мутируется (остаётся CAPTURED; REFUNDED reserved) | ✅ |
| Order projection | paymentStatus/paidAmount | + refundedAmount; полный возврат → REFUNDED | ✅ |
| Ledger posting | — | Deferred (2.12D) | ✅ |
| Commission reversal | — | Deferred (2.12C/E) | ✅ |

Reserved Payment.REFUNDED не активирован как runtime.

## 5. Refund ownership — HARD GATE PASS
Repo-wide перечислены все Refund writer-ы:
- `refund.service.ts`: `tx.refund.create` (createRefund) + `tx.refund.updateMany` (transition CAS) — единственный prod writer.
- `refund.service.spec.ts` — моки; e2e `refund-flow` — cleanup (`deleteMany` в afterAll); legacy `legacy/prisma/seed.ts` + legacy admin routes — отдельная legacy-кодовая база (вне Phase 2 runtime; не пишут в prod-БД backend-рантайма).
- 0 Order/Booking/Sales direct Refund writes, 0 raw SQL, 0 hidden writer.

## 6. Source Payment authority — CRITICAL PASS
- Refund создаётся ТОЛЬКО против CAPTURED Payment: `if (payment.status !== "CAPTURED") → ValidationDomainError 422` (PENDING/FAILED/CANCELLED/AUTHORIZED — все отклонены; unit + e2e T2).
- currency — verbatim `payment.currency`; orderId — server-derived `payment.orderId` (никакого live commercial lookup / Product/Tax/FX re-read).
- Unknown Payment → NotFoundError 404.
- e2e T2: PENDING → 422, unknown → 404.

## 7. Cardinality — CRITICAL PASS
- Partial refunds: несколько Refund на Payment (разные суммы — независимые факты; e2e T4: 40+60 на 100 → 2 факта).
- Idempotency slot: partial unique `Refund_one_active_per_payment_amount` на `(paymentId, amount) WHERE isActiveRefund = true`.
- `isActiveRefund=true` для REQUESTED/APPROVED/PROCESSED; `false` только FAILED (attempt 2 легален).
- Identical retry (paymentId+amount, НЕ-FAILED) → no-op существующий факт (findFirst в tx).
- Attempt 2 после FAILED — новый факт (e2e T6: 2 факта, слот освобождён).
- Concurrent duplicate → P2002 → controlled 409 (e2e T7: [201,409], ровно 1 факт).
- Future partial semantics не заблокированы (разные суммы — разные ключи; комментарий в миграции фиксирует эволюционный путь).

## 8. isActiveRefund consistency PASS
- Status↔flag invariant: REQUESTED/APPROVED/PROCESSED → true; FAILED → false (атомарно с CAS: updateMany где id+status+version; `isActiveRefund: !TERMINAL_RELEASE.includes(to)`).
- Не существует пути, где статус PROCESSED при isActiveRefund=false или FAILED при true.
- Unit: approve/process → true, fail → false; e2e T6: failed.isActiveRefund === false.

## 9. Status vocabulary PASS
- RefundStatus enum (schema foundation): REQUESTED/APPROVED/PROCESSED/FAILED — совпадает с Roadmap-милстоунами 2.10C (requestedAt/approvedAt/processedAt/failedAt).
- Payment `REFUNDED` остаётся reserved: единственное использование — Order.paymentStatus (Order-owned поле, законно: полный возврат). Payment.status writer-ов для REFUNDED — 0 (payment.service.ts transition: только PENDING → CAPTURED|FAILED|CANCELLED).
- e2e T11: payRow.status === CAPTURED, `not.toBe("REFUNDED")`.
- Архивное «refundedAt» не используется (канон — processedAt), docs консистентны.

## 10. State-machine authority PASS
- Единственный authority — `RefundService.transition` (private): CAS `updateMany where {id, status, version}` → ровно один победитель; from-guard (approve: from REQUESTED; process: from APPROVED; fail: from REQUESTED|APPROVED); повторный переход → 409.
- Controllers не пишут status напрямую (только делегируют RefundService).
- Unit: from-guard 409 для process-из-REQUESTED и approve-из-APPROVED; CAS-loss → 409 без duplicate history.

## 11. Partial refund semantics — CRITICAL PASS
- refundable = payment.amount − Σ(refund.amount WHERE status != FAILED) — e2e T4/T5/T8 доказывают.
- Partial (40) → Order остаётся PAID; суммарный полный возврат (100) → REFUNDED (e2e T4).
- Rounding: Decimal (12,2), строки, 0 float.
- Full-refund terminal: refundedAmount >= paidAmount → REFUNDED (Order projection).

## 12. Temporal contract — HARD GATE PASS
- requestedAt = create (REQUESTED); approvedAt = approve; processedAt = process; failedAt = fail — server-owned UTC, first-only (CAS гарантирует один победитель), атомарны с переходом (milestone в том же updateMany, что и status/version).
- 0 backfill; legacy-строк отсутствуют (таблица была пуста).
- `refundedAt` НЕ существует ни в схеме, ни в миграции (канон — processedAt).
- unit/e2e: milestones first-only, e2e T3: requestedAt/approvedAt/processedAt set, failedAt null.

## 13. Migration review PASS
- SQL инспектирован: аддитивные ALTER TABLE ADD COLUMN (4 milestones + isActiveRefund + Order.refundedAmount), CREATE UNIQUE INDEX partial, CREATE TABLE RefundHistory + FK (Cascade, как PaymentHistory), без backfill, без db push.
- `isActiveRefund BOOLEAN NOT NULL DEFAULT true` — безопасно: таблица Refund пуста (0 writer-ов до 2.13).
- migrate status: 53/53 up to date; drift 0 («No difference detected»); fresh replay — serial e2e harness (drop+recreate + migrate deploy) отработал.

## 14. IDs PASS
- RFD-* через `ids.nextCode(tx, "RFD")` в той же транзакции; DB unique (`code @unique`).
- ids.md: `RFD-` Refund уже зафиксирован (строка 39/86).
- Коллизия кода не трактуется как idempotency (findFirst идёт по paymentId+amount, не по code).

## 15. Money PASS
- Decimal только (`new Prisma.Decimal`), amount строки; DECIMAL(12,2) контракт.
- validateRefundAmount: > 0, ≤ 2 знаков, 0 float; currency verbatim из Payment.
- Refund.amount immutable после create (нет update путей).

## 16. Refundable amount — HARD GATE PASS
- Единственная формула: `refundable = payment.amount − Σ(non-FAILED refunds)`, вычисляется в той же tx под advisory lock.
- Payment.amount frozen (Payment immutable после create; 0 writer-ов amount).
- over-refund → ConflictError 409 (unit: 120 refunded на 150 → 409; e2e T5: 60+50 на 100 → 409).

## 17. Creation idempotency PASS
- Identical create → существующий факт (no-op) — findFirst по (paymentId, amount, isActiveRefund=true) в tx; e2e T5: dup.id === r1.id, count 1.
- Divergent amount на тот же payment → новый факт если ≤ refundable, иначе 409 (e2e T4/T5).
- Attempt 2 после FAILED → новый факт (e2e T6).
- После PROCESSED: identical → no-op (слот занят), другой amount → 409 если > refundable.
- Concurrent initial create → один факт, проигравший controlled 409 (e2e T7).

## 18. Over-refund / race — CRITICAL PASS
- `pg_advisory_xact_lock(hashtext('refund:' + paymentId))` внутри той же tx, ДО aggregate+create; lock сериализует concurrent refund'ы одного payment (освобождается на commit/rollback).
- Проект-паттерн: атомарная capacity-защита (как reserveAvailability), без мутации Payment.
- e2e T8: 70+70 на 100 → ровно 1 факт 70, total ≤ 100, проигравший 4xx (не raw 500).
- TOCTOU отсутствует: sum+create под lock в одной tx.

## 19. Divergent replay PASS
- (paymentId, amount) — бизнес-ключ idempotency; divergent payload (другой amount) не поглощается no-op-ом (создаётся факт или 409 over-refund).
- Code-коллизии не трактуются как replay.

## 20. P2002 PASS
- `Refund_one_active_per_payment_amount` обрабатывается интентно: catch → ConflictError 409 (createRefund).
- Code unique — не replay (не ловится).
- Неизвестный P2002 не глотается (throw err).

## 21. Concurrency PASS
- e2e T7 (concurrent identical) и T8 (concurrent over-refund) — реальные race-прогоны, ассертят loser + controlled status + количество фактов.
- CAS-transition (approve/process/fail) — updateMany where id+status+version, проигравший 409 без duplicate history/milestone/event (unit CAS-loss test).
- 0 raw 500 в race-путях.

## 22. Creation authority PASS
- `POST /api/v1/finance/refunds` — `finance.refund.write` (FINANCE/ADMIN). Buyer-route отсутствует (Buyer refund-request — Customer Support flow, future, документировано).
- e2e T9: anonymous 401, SALES/DIRECTOR write 403, FINANCE 201.

## 23. RBAC PASS
- `finance.refund.read` — FINANCE/DIRECTOR/ANALYST/SALES_MANAGER (+ADMIN через ALL_PERMISSIONS).
- `finance.refund.write` (create/process/fail) — FINANCE (+ADMIN). Добавлен в 2.13 (permissions.constants + security.service каталог).
- `finance.refund.approve` — FINANCE (+ADMIN).
- OPERATOR — НЕ имеет finance.refund.* (проверено фактическим ROLE_PERMISSIONS: в списке OPERATOR finance.* отсутствуют) — docs (арх-док §27, api.md, Roadmap) консистентны, ошибки 2.12 (OPERATOR read) не повторены.
- e2e T9: approve 403 для SALES, 201 для FINANCE; read 200 для SALES.

## 24. Mass assignment PASS
- `REFUND_CREATE_FORBIDDEN_KEYS` (raw-body, loud 422): id/code/status/currency/orderId/customerId/version/createdAt/updatedAt/requestedAt/approvedAt/processedAt/failedAt/isActiveRefund/providerRef.
- Клиент передаёт только paymentId + amount + reason.
- e2e T10: 7 forged-вариантов → 422, count 0.

## 25. IDOR PASS
- Unknown Refund (read/approve) → 404 (e2e T9); чужие order/payment refs не раскрываются (list/detail по code, нейтральные 404).

## 26. Events — HARD GATE PASS
- RefundCreated (create), RefundApproved (approve), RefundProcessed (process), RefundFailed (fail) — ровно по одному на реальный переход; 0 на no-op (createRefund early-return до emit; transition 409 до emit).
- Payload: refundId/code/paymentId/orderId/amount/currency/reason — PII-free (e2e T12).
- correlation=server UUID, causation=null для HTTP-команд (ADR-0010).
- Consumer: Order projection на RefundProcessed (inbox dedup).

## 27. Order refund projection — CRITICAL PASS
- Finance НЕ пишет order.*: RefundService 0 обращений к tx.order (проверено кодом).
- Order-owned subscriber `onRefundProcessed` (order-refund-consumer): InboxEvent dedup; CAS по version (updateMany where id+version).
- refundedAmount += frozen amount (Decimal из payload, defensive >= 0, invalid → error, повторная доставка no-op).
- Полный возврат (refunded >= paidAmount) → paymentStatus REFUNDED; partial → PAID; paidAmount исторический не переписывается (e2e T3: paidAmount === amount).
- Duplicate event → InboxEvent no-op.

## 28. Order projection races PASS
- publishPending обрабатывает события последовательно (в порядке createdAt), PaymentCaptured всегда раньше RefundProcessed (emit-order: refund требует CAPTURED) — out-of-order невозможен.
- CAS-loss (concurrent Order update): проигравший не пишет history, inbox помечен — факт остаётся в Refund aggregate (reconcile-паттерн, как 2.12 §28).
- Defensive clamp: refunded не может превысить paidAmount (проекция не уходит в ложную truth).

## 29. Booking isolation PASS
- RefundService/Order subscriber: 0 обращений к booking.* / availability.* (проверено кодом + e2e T11: bookings/availabilityReservation counts не меняются).

## 30. Ledger boundary PASS
- RefundService: 0 LedgerTransaction create (boundary 2.12D deferred); e2e T11: ledger count не меняется.

## 31. ProviderFee boundary PASS
- 0 ProviderFee create (никакого fabricated refund fee); e2e T11: fees count не меняется.

## 32. Commission boundary PASS
- 0 Commission/CommissionAccrual reversal/netting; e2e T11: counts не меняются.

## 33. Settlement/Payout boundary PASS
- 0 Settlement/Payout mutation; e2e T11: counts не меняются.

## 34. Invoice boundary PASS
- 0 Invoice/credit-note; e2e T11: invoices count не меняется.

## 35. PSP/webhook boundary PASS
- Repo-wide: 0 Stripe/webhook/callback/signature в prod-путях (refund-flow: manual/provider-neutral; PSP — 2.13A+).
- providerRef отсутствует в create-входе (forbidden key).

## 36. PII/PCI/secrets PASS
- Refund DTO/events/history: refs + frozen money + reason; 0 PAN/CVV/card/bank/secrets/traveler PII (e2e T12 assert; RefundHistory comment — без PII).

## 37. RefundHistory PASS
- Одна строка на реальный переход (created/approved/processed/failed); no-op/409/stale → 0 (unit CAS-loss: history не создаётся).
- from/to/action аккуратные; sensitive payload отсутствует.

## 38. AuditLog PASS
- finance.refund.created/approved/processed/failed — минимальные детали (code/from/to), корректный actor (USER из JWT), 0 дублей на no-op.

## 39. Correlation/causation/actor PASS
- HTTP-команды: server UUID correlation, causation null, USER actor (контекст JwtAuthGuard).
- Consumer (Order projection): causation = RefundProcessed event id, correlation inherited (runWithRequestContext в publishPending).

## 40. Legacy PASS
- Schema-only Refund-строки до 2.13: таблица пуста (0 writer-ов) — миграция additive-only, без backfill; legacy-админка (legacy/) не имеет доступа к новым колонкам — безопасна.
- Read DTO не фабрикует milestones/history.

## 41. Write-path audit PASS
Prod writer-ы:
- Refund: `RefundService.createRefund` (create) + `RefundService.transition` (updateMany CAS) — единственные.
- status writers: RefundService.transition (CAS) — единственный.
- isActiveRefund: create (true) + transition (CAS) — единственные.
- milestones: create (requestedAt) + transition (approvedAt/processedAt/failedAt) — единственные.
- Order.paymentStatus: init UNPAID (2.6) + order.subscribers (PaymentCaptured→PAID, RefundProcessed→REFUNDED/PAID) + order lifecycle (reconcile) — все Order-owned, approved.
- Order.paidAmount: init 0 + order.subscribers PaymentCaptured — approved.
- Order.refundedAmount: init 0 (миграция) + order.subscribers RefundProcessed — единственный runtime writer.
- Payment.status: PaymentService.transition — единственный (REFUNDED не пишется).
Unsafe = 0.

## 42. Reprice/refundable audit PASS
- Refund-путь читает: Payment (findUnique, frozen), Refund aggregate sum. 0 Product/Tariff/Tax/FX reads (проверено кодом: нет обращений к catalog/tax/FX).
- e2e T13: BUYER_REQUEST acquisitionSource ортогонален — та же frozen source-семантика.

## 43. Negative coverage PASS (реальные тесты)
401 (T9), 403 write/approve (T9), 404 unknown payment/refund (T2/T9), non-CAPTURED 422 (T2 + unit), forged amount/currency/status/orderId/version/milestones/isActiveRefund/code 422 (T10 + unit), zero/negative/malformed 422 (unit), refund > refundable 409 (T5 + unit), duplicate identical no-op (T5 + unit), divergent replay (T4/T5), concurrent duplicate 409 (T7), concurrent over-refund race total ≤ amount (T8), invalid transition 409 (T3/unit), CAS-loss 409 (unit), price change no effect (frozen payment, T11), no direct Order write (T3 asserts Order-owned projection), no Booking (T11), no Availability (T11), no ProviderFee/Commission/Settlement/Payout/Invoice/Ledger (T11), no webhook (repo audit), no PII (T12), no raw 500 (T7/T8 assert status < 500).

## 44. Positive coverage PASS
canonical create RFD-* (T1), source Payment linkage (T1), amount/currency verbatim (T1), REQUESTED + requestedAt (T1), full lifecycle + first-only milestones (T3), identical replay no-op (T5), attempt 2 после FAILED (T6), partial 40+60 → PAID→REFUNDED (T4), full refund → Order REFUNDED + refundedAmount (T3), Order projection refundedAmount/paidAmount (T3), events + correlation (T3), RBAC (T9), BUYER_REQUEST (T13), fresh replay (harness).

## 45. Backend regression PASS
- tsc --noEmit ✓; build ✓; unit **534/534** (44 suites, +0 к baseline — refund unit уже включён).
- Targeted e2e `--runInBand` (refund-flow, payment-flow, finance-domain-foundation, phase2-entry-audit, order-temporal, pricing-financial-snapshot, ledger-foundation, provider-fee-foundation, finance-temporal, booking-temporal, rbac): **122/122 (9 suites)**.
- Полный serial e2e: **1093/1093 (62 suites)** — совпадает с baseline (1093).

## 46. Frontend regression PASS
- tsc ✓; Vitest **135/135** (23 files); production build ✓ (Compiled successfully).

## 47. DB regression PASS
- migrate status: 53/53 up to date; fresh replay (harness drop+recreate + migrate deploy) в serial e2e; drift 0 («No difference detected»); migrate deploy (не db push).

## 48. Issues found
Ноль дефектов.

## 49. Review fixes
Не требуется (0 фиксов). Отмечено: api.md RBAC-claim OPERATOR уже исправлен в имплементации 2.13 (пропуск 2.12-fixa) — подтверждено консистентностью всех трёх источников (арх-док §27 / api.md / Roadmap): OPERATOR НЕ имеет finance.refund.*.

## 50. Architecture decision status
Архитектурных блокеров нет. Подтверждённые решения (выведены из канонических контрактов, не изобретены):
- Payment остаётся CAPTURED при refund'ах; Payment.REFUNDED reserved unreachable (partial refund делает одиночный REFUNDED семантически неверным — правда живёт в Refund-фактах).
- Idempotency-slot (paymentId+amount) + isActiveRefund: консервативно блокирует второй идентичный partial refund (DB backstop); attempt 2 после FAILED легален.
- Милстоуны requestedAt/approvedAt/processedAt/failedAt (канон Roadmap 2.10C); «refundedAt» не используется.

## 51. Documentation status PASS
- `refund-flow.md` (32 секции) — источник истины; `api.md` (Refund-контракт + Order projection), `events.md` (4 события + consumer), `ids.md` (RFD-*) — все консистентны с кодом и Roadmap.
- Отделены: current provider-neutral 2.13 / PSP refund 2.13A+ / Payment REFUNDED reserved / ledger posting 2.12D deferred / commission reversal deferred.

## 52. Roadmap update
Step 2.13 → `✅ STRICT REVIEW COMPLETED — APPROVED (NO REVIEW FIXES REQUIRED)`.
Exact NEXT (из Roadmap) — **Step 2.13A — Chargeback / Dispute Foundation** (не начинается).

## 53. Deferred/out-of-scope
PSP/chargeback (2.13A+), ledger posting (2.12D), commission reversal (2.12C/E), Settlement/Payout netting, Invoice/credit-note (2.14), Buyer refund-request (Customer Support flow), double-entry/balances, provider refund identity (нет PSP).

## 54. Exact files changed
Промпт ревью (новый): `docs/prompts/PHASE_2_STEP_2.13_REFUND_FLOW_STRICT_REVIEW.md`.
Отчёт (новый): `docs/prompts/PHASE_2_STEP_2.13_REFUND_FLOW_STRICT_REVIEW_REPORT.md`.
Roadmap: `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md` (2.13 статус → APPROVED).

## 55. Exact NEXT item
`PHASE 2 — STEP 2.13A — CHARGEBACK / DISPUTE FOUNDATION` (не начинается в этом проходе).

## 56. Final certification
`PHASE 2 STEP 2.13 STRICT REVIEW COMPLETED — APPROVED (NO REVIEW FIXES REQUIRED)`
