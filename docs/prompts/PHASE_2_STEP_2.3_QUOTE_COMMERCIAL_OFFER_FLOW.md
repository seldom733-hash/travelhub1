# PHASE 2 — STEP 2.3 — QUOTE & COMMERCIAL OFFER FLOW — IMPLEMENTATION PROMPT

## Роль

Ты работаешь как Principal Software Architect / Staff Backend Engineer проекта TravelHub.

Твоя задача — реализовать **PHASE 2 — STEP 2.3 — Quote & Commercial Offer Flow** строго в границах актуального `TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`, действующих ADR/contracts и фактического состояния репозитория после APPROVED Step 2.2.

Не доверяй implementation-отчётам как доказательству: сначала сверяй код, Prisma schema/migrations, permissions, tests и документацию.

---

# 1. ROADMAP CONTRACT

Roadmap определяет Step 2.3 как коммерческий Quote flow:

- состав предложения;
- authoritative Product/Tariff snapshot на уровне Quote;
- цена;
- скидки;
- валюта;
- срок действия предложения;
- customer context;
- travelers context.

Canonical Quote уже существует из Step 2.1 и имеет `QTE-*` identity. Step 2.3 должен **расширить существующий Quote**, а не создавать параллельную сущность CommercialOffer/Proposal.

---

# 2. ОБЯЗАТЕЛЬНАЯ ГРАНИЦА STEP 2.3

Step 2.3 НЕ должен реализовывать:

- Step 2.3A Checkout / Commercial Intent Foundation;
- cart/checkout session;
- public checkout flow;
- service date/time authoritative checkout context;
- capacity reservation / availability locking;
- Step 2.3B Payment Terms Foundation;
- `FULL_PREPAYMENT / PARTIAL_PREPAYMENT / DEPOSIT / PAY_LATER / PAY_AT_SERVICE` как production payment-terms contract;
- Sale completion;
- `OrderRequested`;
- Order creation;
- Booking creation;
- Payment/PSP/refund;
- commission/settlement/payout;
- Finance ledger;
- Documents/PDF/email sending;
- Subscription/Billing;
- Sales Center frontend (owner — later UI step);
- analytics/revenue KPI;
- automatic Lead creation from behavioral events.

**Sale != Order. Quote != Checkout. Quote != Payment intent.**

---

# 3. BASELINE — ОБЯЗАТЕЛЬНО ПРОВЕРИТЬ ДО ИЗМЕНЕНИЙ

Подтверди фактический baseline Step 2.1/2.2:

- Sales bounded context владеет Lead/Opportunity/Quote/Sale;
- `QTE-*` генерируется canonical sequence;
- Quote foundation lifecycle сейчас минимален (`DRAFT → ISSUED` либо фактический эквивалент — сверить код);
- Sales Center lists/history/assignment/RBAC уже существуют;
- Sale close/complete отсутствует;
- Sales не пишет Order/Booking;
- `OrderRequested` отсутствует;
- money-полей Quote пока нет;
- Product принадлежит Catalog;
- Tariff принадлежит Catalog;
- cross-context access — read-by-ID, без FK/write;
- roles = presets, permissions/capabilities = authority; не вводить role-hardcoding в Sales.

Если baseline отличается — описать расхождение и адаптировать реализацию без нарушения roadmap.

---

# 4. OWNERSHIP

**Sales владеет коммерческим предложением Quote и его immutable commercial snapshot.**

Catalog остаётся owner текущих Product/Tariff данных.

Разрешено:

- Sales читает Product/Tariff по canonical ID;
- при формировании/редактировании DRAFT Quote Sales копирует необходимые коммерческие значения в собственный snapshot;
- после ISSUE Quote должен оставаться исторически воспроизводимым даже если Catalog Product/Tariff позже изменены.

Запрещено:

- Sales меняет Product/Tariff;
- FK между `sales.*` и `catalog.*`;
- Quote при чтении ISSUED динамически подмешивает текущую цену Catalog вместо snapshot;
- Catalog становится owner Quote.

---

# 5. QUOTE COMPOSITION MODEL

Определи минимальную модель состава Quote, достаточную для реального commercial offer.

Предпочтительная архитектура:

- `Quote` — header/aggregate;
- `QuoteItem` — одна или несколько строк предложения;
- `QuoteTraveler` или эквивалентный Sales-owned traveler context, если travelers действительно нужны для расчёта/предложения;
- history остаётся отдельной immutable chronology.

Не использовать giant JSON blob как единственный source of truth, если данные имеют самостоятельные invariants/query needs.

Если текущая архитектура проекта доказывает более простой безопасный вариант — допустимо, но решение объяснить.

---

# 6. PRODUCT / TARIFF SNAPSHOT

Для каждого Quote item snapshot должен быть **Sales-owned и исторически устойчивым**.

Минимально рассмотреть:

- `productId` canonical ref;
- `productCode`/public identifier, если существует и нужен для исторического display;
- product title/name snapshot;
- `tariffId` canonical ref;
- tariff name/title snapshot;
- pricing-relevant tariff attributes, реально существующие в Catalog;
- quantity / participant count, если применимо;
- unit price;
- line subtotal;
- currency.

Не выдумывать Catalog-поля, которых нет.

Перед schema design обязательно исследовать реальную Product/Tariff model и определить **какие поля влияют на коммерческое предложение сейчас**.

Snapshot должен фиксироваться/обновляться только в разрешённом DRAFT flow и замораживаться при ISSUE.

---

# 7. SNAPSHOT IMMUTABILITY PROOF

Обязательный e2e сценарий:

1. создать Product/Tariff;
2. создать DRAFT Quote из них;
3. ISSUE Quote;
4. изменить Catalog Product/Tariff допустимым production-путём либо подготовить новую версию согласно текущему lifecycle;
5. повторно прочитать Quote;
6. доказать, что issued Quote сохранил старые snapshot values и totals.

Нельзя считать current Catalog read историческим snapshot.

---

# 8. MONEY CONTRACT — STEP 2.3 LOCAL

Step 2.3 впервые вводит деньги в Sales Quote, поэтому определить строгий monetary representation.

Требования:

- Prisma/Postgres `Decimal`/`DECIMAL`, не Float/Double;
- никаких JS floating-point вычислений для authoritative totals;
- явная currency (ISO 4217 code; поддерживаемые значения должны следовать существующему platform contract, не придумывать список без основания);
- единая currency для Quote, если multi-currency Quote не обоснован Roadmap;
- deterministic rounding policy;
- non-negative amounts;
- authoritative total вычисляет backend;
- клиент не передаёт authoritative subtotal/total.

Если repository не содержит утверждённой rounding/precision semantics и выбор влияет на будущие Order/Payment contracts — **ARCHITECTURE DECISION REQUIRED**, а не произвольный выбор.

---

# 9. PRICE AUTHORITY

Для Step 2.3 internal Sales flow backend — authority Quote totals.

Нельзя принимать от клиента как trusted:

- subtotal;
- total;
- computed discount amount;
- final amount;
- snapshot product/tariff names;
- current Catalog price disguised as client field.

Client/API может передавать только разрешённые business inputs, например:

- product/tariff refs;
- quantity/count;
- допустимый discount request;
- customer/traveler context;
- validity input в разрешённых пределах.

Backend резолвит Catalog data и считает monetary result.

Это **не** означает реализацию Step 2.3A public Checkout price authority.

---

# 10. DISCOUNT MODEL

Реализовать только минимальную discount semantics, необходимую Roadmap 2.3.

Перед реализацией проверить существующие contracts/legacy.

Допустимая минимальная модель должна быть явной, например:

- no discount;
- percentage discount;
- fixed amount discount,

**только если обе формы действительно можно безопасно определить сейчас**.

Инварианты:

- discount не делает total отрицательным;
- percentage bounded;
- fixed discount currency совпадает с Quote;
- backend вычисляет effective discount;
- история сохраняет применённый результат;
- никаких promo/coupon/campaign engines;
- никаких partner commission rules.

Если типы скидок не определены canonical requirements и выбор создаёт долгосрочный contract — `ARCHITECTURE DECISION REQUIRED`.

---

# 11. TAX / FEES BOUNDARY

Не вводить tax engine, platform fee, commission, PSP fee, settlement fee или hidden markup без утверждённого owner/contract.

Если текущий Catalog Tariff уже содержит обязательный final sell price, snapshot его честно.

Не вычислять налоги «по стране» самостоятельно.

---

# 12. QUOTE VALIDITY

Step 2.3 должен иметь реальный срок действия коммерческого предложения.

Определи:

- `validUntil` либо эквивалентный canonical timestamp;
- server validation `validUntil > issuedAt/current time` при ISSUE;
- UTC instant;
- отсутствие fake expiration timestamp до фактического ISSUE, если semantics этого требует.

Не создавать scheduler/cron автоматического expiration, если Roadmap этого не требует.

Если нужен статус EXPIRED — сначала доказать, что он необходим canonical lifecycle. Не добавлять его только ради UI.

---

# 13. QUOTE LIFECYCLE

Сверить foundation lifecycle и минимально расширить только для Step 2.3.

Обязательно определить semantics:

- DRAFT — редактируемое предложение;
- ISSUED — зафиксированное коммерческое предложение.

После ISSUE:

- commercial snapshot immutable;
- direct item/price/discount/customer/traveler edits запрещены;
- повторный ISSUE должен быть idempotent либо deterministic conflict согласно существующей lifecycle convention;
- изменения должны идти через новый Quote/version/revision только если такой revision model реально требуется сейчас.

**Не вводить ACCEPTED/REJECTED/CONVERTED/PAID/ORDERED**, если их owner — будущие steps и нет утверждённой semantics.

---

# 14. ISSUE ATOMICITY

ISSUE Quote должен быть одной atomic transaction:

- validate DRAFT/version;
- validate composition;
- validate customer/travelers refs/context;
- validate Product/Tariff refs;
- finalize snapshot;
- calculate totals;
- set issued lifecycle timestamp/status;
- write QuoteHistory;
- write AuditLog через существующий contract.

Никакого состояния `ISSUED`, если snapshot/history не записались.

---

# 15. CUSTOMER CONTEXT

Quote может ссылаться только на canonical `crm.Customer.id`, если customer уже существует.

Не копировать CRM internals:

- notes;
- tags;
- manager data;
- audit;
- internal segmentation.

Если для коммерческого документа нужен display snapshot customer identity, определить минимально необходимый набор и privacy boundary.

Не превращать Quote в CRM Customer storage.

---

# 16. TRAVELERS CONTEXT

Roadmap явно включает travelers context.

Исследовать существующие OrderTraveler/BookingPassenger/Customer модели и определить **Sales-owned pre-order traveler context**, не объявляя legacy Order/Booking traveler canonical для Quote.

Требования:

- минимальные данные, реально необходимые offer composition/pricing;
- no passport/document data без доказанной необходимости;
- no payment data;
- no hidden PII expansion;
- travelers принадлежат Quote context до Order creation;
- Step 2.5 позже сам создаст OrderTraveler из canonical event/snapshot — сейчас Order не писать.

Если состав traveler PII невозможно определить без product decision — `ARCHITECTURE DECISION REQUIRED` для спорных полей, а не сбор «на всякий случай».

---

# 17. PRODUCT/TARIFF ELIGIBILITY

Нельзя формировать commercial Quote на произвольную/несуществующую Catalog сущность.

Проверить реальные lifecycle/status/channel contracts.

Определи server-side eligibility для internal Sales quote:

- Product существует;
- Tariff существует и принадлежит Product;
- lifecycle позволяет коммерческое предложение;
- архивные/недоступные сущности обрабатываются детерминированно.

Не путать Marketplace publication channel с внутренней Sales eligibility без основания.

Если правила неоднозначны — явно зафиксировать выбранный минимальный invariant или поднять architecture decision.

---

# 18. AVAILABILITY BOUNDARY

Step 2.3 **не резервирует capacity**.

Разрешено проверить только те availability constraints, которые безопасно являются read-only eligibility checks.

Запрещено:

- `slotsReserved++`;
- locking;
- hold;
- reservation token;
- decrement capacity;
- Booking creation.

Tariff/Availability reservation & locking остаётся prerequisite Step 2.3A/2.4.

---

# 19. QUOTE EDITING

Для DRAFT Quote предоставить минимальные команды/API для реального composition flow:

- add/update/remove item;
- set/change customer context;
- set/change travelers context;
- set discount/validity inputs, если они входят в утверждённую модель;
- preview/retrieve backend-calculated totals;
- issue.

Не делать generic unrestricted PATCH aggregate.

Каждая mutation:

- permission-gated;
- CAS/version-protected;
- forbidden server-owned fields;
- history/audit там, где это business-significant.

---

# 20. API CONTRACT

Сохранять существующий `/api/v1/sales/...` namespace.

Предпочитать action-oriented endpoints для lifecycle и bounded child resources.

Не создавать public checkout endpoints.

Не создавать endpoint, который принимает целиком trusted commercial snapshot от frontend.

Detail projection Quote после 2.3 должна отдавать commercial offer в whitelist форме, достаточной для будущего UI, но без internal Catalog/CRM/Audit fields.

---

# 21. RBAC / CAPABILITY MODEL

Соблюдать approved модель Step 2.2:

- roles = presets;
- permissions/capabilities = authority;
- backend guard authoritative;
- sidebar/UI позже permission-driven.

Не добавлять `if (actor.role === SALES_MANAGER)` для actor authorization.

Использовать/уточнить granular permissions только если нужно, например quote read/write/issue.

Если существующий `sales.quote.write` достаточно точно покрывает mutation/issue — не плодить permission без необходимости.

ANALYST/MARKETER aggregate-only contract не должен случайно получить raw Quote commercial data.

FINANCE текущий `sale.read` не должен автоматически получить Quote pricing, если `sales.quote.read` отсутствует.

---

# 22. OBJECT SCOPE / IDOR

Все refs серверно валидируются:

- quote code;
- opportunityId;
- customerId;
- productId;
- tariffId;
- assignee/actor refs, если участвуют.

Нельзя получить/изменить Quote через child ID без проверки принадлежности child к Quote.

Forged IDs не должны расширять permission scope.

---

# 23. DTO / MASS ASSIGNMENT

Запретить client-owned override минимум для:

- id/code;
- status;
- version;
- createdAt/updatedAt/issuedAt;
- createdById/actorId;
- calculated subtotal/discountAmount/total;
- snapshot names/attributes;
- correlationId/causationId/requestId;
- history/audit fields;
- future order/payment/booking IDs;
- acquisition/channel fields, если owner — 2.3A/2.5B.

Сохранять общий `GLOBAL_VALIDATION_PIPE_OPTIONS` без implicit conversion.

---

# 24. TEMPORAL SEMANTICS

Следовать Phase 1 temporal contract:

- `createdAt/updatedAt` = entity time;
- `issuedAt` = lifecycle time;
- history timestamps = transition facts;
- `updatedAt` не заменяет `issuedAt`;
- `validUntil` = commercial validity boundary;
- UTC ISO contract.

Не backfill fake timestamps.

---

# 25. HISTORY / AUDIT

QuoteHistory должен позволять восстановить business chronology.

Минимально проверить/добавить facts для:

- created;
- composition changed (не обязательно отдельная строка на каждый технический field, но business-significant changes должны быть восстановимы);
- customer/traveler context changed, если нужно;
- discount changed;
- issued.

AuditLog остаётся operational/security audit, не заменяет domain history.

Не писать PII/raw bodies в AuditLog.

---

# 26. EVENTS BOUNDARY

Step 2.3 не должен создавать события «на будущее» без consumer.

Не публиковать:

- `OrderRequested`;
- `OrderCreated`;
- Booking events;
- Payment events.

Если существует доказанный текущий consumer Quote event — исследовать. Иначе event не нужен.

Outbox reliability prerequisite остаётся обязательным до 2.4/2.5.

---

# 27. SALE BOUNDARY

Quote может быть связан с Sale foundation только в рамках уже существующих relations.

Step 2.3 не должен:

- закрывать Sale;
- означать Sale completion;
- создавать Order;
- публиковать OrderRequested.

Если текущий Sale создаётся из Quote вручную существующим foundation API — не превращать это в checkout/conversion flow без roadmap authority.

---

# 28. CHECKOUT 2.3A BOUNDARY

Особо доказать отсутствие premature 2.3A:

- нет authoritative checkout session/context entity;
- нет public cart;
- нет service date/time selection contract;
- нет options engine;
- нет capacity hold;
- нет acquisition/publication propagation implementation;
- frontend не стал source/authority цены;
- payment terms не внедрены как checkout contract.

Quote commercial pricing ≠ Checkout Context.

---

# 29. PAYMENT TERMS 2.3B BOUNDARY

Не внедрять enum/logic payment terms только потому, что следующий roadmap step известен.

Не добавлять:

- prepayment percentages;
- deposit rules;
- pay-at-service semantics;
- due schedule;
- payment state.

Это owner Step 2.3B.

---

# 30. CHANNEL / ACQUISITION BOUNDARY

Step 2.5B требует immutable sales/acquisition channel propagation.

Не угадывать channel/source постфактум и не вводить частичный неканонический contract сейчас.

Если Quote уже имеет существующий source field — проверить его semantics. Не расширять без roadmap/ADR необходимости.

---

# 31. COMMERCIAL SNAPSHOT VS ORDER SNAPSHOT

Не путать два уровня:

- Step 2.3: **Quote commercial snapshot** — что было предложено клиенту;
- Step 2.5: **Order commercial snapshot** — что было принято для исполнения и передано в Order.

Quote snapshot не даёт Sales права писать OrderItem.

Step 2.5 позже должен иметь возможность получить стабильные values из canonical flow.

---

# 32. DATA MODEL / MIGRATION

Любые schema changes:

- additive насколько возможно;
- без cross-schema FK;
- без destructive migration;
- без fake backfill;
- Decimal monetary columns;
- appropriate unique/indexes;
- nullable legacy/foundation columns только с честной semantics.

Applied migrations не редактировать.

`db push` не использовать.

---

# 33. INDEXES

Добавлять только индексы, подтверждённые query patterns.

Рассмотреть:

- QuoteItem.quoteId;
- productId/tariffId refs, если реально нужны queries;
- Quote status/validUntil, если используются operational reads;
- traveler quoteId.

Не создавать speculative index farm.

---

# 34. CONCURRENCY

Обязательно проверить:

- concurrent DRAFT mutations;
- concurrent ISSUE;
- ISSUE vs item edit race;
- remove/update same item race.

Использовать существующий CAS/version pattern.

Недопустимо: issued Quote с totals от одной версии и items от другой.

---

# 35. IDEMPOTENCY

Не изобретать глобальный HTTP Idempotency-Key раньше owner step.

Для lifecycle ISSUE использовать существующую deterministic idempotency/CAS convention.

Checkout/payment idempotency infrastructure остаётся future prerequisite.

---

# 36. PRIVACY

Quote detail не должен раскрывать:

- CRM notes/tags;
- auth/security fields;
- raw AuditLog;
- internal Product moderation fields;
- storage keys;
- payment data;
- unnecessary traveler PII.

PII минимизировать по purpose.

---

# 37. SECURITY

Проверить:

- anonymous → 401;
- unauthorized roles/capabilities → 403;
- forbidden server-owned fields → 422;
- malformed monetary values → 400/422 согласно contract;
- unknown refs → neutral/consistent 404/422 по repo convention;
- child IDOR;
- oversized text;
- injection-safe search/refs;
- no raw Prisma/stack in errors;
- requestId contract сохраняется.

---

# 38. UNIT TESTS

Добавить unit tests только для pure/domain invariants:

- Decimal/money normalization/calculation;
- rounding policy;
- discount validation/calculation;
- validity validation;
- quote composition validation;
- snapshot builder;
- lifecycle guards.

Не заменять e2e unit-тестами.

---

# 39. REQUIRED E2E COVERAGE

Создать отдельный Step 2.3 e2e spec.

Минимум проверить:

1. anonymous denied;
2. BUYER/PARTNER/MODERATOR denied;
3. SALES_MANAGER/authorized capability flow;
4. aggregate-only roles не видят raw Quote;
5. create DRAFT Quote composition;
6. Product/Tariff relationship validation;
7. multiple QuoteItems, если модель поддерживает;
8. backend-authoritative subtotal/total;
9. client forged totals rejected;
10. currency validation;
11. discount valid cases;
12. discount invalid/negative/overflow cases;
13. customer context;
14. travelers context + privacy;
15. issue Quote;
16. issuedAt/validUntil semantics;
17. issued snapshot immutable;
18. Catalog mutation after issue не меняет Quote snapshot;
19. DRAFT edit allowed;
20. ISSUED direct edit denied;
21. concurrent ISSUE → один lifecycle fact;
22. ISSUE vs edit race leaves consistent aggregate;
23. history chronology;
24. AuditLog minimal/no PII;
25. child IDOR protection;
26. forbidden keys;
27. no Order rows created;
28. no Booking rows created;
29. no `OrderRequested`/`OrderCreated` outbox;
30. Sale not completed/closed;
31. no Payment/Finance effects;
32. no capacity reservation/locking;
33. no checkout context/public checkout;
34. requestId/error envelope;
35. Step 2.1/2.2 regressions.

---

# 40. FULL REGRESSION

Обязательно:

## Backend

- `npx tsc --noEmit`;
- all unit;
- Step 2.1 foundation e2e;
- Step 2.2 Sales Center e2e;
- new Step 2.3 e2e;
- full serial e2e.

## Frontend

Даже если frontend не меняется:

- `npx tsc --noEmit`;
- `vitest run`;
- production `next build`.

## DB

- `prisma migrate status`;
- clean replay on fresh DB;
- drift check;
- no edited applied migrations.

Skipped/timeouts указать явно.

---

# 41. RUNTIME VERIFICATION

На isolated backend/test DB проверить representative flow:

1. auth/RBAC;
2. создать/получить Product+Tariff через допустимый setup;
3. создать Quote;
4. добавить composition/customer/travelers;
5. проверить backend totals;
6. issue;
7. изменить Catalog source после issue;
8. Quote snapshot остаётся прежним;
9. попытка edit issued → denied;
10. Order/Booking counts unchanged;
11. outbox без OrderRequested;
12. requestId/error envelope.

Smoke-data не оставлять в dev DB.

---

# 42. PERFORMANCE / QUERY SHAPE

Проверить:

- Quote detail не создаёт N+1 по items/travelers;
- list Step 2.2 не сломан новыми relations;
- history bounded;
- item mutations работают по scoped keys;
- никаких unbounded Catalog scans.

Не строить performance platform.

---

# 43. DOCUMENTATION

Создать/обновить canonical doc Step 2.3.

Документировать:

- Sales ownership Quote;
- Quote/QuoteItem/traveler model;
- snapshot semantics;
- price authority;
- monetary representation/rounding;
- discounts;
- currency;
- validity;
- lifecycle;
- customer/traveler privacy;
- Product/Tariff boundary;
- availability non-reservation boundary;
- RBAC/capability contract;
- history/audit;
- explicit non-goals 2.3A/2.3B/2.4+.

Не описывать future behavior как implemented.

---

# 44. ROADMAP / DEFERRED DECISIONS

Не менять Roadmap просто ради реализации Step 2.3.

Сохранять уже принятое:

- Step 3.12E Organization Capability & Navigation Access Model;
- DD-021 per-user capability admin UI deferred.

Если Step 2.3 обнаружит реально недостающую архитектурную decision — не прятать её в коде. Вывести:

`ARCHITECTURE DECISION REQUIRED`

с вариантами и последствиями.

---

# 45. REMAINING STEP 2.0 PREREQUISITES — ПОВТОРИТЬ В ОТЧЁТЕ

После Step 2.3 должны оставаться честно открытыми, если не являются локально необходимыми:

1. Outbox automated retry/recovery — обязательно до 2.4/2.5.
2. Booking currency/amount policy — до 2.8.
3. Monetary contract — **часть Quote-local contract может быть определена 2.3; authoritative checkout/order propagation всё ещё должна быть сверена до 2.3A/2.4**.
4. Tariff/Availability reservation & locking — до 2.3A/2.4.
5. Order commercial snapshot policy — до 2.5; Quote snapshot не закрывает Order snapshot автоматически.
6. `/orders/bootstrap` removal — 2.6.
7. Payment/PSP/ledger — 2.10C/2.12.
8. Supplier lifecycle/validation — 2.8.
9. Checkout/payment idempotency keys — 2.10 (если Roadmap не будет уточнён отдельным решением).

Не объявлять prerequisite закрытым только потому, что появился похожий механизм в Quote.

---

# 46. RELIABILITY SEQUENCING

Step 2.3 сам не создаёт critical async Order chain.

Но в финальном отчёте явно повторить:

- Step 2.4 `Sale Completion → OrderRequested` уже reliability-dependent;
- Step 2.5 consumer также reliability-dependent;
- автоматический Outbox retry/recovery должен быть решён **до или внутри 2.4/2.5**, несмотря на позднее положение общего hardening Step 2.17.

Не исправлять Outbox retry скрыто внутри 2.3.

---

# 47. DEFERRED DECISIONS COMPLIANCE

Не реализовывать без отдельного owner decision:

- multilingual commercial content / AI translation;
- trial/plans/subscription billing;
- recurring billing/grace/cancellation;
- custom domains;
- commission rates;
- Partner CRM entitlement model;
- retention engine;
- capability admin UI;
- tax engine;
- PSP/payment schedule;
- PDF/e-signature/email delivery flow.

---

# 48. FINDING / FIX POLICY DURING IMPLEMENTATION

Если найден локальный однозначный defect, мешающий Step 2.3:

- зафиксировать;
- исправить минимально;
- добавить regression proof.

Если проблема требует фундаментального выбора semantics (rounding, discount contract, traveler PII, revision model, eligibility и т.п.) и canonical sources не дают ответа:

**НЕ угадывать.**

Вернуть `ARCHITECTURE DECISION REQUIRED` с:

- problem;
- evidence;
- варианты;
- recommended option;
- impact on 2.3A/2.4/2.5.

---

# 49. FINAL IMPLEMENTATION REPORT FORMAT

Вернуть отчёт:

`# PHASE 2 — STEP 2.3 — QUOTE & COMMERCIAL OFFER FLOW — ОТЧЁТ`

Минимальные разделы:

1. Verdict
2. Repository baseline
3. Sources inspected
4. Current → Target
5. Roadmap scope verification
6. Sales/Quote ownership
7. Data model
8. Quote composition
9. Product snapshot
10. Tariff snapshot
11. Snapshot immutability
12. Money representation
13. Rounding
14. Currency
15. Price authority
16. Discount semantics
17. Tax/fee boundary
18. Validity
19. Lifecycle
20. Issue atomicity
21. Customer context
22. Travelers context
23. Product/Tariff eligibility
24. Availability boundary
25. Quote editing API
26. Detail projection
27. RBAC/capability model
28. Object scope/IDOR
29. DTO/mass-assignment
30. Temporal semantics
31. History
32. Audit
33. Events/outbox boundary
34. Sale boundary
35. Checkout 2.3A boundary
36. Payment Terms 2.3B boundary
37. Order/Booking/Finance isolation
38. Concurrency
39. Idempotency
40. Privacy/security
41. Migration/indexes
42. Unit results
43. E2E results
44. Full regression
45. Runtime verification
46. Performance/query shape
47. Documentation
48. Issues found/fixed
49. Remaining Step 2.0 prerequisites
50. Reliability sequencing
51. Deferred Decisions
52. Architecture decision status
53. Out-of-scope confirmation
54. Files changed

---

# 50. REQUIRED FINAL PROOFS

Отчёт обязан явно доказать:

- issued Quote = immutable historical commercial offer;
- Product/Tariff later mutation не меняет issued Quote;
- backend, а не client, authoritative для totals;
- Decimal/no JS-float authoritative money;
- discount bounded и deterministic;
- currency explicit;
- validity имеет честную temporal semantics;
- travelers context не раздувает PII;
- Sales не пишет Catalog;
- Sales не пишет Order/Booking;
- Sale не завершена;
- `OrderRequested` не создан;
- capacity не резервируется;
- Checkout 2.3A не начат;
- Payment Terms 2.3B не начат;
- Payment/Finance не начаты;
- permission-based access model Step 2.2 сохранён;
- migrations clean/replayable/no drift;
- full regression green.

---

# 51. STOP CONDITION

После implementation Step 2.3:

**НЕ начинать Step 2.3A.**

Не выполнять Strict Review в том же проходе.

Вернуть implementation report и ждать отдельного review prompt.

Финальная строка должна быть одной из:

`PHASE 2 STEP 2.3 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

или

`ARCHITECTURE DECISION REQUIRED`

или

`PHASE 2 STEP 2.3 IMPLEMENTATION BLOCKED — <reason>`
