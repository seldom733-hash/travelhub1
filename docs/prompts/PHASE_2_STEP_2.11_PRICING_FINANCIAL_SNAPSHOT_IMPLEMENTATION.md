# PHASE 2 — STEP 2.11 — PRICING & FINANCIAL SNAPSHOT — IMPLEMENTATION PROMPT

## 0. ROLE

Ты работаешь как **Senior/Staff Backend Engineer + Domain Architect + Adversarial Reviewer** в существующем проекте **TravelHub**.

Твоя задача — реализовать **PHASE 2 — STEP 2.11 — PRICING & FINANCIAL SNAPSHOT** строго поверх фактического состояния репозитория после утверждённых Steps 2.10 / 2.10A / 2.10B / 2.10C.

Это **implementation pass**, а не Strict Review.

Не доверяй старым отчётам как источнику истины. Перед изменениями проверь фактический код, Prisma schema, миграции, тесты, Roadmap и contracts.

---

# 1. REQUIRED FINAL VERDICT

В конце прохода разрешён только один из verdict:

`PHASE 2 STEP 2.11 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

или, если необходимое решение нельзя безопасно вывести из approved contracts:

`PHASE 2 STEP 2.11 BLOCKED — ARCHITECTURE DECISION REQUIRED`

Strict Review 2.11 **не выполнять** в этом проходе.

---

# 2. APPROVED BASELINE — НЕ ЛОМАТЬ

Перед началом подтвердить фактическим кодом baseline.

На момент передачи ожидается:

- Step 2.10 — Finance Domain Foundation — APPROVED;
- Step 2.10A — Ledger Transaction Foundation — APPROVED WITH REVIEW FIXES;
- Step 2.10B — Provider Fee / Settlement / Payout Foundation — APPROVED WITH REVIEW FIXES;
- Step 2.10C — Finance Temporal Contract — APPROVED WITH REVIEW FIXES;
- backend regression baseline: **498/498 unit**;
- serial e2e baseline: **1059/1059**, 59 suites;
- frontend Vitest baseline: **135/135**;
- migrations: **50/50**, drift 0.

Если repository state отличается — зафиксировать реальный baseline и объяснить отличие. Не подгонять отчёт под ожидаемые числа.

Особенно сохранить:

- Decimal money authority;
- append-only LedgerTransaction;
- `LedgerTransaction.occurredAt` strict ISO temporal contract;
- first-write-wins replay semantics;
- ProviderFee ≠ TravelHub Commission;
- Settlement ≠ Payout;
- Payment ≠ Payout;
- отсутствие преждевременных Payment/Refund/Settlement/Payout lifecycle milestones;
- отсутствие ledger auto-posting без отдельного canonical producer contract;
- отсутствие cross-domain writes;
- existing Order / Booking frozen money facts;
- acquisition provenance;
- transactional outbox/inbox/idempotency conventions;
- RBAC/PII/AuditLog conventions.

---

# 3. OBJECTIVE

Step 2.11 должен создать **канонический pricing / financial snapshot contract**, который позволяет downstream-доменам хранить исторически достоверную денежную картину сделки без повторного вычисления её из текущих Product, Tax, FX или Finance master-data.

Ключевой принцип:

> **Historical transaction money MUST be explainable from immutable/frozen snapshots and MUST NOT depend on current mutable catalog/finance configuration.**

После фиксации snapshot изменение:

- Product price;
- Currency master-data;
- ExchangeRate;
- Tax;
- TaxRule;
- будущих commission settings;
- иных pricing master-data

не должно ретроспективно менять уже зафиксированную стоимость коммерческой операции.

---

# 4. FIRST TASK — REPOSITORY RECONCILIATION

До написания production-кода провести repo-wide аудит.

Обязательно изучить:

1. `backend/prisma/schema.prisma`;
2. все существующие monetary поля в:
   - Product / Offer / Variant или эквивалентах;
   - Lead / Opportunity / Quote;
   - CheckoutIntent;
   - Sale;
   - Order / OrderItem;
   - Booking;
   - Reverse marketplace;
   - Payment schema-only foundation;
   - finance.Currency;
   - ExchangeRate;
   - Tax / TaxRule;
   - LedgerTransaction;
   - ProviderFee / Settlement / Payout;
3. существующие pricing/calculation helpers;
4. `decimal.js` usage;
5. rounding rules;
6. currency validation;
7. Quote → CheckoutIntent → Sale → Order propagation;
8. Reverse → commercial flow;
9. current frozen money tests;
10. `docs/contracts/api.md`;
11. `docs/contracts/events.md`;
12. `docs/contracts/ids.md`;
13. architecture docs Steps 2.10–2.10C;
14. canonical Roadmap Step 2.11 and following Steps 2.12+;
15. Screen Design / architecture source, если он присутствует в repository.

В implementation report перечислить реальные inspected sources.

---

# 5. CURRENT → TARGET MATRIX

До реализации составить таблицу:

| Concern | Current authority | Current storage | Mutable? | Snapshot exists? | Target 2.11 |
|---|---|---|---|---|---|

Минимум для:

- unit/base price;
- quantity;
- subtotal;
- discount;
- tax;
- gross/total;
- transaction currency;
- FX rate;
- FX source/base/quote currency;
- tax rule/rate provenance;
- rounding;
- commission;
- provider fee;
- settlement;
- payout.

Не придумывать отсутствующую семантику.

---

# 6. HARD ARCHITECTURAL RULE — SNAPSHOT ≠ MASTER DATA

`finance.Currency`, `ExchangeRate`, `Tax`, `TaxRule` — master/reference data.

Financial snapshot — исторический факт конкретной коммерческой операции.

Snapshot НЕ должен зависеть от live JOIN к mutable master-data для восстановления исторической суммы.

Если snapshot ссылается на master-data ID, необходимые для исторической интерпретации значения всё равно должны быть frozen в snapshot.

Например, одного `exchangeRateId` недостаточно, если сам ExchangeRate может быть изменён/деактивирован.

---

# 7. DETERMINE THE CORRECT SNAPSHOT OWNER

Это hard gate.

Нельзя автоматически создать `finance.PricingSnapshot`, только потому что Step называется Financial Snapshot.

Сначала определить фактический lifecycle:

`Catalog → Quote → CheckoutIntent → Sale → Order → Booking`

и Reverse flow.

Нужно установить:

- где цена вычисляется;
- где buyer фактически принимает/фиксирует цену;
- где уже существует immutable/frozen money contract;
- какой объект является canonical transaction snapshot authority;
- какие downstream сущности должны **копировать verbatim**, а не пересчитывать.

Предпочитать минимальную архитектуру и существующий owner.

Если repository/approved docs не позволяют однозначно определить owner без изменения бизнес-семантики — STOP:

`ARCHITECTURE DECISION REQUIRED`

---

# 8. NO UNIVERSAL MONEY GOD-OBJECT

Запрещено без доказанной необходимости создавать универсальную сущность, которая одновременно становится authority для:

- pricing;
- payment;
- tax;
- commission;
- ledger;
- settlement;
- payout.

Step 2.11 — snapshot contract, не новый финансовый монолит.

---

# 9. CANONICAL MONEY COMPONENTS

На основании фактической модели определить минимальный canonical snapshot vocabulary.

Проверить необходимость следующих компонентов:

- `unitPrice`;
- `quantity`;
- `subtotal`;
- `discountAmount`;
- `taxAmount`;
- `totalAmount`;
- `currency`.

Не добавлять поле только ради полноты.

Если существующий контракт уже использует другой vocabulary (`amount`, `total`, `price`, etc.) — не проводить destructive rename. Сначала reconcile.

---

# 10. DECIMAL CONTRACT — HARD GATE

Все денежные вычисления:

- только Decimal;
- никакого JS `number` как monetary authority;
- никакого `parseFloat`/`Number(...)` для вычисления денег;
- никакого binary float intermediate state;
- API money values — canonical decimal strings согласно существующей convention.

Проверить DB precision.

Любое новое денежное поле должно иметь явно обоснованные precision/scale и overflow guards.

---

# 11. ROUNDING CONTRACT

Найти существующий approved rounding contract.

Если проект уже использует `ROUND_HALF_UP`, Step 2.11 обязан использовать ту же authority, если нет явно утверждённого исключения.

Определить:

- на каком этапе округляется unit price;
- subtotal;
- discount;
- tax;
- FX conversion;
- final total.

Запрещено получить разные суммы из-за разного порядка rounding в разных доменах.

Нужны unit tests на boundary values.

---

# 12. SNAPSHOT IMMUTABILITY

После создания canonical snapshot его monetary facts нельзя молча изменять вслед за master-data.

Hard requirements:

- no repricing from current Product;
- no re-tax from current TaxRule;
- no re-FX from current ExchangeRate;
- no mutation during Booking lifecycle;
- no mutation during future Payment lifecycle;
- no mutation because Currency/Tax/FX master data changed.

Если существующая сущность mutable до определённого lifecycle boundary, точно определить момент freeze.

---

# 13. QUOTE / CHECKOUT / SALE / ORDER PROPAGATION

Проверить полный путь.

Для каждого перехода ответить:

1. пересчитывается ли цена;
2. копируется ли snapshot;
3. кто имеет право изменить цену;
4. после какого события/command цена frozen;
5. что происходит при replay.

После freeze downstream consumer должен получать money facts **verbatim**, если approved contract не требует иного.

Особенно проверить:

`CheckoutIntent → Sale → OrderRequested → Order → BookingRequested → Booking`

и Reverse flow.

---

# 14. PRODUCT PRICE CHANGE TEST

Обязательный adversarial scenario:

1. создать коммерческий объект с ценой X;
2. зафиксировать canonical snapshot;
3. изменить Product/current price на Y;
4. продолжить lifecycle;
5. downstream Sale/Order/Booking должны сохранить X согласно frozen contract.

Никакого скрытого repricing.

---

# 15. TAX SNAPSHOT

Сначала определить, реально ли tax участвует в текущем production pricing flow.

Если ДА:

snapshot должен сохранять достаточно данных, чтобы объяснить исторический налог без обращения к текущему Tax/TaxRule.

Рассмотреть:

- tax amount;
- applied rate;
- jurisdiction/country, если это уже canonical input;
- tax rule/code provenance, если это уже существует;
- inclusive/exclusive semantics — только если уже определены.

Если tax calculation producer ещё не существует — **не изобретать налоговый движок**.

В этом случае зафиксировать boundary/deferred contract.

---

# 16. FX SNAPSHOT

Сначала доказать наличие реальной FX-конверсии в production flow.

Если FX producer существует:

нельзя сохранять только resulting amount.

Нужно сохранить минимально достаточную frozen provenance:

- source/base currency;
- target/quote currency;
- applied rate;
- converted amount;
- rate source/reference, если это уже authoritative;
- occurrence/effective time, если это уже определено контрактом.

Если FX conversion ещё не используется — не внедрять FX engine в Step 2.11.

Зафиксировать deferred boundary.

---

# 17. DISCOUNT SNAPSHOT

Не создавать promotion/coupon engine.

Если discount уже существует — определить frozen representation.

Если нет — оставить deferred.

Запрещено вводить новые discount semantics только для заполнения snapshot.

---

# 18. COMMISSION BOUNDARY

TravelHub Commission не равна:

- ProviderFee;
- Tax;
- Discount;
- Settlement;
- Payout.

Commission semantics уже deferred в последующие шаги.

Step 2.11 не должен:

- вычислять commission без approved contract;
- создавать CommissionAccrual;
- автоматически писать ledger;
- уменьшать payout;
- создавать settlement.

Можно только зарезервировать документированный extension boundary, если это необходимо.

---

# 19. PROVIDER FEE / SETTLEMENT / PAYOUT BOUNDARY

Step 2.10B immutable facts не должны использоваться как источник pricing.

Не создавать их из pricing snapshot.

Не связывать автоматически:

`PricingSnapshot → ProviderFee`
`PricingSnapshot → Settlement`
`PricingSnapshot → Payout`

без отдельного producer contract.

---

# 20. LEDGER BOUNDARY

Step 2.11 НЕ должен автоматически создавать `LedgerTransaction`.

Ledger остаётся отдельным immutable financial fact foundation.

Никакого:

- ledger auto-posting;
- double-entry;
- balances;
- reversal engine;
- account chart.

Если snapshot creation неожиданно требует ledger posting — STOP / architecture decision.

---

# 21. PAYMENT BOUNDARY

Payment runtime всё ещё относится к последующим шагам.

Не реализовывать:

- authorize;
- capture;
- paid;
- failed;
- PSP integration;
- payment milestones;
- payment → ledger posting.

Step 2.11 должен только обеспечить будущему Payment возможность ссылаться на frozen commercial amount без повторного pricing.

---

# 22. BOOKING BOUNDARY

Booking уже имеет frozen monetary facts.

Проверить, что 2.11:

- не меняет Booking lifecycle;
- не reprices Booking;
- не добавляет availability hold/release;
- не меняет service occurrence;
- не меняет acquisitionSource;
- не меняет Booking temporal milestones.

Если существующий Booking money snapshot достаточен — сохранить совместимость.

---

# 23. ORDER BOUNDARY

Order/OrderItem — критический downstream consumer frozen pricing.

Проверить:

- one item amount vs aggregate;
- quantity semantics;
- total consistency;
- multi-item order;
- partial lifecycle transitions;
- cancellation не меняет historical pricing.

Никакого вычисления исторического total из текущего Product.

---

# 24. REVERSE MARKETPLACE

Buyer Request / Offer / Quote-like Reverse flow должен пройти тот же audit.

Нельзя допустить:

- Direct flow использует frozen snapshot;
- Reverse flow пересчитывает live price.

Если Reverse использует уже утверждённый acquisition path `BUYER_REQUEST`, snapshot должен сохраняться независимо от acquisitionSource.

---

# 25. SNAPSHOT CONSISTENCY INVARIANTS

Если vocabulary применим, установить и протестировать deterministic invariants.

Примеры:

`subtotal = unitPrice × quantity`

`total = subtotal - discount + tax`

Но только если именно эта формула соответствует фактической модели.

Не навязывать формулу, если current domain semantics сложнее или не определены.

Невалидный snapshot должен отклоняться controlled 4xx/domain error, а не сохраняться.

---

# 26. SERVER AUTHORITY / MASS ASSIGNMENT

Клиент не должен иметь возможность подделать server-owned frozen monetary facts после freeze.

Repo-wide проверить:

- PATCH;
- command endpoints;
- nested DTO;
- raw body;
- spread operators;
- Prisma create/update data.

Forged server-owned snapshot fields должны давать явный controlled error согласно текущей convention, предпочтительно 422, а не silent-strip.

---

# 27. RBAC

Не вводить новые permissions без необходимости.

Использовать существующие права owner-domain.

Проверить:

- anonymous;
- buyer;
- partner;
- sales;
- operator;
- finance;
- admin;
- прочие роли согласно реальной матрице.

Finance-read permission не должно автоматически давать право менять коммерческую цену.

---

# 28. IDOR

Если snapshot доступен через API:

- не-owner не должен получать его через guessable ID;
- unknown/not-owned должен соответствовать существующей neutral 404 convention;
- Finance/Admin visibility — только если это уже следует из approved RBAC.

Не расширять read surface без необходимости.

---

# 29. IDEMPOTENCY

Если snapshot создаётся consumer/event flow:

- replay не создаёт второй snapshot;
- divergent replay не должен молча принять другую сумму;
- known unique invariant обрабатывается точечно;
- unknown P2002 не превращается в no-op;
- raw 500 на ожидаемом duplicate path запрещён.

Следовать lessons Step 2.10A review fix: **identical replay = no-op; divergent payload = controlled conflict**.

---

# 30. CONCURRENCY

Обязательные adversarial race tests, где применимо:

- same snapshot / same payload concurrently;
- same idempotency key / divergent amount;
- Product price update vs snapshot freeze;
- Tax/FX master-data update vs frozen transaction;
- duplicate event delivery.

Результат должен быть deterministic.

---

# 31. TRANSACTION ATOMICITY

Если snapshot создаётся вместе с Sale/Order/etc.:

snapshot + owning aggregate transition + outbox/history должны быть атомарны согласно текущему architecture pattern.

Не допускается:

- Sale создан, snapshot нет;
- Order создан с новой ценой после snapshot;
- event emitted до durable snapshot.

Нужен rollback test.

---

# 32. EVENTS

Не создавать новые business events только потому, что появился snapshot.

Сначала проверить, нужен ли downstream consumer.

Если существующие события уже несут frozen money facts — сохранить compatibility.

Если event payload требует расширения:

- additive only;
- consumer validation;
- replay compatibility;
- PII-free;
- correlation/causation preserved.

Breaking event-contract change запрещён.

---

# 33. PII

Pricing snapshot не должен становиться контейнером buyer/partner PII.

Не хранить:

- passport;
- DOB;
- phone;
- email;
- bank details;
- card data;
- PSP credentials.

Financial provenance ≠ personal data dump.

---

# 34. AUDIT LOG

Если Step 2.11 создаёт новый user-triggered mutation:

AuditLog должен соответствовать существующей convention.

Audit payload минимальный, без PII и без секретов.

Не дублировать immutable snapshot целиком в AuditLog.

---

# 35. MIGRATION POLICY

Если schema change необходим:

- migration additive;
- никакого `db push`;
- никаких destructive ALTER без ADR;
- legacy rows должны оставаться честными;
- не fabricating historical snapshot/backfill из текущих mutable Product/Tax/FX данных.

**Особенно запрещён ложный backfill.**

Если старую историческую цену невозможно доказать — NULL/legacy semantics предпочтительнее выдуманного значения.

---

# 36. LEGACY COMPATIBILITY

Существующие Sale/Order/Booking должны продолжать читаться.

Нельзя требовать новый snapshot от legacy rows, если его исторически не существовало.

Определить:

- nullable migration;
- read fallback — только если fallback исторически безопасен;
- write behavior для новых объектов.

Нельзя использовать current Product price как «fallback historical truth».

---

# 37. NO PREMATURE TEMPORAL FIELDS

Step 2.10C уже установил Finance temporal boundary.

Не добавлять:

- paidAt;
- authorizedAt;
- capturedAt;
- refundedAt;
- settledAt;
- payoutAt;

без producer semantics.

Если snapshot имеет собственный `createdAt`, это persistence timestamp, не Payment milestone.

---

# 38. REQUIRED NEGATIVE TESTS

Минимально доказать, где применимо:

1. anonymous mutation → 401;
2. forbidden role → 403;
3. unknown/not-owned → neutral 404;
4. forged frozen monetary field → 422;
5. malformed decimal → 422/400 согласно convention;
6. zero/negative amount where invalid → reject;
7. precision overflow → reject;
8. excessive decimal scale → reject;
9. unsupported currency → reject;
10. inconsistent subtotal/total → reject, если formula canonical;
11. duplicate identical replay → no duplicate;
12. divergent replay → controlled conflict;
13. unknown P2002 → controlled conflict/rethrow policy, не false no-op;
14. Product price change after freeze → no repricing;
15. Tax master-data change → no historical mutation;
16. FX master-data change → no historical mutation;
17. Booking lifecycle → no money mutation;
18. cancellation → no historical money rewrite;
19. no ledger auto-post;
20. no ProviderFee/Settlement/Payout auto-create;
21. no Payment runtime side effect;
22. no PII leakage;
23. failed transaction → no partial snapshot/outbox/history;
24. legacy row without new snapshot remains readable.

Если какой-то пункт неприменим — объяснить конкретно почему и чем boundary доказан.

---

# 39. REQUIRED POSITIVE TESTS

Минимально:

1. canonical commercial flow фиксирует правильный snapshot;
2. decimal serialization остаётся string-based;
3. rounding deterministic;
4. Direct acquisition сохраняет snapshot;
5. Buyer Request / Reverse flow сохраняет тот же monetary contract;
6. Sale → Order money propagation verbatim;
7. Order → Booking propagation verbatim;
8. multi-item order сохраняет независимые item snapshots;
9. replay сохраняет first-write-wins;
10. изменение Product после freeze не влияет;
11. legacy records читаются;
12. correlation/causation сохраняются, если snapshot создаётся event consumer;
13. AuditLog минимален, если applicable.

---

# 40. WRITE-PATH AUDIT — HARD GATE

После реализации выполнить repo-wide поиск всех writer-ов новых snapshot/monetary полей.

Классифицировать каждый:

1. canonical owner writer;
2. approved consumer propagation;
3. migration/seed;
4. test-only;
5. unsafe/obsolete.

Категория 5 должна быть **0**.

Отдельно искать:

- `.create`;
- `.update`;
- `.updateMany`;
- `.upsert`;
- raw SQL;
- object spreads;
- DTO mass assignment;
- jobs/consumers.

---

# 41. REPRICE AUDIT — HARD GATE

Repo-wide найти места, где downstream entities получают цену.

Для каждого доказать, что после freeze нет:

- lookup текущего Product price;
- повторного tax calculation;
- повторного FX conversion;
- rounding другим алгоритмом.

Если найден скрытый reprice path — Step 2.11 не может быть завершён до исправления или архитектурного STOP.

---

# 42. FINANCE BOUNDARY AUDIT

После реализации доказать counts/absence side effects:

- LedgerTransaction;
- ProviderFee;
- Settlement;
- Payout;
- Payment;
- Refund;
- Invoice;
- Commission/CommissionAccrual.

Создание pricing snapshot само по себе не должно создавать эти факты.

---

# 43. UNIT TESTS

Добавить focused unit coverage минимум для:

- Decimal validation;
- scale/precision;
- rounding;
- snapshot consistency;
- currency validation;
- replay payload comparison;
- any new pure pricing helper.

Не дублировать бессмысленно e2e.

---

# 44. E2E TEST SUITE

Создать отдельный Step 2.11 e2e spec с понятным названием, например:

`pricing-financial-snapshot.e2e-spec.ts`

Тесты должны быть adversarial, а не только happy-path.

Каждый обязательный requirement §§38–39 должен иметь traceability к конкретному test number либо обоснованное N/A.

---

# 45. FULL BACKEND REGRESSION

После targeted tests выполнить:

- backend typecheck;
- backend build;
- все unit tests;
- полный serial e2e suite.

Не принимать только targeted green как завершение.

Зафиксировать реальные totals.

---

# 46. FRONTEND REGRESSION

Даже если frontend не менялся:

- frontend typecheck;
- Vitest;
- production build.

Зафиксировать реальные результаты.

---

# 47. DB REGRESSION

Если есть миграция:

- `prisma migrate status`;
- fresh migration replay;
- drift check;
- никакого `db push`.

Если миграции нет — явно написать `Migration: N/A` и почему.

---

# 48. DOCUMENTATION

Обновить минимум:

- canonical Roadmap;
- `docs/contracts/api.md`, если API contract меняется;
- `docs/contracts/events.md`, если event payload additive меняется;
- architecture artifact Step 2.11;
- IDs contract, только если реально появляется новый public/domain ID prefix.

Не регистрировать ID «на будущее».

---

# 49. REQUIRED ARCHITECTURE DOCUMENT

Создать:

`docs/architecture/pricing-financial-snapshot.md`

Минимальные секции:

1. Purpose;
2. Scope;
3. Ownership;
4. Current → target reconciliation;
5. Canonical monetary vocabulary;
6. Freeze boundary;
7. Decimal contract;
8. Rounding;
9. Currency;
10. Tax boundary;
11. FX boundary;
12. Discount boundary;
13. Commission boundary;
14. Quote/Checkout/Sale propagation;
15. Order/OrderItem propagation;
16. Booking propagation;
17. Reverse marketplace;
18. Immutability;
19. Idempotency;
20. Concurrency;
21. Atomicity;
22. Events;
23. RBAC / IDOR / mass assignment;
24. Legacy compatibility;
25. Finance boundaries;
26. Deferred items.

---

# 50. ARCHITECTURE DECISION STOP CONDITIONS

Немедленно STOP и выдать:

`PHASE 2 STEP 2.11 BLOCKED — ARCHITECTURE DECISION REQUIRED`

если для реализации необходимо самостоятельно решить хотя бы одно из следующего, а approved repository contracts ответа не дают:

1. кто является canonical owner pricing snapshot;
2. inclusive vs exclusive tax semantics;
3. FX source/rate selection algorithm;
4. discount/promotion precedence;
5. TravelHub commission formula;
6. supplier net vs buyer gross accounting;
7. ledger posting semantics;
8. Payment authorization/capture semantics;
9. settlement allocation;
10. payout calculation;
11. destructive migration historical money;
12. retroactive repricing;
13. cross-domain FK ownership;
14. изменение approved Order/Booking frozen-money semantics.

Не маскировать архитектурную неопределённость «разумным предположением».

---

# 51. OUT OF SCOPE

Не реализовывать в 2.11:

- Payment PSP runtime;
- Refund engine;
- Invoice engine;
- commission accrual;
- provider integration;
- ledger posting;
- double-entry;
- account balances;
- settlement lifecycle;
- payout lifecycle;
- finance milestones;
- availability release;
- reschedule/reprice engine;
- frontend Finance Center redesign;
- notification engine.

---

# 52. REQUIRED IMPLEMENTATION REPORT

Создать отдельный report:

`docs/prompts/PHASE_2_STEP_2.11_PRICING_FINANCIAL_SNAPSHOT_IMPLEMENTATION_REPORT.md`

Отчёт должен содержать минимум:

1. Verdict;
2. Repository baseline;
3. Sources inspected;
4. Current → Target reconciliation;
5. Snapshot owner decision;
6. Freeze boundary;
7. Schema/migration;
8. Monetary vocabulary;
9. Decimal/precision;
10. Rounding;
11. Currency;
12. Tax;
13. FX;
14. Discount;
15. Direct flow;
16. Reverse flow;
17. Sale → Order propagation;
18. Order → Booking propagation;
19. Immutability;
20. Product-change adversarial proof;
21. Tax/FX-change proof;
22. Idempotency;
23. divergent replay;
24. concurrency;
25. atomicity;
26. write-path audit;
27. reprice audit;
28. RBAC;
29. IDOR;
30. mass assignment;
31. PII;
32. AuditLog;
33. Events;
34. Ledger boundary;
35. ProviderFee/Settlement/Payout boundary;
36. Payment/Refund/Invoice/Commission boundary;
37. Legacy compatibility;
38. Negative test coverage matrix;
39. Positive test coverage matrix;
40. Unit results;
41. Targeted e2e results;
42. Full serial e2e results;
43. Frontend regression;
44. DB regression;
45. Issues found;
46. Fixes applied;
47. Exact files changed;
48. Architecture decision status;
49. Deferred/out-of-scope;
50. Roadmap update;
51. Exact NEXT item.

---

# 53. ROADMAP UPDATE

Только после полной зелёной регрессии изменить Step 2.11 на:

`IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

и установить NEXT:

`PHASE 2 — STEP 2.11 — STRICT REVIEW`

Не отмечать APPROVED в implementation pass.

---

# 54. HARD STOP

После:

- implementation;
- migrations;
- tests;
- docs;
- implementation report;
- Roadmap update

**остановиться**.

Не выполнять Strict Review 2.11.

Не начинать Step 2.12.

Финальная строка:

`PHASE 2 STEP 2.11 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`
