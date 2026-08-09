# PHASE 1 — STEP 1.18A: PHASE 1 ANALYTICS READINESS GATE — STRICT IMPLEMENTATION / AUDIT PROMPT

## 0. Роль и режим

Выполни **PHASE 1 — STEP 1.18A — Phase 1 Analytics Readiness Gate** проекта TravelHub.

Это отдельный финальный gate Phase 1 после APPROVED Step 1.18.

Canonical Roadmap требует:

> доказать, что Product / Moderation / Partner / Buyer / Seller / Storefront данные пригодны для Analytics и все необходимые исторические timestamps/events присутствуют; запрещается переходить в Phase 2 с невосстановимой историей критичных lifecycle transitions.

Это **не analytics dashboard implementation**, не BI, не data warehouse и не Phase 2.

Не переходить к:
- Step 2.0;
- Phase 2;
- analytics engine;
- BI/dashboard;
- aggregation jobs;
- warehouse/lake;
- product metrics UI.

Главная задача — не «создать аналитику», а доказать, что факты Phase 1 можно честно анализировать позже.

Если обнаружен локальный gap Phase 1 temporal/history foundation, который можно безопасно исправить без изменения lifecycle/ownership — исправить как `ANALYTICS READINESS FIX N`, добавить proof и повторить regression.

Если gap невосстановим без изменения архитектуры, ownership, lifecycle, historical assumptions или destructive/fake backfill — остановиться с:

`ARCHITECTURE DECISION REQUIRED`

или

`ANALYTICS READINESS BLOCKED — IRRECOVERABLE HISTORY GAP`

---

# 1. Source of truth

Перед изменениями изучить:

- `TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`;
- актуальный Master/Baseline;
- `docs/architecture/temporal-readiness.md`;
- `docs/architecture/phase1-exit-audit.md`;
- ADR-0001…ADR-0011;
- `contracts/events.md`;
- `contracts/api.md`;
- `ids.md`;
- Deferred Decisions Map;
- Prisma schema;
- все migrations;
- Product/Moderation/Partner/Buyer/Seller/Storefront/Behavioral/Communication/Order/Booking code;
- business event envelope;
- AuditLog;
- Outbox/Inbox;
- Step 1.18 Strict Review report только как reference, не proof.

---

# 2. Основной принцип

Никаких synthetic/fabricated historical facts.

Запрещено:

- ставить `NOW()` для неизвестного прошлого;
- копировать `updatedAt` в lifecycle timestamp;
- считать `createdAt` датой approval/publish/cancel;
- реконструировать lifecycle из текущего status без истории;
- генерировать historical events задним числом без доказуемого source;
- объявлять dataset analytics-ready, если ключевая business chronology восстановима только предположением.

`NULL / UNKNOWN` лучше, чем выдуманная история.

---

# 3. Analytics-ready definition

Объект считается analytics-ready только если для каждого **критичного business fact** известно:

1. **что произошло**;
2. **к какому canonical entity относится**;
3. **когда произошло**;
4. **кто/что инициировал**, если actor нужен для анализа;
5. **какой source-of-truth** хранит факт;
6. можно ли отличить разные lifecycle transitions;
7. повторные transitions не затирают историю;
8. историческая запись не переписывается обычным PATCH;
9. legacy unknown явно отличим от «событие не происходило» там, где это важно;
10. данные можно связать canonical IDs без ambiguous joins.

---

# 4. Обязательная readiness matrix

Построить полный документ:

| Domain | Entity | Business fact | Source of truth | Timestamp/event | Actor | Historical? | Recoverable? | READY/GAP | Gap owner |

Минимум для:

- Product;
- ProductDraft;
- ProductHistory;
- ProductMedia;
- Category/CategorySchema;
- ModerationSubmission;
- PublicSellerProfile;
- Seller proposal;
- PartnerApplication;
- Partner;
- Customer/Buyer;
- PartnerStorefront;
- StorefrontMedia;
- ProductPublicationChannel;
- MarketplaceBehavioralEvent;
- StorefrontBehavioralEvent;
- Communication;
- Order;
- Booking;
- AuditLog;
- Outbox/Inbox.

Roadmap 1.18A явно требует минимум Product/Moderation/Partner/Buyer/Seller/Storefront, но смежные факты нужно проверить настолько, насколько они нужны для будущих analytics joins.

---

# 5. Product analytics readiness — CRITICAL

Проверить фактическую хронологию Product.

Нужно уметь честно ответить:

- когда Product создан;
- когда изменён как entity;
- когда submitted на moderation;
- когда review started;
- когда approved/rejected;
- когда published;
- когда archived;
- были ли change proposals;
- какой был предыдущий lifecycle state;
- кто выполнил transition;
- какие publication channels действовали/изменились;
- staged media vs published media;
- historical Product state не переписан ли без history.

Проверить `ProductHistory`, `ProductDraft`, `ModerationSubmission`, events.

`updatedAt` не принимается как lifecycle evidence.

---

# 6. Product publication history

Отдельно проверить:

- `publishedAt`;
- re-publish semantics;
- archive→publish behavior, если существует;
- publish after change-proposal;
- channel changes;
- Marketplace vs Storefront publication history.

Критический вопрос:

можно ли в будущем построить метрику:
> сколько Product было реально доступно в Marketplace/Storefront на конкретный historical момент?

Если `ProductPublicationChannel` хранит только current state без history, это не обязательно Phase 1 blocker, но нужно честно классифицировать:
- current-state analytics only;
- historical channel analytics unavailable;
- future owner/step.

Не фабриковать channel history.

---

# 7. Moderation readiness — CRITICAL

Проверить:

- submittedAt;
- reviewStartedAt;
- decidedAt;
- reviewer/actor;
- decision;
- previousSubmissionId;
- snapshot/version;
- resubmission chain.

Нужно доказать возможность метрик:

- moderation lead time;
- time-to-review;
- approval/rejection rate;
- repeated submissions;
- reviewer workload, если actor contract позволяет.

Если какой-либо timestamp только inferred из `updatedAt` — GAP.

---

# 8. Seller identity readiness

Проверить:

- PublicSellerProfile lifecycle;
- identity visibility mode;
- `memberSince`;
- approvedAt;
- proposal submittedAt/reviewedAt;
- reviewer;
- approved identity history;
- transition anonymous → alias → brand, если реально поддержан.

Критический вопрос:

можно ли определить, **какая seller identity была действующей в конкретный historical момент**?

Если сохраняется только current projection + proposal history, проверить достаточность.

Не считать Storefront business identity историей Marketplace identity.

---

# 9. Partner onboarding readiness

Проверить:

- PartnerApplication submittedAt;
- reviewedAt;
- status history;
- reviewer;
- application history;
- Partner creation;
- Partner activation/current status;
- timestamps Partner entity.

Отдельно проверить известный gap:
`crm.Partner` entity time/lifecycle time.

Если Partner создаётся после approved application, можно ли восстановить:
- когда Partner стал canonical Partner;
- когда получил ACTIVE status;
- кто инициировал?

Если нет dedicated Partner lifecycle timestamps/history — классифицировать gap.

Нельзя копировать application reviewedAt в Partner activatedAt без explicit invariant.

---

# 10. Buyer/Customer readiness

Проверить:

- User.createdAt;
- Customer creation;
- CustomerCreated event;
- CustomerHistory;
- linkage User↔Customer;
- profile updates;
- current status;
- lifecycle, если есть.

Нужно различать:
- account registration time;
- Customer projection creation time;
- profile update time.

Не использовать email verification/login time, если contract этого не хранит.

---

# 11. Storefront lifecycle readiness — CRITICAL

Проверить:

- createdAt;
- activatedAt;
- deactivatedAt;
- activatedBy/deactivatedBy;
- entitlement changes;
- entitlement from/to;
- business identity changes;
- contact changes;
- media changes;
- publication products/channels.

Критический вопрос:

можно ли восстановить:
- периоды, когда Storefront был public;
- периоды ACTIVE entitlement;
- activation/deactivation cycles;
- изменения business identity/contacts.

Если `activatedAt/deactivatedAt` columns хранят только последний cycle и повторная activation затирает старый timestamp — текущие columns сами по себе недостаточны.

Тогда проверить AuditLog/history:
можно ли восстановить каждый cycle?

Если нет — HIGH analytics gap.

---

# 12. Storefront entitlement history

Current `entitlementStatus` недостаточен для historical subscription-like analytics.

Проверить AuditLog `storefront.entitlement_changed`:

- from;
- to;
- timestamp;
- actor;
- storefront/partner reference.

Можно ли восстановить sequence:
NONE→ACTIVE→SUSPENDED→ACTIVE→EXPIRED?

Если да — READY via AuditLog.
Если нет — GAP.

Не создавать Billing domain.

---

# 13. Storefront identity/content history

Проверить PATCH Storefront:

- businessName;
- tagline;
- description;
- contacts;
- city;
- locale;
- theme/media.

Если update history не хранится, аналитика historical configuration может быть невозможна.

Классифицировать, что действительно нужно для Phase 1 analytics readiness.

Не требовать full CMS version history без roadmap requirement.

Критичные аналитические факты:
- public lifecycle;
- entitlement;
- traffic;
- product views;
- contacts clicked.

Text-content history может быть accepted non-critical gap.

---

# 14. Marketplace behavioral readiness — CRITICAL

Проверить фактические event types:

- MarketplaceViewed;
- SearchPerformed;
- CategoryViewed;
- ProductImpression;
- ProductViewed;
- filters/sort;
- CTA, если реально существует.

Для каждого:
- eventId;
- occurredAt;
- receivedAt;
- sessionId;
- acquisitionSource;
- product/category refs;
- locale;
- path;
- payload semantics;
- dedup.

Нужно определить, какие funnel metrics реально возможны уже на raw history.

---

# 15. Storefront behavioral readiness — CRITICAL

Проверить:

- StorefrontViewed;
- ProductImpression;
- ProductViewed;
- ContactClicked.

Для каждого:
- durable storage;
- canonical Storefront/Product refs;
- occurredAt;
- sessionId;
- acquisitionSource;
- dedup;
- locale/path;
- contactType without contact value.

Проверить, что preview не загрязняет production analytics.

---

# 16. Behavioral event semantic stability

Analytics-ready dataset требует стабильной event semantics.

Проверить:
- event type meaning documented;
- impression semantics (rendered card vs viewport);
- search query normalization;
- filter payload semantics;
- contact click = intent, not lead/conversion/sale;
- no ambiguous event renamed without migration/version note.

Если event meaning может поменяться в будущем, зафиксировать schema/versioning debt.

Не вводить schema registry сейчас.

---

# 17. Behavioral session limitations

Текущий anonymous sessionId:
- opaque;
- local browser session;
- no visitorId;
- no cross-device identity.

Честно определить доступные метрики:

Можно:
- sessions;
- views;
- impressions;
- funnel внутри session.

Нельзя честно:
- unique people;
- cross-device users;
- long-term visitor retention;
- person-level attribution.

Не называть sessionId «unique visitor».

---

# 18. Acquisition/source readiness

Проверить:

- Marketplace = MARKETPLACE server-authoritative;
- Storefront = PARTNER_STOREFRONT server-authoritative;
- DIRECT reserved/not simulated.

Критический вопрос:
можно ли связать будущую transaction conversion с behavioral source?

Phase 1 пока не имеет Sale/Payment acquisition propagation.

Это future Phase 2 gap, не blocker 1.18A, если raw interaction source стабилен.

Зафиксировать:
interaction attribution ready;
transaction attribution not implemented yet.

---

# 19. AuditLog analytics boundary

Определить, какие факты допустимо использовать из AuditLog.

AuditLog:
- security/operational record;
- не universal business history.

Можно использовать только там, где ADR/current contract явно делает его source для конкретного transition, например entitlement from→to.

Нельзя строить lifecycle analytics на generic AuditLog action, если canonical domain history/event существует.

---

# 20. Business event analytics boundary

Проверить:
- canonical event envelope;
- occurredAt;
- entityId;
- actor;
- eventType;
- correlation/causation.

Определить, какие Phase 1 business metrics уже можно получить из events.

Например:
- Order ready/fulfilled/closed chronology;
- BookingRequested/Created chronology.

Не требовать Phase 2 metrics.

---

# 21. Event occurredAt semantics

Подтвердить для каждого producer:

`occurredAt` действительно business fact time.

Если envelope uses Outbox.createdAt:
- prove atomic insert with transition;
- consumer-produced child event = child fact time, не parent time.

Не считать processing/publishedAt occurrence time.

---

# 22. Communication analytics readiness

Минимальные потенциальные metrics:

- number of communications;
- type;
- direction;
- context;
- occurredAt;
- actor class.

Проверить:
- body не нужен для basic analytics;
- participant refs stable;
- NOTE/INTERNAL privacy respected;
- no Support semantics fabricated.

Retention debt отдельно.

---

# 23. Order/Booking analytics boundary

Step 1.18A относится к Phase 1, поэтому проверить transitional readiness, но не требовать future Phase 2 timestamps.

Order:
- createdAt;
- current status;
- history;
- canonical events;
- serviceDate.

Booking:
- createdAt;
- history;
- events;
- serviceDate.

Известные future gaps:
- Order dedicated submittedAt/confirmedAt/cancelledAt/fulfilledAt/closedAt → Step 2.5A;
- Booking request/confirm/cancel timestamps + IANA timezone → future steps.

Критический вопрос:
может ли история этих transitions быть восстановлена из immutable history/events сейчас?

Если да — analytics-ready chronology, но dedicated columns future.
Если нет — gap классифицировать.

---

# 24. Lifecycle repeatability test

Для каждого lifecycle с возможными повторными cycles проверить:

- activation/deactivation;
- entitlement;
- moderation resubmission;
- publish/archive/republish;
- change proposals.

Columns могут хранить только latest timestamp.

Требуется immutable history/event source для всех cycles.

Построить cycle matrix:

| Lifecycle | Repeats allowed? | Column only? | History/event? | All cycles recoverable? |

---

# 25. Actor completeness

Для критичных transitions проверить actor:

- USER;
- SYSTEM;
- reviewer;
- admin;
- partner.

Классифицировать:
- actor required for business analytics;
- actor optional;
- legacy actor unknown.

Нельзя fabricate actor for legacy.

---

# 26. Canonical entity references

Analytics joins должны использовать canonical IDs.

Проверить:
- Product;
- Partner;
- Customer;
- Storefront;
- SellerProfile;
- Category;
- Order;
- Booking;
- Communication.

Не использовать displayName/email/slug как durable join key, если canonical ID существует.

Slug может изменяться/быть presentation identity согласно contract.

---

# 27. Historical identity references

Если event/history stores only ID, а entity later deleted/deactivated:
- reference должен оставаться meaningful.

Проверить hard-delete policies.

Не должно быть cascade deletion history.

Если display label historically changes, basic analytics can still join current label, но historical-label accuracy отдельно классифицировать.

---

# 28. Legacy data audit — CRITICAL

Не ограничиваться schema.

На dev/test representative data найти legacy rows с NULL/unknown temporal fields.

Для каждого:
- что неизвестно;
- можно ли восстановить из history/event;
- если нет — какие analytics невозможны;
- является ли gap critical lifecycle history.

Особенно:
- Category;
- CategorySchema;
- legacy Product;
- legacy Partner/Customer;
- Order/Booking.

Не менять значения.

---

# 29. Irrecoverable history definition

Irrecoverable critical gap:

> важный lifecycle transition уже происходил, но его время/последовательность невозможно восстановить ни из column, ни history, ни event, ни authoritative linked record.

Примеры:
- Product был published/archived несколько раз, но хранится только последний status/time и history отсутствует;
- Storefront activation cycles перезаписаны без AuditLog;
- Partner approval happened but neither application history nor timestamp exists.

Если такой gap найден в critical Phase 1 domain:
`ANALYTICS READINESS BLOCKED — IRRECOVERABLE HISTORY GAP`

Не backfill guess.

---

# 30. Critical vs non-critical analytics facts

Не требовать историю каждого UI field.

### Critical
- lifecycle transitions;
- publication;
- moderation;
- onboarding/approval;
- Storefront public/entitlement;
- behavioral interactions;
- canonical identity;
- actor where decision analytics needs it.

### Non-critical / accepted
- historical text copy;
- historical color/theme;
- historical translated label;
- presentation-only metadata,
если Roadmap не делает их analytical facts.

Классифицировать gaps accordingly.

---

# 31. Funnel readiness — Marketplace

Построить **только data availability funnel**, не dashboard:

Marketplace visit
→ search/category
→ product impression
→ product view
→ future commercial intent (not yet Phase 1).

Определить:
- какие stages measurable;
- join key/session;
- missing conversion stage;
- denominator semantics.

Не называть ProductView → Sale conversion доступной сейчас.

---

# 32. Funnel readiness — Storefront

Storefront view
→ product impression
→ product view
→ contact click.

Это текущий Phase 1 funnel.

Проверить:
- same session linkage;
- product refs;
- contact click type;
- dedup;
- temporal order possible.

ContactClick ≠ Lead/Sale.

---

# 33. Seller analytics readiness

Определить доступные future metrics:
- seller profile visibility lifecycle;
- profile approval time;
- products published;
- Marketplace views by Product;
- Storefront presence separately.

Не смешивать Marketplace Seller identity и Storefront business identity.

---

# 34. Partner analytics readiness

Определить:
- onboarding funnel;
- approval timing;
- active products;
- channels;
- Storefront lifecycle;
- behavioral performance.

Full CRM pipeline metrics not available — future Partner CRM.

---

# 35. Buyer analytics readiness

Определить:
- registrations;
- Customer creation;
- own Order/Booking counts;
- behavioral anonymous sessions.

Не связывать anonymous session с Buyer User автоматически.

Если logged-in behavioral tracking intentionally stays anonymous/non-identity-linked, зафиксировать privacy boundary.

---

# 36. Data minimization / analytics privacy

Analytics readiness не разрешает расширить collected PII.

Проверить:
- behavioral payload no PII;
- no raw IP;
- no auth token;
- no contact values;
- no email/phone for analytics join;
- no passport/traveler fields;
- no Communication body in analytics foundation.

Canonical opaque IDs предпочтительны.

---

# 37. Retention readiness

Проверить, есть ли retention policy для:
- behavioral events;
- AuditLog;
- Communication;
- Outbox/Inbox.

Не реализовывать retention engine.

Классифицировать:
- analytics history assumes retention;
- privacy policy unresolved.

Если analytics-ready claim зависит от вечного хранения, но retention decision deferred, написать explicit assumption.

---

# 38. Timezone semantics

Проверить:
- lifecycle/event timestamps UTC instant;
- ISO Z at API;
- `serviceDate` отдельно;
- local service timezone gap documented.

Не превращать local service date в UTC.

Analytics duration only between comparable instant timestamps.

---

# 39. Timestamp monotonicity

Проверить invariants:

- created <= submitted <= reviewStarted <= decided;
- storefront created <= activated;
- activation/deactivation sequence;
- behavioral occurredAt vs receivedAt within expected skew semantics;
- event time ordering for parent/child where meaningful.

Не требовать strict global ordering across distributed/async operations beyond contract.

---

# 40. Migration temporal audit

Review all migrations touching temporal/history data.

Проверить:
- no `NOW()` fake history;
- nullable legacy;
- deterministic backfill;
- no copy updatedAt→lifecycle;
- no actor fabrication.

Если Step 1.18A добавляет missing timestamps:
- only if future transitions;
- nullable;
- no guessed backfill.

---

# 41. Schema changes policy

1.18A — gate, не feature sprint.

Schema change допустима только если:
- critical future analytics fact currently cannot be recorded;
- lifecycle already exists in Phase 1;
- additive field/history hook closes gap prospectively;
- historical rows remain NULL.

Если change actually belongs to future Phase 2 lifecycle:
не делать.

---

# 42. History immutability

Проверить:
- ProductHistory;
- CustomerHistory;
- PartnerApplicationHistory;
- OrderHistory;
- BookingHistory;
- proposal/moderation history;
- AuditLog.

Не должно быть normal update/delete paths, переписывающих historical facts.

Test cleanup exempt.

---

# 43. Event immutability

Outbox business envelope после persist:
- eventId;
- type;
- occurredAt;
- actor;
- entity;
- payload;
- correlation;
- causation

не меняются.

Processing status updates отдельно.

FAILED retry debt не является analytics history loss, потому что Outbox row durable — но проверить фактически.

---

# 44. Dedup and analytical counts

Dedup важен, чтобы analytics не считала retries как новые facts.

Проверить:
- behavioral eventId unique;
- Inbox consumer dedup;
- Outbox logical event identity;
- repeated lifecycle command doesn't create duplicate canonical event where idempotent.

---

# 45. Data quality invariants

Добавить/проверить automated tests:

- required timestamp chronology;
- no fake timestamp on PATCH;
- no duplicate behavioral eventId;
- lifecycle actor;
- canonical IDs;
- neutral legacy NULL;
- no PII analytics payload.

Не строить ETL validation framework.

---

# 46. Analytics-readiness automated proof

Добавить отдельный targeted spec, например:

`analytics-readiness.e2e-spec.ts`

или repository-conventional equivalent.

Он должен доказать cross-domain facts, а не только unit helpers.

Минимум scenarios:

1. Product create→moderate→publish chronology.
2. change proposal/resubmission chronology.
3. Partner application→approval chronology.
4. Seller proposal lifecycle.
5. Storefront activate/deactivate/entitlement chronology.
6. Buyer/Customer creation chronology.
7. Marketplace behavioral events.
8. Storefront behavioral funnel.
9. Legacy NULL remains NULL.
10. no PII in behavioral/event analytics foundation.

---

# 47. Storefront cycle proof

Обязательно воспроизвести:
- create;
- entitlement ACTIVE;
- activate;
- deactivate;
- activate again, если contract allows;
- entitlement SUSPENDED/ACTIVE if allowed.

Проверить, что историю всех cycles можно восстановить.

Если columns overwrite, AuditLog/history must preserve cycles.

---

# 48. Product cycle proof

Если lifecycle допускает:
- publish;
- archive;
- republish/change proposal.

Проверить actual supported cycles.

Доказать history sequence.

Не тестировать unsupported transition как requirement.

---

# 49. Moderation cycle proof

Сделать минимум:
- submission 1;
- review/decision;
- change;
- submission 2;
- previousSubmissionId chain.

Проверить timestamps/actors/snapshots.

---

# 50. Behavioral funnel proof

Marketplace:
- viewed/search/impression/product viewed;
- same session linkage.

Storefront:
- viewed/impression/product viewed/contact clicked.

Проверить occurredAt order enough for later funnel analysis.

Не требовать perfectly sequential client events due network timing; use event timestamps semantics.

---

# 51. Analytics query feasibility

Не строить production analytics service.

Но для readiness можно выполнить representative DB queries/probes:

- products published per day;
- moderation lead time;
- partner approvals per day;
- Storefront active intervals;
- Marketplace product views per product;
- Storefront contact clicks by type;
- sessions with product view.

Цель — доказать data model feasibility.

Не сохранять dashboard/query layer unless repository has test helper convention.

---

# 52. Active interval reconstruction

Особенно для Storefront/entitlement:

Показать алгоритмически, из каких facts строится interval:
- start event/time;
- end event/time.

Если interval нельзя восстановить после нескольких cycles — GAP.

---

# 53. Current-state vs historical analytics

Для каждого domain разделить:

### Current-state ready
Можно ответить «что сейчас».

### Historical ready
Можно ответить «что было на дату X / когда произошло».

Roadmap требует historical readiness критичных lifecycle transitions.

Нельзя выдать current-state readiness за историческую.

---

# 54. Data coverage report

На representative dev DB посчитать:

- total rows;
- rows with known critical timestamps;
- legacy NULL count;
- rows whose history reconstructs gap;
- unrecoverable rows.

Не публиковать PII.

Пример:

| Entity | Total | Fully temporal | Legacy unknown | Reconstructable | Irrecoverable |

Это обязательный artifact.

---

# 55. Legacy unknown acceptability

Legacy NULL не всегда blocker.

Допустимо, если:
- row реально предшествует instrumentation;
- critical transition можно признать UNKNOWN;
- future analytics explicitly excludes/segments legacy unknown;
- Phase 2 не требует fabricated baseline.

Но если значительная critical history нужна для business correctness, а не только retrospective metrics — blocker classification выше.

---

# 56. Analytics horizon

Определить **analytics reliable-from date/version**.

Например:
> Behavioral analytics reliable from migration X / deployment of Step 1.13B onward.

> Storefront entitlement lifecycle reliable from migration Y onward.

Не выдумывать calendar deployment date, если нет reliable source.

Можно указать:
- migration identifier;
- code version/commit;
- `instrumentation available from`.

Это важно для честной аналитики legacy datasets.

---

# 57. Schema/event version horizon

Если event semantics changed:
- note boundary.

Пример:
`ProductImpression` rendered-card semantics from Step 1.13B implementation onward.

Не retroactively reinterpret legacy event type if semantic changed.

---

# 58. Documentation artifact

Создать/обновить:

`docs/architecture/analytics-readiness.md`

или canonical equivalent.

Документ должен содержать:
- readiness matrix;
- source-of-truth;
- critical gaps;
- reliable-from horizons;
- legacy unknown;
- funnel availability;
- current vs historical readiness;
- privacy boundary;
- future owners.

Не создавать BI design document.

---

# 59. temporal-readiness.md reconciliation

Сверить новый analytics-readiness artifact с existing `temporal-readiness.md`.

Не дублировать contradictory claims.

Если temporal-readiness называл domain «READY», но deep audit выявил historical limitation:
- обновить формулировку честно;
- не скрывать gap.

---

# 60. Deferred Decisions compliance

Не реализовывать:
- analytics dashboard;
- attribution model beyond current acquisitionSource;
- visitor identity;
- cookie/CMP;
- warehouse;
- retention policy;
- AI analytics;
- predictive metrics;
- Storefront plan analytics entitlements;
- Partner CRM analytics;
- revenue/finance analytics;
- cross-device tracking.

Если нужен product decision — Deferred candidate.

---

# 61. Full regression

Если были любые fixes/docs/tests:

Backend:
- `tsc --noEmit`;
- all unit;
- analytics-readiness targeted e2e;
- full serial e2e.

Frontend:
- `tsc --noEmit`;
- vitest;
- production build.

DB:
- migrate status;
- clean replay;
- diff/no drift.

Если schema не менялась, migration count unchanged.

---

# 62. Runtime/dev verification

На representative dev DB:
- only read/probe unless test data explicitly isolated;
- compute coverage counts;
- verify no fabricated values;
- inspect critical lifecycles.

Если smoke data needed:
- isolated DB preferred;
- clean afterward.

---

# 63. Approval criteria

Step 1.18A PASS только если:

- Product critical lifecycle history recoverable;
- Moderation chronology recoverable;
- Partner onboarding chronology recoverable;
- Buyer/Customer creation history recoverable;
- Seller identity decision chronology recoverable;
- Storefront public/entitlement history recoverable;
- behavioral raw history stable enough for declared funnels;
- canonical IDs support joins;
- actor/timestamps honest;
- no critical `updatedAt`-as-milestone;
- no fake legacy backfill;
- legacy unknown explicitly segmented;
- no irrecoverable critical Phase 1 lifecycle gaps;
- privacy boundaries preserved;
- analytics reliable-from horizons documented;
- full regression green.

---

# 64. Allowed verdicts

### A. PASS

`PHASE 1 STEP 1.18A ANALYTICS READINESS GATE PASSED — READY FOR STEP 2.0`

Это НЕ означает автоматически Phase 2 implementation start; следующий шаг — Step 2.0 Entry Audit.

### B. PASS WITH ACCEPTED LEGACY LIMITATIONS

`PHASE 1 STEP 1.18A PASSED WITH LEGACY LIMITATIONS — READY FOR STEP 2.0`

Только если critical lifecycle gaps отсутствуют, а unknown относится к pre-instrumentation legacy.

### C. LOCAL FIXES

`PHASE 1 STEP 1.18A ANALYTICS READINESS FIXES COMPLETED — WAITING FOR REVIEW`

### D. BLOCKED

`ANALYTICS READINESS BLOCKED — IRRECOVERABLE HISTORY GAP`

### E. ARCHITECTURE

`ARCHITECTURE DECISION REQUIRED`

---

# 65. Important Phase 2 boundary

Даже при PASS:

**НЕ начинать Step 2.1.**

После 1.18A по Roadmap идёт:

`Step 2.0 — Phase 2 Entry Audit`

Step 2.0 должен отдельно проверить Phase 1 results, migrations, RBAC, events, legacy endpoints и readiness Sales/Order/Booking/Finance.

---

# 66. Финальный отчёт

Вернуть:

# PHASE 1 — STEP 1.18A — ANALYTICS READINESS GATE — ОТЧЁТ

1. Verdict
2. Repository baseline
3. Sources inspected
4. Analytics-ready definition
5. Full readiness matrix
6. Product readiness
7. Product publication history
8. Moderation readiness
9. Seller identity readiness
10. Partner onboarding readiness
11. Buyer/Customer readiness
12. Storefront lifecycle readiness
13. Entitlement history
14. Storefront content-history classification
15. Marketplace behavioral readiness
16. Storefront behavioral readiness
17. Behavioral semantic stability
18. Session/visitor limitations
19. Acquisition/source readiness
20. AuditLog boundary
21. Business-event analytics
22. Event occurredAt audit
23. Communication readiness
24. Order/Booking readiness
25. Repeatable lifecycle matrix
26. Actor completeness
27. Canonical entity references
28. Historical identity references
29. Legacy data audit
30. Irrecoverable history assessment
31. Critical vs non-critical gaps
32. Marketplace funnel readiness
33. Storefront funnel readiness
34. Seller analytics readiness
35. Partner analytics readiness
36. Buyer analytics readiness
37. Privacy/data minimization
38. Retention assumptions
39. Timezone semantics
40. Timestamp monotonicity
41. Migration temporal audit
42. Schema changes/fixes
43. History immutability
44. Event immutability
45. Dedup/count integrity
46. Data-quality tests
47. Analytics-readiness E2E
48. Storefront cycle proof
49. Product cycle proof
50. Moderation cycle proof
51. Behavioral funnel proof
52. Representative query feasibility
53. Active interval reconstruction
54. Current-state vs historical readiness
55. Data coverage report
56. Legacy unknown classification
57. Reliable-from horizons
58. Event/schema semantic horizons
59. Docs/artifacts
60. temporal-readiness reconciliation
61. Deferred Decisions compliance
62. Full regression
63. Runtime/data verification
64. Issues/fixes
65. Remaining gaps/debt
66. Architecture decision status
67. Step 2.0 prerequisites
68. Out-of-scope confirmation

Финальная строка должна быть одной из разрешённых в §64.

Не переходить к Step 2.0 автоматически.
