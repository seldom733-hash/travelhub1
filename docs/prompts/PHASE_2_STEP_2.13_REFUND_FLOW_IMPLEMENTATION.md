# PHASE 2 — STEP 2.13 — REFUND FLOW — IMPLEMENTATION PROMPT

## 0. ROLE

Ты работаешь в существующем проекте **TravelHub** как Senior/Staff Backend Engineer + Domain Architect.

Твоя задача — реализовать только:

**PHASE 2 — STEP 2.13 — REFUND FLOW**

Это **implementation pass**, не Strict Review.

Перед изменениями обязательно сверить фактическое состояние репозитория: Prisma schema, migration history, Finance runtime, Payment flow, Order/Booking projections, EventBus contracts, RBAC, tests и canonical Roadmap.

Не доверяй предыдущим отчётам как единственному источнику истины.

---

# 1. REQUIRED FINAL VERDICT

Успешный финальный verdict:

`PHASE 2 STEP 2.13 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

Если необходимое решение нельзя безопасно вывести из approved contracts:

`PHASE 2 STEP 2.13 BLOCKED — ARCHITECTURE DECISION REQUIRED`

Strict Review 2.13 **не выполнять** в этом проходе.

Не начинать Step 2.14+.

---

# 2. APPROVED BASELINE — MUST PRESERVE

Перед реализацией независимо подтвердить:

- Step 2.10 — Finance Domain Foundation — approved;
- Step 2.10A — Ledger Transaction Foundation — approved with review fixes;
- Step 2.10B — Provider Fee / Settlement / Payout Foundation — approved with review fixes;
- Step 2.10C — Finance Temporal Contract — approved with review fixes;
- Step 2.11 — Pricing & Financial Snapshot — approved with review fixes;
- Step 2.12 — Payment Flow — approved with review fixes.

Ожидаемый baseline, который нужно проверить:

- backend unit: `520/520`;
- serial e2e: `1080/1080`, 61 suites;
- frontend: `135/135`;
- migrations: `52/52`;
- drift 0.

Сохранить:

- Payment Finance-owned;
- frozen Order amount/currency;
- no repricing;
- Payment state machine current 2.12 contract;
- `PAID = CAPTURED`;
- Payment milestones current 2.12 contract;
- Order payment projection updated only by Order-owned subscriber;
- Booking/Availability untouched by Payment;
- Ledger auto-posting deferred unless later Roadmap explicitly activates;
- ProviderFee ≠ Commission;
- Settlement ≠ Payout;
- Payment ≠ Payout;
- strict P2002/idempotency behavior;
- no direct cross-domain writes;
- no fabricated financial history.

---

# 3. OBJECTIVE

Implement the first canonical **Refund Flow** as a Finance-owned runtime.

Core principle:

> **Refund is a new immutable/operational financial fact derived from an already-captured Payment; it must never rewrite the historical Payment amount or frozen commercial snapshot.**

Refund must not:
- reprice Order;
- mutate Booking money;
- rewrite Payment.amount;
- rewrite Sale/Order historical pricing;
- become Settlement/Payout logic;
- become Commission reversal logic;
- become double-entry accounting.

---

# 4. REPOSITORY-FIRST RECONCILIATION

До production changes изучить:

- `backend/prisma/schema.prisma`;
- existing schema-only Refund model;
- Payment model/service/controller/history;
- current Payment statuses;
- PaymentCaptured/Failed/Cancelled events;
- Order paymentStatus/paidAmount projection;
- current Refund-like fields if any;
- LedgerTransaction;
- ProviderFee;
- Settlement/Payout;
- Invoice/Commission models;
- PaymentTerms;
- Sales money contract;
- Finance money helpers;
- RBAC;
- IdsService;
- EventBus / Outbox / Inbox;
- api.md / events.md / ids.md;
- `payment-flow.md`;
- Roadmap Step 2.13 and follow-on 2.14+;
- Screen Design refund codes/statuses, если присутствуют.

Repo-wide search:

`Refund`
`RefundStatus`
`refundedAt`
`refundAmount`
`PaymentRefund`
`refund`
`PaymentCaptured`
`PaymentStatus`
`REFUNDED`
`partial refund`
`LedgerTransaction`
`Order.paidAmount`
`Order.paymentStatus`
`ProviderFee`
`Commission`
`Settlement`
`Payout`

Создать Current→Target map до изменений.

---

# 5. REFUND OWNERSHIP — HARD GATE

Refund должен принадлежать `finance.*`.

Разрешено:
- Finance RefundService создаёт/управляет Refund;
- Payment/Refund events используются как cross-domain contract.

Запрещено:
- Order создаёт Refund;
- Booking создаёт Refund;
- Sales пишет Refund;
- RefundService напрямую пишет Order/Booking;
- PSP adapter напрямую пишет Order/Booking.

Если правильный flow требует direct Finance → Order/Booking writes:

`ARCHITECTURE DECISION REQUIRED`

---

# 6. REFUND SOURCE AUTHORITY — CRITICAL HARD GATE

Определить canonical source Refund.

Ожидаемый кандидат — CAPTURED Payment.

Нужно доказать:

- Refund не может ссылаться на PENDING/FAILED/CANCELLED Payment;
- refund currency = Payment.currency;
- refundable amount derivation;
- Payment identity;
- Order relation через Payment, а не live commercial lookup;
- no Product/Tax/FX re-read.

Если Refund можно создавать не из Payment — доказать это canonical Roadmap.

Если source authority неоднозначен: STOP.

---

# 7. REFUND CARDINALITY — CRITICAL

До schema/runtime определить:

- один Refund на Payment?
- несколько Refund на Payment?
- partial refunds?
- multiple refund attempts?
- refund attempt vs refund business fact?

Не создавать unique `paymentId` если later canonical partial/multi-refund semantics этого не допускают.

Проверить Roadmap:
- если partial refund deferred — foundation не должен необратимо блокировать его;
- если partial refund входит уже в 2.13 — реализовать корректно.

Если cardinality необходима, но не определена:

`ARCHITECTURE DECISION REQUIRED`

---

# 8. REFUNDABLE AMOUNT — HARD GATE

Определить canonical formula только из approved source.

Возможные варианты:

`refundable = capturedAmount - alreadyRefundedAmount`

или другой approved контракт.

Не предполагать.

Нельзя:
- refund > captured amount;
- negative/zero refund where invalid;
- change currency;
- derive from current Order total if Payment is authority;
- use JS float.

Если partial refund не поддерживается:
- exact/full refund semantics должны быть explicit.

---

# 9. PAYMENT `REFUNDED` STATUS — CRITICAL REVIEW

В 2.12 `REFUNDED` был reserved vocabulary.

Теперь проверить Roadmap:

- должен ли Step 2.13 активировать Payment.REFUNDED?
- или Refund существует отдельно, а Payment status остаётся CAPTURED?

Не активировать `REFUNDED` автоматически без canonical contract.

Если Refund can be partial, single Payment.REFUNDED may be semantically wrong.

Если docs конфликтуют:

`ARCHITECTURE DECISION REQUIRED`

---

# 10. REFUND STATUS VOCABULARY

Derive Refund statuses from actual schema/Roadmap/Screen Design.

Для каждого:
- meaning;
- terminal/non-terminal;
- producer;
- allowed predecessor;
- event;
- milestone;
- retry semantics.

Не создавать generic statuses:
`PENDING/PROCESSING/SUCCESS/FAILED`
просто по привычке, если canonical vocabulary другой.

---

# 11. SINGLE REFUND STATE MACHINE AUTHORITY — HARD GATE

Если Refund lifecycle mutable:

- один canonical authority (`RefundService.TRANSITIONS` или equivalent);
- controllers не пишут status напрямую;
- provider adapters не имеют alternate matrix;
- CAS/version;
- from-state guard;
- transition + milestone + history + outbox atomic.

Repo-wide audit всех Refund.status writers.

---

# 12. REFUND CREATION

Определить canonical creation command.

Требования:
- Finance-owned;
- canonical ID/code;
- source Payment;
- amount/currency server-derived or server-validated;
- no repricing;
- no direct Order/Booking write;
- idempotent;
- concurrency-safe;
- no Ledger/Commission/Settlement side effects unless Roadmap explicitly включает.

---

# 13. IDENTIFIER CONTRACT

Проверить существующий Refund prefix в ids.md/schema.

Если есть — использовать его.

Если нет — новый prefix только если Step 2.13 действительно вводит public/domain Refund identity.

IdsService:
- same tx;
- DB unique;
- concurrency-safe;
- no MAX()+1.

---

# 14. MONEY CONTRACT

Refund money:

- Decimal only;
- same precision/scale as canonical Payment money unless approved reason;
- no float;
- no alternate rounding;
- currency copied from Payment;
- API string serialization.

Refund.amount immutable after creation unless canonical model explicitly treats Refund as mutable request before provider execution.

Не допускать silent amount rewrite.

---

# 15. PARTIAL REFUND SEMANTICS — ARCHITECTURE GATE

Если partial refunds in scope:

Определить:
- multiple Refund rows vs one mutable Refund;
- total already refunded;
- remaining refundable;
- concurrent refunds;
- exact DB invariant preventing over-refund;
- rounding;
- terminal full-refund state;
- Order projection semantics.

Не использовать read-then-write check без atomic protection.

Если partial semantics deferred:
- не создавать API/fields pretending support;
- model должен быть evolvable.

---

# 16. ATOMIC OVER-REFUND PROTECTION — CRITICAL

Если multiple/partial Refunds possible:

`SELECT sum(refunds)` + create без lock/CAS недостаточно.

Нужна DB-safe/transaction-safe защита от двух concurrent refunds превышающих Payment amount.

Варианты только согласно project patterns:
- serialized advisory lock;
- payment version/CAS + aggregate calculation inside tx;
- dedicated remaining amount invariant.

Обязательный race test:
две concurrent refund requests, каждая отдельно допустима, вместе > captured amount.

Результат:
- допустимый total <= captured;
- loser controlled conflict;
- raw 500 = 0.

---

# 17. PSP BOUNDARY

Определить по Roadmap:
- provider-neutral Refund foundation сейчас?
- actual PSP refund позже?

Не предполагать Stripe.

Если PSP refund deferred:
- no external calls;
- no webhook;
- no provider secrets;
- lifecycle должен честно отражать internal foundation semantics.

Если PSP в 2.13:
- exact provider contract only;
- signed/webhook/provider identity;
- idempotency.

---

# 18. PROVIDER REFUND IDENTITY

Если provider refund reference/event exists:
- provider-scoped uniqueness;
- multiple attempts;
- identical replay;
- divergent replay;
- P2002 exact constraints.

Не делать providerRef global unique без доказательства.

---

# 19. IDEMPOTENCY — CRITICAL HARD GATE

Refund creation/transition/provider callback должен иметь DB-backed idempotency.

Required:
- identical replay = same effect;
- divergent payload = 409;
- duplicate event = one effect;
- unknown P2002 not swallowed;
- raw 500 absent.

Idempotency identity должен быть future-safe для multiple refunds/attempts.

---

# 20. CONCURRENCY

Проверить:
- concurrent duplicate Refund creation;
- concurrent partial refunds;
- refund success vs failure;
- cancel vs success if lifecycle supports;
- duplicate provider callback;
- Payment concurrently changing state if applicable.

No over-refund.
No duplicate event/history/milestone.

---

# 21. TEMPORAL CONTRACT

Step 2.10C deferred Refund milestones.

Теперь добавить только producer-backed milestones.

Candidates, не automatic:
- `requestedAt`;
- `refundedAt`;
- `failedAt`;
- `cancelledAt`.

Для каждого:
- exact transition;
- authority;
- UTC;
- first-only;
- replay-safe;
- atomic.

No fabricated legacy backfill.

---

# 22. PAYMENT IMPACT — HARD GATE

RefundService не должен мутировать Payment напрямую через foreign-domain ownership pattern, если Refund и Payment оба Finance-owned — определить ownership внутри Finance aggregate carefully.

Если Refund and Payment are same Finance domain, direct Finance-internal projection may be acceptable only if canonical architecture says Payment aggregate owns its own state.

Предпочтительно:
- Refund emits canonical event;
- Payment-owned handler/reconciler updates Payment state if needed.

Но не invent event choreography unnecessarily.

Hard question:
что происходит с Payment status после:
- partial Refund?
- full Refund?

Если unresolved: STOP.

---

# 23. ORDER PAYMENT PROJECTION — CRITICAL

Current Order projection:
- paymentStatus;
- paidAmount.

Define canonical effect of Refund.

Questions:
- full refund → paymentStatus?
- paidAmount becomes 0?
- paidAmount remains historical paid amount?
- separate refundedAmount needed?
- partial refund projection?

Do NOT guess.

If current Order model cannot represent Refund truth without ambiguous semantics:

`ARCHITECTURE DECISION REQUIRED`

Do not directly write Order from RefundService.

Any projection update must be Order-owned.

---

# 24. BOOKING / AVAILABILITY BOUNDARY

Refund must not:
- cancel Booking automatically unless explicitly canonical;
- release availability;
- change Booking money;
- change Booking milestones.

Refund ≠ Booking cancellation.

No Availability writes.

---

# 25. LEDGER BOUNDARY — HARD GATE

Determine Roadmap relationship between Step 2.13 and Step 2.12D ledger posting.

If Refund ledger posting is deferred:
- Ledger count unchanged.

If current Roadmap explicitly says Refund creates ledger fact now:
- exact ledger type/provenance;
- amount/currency;
- occurredAt;
- idempotency;
- atomicity;
- compensating append-only fact, never mutate original Payment ledger row.

No debit/credit/double-entry invention.

---

# 26. PROVIDER FEE BOUNDARY

Refund may incur provider refund fee in real systems, but do not fabricate one.

No ProviderFee creation unless actual provider fact is canonical in current step.

---

# 27. COMMISSION BOUNDARY

Do not reverse/recalculate Commission automatically unless current Roadmap explicitly assigns it.

No CommissionAccrual side effects.
No payout netting.
No settlement netting.

---

# 28. SETTLEMENT / PAYOUT BOUNDARY

Refund must not create/update Settlement or Payout foundation facts.

No payout compensation.

---

# 29. INVOICE BOUNDARY

Do not create credit note/invoice adjustment unless current Roadmap explicitly includes it.

Invoice remains separate future flow.

---

# 30. EVENTS

Create only canonical Refund events required by current architecture.

Possible only if justified:
- RefundCreated;
- RefundCompleted;
- RefundFailed;
- RefundCancelled.

For each:
- exact producer;
- minimal payload;
- amount/currency;
- paymentId/refundId/orderId only if needed;
- no PII;
- correlation/causation/actor;
- consumers.

No speculative event with no canonical meaning.

---

# 31. OUTBOX / INBOX

All durable events transactional.

Consumers:
- Inbox dedup;
- domain invariant;
- no publish before commit.

Duplicate delivery must not duplicate refund effect.

---

# 32. CORRELATION / CAUSATION / ACTOR

HTTP Refund command:
- server correlation UUID;
- causation null;
- authenticated USER actor.

Consumer/provider flow:
- inherited canonical correlation;
- causation = triggering event id where applicable;
- SYSTEM/PROVIDER semantics.

No client-owned lineage fields.

---

# 33. RBAC

Derive actual refund permissions.

Audit:
- FINANCE;
- ADMIN;
- DIRECTOR;
- ANALYST;
- SALES_MANAGER;
- OPERATOR;
- BUYER;
- PARTNER;
- MODERATOR;
- MARKETER.

Separate:
- refund.read;
- refund.create/request;
- refund.manage/approve if such workflow exists.

Do not automatically allow Buyer refund initiation unless Roadmap explicitly says.

---

# 34. BUYER REFUND SURFACE

If Buyer refund request is in scope:
- own-scope;
- cannot set refund amount beyond policy;
- cannot choose arbitrary Payment;
- cannot forge status/provider refs;
- no IDOR.

If Buyer refund request belongs to later Customer Support flow:
- do not expose endpoint.

---

# 35. MASS ASSIGNMENT — HARD GATE

Loud-reject forged:
- id/code;
- status;
- paymentId/orderId if server-derived;
- amount/currency where server-derived;
- providerRef/providerEventId;
- milestones;
- actor/correlation/causation;
- version;
- timestamps;
- ledger refs;
- settlement/payout refs.

Use raw-body forbidden key pattern where project convention requires it.

---

# 36. IDOR

Unknown/foreign Refund:
- neutral 404 where established;
- forbidden role 403;
- no data leakage.

---

# 37. PII / PCI / SECRETS

Refund must not persist/log:
- card PAN/CVV;
- provider secrets;
- bank details;
- auth headers;
- traveler passport/PII;
- raw provider payloads.

Opaque provider refund refs only.

---

# 38. REFUND HISTORY / AUDIT

If mutable lifecycle:
- RefundHistory one per real transition;
- no history on stale/failed request;
- exact from/to/action;
- no sensitive payload.

Security AuditLog separate from domain history.

---

# 39. LEGACY COMPATIBILITY

Existing schema-only Refund rows if any:
- readable;
- no fabricated milestone/status;
- no fake provider ref;
- no fake ledger fact.

Migration additive-first.

---

# 40. MIGRATION POLICY

Prisma migration only.

No db push.

Review SQL:
- additive;
- unique/idempotency indexes;
- Decimal precision;
- version/CAS if needed;
- nullable legacy-safe fields;
- no fabricated backfill;
- no destructive financial history rewrite.

---

# 41. REQUIRED NEGATIVE TESTS

Cover applicable:

1. anonymous protected Refund endpoint → 401;
2. forbidden role → 403;
3. unknown/foreign Refund → 404;
4. refund against non-CAPTURED Payment → reject;
5. forged amount → 422;
6. forged currency → 422;
7. forged status → 422;
8. forged milestone → 422;
9. forged providerRef/providerEventId → 422 where server-owned;
10. zero/negative refund → reject;
11. refund > refundable amount → reject;
12. wrong currency impossible/rejected;
13. duplicate identical request → one fact;
14. divergent replay → 409;
15. concurrent duplicate → one fact;
16. concurrent over-refund race → total never exceeds Payment amount;
17. invalid transition → 409;
18. terminal retry controlled;
19. unknown P2002 not swallowed;
20. Product price change does not affect refund base;
21. no direct Order write;
22. no Booking write;
23. no Availability mutation;
24. no ProviderFee fabrication;
25. no Commission;
26. no Settlement/Payout;
27. no Invoice;
28. no Ledger if deferred;
29. no PII/PCI leakage;
30. no raw 500.

---

# 42. REQUIRED POSITIVE TESTS

Cover applicable:

1. canonical Refund creation;
2. canonical Refund code;
3. source Payment linkage;
4. amount/currency correctness;
5. initial status;
6. valid lifecycle transitions;
7. first-only milestones;
8. identical replay;
9. concurrent duplicate one fact;
10. partial refund if in scope;
11. second partial refund if in scope;
12. full refund if in scope;
13. Payment projection/reconciliation if canonical;
14. Order projection if canonical;
15. events;
16. correlation/causation/actor;
17. RBAC;
18. legacy read;
19. Direct acquisition;
20. BUYER_REQUEST payment/refund where applicable;
21. fresh migration replay.

---

# 43. STATE MACHINE MATRIX

Если Refund mutable, создать:

`Action | From | To | Guard | Permission | Event | Milestone`

Протестировать все allowed transitions + representative forbidden transitions.

No hidden transitions.

---

# 44. WRITE-PATH AUDIT — HARD GATE

Repo-wide enumerate:

- Refund create/update/updateMany/upsert/delete/raw SQL;
- Refund status writers;
- Refund milestones;
- Payment.status writers affected by Refund;
- Order.paymentStatus / paidAmount writers;
- Ledger writers;
- Settlement/Payout writers.

Classify:
1. canonical;
2. approved projection;
3. migration/test;
4. unsafe.

Unsafe = 0.

---

# 45. MONEY / REFUNDABLE AUDIT

Find all calculations determining Refund amount.

Verify:
- Decimal only;
- source = Payment;
- no Product/Tariff/Tax/FX re-read;
- no float;
- over-refund protected atomically;
- rounding consistent.

---

# 46. SIDE-EFFECT AUDIT

Refund core must not unexpectedly mutate:

- Booking;
- Availability;
- Sale;
- Quote;
- CheckoutIntent;
- Product;
- acquisitionSource;
- service occurrence.

Finance fact counts to inspect:
- LedgerTransaction;
- ProviderFee;
- Settlement;
- Payout;
- Invoice;
- CommissionAccrual.

Only explicit in-scope fact may change.

---

# 47. UNIT TESTS

Add focused unit tests for:
- refund validation;
- refundable amount;
- status guards;
- idempotency comparison;
- temporal first-only;
- concurrency helper/locking behavior where pure test useful.

---

# 48. DEDICATED E2E

Create:

`refund-flow.e2e-spec.ts`

or canonical repository naming.

Map §§41–42 to concrete test numbers in implementation report.

---

# 49. TARGETED REGRESSION

Run:
- Payment 2.12;
- Pricing 2.11;
- Order lifecycle/payment projection;
- Booking;
- Reverse;
- Finance 2.10–2.10C;
- Ledger 2.10A;
- ProviderFee/Settlement/Payout 2.10B;
- RBAC;
- business-event-envelope;
- PII;
- phase-entry audits.

Report exact totals.

---

# 50. FULL BACKEND REGRESSION

Run:
- backend tsc;
- build;
- all unit;
- full serial e2e.

No skipped/focused tests.

---

# 51. FRONTEND REGRESSION

Even if frontend unchanged:
- frontend tsc;
- Vitest;
- production build.

Do not implement Refund UI unless Step 2.13 explicitly includes it.

---

# 52. DB REGRESSION

Run:
- migrate status;
- fresh migration replay;
- schema diff/drift.

No db push.

---

# 53. DOCUMENTATION

Create:

`docs/architecture/refund-flow.md`

Sections:

1. purpose;
2. ownership;
3. source Payment;
4. cardinality;
5. refundable amount;
6. model;
7. status vocabulary;
8. transition matrix;
9. money;
10. partial refund semantics;
11. over-refund protection;
12. creation authority;
13. PSP boundary;
14. provider identity;
15. idempotency;
16. concurrency;
17. temporal contract;
18. Payment impact;
19. Order projection;
20. Booking/Availability boundary;
21. Ledger boundary;
22. ProviderFee boundary;
23. Commission boundary;
24. Settlement/Payout boundary;
25. Invoice boundary;
26. events/outbox/inbox;
27. RBAC;
28. mass assignment;
29. PII/PCI;
30. history/audit;
31. legacy/migration;
32. deferred items.

Update:
- api.md;
- events.md;
- ids.md if needed;
- Roadmap.

---

# 54. REQUIRED IMPLEMENTATION REPORT

Create:

`docs/prompts/PHASE_2_STEP_2.13_REFUND_FLOW_IMPLEMENTATION_REPORT.md`

Required sections:

1. Verdict
2. Repository baseline
3. Sources inspected
4. Current→Target
5. Refund ownership
6. Source Payment authority
7. Cardinality
8. Refundable amount
9. Payment REFUNDED assessment
10. Schema/model
11. Migration
12. IDs
13. Money
14. Partial refund semantics
15. Over-refund protection
16. Status vocabulary
17. State machine
18. Creation authority
19. PSP boundary
20. Provider identity
21. Idempotency
22. P2002
23. Concurrency
24. Temporal milestones
25. Payment impact
26. Order projection
27. Booking/Availability boundary
28. Ledger boundary
29. ProviderFee boundary
30. Commission boundary
31. Settlement/Payout boundary
32. Invoice boundary
33. Events
34. Outbox/Inbox
35. Correlation/causation/actor
36. RBAC
37. Buyer surface
38. Mass assignment
39. IDOR
40. PII/PCI
41. History/AuditLog
42. Legacy
43. Write-path audit
44. Money/refundable audit
45. Cross-domain side effects
46. Negative coverage
47. Positive coverage
48. Unit tests
49. Targeted E2E
50. Full backend regression
51. Frontend regression
52. DB regression
53. Issues found
54. Fixes applied
55. Architecture decision status
56. Deferred/out-of-scope
57. Exact files changed
58. Roadmap update
59. Exact NEXT item

---

# 55. ARCHITECTURE STOP CONDITIONS

STOP with:

`PHASE 2 STEP 2.13 BLOCKED — ARCHITECTURE DECISION REQUIRED`

if unresolved:

1. Refund source Payment semantics unclear;
2. Refund cardinality undefined;
3. partial refund semantics required but undefined;
4. refundable amount authority unclear;
5. Payment REFUNDED meaning conflicts;
6. Order payment projection cannot represent refund truth;
7. over-refund cannot be prevented without new unresolved model;
8. PSP refund contract required but deferred/undefined;
9. provider refund identity undefined;
10. direct Order/Booking writes required;
11. Refund requires repricing;
12. Refund requires Tax/FX recalculation;
13. Refund requires Commission logic;
14. Refund requires Settlement/Payout mutation;
15. Refund requires Invoice adjustment now;
16. Refund requires double-entry/balance architecture;
17. Refund milestone authority ambiguous;
18. legacy migration requires fabricated history;
19. multiple active Refund writers exist;
20. event contract requires breaking incompatible change.

Do not guess.

---

# 56. ROADMAP UPDATE

Only after full green regression:

Step 2.13 →

`IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

NEXT →

`PHASE 2 — STEP 2.13 — STRICT REVIEW`

Do not mark approved.

Do not start Step 2.14.

---

# 57. OUT OF SCOPE

Unless actual Roadmap explicitly assigns them to 2.13, do not implement:

- Invoice/credit-note engine;
- Commission accrual/reversal;
- Settlement lifecycle;
- Payout lifecycle;
- ProviderFee calculation;
- double-entry;
- balances;
- reconciliation engine;
- bank rails;
- unrelated frontend redesign;
- unrelated platform/auth hardening.

---

# 58. HARD STOP

After implementation + migration + tests + docs + report + Roadmap update:

STOP.

Do not perform Strict Review 2.13.
Do not begin Step 2.14.

Final line:

`PHASE 2 STEP 2.13 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`
