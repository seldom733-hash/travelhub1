# PHASE 2 — ROADMAP RECONCILIATION AUDIT — STEPS 2.12A–2.12G vs 2.13 / 2.13A

## 0. ROLE

Ты выполняешь независимый Roadmap Reconciliation Audit проекта TravelHub.

Это НЕ implementation pass и НЕ Strict Review конкретного шага.

Цель — проверить фактический canonical Roadmap, код, approved reports и dependency graph вокруг:
- Step 2.12 — Payment Flow;
- Steps 2.12A–2.12G;
- Step 2.13 — Refund Flow;
- Step 2.13A — Chargeback / Dispute Foundation.

Ключевой вопрос:
были ли Steps 2.12A–2.12G ошибочно пропущены перед 2.13, являются ли они обязательными prerequisites для 2.13/2.13A, либо Roadmap допускает их как later extensions.

Не доверяй старым NEXT markers без проверки актуального Roadmap.

## 1. CURRENT CERTIFIED STATE

Проверить по repository:
- Step 2.12 — Strict Review approved with review fixes;
- Step 2.13 — Strict Review approved with no review fixes;
- Roadmap сейчас показывает NEXT = Step 2.13A;
- Steps 2.12A–2.12G не проходили отдельные implementation+strict-review passes.

## 2. REQUIRED SOURCES

Обязательно изучить:
1. `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`
2. execution-sequence / summary sections Roadmap
3. Step 2.12 implementation prompt/report
4. Step 2.12 strict-review prompt/report
5. Step 2.13 implementation prompt/report
6. Step 2.13 strict-review prompt/report
7. `docs/architecture/payment-flow.md`
8. `docs/architecture/refund-flow.md`
9. Finance architecture docs 2.10–2.11
10. `docs/contracts/api.md`
11. `docs/contracts/events.md`
12. `backend/prisma/schema.prisma`
13. PaymentService / Payment controller / Payment subscribers
14. RefundService / Refund controller / Refund subscribers
15. LedgerService
16. ProviderFee / Settlement / Payout services
17. Commission / CommissionAccrual code
18. PSP/provider/webhook code
19. partial-payment code
20. chargeback/dispute code
21. migrations after Step 2.12
22. tests proving deferred boundaries.

Repo-wide search:
`2.12A`, `2.12B`, `2.12C`, `2.12D`, `2.12E`, `2.12F`, `2.12G`, `2.13A`, `PSP`, `webhook`, `authorizedAt`, `capturedAt`, `Commission`, `CommissionAccrual`, `LedgerTransaction`, `partial payment`, `ProviderFee`, `feeType`, `Chargeback`, `Dispute`, `Settlement`, `Payout`.

## 3. DO NOT IMPLEMENT

Не начинать 2.12A–2.12G, не менять Payment/Refund runtime, не начинать 2.13A, не создавать migrations/schema/events/RBAC changes.

Разрешены только audit, reconciliation и Roadmap/docs metadata correction, если порядок доказанно неверен.

## 4. BUILD THE CANONICAL STEP TABLE

Из фактического Roadmap выписать точные canonical titles/scopes:

| Step | Exact canonical title | Declared purpose | Declared predecessor | Declared successor | Current status |
|---|---|---|---|---|---|
| 2.12 | | | | | |
| 2.12A | | | | | |
| 2.12B | | | | | |
| 2.12C | | | | | |
| 2.12D | | | | | |
| 2.12E | | | | | |
| 2.12F | | | | | |
| 2.12G | | | | | |
| 2.13 | | | | | |
| 2.13A | | | | | |

Не переименовывать по памяти.

## 5. EXECUTION-SEQUENCE RECONCILIATION — HARD GATE

Сравнить:
- body Roadmap;
- summary/execution sequence;
- NEXT markers;
- status markers;
- architecture docs;
- implementation/review reports.

Выявить:
- body vs summary conflict;
- stale NEXT;
- accidental skip;
- intentional deferred/later-extension semantics.

Если Roadmap внутренне противоречив:
`ROADMAP RECONCILIATION BLOCKED — ARCHITECTURE DECISION REQUIRED`.

## 6. DEPENDENCY GRAPH

Для каждого 2.12A–2.12G определить:
- prerequisites;
- what it extends;
- whether required before 2.13;
- whether required before 2.13A;
- whether safe after already-approved 2.13.

Create:

| Step | Depends on 2.12 core | Required before 2.13? | Required before 2.13A? | Safe after 2.13? | Evidence |
|---|---:|---:|---:|---:|---|

## 7. STEP 2.12A ASSESSMENT

Определить exact canonical scope.

Проверить, относится ли к PSP/provider integration, provider intent, webhook, adapter или иному.

Ответить:
1. нужен ли для Refund 2.13;
2. использует ли Refund provider-specific behavior;
3. был ли 2.13 provider-neutral intentionally;
4. можно ли добавить 2.12A после 2.13 additive-only.

## 8. STEP 2.12B ASSESSMENT

Определить exact scope.

Особенно проверить authorization/capture/provider transaction lifecycle/authorizedAt/capturedAt.

Сопоставить с текущим:
- PENDING → CAPTURED | FAILED | CANCELLED;
- paidAt on CAPTURED;
- AUTHORIZED reserved;
- authorizedAt/capturedAt deferred.

Проверить, не требует ли 2.13 отсутствующего AUTHORIZED/capturedAt.

## 9. STEP 2.12C ASSESSMENT

Определить exact scope.

Если Commission:
- доказать, что Refund 2.13 не зависит от Commission;
- проверить необходимость commission reversal before Refund;
- определить prerequisite relation.

## 10. STEP 2.12D ASSESSMENT

Определить exact scope.

Если Payment→Ledger posting:
- подтвердить Payment/Refund currently keep Ledger count 0;
- определить, required ли до Chargeback;
- проверить safe execution after 2.13.

## 11. STEP 2.12E ASSESSMENT

Определить exact scope и связь с 2.12C / Settlement / Payout / Commission.

## 12. STEP 2.12F ASSESSMENT

Определить exact scope.

Если partial/split payments:
- сравнить с `isActivePayment` + one-active-per-order;
- проверить future evolution;
- проверить, зависит ли partial Refund implementation от partial Payment support;
- required ли до 2.13A.

## 13. STEP 2.12G ASSESSMENT

Определить exact scope.

Если ProviderFee granularity:
- сопоставить с 2.10B deferred `feeType` discriminator;
- prerequisite relation к Payment/Refund/Chargeback.

## 14. CURRENT 2.13 COMPATIBILITY — HARD GATE

Для каждого missing 2.12A–G проверить:
- использует ли Refund semantics, которых нет;
- создана ли fake placeholder semantics;
- есть ли schema field whose meaning later changes;
- есть ли idempotency key requiring destructive replacement;
- есть ли event contract requiring break.

Outcomes:
- `COMPATIBLE — NO ROLLBACK REQUIRED`
- `REQUIRES FOLLOW-UP IMPLEMENTATION`
- `REQUIRES REOPEN / RE-REVIEW`

## 15. CURRENT 2.13A READINESS — HARD GATE

До Chargeback/Dispute определить prerequisites:
- real PSP/provider identity;
- Payment authorization/capture;
- provider transaction IDs;
- Refund interaction;
- Ledger posting;
- dispute callbacks;
- commission/fee reversals.

Если 2.13A зависит от невыполненных 2.12A–G:
**2.13A MUST NOT START**.

## 16. MIGRATION COMPATIBILITY

Проверить migrations 2.12 + 2.13:
- additive;
- unique indexes;
- active flags;
- Payment/Refund cardinality;
- provider refs;
- milestones.

Определить, можно ли 2.12A–G добавить без destructive rewrite.

Особенно:
- one-active-per-order;
- Refund idempotency invariant;
- provider attempts;
- partial payments;
- feeType evolution.

## 17. EVENT COMPATIBILITY

Audit current durable Payment/Refund events.

Определить, можно ли 2.12A–G расширить additively.

Breaking rename/version change = risk.

## 18. TEMPORAL COMPATIBILITY

Audit:
- paidAt;
- failedAt;
- cancelledAt;
- Refund requested/approved/processed/failed milestones;
- deferred authorizedAt/capturedAt.

Проверить future 2.12B compatibility.

Если paidAt/capturedAt semantics conflict:
`ROADMAP RECONCILIATION BLOCKED — ARCHITECTURE DECISION REQUIRED`.

## 19. MONEY COMPATIBILITY

Future PSP/commission/ledger/partial features must not retroactively reprice:
- Order;
- Booking;
- Payment;
- Refund.

## 20. ROADMAP STATUS AUDIT

Для каждого 2.12A–G определить exact status:
- NOT STARTED;
- PARTIALLY PRE-IMPLEMENTED;
- FOUNDATION EXISTS FROM EARLIER STEP;
- IMPLEMENTATION COMPLETED;
- STRICT REVIEW APPROVED.

Не маркировать completed только из-за наличия отдельных полей/code.

## 21. RECOMMENDED EXECUTION ORDER

Produce exactly one evidence-based order.

Possible outcome types:

### A — accidental skip
`2.12A → SR → ... → 2.12G → SR → 2.13A`

### B — later extensions
`2.13A may proceed`, while 2.12A–G are intentionally later.

### C — mixed dependency
Например, часть 2.12A/B/D required before 2.13A, остальные later.

Не выбирать заранее.

## 22. ROLLBACK / REOPEN ASSESSMENT

Определить статус уже закрытого 2.13:
- leave approved;
- reopen implementation;
- reopen strict review;
- leave approved but mark executed out of canonical sequence.

Предпочтение: не откатывать корректную additive работу только из-за scheduling, если dependencies satisfied.

## 23. ROADMAP CORRECTION POLICY

Если NEXT/status markers неверны, исправить metadata/order markers only.

Не переписывать canonical scope.

Preserve historical truth: если 2.13 выполнен раньше skipped substeps, это должно быть явно отмечено.

## 24. REQUIRED NEGATIVE CHECKS

Prove:
1. no PSP/webhook if 2.12A/B unimplemented;
2. AUTHORIZED unreachable if 2.12B unimplemented;
3. no CommissionAccrual if 2.12C/E unimplemented;
4. no Payment→Ledger if 2.12D unimplemented;
5. no partial Payment if 2.12F unimplemented;
6. no feeType granularity if 2.12G unimplemented;
7. Refund did not silently implement those scopes;
8. Chargeback/Dispute not started;
9. no false approved markers.

## 25. REQUIRED POSITIVE CHECKS

Prove:
1. 2.12 core works independently if designed so;
2. 2.13 works independently if true;
3. future evolution is additive;
4. migrations remain valid;
5. events extensible;
6. no rollback required if sequence corrected.

## 26. ARCHITECTURE STOP CONDITIONS

Return:
`ROADMAP RECONCILIATION BLOCKED — ARCHITECTURE DECISION REQUIRED`

if:
1. Roadmap body and sequence materially conflict;
2. 2.12A–G scopes unclear;
3. 2.13 correctness depends on skipped semantics;
4. 2.13A depends on undefined provider/ledger/partial/commission order;
5. future 2.12A–G require destructive rework;
6. paidAt/capturedAt semantics conflict;
7. Refund/Payment projections conflict with future partial payments;
8. Chargeback requires real PSP but Roadmap places 2.13A before PSP.

## 27. NO IMPLEMENTATION FIXES

Не патчить production code.

Если code issue влияет на sequence:
`REQUIRES FOLLOW-UP IMPLEMENTATION`.

## 28. REQUIRED REPORT

Create:
`docs/prompts/PHASE_2_ROADMAP_RECONCILIATION_2.12A_TO_2.13A_REPORT.md`

Sections:
1. Verdict
2. Repository baseline
3. Sources inspected
4. Canonical Roadmap step table
5. Body vs execution-sequence reconciliation
6. Dependency graph
7. Step 2.12A assessment
8. Step 2.12B assessment
9. Step 2.12C assessment
10. Step 2.12D assessment
11. Step 2.12E assessment
12. Step 2.12F assessment
13. Step 2.12G assessment
14. Step 2.13 compatibility
15. Step 2.13A readiness
16. Migration compatibility
17. Event compatibility
18. Temporal compatibility
19. Money compatibility
20. Current status of every 2.12A–G
21. Negative checks
22. Positive checks
23. Rollback/reopen assessment
24. Exact recommended execution order
25. Roadmap corrections applied
26. Architecture decision status
27. Follow-up implementation requirements
28. Exact NEXT item
29. Final conclusion

## 29. VERDICT

Allowed:
`ROADMAP RECONCILIATION COMPLETED — SEQUENCE CONFIRMED`

`ROADMAP RECONCILIATION COMPLETED — SEQUENCE CORRECTED`

`ROADMAP RECONCILIATION COMPLETED — MIXED DEPENDENCY ORDER ESTABLISHED`

`ROADMAP RECONCILIATION BLOCKED — ARCHITECTURE DECISION REQUIRED`

## 30. HARD STOP

After audit report + permitted Roadmap metadata correction:

STOP.

Do not begin any implementation step.
