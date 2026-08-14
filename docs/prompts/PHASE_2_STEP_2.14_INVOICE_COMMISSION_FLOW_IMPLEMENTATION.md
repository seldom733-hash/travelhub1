# PHASE 2 — STEP 2.14 — INVOICE / COMMISSION FLOW — IMPLEMENTATION PROMPT

## 0. ROLE

Ты работаешь в существующем проекте **TravelHub** как Senior/Staff Backend Engineer + Domain Architect.

Твоя задача — реализовать только:

**PHASE 2 — STEP 2.14 — INVOICE / COMMISSION FLOW**

Это **implementation pass**, не Strict Review.

Перед изменениями обязательно проверить фактическое состояние репозитория: Prisma schema, migrations, Finance runtime, Payment/Refund/Dispute contracts, pricing snapshot, EventBus, RBAC, tests и canonical Roadmap.

Не доверяй предыдущим отчётам как единственному источнику истины.

---

# 1. REQUIRED FINAL VERDICT

Успешный verdict:

`PHASE 2 STEP 2.14 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

Если безопасная реализация требует нового бизнес/архитектурного решения:

`PHASE 2 STEP 2.14 BLOCKED — ARCHITECTURE DECISION REQUIRED`

Strict Review 2.14 **не выполнять** в этом проходе.

Не начинать следующий шаг.

---

# 2. APPROVED BASELINE — MUST PRESERVE

Перед реализацией независимо подтвердить:

- Step 2.10 — Finance Domain Foundation — APPROVED;
- Step 2.10A — Ledger Transaction Foundation — APPROVED;
- Step 2.10B — Provider Fee / Settlement / Payout Foundation — APPROVED;
- Step 2.10C — Finance Temporal Contract — APPROVED;
- Step 2.11 — Pricing & Financial Snapshot — APPROVED;
- Step 2.12 — Payment Flow — APPROVED;
- Step 2.13 — Refund Flow — APPROVED;
- Step 2.13A — Chargeback / Dispute Foundation — APPROVED WITH REVIEW FIXES.

Также сохранить результат reconciliation:
- 2.12A–G — later extensions, NOT STARTED;
- provider-neutral Finance foundation остаётся допустимой;
- real PSP/webhook, ledger posting, partial Payment, provider fee granularity и часть commission extensions не считаются автоматически реализованными.

Ожидаемый baseline, который нужно проверить по факту:
- backend unit: `548/548`;
- serial e2e: `1105/1105`, 63 suites;
- frontend Vitest: `135/135`;
- migrations: `54/54`;
- drift 0.

Если фактические значения отличаются — зафиксировать реальные.

---

# 3. OBJECTIVE

Реализовать канонический **Invoice / Commission Flow** только в объёме, определённом актуальным Roadmap.

Ключевой принцип:

> **Invoice — документированный финансово-коммерческий факт/документ. Commission — отдельный TravelHub financial fact. Они не являются Payment, ProviderFee, Settlement, Payout или LedgerTransaction.**

Нельзя превращать Step 2.14 в money-god-module.

---

# 4. REPOSITORY-FIRST RECONCILIATION

До production changes изучить:

- `backend/prisma/schema.prisma`;
- existing `Invoice`, `Commission`, `CommissionAccrual` models;
- Finance module;
- Payment / Refund / Dispute runtime;
- ProviderFee / Settlement / Payout foundations;
- Ledger;
- pricing/financial snapshot;
- Sale / Order / Booking frozen money;
- acquisitionSource;
- PaymentTerms;
- current tax/FX master-data;
- IdsService;
- RBAC;
- EventBus;
- AuditLog/history;
- api.md / events.md / ids.md;
- Roadmap Step 2.14 and any substeps 2.14A+;
- Screen Design Finance/Invoice/Commission codes if present.

Repo-wide search:

`Invoice`
`InvoiceStatus`
`Commission`
`CommissionAccrual`
`commission`
`invoice`
`issuedAt`
`dueAt`
`paidAt`
`settledAt`
`ProviderFee`
`Settlement`
`Payout`
`LedgerTransaction`
`PaymentCaptured`
`RefundProcessed`
`Dispute`
`tax`
`exchangeRate`

Create Current→Target matrix before implementation.

---

# 5. CANONICAL SCOPE — HARD GATE

Read exact Roadmap Step 2.14.

Determine whether Step 2.14 means:
- Invoice only;
- Commission only;
- both;
- foundation only;
- full lifecycle;
- commission accrual;
- invoice issuance;
- or a combination.

Do not infer scope solely from the title.

If Roadmap body, execution sequence and dependency analysis conflict materially:

`ARCHITECTURE DECISION REQUIRED`

---

# 6. INVOICE vs COMMISSION — HARD GATE

Treat them as separate concepts.

Invoice:
- document / claim / billing artifact.

TravelHub Commission:
- platform revenue/fee fact.

Commission is NOT:
- ProviderFee;
- Tax;
- Discount;
- Settlement;
- Payout;
- Payment;
- Invoice amount itself.

Invoice must not become authority for commission unless Roadmap explicitly says so.

Commission must not mutate invoice history arbitrarily.

---

# 7. OWNERSHIP

Both Invoice and Commission belong to Finance domain unless actual Roadmap says otherwise.

Forbidden:
- Order writes Invoice/Commission;
- Booking writes Invoice/Commission;
- Sales writes Finance rows directly;
- Finance writes Order/Booking/Sales status directly.

Cross-domain effects via events/projections only.

If direct cross-domain writes are required for correctness:
STOP.

---

# 8. SOURCE AUTHORITY — INVOICE

Determine exact canonical source for Invoice.

Potential candidates:
- Sale;
- Order;
- Payment;
- Refund adjustment;
- another frozen commercial obligation.

Do not guess.

Need explicit answers:
- what transaction/document does Invoice represent;
- amount/currency source;
- buyer/partner identity source;
- invoice line source;
- issue trigger;
- due date authority;
- whether invoice exists before Payment;
- whether Refund modifies invoice or creates separate adjustment later.

If source ambiguous:
`ARCHITECTURE DECISION REQUIRED`

---

# 9. SOURCE AUTHORITY — COMMISSION

Determine exact canonical source for TravelHub Commission.

Potential source:
- Sale;
- Order;
- Booking;
- Payment CAPTURED;
- service fulfillment;
- provider-neutral commercial transaction.

Do not choose by intuition.

Need answer:
- when commission is earned/accrued;
- gross base;
- rate;
- fixed/percentage;
- currency;
- seller/partner;
- what event creates accrual;
- whether refund/dispute reverses it now or later.

If commission trigger or base is undefined:
STOP.

---

# 10. COMMISSION SEMANTICS — CRITICAL HARD GATE

Do not invent:
- commission percentage;
- fixed fee;
- net vs gross base;
- inclusive/exclusive tax treatment;
- partner-specific rates;
- category-specific rates;
- tiering.

If existing model has rate fields but no producer policy, model presence alone is not authority.

Commission formula must come from approved contracts.

---

# 11. COMMISSION vs PROVIDER FEE

Hard separation:

`TravelHub Commission != ProviderFee`

ProviderFee is external PSP/bank cost.

TravelHub Commission is platform revenue.

No shared type enum/table unless already canonically designed.

Do not calculate ProviderFee from Commission or vice versa.

---

# 12. COMMISSION vs SETTLEMENT / PAYOUT

Commission accrual is not payout.

Do not:
- create payout;
- reduce payout;
- net settlement;
- mark partner paid;
- create settlement record

unless Roadmap explicitly assigns it to 2.14.

If settlement/payout integration belongs to 2.14A/B, defer.

---

# 13. COMMISSION vs LEDGER

Do not auto-post LedgerTransaction unless exact Roadmap step activates it.

Step 2.12D is still not automatically done.

If 2.14 requires ledger posting, check dependency conflict with 2.12D and reconciliation.

If unresolved:
`ARCHITECTURE DECISION REQUIRED`

---

# 14. MONEY CONTRACT

All money:
- Decimal;
- canonical `sales.money.ts` / shared finance money authority;
- no Number()/parseFloat financial authority;
- API decimal strings;
- frozen currency;
- correct precision/scale;
- overflow guards;
- same rounding convention.

No repricing.

No live Product/Tax/FX read to reconstruct historical Invoice/Commission after source freeze.

---

# 15. INVOICE MODEL RECONCILIATION

Reuse existing Invoice model if present.

Classify fields:
- id/code;
- source reference;
- invoice number/code;
- amount/currency;
- lines;
- status;
- issuedAt;
- dueAt;
- paidAt;
- cancelledAt;
- version;
- createdAt/updatedAt;
- seller/buyer refs;
- provenance.

Do not create duplicate Invoice table.

Do not add fields merely because accounting systems usually have them.

---

# 16. COMMISSION MODEL RECONCILIATION

Reuse `Commission` / `CommissionAccrual` existing models if present.

Determine whether:
- Commission = rule/master-data;
- CommissionAccrual = immutable earned fact;
- or naming differs.

Do not collapse configuration and accrual into same authority if existing architecture separates them.

---

# 17. INVOICE STATUS VOCABULARY

Derive exact statuses from schema/Roadmap/Screen Design.

For each:
- meaning;
- terminal/non-terminal;
- producer;
- transition;
- milestone;
- event;
- permission.

Do not invent DRAFT/ISSUED/PAID/CANCELLED if not canonical.

If model is immutable foundation only, do not invent lifecycle.

---

# 18. COMMISSION LIFECYCLE

Determine whether commission accrual is:
- immutable fact on creation;
- mutable status aggregate;
- reversible only through separate compensating fact.

Prefer immutable financial history where architecture supports it.

Do not mutate historical earned amount to “undo” a Refund unless canonical policy explicitly says so.

---

# 19. INVOICE CREATION AUTHORITY

Define one canonical creator.

Possible:
- Finance command;
- event consumer;
- Sale/Order event.

No multiple competing creators.

Idempotency identity must be explicit.

---

# 20. COMMISSION CREATION AUTHORITY

Define one canonical producer.

Possible:
- SaleCompleted;
- PaymentCaptured;
- Booking fulfilled;
- other canonical event.

Do not create Commission from multiple lifecycle facts without dedup/authority.

---

# 21. IDENTIFIERS

Verify existing prefixes.

If new:
- use IdsService;
- register in ids.md;
- same transaction as create;
- DB unique;
- concurrency-safe.

Potential prefixes must be derived from project conventions, not guessed.

---

# 22. INVOICE CARDINALITY

Determine:
- one Invoice per Order?
- one per Sale?
- multiple invoice versions?
- credit note vs invoice?
- reissue behavior?

If Roadmap later has invoice versioning (e.g. 2.14A), do not create a unique constraint that blocks it.

If cardinality unclear and required:
STOP.

---

# 23. COMMISSION CARDINALITY

Determine:
- one accrual per Payment?
- per OrderItem?
- per Booking?
- per Sale?
- per commission type?

Do not use overly broad unique key.

Future commission types/reversals must remain additively possible.

---

# 24. IDEMPOTENCY — HARD GATE

For Invoice and Commission creation:

- identical replay → same effect/no duplicate;
- divergent payload → controlled conflict;
- precise P2002 handling;
- unknown P2002 not swallowed;
- no raw 500.

Compare all material business payload fields.

Do not repeat Ledger/Dispute defect class of silently returning existing fact for divergent amount.

---

# 25. CONCURRENCY

Required races, where applicable:

Invoice:
- concurrent duplicate issue;
- divergent issue payload;
- issue vs cancel if lifecycle exists.

Commission:
- concurrent same accrual;
- divergent amount/rate;
- duplicate triggering event.

Expected:
- one canonical effect;
- controlled loser;
- no duplicate history/events;
- no raw 500.

---

# 26. TEMPORAL CONTRACT — INVOICE

Add only producer-backed milestones.

Possible but not automatic:
- issuedAt;
- dueAt;
- paidAt;
- cancelledAt.

Need exact authority.

`dueAt` is not necessarily event occurrence time; determine whether it is policy-derived.

Do not fabricate historical timestamps.

---

# 27. TEMPORAL CONTRACT — COMMISSION

Possible:
- accruedAt;
- recognizedAt;
- reversedAt.

Do not add unless canonical.

If accrual is immutable, `createdAt` may not equal business occurrence unless explicitly defined.

Use 2.10C temporal principles.

---

# 28. INVOICE / PAYMENT RELATION

Determine canonical relationship.

Questions:
- does Invoice become PAID when Payment CAPTURED?
- is payment projection required now?
- can multiple Payments pay one Invoice?
- partial Payment deferred?
- invoice paidAmount required?

Do not guess.

If current Payment 2.12 single-active semantics cannot safely drive Invoice PAID without partial-payment policy:
defer invoice paid projection unless Roadmap explicitly defines it.

---

# 29. INVOICE / REFUND RELATION

Do not automatically:
- reopen Invoice;
- reduce Invoice amount;
- create credit note;
- cancel invoice

unless 2.14 explicitly defines it.

Refund must not rewrite immutable Invoice history.

---

# 30. INVOICE / DISPUTE RELATION

Dispute foundation is provider-neutral and currently has no cross-domain projection.

Do not:
- mark Invoice disputed;
- change Invoice amount;
- cancel Invoice;
- create accounting adjustment

unless Roadmap explicitly requires.

---

# 31. COMMISSION / REFUND RELATION — HARD GATE

This is high risk.

Determine whether Step 2.14 defines commission reversal/clawback on Refund.

If yes:
- define separate compensating fact preferred;
- exact source Refund;
- amount/rate;
- idempotency;
- concurrency.

If no:
- 0 commission reversal in 2.14;
- document deferred boundary.

Do not mutate original CommissionAccrual amount.

---

# 32. COMMISSION / DISPUTE RELATION

Same rule:
no commission reversal/hold because Dispute exists unless canonical.

Dispute liability/won/lost is deferred; therefore speculative commission adjustment is forbidden.

---

# 33. TAX BOUNDARY

Invoice often implies tax, but do not invent tax engine.

If current pricing snapshot does not include canonical tax:
- no tax calculation.

If Invoice must expose tax, it may only copy frozen canonical tax facts already present.

No current TaxRule lookup for historical invoice generation unless architecture explicitly defines issue-time tax calculation.

---

# 34. FX BOUNDARY

No live FX conversion unless current canonical flow already has frozen FX facts.

Invoice/Commission currency must derive from frozen source.

No mutable ExchangeRate authority.

---

# 35. MASS ASSIGNMENT — HARD GATE

Loud-reject forged:
- id/code;
- source refs where server-owned;
- amount/currency;
- commission rate/amount where server-derived;
- invoice status;
- commission status;
- milestones;
- version;
- actor/correlation/causation;
- createdAt/updatedAt;
- ledger/settlement/payout refs.

Use raw body validation according to project convention.

---

# 36. RBAC

Derive actual permissions from current RBAC matrix and Roadmap.

Likely Finance-owned, but verify.

Separate:
- invoice.read;
- invoice.write/issue/manage;
- commission.read;
- commission.manage if needed.

Read roles may include FINANCE/DIRECTOR/ANALYST/SALES_MANAGER according to existing Finance pattern, but do not assume.

Write should be least privilege.

Docs must match actual ROLE_PERMISSIONS.

---

# 37. IDOR

Unknown/not-visible Invoice/Commission:
- neutral 404 or established behavior;
- forbidden roles 403;
- no cross-partner leakage.

---

# 38. EVENTS

Create only events with canonical meaning and actual need.

Potential:
- InvoiceIssued;
- InvoiceCancelled;
- CommissionAccrued.

Not automatic.

For each:
- producer;
- version;
- minimal payload;
- no PII;
- money if needed;
- correlation/causation;
- consumer.

No speculative events.

---

# 39. OUTBOX / INBOX

All durable business events use transactional outbox.

Consumers use Inbox/domain invariants.

No publish-before-commit.

---

# 40. AUDIT / HISTORY

Separate:
- domain history;
- AuditLog;
- Outbox.

No full invoice payload, card data, customer PII, bank details in AuditLog/events.

---

# 41. PII / FINANCIAL DOCUMENT DATA

Invoice may require recipient data.

Do not invent/store:
- passports;
- card data;
- bank credentials.

If legal invoice identity/address/tax number is required by Roadmap:
- source authority must be defined;
- freeze snapshot rather than live mutable CRM re-read if historical truth matters;
- PII exposure/RBAC must be documented.

If legal invoice identity requirements are undefined:
STOP rather than invent jurisdictional invoice law.

---

# 42. LEGACY COMPATIBILITY

Existing schema-only Invoice/Commission rows:
- readable;
- no fabricated status/milestones;
- no fake amount;
- no destructive backfill.

New NOT NULL fields require safe migration strategy.

---

# 43. MIGRATION POLICY

Only Prisma migrations.

No db push.

SQL:
- additive;
- fresh-deploy safe;
- correct unique indexes;
- correct Decimal precision;
- legacy-safe;
- no destructive rewrite;
- no fabricated historical finance facts.

---

# 44. REQUIRED NEGATIVE TESTS

At minimum, where applicable:

1. anonymous protected endpoint → 401;
2. forbidden role → 403;
3. unknown object → 404;
4. forged amount → 422;
5. forged currency → 422;
6. forged status → 422;
7. forged milestones → 422;
8. invalid Decimal/scale/overflow;
9. unsupported currency;
10. invalid source aggregate;
11. duplicate Invoice/Commission create;
12. divergent replay → 409;
13. concurrent duplicate → one fact;
14. unknown P2002 not swallowed;
15. Product price change does not mutate Invoice/Commission;
16. Tax/FX master-data mutation does not mutate frozen history;
17. Refund does not silently rewrite Invoice;
18. Dispute does not silently rewrite Invoice;
19. Refund/Dispute do not silently reverse Commission unless explicitly canonical;
20. no Ledger if deferred;
21. no ProviderFee fabrication;
22. no Settlement/Payout;
23. no PSP/webhook;
24. no cross-domain writes;
25. no PII/PCI leakage;
26. no raw 500.

---

# 45. REQUIRED POSITIVE TESTS

Where applicable:

1. canonical Invoice creation/issue;
2. canonical Invoice code;
3. frozen amount/currency;
4. correct source linkage;
5. lifecycle transitions;
6. first-only milestones;
7. canonical Commission creation/accrual;
8. commission amount/rate derived from approved source;
9. Direct acquisition path;
10. BUYER_REQUEST path if relevant;
11. idempotent replay;
12. concurrent duplicate one fact;
13. history/audit;
14. events if canonical;
15. legacy reads;
16. fresh migration replay.

---

# 46. WRITE-PATH AUDIT — HARD GATE

Repo-wide enumerate all production writers for:

- Invoice;
- InvoiceHistory if present;
- Commission;
- CommissionAccrual;
- associated milestones/statuses.

Classify:
1. canonical owner;
2. approved consumer/projection;
3. migration/test;
4. unsafe.

Unsafe = 0.

Also audit whether Invoice/Commission writes other domains directly.

---

# 47. SIDE-EFFECT AUDIT

During Invoice/Commission operations verify no unexpected writes to:

- Payment;
- Refund;
- Dispute;
- Order;
- Booking;
- Availability;
- Ledger;
- ProviderFee;
- Settlement;
- Payout.

Only explicitly in-scope canonical side effects allowed.

---

# 48. 2.12A–G BOUNDARY AUDIT

Prove:

### 2.12A
0 PSP/provider integration.

### 2.12B
0 provider webhook/authorization/capture extension.

### 2.12C
If Roadmap says commission semantics belong here and 2.14 depends on it, reconcile carefully.
Do not silently mark 2.12C complete.

### 2.12D
0 ledger posting unless dependency explicitly resolved.

### 2.12E
0 commission reversal/accrual extension beyond 2.14 scope.

### 2.12F
0 partial Payment implementation.

### 2.12G
0 ProviderFee granularity evolution unless exact Roadmap scope says 2.14 consumes it.

If Step 2.14 cannot be correctly implemented without any of these:
STOP and require architecture/dependency decision.

---

# 49. 2.14A+ BOUNDARY

Inspect actual Roadmap successor/substeps.

Do not pre-implement:
- invoice versioning;
- settlement version;
- payout attempt;
- credit note;
- legal numbering policy;
- jurisdiction-specific fiscalization;
- commission reversal;
- accounting recognition

unless exact Step 2.14 says so.

---

# 50. UNIT TESTS

Add focused unit coverage for:
- money;
- commission calculation if canonical;
- invoice validation;
- transition guards;
- idempotency payload comparison;
- temporal helpers;
- P2002 normalization.

---

# 51. DEDICATED E2E

Create canonical e2e suite, e.g.:

`invoice-commission-flow.e2e-spec.ts`

or repository naming equivalent.

Map §§44–45 to concrete test numbers in report.

---

# 52. TARGETED REGRESSION

Run affected:
- Payment;
- Refund;
- Dispute;
- pricing snapshot;
- Finance foundation;
- Ledger;
- ProviderFee/Settlement/Payout;
- Order/Booking;
- Reverse where acquisition matters;
- RBAC;
- event envelope;
- temporal readiness;
- PII.

Report exact totals.

---

# 53. FULL BACKEND REGRESSION

Run:
- backend tsc;
- build;
- full unit;
- full serial e2e.

No skipped/focused tests.

Report actual counts.

---

# 54. FRONTEND REGRESSION

Even if frontend unchanged:
- tsc;
- Vitest;
- production build.

Do not implement Finance UI unless Roadmap Step 2.14 explicitly includes it.

---

# 55. DB REGRESSION

Run:
- migrate status;
- fresh migration replay;
- drift/diff.

No db push.

---

# 56. DOCUMENTATION

Create:

`docs/architecture/invoice-commission-flow.md`

Minimum sections:

1. purpose;
2. exact Roadmap scope;
3. Invoice vs Commission separation;
4. ownership;
5. Invoice source authority;
6. Commission source authority;
7. model reconciliation;
8. money contract;
9. identifiers;
10. cardinality;
11. idempotency;
12. concurrency;
13. Invoice lifecycle;
14. Commission lifecycle;
15. temporal contract;
16. Payment relation;
17. Refund relation;
18. Dispute relation;
19. tax boundary;
20. FX boundary;
21. ProviderFee boundary;
22. Ledger boundary;
23. Settlement/Payout boundary;
24. RBAC;
25. mass assignment;
26. PII/legal identity;
27. events/outbox/inbox;
28. history/audit;
29. legacy/migration;
30. 2.12A–G containment;
31. deferred 2.14A+ scope.

Update:
- api.md;
- events.md;
- ids.md if needed;
- Roadmap.

---

# 57. REQUIRED IMPLEMENTATION REPORT

Create:

`docs/prompts/PHASE_2_STEP_2.14_INVOICE_COMMISSION_FLOW_IMPLEMENTATION_REPORT.md`

Required sections:

1. Verdict
2. Repository baseline
3. Sources inspected
4. Exact Roadmap scope
5. Current→Target
6. Invoice vs Commission separation
7. Ownership
8. Invoice source authority
9. Commission source authority
10. Commission formula semantics
11. Schema/model reconciliation
12. Migration
13. IDs
14. Money contract
15. Invoice cardinality
16. Commission cardinality
17. Invoice lifecycle
18. Commission lifecycle
19. Creation authorities
20. Idempotency
21. P2002 handling
22. Concurrency
23. Invoice temporal contract
24. Commission temporal contract
25. Payment relation
26. Refund relation
27. Dispute relation
28. Tax boundary
29. FX boundary
30. ProviderFee boundary
31. Ledger boundary
32. Settlement/Payout boundary
33. RBAC
34. IDOR
35. Mass assignment
36. PII/legal identity
37. Events
38. Outbox/Inbox
39. History/AuditLog
40. Legacy compatibility
41. Write-path audit
42. Cross-domain side-effect audit
43. 2.12A boundary
44. 2.12B boundary
45. 2.12C boundary
46. 2.12D boundary
47. 2.12E boundary
48. 2.12F boundary
49. 2.12G boundary
50. 2.14A+ boundary
51. Negative coverage
52. Positive coverage
53. Unit tests
54. Targeted E2E
55. Full backend regression
56. Frontend regression
57. DB regression
58. Issues found
59. Fixes applied
60. Architecture decision status
61. Deferred/out-of-scope
62. Exact files changed
63. Roadmap update
64. Exact NEXT item

---

# 58. ARCHITECTURE STOP CONDITIONS

STOP with:

`PHASE 2 STEP 2.14 BLOCKED — ARCHITECTURE DECISION REQUIRED`

if unresolved:

1. exact 2.14 scope unclear;
2. Invoice source authority unclear;
3. Commission source authority unclear;
4. commission formula/rate/base undefined;
5. invoice cardinality/versioning required but undefined;
6. commission cardinality undefined;
7. Invoice legal/fiscal requirements require jurisdiction policy not defined;
8. invoice due/paid semantics require partial Payment support;
9. Refund requires invoice credit-note policy not defined;
10. Refund/Dispute requires commission reversal policy not defined;
11. commission requires 2.12C/E that are still NOT STARTED;
12. accounting requires ledger posting before 2.12D;
13. settlement/payout netting required but undefined;
14. Tax inclusive/exclusive semantics required but undefined;
15. FX conversion required but undefined;
16. direct cross-domain writes required;
17. destructive migration/historical backfill required;
18. multiple conflicting writers/models exist;
19. event contract requires breaking change.

Do not guess.

---

# 59. ROADMAP UPDATE

Only after full green regression:

Step 2.14 →

`IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

NEXT →

`PHASE 2 — STEP 2.14 — STRICT REVIEW`

Preserve reconciliation/dependency notes.

Do not mark approved.

Do not start successor/substep.

---

# 60. OUT OF SCOPE

Unless exact Roadmap 2.14 explicitly requires:

- PSP integration;
- webhook;
- partial Payment;
- ledger posting;
- double-entry;
- balances;
- provider fee calculation;
- settlement lifecycle;
- payout lifecycle;
- commission reversal/clawback;
- credit-note engine;
- fiscalization;
- tax engine;
- FX engine;
- frontend redesign;
- unrelated platform hardening.

---

# 61. HARD STOP

After:
- implementation;
- migrations;
- tests;
- docs;
- report;
- Roadmap update;

STOP.

Do not perform Strict Review 2.14.
Do not start NEXT.

Final line:

`PHASE 2 STEP 2.14 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`
