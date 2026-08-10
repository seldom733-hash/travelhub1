# PHASE 2 --- STEP 2.3 --- QUOTE & COMMERCIAL OFFER FLOW --- STRICT REVIEW PROMPT

## 0. Роль и режим

Проведи независимый STRICT REVIEW PHASE 2 --- STEP 2.3. Implementation
report --- не доказательство. Проверяй schema/migration, production
code, DTO/validation, permissions, transactions, history/audit, tests,
runtime и docs. Не переходить к 2.3A/2.3B/2.4. Local defect → REVIEW
FIX + targeted regression + full regression. Fundamental
commercial/ownership decision → ARCHITECTURE DECISION REQUIRED.

## 1. Scope

Проверить canonical scope: Quote composition, Product/Tariff snapshot,
quantity, backend-authoritative Decimal price, currency, discount,
validity, minimal customer/traveler context, DRAFT→ISSUED, immutable
issued snapshot, history/audit, RBAC/IDOR. Запрещено преждевременно
реализовывать Checkout 2.3A, Payment Terms 2.3B, Sale
completion/OrderRequested 2.4, Order/Booking, Availability reservation,
Payment/Finance, tax/commission, Subscription, PDF/email и UI.

## 2. Baseline

Зафиксировать branch/HEAD/git status/actual diff/migrations. Проверить
regressions Step 2.1/2.2: Sales Center, permissions/capabilities,
aggregate-only ANALYST/MARKETER, FINANCE no Quote raw, Sale OPEN-only,
no OrderRequested.

## 3. Data model / ownership

Инвентаризировать Quote, QuoteItem, QuoteTraveler, QuoteHistory,
QuoteDiscountType. Для полей: source, nullable, mutable DRAFT, frozen
ISSUED, API exposure, indexes. Sales owns sales.\* only; Catalog/CRM
read-by-ID; no cross-context writes/FKs contrary to ADR.

## 4. Product/Tariff snapshot

Проверить authoritative sources productId/code/title and
tariffId/code/name/price/currency. Client values forbidden. Учесть
Catalog tariff delete+recreate semantics. Issued Quote должен переживать
изменение/удаление Catalog Tariff.

## 5. Snapshot timing --- CRITICAL

Определить фактическую semantics: snapshot at add vs refresh at ISSUE.
Проверить, что stale Catalog change между add и ISSUE имеет однозначный
documented behavior. Не менять binding-price semantics без canonical
basis; при фундаментальной неопределённости → ARCHITECTURE DECISION
REQUIRED.

## 6. Snapshot immutability proof

DRAFT → add Product/Tariff → ISSUE → production Catalog mutation
title/name/price/currency/delete+recreate → issued Quote unchanged по
snapshot и money.

## 7. DRAFT preview

Preview/detail и ISSUE должны использовать согласованную semantics. Не
допустить скрытого current-price vs persisted-price расхождения.

## 8. Money / Decimal

Repo-wide: authoritative money только Decimal, no JS
float/parseFloat/Number. Проверить DECIMAL(12,2), serialization,
negative guards.

## 9. Precision/overflow

Проверить max unitPrice, quantity, line, subtotal, discount, total.
DTO/service должны предотвращать DB overflow и sanitized 422/409 вместо
Prisma 500. Добавить boundary tests при gap.

## 10. Rounding

Проверить half-up 2dp и этапы rounding: line/subtotal/discount/total.
Cases: 0.005, 1.005, 2.675, percentage fractions, multiple lines.
Preview == ISSUE.

## 11. Currency

Первый item фиксирует currency; mixed currency → 422; client cannot
forge. Проверить remove-last-item: очищается ли currency и можно ли
затем добавить item другой валюты. ISSUE без currency невозможен.

## 12. Price authority / quantity

Forbidden client fields: unitPrice, amount, subtotal, discountAmount,
total, currency, snapshot fields. Quantity integer \>0, bounded;
zero/negative/decimal/huge/string invalid согласно explicit conversion
contract.

## 13. Discount --- MANDATORY contradiction

Отчёт одновременно заявляет FIXED \<= subtotal и
FIXED=min(value,subtotal). Проверить код. A) strict: \>subtotal → 422,
без silent clamp. B) clamp: \>subtotal accepted и effective=subtotal,
docs/tests должны это явно говорить. Нельзя оставлять обе semantics.
Если canonical contract не определяет выбор и это commercial decision →
ARCHITECTURE DECISION REQUIRED. Также проверить NONE/PERCENTAGE/FIXED
transitions, PERCENTAGE 0/100/\>100/\<0, precision, stale discountValue
cleanup.

## 14. Tax/fee boundary

No tax/VAT/platform fee/commission/PSP fee/margin/markup engine.
Tariff.price как final sell price --- только явно documented Step 2.3
boundary.

## 15. Validity

validUntil strict ISO/UTC, future server-time, mandatory at ISSUE,
immutable after ISSUE; issuedAt server-owned. No fake EXPIRED
lifecycle/scheduler.

## 16. Lifecycle / ISSUE

Только DRAFT→ISSUED. Validate \>=1 item, currency, validUntil,
discount/totals; CAS; issuedAt; history; audit; terminal protection.

## 17. ISSUE atomicity

Проверить transaction boundaries и failure injection между CAS/status,
totals persistence, history, audit. Не заявлять atomicity сильнее
фактической. Failed CAS/failure must leave no partial issued aggregate.

## 18. Re-issue / post-ISSUE

Re-issue: no timestamp/history/audit duplicate. После ISSUE запретить
add/update/remove item, customer/travelers/commercial/validity/discount
edits.

## 19. Customer

Canonical crm.Customer.id read-by-ID only; no CRM write/PII copy; null
semantics; immutable after ISSUE.

## 20. Travelers / privacy

Допустимый минимум firstName/lastName/birthDate?. No
passport/document/citizenship/gender/email/phone/address/payment/medical.
Проверить data minimization, max 50, bounds/control chars, nested
forbidden keys.

## 21. birthDate semantics

birthDate --- calendar date, не UTC instant. Проверить impossible/future
dates и отсутствие timezone day-shift. Если Prisma DateTime используется
для date-only --- доказать контракт тестами.

## 22. Eligibility

Product exists; проверить точные allowed statuses, а не автоматически
считать status!=ARCHIVED достаточным. Tariff belongs to product,
validity window valid. Marketplace publication не должна определять
internal Sales eligibility без явного контракта.

## 23. Catalog race

Между eligibility read и Quote write Catalog может измениться.
Зафиксировать фактическую consistency/stale snapshot semantics без
cross-context transaction.

## 24. Availability

No reservation/hold/decrement/write. Advisory read не является
guarantee.

## 25. API inventory

Составить route/method/permission/input/state guard/version/response для
add/update/remove item, customer, travelers, commercial, preview, issue,
detail/history. Проверить отсутствие unrestricted generic PATCH bypass.

## 26. Projections/history/audit

Detail whitelist; Step2.2 list header-only. History должен покрывать
meaningful item add/update/remove, customer, travelers, commercial,
issue. Проверить gap: отчёт не упоминает
traveler_changed/item_updated/item_removed. Audit/history без traveler
PII/raw body.

## 27. RBAC/capabilities

Authorization permission-driven, not role-hardcoded.
ANALYST/MARKETER/FINANCE raw Quote denied; BUYER/PARTNER/MODERATOR
denied. Small-organization future multi-capability model не ломать;
admin UI не реализовывать.

## 28. IDOR/mass assignment

Unknown quote, foreign itemId, opportunity/customer/product/tariff refs.
Child lookup parent-scoped. Forbidden
id/code/status/version/timestamps/actors/totals/snapshot/money/trace/future
order-booking-payment IDs.

## 29. ValidationPipe

Shared GLOBAL_VALIDATION_PIPE_OPTIONS whitelist+transform, no
enableImplicitConversion. Особо nested arrays QuoteTraveler/QuoteItem
--- не вернуть Step 1.12.2 regression. Nested forged
id/createdAt/quoteId/price/currency/snapshot → explicit 422 где контракт
этого требует.

## 30. Concurrency

ISSUE vs ISSUE: one success, one failure, one issued history/audit,
coherent totals. ISSUE vs edit: no partial mix; aggregate either
edit-before-issue or issue-before-edit; coherent history. Concurrent
item edits with same version: one winner, no lost update.

## 31. Idempotency boundary

Global Idempotency-Key не внедрять. Документировать retry risks add/edit
до Step 2.10. Repeat ISSUE safe terminal failure.

## 32. Events/Sale/next-step boundaries

No Quote speculative events, OrderRequested,
OrderCreated/BookingCreated. Sale stays OPEN; no
conversion/close/complete. No 2.3A Checkout, 2.3B Payment Terms, 2.4
Order flow.

## 33. Monetary prerequisite

Step 2.3 closes only Quote-local monetary contract.
Checkout/Order/Finance propagation remains open.

## 34. Performance/indexes

Detail bounded include, no N+1; history paginated; Step2.2 list no
items/travelers; Catalog reads by ID. Review QuoteItem/QuoteTraveler
indexes against actual query patterns.

## 35. Migration / legacy

Review migration additive, Decimal exact, no fake backfill, no
cross-schema FK, no edited applied migration. Legacy Quotes with NULL
composition/money must remain honest; list/detail/ISSUE must not
fabricate totals/currency/issuedAt.

## 36. Existing test modifications

Strictly inspect Step2.1/2.2 spec changes made to satisfy new ISSUE
contract. Ensure old invariants were not weakened.

## 37. Required targeted tests if missing

FIXED discount contradiction; Decimal overflow; remove-last-item
currency; birthDate date-only; item update/remove/traveler history;
ISSUE rollback injection; Catalog change before ISSUE; legacy Quote
NULL; every post-ISSUE mutation; aggregate-only roles.

## 38. Runtime verification

Anonymous 401; authorized
create/add/customer/traveler/commercial/preview/issue; Catalog mutate
then issued unchanged; post-issue edit/reissue rejected;
ANALYST/MARKETER/FINANCE denied; Sale OPEN; Order/Booking unchanged;
OrderRequested absent; Availability unchanged; forged price/totals 422;
invalid discount deterministic; requestId envelope.

## 39. Error model

400/401/403/404/409/422/500; X-Request-Id == body requestId; no
stack/Prisma/SQL/internal paths/PII.

## 40. Migration replay / full regression

prisma migrate status; clean replay; migrate diff no drift; no db push.
Backend: tsc, unit, Step2.1 e2e, Step2.2 e2e, Step2.3 e2e, full serial.
Frontend: tsc, vitest, next build. Skipped/timeouts != PASS.

## 41. Docs

quote-commercial-offer.md must document ownership, snapshot
timing/stale-before-issue semantics, issued immutability,
Decimal/rounding, currency/remove-last-item behavior, exact discount
semantics, validity, privacy, eligibility, availability non-reservation,
RBAC/capabilities, history/audit, concurrency, legacy NULL, non-goals
2.3A/2.3B/2.4.

## 42. Remaining prerequisites

Keep open: 1. Outbox retry/recovery before/in 2.4/2.5. 2. Booking
currency before 2.8. 3. Monetary propagation beyond Quote before
2.3A/2.4. 4. Availability reservation/locking before 2.3A/2.4. 5. Order
commercial snapshot policy before 2.5. 6. /orders/bootstrap removal 2.6.
7. Payment/PSP/ledger 2.10C/2.12. 8. Supplier lifecycle 2.8. 9.
Checkout/payment idempotency 2.10.

## 43. Finding classification

CRITICAL: wrong money/PII/unauthorized/cross-domain corruption. HIGH:
mutable snapshot/client price/lifecycle bypass/partial ISSUE/wrong
discount/next-step creep. MEDIUM:
rounding/history/currency/validation/legacy/query. LOW: docs/test
robustness. For each: reproduction, evidence, root cause, impact, fix,
tests, regression.

## 44. Architecture decision triggers

ARCHITECTURE DECISION REQUIRED if correction requires deciding
binding-price timing, ISSUE repricing, new pricing owner,
tax/fee/commission ownership, multi-currency, Quote
acceptance/conversion, Checkout/Order snapshot owner, traveler identity
redesign, platform-wide money redesign.

## 45. Required explicit answers

Answer explicitly: 1 Scope respected? 2 Composition canonical? 3 Product
source authoritative? 4 Tariff source authoritative? 5 Snapshot timing
clear? 6 Issued immutable? 7 Preview/ISSUE consistent? 8 Decimal
end-to-end? 9 Overflow safe? 10 Rounding deterministic? 11 Currency
correct? 12 Remove-last currency correct? 13 Client cannot control
price? 14 Quantity bounded? 15 Discount unambiguous? 16 FIXED\>subtotal
exact behavior? 17 Discount transitions correct? 18 No tax/fee creep? 19
validUntil correct? 20 ISSUE atomic? 21 Reissue safe? 22 All post-ISSUE
mutations blocked? 23 Customer safe? 24 Traveler minimized? 25 birthDate
correct? 26 Eligibility correct? 27 No availability reservation? 28 No
generic PATCH bypass? 29 History complete? 30 Audit no PII? 31
Capability model preserved? 32 Aggregate-only/FINANCE denied? 33 IDOR
closed? 34 Nested forged explicit reject? 35 ValidationPipe regression
absent? 36 Concurrent ISSUE correct? 37 ISSUE-vs-edit coherent? 38 No
speculative events? 39 Sale OPEN? 40 2.3A absent? 41 2.3B absent? 42 2.4
absent? 43 Order/Booking/Availability unaffected? 44 Monetary
prerequisite only Quote-local? 45 Migration clean? 46 Legacy honest? 47
2.1/2.2 regressions green? 48 Full regression green? 49 blockers? 50
architecture decision? 51 approve 2.3? 52 may prepare separate 2.3A
prompt after approval?

## 46. Final report format

# PHASE 2 --- STEP 2.3 --- QUOTE & COMMERCIAL OFFER FLOW --- STRICT REVIEW --- ОТЧЁТ

1 Verdict 2 Repository baseline 3 Files/modules inspected 4 Roadmap
scope 5 Step2.1/2.2 regression 6 Ownership 7 Data model 8 Composition 9
Product snapshot 10 Tariff snapshot 11 Snapshot timing 12 Immutability
13 DRAFT preview 14 Money 15 Precision/overflow 16 Rounding 17 Currency
18 Price authority 19 Quantity 20 Discount 21 FIXED strict review 22
Discount transitions 23 Tax/fee boundary 24 Validity 25 Lifecycle 26
ISSUE atomicity 27 Reissue 28 Post-ISSUE immutability 29 Customer 30
Travelers/privacy 31 Traveler dates 32 Eligibility 33 Catalog race 34
Availability 35 API inventory 36 Generic PATCH 37 Projections 38 History
39 Audit 40 RBAC/capabilities 41 Aggregate-only/FINANCE 42 IDOR 43
DTO/mass-assignment 44 ValidationPipe 45 Concurrency 46 Idempotency 47
Events/outbox 48 Sale boundary 49 2.3A boundary 50 2.3B boundary 51 2.4
boundary 52 Monetary prerequisite 53 Performance 54 Indexes 55 Migration
56 Legacy 57 Existing-test changes 58 E2E quality 59 Runtime 60 Error
model 61 Replay/drift 62 Full regression 63 Docs 64 Remaining
prerequisites 65 Reliability sequencing 66 Deferred Decisions 67
Findings 68 Review fixes 69 Remaining debt 70 Architecture decision 71
Approval recommendation 72 Out-of-scope 73 Files changed during review

## 47. Allowed verdicts

`PHASE 2 STEP 2.3 STRICT REVIEW COMPLETED — APPROVED` or
`PHASE 2 STEP 2.3 REVIEW FIXES COMPLETED — WAITING FOR APPROVAL` or
`ARCHITECTURE DECISION REQUIRED` or
`PHASE 2 STEP 2.3 STRICT REVIEW FAILED — BLOCKER FOUND`

## 48. Stop condition

После review НЕ начинать 2.3A/2.3B/2.4. Вернуть полный report и ждать
explicit approval.
