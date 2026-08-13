# PHASE 2 --- STEP 2.10A --- LEDGER TRANSACTION FOUNDATION --- IMPLEMENTATION PROMPT

## ROLE

Выполни **PHASE 2 --- STEP 2.10A --- LEDGER TRANSACTION FOUNDATION**
проекта TravelHub как отдельный implementation-pass.

Это следующий канонический шаг после:

-   Step 2.10 --- Finance Domain Foundation --- **STRICT REVIEW APPROVED
    WITH REVIEW FIXES**;
-   Finance master-data foundation уже существует;
-   Step 2.10B / 2.10C / 2.12+ **не начинать**.

Цель этого прохода --- создать минимальный, корректный и расширяемый
**immutable financial ledger foundation**, не превращая его
преждевременно в Payment/PSP/Refund/Settlement/Payout/Commission engine.

------------------------------------------------------------------------

# 1. STARTING VERDICT

В начале работы зафиксировать:

`PHASE 2 STEP 2.10A IMPLEMENTATION STARTED`

В конце допустимы только:

`PHASE 2 STEP 2.10A IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

или

`PHASE 2 STEP 2.10A IMPLEMENTATION BLOCKED — ARCHITECTURE DECISION REQUIRED`

Strict Review 2.10A в этом проходе **НЕ выполнять**.

------------------------------------------------------------------------

# 2. REPOSITORY BASELINE --- ОБЯЗАТЕЛЬНО

До изменения кода:

1.  зафиксировать branch;
2.  HEAD;
3.  version/tag;
4.  состояние origin;
5.  dirty/untracked;
6.  migrations count/status;
7.  schema drift;
8.  фактический Roadmap status;
9.  подтвердить Step 2.10 = APPROVED;
10. подтвердить Step 2.10A = NEXT;
11. доказать, что 2.10B/2.10C/2.12+ ещё не реализованы.

Не начинать реализацию, пока baseline не зафиксирован.

------------------------------------------------------------------------

# 3. SOURCES TO INSPECT

Перед проектированием обязательно изучить фактические источники:

-   `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`;
-   Step 2.10 implementation/review artifacts;
-   Screen Design Brief --- Finance Center;
-   RBAC Matrix;
-   Finance architecture/contracts;
-   relevant ADR;
-   `docs/contracts/api.md`;
-   `docs/contracts/events.md`;
-   `docs/contracts/ids.md`;
-   `backend/prisma/schema.prisma`;
-   Step 2.10 migration;
-   `backend/src/modules/finance/**`;
-   `ids.service.ts`;
-   request context / actor / correlation infrastructure;
-   EventBus / Outbox / Inbox;
-   AuditLog;
-   Decimal helpers;
-   Prisma unique-error helpers;
-   Order / Booking / Sale / Checkout money fields;
-   existing schema-only Payment / PaymentTerms / Refund / Invoice /
    Commission / CommissionAccrual;
-   e2e DB reset/migration harness.

Repository-wide search минимум:

`Ledger` `LedgerTransaction` `LTX-` `debit` `credit` `balance` `posting`
`journal` `Payment` `Refund` `Settlement` `Payout` `ProviderFee`
`Commission` `paidAmount` `paymentStatus` `paidAt` `authorizedAt`
`capturedAt`

Не предполагать отсутствие реализации без grep/code audit.

------------------------------------------------------------------------

# 4. CURRENT → TARGET RECONCILIATION

До написания кода составить таблицу:

  Area   Current   Target 2.10A   Deferred
  ------ --------- -------------- ----------

Минимум:

-   LedgerTransaction;
-   ledger ownership;
-   transaction direction/type;
-   amount/currency;
-   business reference;
-   source event/reference;
-   immutability;
-   idempotency;
-   correlation/causation;
-   audit;
-   Payment;
-   Refund;
-   Commission;
-   Settlement/Payout;
-   temporal milestones;
-   balances.

Отдельно перечислить, какие financial entities остаются **schema-only**.

------------------------------------------------------------------------

# 5. CORE ARCHITECTURAL PRINCIPLE --- HARD GATE

Ledger --- это **immutable record of financial facts**, а не mutable
operational object.

После создания canonical ledger transaction:

-   amount нельзя изменить;
-   currency нельзя изменить;
-   direction/type нельзя изменить;
-   business reference нельзя заменить;
-   source/provenance нельзя переписать;
-   actor/correlation/causation нельзя подделать;
-   запись нельзя hard-delete;
-   финансовый факт нельзя «исправить PATCH-ом».

Исправление финансового факта в будущем должно выполняться новым
compensating/reversal transaction, если такая семантика будет утверждена
отдельным шагом.

Если текущий Roadmap не определяет reversal semantics --- **не
выдумывать reversal workflow в 2.10A**.

------------------------------------------------------------------------

# 6. LEDGER OWNERSHIP --- HARD GATE

Единственный owner ledger-записей --- Finance domain.

Запрещено:

-   Order напрямую создаёт LedgerTransaction;
-   Booking напрямую создаёт LedgerTransaction;
-   Sales напрямую пишет finance ledger tables;
-   Availability пишет ledger;
-   Catalog пишет ledger;
-   Finance напрямую изменяет Order/Booking/Sale/Availability.

Cross-domain interaction в будущем --- только через canonical
facts/events/contracts.

Если корректная реализация требует cross-domain direct write:

`ARCHITECTURE DECISION REQUIRED`.

------------------------------------------------------------------------

# 7. LEDGER MODEL --- MINIMAL FOUNDATION

Нужно реализовать минимальную модель `LedgerTransaction` только в
объёме, подтверждаемом Roadmap/approved architecture.

Перед миграцией определить и задокументировать каждое поле.

Ожидаемый минимальный смысл:

-   canonical id;
-   business code `LTX-########`;
-   immutable amount;
-   immutable currency;
-   transaction classification/type;
-   direction, если она действительно требуется каноническим контрактом;
-   source/reference metadata;
-   optional aggregate/business reference;
-   correlation;
-   causation;
-   actor/system provenance;
-   server-owned created timestamp.

**Не добавлять поле только потому, что оно типично для бухгалтерских
систем.**

Особенно не выдумывать без источника:

-   account chart;
-   GL account;
-   debitAccount/creditAccount;
-   seller balance;
-   platform balance;
-   available balance;
-   pending balance;
-   exchange gain/loss;
-   tax posting;
-   provider clearing account;
-   settlement account;
-   payout account.

------------------------------------------------------------------------

# 8. DOUBLE-ENTRY STOP CONDITION

До реализации определить: требует ли Roadmap 2.10A полноценный
double-entry ledger или только immutable `LedgerTransaction` foundation.

Если источники явно требуют debit/credit postings --- реализовать строго
по ним.

Если источники **не определяют**:

-   account model;
-   balancing rule;
-   debit/credit account ownership;
-   posting groups;

то **НЕ изобретать псевдо-double-entry**.

В таком случае реализовать только утверждённый immutable transaction
foundation и честно задокументировать boundary.

Если Roadmap одновременно требует double-entry, но account semantics
отсутствует:

`ARCHITECTURE DECISION REQUIRED`.

------------------------------------------------------------------------

# 9. IDENTIFIER CONTRACT

`LedgerTransaction` должен использовать canonical identifier:

`LTX-########`

Проверить, что `LTX-` уже reserved/registered после Step 2.10.

Требования:

-   только `IdsService`;
-   transaction-safe sequence;
-   DB unique;
-   никаких `MAX()+1`;
-   никаких random business codes;
-   code создаётся в той же transaction, что LedgerTransaction.

Если `ids.md` расходится с runtime --- исправить contract в рамках
2.10A.

------------------------------------------------------------------------

# 10. DECIMAL / MONEY SAFETY --- HARD GATE

Ledger money:

-   только `Prisma.Decimal` / DB Decimal;
-   canonical API representation --- string;
-   запрещён native float как финансовый authority;
-   запрещены `parseFloat` / unsafe `Number()` для canonical
    calculation;
-   precision/scale должны быть согласованы с существующим money
    contract.

Проверить отрицательные суммы.

Предпочтительно:

-   `amount > 0`;
-   направление/тип определяет экономический смысл;

но не вводить это правило без проверки существующей архитектуры.

Если текущий contract допускает signed amount --- сохранить canonical
semantics.

------------------------------------------------------------------------

# 11. CURRENCY AUTHORITY

Ledger currency должна ссылаться/соответствовать Finance Currency
authority.

Определить из текущей архитектуры:

-   FK или code snapshot;
-   что происходит с inactive currency;
-   можно ли создавать ledger в неизвестной currency;
-   требуется ли historical validity.

Нельзя использовать locale/country как currency.

Нельзя автоматически конвертировать валюту в 2.10A.

FX conversion engine --- out of scope.

------------------------------------------------------------------------

# 12. IMMUTABILITY --- HARD GATE

После create:

-   `PATCH /ledger-transactions/:id` не должен существовать;
-   DELETE не должен существовать;
-   internal update writer не должен существовать;
-   ORM update/updateMany на LedgerTransaction вне специально доказанной
    migration/system infrastructure --- запрещён.

Repository-wide write audit обязателен.

Ожидаемый production writer:

**ровно один canonical Finance creation path**, если архитектура не
требует иного.

------------------------------------------------------------------------

# 13. CREATION AUTHORITY

Определить, должен ли 2.10A предоставлять:

A. internal Finance service only;

или

B. staff API для ручного ledger creation.

Не придумывать manual journal UI/API автоматически.

Если Roadmap не требует ручного posting API, не создавать публичный POST
только ради тестирования.

Если API требуется --- он должен быть Finance/Admin only и строго
валидирован.

------------------------------------------------------------------------

# 14. PAYMENT BOUNDARY --- CRITICAL

Step 2.12 Payment/PSP deferred.

2.10A **НЕ должен**:

-   создавать Payment;
-   менять Payment status;
-   создавать PSP transaction;
-   authorize/capture;
-   принимать Stripe webhook;
-   менять `Order.paymentStatus`;
-   менять `Order.paidAmount`;
-   выставлять `paidAt`;
-   считать заказ оплаченным.

Ledger foundation ≠ Payment implementation.

Schema-only `Payment` остаётся schema-only.

------------------------------------------------------------------------

# 15. PAYMENTTERMS BOUNDARY

Сохранить решение Step 2.10 Strict Review:

frozen terms цепочки

`Quote → CheckoutIntent → Sale → OrderRequested → Order`

остаются authoritative.

Finance `PaymentTerms` не становится новым source of truth в 2.10A.

Никакой materialization/recalculation PaymentTerms в этом шаге.

------------------------------------------------------------------------

# 16. REFUND BOUNDARY

Step 2.13 deferred.

Не реализовывать:

-   Refund create;
-   refund approval;
-   PSP refund;
-   auto-refund;
-   cancellation → refund;
-   refundedAt;
-   refund ledger posting, если конкретный source event/semantics ещё не
    утверждены.

Наличие будущей Refund schema не означает, что refund workflow активен.

------------------------------------------------------------------------

# 17. COMMISSION BOUNDARY

Не реализовывать:

-   commission calculation;
-   commission accrual;
-   recognition;
-   percentage/basis;
-   partner payable;
-   invoice linkage;
-   settlement posting.

Step 2.10A не должен превращаться в Commission engine.

------------------------------------------------------------------------

# 18. SETTLEMENT / PAYOUT / PROVIDER FEE BOUNDARY

Step 2.10B deferred.

Не создавать:

-   ProviderFee;
-   Settlement;
-   Payout;
-   payout balances;
-   payable balances;
-   provider reconciliation;
-   clearing logic;
-   payout events.

------------------------------------------------------------------------

# 19. TEMPORAL BOUNDARY

Step 2.10C deferred.

Не добавлять:

-   authorizedAt;
-   capturedAt;
-   paidAt;
-   refundedAt;
-   settledAt;
-   payoutRequestedAt;
-   payoutCompletedAt;

если они не являются чисто `LedgerTransaction.createdAt`.

`createdAt` --- время факта ledger-записи, а не Payment milestone.

------------------------------------------------------------------------

# 20. BUSINESS REFERENCE / PROVENANCE

Ledger transaction должен быть traceable.

Определить минимальный canonical reference contract:

-   source domain;
-   source aggregate/entity id;
-   source event id, если transaction event-driven;
-   business reference/code, если утверждено;
-   correlationId;
-   causationId.

Не хранить mutable dump Order/Booking/Payment.

Не копировать PII.

Не использовать human-readable code вместо canonical entity/event
identity, если архитектура требует UUID/reference.

------------------------------------------------------------------------

# 21. CORRELATION / CAUSATION --- HARD GATE

Соблюсти ADR-0009/0010 и существующий EventBus contract.

HTTP path, если существует:

-   correlation = server-authoritative request UUID;
-   causation = null, если нет parent event;
-   actor = authenticated USER.

Consumer path:

-   correlation наследуется;
-   causation = source event id;
-   actor/provenance соответствует event consumer semantics.

Не генерировать disconnected correlation UUID внутри business service.

------------------------------------------------------------------------

# 22. IDEMPOTENCY --- HARD GATE

Если LedgerTransaction создаётся из event/source fact, replay одного
source fact не должен создавать второй ledger fact.

Требуется DB-backed invariant, а не только `findFirst()`.

Определить canonical idempotency key из фактического contract:

-   sourceEventId;
-   sourceType + sourceId + transactionType;
-   либо другой approved invariant.

Если sources не позволяют выбрать корректный invariant без доменной
семантики:

`ARCHITECTURE DECISION REQUIRED`.

Не маскировать unknown P2002 как success.

------------------------------------------------------------------------

# 23. CONCURRENCY

Покрыть реальный race:

два параллельных запроса/consumer execution для одного canonical source.

Ожидаемо:

-   один LedgerTransaction;
-   второй deterministic no-op/controlled conflict согласно contract;
-   raw 500 = 0;
-   business code не дублируется;
-   partial rows = 0.

------------------------------------------------------------------------

# 24. TRANSACTION ATOMICITY

В одной DB transaction должны находиться все части одного ledger fact:

-   `LTX-` allocation;
-   LedgerTransaction create;
-   related outbox event, если событие требуется;
-   AuditLog, если security audit требуется.

Не должно быть:

-   code allocated, row missing;
-   row exists, provenance missing;
-   event exists, row rollback;
-   duplicate fact after retry.

------------------------------------------------------------------------

# 25. EVENT CONTRACT

Не создавать Finance event автоматически.

Сначала проверить Roadmap/contracts.

Если 2.10A требует canonical event, определить:

-   exact name;
-   version;
-   aggregate;
-   minimal payload;
-   PII-free;
-   correlation;
-   causation;
-   producer;
-   consumers.

Если consumer ещё нет --- событие всё равно не должно быть выдумано «на
будущее» без канонического источника.

Если Step 2.10A --- purely persistence foundation, честно сохранить **0
Finance business events**.

------------------------------------------------------------------------

# 26. AUDIT VS LEDGER

Не смешивать:

**AuditLog** --- кто и какое действие выполнил.

**LedgerTransaction** --- immutable financial business fact.

AuditLog не заменяет ledger.

Ledger не должен хранить security audit dump.

------------------------------------------------------------------------

# 27. RBAC

Если существует staff create/read API:

проверить реальные permissions.

Ожидаемая модель должна быть выведена из существующей RBAC Matrix, а не
придумана.

Минимум проверить:

-   ADMIN;
-   FINANCE;
-   DIRECTOR;
-   BUYER;
-   PARTNER;
-   OPERATOR;
-   SALES_MANAGER;
-   MODERATOR;
-   MARKETER;
-   ANALYST;
-   anonymous.

Read и write проверять отдельно.

Не давать DIRECTOR write только потому, что у него finance read.

------------------------------------------------------------------------

# 28. MASS ASSIGNMENT --- HARD GATE

Если API принимает create:

forged server-owned поля должны loud-reject согласно проектной
конвенции.

Проверить raw body до whitelist stripping.

Минимум forged:

-   id;
-   code;
-   createdAt;
-   updatedAt;
-   actor;
-   correlationId;
-   causationId;
-   sourceEventId;
-   internal status/system fields;
-   version, если есть.

Ожидаемый ответ: project-standard `422`, если это текущая конвенция.

------------------------------------------------------------------------

# 29. IDOR / SECURITY

Для entity-specific reads:

-   unauthorized → 401/403;
-   unknown → neutral 404;
-   никакого раскрытия внутренних объектов;
-   никакого PII;
-   никакого PSP secret;
-   PAN/CVV/card data запрещены.

------------------------------------------------------------------------

# 30. LEGACY COMPATIBILITY

Step 2.10A не должен требовать backfill ledger facts для старых:

-   Orders;
-   Bookings;
-   Sales;
-   CheckoutIntents;
-   schema-only Payments.

Если historical ledger отсутствовал --- legacy rows остаются без
fabricated financial history.

Не создавать fake opening ledger transactions без отдельного approved
migration strategy.

------------------------------------------------------------------------

# 31. MIGRATION --- HARD GATE

Migration должна быть:

-   additive;
-   replay-safe;
-   без destructive ALTER существующих domain tables;
-   без fabricated backfill;
-   без `db push`;
-   с правильными unique/index constraints для idempotency;
-   с корректным Decimal precision;
-   с canonical LTX unique code.

После миграции:

-   `prisma migrate status`;
-   drift/diff;
-   fresh DB replay реальными migrations.

------------------------------------------------------------------------

# 32. WRITE-PATH AUDIT

После реализации выполнить repository-wide audit всех:

-   `ledgerTransaction.create`;
-   `.update`;
-   `.updateMany`;
-   `.delete`;
-   `.deleteMany`;
-   raw SQL по ledger table.

Каждый production writer классифицировать.

Hard fail:

-   mutable ledger writer;
-   cross-domain writer;
-   bootstrap/seed создаёт fake financial facts;
-   test helper случайно зарегистрирован production path.

------------------------------------------------------------------------

# 33. READ MODEL / API

Если ledger reads входят в 2.10A:

минимальный read contract должен поддерживать только подтверждённые use
cases.

Не строить Finance Center UI backend целиком.

Не добавлять сложные:

-   balances;
-   aging;
-   reconciliation;
-   settlement views;
-   profitability;
-   commissions;
-   PSP analytics;

если Roadmap не требует их в 2.10A.

------------------------------------------------------------------------

# 34. BALANCE SEMANTICS --- STOP CONDITION

Не вводить `balance` как mutable source of truth без approved contract.

Если Roadmap требует balance, определить:

-   чей баланс;
-   в какой валюте;
-   available vs pending;
-   derived vs persisted;
-   recomputation rule;
-   transaction isolation.

Если этого нет:

**не реализовывать balances в 2.10A**.

------------------------------------------------------------------------

# 35. FX SEMANTICS

ExchangeRate Step 2.10 остаётся master data.

Ledger 2.10A не должен:

-   автоматически конвертировать transaction;
-   выбирать FX rate;
-   рассчитывать realized/unrealized FX;
-   создавать FX gain/loss.

Если ledger transaction требует rate snapshot, а Roadmap не определяет
правило выбора:

`ARCHITECTURE DECISION REQUIRED`.

------------------------------------------------------------------------

# 36. TAX SEMANTICS

Ledger 2.10A не должен:

-   рассчитывать Tax;
-   выбирать TaxRule;
-   создавать tax postings;
-   менять frozen Sale/Order price.

Tax master-data существует, tax engine --- нет.

------------------------------------------------------------------------

# 37. REQUIRED NEGATIVE TESTS

Покрыть применимые пункты:

1.  anonymous write → 401;
2.  forbidden roles → 403;
3.  unknown ledger id → 404;
4.  malformed amount → 422;
5.  zero/negative amount согласно утверждённой semantics → controlled
    4xx;
6.  excessive precision → 422;
7.  unknown currency → controlled 4xx;
8.  forged id → 422;
9.  forged code → 422;
10. forged createdAt → 422;
11. forged correlation/causation/source provenance → 422;
12. update immutable ledger → route absent/controlled rejection;
13. delete → route absent/controlled rejection;
14. duplicate source fact → no second ledger row;
15. concurrent duplicate → one fact;
16. unknown P2002 → not swallowed;
17. no Order.paymentStatus mutation;
18. no Order.paidAmount mutation;
19. no Booking payment mutation;
20. no availability hold/release;
21. no Payment creation;
22. no Refund creation;
23. no CommissionAccrual;
24. no Settlement/Payout;
25. no temporal payment milestones;
26. no raw 500.

------------------------------------------------------------------------

# 38. REQUIRED POSITIVE TESTS

Покрыть применимые canonical cases:

1.  valid ledger fact persists;
2.  canonical `LTX-########`;
3.  amount stored exactly as Decimal;
4.  currency preserved;
5.  provenance preserved;
6.  correlation/causation correct;
7.  actor correct;
8.  immutable after creation;
9.  replay-safe;
10. concurrency-safe;
11. AuditLog correct if applicable;
12. event correct if applicable;
13. fresh DB migration creates schema;
14. legacy domain rows remain readable;
15. zero cross-domain mutations.

Если creation API не входит в scope, тестировать service/consumer
canonical path, а не добавлять искусственный endpoint.

------------------------------------------------------------------------

# 39. P2002 / UNIQUE HANDLING

После дефекта, найденного на Strict Review 2.10, отдельно проверить race
handling.

Требование:

-   известный business unique invariant → controlled conflict/no-op
    согласно contract;
-   `LTX_code_key` collision не должен silently succeed;
-   idempotency unique constraint может быть no-op только если это
    именно duplicate canonical fact;
-   unknown P2002 должен fail loudly, но controlled --- не raw 500.

Использовать существующие shared Prisma error helpers.

------------------------------------------------------------------------

# 40. TESTING STRATEGY

Добавить отдельный e2e suite, например:

`backend/test/ledger-transaction-foundation.e2e-spec.ts`

Не подменять e2e unit-тестами.

Проверить минимум:

-   migration;
-   RBAC;
-   validation;
-   Decimal;
-   identifier;
-   immutability;
-   idempotency;
-   concurrency;
-   provenance;
-   isolation;
-   deferred boundaries;
-   legacy compatibility.

------------------------------------------------------------------------

# 41. TARGETED REGRESSION

После implementation:

-   Finance foundation 2.10;
-   new 2.10A suite;
-   RBAC;
-   IDs;
-   business event envelope;
-   Order lifecycle;
-   Booking lifecycle;
-   Sales/payment terms;
-   acquisition propagation;
-   temporal readiness;
-   phase2 entry/audits.

Указать точные suite/test counts.

------------------------------------------------------------------------

# 42. FULL BACKEND REGRESSION --- HARD GATE

Выполнить фактически:

-   backend `tsc --noEmit`;
-   backend build;
-   all unit;
-   full serial e2e.

Указать точные counts.

Нельзя писать «pass», если команда не выполнялась.

------------------------------------------------------------------------

# 43. FRONTEND REGRESSION

Даже если frontend не изменён:

-   frontend typecheck;
-   vitest;
-   production build.

Указать counts.

Frontend Finance Center не реализовывать.

------------------------------------------------------------------------

# 44. DB REGRESSION

Обязательно:

-   migration count/status;
-   drift/diff;
-   fresh replay;
-   подтвердить отсутствие `db push`;
-   проверить SQL migration вручную;
-   подтвердить additive nature.

------------------------------------------------------------------------

# 45. DOCUMENTATION

Обновить только фактические контракты:

-   `docs/contracts/api.md`, если появился API;
-   `docs/contracts/events.md`, только если появился canonical event;
-   `docs/contracts/ids.md`, если требуется финализировать LTX;
-   architecture artifact:
    `docs/architecture/ledger-transaction-foundation.md`;
-   Roadmap.

Architecture artifact минимум должен описывать:

1.  purpose;
2.  ownership;
3.  model;
4.  immutable fields;
5.  money/Decimal;
6.  identifier;
7.  creation authority;
8.  idempotency;
9.  concurrency;
10. transaction atomicity;
11. provenance;
12. correlation/causation;
13. RBAC;
14. audit;
15. event boundary;
16. Payment boundary;
17. Refund boundary;
18. Commission boundary;
19. Settlement/Payout boundary;
20. temporal boundary;
21. legacy compatibility;
22. migration;
23. explicit deferred items.

------------------------------------------------------------------------

# 46. ROADMAP UPDATE

Только после полного regression.

При успешном implementation:

Step 2.10A →

`IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

NEXT →

`PHASE 2 — STEP 2.10A — STRICT REVIEW`

Не переводить 2.10A сразу в APPROVED.

Не начинать 2.10B.

------------------------------------------------------------------------

# 47. ARCHITECTURE STOP CONDITIONS

Немедленно остановиться с:

`PHASE 2 STEP 2.10A IMPLEMENTATION BLOCKED — ARCHITECTURE DECISION REQUIRED`

если обнаружено хотя бы одно:

1.  Roadmap требует double-entry, но account semantics отсутствует;
2.  невозможно определить canonical ledger amount sign/direction;
3.  невозможно определить currency authority;
4.  невозможно определить idempotency key/source fact;
5.  ledger должен писать Order/Booking/Sales;
6.  Order/Booking должны напрямую писать ledger;
7.  корректность требует Payment 2.12;
8.  корректность требует Refund 2.13;
9.  корректность требует Settlement/Payout 2.10B;
10. корректность требует temporal milestones 2.10C;
11. требуется FX conversion policy;
12. требуется tax calculation policy;
13. требуется commission recognition policy;
14. требуется persisted balance без balance contract;
15. competing financial source of truth обнаружен;
16. schema-only Payment уже является active writer;
17. active Stripe/PSP legacy writer обнаружен;
18. migration требует fabricated backfill;
19. immutable ledger невозможно обеспечить без destructive change;
20. canonical source documents противоречат друг другу.

Не маскировать архитектурный конфликт локальным workaround.

------------------------------------------------------------------------

# 48. OUT OF SCOPE --- ЖЁСТКО

В этом проходе **НЕ реализовывать**:

-   Step 2.10B ProviderFee;
-   Settlement;
-   Payout;
-   Step 2.10C Finance temporal milestones;
-   Step 2.12 Payment;
-   PSP/Stripe integration;
-   authorize/capture;
-   Step 2.13 Refund;
-   Step 2.14 Invoice;
-   commission calculation/accrual;
-   seller payable balance;
-   platform balance;
-   mutable wallet/balance;
-   FX conversion engine;
-   tax calculation engine;
-   Finance Center frontend;
-   reconciliation engine;
-   manual accounting journal, если он прямо не требуется 2.10A;
-   reversal/void workflow без канонического источника.

------------------------------------------------------------------------

# 49. REQUIRED IMPLEMENTATION REPORT

Создать отдельный отчёт:

`docs/prompts/PHASE_2_STEP_2.10A_LEDGER_TRANSACTION_FOUNDATION_IMPLEMENTATION_REPORT.md`

Структура отчёта:

1.  Verdict
2.  Repository baseline
3.  Sources inspected
4.  Current → Target reconciliation
5.  Architecture decision status
6.  Ledger ownership
7.  Ledger model
8.  Schema/migration
9.  Identifier contract
10. Decimal/money contract
11. Currency authority
12. Immutable fields
13. Creation authority
14. Write-path audit
15. Business provenance
16. Correlation/causation
17. Idempotency
18. Concurrency
19. Transaction atomicity
20. Event contract
21. Audit contract
22. RBAC
23. Auth/IDOR
24. Mass assignment
25. Payment boundary
26. PaymentTerms boundary
27. Refund boundary
28. Commission boundary
29. Settlement/Payout boundary
30. Temporal boundary
31. Balance boundary
32. FX boundary
33. Tax boundary
34. Order isolation
35. Booking isolation
36. Availability isolation
37. Pricing/frozen-money isolation
38. Acquisition isolation
39. Legacy compatibility
40. Negative tests
41. Positive tests
42. Targeted regression
43. Backend regression
44. Frontend regression
45. DB regression
46. Issues found
47. Fixes applied
48. Documentation
49. Exact files changed
50. Migration details
51. Roadmap update
52. Out-of-scope confirmation
53. Exact NEXT item

------------------------------------------------------------------------

# 50. FINAL QUALITY GATE

Implementation считается завершённым только если одновременно:

-   ledger ownership однозначен;
-   immutable contract доказан;
-   canonical LTX id работает;
-   Decimal-safe;
-   DB idempotency invariant существует;
-   concurrency доказана;
-   cross-domain writes отсутствуют;
-   Payment/Refund/Settlement/Commission не начаты;
-   temporal 2.10C не начат;
-   migration replay clean;
-   backend regression green;
-   frontend regression green;
-   docs соответствуют runtime;
-   Roadmap указывает Strict Review 2.10A как NEXT.

------------------------------------------------------------------------

# 51. FINAL LINE

При успешном завершении последняя строка отчёта должна быть ровно:

`PHASE 2 STEP 2.10A IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

При архитектурном блоке:

`PHASE 2 STEP 2.10A IMPLEMENTATION BLOCKED — ARCHITECTURE DECISION REQUIRED`
