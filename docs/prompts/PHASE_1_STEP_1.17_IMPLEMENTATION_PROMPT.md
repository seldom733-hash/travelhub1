# TRAVELHUB — PHASE 1 — STEP 1.17 — HARDENING / SECURITY / REGRESSION

## IMPLEMENTATION PROMPT

Ты работаешь с существующим repository проекта **TravelHub**. Это продолжение последовательной реализации `TravelHub Canonical Implementation Roadmap v3`, а не новый проект и не разрешение на перепроектирование системы.

Текущая подтверждённая точка:

- Steps 1.0–1.15 прошли implementation/review и APPROVED;
- Step 1.16 Communication Foundation прошёл Strict Review;
- подтверждённые review issues Step 1.16 исправлены;
- `PHASE 1 — STEP 1.16 — APPROVED AFTER REVIEW FIXES`;
- следующий выполняемый шаг: `PHASE 1 — STEP 1.17 — Phase 1 Hardening / Security / Regression`.

Твоя задача — выполнить **сквозное укрепление всей реализованной Phase 1**, найти и исправить подтверждённые локальные дефекты безопасности, изоляции, контрактов, миграций, runtime и regression. Нельзя расширять продуктовый scope и нельзя начинать Phase 2.

---

# 1. Источники истины

Перед изменениями прочитай фактические документы repository:

- актуальный `TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md` или его фактический canonical эквивалент;
- Master Plan TravelHub;
- ADR-0001 и все последующие ADR, включая amendments/review fixes;
- `contracts/events.md`;
- `contracts/api.md`;
- `ids.md`;
- `temporal-readiness.md`;
- Deferred Decisions Map;
- implementation/review reports, если они хранятся в repository;
- Prisma schema и всю цепочку migrations;
- backend/frontend source, tests, seeds и runtime configuration.

Не доверяй статусам документации без проверки реального кода и migrations. Если status-строки roadmap устарели, синхронизируй только фактически доказанные статусы, не объявляя непроверенный шаг APPROVED.

При конфликте документов сначала зафиксируй конфликт и определи его влияние. Если исправление меняет bounded-context ownership, canonical lifecycle, commercial model, security authority или фундаментальный cross-domain contract, остановись и выдай:

`ARCHITECTURE DECISION REQUIRED`

Не принимай такое решение самостоятельно.

---

# 2. Цель Step 1.17

Доказать, что вся реализованная Phase 1 образует безопасную, воспроизводимую и согласованную foundation перед Phase 1 Exit Audit.

Step 1.17 должен проверить и при необходимости локально исправить:

1. RBAC и backend authorization;
2. object ownership, tenant scope и IDOR;
3. Public/Internal/Buyer/Partner boundaries;
4. Marketplace/Storefront identity и contact isolation;
5. DTO/serialization/mass-assignment boundaries;
6. lifecycle и state-transition guards;
7. timestamps/history/events/traceability;
8. migration safety, clean replay и schema drift;
9. pagination/filter/sort/error contracts;
10. concurrency, uniqueness и idempotency там, где они уже являются текущим contract;
11. PII/privacy/logging/audit/event payload safety;
12. production build, startup и фактический runtime;
13. полную backend/frontend regression.

Step 1.17 не считается выполненным только потому, что существующие тесты зелёные. Необходимо проверить, что тесты действительно покрывают отрицательные security paths и architectural invariants.

---

# 3. Жёсткие границы scope

## 3.1 Разрешено

- исправлять подтверждённые локальные security/authorization/validation defects;
- добавлять недостающие отрицательные unit/e2e tests;
- исправлять DTO projections и утечки полей;
- исправлять migration/replay/drift проблемы безопасными additive changes;
- исправлять pagination/filter/sort/error consistency;
- укреплять существующие lifecycle guards;
- исправлять trace propagation в рамках уже утверждённого Step 1.15;
- исправлять Step 1.16 Communication только при подтверждённой regression/invariant problem;
- обновлять документацию и ADR amendments для фактически реализованной semantics;
- дополнять Deferred Decisions Map только действительно отложенными решениями.

## 3.2 Запрещено

Не реализовывай:

- Phase 2;
- Sales, Quote, Checkout, Sale или новый commercial flow;
- новый Order creation flow;
- Booking/Finance/Payments completion;
- Subscription/Billing;
- Storefront pricing, plans, trial, recurring billing или grace period;
- Partner CRM;
- Support Ticket/Case/SLA;
- полноценный Chat;
- Notification platform;
- attachments/read receipts/external communication channels;
- multilingual business content или AI translation;
- custom domains;
- новые analytics dashboards;
- новые behavioral/domain events без реального утверждённого producer/consumer use case;
- speculative statuses, tables или extension points без текущего contract;
- legacy data backfill по догадкам;
- fake timestamps из `updatedAt`, migration time или current time;
- замену архитектуры под предлогом hardening.

Не удаляй существующую логику ради упрощения тестов. Не ослабляй guards, validation или assertions, чтобы сделать regression зелёной.

---

# 4. Обязательная исходная инвентаризация

До первой модификации:

1. зафиксируй текущий git status и не перезаписывай unrelated user changes;
2. составь карту backend modules/controllers/endpoints;
3. составь карту frontend route groups/layouts/API clients;
4. составь карту ролей, permissions и способов выдачи permissions;
5. составь карту public, authenticated, Buyer, Partner и internal routes;
6. составь карту Prisma schemas/models/enums и migrations;
7. составь карту IDs/business sequences;
8. составь карту domain events, behavioral events, AuditLog, Outbox/Inbox;
9. составь карту requestId/correlationId/causationId propagation;
10. составь карту lifecycle transitions и temporal fields;
11. найди legacy/bootstrap/debug/test-only endpoints и startup backfills;
12. зафиксируй baseline результатов typecheck/unit/e2e/build до fixes, если окружение позволяет.

Каждая найденная проблема должна иметь доказательство: файл, endpoint, воспроизводимый request/test, фактический unauthorized response, migration failure, drift или нарушение документированного invariant.

---

# 5. RBAC и authorization hardening

Проверь все backend controllers и callable service paths.

Для каждого endpoint докажи:

- authentication requirement;
- required permission/role;
- object-scope enforcement на backend;
- отсутствие доверия к role/owner/partner/customer из request body/query;
- корректный отказ для роли без разрешения;
- корректный отказ для правильной роли, но чужого объекта;
- отсутствие обхода через list/detail/update/delete/action endpoints;
- отсутствие обхода через альтернативный identifier: UUID, slug, business code, nested resource ID;
- отсутствие broad permission inheritance для BUYER/PARTNER;
- нейтральность `404` там, где `403` раскрывает существование чужого объекта.

Отдельно проверь роли минимум:

- unauthenticated;
- BUYER;
- PARTNER без approval/linkage;
- approved PARTNER;
- MODERATOR;
- OPERATOR;
- SALES_MANAGER;
- FINANCE;
- ADMIN/DIRECTOR и другие фактически существующие internal roles.

Не считай frontend route guard средством безопасности. Authoritative enforcement должен быть backend-side.

---

# 6. Object scope / IDOR / tenant isolation

Проведи cross-actor security matrix для всех реализованных Phase 1 объектов, включая фактически существующие:

- Product;
- ProductMedia;
- moderation submission/review/change proposal;
- PublicSellerProfile;
- PartnerApplication;
- CRM Customer/Partner mappings, доступные Phase 1 flows;
- PartnerStorefront;
- ProductPublicationChannel;
- Buyer Cabinet read models;
- MarketplaceBehavioralEvent;
- Storefront behavioral instrumentation;
- Order/Booking read foundations;
- Communication.

Минимальные атаки:

- Partner A читает/изменяет объект Partner B;
- Buyer A читает объект Buyer B;
- Partner угадывает internal UUID/business code;
- nested-resource substitution: parent свой, child чужой или наоборот;
- смена `partnerId/customerId/ownerId/userId` через body/query;
- доступ к чужому media через product/media ID mismatch;
- доступ к unpublished/moderation snapshot через public route;
- доступ к Storefront другого Partner через own API;
- forged context/participant в Communication;
- list/count/pagination side-channel, раскрывающий чужие записи.

Проверяй не только HTTP controller, но и service methods, которые могут вызываться из других модулей.

---

# 7. Public / Internal / Buyer / Partner boundary

Докажи разделение контуров:

## Public Marketplace

- возвращаются только разрешённые published Products;
- требуется channel `MARKETPLACE`;
- draft/rejected/pending/change-proposal/internal moderation data не видны;
- private/original media и storage internals не раскрываются;
- raw CRM Partner и Storefront contacts не сериализуются;
- Marketplace seller identity идёт только через разрешённую `PublicSellerProfile` projection;
- anti-disintermediation не ослаблен.

## Public Storefront

- доступ только при `Storefront.status = ACTIVE` и `entitlementStatus = ACTIVE`;
- Product должен иметь `PARTNER_STOREFRONT` channel и принадлежать Storefront Partner;
- Storefront business contacts не становятся Marketplace contacts;
- disabled/suspended/expired Storefront не раскрывается через list, detail, slug, PDP или SEO metadata;
- raw CRM/ORM entities не сериализуются.

## Buyer

- только собственный профиль и собственные разрешённые read models;
- controlled-empty Payments/Documents/Support остаются controlled empty;
- нет broad internal CRM/Order/Booking/Finance permissions;
- own Communication не раскрывает NOTE/INTERNAL, actor и trace internals.

## Partner

- только собственные Products/media/moderation/storefront;
- selling access зависит от утверждённого onboarding/linkage;
- internal `/app/*` permissions не выдаются автоматически;
- Partner Cabinet не превращается во внутренний CRM/Finance/Moderation workspace.

## Internal

- internal projections не доступны через public/Buyer/Partner aliases;
- sensitive actions имеют явные permissions;
- MODERATOR не получает право редактировать Product за Partner, если это запрещено canonical workflow.

---

# 8. DTO, validation и mass assignment

Для всех write endpoints проверь:

- global production ValidationPipe соответствует e2e configuration;
- whitelist/transform/forbid semantics согласованы;
- ownership/security/lifecycle aliases не игнорируются молча;
- client не может передать server-owned поля;
- nested DTO действительно валидируются;
- unknown enum/value/empty IDs/invalid UUID rejected consistently;
- query pagination limits enforced;
- response DTO не является raw Prisma/entity serialization;
- ошибки не echo request body, secrets, contacts или PII;
- frontend не зависит от полей, которые backend не обещает contract-ом.

Server-owned поля минимум:

- IDs/business codes;
- actor/createdBy/owner/customer/partner authority fields;
- lifecycle status и milestone timestamps, кроме явно разрешённой команды перехода;
- moderation decision fields;
- entitlement authority;
- publication/acquisition authority;
- requestId/correlationId/causationId;
- audit/event metadata.

---

# 9. Lifecycle и state-transition hardening

Проверь реальные transition matrices и negative paths для:

- Product lifecycle;
- moderation workflow;
- PartnerApplication;
- PartnerStorefront lifecycle;
- entitlement/public visibility interaction;
- Order/Booking существующих Phase 1 foundations;
- Communication current lifecycle contract.

Докажи:

- недопустимые переходы rejected;
- повторные команды имеют определённую semantics;
- concurrent transitions не приводят к lost update/double action;
- material change published Product снова проходит требуемый moderation path;
- lifecycle status не подменяет publication channel;
- current Product publication не используется для ретроспективного определения acquisition source;
- reserved states без producer честно документированы и не объявлены рабочим flow.

Если для исправления требуется изменить canonical lifecycle — `ARCHITECTURE DECISION REQUIRED`.

---

# 10. Temporal, events, audit и traceability

Проверь соответствие утверждённым Step 1.13A, 1.13B, 1.14 и 1.15.

## Temporal

- `createdAt` означает создание entity;
- `updatedAt` не используется как business milestone;
- фактические lifecycle timestamps записываются в момент перехода;
- historical unknown остаётся `NULL`, а не fake backfill;
- `occurredAt` server-authoritative там, где client authority не предусмотрена;
- UTC используется для system timestamps;
- service date/time не смешивается с entity creation time.

## Events

- behavioral events не смешиваются с domain events и AuditLog;
- canonical Order events сохранены: `OrderReadyForBooking`, `OrderFulfilled`, `OrderClosed`;
- generic `OrderStatusChanged` не подменяет canonical business semantics;
- `BookingRequested` остаётся command event;
- нет placeholder events без producer/consumer contract;
- payload не содержит лишние PII/raw entities.

## Trace

- root HTTP `correlationId` всегда server-generated;
- client `X-Request-Id` может быть только diagnostic echo согласно ADR-0009;
- одинаковый client request ID не объединяет независимые causal chains;
- consumer invocation получает новый requestId, наследует correlationId и использует parent eventId как causationId;
- audit/log/event/outbox trace не принимает authority из request body;
- retry не создаёт duplicate business facts там, где flow уже существует.

---

# 11. Marketplace / Storefront isolation

Повторно докажи ключевые архитектурные invariants:

- Marketplace = commission-oriented marketplace channel;
- Storefront = отдельный SaaS contour;
- один canonical Product, без копирования для Storefront;
- `ProductPublicationChannel` отделён от Product lifecycle;
- publication channel отделён от acquisition source;
- `PublicSellerProfile` остаётся Marketplace identity;
- Storefront business identity/contacts принадлежат Storefront projection;
- Marketplace не раскрывает Storefront contacts даже если Partner использует оба канала;
- наличие Product в TravelHub не делает Storefront sale Marketplace sale;
- entitlement не подменяется простым существованием Storefront record;
- Billing/Subscription не реализуются в Step 1.17.

Добавь отрицательные e2e tests на наиболее опасные cross-channel leakage paths, если их нет.

---

# 12. Behavioral instrumentation safety

Для Marketplace и Storefront behavioral endpoints проверь:

- allowed event taxonomy;
- server-authoritative source/channel;
- entity existence/visibility policy;
- anonymous/authenticated session handling;
- невозможность forged Partner/storefront/acquisition attribution;
- rate/size bounds в пределах существующей инфраструктуры;
- отсутствие body/contacts/tokens/raw request payload в telemetry;
- отсутствие cross-channel смешения;
- отсутствие создания Order/Sale/Lead из behavioral event;
- pagination/retention/internal-read exposure, если такие API существуют.

Не создавай полноценную analytics platform.

---

# 13. Communication regression after Step 1.16

Не переписывай Communication. Повторно докажи сохранность review fixes:

- `CML-*` server-only, unique и concurrency-safe;
- actor server-derived;
- SYSTEM нельзя подделать через HTTP;
- direction↔participant policy enforced;
- participant↔context consistency enforced;
- CUSTOMER/PARTNER/ORDER/BOOKING existence не заменяет authorization;
- Buyer/Partner не имеют create permission;
- NOTE/INTERNAL скрыты из list/detail/count/pagination;
- guessed code даёт neutral 404;
- body/subject не попадают в AuditLog/Outbox/logs/errors/behavioral events;
- `occurredAt = createdAt = server now` для текущего PLATFORM flow;
- нет Support/Chat/Notification/attachments/read receipts/external channels;
- нет `CommunicationCreated` без утверждённого consumer.

Повтори параллельный тест минимум на 20 create и отрицательную security matrix.

---

# 14. Migrations, database safety и reproducibility

Обязательно выполнить:

1. проверку migration status;
2. проверку schema/migration drift;
3. clean database migration replay с нуля;
4. запуск test DB только в изолированной БД;
5. проверку destructive-run guards;
6. проверку отсутствия `db push` как production migration strategy;
7. проверку отсутствия startup backfills/reconciliation по догадкам;
8. проверку additive/non-destructive nature новых fixes;
9. проверку unique/index/FK semantics против реальных read/write patterns;
10. проверку seeds на отсутствие production data mutation и permission escalation.

Нельзя изменять уже применённую migration, если repository policy требует новую migration. Не удаляй пользовательские или legacy данные для получения зелёного теста.

---

# 15. Pagination, filtering, sorting и error model

Проверь все list/search/queue endpoints:

- server-side pagination;
- разумный hard cap page size;
- deterministic ordering с tie-breaker;
- filters применяются до count;
- `total/hasMore` считаются по тому же authorized/visible dataset;
- public filters не дают доступ к internal states;
- invalid query возвращает стабильный 4xx, не 500;
- empty result отличается от unauthorized только согласно security policy;
- business codes/slugs/UUID обрабатываются последовательно;
- внутренние exception messages/stack/SQL/paths не раскрываются клиенту.

Если в repository существует canonical error envelope, приведи обнаруженные локальные отклонения к нему без глобального redesign.

---

# 16. Media/storage security

Проверь существующий ProductMedia flow:

- private-by-default;
- original/large/thumb visibility соответствует contract;
- upload content type, size и image processing validation;
- object key/path traversal protection;
- bucket/test-bucket isolation;
- Partner ownership inheritance от Product;
- orphan upload/delete behavior;
- public media только для разрешённого published Product и channel context;
- signed/internal storage details не утекают в public DTO/logs/errors;
- удаление/замена media не позволяет затронуть чужой объект.

Не внедряй новый media product или CDN architecture.

---

# 17. Frontend hardening и production verification

Проверь фактические frontend routes/layouts/API clients:

- `/` и public marketplace routes не используют internal API;
- `/products/:slug` следует public contract;
- `/store/:slug` и Storefront PDP соблюдают entitlement/channel visibility;
- `/account/*`, `/partner/*`, `/app/*` разделены;
- unauthorized role не получает скрытую страницу через прямой URL;
- frontend guard не считается заменой backend authorization;
- loading/error/empty states не раскрывают internal information;
- SEO metadata не раскрывает disabled Storefront/unpublished Product;
- контакты Storefront не появляются в Marketplace components;
- production environment API base URL и ValidationPipe semantics совпадают с tested path;
- typecheck, component/unit tests и production build проходят.

Проведи runtime smoke по production-like startup, а не только test harness.

---

# 18. Обязательная security/e2e matrix

Создай или дополни автоматизированные тесты минимум для следующих классов:

1. anonymous → public allowed/forbidden routes;
2. anonymous → Buyer/Partner/Internal routes denied;
3. Buyer A → Buyer B object denied;
4. Partner A → Partner B Product/media/storefront denied;
5. unapproved Partner → selling operations denied;
6. MODERATOR → Partner Product mutation denied;
7. public → unpublished/rejected/internal moderation data denied;
8. Marketplace → Storefront contacts leakage absent;
9. disabled/non-entitled Storefront → public access denied;
10. Product without required channel → corresponding public surface denied;
11. mass assignment of actor/owner/status/timestamps/trace rejected;
12. guessed UUID/business code/slug does not leak unauthorized existence;
13. list/count/pagination respects scope;
14. concurrent lifecycle action/sequence creation remains consistent;
15. behavioral attribution cannot be client-forged;
16. reused client request ID does not merge root correlation;
17. Communication R1–R5 and 20-way concurrency remain green;
18. clean migration replay and boot create no guessed business data.

Используй реальные endpoint calls и real DB там, где это требуется для доказательства. Mocks не являются достаточным доказательством migration, RBAC/IDOR или concurrency.

---

# 19. Выполнение тестов

После fixes запусти в фактической структуре repository:

- backend typecheck/compile;
- все backend unit tests;
- полный backend e2e suite последовательно, если parallel mode создаёт недостоверные DB races;
- targeted concurrency tests;
- migration status;
- clean migration replay;
- drift check;
- backend production-like boot и HTTP smoke;
- frontend typecheck;
- все frontend unit/component tests;
- production frontend build;
- targeted browser/runtime smoke, если существующая инфраструктура проекта это поддерживает.

Не сообщай `all tests passed`, если часть suite была skipped, не запускалась или завершилась из-за timeout. Укажи точные команды, количество suites/tests, pass/fail/skipped и ограничения окружения.

Не убивай чужие процессы и не очищай общую dev database. Для runtime используй отдельный порт и изолированные данные. Удали только созданные тобой smoke-данные безопасным scoped способом.

---

# 20. Работа с найденными проблемами

Для каждой проблемы классифицируй:

- `CRITICAL` — unauthorized write/read, cross-tenant leak, credential/PII leak, destructive migration, authority spoofing;
- `HIGH` — существенный lifecycle/trace/publication/entitlement bypass;
- `MEDIUM` — contract inconsistency, unsafe pagination/error/missing negative test с реальным риском;
- `LOW` — локальная documentation/test clarity проблема без runtime bypass.

Исправляй подтверждённые локальные проблемы в рамках Step 1.17.

Не исправляй молча фундаментальные противоречия. Для них сформируй отдельный блок:

`ARCHITECTURE DECISION REQUIRED`

с вариантами, последствиями и указанием затронутых ADR/contracts, после чего остановись до решения.

---

# 21. Документация

После реализации:

- обнови только фактически затронутые ADR/contracts;
- зафиксируй hardening invariants и подтверждённые limitations;
- добавь новые deferred decisions только при реальной необходимости;
- синхронизируй canonical status: Step 1.16 approved after review fixes; Step 1.17 implementation completed/waiting strict review — только если все обязательные проверки завершены;
- не ставь Step 1.17 `APPROVED`: APPROVAL даётся отдельным Strict Review;
- не ставь Step 1.18 выполненным и не начинай его.

Документация не заменяет runtime enforcement.

---

# 22. Definition of Done

Implementation Step 1.17 может завершиться только если:

1. проведена полная инвентаризация Phase 1;
2. подтверждённые локальные defects исправлены;
3. нет известных открытых CRITICAL/HIGH security issues в scope;
4. RBAC/object-scope/IDOR matrix автоматизирована;
5. Marketplace/Storefront isolation доказана отрицательными тестами;
6. DTO/mass-assignment/privacy boundaries проверены;
7. lifecycle/temporal/events/trace invariants сохранены;
8. Step 1.16 regression полностью зелёная;
9. migrations clean replay и drift check прошли;
10. backend compile/unit/full e2e прошли;
11. frontend typecheck/tests/production build прошли;
12. production-like runtime smoke прошёл;
13. документация отражает фактическое состояние;
14. Phase 2/Step 1.18 не начаты;
15. сформирован доказательный отчёт для последующего независимого Strict Review.

Если обязательная проверка невозможна из-за окружения, не объявляй completion. Укажи точный blocker, уже выполненные проверки и воспроизводимые команды для продолжения.

---

# 23. Обязательный формат итогового отчёта

Верни отчёт строго со следующими разделами:

1. **Verdict** — `IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`, `PARTIALLY COMPLETED / BLOCKED` или `ARCHITECTURE DECISION REQUIRED`.
2. **Repository baseline** — branch/commit, dirty files до работы, environment.
3. **Sources inspected** — документы, ADR, modules, schema/migrations.
4. **Phase 1 inventory** — endpoints, roles, public/internal surfaces, models/events.
5. **Threat model and test matrix**.
6. **Confirmed findings** — severity, reproduction, affected invariant.
7. **Fixes implemented** — по каждому finding, файлы и semantics.
8. **RBAC results**.
9. **IDOR/tenant-scope results**.
10. **Public/Buyer/Partner/Internal boundary results**.
11. **Marketplace/Storefront isolation results**.
12. **DTO/mass-assignment/error/privacy results**.
13. **Lifecycle/temporal/events/trace results**.
14. **Communication regression results**.
15. **Media/storage results**.
16. **Migration/replay/drift results**.
17. **Frontend/build/runtime results**.
18. **Exact automated test results** — команды, suites/tests, pass/fail/skipped.
19. **Runtime verification** — endpoints/scenarios/status codes.
20. **Documentation/ADR changes**.
21. **Deferred decisions / accepted limitations**.
22. **Remaining debt** — severity и почему не является скрытым blocker.
23. **Architecture decision status**.
24. **Out-of-scope confirmation**.
25. **Files changed**.

В конце используй ровно один итоговый маркер:

`PHASE 1 STEP 1.17 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

или

`PHASE 1 STEP 1.17 IMPLEMENTATION BLOCKED`

или

`ARCHITECTURE DECISION REQUIRED`

Не объявляй Step 1.17 APPROVED самостоятельно. После implementation report будет сформирован отдельный независимый Strict Review prompt.
