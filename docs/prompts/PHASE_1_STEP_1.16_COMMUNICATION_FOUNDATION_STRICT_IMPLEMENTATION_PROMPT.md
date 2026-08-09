# PHASE 1 — STEP 1.16: COMMUNICATION FOUNDATION — STRICT IMPLEMENTATION PROMPT

## 0. Роль и режим работы

Реализуй **PHASE 1 — STEP 1.16 — Communication Foundation** строго поверх текущего состояния TravelHub после APPROVED Step 1.15A.

Canonical Roadmap задаёт цель шага:

> `Communication = CML-*`, cross-domain communication model для CRM / Order / Booking / Support вместо legacy message fragments.

Это foundation-step. Не превращай его в полноценный Support Center, Chat, Notification Platform, CRM automation или Phase 2 workflow.

Перед изменениями изучи фактический repository. Implementation reports не считать доказательством.

Если фактическая архитектура конфликтует с требованиями и локальный безопасный fix невозможен — остановись с:

`ARCHITECTURE DECISION REQUIRED`

Не переходить к Step 1.17.

---

# 1. Цель

Создать единый canonical Communication contract, который сможет связывать коммуникации с различными business contexts без копирования CRM/Order/Booking/Support ownership.

Communication должна:

- иметь canonical identity `CML-*`;
- быть отдельной сущностью коммуникационного факта;
- поддерживать cross-domain references;
- различать направление и канал;
- хранить честные timestamps;
- иметь actor/participant semantics;
- иметь own/object scope;
- не становиться владельцем Order/Booking/CRM lifecycle;
- заменить/изолировать legacy message fragments там, где они используются как псевдо-communication model;
- быть готовой к будущему Support/CRM/Order/Booking UI без преждевременной реализации этих центров.

---

# 2. Сначала провести inventory

Найди все текущие communication-like сущности и paths:

- Message;
- ChatRoom;
- ChatMember;
- Contact;
- notes/comments;
- support fragments;
- order/booking message fields;
- email/phone communication logs;
- notification-like records;
- CRM interaction fragments;
- frontend chat/support pages;
- APIs/controllers/services;
- permissions;
- events;
- migrations.

Составь таблицу:

| Existing object/path | Owner | Purpose | Canonical? | Used? | Conflict with Communication? | Action |

Не удалять legacy автоматически.

---

# 3. Ownership decision

Определи минимальный owner для Communication по фактической архитектуре.

Communication — cross-domain infrastructure/business-support model, но не должна:

- писать напрямую в CRM/Order/Booking чужие таблицы;
- владеть Customer/Partner/Order/Booking;
- становиться event bus;
- становиться AuditLog;
- становиться Behavioral Event store.

Если текущие bounded contexts не позволяют определить owner без нового контекста/схемы — `ARCHITECTURE DECISION REQUIRED`.

Зафиксировать решение ADR, если появляется новая cross-context convention/ownership boundary.

---

# 4. Canonical identity

Каждая Communication:

`CML-*`

Требования:

- immutable code;
- DB uniqueness;
- generated server-side;
- не принимать code/id owner из клиента;
- internal numeric/UUID id допустим отдельно;
- public/partner/buyer API не должны использовать forged ownership identifiers.

---

# 5. Минимальная Communication model

Определи фактическую Prisma model после inventory.

Минимально ожидаемые concepts:

- `id`
- `code` (`CML-*`)
- `type`
- `channel`
- `direction`
- `status`
- `subject?`
- `body` или structured content
- `occurredAt`
- `createdAt`
- `createdById?` / actor reference where applicable
- canonical context references
- sender/recipient semantics
- correlation/request reference where applicable

Не добавлять поля только «на будущее», если semantics не определена.

---

# 6. Communication type

Не смешивать type и channel.

Проверь необходимость enum, например:

- MESSAGE
- NOTE
- SUPPORT_MESSAGE
- SYSTEM_MESSAGE

Но не вводить значения без реального current use-case.

Internal CRM note не должна автоматически становиться buyer-visible communication.

---

# 7. Channel

Channel описывает транспорт/поверхность, а не business context.

Допустимые только подтверждённые текущей архитектурой значения.

Например потенциально:

- PLATFORM
- EMAIL
- PHONE
- WHATSAPP

Но EMAIL/PHONE/WHATSAPP нельзя объявлять поддерживаемыми, если TravelHub фактически не отправляет/не принимает их.

Не симулировать integrations.

---

# 8. Direction

Если модель поддерживает external communication, определить:

- INBOUND
- OUTBOUND
- INTERNAL

Не угадывать направление из role.

Для platform conversation между двумя сторонами может понадобиться participant-based semantics вместо искусственного INBOUND/OUTBOUND.

Выбери модель по фактическим use-cases и объясни.

---

# 9. Status

Status должен описывать lifecycle самой Communication, а не Order/Booking.

Не использовать Communication status для:

- Order status;
- Booking status;
- Lead status;
- Support case status.

Не создавать fake DELIVERED/READ, если delivery/read receipts отсутствуют.

---

# 10. Cross-domain context

Communication должна ссылаться на business context без владения им.

Проверить необходимость context:

- CUSTOMER
- PARTNER
- ORDER
- BOOKING
- SUPPORT

Не создавать cross-schema FK, если это запрещено действующими ADR.

Предпочтительно canonical typed reference:

- `contextType`
- `contextId`

или эквивалентная доказанная модель.

Не хранить raw Prisma snapshots.

---

# 11. Multiple contexts

Определи, может ли одна Communication одновременно относиться, например, к:

Order + Booking + Customer.

Не добавлять произвольный JSON `contexts`.

Если multiple references реально нужны — нормализованная relation/reference model.

Если сейчас нужен только один primary context — зафиксировать ограничение честно.

---

# 12. Participant model

Определи sender/recipient semantics.

Нельзя полагаться только на `createdById`, потому что:

- SYSTEM может создавать communication;
- external participant может не быть User;
- Customer/Partner identity не равна User identity.

Нужен минимальный typed participant contract только для реально поддерживаемых identities.

Не копировать raw User/CRM entity.

---

# 13. Actor vs participant

Не смешивать:

- actor = кто совершил system action;
- sender = от чьего имени communication;
- recipient = кому предназначена communication.

Иногда actor и sender совпадают, но это не архитектурное правило.

Step 1.15A BusinessEventActor не переиспользовать механически как participant model.

---

# 14. Content / body

Определи content contract.

Требования:

- plain text или строго контролируемый structured format;
- никакого arbitrary HTML;
- XSS-safe;
- size limit;
- Unicode RU/AZ/EN;
- empty/whitespace body rejected;
- не хранить raw request body.

Если rich text не требуется сейчас — не вводить.

---

# 15. Attachments

Не реализовывать полноценную attachment subsystem без roadmap requirement.

Если legacy Message имеет attachments — провести inventory и определить migration boundary.

Не копировать ProductMedia/StorefrontMedia semantics.

Attachments можно оставить deferred, если current canonical flow их не требует.

---

# 16. Temporal contract

Communication должна иметь честное время факта.

Разделить:

- `occurredAt` — когда communication реально произошла;
- `createdAt` — когда запись создана;
- delivery/read timestamps — только если реальные lifecycle facts существуют.

Не использовать `updatedAt` как sent/read/delivered time.

Для server-created PLATFORM message обычно `occurredAt` и `createdAt` могут совпадать, если запись создаётся атомарно с фактом.

---

# 17. UTC

Instant timestamps:

- server-side;
- UTC;
- ISO Z в API.

Не использовать client-supplied occurredAt без доказанной необходимости/trust policy.

---

# 18. Correlation / request context

Использовать APPROVED Step 1.15 infrastructure.

При authenticated mutation:

- requestId diagnostic;
- correlationId server-authoritative;
- audit correlation сохраняется.

Communication не должна создавать собственную competing tracing model.

---

# 19. Business events

Не превращать Communication row в domain event.

Если создание Communication является значимым cross-domain fact и реальный consumer уже нужен — можно создать typed canonical event, например `CommunicationCreated`, только после проверки необходимости.

Не создавать event taxonomy «на будущее».

Любое новое event должно соответствовать Step 1.15A envelope.

---

# 20. AuditLog boundary

Business mutation Communication:

- create;
- internal update, если разрешён;
- status transition, если реальный;
- delete/archive, если существует,

должна иметь audit там, где это соответствует текущей platform policy.

AuditLog не хранит message body целиком, если это создаёт PII duplication.

---

# 21. PII / sensitive content

Communication потенциально содержит PII.

Проверить:

- body;
- email;
- phone;
- passport/traveler data;
- support content;
- internal notes.

Не дублировать body в:

- AuditLog;
- Outbox;
- Inbox;
- logs;
- errors.

Если event нужен — payload должен содержать references/minimal metadata, а не body.

---

# 22. Data minimization

Не сохранять автоматически:

- raw Customer;
- raw Partner;
- raw User;
- traveler snapshot;
- email/phone, если они не являются необходимой частью communication fact;
- authorization data;
- request headers;
- IP.

---

# 23. Legacy Message / Chat audit

Особенно проверить существующие:

- `messages`
- `chat_rooms`
- `chat_members`

Определить:

1. реально ли они используются production code;
2. какой у них owner;
3. имеют ли они canonical lifecycle;
4. есть ли UI/API consumers;
5. можно ли безопасно адаптировать;
6. надо ли оставить legacy изолированным.

Не объявлять legacy Chat canonical только потому, что таблицы существуют.

---

# 24. Migration strategy

Предпочтение:

- additive;
- nullable только там, где legacy unknown;
- no destructive migration;
- no fake backfill;
- no guessed context;
- no guessed occurredAt;
- no rewriting historical messages без доказуемого mapping.

Если legacy Message нельзя детерминированно преобразовать — оставить legacy и документировать boundary.

---

# 25. No startup backfill

Запрещено startup-reconciliation, которое:

- превращает все legacy messages в Communication;
- угадывает context;
- угадывает sender;
- проставляет `NOW()` как occurredAt.

Backfill допустим только при детерминированном mapping и отдельном доказательстве.

---

# 26. API boundary

Создать минимальные canonical APIs только для реально нужных Step 1.16 flows.

Предпочтительно read/create foundation, а не полноценный omnichannel center.

API должен быть scoped по actor/context.

Не принимать client-owned:

- customerId;
- partnerId;
- ownerId;
- actorId;
- internal status;
- createdById.

если их можно вывести server-side.

---

# 27. CRM context

Communication, связанная с CRM Customer/Partner:

- не даёт пользователю `crm.customer.read`;
- не раскрывает internal CRM notes;
- не делает CRM entity публичной;
- использует server-side object scope.

---

# 28. Order context

Communication по Order:

- не меняет Order lifecycle;
- не создаёт Order;
- не подтверждает/закрывает Order;
- не заменяет OrderHistory;
- context existence/ownership проверяется server-side.

---

# 29. Booking context

Communication по Booking:

- не меняет Booking lifecycle;
- не заменяет BookingHistory;
- не создаёт supplier confirmation;
- не является BookingRequested command.

---

# 30. Support context

Roadmap упоминает Support как один из contexts, но полноценный Support domain ещё не реализован.

Поэтому:

- не создавать Ticket/Case lifecycle преждевременно;
- не выдумывать SLA/priority/assignment;
- не превращать Buyer `/account/support` controlled empty в fake support system.

Если Support entity отсутствует, foundation должна быть extension-ready, но не симулировать domain.

---

# 31. Buyer scope

Если Buyer получает Communication read/create:

- только own Customer-linked contexts;
- IDOR A↔B закрыт;
- нельзя читать Partner/internal communication;
- нельзя forged `customerId`;
- internal note никогда не попадает Buyer.

Если Buyer UI не нужен для foundation — не строить его искусственно.

---

# 32. Partner scope

PARTNER:

- только communications, относящиеся к его canonical Partner/Products/Orders/Bookings согласно доказанной linkage;
- никакого broad CRM read;
- никакого доступа к communications другого Partner.

Не расширять PARTNER permissions шире необходимого.

---

# 33. Internal roles

ADMIN/MODERATOR/internal roles не должны автоматически получать communication mutation только через `ALL_PERMISSIONS`, если object/action semantics требуют отдельного права.

Провести фактический RBAC review.

---

# 34. RBAC

Создать узкие permissions по реальным operations.

Например conceptual:

- communication.read_own
- communication.create_own
- communication.read_internal

Но названия и состав определить по существующей permission convention.

Не создавать permission explosion.

---

# 35. IDOR

Обязательные negative cases:

- Buyer A → communication B;
- Partner A → communication Partner B;
- forged contextId;
- forged participant;
- forged actor;
- guessed CML code;
- context exists, но actor не имеет доступа.

Neutral 404 vs 403 выбрать по существующей security convention и использовать последовательно.

---

# 36. Internal note visibility

Если NOTE/internal communication существует:

- explicit visibility/audience semantics;
- никогда не отдавать Buyer/Partner случайно;
- whitelist DTO;
- отдельный permission boundary.

Не определять internalness по frontend route.

---

# 37. Public boundary

Anonymous public API не должен выдавать Communication.

Storefront/Marketplace public pages не получают communication data.

Behavioral tracking не должно содержать communication body.

---

# 38. DTO whitelist

Public/own DTO должен включать только необходимые поля.

Не сериализовать:

- internal actor IDs без необходимости;
- raw participant records;
- CRM internals;
- AuditLog;
- correlation internals, если они не нужны клиенту;
- storage/internal metadata.

---

# 39. Pagination / ordering

Read API:

- server-side pagination;
- deterministic ordering;
- total;
- stable tie-breaker.

Не использовать `take:100` как финальный communication contract, если endpoint уже проектируется как список с потенциально большим объёмом.

---

# 40. Filtering

Только реально необходимые фильтры:

- context;
- type;
- channel;
- direction;
- status;
- date range,

если они поддерживаются моделью.

Не строить advanced search engine.

---

# 41. Immutability / editing

Определи можно ли редактировать уже произошедшую Communication.

По умолчанию historical communication content не следует silently rewrite.

Если edit нужен — требуется:
- explicit policy;
- audit/history.

Не вводить edit без current use-case.

---

# 42. Delete / archive

Не hard-delete communication history без policy.

Если deletion не требуется — endpoint не создавать.

Retention/privacy deletion — отдельный вопрос, не смешивать с user CRUD.

---

# 43. Read receipts

Не создавать:
- readAt;
- deliveredAt;
- seenBy;
- unread counters,

если фактического reliable mechanism нет.

Можно зафиксировать deferred extension point.

---

# 44. Notifications

Communication ≠ Notification.

Не реализовывать:
- email sender;
- push;
- SMS;
- notification preferences;
- templates;
- queues,

если они не нужны текущему foundation.

---

# 45. Support ticket boundary

Communication ≠ SupportCase/Ticket.

Будущий Support domain сможет ссылаться на CML records, но CML не должен владеть:
- ticket status;
- SLA;
- assignee;
- priority;
- resolution.

---

# 46. CRM activity boundary

Communication может стать источником CRM interaction history, но не должна автоматически превращаться в Lead/Opportunity/Task.

Phase 2 Sales domain не начинать.

---

# 47. Search for duplicate concepts

После реализации repo-wide проверить, не осталось ли двух активных canonical write paths:

- legacy Message;
- new Communication.

Если legacy path всё ещё нужен — обозначить `legacy/non-canonical` и не смешивать read models.

Если безопасно заменить adapter-ом без scope expansion — сделать.

---

# 48. Frontend

Frontend делать только если необходим для доказательства canonical foundation или если существующий legacy UI должен быть переведён на новый contract.

Не строить полноценный Communication Center без roadmap requirement.

Если frontend меняется:

- RU/AZ/EN system labels;
- role/object scope;
- loading/error/empty states;
- no raw internal fields;
- responsive/accessibility;
- no console errors.

---

# 49. RU/AZ/EN

System labels локализовать, если появляются UI strings.

Сам `body` не переводить автоматически.

DD multilingual user-generated content не решать в Step 1.16.

---

# 50. XSS / injection

Проверить:

- body escaping;
- no `dangerouslySetInnerHTML`;
- SQL/Prisma safe filters;
- URL fields only if structured and validated;
- length limits;
- control characters where relevant.

---

# 51. Abuse / rate boundary

Если anonymous create отсутствует — не строить CAPTCHA/rate-limit subsystem.

Для authenticated message creation проверить basic abuse constraints:
- max body;
- pagination bounds;
- forged participants/context.

Platform-wide rate limiting не вводить без отдельного requirement.

---

# 52. Indexes

Индексы должны соответствовать реальным read patterns:

- code unique;
- context lookup;
- occurredAt ordering;
- participant/owner scope, если модель требует.

Не индексировать всё подряд.

---

# 53. History / analytics readiness

Communication должна быть temporal/analytics-ready:

- количество communications;
- channel/type/context;
- occurredAt;
- actor/participant references where appropriate.

Но Step 1.16 не строит analytics dashboards/aggregation.

---

# 54. Event envelope compliance

Если Step 1.16 создаёт business event:

обязателен APPROVED Step 1.15A envelope:

- eventId;
- eventType;
- occurredAt;
- correlationId;
- causationId;
- actor;
- entityId/entityType;
- minimal typed payload.

No body/PII dump in Outbox.

---

# 55. Tests — model/domain

Покрыть:

- CML code;
- enum validation;
- content validation;
- timestamps;
- context validation;
- participant validation;
- actor/participant separation;
- PII minimization;
- no arbitrary HTML;
- immutable fields.

---

# 56. Tests — RBAC/IDOR

Обязательно:

- anonymous;
- BUYER own/foreign;
- PARTNER own/foreign;
- internal role behavior;
- forged customerId/partnerId/context;
- forged actor/participant;
- internal note visibility.

---

# 57. Tests — cross-domain contexts

Минимально доказать фактически реализованные contexts:

- CRM;
- Order;
- Booking;
- Support boundary.

Если Support domain отсутствует — доказать controlled unsupported/extension-ready behavior, а не fake entity.

---

# 58. Tests — temporal

Проверить:

- occurredAt честный;
- createdAt;
- no fake legacy timestamps;
- ordering deterministic;
- update не превращает updatedAt в milestone.

---

# 59. Tests — legacy isolation

Доказать:

- legacy message rows не становятся canonical автоматически;
- no startup backfill;
- existing legacy functionality либо сохраняется, либо явно заменена без regression;
- unknown legacy fields не угадываются.

---

# 60. Tests — privacy

Проверить:

- Communication body не попадает в AuditLog;
- body не попадает в Outbox payload;
- body не попадает в error/log;
- raw Customer/Partner/User не сериализуются;
- public Marketplace/Storefront не видят Communication.

---

# 61. Full regression

Backend:
- `tsc --noEmit`;
- unit;
- communication e2e;
- auth/RBAC;
- buyer-cabinet;
- partner-cabinet;
- order canonical;
- booking;
- CRM/onboarding;
- request-context;
- business-event-envelope;
- temporal;
- storefront/marketplace behavioral;
- full serial e2e.

Frontend:
- `tsc --noEmit`;
- vitest;
- production build.

DB:
- `prisma migrate status`;
- drift check;
- clean migration replay.

---

# 62. Runtime verification

На live dev stack проверить фактически реализованные flows:

- create/read canonical Communication;
- CML code;
- own-scope;
- foreign scope denial;
- context linkage;
- timestamps;
- requestId/correlation;
- no PII duplication;
- no public leak;
- browser flow, если frontend изменён;
- console errors = 0.

Smoke data удалить.

---

# 63. Migration hygiene

Если schema меняется:

- новая migration;
- no `db push`;
- applied migrations не редактировать;
- additive where possible;
- deterministic;
- clean replay;
- no destructive legacy cleanup;
- no guessed backfill.

---

# 64. Documentation

Обновить минимум:

- architecture README/index;
- contracts/API docs;
- RBAC docs;
- temporal-readiness;
- events.md, если есть event;
- ADR, если принято cross-domain ownership/convention решение.

Зафиксировать legacy Message boundary.

---

# 65. Deferred Decisions

Не решать преждевременно:

- full Support domain;
- ticket/SLA;
- omnichannel provider integrations;
- email/SMS/WhatsApp sending;
- notification center;
- read receipts;
- attachments;
- retention engine;
- AI summaries/translations;
- CRM automation;
- Sales Lead/Opportunity;
- Phase 2 commercial flow.

Если обнаружены новые отложенные вопросы — добавить candidates в Deferred Decisions Map, не реализовывать их автоматически.

---

# 66. Architecture decision triggers

Остановиться с `ARCHITECTURE DECISION REQUIRED`, если для Step 1.16 требуется:

- новый bounded context без очевидного owner;
- объединение Communication с AuditLog;
- объединение Communication с EventBus;
- превращение legacy Chat в canonical без доказанного mapping;
- destructive migration legacy messages;
- изменение Order/Booking lifecycle;
- создание Support Ticket domain;
- cross-schema FK вопреки ADR;
- хранение чувствительной PII без минимизации/обоснования.

---

# 67. Out of scope

Не начинать:

- Step 1.17;
- Phase 2;
- Sales/Lead/Opportunity/Quote;
- Checkout;
- Payment/PSP;
- Settlement/Payout;
- Documents domain;
- full Support Center;
- notification platform;
- omnichannel integrations;
- analytics dashboards.

---

# 68. Финальный отчёт

Вернуть:

# PHASE 1 — STEP 1.16 — ОТЧЁТ

1. Current → Target mapping
2. Inventory legacy communication fragments
3. Ownership decision
4. Canonical Communication model
5. CML identity
6. Type/channel/direction/status semantics
7. Context model
8. Participant model
9. Actor vs participant
10. Content contract
11. Temporal semantics
12. Correlation/request context
13. Business events
14. Audit boundary
15. PII/privacy
16. Legacy Message/Chat decision
17. Migration/backfill
18. API
19. RBAC/object scope
20. Buyer scope
21. Partner scope
22. Internal roles
23. CRM context
24. Order context
25. Booking context
26. Support boundary
27. Public isolation
28. DTO whitelist
29. Pagination/filter/order
30. Immutability/delete policy
31. Frontend
32. RU/AZ/EN
33. Security/XSS
34. Indexes/performance
35. Analytics readiness
36. Unit tests
37. E2E tests
38. Runtime verification
39. Full regression
40. Migration status/drift
41. Docs/ADR
42. Issues/fixes
43. Deferred Decisions candidates
44. Remaining debt
45. ARCHITECTURE DECISION REQUIRED status
46. Out-of-scope confirmation

Финальная строка:

`PHASE 1 STEP 1.16 COMPLETED — WAITING FOR REVIEW`

Не переходить к Step 1.17.
