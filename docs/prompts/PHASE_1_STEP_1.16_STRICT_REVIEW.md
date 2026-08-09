# PHASE 1 — STEP 1.16 — STRICT IMPLEMENTATION REVIEW

## 0. Роль и границы

Проведи строгий code / architecture / RBAC / privacy / temporal / migration review уже реализованного:

**PHASE 1 — STEP 1.16 — COMMUNICATION FOUNDATION**

Implementation report не считать доказательством. Проверять фактический repository: Prisma schema, migration `add_communication_foundation`, Communication module/service/controller/DTOs, permissions, request context, AuditLog, CRM/Order/Booking resolvers, Buyer/Partner own-scope, tests, ADR-0011, API/events/ids docs и runtime DB.

Это review существующей реализации. Не переходить к Step 1.17 / Phase 2.

Если локальная проблема подтверждена — исправить как review-fix и повторить regression.
Если требуется изменить ownership, Support/Chat architecture, participant policy или cross-domain access semantics — `ARCHITECTURE DECISION REQUIRED`.

## 1. Главные риски

Проверить обязательно:

1. Новый bounded context `communication.*` архитектурно обоснован.
2. `contextType/contextId` без FK не создаёт IDOR/stale-reference/forged-link.
3. Participant `USER/CUSTOMER/PARTNER/SYSTEM` нельзя подделать.
4. Actor и sender/recipient действительно различаются.
5. NOTE/INTERNAL не протекают BUYER/PARTNER.
6. Buyer/Partner own-scope корректен.
7. Internal create не позволяет произвольную impersonation.
8. `occurredAt = createdAt` честно.
9. requestId/correlationId не становятся business IDs.
10. Body не дублируется в AuditLog/Outbox/logs/errors.
11. `ACTIVE | ARCHIVED` не создаёт speculative lifecycle.
12. Legacy Message/Chat действительно отсутствуют в code/schema/migrations.
13. Foundation имеет реальный reachable use-case.
14. Step 1.17/Support/Chat/Notifications не начаты.

## 2. Ownership / bounded context — CRITICAL

Проверить ADR-0011 и фактическое разделение доменов.

Ответить:
- почему CRM не может владеть Communication;
- почему security/events не подходят;
- почему Support не owner (Support ещё не существует);
- почему отдельная schema — минимальное решение;
- не нарушает ли это ADR-0001/0003/0007/0009/0010.

Если ADR-0011 недостаточно для уже созданного нового domain ownership — зафиксировать issue.

## 3. Prisma model

Проверить фактические поля и nullability:
`id, code, type, channel, direction, status, subject, body, contextType, contextId, actorUserId, senderType, senderId, recipientType, recipientId, occurredAt, createdAt, updatedAt, requestId, correlationId`.

Проверить enums, defaults, indexes и DB invariants.

## 4. CML identity

Проверить:
- server-only `CML-*`;
- BusinessSequence concurrency-safe;
- unique;
- immutable;
- forged code/id rejected;
- 20+ parallel creates → unique codes;
- predictable code не даёт access без scope.

## 5. Context model

Для CUSTOMER/PARTNER/ORDER/BOOKING:
- server-side existence;
- правильный type↔id;
- fake id reject;
- no cross-schema FK;
- no raw snapshots;
- stale/deleted target semantics documented.

## 6. Context authorization — CRITICAL

Existence != authorization.

Построить матрицу:
`Role | CUSTOMER | PARTNER | ORDER | BOOKING | create allowed? | why`

Проверить, что `communication.create` не даёт OPERATOR/SALES_MANAGER права создавать записи в любом существующем context без business authorization.

Если да — BLOCKING REVIEW ISSUE.

## 7. Internal impersonation — CRITICAL

Проверить попытки:
- sender=CUSTOMER X;
- sender=PARTNER X;
- sender=USER Y;
- recipient arbitrary USER/CUSTOMER/PARTNER;
- SYSTEM sender из обычного HTTP create.

Если internal user может логировать внешнюю коммуникацию «от имени» Customer/Partner — это должно быть explicit policy: actor остаётся internal USER, sender отдельный, direction/context валидируются, audit фиксирует actor.

Если policy отсутствует — `ARCHITECTURE DECISION REQUIRED` или review-fix.

## 8. Participant validation

Проверить:
- USER id exists;
- CUSTOMER id exists;
- PARTNER id exists;
- SYSTEM без произвольного id;
- exact key-set;
- empty/invalid ID reject;
- no email/phone instead of id;
- participant-context authorization.

## 9. Actor vs participant

Actor server-derived.
Client не передаёт `actorUserId/createdBy/system actor`.

Проверить, что actor и sender различаются только по explicit policy, а не случайно.

## 10. Direction

Определить однозначно, относительно кого INBOUND/OUTBOUND.

NOTE → INTERNAL.
MESSAGE → INBOUND/OUTBOUND.

Если модель пока не покрывает Customer↔Partner platform chat — честно зафиксировать limitation, не выдумывать P2P semantics.

## 11. Status

Сейчас `ACTIVE | ARCHIVED`, но archive endpoint отсутствует.

Проверить:
- может ли ARCHIVED вообще появиться;
- есть ли producer/use-case;
- client status forged blocked.

Если ARCHIVED purely speculative — удалить либо очень чётко документировать reserved state. Предпочтительно не иметь мёртвый lifecycle state.

## 12. NOTE / INTERNAL visibility

BUYER/PARTNER:
- NOTE hidden;
- INTERNAL hidden;
- neutral 404;
- own `total/hasMore` рассчитываются после visibility predicate;
- guessed CML не раскрывает hidden existence.

## 13. Buyer own-scope

Проверить текущий факт:
Buyer видит только `CUSTOMER context == actor.customerId`.

Отдельно ответить: communications по собственному ORDER/BOOKING Buyer сейчас видит или нет?
Если нет — это intentional limitation и docs/API должны говорить именно об этом.

Buyer без customerId → controlled empty/denied согласно contract.

## 14. Partner own-scope

Аналогично:
Partner видит только `PARTNER context == actor.partnerId`.

Order/Booking своего партнёра не должны внезапно считаться own без доказанной linkage policy.

## 15. RBAC

Проверить ADMIN/DIRECTOR/OPERATOR/SALES_MANAGER/MODERATOR/FINANCE/MARKETER/ANALYST.

`communication.read/create` глобальные — доказать, что это intentional и безопасно.
Если context-level authorization нужна — добавить её.

## 16. Cross-domain reads

Existence/authorization должны быть read-by-ID, без cross-domain writes и broad list leak.

## 17. Temporal

Проверить `occurredAt = createdAt = server now`.

Это честно только потому, что channel сейчас PLATFORM и create = сам communication fact.
Client-supplied occurredAt запрещён.

Если future external logging нужен — отдельный contract, не сейчас.

`updatedAt` не milestone и не должен быть в DTO.

## 18. requestId / correlationId

Проверить:
- only active server context;
- client cannot forge;
- Step 1.15 root correlation preserved;
- not exposed in own/public DTO;
- necessity of storing both documented.

## 19. AuditLog

`communication.created` не содержит:
- body;
- subject if sensitive;
- raw participants;
- request payload.

Correlation cannot be caller-spoofed.

## 20. PII / logs / errors

Body — PII-capable.
Проверить:
- no duplication in Outbox/Inbox/Audit/logs/errors;
- validation errors не echo full body;
- no raw participant/contact snapshots;
- retention/access debt documented.

## 21. XSS / content validation

Body plain text.
Не полагаться на brittle HTML regex как единственную XSS defense.
Future render must escape.
Проверить newline/tab/control-char policy и Unicode RU/AZ/EN.

## 22. Legacy inventory

Repo-wide доказать отсутствие:
- Message;
- ChatRoom;
- ChatMember;
в Prisma, migrations, backend, frontend, seeds, legacy runtime paths.

`crm.Contact` не считать message.

## 23. No startup backfill

Проверить onModuleInit/seed/bootstrap/repair.
После boot count Communication остаётся 0 при отсутствии explicit create.

## 24. Real use-case / reachability

Frontend может отсутствовать, но API foundation должен быть реально reachable:
allowed internal actor → valid context → create CML → read.

Если сущность существует только ради будущего и ни один actor не может корректно использовать её сейчас — зафиксировать dead-foundation issue.

## 25. API

Проверить:
- POST /communications;
- GET /communications;
- GET /communications/own;
- GET /communications/:code;
- route ordering `/own` vs `/:code`;
- pagination;
- neutral 404;
- mass assignment.

## 26. Forbidden fields

Security-sensitive aliases должны давать explicit reject:
`code,id,status,actorUserId,createdBy,ownerId,customerId,partnerId,occurredAt,requestId,correlationId` и эквиваленты.

Обычный junk может whitelist-strip согласно global pipe, но ownership/lifecycle aliases не должны тихо игнорироваться.

## 27. DTO projections

Own DTO:
- no actorUserId;
- no requestId/correlationId;
- no updatedAt;
- internal USER ids redacted;
- no raw CRM.

Internal DTO может быть шире только при необходимости.

## 28. Pagination / filtering

Own total считается по уже scoped+visible dataset.
Internal filters не доступны own endpoint как scope bypass.
Ordering deterministic: `occurredAt desc, code asc`.

## 29. Support boundary

Подтвердить отсутствие:
- SUPPORT context;
- Ticket/Case;
- SLA;
- priority;
- assignment;
- support message create.
`/account/support` остаётся controlled empty.

## 30. Order / Booking / CRM boundaries

Communication create/read:
- не мутирует Order/Booking;
- не пишет их History;
- не эмитит BookingRequested;
- не даёт broad CRM permissions;
- не меняет Customer/Partner lifecycle.

## 31. Event boundary

`CommunicationCreated` отсутствует в DomainEvents registry, если consumers нет.
No placeholder taxonomy.
Если event появится в review — должен соответствовать 1.15A and no body.

## 32. Behavioral boundary

Marketplace/Storefront behavioral schemas unchanged; body не попадает telemetry.

## 33. Immutability / delete

No PATCH/PUT body editing.
No hard-delete endpoint.
Проверить direct production Prisma updates/deletes.
Если ARCHIVED no path — см. status review.

## 34. Migration

Проверить `20260809172257_add_communication_foundation`:
- additive;
- schema/enums/table/indexes;
- no backfill;
- no guessed data;
- no destructive legacy cleanup;
- no triggers;
- clean replay;
- no db push;
- applied migration unchanged.

## 35. Historical stale references

Без FK target может исчезнуть.
Communication должна оставаться historical record.
No cascade delete.
Actor/participant deletion/deactivation не должна уничтожать Communication.

## 36. Participant historical limitation

Поскольку сохраняются IDs, а не snapshots, future display может показывать текущую identity, а не historical name.
Зафиксировать limitation; не добавлять snapshots без need.

## 37. Required E2E security matrix

Минимум:

1. anonymous all denied.
2. BUYER create denied.
3. PARTNER create denied.
4. allowed internal create.
5. disallowed internal create 403.
6. Buyer A cannot see Buyer B.
7. Partner A cannot see Partner B.
8. NOTE hidden.
9. INTERNAL hidden.
10. own total excludes hidden.
11. forged actor blocked.
12. unauthorized sender/recipient blocked.
13. forged context blocked.
14. existing-but-unauthorized context blocked.
15. guessed CML neutral.
16. internal USER id redacted.
17. body absent AuditLog.
18. body absent Outbox/logs.
19. Order/Booking unchanged.
20. no startup creation.
21. 20+ concurrent CML creates unique.
22. pagination deterministic.
23. SYSTEM sender cannot be forged from HTTP.
24. participant-context mismatch rejected.

## 38. Context authorization test — mandatory

Создать несколько Customers/Partners/Orders/Bookings и доказать authorization matrix, а не только existence.

Главный proof:
`communication.create + arbitrary existing contextId` не означает автоматически full global context access, если role policy этого не разрешает.

## 39. Runtime

Повторить independently:
- NOTE;
- MESSAGE;
- internal read;
- Buyer own;
- Partner own;
- foreign denial;
- participant spoof;
- context spoof;
- AuditLog;
- correlation;
- no event;
- public isolation.

Isolated dev instance допустим, если standard worktree/config; общий чужой process не убивать.

## 40. Standard boot

Проверить текущий worktree стандартным start command; migration applied; no hidden dependency on :4001.

## 41. Full regression

Backend:
- tsc;
- unit;
- communication;
- auth/RBAC;
- buyer;
- partner;
- order;
- booking;
- CRM/onboarding;
- request-context;
- business-event envelope;
- temporal;
- behavioral;
- full serial e2e.

Frontend:
- tsc;
- vitest;
- production build.

DB:
- migrate status;
- diff/no drift;
- clean replay.

## 42. Docs / ADR

ADR-0011 + ids/api/events/README/temporal docs должны честно фиксировать:
- owner;
- internal-only create;
- Buyer/Partner own limitations;
- participant impersonation policy;
- no Support;
- no CommunicationCreated;
- no archive endpoint;
- no attachments/read receipts;
- PII/retention debt;
- typed refs without FK.

## 43. Approval criteria

APPROVAL только если:
- ownership justified;
- context authorization safe;
- impersonation closed/explicit;
- NOTE/INTERNAL no-leak;
- Buyer/Partner IDOR closed;
- CML concurrency safe;
- temporal honest;
- PII not duplicated;
- correlation safe;
- legacy inventory true;
- no startup backfill;
- no premature Support/Notification;
- migration/regression green.

## 44. Outcome

Если fixes:
`PHASE 1 STEP 1.16 REVIEW FIXES COMPLETED — WAITING FOR APPROVAL`

Если чисто:
`PHASE 1 STEP 1.16 REVIEW PASSED — WAITING FOR APPROVAL`

Если нужен новый product/ownership policy:
`ARCHITECTURE DECISION REQUIRED`

## 45. Формат отчёта

Вернуть:

# PHASE 1 — STEP 1.16 — STRICT REVIEW — ОТЧЁТ

1. Verdict
2. Files/modules inspected
3. Ownership/bounded-context review
4. ADR consistency
5. Prisma model
6. CML identity/concurrency
7. Context model
8. Context authorization
9. Internal create scope
10. Participant model
11. Participant authorization/impersonation
12. Actor vs participant
13. Direction semantics
14. Status semantics
15. NOTE/INTERNAL visibility
16. Buyer own-scope
17. Partner own-scope
18. Internal roles/RBAC
19. Temporal semantics
20. request/correlation
21. AuditLog
22. PII/logging
23. XSS/content
24. Legacy inventory
25. No-backfill
26. Real use-case/reachability
27. API/DTO
28. Forbidden-fields semantics
29. Pagination/filter/order
30. Support boundary
31. Order boundary
32. Booking boundary
33. CRM boundary
34. Event/behavioral boundary
35. Immutability/delete
36. Migration
37. Stale historical references
38. Unit tests
39. E2E security matrix
40. Runtime verification
41. Standard boot verification
42. Full regression
43. Docs/ADR
44. Issues/fixes
45. Deferred Decisions
46. Remaining debt
47. Architecture decision status
48. Out-of-scope confirmation

Не переходить к Step 1.17.
