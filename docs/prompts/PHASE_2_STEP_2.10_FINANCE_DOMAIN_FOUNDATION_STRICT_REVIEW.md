# PHASE 2 — STEP 2.10 — FINANCE DOMAIN FOUNDATION — STRICT REVIEW

## ROLE
Выполни независимый **adversarial STRICT REVIEW** уже реализованного `PHASE 2 — STEP 2.10 — FINANCE DOMAIN FOUNDATION`.

Это не implementation-pass и не начало 2.10A. Не доверяй implementation report без проверки фактического repository state.

## 1. HARD RULES
- Сначала изучи код, schema, migration, tests, contracts, Roadmap и runtime paths.
- Не считай наличие теста доказательством production-корректности.
- Не начинай 2.10A/2.10B/2.10C/2.12/2.13/2.14.
- Review-fix допустим только для локального дефекта 2.10.
- Если исправление требует новой финансовой семантики — `ARCHITECTURE DECISION REQUIRED`.
- После fixes: targeted tests + полный backend/frontend/DB regression.
- Roadmap → APPROVED только после всех hard gates.

## 2. BASELINE
Зафиксируй branch, HEAD, version/tag, origin sync, dirty/untracked, migrations, drift, текущий статус 2.10 и NEXT. Докажи, что 2.10A фактически не начат.

## 3. SOURCES
Проверить минимум:
- `TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`;
- Screen Design Finance Center;
- RBAC Matrix;
- `docs/contracts/api.md`, `events.md`, `ids.md`;
- relevant ADR/architecture docs;
- `backend/prisma/schema.prisma` + migration Step 2.10;
- `backend/src/modules/finance/**`;
- security/permissions, IdsService, field validation, AppModule;
- Order/Booking/Availability/Sales/Catalog financial touchpoints;
- finance unit/e2e, phase2-entry-audit, DB globalSetup.

Repository-wide search: `Payment`, `PaymentTerms`, `Refund`, `Invoice`, `Commission`, `CommissionAccrual`, `Settlement`, `Payout`, `Ledger`, `LedgerTransaction`, `Stripe`, `finance.`, `paymentStatus`, `paidAmount`, `paidAt`, `authorizedAt`, `capturedAt`.

## 4. CURRENT → TARGET
Раздели фактическое состояние после 2.10 на:
1. active production master-data;
2. schema-only future models;
3. deferred features;
4. legacy/pre-existing financial fields других aggregates.

Schema-only Payment/Refund/etc. нельзя представлять как реализованный Finance workflow.

## 5. FINANCE OWNERSHIP — HARD GATE
Докажи отсутствие cross-domain writers:
- Order/Booking/Sales/Catalog → `finance.*`;
- Finance → Order/Booking/Availability/Pricing.

Finance должен быть единственным writer своего master-data. Любой скрытый cross-domain writer = FAIL.

## 6. SCHEMA INVENTORY — HARD GATE
Составь таблицу всех моделей Step 2.10: Model | Purpose | Active writer | API | Event | Deferred step.

Независимо проверь заявленные 10 моделей. Для каждой schema-only модели докажи отсутствие controller/consumer/bootstrap/seed/raw SQL/job writer и отсутствие runtime authority.

Особенно: Payment, PaymentTerms, Refund, Invoice, Commission, CommissionAccrual, Settlement/Payout.

## 7. SCHEMA-ONLY ADVERSARIAL ASSESSMENT — CRITICAL
Для каждой future model ответь: не фиксирует ли schema уже сейчас решение, намеренно deferred Roadmap?

Классификация:
- SAFE PLACEHOLDER;
- REVIEW FIX;
- ARCHITECTURE DECISION REQUIRED.

Особенно проверить mutable Payment vs future ledger, PaymentTerms authority, commission basis, refund linkage, invoice tax semantics, settlement/payout ownership и PSP/provider IDs.

## 8. MIGRATION — HARD GATE
Прочитай SQL. Требования: additive, без destructive ALTER существующих domain tables, fabricated backfill и `db push`; корректные unique/index/nullable semantics.

Фактически выполнить migrate status, доступный drift/diff и clean DB replay реальных migrations. Не заявлять drift=0 без выполненной проверки.

## 9. MASTER-DATA AUTHORITY
Определи authority Currency, ExchangeRate, Tax, TaxRule и остальных active master-data. Проверить single writer, validation, uniqueness, update/delete semantics, auditability и отсутствие duplicate Settings authority.

## 10. CURRENCY / COUNTRY CONTRACT — HARD GATE
Currency: ISO 4217 alpha-3, normalization/case, duplicate protection, malformed → controlled 4xx.

Country: ISO 3166-1 alpha-2. Проверить `AZ`/`RU`, отклонение `AZE`/`RUS`, `az-AZ`/`ru-RU`. Не смешивать country, currency, locale и timezone.

## 11. DECIMAL / MONEY SAFETY — HARD GATE
Проверить Prisma Decimal + DB precision/scale + DTO + serialization + comparisons. В Finance запрещён native float как canonical authority: no unsafe `parseFloat`, `Number(...)`, native arithmetic/coercion для rate/tax/money.

Decimal API contract проверять по числовой семантике string, а не trailing zeros.

## 12. EXCHANGE RATE SEMANTICS
Из фактической модели установить base/quote/rate/effective semantics, historical coexistence и update behavior. Если meaning `rate` неоднозначен и блокирует будущий ledger/posting — stop-condition.

## 13. TAX / TAXRULE
Проверить precision, non-negative, Tax↔TaxRule relation, unknown tax rejection, country applicability, duplicate/overlap semantics, IDs. Не реализовывать tax engine или retroactive repricing.

## 14. IDENTIFIERS — HARD GATE
Проверить `CUR-`, `FXR-`, `TAX-`, `TXR-`: canonical IdsService, ожидаемый 8-digit sequence, transaction-safe allocation, DB uniqueness, no `MAX()+1`, no random code, соответствие `ids.md`.

## 15. RBAC — HARD GATE
Проверить реальные grants/seeding для FINANCE, ADMIN, DIRECTOR, BUYER, PARTNER, OPERATOR, SALES_MANAGER, MODERATOR, MARKETER, ANALYST и anonymous.

FINANCE/ADMIN — ожидаемый manage; DIRECTOR — без write; остальные перечисленные роли — без master-data writes. Проверить read/write отдельно.

## 16. AUTH / IDOR / ERRORS
401 anonymous; 403 forbidden; unknown → neutral 404; duplicate → 409; validation/forbidden fields → project-standard 422; malformed input никогда raw 500.

## 17. MASS ASSIGNMENT — CRITICAL
Независимо проверить заявленный fix: forbidden-key validation должна видеть **raw `req.body` до whitelist stripping**.

Forge минимум: id, business code, timestamps, version, actor/audit fields, server-owned relation/system fields. Create и update должны loud-reject, а не silent-strip.

## 18. CRUD ACCURACY
Для каждого active resource установить реально существующие create/read/list/update/delete/deactivate operations. Не называть CRUD то, чего runtime не предоставляет. Delete не добавлять ради review.

## 19. AUDITABILITY
Проверить AuditLog: actor/action/target/server time, no secrets/PII dump. Security audit не является immutable financial ledger.

## 20. LEDGER BOUNDARY — HARD GATE
2.10A deferred. Доказать отсутствие production LedgerTransaction creation, debit/credit posting, balance mutation, double-entry logic, ledger consumers/journal.

Если 2.10 уже фиксирует incompatible ledger semantics → ADR required.

## 21. PAYMENT BOUNDARY — HARD GATE
2.12 deferred. Нет POST/manual Payment creation, PSP webhook, authorize/capture, Payment status machine, provider transaction processing, Payment events, Order/Booking→Payment writer.

Schema-only Payment не source of truth.

## 22. PAYMENTTERMS COLLISION — HARD GATE
Сравнить Finance `PaymentTerms` с frozen terms цепочки `Quote → CheckoutIntent → Sale → OrderRequested → Order`.

Определить business meaning и authority обоих. Если Finance PaymentTerms может стать competing source или термин неразличим — `ARCHITECTURE DECISION REQUIRED`. Слово schema-only само по себе не снимает конфликт.

## 23. REFUND / INVOICE / COMMISSION BOUNDARIES
Доказать отсутствие:
- Refund create/status/PSP/auto-refund on cancellation;
- Invoice numbering/issuance/PDF/status;
- commission accrual/recognition/fabricated percentage;
- Sale/Order/Booking completion financial side effects.

Если schema фиксирует неутверждённую commission/refund/invoice semantics — ADR.

## 24. SETTLEMENT / PAYOUT / PROVIDER FEE
2.10B deferred. Нет active ProviderFee, Settlement/Payout creation, seller/payable balance, payout machine/reconciliation.

## 25. STRIPE / PSP LEGACY AUDIT — HARD GATE
Repository-wide классифицировать все Stripe/PSP remnants:
1. active compatible;
2. dead/legacy;
3. schema-only;
4. unsafe duplicate authority.

Активный parallel Payment writer = FAIL/ADR.

## 26. EXISTING ORDER FINANCIAL FIELDS
Проверить `Order.paymentStatus`, `paidAmount` и прочие legacy fields: кто пишет, что они означают, не меняет ли их Finance 2.10 и не конфликтуют ли они с будущим Payment authority.

## 27. BOOKING / AVAILABILITY / PRICING / ACQUISITION ISOLATION
Доказать:
- Booking не получил paidAt/payment mutations/finance writes;
- Finance не создаёт/release availability holds;
- нет repricing Product/Tariff/Quote/Checkout/Sale/Order/Booking;
- frozen money не переписывается;
- DIRECT/BUYER_REQUEST/null acquisition неизменны.

## 28. TEMPORAL 2.10C BOUNDARY
Проверить отсутствие business milestones `authorizedAt`, `capturedAt`, `paidAt`, `refundedAt` и deferred settlement/payout milestones. `createdAt/updatedAt` не считать payment milestone.

## 29. EVENT CONTRACT
Implementation report заявляет 0 Finance business events. Проверить domain-events registry, outbox, subscribers/consumers и `events.md`. Никаких fake future Payment/Ledger events.

## 30. IDEMPOTENCY / CONCURRENCY
Проверить concurrent duplicate Currency/business-key creation, sequence allocation, unique handling. Unknown P2002 нельзя превращать в success/no-op.

## 31. TRANSACTION BOUNDARIES
Проверить code allocation + entity create transaction. Не должно оставаться half-created records. AuditLog atomicity описать согласно реальному архитектурному контракту.

## 32. API / IDS / EVENTS DOC ACCURACY
Сверить docs с runtime: routes, methods, DTOs, Decimal serialization, permissions, errors, IDs и отсутствие future APIs/events. Docs не должны обещать Payment/Refund/Invoice/Ledger раньше соответствующих steps.

## 33. FRESH DB PROOF
Подтвердить, что e2e globalSetup реально drop/recreate DB + `migrate deploy` реальных migrations. Если да — full e2e является replay proof.

## 34. LEGACY COMPATIBILITY
Legacy Orders/Bookings/Sales/Checkout должны оставаться валидными без fabricated Finance backfill. Additive migration не должна требовать создания fake Payment/Tax/etc.

## 35. SECURITY / DATA CLASSIFICATION
Новые Finance entities не должны хранить PAN, CVV, raw card credentials, PSP secrets, ненужные bank details или PII.

## 36. REQUIRED NEGATIVE COVERAGE
Покрыть существующими или review regression tests:
1. anonymous 401;
2. BUYER/PARTNER/OPERATOR/SALES_MANAGER/MODERATOR/MARKETER/ANALYST write 403;
3. DIRECTOR write 403;
4. forged id/code/timestamp/version → 422;
5. duplicate currency → 409;
6. malformed currency → 422;
7. malformed/locale/alpha-3 country → 422;
8. FX zero/negative/excess precision → 422;
9. tax negative/excess precision → 422;
10. unknown Tax ref → controlled 4xx;
11. unknown resource → 404;
12. Payment/Refund/Invoice/Ledger/Settlement/Payout write routes → 404;
13. malformed input → no raw 500.

## 37. REQUIRED POSITIVE COVERAGE
Доказать:
- FINANCE/ADMIN Currency create;
- CUR/FXR/TAX/TXR codes;
- valid ISO currency/country;
- ExchangeRate Decimal round-trip without float authority;
- Tax + TaxRule relation;
- canonical reads;
- persistence;
- zero mutations Order/Booking/Availability/Product/acquisition;
- zero Payment/Refund/Invoice/Ledger/Settlement/Payout creation;
- zero Finance business events;
- AuditLog contract;
- fresh migration replay.

## 38. FULL REGRESSION — HARD GATE
Фактически выполнить после fixes:

Backend:
- `tsc --noEmit`;
- build;
- all unit;
- full serial e2e.

Frontend:
- typecheck;
- vitest;
- production build.

DB:
- migrate status;
- available drift/diff;
- fresh replay.

Указать точные counts.

## 39. REVIEW FIX POLICY
Для каждого defect: defect → risk → root cause → minimal patch → regression test → targeted rerun → full rerun.

Не начинать Ledger, PSP, Refund, Invoice, settlement/payout, commission accrual или Finance UI.

## 40. ARCHITECTURE STOP CONDITIONS
`ARCHITECTURE DECISION REQUIRED`, если:
1. competing financial sources of truth;
2. Payment schema уже требует ledger decision;
3. Finance PaymentTerms конфликтует с frozen Sales terms;
4. FX semantics неоднозначна для будущих postings;
5. Tax schema фиксирует спорную calculation authority;
6. Commission фиксирует неутверждённую recognition/basis;
7. Settlement/Payout ownership конфликтует;
8. legacy Stripe/Payment parallel writer активен;
9. корректность требует cross-domain write;
10. fix требует 2.10A/2.12+;
11. migration destructive/fabricated backfill;
12. finance milestones введены раньше 2.10C;
13. schema placeholder практически блокирует будущую approved architecture.

## 41. ROADMAP UPDATE
Только после review.

Допустимые verdict:
- `PHASE 2 STEP 2.10 STRICT REVIEW COMPLETED — APPROVED (NO REVIEW FIXES REQUIRED)`
- `PHASE 2 STEP 2.10 STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`
- `PHASE 2 STEP 2.10 STRICT REVIEW BLOCKED — ARCHITECTURE DECISION REQUIRED`

При APPROVED: Step 2.10 → approved; NEXT = `PHASE 2 — STEP 2.10A — LEDGER TRANSACTION FOUNDATION`. 2.10A не выполнять.

## 42. REQUIRED REPORT
Создать:
`docs/prompts/PHASE_2_STEP_2.10_FINANCE_DOMAIN_FOUNDATION_STRICT_REVIEW.md`

Структура:
1. Verdict
2. Repository baseline
3. Sources inspected
4. Current → Target
5. Finance ownership
6. Schema inventory
7. Migration review
8. Master-data authority
9. Currency
10. Country ISO
11. Decimal/money
12. FX semantics
13. Tax semantics
14. IDs
15. RBAC
16. Auth/IDOR/errors
17. Mass assignment
18. CRUD
19. Auditability
20. Ledger boundary
21. Payment boundary
22. PaymentTerms collision
23. Refund
24. Invoice
25. Commission
26. Settlement/Payout
27. Stripe/PSP legacy
28. Order financial fields
29. Booking isolation
30. Availability isolation
31. Pricing/frozen-money
32. Acquisition
33. Temporal boundary
34. Events
35. Idempotency/concurrency
36. Transactions
37. API contract
38. IDs contract
39. Events docs
40. Fresh DB proof
41. Legacy compatibility
42. Negative coverage
43. Positive coverage
44. Schema-only adversarial assessment
45. Security/data classification
46. Frontend regression
47. Backend regression
48. DB regression
49. Issues found
50. Review fixes
51. Architecture decision status
52. Roadmap update
53. Out-of-scope
54. Exact files changed
55. Exact NEXT item

## 43. OUT OF SCOPE
Явно подтвердить, что review не реализовал 2.10A Ledger, 2.10B ProviderFee/Settlement/Payout, 2.10C temporal, 2.12 Payment/PSP, 2.13 Refund, 2.14 Invoice, commission accrual, Finance Center frontend, tax engine или FX conversion engine.

## 44. FINAL LINE
Финальная строка отчёта должна быть ровно одной из:

`PHASE 2 STEP 2.10 STRICT REVIEW COMPLETED — APPROVED (NO REVIEW FIXES REQUIRED)`

`PHASE 2 STEP 2.10 STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`

`PHASE 2 STEP 2.10 STRICT REVIEW BLOCKED — ARCHITECTURE DECISION REQUIRED`
