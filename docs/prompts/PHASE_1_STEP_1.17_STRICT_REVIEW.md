# PHASE 1 — STEP 1.17 — STRICT REVIEW

## 0. Роль и режим

Проведи независимый строгий review уже выполненного:

**PHASE 1 — STEP 1.17 — HARDENING / SECURITY / REGRESSION**

Implementation report считать только заявлением исполнителя, но НЕ доказательством.

Твоя задача — независимо проверить фактический repository, schema, migrations, permissions, routes, DTO, guards, services, tests, runtime и docs и определить:

- `APPROVE`;
- `REVIEW FIX REQUIRED`;
- `ARCHITECTURE DECISION REQUIRED`.

Не переходить к:
- Step 1.18;
- Step 1.18A;
- Phase 2.

Если находишь локальный подтверждённый дефект — исправить его как review-fix, добавить targeted regression и повторить full regression.

Если исправление требует изменения bounded-context ownership, canonical lifecycle, commercial model, communication participant policy, cross-domain contract или другой фундаментальной архитектуры — остановиться с:

`ARCHITECTURE DECISION REQUIRED`

---

# 1. Не доверять implementation report

Не принимать как доказательство заявления:

- «все endpoint защищены»;
- «IDOR отсутствует»;
- «public DTO safe»;
- «No difference detected»;
- «tests green»;
- «нет PII leak»;
- «нет N+1»;
- «нет direct DB bypass»;
- «нет startup backfill».

Проверить фактический код и воспроизвести критические security paths самостоятельно.

---

# 2. Repository baseline

Зафиксировать:

- branch/commit;
- git status;
- dirty/untracked files;
- Prisma migration state;
- standard backend/frontend start commands;
- test DB isolation.

Не изменять unrelated user files.

---

# 3. Sources of truth

Прочитать:

- `TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`;
- Master Plan;
- ADR-0001…ADR-0011;
- `contracts/api.md`;
- `contracts/events.md`;
- `ids.md`;
- `temporal-readiness.md`;
- Deferred Decisions Map;
- Prisma schema;
- all migrations;
- Security permission registry/seed/reconciliation;
- backend/frontend route trees.

Если docs и code расходятся — установить factual behavior и зафиксировать conflict.

---

# 4. Phase 1 cross-domain inventory

Построить фактическую карту:

- domains/schemas;
- roles;
- permissions;
- public routes;
- Buyer routes;
- Partner routes;
- internal routes;
- Product/Storefront/Seller/Buyer/Communication/Order/Booking objects;
- domain events;
- behavioral events;
- AuditLog;
- Outbox/Inbox;
- request/correlation/causation;
- lifecycle/temporal fields.

Проверить, что Step 1.17 implementation ничего не «пропустил» из Phase 1.

---

# 5. Authentication boundaries

Независимо проверить:

- anonymous → public allowed;
- anonymous → Buyer denied;
- anonymous → Partner denied;
- anonymous → internal denied;
- BUYER → `/partner/*` denied;
- BUYER → internal denied;
- PARTNER → `/account/*` semantics;
- PARTNER → internal denied;
- internal role → Buyer/Partner own-contract only where allowed;
- safe login `next` / no open redirect;
- logout invalidates protected access.

Проверить backend authority, а не только frontend routing.

---

# 6. RBAC matrix — CRITICAL

Составить role→permission matrix минимум для:

- BUYER;
- PARTNER;
- MODERATOR;
- OPERATOR;
- SALES_MANAGER;
- FINANCE;
- MARKETER;
- ANALYST;
- ADMIN;
- DIRECTOR;
- иных фактически существующих ролей.

Проверить:

- stale grants;
- stale permissions;
- seed/reconciliation revoke;
- accidental broad internal access BUYER/PARTNER;
- ADMIN/ALL_PERMISSIONS не обходит explicit own-role contracts;
- transition/read/write rights separated where intended.

Если report утверждает «все контроллеры @RequirePermissions», проверить реально каждый controller.

---

# 7. Object scope / IDOR — CRITICAL

Повторно выполнить cross-actor attack matrix для:

- Product;
- ProductMedia;
- ProductDraft;
- moderation submission;
- change proposal;
- seller identity;
- PartnerApplication;
- PartnerStorefront;
- StorefrontMedia;
- publication channels;
- Buyer profile/orders/bookings;
- CRM Customer/Partner accessible endpoints;
- Communication;
- Order/Booking foundations;
- preview;
- behavioral ingestion.

Обязательные сценарии:

- Partner A → object Partner B;
- Buyer A → object Buyer B;
- parent own + child foreign;
- parent foreign + child own;
- guessed UUID;
- guessed business code;
- guessed slug;
- forged owner field;
- forged query field;
- valid foreign object with legitimate ID;
- internal role with insufficient object authority.

Existence check не считать authorization.

---

# 8. Internal object-scope review

Implementation report мог сфокусироваться на Buyer/Partner IDOR.

Отдельно проверить internal roles:

- может ли MODERATOR читать/изменять больше, чем moderation contract;
- может ли OPERATOR создавать/изменять объект вне intended domain;
- может ли SALES_MANAGER получить Partner/Customer scope шире policy;
- может ли FINANCE видеть non-finance private data;
- может ли ANALYST/MARKETER читать PII через broad list/detail endpoints.

RBAC permission presence ≠ object authorization.

---

# 9. Mass assignment / forged authority — CRITICAL

Repo-wide найти write DTO/body keys.

Проверить aliases:

- id;
- code;
- partnerId;
- customerId;
- ownerId;
- userId;
- actorUserId;
- createdById;
- status;
- entitlementStatus;
- publication channels;
- acquisitionSource;
- occurredAt;
- createdAt/updatedAt;
- reviewedBy/approvedBy;
- requestId;
- correlationId;
- causationId.

Нужно проверить не только documented exact names, но и alternative aliases that DTO may accept/strip.

Security-sensitive fields должны либо server-derive, либо reject deterministically.

---

# 10. Product partnerId special case

Implementation report считает `CreateProductDto.partnerId` non-issue, потому что PARTNER scope игнорирует body и staff override разрешён.

Независимо проверить:

- PARTNER не может выбрать другого partnerId;
- MODERATOR не может create Product for arbitrary partner, если contract этого не разрешает;
- staff roles, которым разрешён override, действительно имеют explicit permission/business purpose;
- Partner existence check не заменяет authorization;
- ProductHistory audit actor + assigned partner корректны;
- no invisible privilege escalation через staff create.

Если staff override слишком широкий — REVIEW ISSUE.

---

# 11. Public Marketplace DTO leak test

На реальном response проверить raw JSON.

Не должно быть:

- partnerId;
- customerId;
- userId;
- entitlementStatus;
- Storefront contact data;
- raw CRM fields;
- moderation internals;
- storage keys;
- draft/change proposal;
- audit actor;
- request/correlation IDs;
- hidden lifecycle fields.

Проверить:

- list;
- search;
- category;
- PDP;
- media;
- seller projection.

---

# 12. Marketplace authenticated-request equivalence

Независимо проверить один и тот же public product:

1. anonymous;
2. authenticated BUYER;
3. authenticated PARTNER/internal caller, если public route accepts auth header.

Public projection и visibility не должны расширяться от наличия authenticated context.

Если optional auth меняет public fields без documented contract — REVIEW ISSUE.

---

# 13. Marketplace ↔ Storefront isolation — CRITICAL

Создать/использовать Partner с:

- Product MARKETPLACE only;
- Product STOREFRONT only;
- Product BOTH;
- active entitled Storefront;
- structured contacts.

Проверить:

Marketplace:
- MARKETPLACE-only visible;
- STOREFRONT-only invisible;
- BOTH visible;
- no Storefront contacts.

Storefront:
- MARKETPLACE-only invisible;
- STOREFRONT-only visible;
- BOTH visible;
- structured Storefront contacts allowed.

Проверить search, PDP, product list, SEO metadata, media.

---

# 14. Storefront public predicate

Проверить все состояния:

- DRAFT;
- ACTIVE+NONE;
- ACTIVE+ACTIVE;
- ACTIVE+SUSPENDED;
- ACTIVE+EXPIRED;
- INACTIVE+ACTIVE.

Для каждого:
- home;
- products;
- PDP;
- media;
- SEO metadata;
- behavioral event acceptance.

Все непубличные состояния должны иметь consistent neutral behavior.

---

# 15. Storefront preview isolation

Проверить:

- owner preview allowed;
- foreign Partner preview denied/neutral;
- anonymous denied;
- preview не делает Storefront public;
- staged/private media owner-only;
- preview не генерирует behavioral public events;
- preview URL нельзя использовать как public media oracle.

---

# 16. Seller identity / anti-disintermediation — CRITICAL

Попробовать обойти policy через:

- Product title;
- Product description;
- attributes;
- tariff text;
- media metadata;
- seller display name;
- Storefront fallback identity;
- RU/AZ/EN variants;
- whitespace/Unicode obfuscation;
- URL/contact-like forms where current validator claims protection.

Не расширять policy beyond current contract, но доказать, что Storefront presence не ослабляет Marketplace boundary.

---

# 17. Buyer Cabinet hardening

Проверить:

- Buyer A own profile;
- Buyer A Order/Booking own;
- Buyer B hidden;
- forged `customerId`;
- query/body alias;
- internal fields absent;
- Payments/Documents/Support controlled-empty;
- no synthetic timeline;
- counters own-scoped;
- one failed counter does not break whole overview;
- deep link and role redirects.

---

# 18. Partner Cabinet hardening

Проверить:

- unapproved Partner cannot use selling operations;
- approved Partner own only;
- Product/media/storefront/seller-profile channels own-scoped;
- Partner cannot entitlement-manage;
- Partner cannot access internal CRM/moderation/workspace;
- foreign partner guessed IDs fail neutrally where appropriate.

---

# 19. Communication strict regression — CRITICAL

Step 1.16 была сложной security-зоной. Повторить отдельно:

- CML code server-only;
- 20+ concurrent create unique;
- actor server-derived;
- SYSTEM via normal HTTP rejected;
- direction↔participant policy;
- participant↔context consistency;
- unauthorized existing context rejected;
- Buyer/Partner create denied;
- NOTE hidden;
- INTERNAL hidden;
- hidden rows excluded from `total/hasMore`;
- guessed CML neutral 404;
- own scope limited exactly as documented;
- body absent from AuditLog;
- body absent from Outbox/Inbox;
- body absent from logs/error responses;
- no `CommunicationCreated` placeholder;
- no Support/Ticket/Chat creep.

Особенно проверить OPERATOR/SALES_MANAGER ability to impersonate external sender in unrelated context.

---

# 20. Order canonical events

Проверить независимо:

- `OrderReadyForBooking`;
- `OrderFulfilled`;
- `OrderClosed`;
- `BookingRequested`.

Обязательные:
- canonical transitions create canonical events;
- technical transition uses generic only where expected;
- retry no duplicate;
- concurrent confirm/complete/close no duplicate;
- reconcile vs complete no duplicate fulfillment;
- cancel != fulfill != close;
- event/history/state atomic.

---

# 21. BusinessEventEnvelope / Step 1.15A factual state

Implementation report говорит Step 1.15A есть. Проверить code/schema/ADR/tests.

Проверить envelope:

- eventId;
- eventType;
- occurredAt;
- correlationId;
- causationId;
- actor;
- entityId/entityType;
- payload;
- immutability.

Если Step 1.15A на деле частично отсутствует — не реализовывать hiddenly; report mismatch = review finding.

---

# 22. Event PII audit — CRITICAL

Repo-wide проверить payloads фактически.

Особенно:
- BookingRequested;
- CustomerCreated/Updated;
- PartnerCreated;
- Order events.

Убедиться, что после 1.15A review fixes нет:
- passport/traveler snapshots;
- email unnecessarily;
- contactEmail/registrationNumber;
- raw CRM;
- Communication body.

Проверить и Outbox, и Inbox persistence.

---

# 23. Correlation / request trust model

Повторить attack:

- same client `X-Request-Id` reused in two independent requests;
- invalid;
- oversized;
- duplicate headers;
- forged `X-Correlation-Id`;
- 50+ parallel requests.

Доказать:
- requestId may echo diagnostic client UUID;
- root correlationId server-generated and distinct;
- independent operations separate;
- ALS no cross-request leak;
- child event inherits correlation;
- causation = parent eventId.

---

# 24. AuditLog anti-spoofing

Проверить:

- caller cannot override `details.correlation`;
- server correlation wins;
- no raw body;
- no token/password;
- no Communication body;
- no Storefront contact leakage unless explicitly safe metadata;
- no duplicate business event payload dump.

---

# 25. Behavioral event hardening — Marketplace

Проверить:

- valid event accepted;
- invalid enum rejected;
- forged acquisitionSource rejected;
- forged productId/categoryId rejected;
- STOREFRONT-only product neutral drop;
- draft/archived product neutral drop;
- unknown product neutral drop;
- eventId dedup;
- occurredAt skew;
- sessionId bounds;
- no contact/PII;
- no AuditLog;
- no Outbox;
- no publication-state mutation.

---

# 26. Behavioral event hardening — Storefront

Проверить:

- public predicate reused;
- inactive/non-entitled neutral drop;
- contact click stores contactType, not value;
- preview disabled;
- no Authorization requirement assumption; instead test same safe resource semantics with/without optional auth header;
- dedup;
- no AuditLog/Outbox;
- no raw contact values.

---

# 27. Temporal integrity — CRITICAL

Сверить `temporal-readiness.md` с code.

Проверить:

- legacy NULL remains NULL;
- no fake startup repair timestamps;
- Category.createdAt legacy unknown remains null;
- CategorySchema activatedAt/deprecatedAt lifecycle only;
- Product publishedAt not rewritten;
- Storefront lifecycle timestamps real;
- moderation timestamps real;
- behavioral occurredAt vs receivedAt;
- business event occurredAt semantics honest;
- `serviceDate` not treated as UTC lifecycle instant.

Добавить automated no-fabrication proof if any gap exists.

---

# 28. ValidationPipe equivalence

Не полагаться на report.

Сверить:
- `main.ts`;
- shared options;
- all e2e bootstraps.

Проверить:
- no `enableImplicitConversion`;
- nested arrays category schemas;
- query/param explicit conversion;
- forbidden raw-body validation still sees dangerous keys.

---

# 29. Error model

Targeted runtime/e2e:

- 400 malformed;
- 401;
- 403;
- neutral 404;
- 409;
- 422;
- forced/unexpected 500.

Проверить:
- body shape;
- `X-Request-Id`;
- body requestId == header;
- no stack;
- no Prisma SQL/internal path;
- no raw sensitive input.

---

# 30. Prisma unique conflict normalization

Implementation report упомянул P2002 historical issue.

Repo-wide найти race-prone creates:
- category;
- storefront partnerId;
- slug;
- business code/sequences where applicable.

Проверить expected unique race → controlled 409/expected error, не 500.

Не ограничиваться pre-check (`findUnique`) как единственной защитой race.

---

# 31. Pagination side-channel audit — CRITICAL

Для own/public/hidden datasets проверить:

- list predicate == count predicate;
- hidden NOTE not counted;
- hidden products not counted;
- foreign tenant records not counted;
- pagination after scope, not before;
- deterministic tie-break;
- oversized pageSize bounded;
- invalid negative/NaN;
- filters cannot probe internal states.

Проверить минимум:
- Marketplace search/list/category;
- Storefront products;
- Communication own;
- moderation queue;
- Partner lists;
- Buyer read models if paginated.

---

# 32. Filter / sort injection

Проверить:
- raw sort field cannot map arbitrary ORM property;
- invalid enum/filter keys;
- query values length;
- Prisma raw SQL parameterized;
- no user-controlled SQL fragment;
- no prototype/object path issue in dynamic filter builder.

---

# 33. Media/storage security — CRITICAL

Проверить upload actual content, not only declared MIME:

- JPEG/PNG/WebP;
- fake MIME;
- malformed image;
- SVG;
- oversized;
- huge dimensions/decompression bomb;
- staged vs published;
- foreign media ID;
- product/media mismatch;
- signed preview TTL;
- storageKey not public;
- delete/replace foreign media forbidden.

StorefrontMedia тоже проверить отдельно, если implementation differs from ProductMedia.

---

# 34. XSS / unsafe URL

Repo-wide:
- `dangerouslySetInnerHTML`;
- raw HTML;
- `javascript:`;
- unsafe `data:`;
- target blank without noopener/noreferrer;
- Communication subject/body rendering;
- Product/Storefront text rendering;
- structured contact URLs.

Не создавать новый sanitizer architecture, но локальные unsafe paths исправить.

---

# 35. Seed / startup / reconciliation audit — CRITICAL

Проверить все production-reachable:

- `onModuleInit`;
- role seed;
- canonical category seed;
- repair services;
- startup listeners;
- Storefront/CML provisioning.

После normal boot не должно появляться:
- synthetic Storefront;
- synthetic Communication;
- fake temporal values;
- entitlement activation;
- duplicate channels;
- unexpected permissions;
- historical business events.

Сделать automated or isolated DB proof.

---

# 36. Direct write bypass audit

Repo-wide классифицировать все:
- `prisma.*.create/update/updateMany/delete`;
- raw SQL;
- scripts.

Проверить production bypass:
- Order status direct write;
- Booking status direct write;
- Product publish direct write;
- Storefront lifecycle direct write;
- Communication actor/context direct write;
- Outbox canonical writer bypass.

Test fixtures/migrations/legacy scripts не считать runtime issue без evidence.

---

# 37. Migration chain review — CRITICAL

Не ограничиваться `migrate status`.

Проверить:

1. file history/checksum if possible;
2. clean replay from empty DB;
3. schema diff;
4. all 21 migrations order;
5. enum evolution;
6. schema creation order;
7. backfills;
8. unique/index creation;
9. no historical `NOW()` fabrication;
10. no cross-schema FK violation;
11. migration works without dev seed/state.

Если applied historical migration был изменён — не переписывать молча; document + forward remediation.

---

# 38. Database indexes / obvious performance

Проверить actual query plans/queries only for obvious hot paths:

- public products;
- storefront products;
- behavioral event writes/analytics-ready lookup;
- Communication own list;
- moderation queue.

Ищи только clear issues:
- unbounded query;
- N+1;
- missing obvious composite index;
- count/list mismatch;
- full relation fetch.

Не вводить cache/warehouse.

---

# 39. Frontend security/runtime

Browser/runtime independently:

- anonymous Marketplace;
- Product PDP;
- Storefront;
- disabled Storefront;
- Buyer account;
- Partner cabinet;
- internal shell;
- direct URL wrong role;
- locale RU/AZ/EN;
- deep-link login;
- logout;
- no console errors;
- no private data in DOM/network;
- no Storefront contacts on Marketplace.

---

# 40. Marketplace PDP SEO debt validation

Implementation report оставил Marketplace PDP SEO metadata gap как LOW cosmetic.

Проверить, что это действительно:
- SEO-only;
- no private-state leak;
- no wrong canonical causing security/privacy or cross-channel identity issue.

Если только SEO — оставить debt.
Если canonical metadata exposes wrong Storefront/contact/unpublished state — это review finding.

---

# 41. Communication retention debt classification

Report классифицирует PII/retention как MEDIUM non-blocker.

Проверить factual current exposure:

- body PII-capable;
- DB access internal only;
- no public/read leak;
- no log/outbox duplication;
- no delete/archive endpoint.

Если отсутствие retention само по себе не создаёт immediate security bypass, оставить deferred.
Если body доступен роли/endpoint шире intended — это blocker независимо от retention.

---

# 42. Runtime verification

Не считать implementation smoke достаточным.

Повторить independently на isolated instance/DB data:

- public product response;
- authenticated public response;
- Buyer protected request;
- Partner protected request;
- internal protected request;
- IDOR attempt;
- Storefront entitlement boundary;
- Communication spoof attempt;
- error requestId;
- event lineage;
- behavioral neutral drop;
- no startup fabricated rows.

Не мутировать shared dev data.

---

# 43. Full regression

После review fixes (или без fixes) запустить:

### Backend
- `npx tsc --noEmit`;
- all unit;
- all e2e serial;
- targeted hardening tests;
- targeted concurrency tests.

### Frontend
- `npx tsc --noEmit`;
- all vitest;
- production build.

### DB
- migrate status;
- clean replay;
- diff/no drift.

Не считать skipped/timeouts passed.

---

# 44. Review finding severity

Каждый finding:

### CRITICAL
- unauthorized read/write;
- cross-tenant leak;
- PII/credential leak;
- authority spoof;
- destructive migration/data corruption.

### HIGH
- lifecycle/event/idempotency bypass;
- public/private/channel/entitlement bypass;
- security-relevant migration defect.

### MEDIUM
- pagination/count leak;
- error/internal disclosure;
- validation contract gap;
- observability/security robustness defect.

### LOW
- documentation/test robustness/cosmetic non-security issue.

Для каждого:
- reproduction;
- root cause;
- affected invariant;
- fix;
- tests;
- regression.

---

# 45. Approval criteria

Step 1.17 можно APPROVE только если после независимого review:

- нет открытых CRITICAL/HIGH issues;
- RBAC/object scope доказаны;
- public/private/Marketplace/Storefront boundaries доказаны;
- Communication Step 1.16 fixes устойчивы;
- mass assignment закрыт;
- temporal/event/trace contracts сохранены;
- PII не течёт в public/log/audit/event payload;
- pagination/count не раскрывают hidden records;
- error model safe;
- migration replay clean/no drift;
- critical concurrency/idempotency safe;
- frontend build/runtime green;
- implementation report materially подтверждён.

---

# 46. Если найдены fixes

Исправить только локальные подтверждённые defects в scope 1.17.

После fix:
- targeted regression;
- full regression;
- runtime verification if relevant.

Итоговый статус:

`PHASE 1 STEP 1.17 REVIEW FIXES COMPLETED — WAITING FOR APPROVAL`

Не переходить к 1.18.

---

# 47. Architecture decision triggers

Вернуть:

`ARCHITECTURE DECISION REQUIRED`

если для исправления нужно:

- изменить bounded-context owner;
- изменить Marketplace vs Storefront commercial model;
- изменить canonical Product/Order/Booking lifecycle;
- расширить Partner CRM model;
- изменить Communication participant/authorization policy фундаментально;
- создать Support/Chat/Notification domain;
- изменить external client correlation authority;
- ввести новый cross-domain synchronous write;
- разрушительно мигрировать legacy/historical data;
- принять новую product-level privacy/retention policy как обязательную для runtime.

---

# 48. Формат итогового отчёта

Вернуть:

# PHASE 1 — STEP 1.17 — STRICT REVIEW — ОТЧЁТ

1. Verdict
2. Repository baseline
3. Sources inspected
4. Independent Phase 1 inventory
5. Authentication review
6. RBAC review
7. IDOR/object-scope review
8. Internal-role object-scope review
9. Mass-assignment review
10. Product partner override review
11. Public Marketplace DTO review
12. Authenticated public equivalence
13. Marketplace↔Storefront isolation
14. Storefront public predicate
15. Storefront preview
16. Seller identity/anti-disintermediation
17. Buyer Cabinet
18. Partner Cabinet
19. Communication strict regression
20. Order canonical events
21. BusinessEventEnvelope
22. Event PII audit
23. Request/correlation/causation
24. AuditLog anti-spoofing/privacy
25. Marketplace behavioral events
26. Storefront behavioral events
27. Temporal integrity
28. ValidationPipe/DTO
29. Error model
30. Unique-conflict/race handling
31. Pagination side channels
32. Filter/sort/injection
33. Media/storage
34. XSS/unsafe URL
35. Seed/startup/reconciliation
36. Direct-write bypass
37. Migration-chain review
38. DB indexes/performance
39. Frontend/runtime security
40. Marketplace PDP SEO debt
41. Communication retention debt
42. Runtime verification
43. Unit test results
44. E2E test results
45. Frontend test/build results
46. Migration/drift results
47. Findings/fixes with severity
48. Remaining debt
49. Docs/ADR changes
50. Architecture decision status
51. Out-of-scope confirmation

Если review прошёл без fixes:

`PHASE 1 STEP 1.17 STRICT REVIEW PASSED — WAITING FOR APPROVAL`

Если были fixes:

`PHASE 1 STEP 1.17 REVIEW FIXES COMPLETED — WAITING FOR APPROVAL`

Если фундаментальный конфликт:

`ARCHITECTURE DECISION REQUIRED`

**Не переходить к Step 1.18 / 1.18A / Phase 2.**
