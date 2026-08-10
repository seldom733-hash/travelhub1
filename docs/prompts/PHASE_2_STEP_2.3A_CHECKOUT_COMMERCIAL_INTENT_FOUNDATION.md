# PHASE 2 — STEP 2.3A — CHECKOUT / COMMERCIAL INTENT FOUNDATION — IMPLEMENTATION PROMPT

## 0. Роль и режим

Ты работаешь как Principal Software Architect / Staff Backend Engineer проекта TravelHub.

Твоя задача — реализовать:

**PHASE 2 — STEP 2.3A — Checkout / Commercial Intent Foundation**

строго по `TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`, действующим ADR, Phase 1 contracts и утверждённым результатам:

- Phase 2 Step 2.0 Entry Audit + Strict Review;
- Step 2.1 Sales Domain Foundation + Strict Review;
- Step 2.2 Sales Center Backend + Strict Review;
- Step 2.3 Quote & Commercial Offer Flow + Strict Review.

Step 2.3 APPROVED.

Не доверяй предыдущим отчётам как доказательству — проверяй фактический repository state.

---

# 1. CANONICAL ROADMAP SCOPE

Roadmap определяет Step 2.3A как:

> **Checkout / Commercial Intent Foundation**  
> Authoritative checkout context: Product/Tariff, travelers, options, service date/time, payment terms, publication/acquisition context. Frontend не является источником цены.

Это foundation коммерческого намерения перед Sale/Order flow.

Step 2.3A должен определить authoritative server-side checkout/commercial-intent context, но не завершать Sale и не создавать Order.

---

# 2. СТРОГИЙ OUT-OF-SCOPE

НЕ реализовывать в Step 2.3A:

## Step 2.3B — Payment Terms Foundation
Не реализовывать:
- FULL_PREPAYMENT;
- PARTIAL_PREPAYMENT;
- DEPOSIT;
- PAY_LATER;
- PAY_AT_SERVICE;
- partner-configurable payment schemes;
- prepayment percentages;
- due schedules;
- due dates;
- payment term policy engine.

Если payment terms нужны в checkout context, на 2.3A разрешён только neutral placeholder/reference contract, который не фиксирует 2.3B semantics.

## Step 2.4 — Sale Completion → OrderRequested
Не реализовывать:
- Sale completion;
- Sale CLOSED transition;
- `OrderRequested`;
- direct Sales→Order write;
- Order creation;
- Order consumer.

## Step 2.5+
Не реализовывать:
- Order snapshot consumer;
- Booking;
- Payment/PSP;
- Finance;
- Settlement/Payout;
- Documents commercial flow.

## Другие future features
Не реализовывать:
- cart UI;
- full Checkout frontend;
- payment provider;
- tax/commission engine;
- Subscription/Billing;
- Partner CRM;
- custom domains;
- analytics dashboards.

---

# 3. ОБЯЗАТЕЛЬНАЯ СВЕРКА STEP 2.3

Перед кодом подтвердить фактический baseline после Strict Review 2.3:

1. Quote DRAFT→ISSUED.
2. QuoteItem immutable commercial snapshot.
3. Decimal(12,2), half-up.
4. FIXED discount strict `<= subtotal`.
5. Quote-local currency.
6. validUntil.
7. minimal travelers.
8. snapshot binding semantics documented.
9. no Checkout context yet.
10. no Payment Terms semantics.
11. no Sale completion.
12. no `OrderRequested`.
13. no Availability reservation.
14. no Payment/Finance.
15. capability-based authorization preserved.

Если repository расходится — зафиксировать discrepancy до реализации.

---

# 4. ЦЕЛЬ STEP 2.3A

Создать **authoritative checkout/commercial-intent context**, который сервер может использовать как единственный источник коммерческого намерения пользователя/оператора.

Checkout context должен фиксировать:

- Product;
- Tariff;
- travelers;
- selected options;
- service date/time;
- authoritative price context;
- availability/capacity decision;
- publication/acquisition context;
- customer/buyer context where applicable;
- link to Quote/Sale foundation where justified;
- version/concurrency;
- temporal/history/audit;
- RBAC/object scope;
- idempotent or safely retryable mutation semantics where needed.

---

# 5. FRONTEND НЕ ИСТОЧНИК ЦЕНЫ — CRITICAL

Frontend может передавать:

- productId;
- tariffId;
- quantity/travelers;
- options;
- service date/time;
- acquisition/publication context hints only where permitted.

Frontend НЕ может authoritative передавать:

- unitPrice;
- subtotal;
- discountAmount;
- total;
- currency;
- fee;
- tax;
- availability status;
- reservation result;
- capacity;
- commercial snapshot fields.

Все authoritative monetary values считаются/проверяются сервером.

---

# 6. CHECKOUT CONTEXT OWNERSHIP

Определи owner checkout/commercial intent.

Не создавать новый bounded context без необходимости.

Предпочтительно owner должен быть совместим с Sales/Commercial flow и Roadmap.

Если нельзя однозначно решить:
- Sales owns CheckoutContext?
- отдельный Checkout bounded context?
- Order owns intent?

→ `ARCHITECTURE DECISION REQUIRED`.

Не выбирать фундаментального owner молча.

---

# 7. CHECKOUT CONTEXT IDENTITY

Если вводится отдельная canonical entity, она должна иметь:

- internal id;
- canonical code/id strategy по проектной convention;
- createdAt/updatedAt;
- version;
- lifecycle/status только если нужен;
- actor/customer linkage;
- immutable/mutable boundaries.

Не вводить human-readable prefix без Roadmap/ID contract основания.

Если отдельная entity не нужна, обосновать, почему существующего Quote достаточно.

---

# 8. QUOTE ↔ CHECKOUT RELATION

Определи, как Checkout context связан с Quote.

Возможные варианты должны следовать фактическому Roadmap/architecture:

- checkout derived from issued Quote;
- checkout independent with optional Quote;
- checkout creates Quote snapshot.

Не выбирать самостоятельно, если canonical source не определяет.

Критический invariant:

Checkout не должен размывать Quote snapshot semantics или создавать второй competing price authority.

---

# 9. PRODUCT/TARIFF AUTHORITY

Checkout должен server-side разрешать:

- productId;
- tariffId;
- eligibility;
- current tariff state;
- currency;
- relevant pricing fields.

Не доверять client snapshot.

Проверить отличие:

- Quote snapshot price;
- current Catalog Tariff price.

Если checkout должен использовать issued Quote price, это один contract.
Если должен reprice from Catalog — другой.

Это **binding-price decision**. Если канонический roadmap/ADR не даёт ответа:

`ARCHITECTURE DECISION REQUIRED`

Не смешивать обе semantics.

---

# 10. MONETARY RECONCILIATION GATE

Step 2.3 оставил monetary contract закрытым только Quote-local.

Step 2.3A должен обязательно сверить:

- Quote price authority;
- Checkout price authority;
- future Sale/Order propagation;
- currency;
- rounding;
- discount;
- future Payment reconciliation boundary.

Создать документированный authoritative monetary chain.

Не реализовывать Payment/Finance.

---

# 11. COMMERCIAL PRICE SNAPSHOT

Checkout context должен содержать enough immutable/computable facts, чтобы frontend не мог подменить цену.

Определи, какие поля:
- snapshot;
- recalculated;
- inherited from Quote;
- current from Catalog.

Не хранить mutable references как единственный источник будущей transaction truth.

Order final snapshot всё ещё принадлежит Step 2.5.

---

# 12. AVAILABILITY / CAPACITY — MANDATORY READINESS GATE

Step 2.0 и Step 2.3 оставили открытым prerequisite:

> Availability reservation/locking — до Step 2.3A/2.4.

Step 2.3A не должен выходить PASS, если Checkout подтверждает коммерческую доступность без безопасного concurrency contract.

Нужно определить и реализовать минимум, необходимый для authoritative checkout intent.

---

# 13. AVAILABILITY SOURCE-OF-TRUTH

Проверить фактическую Catalog/Availability модель:

- Product;
- Tariff;
- Availability;
- slots;
- capacity;
- service date/time;
- current reservation fields;
- indexes/version.

Не выдумывать inventory semantics, которых нет.

---

# 14. AVAILABILITY RESERVATION DECISION

Checkout должен честно определить:

### A. Read-only availability
тогда context НЕ может называться confirmed/reserved и не гарантирует доступность.

или

### B. Temporary hold/reservation
тогда нужны:
- concurrency-safe reservation;
- quantity/capacity;
- expiresAt;
- release semantics;
- retry/idempotency;
- history;
- no overbooking.

Если Roadmap требует reservation/locking уже до 2.4 и существующая модель недостаточна — реализовать минимальный safe contract либо остановиться с architecture decision.

---

# 15. NO FAKE AVAILABILITY

Запрещено:

- `available=true` на основе одного stale read без documented semantics;
- уменьшать slotsReserved без atomic guard;
- считать Quote ISSUE reservation;
- считать Product publication availability.

Если capacity не резервируется, response должен честно говорить `availability checked, not reserved` или canonical equivalent.

---

# 16. CONCURRENCY FOR CAPACITY

Если реализуется reservation:

обязательно atomic DB operation:

`available capacity >= requested`

и update в одной transaction / conditional update.

Проверить:
- two concurrent checkouts for last slot;
- only one success;
- no negative capacity;
- no oversell;
- retry behavior;
- expiration/release.

---

# 17. RESERVATION EXPIRY

Если hold вводится:

- expiresAt server-owned;
- UTC;
- bounded TTL;
- no client TTL override;
- expired hold не считается active;
- release/cleanup semantics.

Не внедрять background scheduler без необходимости; lazy-expiry/read-time semantics допустимы, если безопасны и документированы.

---

# 18. SERVICE DATE / TIME CONTEXT

Roadmap прямо требует service date/time.

Определи authoritative fields с учётом будущего Booking temporal contract.

Не путать:
- checkout createdAt;
- service date/time.

Если booking IANA timezone model ещё не готов, не выдумывать final Booking semantics.

---

# 19. SERVICE DATE/TIME MODEL

Минимально проверить:

- date-only service;
- optional time slot;
- timezone;
- date range, если Catalog/Availability уже это поддерживает.

Если current platform foundation не позволяет честно хранить service time without IANA timezone, классифицировать prerequisite.

Не молча использовать server timezone.

---

# 20. TRAVELERS

Checkout traveler context должен reconcile с QuoteTraveler.

Проверить:
- наследование from Quote;
- editing allowed?;
- snapshot/freeze timing;
- max count;
- age/category relevance;
- privacy.

Не добавлять passport/document data.

---

# 21. OPTIONS

Roadmap требует `options`.

Перед implementation найти фактическую Product/Tariff/options model.

Если canonical options entity отсутствует, нельзя invent arbitrary JSON options.

Допустимо:
- canonical option IDs;
- whitelisted structured selections;
- server resolution.

Если architecture source отсутствует → `ARCHITECTURE DECISION REQUIRED` или explicit deferred field only if roadmap permits.

---

# 22. OPTION PRICE AUTHORITY

Если options влияют на price:

- client sends option IDs/quantities only;
- server resolves option price;
- same Decimal/rounding contract;
- snapshot exact selected options.

Не принимать option price from frontend.

---

# 23. PUBLICATION CONTEXT

Checkout должен хранить/resolve transaction entry context отдельно от Product publication state.

Не выводить source постфактум из:
- current channel;
- URL;
- referrer.

---

# 24. ACQUISITION CONTEXT

Step 2.5B later propagates immutable transaction context.

Step 2.3A должен заложить canonical entry context foundation, минимум:

- MARKETPLACE;
- PARTNER_STOREFRONT;
- возможно MANUAL/DIRECT только если current contract допускает.

Не вводить future custom domain/API semantics раньше Roadmap без основания.

---

# 25. PUBLICATION ≠ ACQUISITION

Обязательный invariant:

`ProductPublicationChannel != AcquisitionSource != TransactionSource`

Нельзя использовать одно enum автоматически вместо другого, если semantics различаются.

---

# 26. TRUST BOUNDARY FOR SOURCE

Клиент не должен forged source/channel.

Определи server-authoritative derivation:

- route context;
- signed/internal context;
- trusted server resolution.

Если client hint разрешён — validate against authoritative context.

---

# 27. CUSTOMER / BUYER CONTEXT

Checkout может быть:

- authenticated BUYER;
- internal Sales-assisted;
- public anonymous intent.

Проверить actual Roadmap/support.

Не создавать anonymous Customer автоматически без canonical identity flow.

---

# 28. AUTHENTICATED BUYER SCOPE

Если BUYER checkout поддержан:

`actor.customerId` server-derived.

Клиент не выбирает чужой customerId.

Forged customerId ignored/rejected.

---

# 29. INTERNAL SALES-ASSISTED CHECKOUT

Если SALES_MANAGER может создать intent для Customer:

- customerId является business reference;
- server validates existence;
- permission does not derive from customerId;
- audit actor separate from customer.

---

# 30. ANONYMOUS CHECKOUT

Не реализовывать anonymous checkout, если canonical identity/ownership contract не определён.

Если Roadmap предполагает public intent, определить минимальную безопасную session linkage без превращения behavioral sessionId в Customer identity.

При неопределённости → architecture decision.

---

# 31. PAYMENT TERMS PLACEHOLDER BOUNDARY

Roadmap 2.3A упоминает payment terms, но Step 2.3B отдельно определяет canonical schemes.

Поэтому в 2.3A:

НЕ финализировать enums 2.3B преждевременно.

Допустимо:
- `paymentTermsStatus: NOT_SELECTED`;
- nullable reference placeholder;
- capability flag;
если реально нужен contract.

Если не нужен — не добавлять поле.

---

# 32. CHECKOUT STATUS / LIFECYCLE

Минимальный lifecycle only if necessary.

Не вводить:
- PAID;
- COMPLETED;
- ORDERED;
- BOOKED;
- FULFILLED.

Возможные foundation states должны быть строго связаны с intent/reservation semantics.

Если status model фундаментально влияет на Step 2.4 → architecture decision.

---

# 33. CHECKOUT EXPIRATION

Если intent/hold имеет expiry:

- separate from Quote validUntil;
- semantics explicit;
- UTC;
- no updatedAt surrogate.

Quote validity ≠ reservation TTL.

---

# 34. VERSION / CAS

Все mutable checkout intent operations должны иметь optimistic concurrency или equivalent.

Проверить:
- stale edit;
- concurrent option/traveler/date update;
- reservation state.

No lost update.

---

# 35. IDEMPOTENCY

Step 2.10 — owner global checkout/payment idempotency keys.

Но Step 2.3A не должен создавать unsafe retry behavior for reservation.

Если reservation create может duplicate hold:
- use deterministic context identity / unique constraint / local idempotency mechanism specific to reservation, либо architecture decision.

Не объявлять global Idempotency-Key implemented.

---

# 36. API SURFACE

Минимальный API, например по current conventions:

- create checkout intent;
- get detail;
- update travelers;
- update options;
- update service date/time;
- refresh/revalidate price;
- check/reserve availability;
- cancel/release intent if reservation exists.

Не добавлять payment/order actions.

---

# 37. NO GENERIC PATCH

Все commercial mutations — explicit action/DTO.

Никакого unrestricted status/price/source/reservation patch.

---

# 38. SERVER-OWNED FIELDS

Forbidden/mass-assignment:

- id/code;
- status;
- price/totals/currency;
- snapshot labels;
- availability result;
- capacity;
- reservedAt/expiresAt;
- actor/customer authority fields;
- source/acquisition if server-derived;
- timestamps;
- version except expectedVersion;
- requestId/correlation/causation;
- future order/payment IDs.

---

# 39. RBAC / CAPABILITY MODEL

Сохранить permission-driven architecture.

System roles = presets.

Checkout endpoints должны использовать capabilities/permissions, не hardcoded role names.

---

# 40. ROLE/CAPABILITY MATRIX

Проверить минимум:

- anonymous;
- BUYER;
- SALES_MANAGER;
- DIRECTOR;
- ADMIN;
- ANALYST;
- MARKETER;
- FINANCE;
- PARTNER;
- MODERATOR.

Определить exact read/write/create semantics.

Не давать aggregate-only roles raw checkout data.

---

# 41. PARTNER ACCESS

Не давать PARTNER checkout internal access автоматически.

Если Storefront/public flow позже требует partner context, owner должен быть explicit.

---

# 42. PRIVACY

Checkout может содержать PII.

Минимизировать:
- travelers only required fields;
- no passport;
- no payment data;
- no CRM notes/tags;
- no contact values unless essential;
- no raw behavioral session identity merge.

---

# 43. HISTORY / AUDIT

Critical changes:
- created;
- travelers changed;
- options changed;
- service date/time changed;
- price revalidated;
- reservation created/released/expired;
- acquisition context fixed.

History immutable.

Audit minimal, no PII/raw request.

---

# 44. TEMPORAL SEMANTICS

Разделить:
- createdAt/updatedAt;
- serviceStartsAt/serviceDate;
- reservedAt;
- reservationExpiresAt;
- cancelledAt/expiredAt if lifecycle introduced.

No updatedAt-as-milestone.

---

# 45. PRICE REVALIDATION

Если Checkout derived from issued Quote, определить:

- inherited price frozen;
или
- server reprice required.

Нельзя одновременно показывать one total and reserve/order another.

---

# 46. QUOTE VALIDITY

Если Checkout основан на Quote:

- expired Quote cannot create authoritative checkout unless explicit refresh/reprice contract;
- validUntil must be checked server-side.

Не продлевать Quote молча.

---

# 47. DISCOUNT PROPAGATION

Checkout должен preserve/reconcile Quote discount semantics.

Не allow client to edit discount unless explicitly authorized Sales flow.

BUYER checkout не должен самостоятельно менять Sales discount.

---

# 48. CURRENCY

Single authoritative currency.

Mixed currency inputs rejected.

No FX conversion.

Finance Currency master data future.

---

# 49. MONEY BOUNDARIES

No:
- tax;
- commission;
- PSP fee;
- settlement;
- payment amount capture.

Checkout total is commercial intent total, not paid amount.

---

# 50. ORDER / BOOKING ISOLATION

Mandatory proof:

Checkout create/update/reserve:
- no Order;
- no Booking;
- no `OrderRequested`;
- no Payment;
- no Sale completion.

---

# 51. SALE RELATION

If Checkout links to Sale, define:
- direction;
- ownership;
- whether Sale exists before checkout.

Do not make Sale completed.

No Sale CLOSED.

---

# 52. OUTBOX / EVENTS

Do not add speculative events unless required.

No `OrderRequested`.

If reservation needs events, justify real consumer.

No critical async dependency unless Outbox reliability prerequisite is already addressed.

---

# 53. OUTBOX RELIABILITY GATE

Known prerequisite:

automated Outbox retry/recovery required before/in 2.4/2.5.

Step 2.3A must not create a critical business action whose correctness depends on unrecoverable FAILED outbox delivery.

---

# 54. DATABASE MODEL

If new entity/table added:

- additive migration;
- indexes by actual queries;
- no cross-schema FK violating ADR;
- no guessed backfill;
- version;
- expiry indexes if needed.

Do not edit prior migrations.

---

# 55. AVAILABILITY INDEXES

If reservation uses:
- productId;
- tariffId;
- service date/time;
- expiresAt;
- active status;

indexes must support atomic availability query and cleanup/read semantics.

---

# 56. UNIQUE / CONCURRENCY CONSTRAINTS

If one active reservation per checkout:
- unique/partial strategy if DB supports;
- service invariant;
- race test.

Do not rely only on application `findFirst`.

---

# 57. FAILURE ATOMICITY

Critical transaction, if reservation/price snapshot is persisted:

- context state;
- price;
- reservation;
- history

must not partially commit.

Failure injection required.

---

# 58. AVAILABILITY RACE TEST

Mandatory if capacity exists:

last available slot/capacity unit:
- two concurrent checkout reservations;
- exactly one success if requested total exceeds remaining capacity;
- no negative/free capacity drift.

---

# 59. RESERVATION RELEASE TEST

If hold exists:
- cancel/release restores capacity;
- repeated release safe;
- expired hold ignored/released by contract;
- no double restore.

---

# 60. PRICE RACE TEST

Catalog price changes concurrently with checkout creation/revalidation.

Result must follow documented binding-price policy.

No mixed snapshot.

---

# 61. QUOTE RACE TEST

If checkout references Quote:

- Quote cannot mutate after ISSUE already;
- expired quote handling deterministic;
- checkout cannot create from DRAFT unless explicitly supported.

---

# 62. CUSTOMER IDOR

BUYER A cannot checkout as Customer B.

Internal staff selection obeys permission.

No `?customerId=` authority.

---

# 63. SOURCE SPOOFING TEST

Attempt forged:
- acquisitionSource;
- publicationChannel;
- storefrontId;
- partnerId;
- marketplace flag.

Server must derive/reject.

---

# 64. OPTION IDOR

Selected option IDs must belong to Product/Tariff/context.

Foreign option → 422/404.

No arbitrary JSON.

---

# 65. SERVICE DATE VALIDATION

Check:
- past;
- invalid date;
- unavailable date;
- timezone;
- DST if time-based;
- outside Tariff validity;
- outside availability range.

---

# 66. TRAVELER COUNT / CAPACITY

If traveler count determines quantity/capacity:
- server computes required capacity from traveler context;
- client cannot mismatch quantity vs travelers.

If semantics differ by Product type, do not invent universal rule.

---

# 67. PREVIEW / AUTHORITATIVE SUMMARY

Checkout detail should return explicit authoritative summary:

- source;
- product/tariff snapshot;
- travelers/options;
- service timing;
- money;
- availability state;
- reservation expiry if any;
- validity.

No client-computed authoritative fields.

---

# 68. EXPIRED / STALE CONTEXT

Define how system represents:
- price stale;
- quote expired;
- availability expired;
- reservation expired.

Do not silently treat as valid.

---

# 69. ERROR MODEL

Use canonical:
- 400 malformed;
- 401;
- 403;
- 404;
- 409 concurrency/conflict;
- 422 business validation;
- 500 sanitized.

Always requestId.

No stack/Prisma/SQL.

---

# 70. VALIDATIONPIPE

Preserve:
- whitelist;
- transform;
- no implicitConversion.

Nested travelers/options require explicit DTO validation and forbidden-key checks where needed.

---

# 71. PUBLIC/PRIVATE BOUNDARY

If public checkout endpoints are introduced:

- strict DTO;
- no internal projection;
- no auth header required only where intended;
- anti-enumeration;
- no staff-only fields.

Do not expose Sales internal identifiers unnecessarily.

---

# 72. BEHAVIORAL ≠ CHECKOUT

Marketplace/Storefront behavioral event does not automatically create Checkout.

Commercial intent must be explicit user/business action.

---

# 73. ACQUISITION FROM BEHAVIORAL CONTEXT

If behavioral session context is used to derive acquisition:

- no PII merge;
- no sessionId→Customer identity assumption;
- source trust must be server-authoritative.

---

# 74. FRONTEND

Step 2.3A is backend/foundation unless Roadmap explicitly requires frontend.

Do not build full Checkout UI.

Frontend regression mandatory.

---

# 75. DOCUMENTATION

Create/update canonical doc, e.g.:

`docs/architecture/checkout-commercial-intent.md`

Must contain:
- ownership;
- entity/context model;
- Quote relation;
- price authority;
- monetary reconciliation;
- availability semantics;
- reservation/hold contract;
- service date/time;
- travelers/options;
- acquisition/publication context;
- trust boundary;
- lifecycle/expiry;
- RBAC/capabilities;
- history/audit;
- concurrency/idempotency;
- explicit non-goals 2.3B/2.4+.

---

# 76. ADR TRIGGER

If Checkout ownership or binding-price semantics is genuinely new and cross-domain, determine whether ADR is required.

Do not create ADR for local implementation detail.

---

# 77. ROADMAP PREREQUISITES STATUS

At end classify:

1. Outbox retry — still open until before/in 2.4/2.5.
2. Booking currency — open to 2.8.
3. Monetary contract — should be reconciled across Quote+Checkout, but Order/Finance propagation still open.
4. Availability reservation/locking — must now be either CLOSED or explicitly proven not required until 2.4 with safe read-only semantics.
5. Order snapshot policy — open to 2.5.
6. bootstrap removal — 2.6.
7. Payment/PSP/ledger — 2.10C/2.12.
8. Supplier lifecycle — 2.8.
9. Checkout/payment idempotency keys — global owner 2.10; local reservation retry safety must already be sufficient.

---

# 78. CAPABILITY / NAVIGATION DECISION

Preserve Step 3.12E/DD-021:

- roles = presets;
- permissions = authority;
- per-user capabilities;
- permission-driven sidebar later;
- no admin capability UI now.

---

# 79. REQUIRED E2E SPEC

Create separate:

`backend/test/checkout-commercial-intent.e2e-spec.ts`

or canonical equivalent.

Do not overload Quote spec.

---

# 80. MINIMUM E2E COVERAGE

At minimum:

1. auth/permission matrix;
2. create authoritative checkout context;
3. forged price/totals rejected;
4. Quote/Catalog binding-price semantics;
5. customer scope;
6. travelers;
7. options;
8. service date/time;
9. source spoofing;
10. currency;
11. price/discount consistency;
12. availability check;
13. reservation race if implemented;
14. reservation release/expiry if implemented;
15. stale version conflict;
16. history/audit;
17. privacy;
18. no Order/Booking/Payment;
19. no `OrderRequested`;
20. Sale remains not completed;
21. requestId/error model.

---

# 81. UNIT TESTS

For pure logic:
- checkout money reconciliation;
- availability calculation;
- reservation expiry;
- service date validation;
- option normalization;
- source mapping;
- transition guards.

Do not add meaningless unit tests.

---

# 82. PERFORMANCE

Check:
- detail bounded;
- no N+1 travelers/options;
- availability query indexed;
- reservation check atomic;
- no unbounded scans;
- public endpoints capped.

---

# 83. MIGRATION

If schema changes:
- new forward migration;
- clean replay;
- migrate status;
- diff no drift;
- no db push;
- no editing applied migrations.

---

# 84. RUNTIME VERIFICATION

On isolated instance:

- authorized create;
- authoritative total;
- forged total rejected;
- service context;
- source;
- availability;
- concurrent last-slot behavior if applicable;
- stale context handling;
- BUYER IDOR negative;
- no Order/Booking/Payment;
- no OrderRequested;
- Sale unchanged;
- requestId envelope.

---

# 85. FULL REGRESSION

Backend:
- tsc;
- unit;
- Step 2.1 e2e;
- Step 2.2 e2e;
- Step 2.3 e2e;
- new 2.3A e2e;
- full serial e2e.

Frontend:
- tsc;
- vitest;
- next build.

DB:
- migrate status;
- clean replay;
- diff/no drift.

No skipped/timeouts silently accepted.

---

# 86. ARCHITECTURE DECISION REQUIRED CONDITIONS

Return `ARCHITECTURE DECISION REQUIRED` if implementation requires deciding:

1. Checkout bounded-context owner not inferable.
2. Binding price at Quote vs Checkout is ambiguous.
3. Whether Checkout reprices issued Quote.
4. Availability reservation owner/lifecycle unclear.
5. Option model has no canonical owner.
6. Transaction source authority cannot be derived safely.
7. Anonymous checkout identity model needed.
8. Service timezone model required but absent.
9. Payment Terms semantics must be chosen before 2.3B.
10. Cross-domain transaction/FK/write contrary to ADR.

Do not improvise.

---

# 87. REQUIRED EXPLICIT ANSWERS

Final report must answer:

1. Step 2.3A scope respected?
2. Checkout context owner clear?
3. Price authority server-side?
4. Binding-price semantics explicit?
5. Quote vs Checkout monetary contract reconciled?
6. Frontend cannot forge money?
7. Currency authoritative?
8. Availability semantics honest?
9. Reservation/locking prerequisite closed or safely deferred?
10. Capacity concurrency safe?
11. Reservation expiry/release safe?
12. Service date/time semantics clear?
13. Timezone honest?
14. Travelers minimized?
15. Options canonical?
16. Option prices server-authoritative?
17. Acquisition source server-authoritative?
18. Publication != acquisition?
19. BUYER customer scope safe?
20. Internal assisted checkout safe?
21. Anonymous identity not fabricated?
22. Payment Terms 2.3B not started?
23. Sale completion 2.4 not started?
24. No OrderRequested?
25. No Order/Booking/Payment side effects?
26. Capability model preserved?
27. History/audit complete?
28. Concurrency/CAS safe?
29. Retry/reservation idempotency safe?
30. Migration clean?
31. Full regression green?
32. Architecture decision required?
33. Approve 2.3A?
34. Ready for separate 2.3B prompt after approval?

---

# 88. FINAL REPORT FORMAT

Return:

# PHASE 2 — STEP 2.3A — CHECKOUT / COMMERCIAL INTENT FOUNDATION — ОТЧЁТ

1. Verdict
2. Repository baseline
3. Sources inspected
4. Roadmap scope verification
5. Step 2.3 baseline
6. Checkout ownership
7. Data model
8. Checkout identity
9. Quote relation
10. Product/Tariff authority
11. Binding-price semantics
12. Monetary reconciliation
13. Commercial snapshot
14. Availability model
15. Reservation/locking decision
16. Capacity concurrency
17. Reservation expiry/release
18. Service date/time
19. Timezone semantics
20. Travelers
21. Options
22. Option pricing
23. Publication context
24. Acquisition context
25. Source trust boundary
26. Customer/Buyer scope
27. Internal assisted flow
28. Anonymous boundary
29. Payment Terms boundary
30. Lifecycle/expiry
31. Version/CAS
32. Idempotency boundary
33. API surface
34. DTO/mass-assignment
35. RBAC/capabilities
36. Privacy
37. History/audit
38. Temporal semantics
39. Quote validity
40. Discount/currency propagation
41. Order/Booking/Sale isolation
42. Events/outbox
43. Outbox reliability
44. DB/migration
45. Indexes
46. Failure atomicity
47. Availability race tests
48. Price/Quote race tests
49. IDOR/security
50. ValidationPipe
51. Error model
52. Public/private boundary
53. Behavioral boundary
54. Documentation
55. Unit tests
56. E2E tests
57. Runtime verification
58. Performance
59. Full regression
60. Remaining prerequisites
61. Capability decision preservation
62. Issues found/fixed
63. Architecture decision status
64. Out-of-scope confirmation
65. Files changed

---

# 89. ALLOWED FINAL VERDICTS

### Success
`PHASE 2 STEP 2.3A IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

### Architecture decision
`ARCHITECTURE DECISION REQUIRED`

### Blocked
`PHASE 2 STEP 2.3A BLOCKED — FOUNDATION GAP`

---

# 90. STOP CONDITION

После Step 2.3A:

**НЕ начинать Step 2.3B.**
**НЕ начинать Step 2.4.**
**НЕ выполнять Strict Review самостоятельно.**

Вернуть полный implementation report и ждать отдельного review prompt.
