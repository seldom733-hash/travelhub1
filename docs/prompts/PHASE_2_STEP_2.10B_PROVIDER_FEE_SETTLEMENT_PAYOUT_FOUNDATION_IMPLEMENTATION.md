# PHASE 2 — STEP 2.10B — PROVIDER FEE / SETTLEMENT / PAYOUT FOUNDATION — IMPLEMENTATION PROMPT

## 0. Роль и режим работы

Ты работаешь в существующем репозитории **TravelHub** и выполняешь только:

**PHASE 2 — STEP 2.10B — PROVIDER FEE / SETTLEMENT / PAYOUT FOUNDATION**

Это implementation-pass. Не выполняй Strict Review в этом же проходе.

Перед любыми изменениями сначала восстанови фактическое состояние репозитория, прочитай Roadmap и approved-контракты предыдущих шагов. Не исходи из предположения, что описание ниже точнее кода: если фактический runtime, schema, миграции или approved docs отличаются, сначала выполни reconciliation.

Цель шага — заложить минимальный, канонический и расширяемый Finance-owned фундамент для:

- provider fee;
- settlement;
- payout;

не начиная Payment PSP orchestration, Refund, Invoice, commission accrual, accounting/double-entry, reconciliation engine или Finance Center frontend.

---

# 1. Обязательный baseline перед реализацией

До изменения кода зафиксируй:

- branch;
- HEAD;
- соответствие `origin`;
- dirty/untracked files;
- текущий Roadmap status;
- количество миграций;
- `prisma migrate status`;
- schema drift;
- текущие Finance-модели;
- текущие production writers Finance;
- существующие permissions;
- существующие ID-prefixes;
- состояние Step 2.10, 2.10A, 2.10C, 2.12+.

Особенно подтвердить approved baseline:

- **2.10 — Finance Domain Foundation**;
- **2.10A — Ledger Transaction Foundation**;
- 2.10A имеет verdict  
  `STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`;
- ledger остаётся append-only;
- единственный ledger writer не должен быть случайно размножен;
- idempotency ledger использует first-write-wins + payload verification;
- divergent replay не может молча считаться успехом;
- 2.10C и 2.12+ ещё не должны быть реализованы этим шагом.

Если baseline существенно расходится — остановись и сообщи.

---

# 2. Sources of truth

Обязательно изучить как минимум:

- `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`;
- Screen Design Brief / Finance Center sections;
- RBAC Matrix;
- `docs/contracts/api.md`;
- `docs/contracts/events.md`;
- `docs/contracts/ids.md`;
- Finance architecture docs Steps 2.10/2.10A;
- Prisma schema + все finance migrations;
- `backend/src/modules/finance/**`;
- ledger service/controller/tests;
- `permissions.constants.ts`;
- `SecurityService` / role seeding;
- `IdsService`;
- shared validation helpers;
- EventBus / request context / ADR-0009/0010;
- Order/Booking/Sales models только для проверки boundary/ownership;
- e2e harness и migration replay mechanism.

Нельзя выдумывать provider/settlement/payout semantics, которых нет в Roadmap/Screen Design/approved contracts.

---

# 3. Главный архитектурный принцип

Step 2.10B создаёт **Finance-owned financial operational facts**, но НЕ превращает их в полноценный accounting ledger, PSP workflow или settlement engine.

Должны быть чётко разделены:

1. **ProviderFee** — факт/запись комиссии внешнего платёжного или финансового провайдера.
2. **Settlement** — факт/контейнер расчёта/сведения денежных обязательств в рамках поддерживаемого canonical scope.
3. **Payout** — факт/операционная запись выплаты.
4. **LedgerTransaction** — уже approved immutable финансовая история Step 2.10A.

Не допускай смешения этих сущностей в одну mutable «универсальную Payment таблицу».

---

# 4. HARD GATE — ownership и write-path audit

До реализации выполни repo-wide audit:

- `ProviderFee`;
- `Settlement`;
- `Payout`;
- `LedgerTransaction`;
- `Payment`;
- `Refund`;
- любые старые payout/payment/stripe writers;
- raw SQL;
- seed/jobs/workers;
- controllers;
- event consumers.

Для каждого writer классифицируй:

1. canonical Finance-owned;
2. approved legacy/scaffolding;
3. read-only;
4. cross-domain violation;
5. obsolete/unsafe.

**Hard fail**, если обнаружены конфликтующие production authorities, которые нельзя безопасно reconciliate без архитектурного решения.

После реализации повтори audit и докажи, что Finance остаётся владельцем новых таблиц.

---

# 5. Reconcile с существующей schema

Step 2.10 foundation мог уже создать schema-only модели `Settlement`, `Payout` или связанные сущности.

Поэтому:

- не создавай дубликаты;
- не переименовывай существующие canonical модели без необходимости;
- сначала определи current → target delta;
- изменения schema должны быть additive и migration-safe;
- legacy rows должны оставаться читаемыми;
- никакого destructive backfill без канонического основания.

Если модель уже существует schema-only — активируй её минимальным canonical runtime, а не создавай параллельную модель.

---

# 6. ProviderFee — минимальный контракт

Определи ProviderFee только из канонических источников.

Минимально допустимый foundation должен позволять хранить immutable/durable provider-fee fact с:

- canonical ID;
- provider identifier/type, если источник это поддерживает;
- amount;
- currency snapshot;
- provenance/source reference;
- optional external reference, если канонически оправдано;
- correlation/causation/actor metadata по существующему стандарту;
- server-owned timestamp.

Критические требования:

- деньги — `Decimal`, не float;
- amount semantics должны быть однозначны;
- не вычислять fee «по проценту», если такого canonical правила нет;
- не подменять provider fee внутренней TravelHub commission;
- не делать reprice;
- не менять Order/Booking/Sale money;
- не использовать mutable current Payment status как источник исторической истины.

Если канонический источник не определяет достаточно семантики для runtime producer-а — разрешается foundation/schema + internal API, но нельзя выдумывать producer.

---

# 7. Settlement — минимальный контракт

Settlement foundation должен быть отделён от Payment и Payout.

Проверь, какие поля уже заданы schema/Roadmap/Screen Design.

Минимальные свойства:

- canonical `SET-...` либо существующий утверждённый prefix;
- Finance ownership;
- explicit amount/currency semantics;
- source/provenance;
- server-owned timestamps;
- отсутствие fabricated accounting state;
- отсутствие hidden recalculation из текущего Payment/Order.

Не вводи «баланс к выплате», «net payable», settlement periods, batch closing, reconciliation status или provider settlement matching, если это не определено источниками.

Если status vocabulary уже существует — используй его. Если нет — **не изобретай сложную state machine**.

---

# 8. Payout — минимальный контракт

Payout foundation должен представлять Finance-owned payout record, а не обещание реального банковского/PSP перевода.

Проверить:

- существующую schema;
- Screen Design status codes;
- IDs;
- permissions;
- возможную связь с settlement.

Требования:

- canonical ID;
- amount/currency;
- recipient/payee reference только если ownership и reference уже определены;
- provenance;
- server-owned timestamps;
- controlled status только при наличии canonical vocabulary;
- никаких реальных PSP calls;
- никаких Stripe Connect assumptions;
- никаких bank credentials/PII dumps;
- никаких автоматических payout side effects.

Если связь Settlement → Payout не определена однозначно — не fabricate.

---

# 9. Money invariants

Для всех новых денежных фактов:

- `Prisma.Decimal`;
- API serializes money as string;
- никаких JS float calculations как authority;
- scale/precision определить из approved Finance contract;
- validate amount domain;
- currency должна быть canonical/snapshot-compatible;
- отсутствие implicit FX;
- отсутствие tax recalculation;
- отсутствие commission recalculation.

Проверить boundary cases:

- zero;
- negative;
- excess scale;
- malformed decimal;
- unsupported/inactive currency — поведение должно соответствовать approved Finance foundation.

---

# 10. ID contract

Все новые durable Finance entities должны использовать общий `IdsService`, если такой паттерн уже утверждён.

Проверь и при необходимости зарегистрируй canonical prefixes в:

`docs/contracts/ids.md`

Не придумывай prefix, если он уже существует.

ID generation + create должны быть transaction-safe согласно существующему проектному паттерну.

---

# 11. Immutability vs mutable operational state

Не объявляй сущность immutable без доказательства.

Для каждой из:

- ProviderFee;
- Settlement;
- Payout;

явно классифицируй поля:

- immutable facts;
- mutable operational state;
- server-owned metadata.

Если ProviderFee является историческим фактом — предпочтительно append-only.

Если Settlement/Payout имеют canonical lifecycle — разрешены только явно определённые переходы.

Если lifecycle не определён — не создавай state machine ради «полноты».

---

# 12. Ledger boundary — CRITICAL

Step 2.10B не должен разрушить Step 2.10A.

Проверить:

- не появился второй прямой writer `LedgerTransaction`;
- ProviderFee/Settlement/Payout не пишут ledger raw SQL;
- ledger append-only;
- ledger divergent replay protection сохранён;
- существующий `@@unique(sourceType, sourceId, type)` не обходится;
- новые сущности не становятся balance authority.

Если Step 2.10B должен создавать ledger facts согласно каноническому источнику — это должно быть явно доказано Roadmap/docs. Иначе **не создавать ledger автоматически**.

Предпочтение: foundation без fabricated ledger postings до producer-шагов.

---

# 13. Idempotency

Для каждого create/consumer path определить idempotency authority.

Недопустимо:

- «найден duplicate → вернуть существующий» без payload verification;
- catch-all P2002 → success;
- логически разные финансовые факты схлопывать одним слишком широким unique key.

Если используется first-write-wins:

- identical replay → no-op/существующий факт;
- divergent payload → controlled `409`;
- unknown unique violation → controlled error/rethrow по проектному контракту;
- raw 500 от ожидаемой гонки недопустим.

Обязательно adversarial test на divergent duplicate.

---

# 14. Concurrency

Если есть create/idempotent producer:

- concurrent identical create → один durable fact;
- concurrent divergent create → один победитель, второй controlled conflict;
- count = 1;
- без raw 500.

Если есть status transition:

- CAS/version guard;
- один победитель;
- история/milestone/event только для реального перехода.

Не вводить CAS там, где сущность строго append-only и update path отсутствует.

---

# 15. RBAC

Использовать существующие `finance.*` permissions, если они уже определены.

Сначала audit:

- FINANCE;
- DIRECTOR;
- ANALYST;
- ADMIN;
- BUYER;
- PARTNER;
- OPERATOR;
- SALES_MANAGER;
- MODERATOR;
- MARKETER.

Новые permissions вводить только при реальной необходимости.

Минимум:

- write/manage — только Finance-authorized roles;
- read — согласно существующей Finance RBAC модели;
- anonymous → 401;
- forbidden role → 403;
- unknown object → neutral 404.

Никакого universal authenticated write.

---

# 16. API surface

Добавляй только API, необходимый foundation.

Для каждого endpoint определить:

- method/path;
- permission;
- allowed DTO fields;
- server-owned forbidden keys;
- validation;
- 400/401/403/404/409/422 semantics;
- pagination/filter whitelist для list API.

Не создавать PSP-like endpoints:

- capture;
- authorize;
- charge;
- refund;
- transfer;
- reconcile;
- settle externally;

если это будущие шаги.

---

# 17. Mass assignment

Все server-owned поля должны быть loud-rejected согласно проектной конвенции, а не silently stripped.

Проверить forged:

- id/code;
- amount/currency при endpoint, где они immutable;
- source/provenance;
- status;
- timestamps;
- correlation/causation;
- actor;
- ledger refs;
- relations;
- version;
- createdAt/updatedAt.

Используй `assertNoForbiddenKeys` на **raw request body**, если именно это является утверждённой конвенцией проекта.

Forged request → `422` и ноль partial mutations.

---

# 18. Correlation / causation / actor

Соблюдать ADR-0009/0010:

HTTP command:

- correlation = server-authoritative request UUID;
- causation = null;
- actor из auth/request context.

Consumer:

- correlation наследуется;
- causation = triggering event id;
- actor semantics по существующему EventBus contract.

Не принимать эти поля от клиента как authority.

---

# 19. Events

Не вводить события просто потому, что появилась таблица.

Для ProviderFee/Settlement/Payout:

- сначала проверить `events.md` и Roadmap;
- если canonical event не определён — не изобретать;
- если событие действительно требуется, payload должен быть минимальным и без PII.

Отдельно доказать, что Step 2.10B не начал Payment/Refund/Invoice event flows.

---

# 20. PII / secrets

Provider/Payout данные потенциально чувствительны.

Запрещено durable event/API/audit dump:

- card PAN;
- CVV;
- bank credentials;
- access tokens;
- PSP secrets;
- unnecessary account holder PII;
- passport/traveler PII.

Хранить только canonical references и минимально необходимые provider refs.

---

# 21. Cross-domain isolation

Finance не должен напрямую мутировать:

- `sales.*`;
- `order.*`;
- `booking.*`;
- `availability.*`;
- `catalog.*`;
- `reverse.*`;
- account/buyer state.

Особенно проверить:

- `Order.paymentStatus`;
- `Order.paidAmount`;
- Booking statuses;
- availability holds;
- frozen acquisition source;
- frozen service time;
- frozen price.

Step 2.10B не является Payment orchestration.

---

# 22. Settlement/Payout relationship

Не предполагать автоматически:

`Settlement = один Payout`

или:

`Settlement = много Payout`

или:

`Payout обязательно имеет Settlement`

пока это не следует из canonical sources/schema.

Если связь уже задана — сохранить её cardinality и ownership.

Если нет — оставить foundation расширяемым.

---

# 23. ProviderFee relationship

Не предполагать автоматически, что provider fee принадлежит:

- Payment;
- Settlement;
- Payout;
- Order;
- Booking;

если source contract этого не определяет.

Используй canonical provenance pattern (`sourceType/sourceId` или существующий эквивалент), если он уже утверждён Finance foundation.

---

# 24. Status vocabulary

Перед введением enum/state machine сделать repo/docs search.

Если Screen Design содержит stable backend codes — использовать их 1:1.

Если статус-коды есть в schema, но producer-ов пока нет:

- честно классифицировать как reserved/legacy;
- не fabricating переходы.

Если источники конфликтуют — `ARCHITECTURE DECISION REQUIRED`.

---

# 25. Temporal boundary

Step 2.10C — отдельный будущий шаг.

Поэтому 2.10B не должен самовольно вводить:

- `paidAt`;
- `authorizedAt`;
- `capturedAt`;
- refund milestones;
- settlement/payout milestones,

кроме тех timestamps, которые являются обычными `createdAt`/`updatedAt` или прямо необходимы foundation schema и уже канонически определены.

Если для Settlement/Payout milestone semantics не определены — STOP, не выдумывать.

---

# 26. Payment boundary

Payment остаётся schema-only/будущим runtime до соответствующего шага.

Step 2.10B не должен:

- создавать Payment;
- менять Payment status;
- реализовывать PSP;
- связывать provider fee с выдуманным Payment runtime;
- делать capture/authorization;
- создавать payment ledger postings.

---

# 27. Refund / Invoice / Commission boundary

Не начинать:

- Refund runtime;
- Invoice runtime;
- commission accrual;
- supplier commission engine;
- marketplace fee engine;
- tax calculation;
- payout calculation from commission.

ProviderFee ≠ TravelHub commission.

---

# 28. Availability boundary

Никаких:

- hold;
- release;
- consume;
- capacity mutation.

Finance foundation не владеет availability.

---

# 29. Audit/history

Для mutable operational entities определить, нужен ли отдельный domain history.

Не создавать историю, если canonical contract её не требует.

Security `AuditLog` и financial/domain facts не смешивать.

Audit не должен содержать PII/secrets/full request dumps.

---

# 30. Migration requirements

Если schema меняется:

- только Prisma migration;
- additive-first;
- никакого `db push`;
- no destructive reset dev/prod;
- nullable/additive там, где legacy compatibility требует;
- проверить generated client;
- `migrate status`;
- `migrate diff`;
- fresh replay реальных миграций.

Migration SQL проверить вручную.

---

# 31. Legacy compatibility

Проверить:

- старые finance master rows;
- существующие ledger rows;
- nullable provenance;
- отсутствие новых обязательных полей, ломающих legacy;
- schema-only Payment/Refund/Invoice rows, если они возможны;
- old DB replay.

Не fabricating backfill.

---

# 32. Required negative tests

Добавить/расширить e2e так, чтобы фактически доказать минимум:

1. anonymous write/read policy;
2. forbidden roles;
3. unknown object → 404;
4. forged server-owned fields → 422;
5. invalid amount;
6. zero/negative amount;
7. excess decimal scale;
8. invalid currency;
9. duplicate canonical identity;
10. identical replay;
11. divergent replay → 409;
12. concurrent identical create;
13. concurrent divergent create;
14. unsupported state transition, если lifecycle существует;
15. terminal reopen blocked, если lifecycle существует;
16. no Payment creation;
17. no Payment status mutation;
18. no Order/Booking mutation;
19. no availability hold/release;
20. no automatic ledger write, если контракт его не требует;
21. no Refund/Invoice/Commission creation;
22. no raw 500 on expected conflict;
23. no PII/secrets in durable payload/audit;
24. legacy row remains readable;
25. unknown P2002 не маскируется как success.

Не создавать бессмысленные HTTP-тесты для internal-only path — там допускается code audit/unit/integration, но отчёт должен честно это отметить.

---

# 33. Required positive tests

Минимально доказать:

1. authorized Finance create/read;
2. canonical ID format;
3. decimal string API contract;
4. currency snapshot;
5. provenance persistence;
6. correlation/causation/actor semantics;
7. idempotent identical replay;
8. one durable fact under concurrency;
9. filters/pagination whitelist;
10. no cross-domain side effects;
11. migration tables exist on fresh replay;
12. ledger regression remains green.

Если Settlement/Payout имеют canonical lifecycle — добавить весь разрешённый happy path.

---

# 34. Ledger regression — mandatory

После изменений отдельно прогнать Step 2.10A tests.

Обязательные invariants:

- append-only;
- writer count не увеличился без canonical причины;
- divergent amount/currency replay → 409;
- identical replay → one fact;
- ledger count stable при 2.10B operations, если auto-posting не предусмотрен;
- no cascade risk;
- read RBAC intact.

Любая регрессия здесь блокирует approval.

---

# 35. Finance foundation regression

Прогнать Step 2.10 suite:

- currencies;
- exchange rates;
- taxes/tax rules;
- permissions;
- IDs;
- schema-only deferred models;
- no cross-domain writes.

Step 2.10B не должен ломать master data.

---

# 36. Full backend regression

После targeted tests обязательно:

- TypeScript typecheck;
- backend build;
- unit;
- полный serial e2e.

Не ограничиваться targeted suite.

В отчёте указать реальные числа suites/tests.

---

# 37. Frontend regression

Даже если frontend не менялся:

- frontend `tsc --noEmit`;
- vitest;
- production build.

Finance Center UI в этом шаге не реализовывать.

---

# 38. DB regression

Обязательно:

- `prisma migrate status`;
- количество миграций;
- drift/diff;
- fresh replay через реальный migration harness;
- отсутствие `db push`.

---

# 39. Documentation

Обновить минимум:

- `docs/contracts/api.md`;
- `docs/contracts/events.md` — даже если отметить «новых событий нет»;
- `docs/contracts/ids.md`;
- новый architecture artifact, например  
  `docs/architecture/provider-fee-settlement-payout-foundation.md`;
- Roadmap v3.

Architecture artifact должен содержать:

1. purpose;
2. ownership;
3. current→target reconciliation;
4. schema;
5. ProviderFee semantics;
6. Settlement semantics;
7. Payout semantics;
8. money contract;
9. IDs;
10. immutability/state;
11. idempotency/concurrency;
12. RBAC/API;
13. ledger boundary;
14. cross-domain isolation;
15. legacy/migration;
16. deferred scope.

---

# 40. Roadmap update rule

Только после всех зелёных проверок:

Step 2.10B →

`IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

NEXT →

`PHASE 2 — STEP 2.10B — STRICT REVIEW`

Не отмечать APPROVED в implementation-pass.

Не начинать 2.10C.

---

# 41. Required implementation report

Создай отдельный `.md` report в `docs/prompts/` по принятой convention.

Отчёт должен содержать минимум:

1. Verdict;
2. repository baseline;
3. sources inspected;
4. current→target reconciliation;
5. write-path audit;
6. schema/migration;
7. ProviderFee contract;
8. Settlement contract;
9. Payout contract;
10. money invariants;
11. ID contract;
12. idempotency;
13. concurrency;
14. RBAC;
15. API/mass assignment;
16. correlation/causation;
17. events;
18. ledger boundary;
19. Payment/Refund/Invoice/Commission boundaries;
20. cross-domain isolation;
21. legacy compatibility;
22. targeted tests;
23. ledger regression;
24. Finance foundation regression;
25. backend full regression;
26. frontend regression;
27. DB regression;
28. issues found;
29. fixes applied;
30. architecture decision status;
31. exact files changed;
32. Roadmap update;
33. exact NEXT item.

---

# 42. Stop conditions — ARCHITECTURE DECISION REQUIRED

Остановить реализацию и вывести:

`ARCHITECTURE DECISION REQUIRED`

если обнаружено хотя бы одно:

1. canonical sources противоречат друг другу по meaning ProviderFee/Settlement/Payout;
2. невозможно определить money authority без Payment runtime;
3. Settlement ↔ Payout cardinality требует необратимого решения без источника;
4. provider fee невозможно отличить от marketplace commission;
5. требуется новый ledger accounting model/double-entry для корректности;
6. требуется менять approved 2.10A append-only/idempotency contract;
7. требуется начать Payment/Refund/Invoice runtime;
8. требуется Finance → Order/Booking direct write;
9. требуется Availability release/hold;
10. status vocabulary конфликтует между schema и Screen Design;
11. корректная реализация требует temporal milestones Step 2.10C;
12. существующие legacy writers конфликтуют с Finance ownership;
13. migration требует destructive/backfill semantics без канонического основания;
14. payout требует хранения банковских секретов/неопределённого PII;
15. невозможно обеспечить idempotency без выбора нового business invariant, которого нет в источниках.

В этом случае не маскировать проблему тестами.

---

# 43. Hard prohibitions

Запрещено:

- начинать Step 2.10C;
- начинать Payment PSP Step 2.12;
- начинать Refund/Invoice runtime;
- создавать реальный payout через PSP;
- реализовывать Stripe-specific orchestration;
- строить double-entry accounting;
- вводить balance authority;
- рассчитывать TravelHub commission;
- рассчитывать provider fee без source fact;
- делать implicit FX;
- reprice Order/Booking/Sale;
- мутировать Availability;
- принимать correlation/actor от клиента;
- silent-strip server-owned forged fields;
- catch-all P2002 as success;
- duplicate → existing без payload verification;
- raw SQL для обхода ownership;
- `prisma db push`;
- destructive migration;
- менять frontend Finance Center;
- отмечать Step 2.10B APPROVED без отдельного Strict Review.

---

# 44. Definition of Done

Step 2.10B считается implementation-complete только если одновременно:

- ownership Finance доказан;
- ProviderFee/Settlement/Payout reconciled с существующей schema;
- money semantics не выдуманы;
- canonical IDs работают;
- RBAC работает;
- mass-assignment loud 422;
- idempotency защищает divergent replay;
- concurrency не создаёт duplicate facts;
- ledger 2.10A не сломан;
- Payment/Refund/Invoice/Commission не начаты;
- cross-domain writes = 0;
- Availability side effects = 0;
- migration additive/replay-safe;
- targeted tests зелёные;
- ledger regression зелёная;
- Finance regression зелёная;
- полный backend regression зелёный;
- frontend regression зелёный;
- DB status/diff/replay зелёные;
- docs обновлены;
- Roadmap = `IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`;
- NEXT = Step 2.10B Strict Review.

---

# 45. Финальная строка

При успешном завершении implementation-pass отчёт должен завершаться **точно**:

`PHASE 2 STEP 2.10B IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

Если сработал stop-condition:

`PHASE 2 STEP 2.10B — ARCHITECTURE DECISION REQUIRED`
