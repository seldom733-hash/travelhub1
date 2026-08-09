# PHASE 1 — STEP 1.13B: MARKETPLACE BEHAVIORAL EVENTS FOUNDATION

## 0. Контекст и границы

Предыдущие шаги считаются закрытыми:

- Step 1.11 — Public Seller Identity & Anti-Disintermediation;
- Step 1.12.1 — Storefront Domain & Backend Foundation;
- Step 1.12.2 — Storefront Frontend / Public Site Foundation;
- Step 1.12.3 — Storefront Behavioral Events Foundation;
- Step 1.13 — Buyer Cabinet Foundation;
- Step 1.13A — Temporal & Analytics Readiness Foundation — APPROVED.

Этот Step расширяет behavioral instrumentation на **Public Marketplace**.

Это НЕ Analytics/BI engine и НЕ Phase 2.

Не переходить к:
- Step 1.14 Canonical Order Events;
- Step 1.15 Correlation / Request ID Infrastructure;
- Checkout / Cart / Sale / Order creation;
- Booking creation;
- Payment / Finance;
- Partner CRM;
- subscription billing;
- analytics dashboards/aggregation.

---

# 1. Главная цель

Создать минимальный, durable, privacy-safe фундамент behavioral events для публичного Marketplace, совместимый с уже реализованным Storefront Behavioral Events Step 1.12.3.

Нужно начать честно фиксировать реальные пользовательские взаимодействия с Marketplace сейчас, чтобы будущая аналитика могла считать:

- visits;
- product impressions;
- product views;
- category/search interactions;
- seller interactions;
- начало будущего purchase funnel — только когда реальный CTA уже существует.

Не симулировать события, которых UI фактически не производит.

---

# 2. Architecture / ownership review

Перед реализацией проверить ADR-0008 и текущую Storefront behavioral architecture.

Нужно решить минимально:

### Preferred direction

Не создавать второй несовместимый analytics mechanism.

Marketplace behavioral events должны использовать совместимый event envelope и общую semantic discipline со Storefront events.

Допустимы:

A. расширение текущей behavioral event foundation до marketplace scope;

или

B. общий catalog behavioral event abstraction с отдельными source/context fields.

Не создавать новый bounded context `Analytics`, если для Step 1.13B это преждевременно.

Если существующая `catalog.StorefrontBehavioralEvent` архитектурно невозможно безопасно расширить без ломки ownership/semantics — вернуть:

`ARCHITECTURE DECISION REQUIRED`

до реализации.

---

# 3. Publication ≠ acquisition ≠ behavioral context

Сохранить разделение:

## Publication channel
Где Product опубликован:
- MARKETPLACE
- PARTNER_STOREFRONT

## Acquisition source
Откуда пришёл пользователь/будущая сделка:
- MARKETPLACE
- PARTNER_STOREFRONT
- DIRECT

## Behavioral context
Где произошло конкретное interaction:
- Marketplace home;
- search;
- category;
- Marketplace PDP;
- seller surface;
- Storefront.

Не выводить acquisition source только из publication channel.

Для Marketplace behavioral events сервер authoritative устанавливает:

`acquisitionSource = MARKETPLACE`

если interaction действительно относится к Marketplace public surface.

---

# 4. Event taxonomy

Минимальный набор событий должен соответствовать реально существующему UI.

Обязательно рассмотреть:

- `MARKETPLACE_VIEWED`
- `MARKETPLACE_PRODUCT_IMPRESSION`
- `MARKETPLACE_PRODUCT_VIEWED`
- `MARKETPLACE_SEARCH_PERFORMED`
- `MARKETPLACE_CATEGORY_VIEWED`

Дополнительно — только если реальный UI уже имеет соответствующее действие:

- `MARKETPLACE_SELLER_VIEWED`
- `MARKETPLACE_FILTER_APPLIED`
- `MARKETPLACE_SORT_CHANGED`
- `MARKETPLACE_CTA_CLICKED`

Не добавлять:
- CHECKOUT_STARTED;
- ORDER_CREATED;
- BOOKING_STARTED;
- PAYMENT_STARTED;
- PURCHASED;
- CONVERTED

если соответствующего реального flow ещё нет.

---

# 5. Event semantic definitions

Каждый event type должен иметь точную семантику.

## MARKETPLACE_VIEWED

Публичная Marketplace home реально открыта пользователем.

Не:
- API fetch;
- SSR metadata fetch;
- preview/internal route;
- health check.

## MARKETPLACE_PRODUCT_IMPRESSION

Карточка Product реально представлена пользователю.

На этом Step допустима та же семантика, что у Storefront:

**rendered-card impression**

если viewport tracking ещё не реализуется.

Это должно быть явно задокументировано.

Не считать API search result автоматически impression.

## MARKETPLACE_PRODUCT_VIEWED

Публичный Marketplace PDP реально открыт.

## MARKETPLACE_SEARCH_PERFORMED

Пользователь реально выполнил Marketplace search.

Нужно определить точный trigger:
- submit;
- debounced committed query;
- URL query transition.

Не отправлять event на каждый keystroke.

## MARKETPLACE_CATEGORY_VIEWED

Открыта конкретная публичная category surface.

Category должна server-side резолвиться по canonical identifier/slug.

## FILTER/SORT

Только если соответствующий state реально существует в UI и interaction можно однозначно определить.

---

# 6. Durable data model

Нельзя хранить Marketplace analytics только в console/logs/frontend.

Нужен durable persistence contract.

Перед созданием новой таблицы проверить возможность безопасного generalized model.

Целевой минимум behavioral record:

- `eventId`
- `eventType`
- `occurredAt`
- `receivedAt`
- `sessionId`
- `acquisitionSource`
- marketplace context
- `productId?`
- `categoryId?`
- `locale?`
- `path?`
- strict typed payload

Не хранить raw Product/Seller/Category snapshots без необходимости.

---

# 7. Compatibility with Storefront behavioral events

Не создавать две несовместимые event envelopes.

Marketplace и Storefront должны согласованно трактовать:

- eventId;
- occurredAt;
- receivedAt;
- sessionId;
- locale;
- acquisitionSource;
- path;
- deduplication;
- privacy;
- neutral-drop semantics;
- public ingestion failure behavior.

Если делается generalized behavioral model, миграция существующих Storefront events должна быть безопасной и доказуемой.

Не переписывать исторические события без необходимости.

---

# 8. Anonymous session model

Переиспользовать существующую Step 1.12.3 discipline.

`sessionId`:
- opaque;
- non-PII;
- no fingerprinting;
- no raw IP;
- no email/phone;
- no cross-device identity graph.

Marketplace и Storefront в одной browser session могут использовать один anonymous sessionId, если это уже текущий безопасный frontend contract.

Не вводить persistent `visitorId` без отдельного privacy/product decision.

---

# 9. Authenticated BUYER boundary

Если пользователь залогинен как BUYER и посещает Marketplace:

behavioral event не должен автоматически превращаться в CRM/customer tracking.

По умолчанию:
- sessionId остаётся behavioral identifier;
- User ID / customerId не принимать с клиента;
- не хранить email;
- не хранить CRM identity;
- не создавать cross-device graph.

Если сервер может authenticated-context безопасно добавить user reference, но это меняет privacy/analytics contract — НЕ делать без отдельного решения.

---

# 10. Public ingestion API

Создать/расширить anonymous ingestion endpoint.

Возможные формы:

`POST /api/v1/public/marketplace/events`

или generalized:

`POST /api/v1/public/behavioral-events`

Выбор должен соответствовать фактической architecture после review.

Response:
- lightweight;
- без internal state;
- желательно `202 { accepted: true }`.

Не раскрывать, почему hidden/unpublished object был rejected/dropped.

---

# 11. Trusted vs client-supplied fields

Client может поставлять только безопасный минимум:

- eventId;
- eventType;
- occurredAt;
- sessionId;
- locale;
- path;
- event-specific safe payload;
- public slug/reference, если нужен resolution.

Server authoritative определяет:

- acquisitionSource;
- canonical productId;
- canonical categoryId;
- seller/storefront IDs, если вообще нужны;
- receivedAt.

Запретить forged:
- productId;
- categoryId;
- partnerId;
- sellerId;
- storefrontId;
- customerId;
- userId;
- actorId;
- acquisitionSource;
- internal status.

---

# 12. Public Product predicate

Product event разрешён только если Product действительно public в Marketplace:

- Product publishable/current public status;
- MARKETPLACE publication channel enabled;
- соответствующий public predicate;
- не DRAFT;
- не ARCHIVED/hidden;
- media/internal draft state не влияет на leakage.

Использовать existing shared Marketplace public resolver/predicate.

Не создавать расходящуюся копию public visibility logic.

---

# 13. Category predicate

Category event должен резолвить только реально публичную/доступную category.

Не принимать arbitrary categoryId клиента.

Если category slug неизвестен/скрыт:
- neutral semantics;
- не раскрывать existence/internal state.

---

# 14. Seller identity boundary

Marketplace behavioral events не должны ослаблять Step 1.11.

Не хранить в event:
- seller phone;
- email;
- website;
- WhatsApp;
- Telegram;
- social URL;
- legal/tax data;
- raw CRM Partner;
- precise address.

Если фиксируется seller interaction — хранить только server-resolved public seller identity reference/semantic event, если он реально нужен.

---

# 15. Search event privacy

`MARKETPLACE_SEARCH_PERFORMED` требует отдельной осторожности.

По умолчанию НЕ хранить бесконтрольно raw arbitrary search text, если оно может содержать PII.

Предпочтительные варианты:

A. strict normalized/truncated query с privacy guard;

B. query metadata вместо полного текста;

C. вообще не хранить raw query на этом Step, если privacy boundary не готов.

Если raw query сохраняется:
- max length;
- normalization;
- запрет email/phone/URL/contact-like content;
- no arbitrary JSON;
- documented retention/privacy risk.

Если безопасный контракт нельзя определить — событие Search можно реализовать без raw query content.

---

# 16. Filter / sort payload

Если реализуются FILTER/SORT events:

payload только whitelist.

Пример:
- filter key;
- normalized option code;
- sort enum.

Не принимать arbitrary nested object.

Не хранить весь frontend state dump.

---

# 17. Product impression payload

Минимум:
- product public reference/slug для server resolution;
- placement enum/context;
- optional position/index, если deterministic и полезен.

Не хранить:
- price snapshot без доказанной необходимости;
- seller contact;
- entire Product JSON;
- DOM data.

Если position используется, определить zero/one-based semantics.

---

# 18. Deduplication

`eventId` должен быть globally/logically unique согласно текущей foundation.

Повторная доставка:
- не создаёт вторую запись;
- возвращает neutral accepted semantics.

Frontend StrictMode / rerender не должен удваивать logical event.

---

# 19. Temporal semantics

Переиспользовать Step 1.13A / 1.12.3:

- occurredAt = client action time;
- receivedAt = server receive/persist time;
- UTC;
- bounded skew;
- no ordering by auto-increment;
- no `updatedAt` as event time.

Не создавать processing timestamps без необходимости.

---

# 20. Neutral drop semantics

Для syntactically valid event, который ссылается на:
- unknown Product;
- non-public Product;
- Storefront-only Product;
- hidden category;
- stale public slug;

не раскрывать внутреннее состояние.

Допустим:
`202 { accepted: true }`
и 0 persisted rows.

Malformed/forged payload:
- 400/422.

Persistence failure:
- observable server error;
- не притворяться accepted, если durability требовалась.

---

# 21. Frontend instrumentation

Переиспользовать/обобщить существующий `behavioral-events.ts`.

Требования:
- no Authorization header для public behavioral ingestion;
- fire-and-forget;
- bounded failure behavior;
- `keepalive` где уместно;
- no navigation blocking;
- StrictMode-safe fire-once;
- locale context;
- shared anonymous sessionId.

Инструментировать фактические Marketplace surfaces:

- home;
- search;
- category;
- ProductCard;
- Marketplace PDP.

Не инструментировать internal `/app/*`, `/partner/*`, `/account/*` этим public Marketplace event contract.

---

# 22. SSR / React behavior

Не допустить ложных событий из:
- `generateMetadata`;
- server component render;
- data prefetch;
- React StrictMode duplicate effects;
- route prefetch.

Behavioral event должен означать пользовательское interaction/page presentation, а не backend render.

---

# 23. Impression semantics

Если используется rendered-card semantics:

задокументировать:

`IMPRESSION = ProductCard committed/rendered on public Marketplace surface`

Это пока НЕ гарантированный viewport exposure.

Viewport/IntersectionObserver analytics можно оставить future enhancement.

Главное — одинаковая семантика и отсутствие двойного счёта.

---

# 24. Search trigger semantics

Определить один canonical trigger.

Например:
- committed URL search state;
- form submit;
- debounced final query.

Тест должен доказать:
- typing `b` → `ba` → `bak` не создаёт 3 logical searches, если пользователь ещё не committed search;
- один committed search → один event;
- route rerender → не дублирует.

---

# 25. Marketplace vs Storefront isolation

Проверить:

Marketplace interaction:
`acquisitionSource = MARKETPLACE`

Storefront interaction:
`acquisitionSource = PARTNER_STOREFRONT`

Один Product, опубликованный BOTH, не меняет source текущего interaction.

Product publication channel не должен мутировать из behavioral events.

---

# 26. AuditLog separation

Behavioral events не пишутся в AuditLog.

AuditLog = authenticated/security/business mutation audit.

Behavioral event = interaction telemetry.

Проверить count/invariant e2e.

---

# 27. Domain events / Outbox separation

Не публиковать каждый page view/impression в domain Outbox только потому, что outbox существует.

Behavioral telemetry ≠ domain event.

Если future analytics consumer потребуется — решать отдельным механизмом/step.

---

# 28. Retention boundary

Не изобретать полную retention policy, если она deferred.

Но документировать:
- behavioral table не должна считаться вечным storage по умолчанию;
- session/search payload privacy;
- future retention/aggregation decision.

Не удалять существующие events произвольно.

---

# 29. Index strategy

Добавить только обоснованные indexes для будущих aggregations/debugging.

Рассмотреть:
- eventType + occurredAt;
- productId + occurredAt;
- categoryId + occurredAt;
- acquisitionSource + occurredAt;
- sessionId;
- eventId unique.

Не дублировать существующие indexes без необходимости.

---

# 30. Analytics readiness — что должно стать возможным

После Step 1.13B raw data должна позволять в будущем считать без реконструкции из access logs:

- Marketplace visits;
- Product impressions;
- Product PDP views;
- category views;
- search executions;
- impression → PDP-view funnel;
- Marketplace vs Storefront source comparison;
- per-product interaction counts;
- session-level navigation sequence в пределах privacy-safe session.

НЕ реализовывать сейчас:
- dashboard;
- aggregation jobs;
- conversion rate UI;
- warehouse;
- BI;
- attribution model;
- revenue analytics.

---

# 31. Acquisition propagation boundary

Step 1.13B создаёт только behavioral acquisition context.

Не писать acquisitionSource в:
- Order;
- Booking;
- Payment;
- Sale

пока соответствующие canonical flows не реализованы.

Но event/data contract должен быть совместим с будущей propagation.

---

# 32. Security / abuse cases

Обязательно проверить:

- forged productId;
- forged categoryId;
- forged seller/partner;
- forged acquisitionSource;
- malformed eventId;
- duplicate eventId;
- malformed sessionId;
- arbitrary eventType;
- oversized payload;
- nested arbitrary JSON;
- raw email/phone/token;
- URL/contact leakage;
- unknown Product;
- Storefront-only Product;
- DRAFT/ARCHIVED Product;
- hidden/unknown category;
- stale slug;
- invalid locale;
- invalid path;
- occurredAt too old/future;
- Authorization not required/sent;
- AuditLog unaffected.

---

# 33. Migration strategy

Если generalized behavioral model требует schema change:

- additive/safe;
- preserve existing Storefront events;
- no destructive migration;
- no fake event conversion;
- no guessed acquisition source for historical data unless logically guaranteed;
- deterministic;
- clean replay;
- no db push;
- migration status/diff clean.

Если Storefront existing rows мигрируются, доказать 1:1 preservation:
- eventId;
- eventType semantics;
- occurredAt;
- receivedAt;
- sessionId;
- source;
- references;
- payload.

---

# 34. ADR/docs

Обновить ADR-0008, если Marketplace behavioral scope является естественным расширением уже принятого решения.

Новый ADR создавать только если меняется:
- owner;
- storage architecture;
- privacy contract;
- event model architecture.

Также обновить temporal/analytics readiness docs при необходимости.

---

# 35. Deferred decisions

Не реализовывать deferred:
- persistent visitor ID;
- authenticated cross-device tracking;
- CMP/consent engine;
- raw search retention policy;
- analytics warehouse;
- attribution;
- revenue analytics;
- conversion dashboards.

Если нужен новый DD candidate — перечислить в отчёте, но не принимать продуктового решения самостоятельно.

---

# 36. Required unit tests

Минимум:

- event envelope;
- marketplace event type validation;
- sessionId;
- occurredAt skew;
- path validation;
- locale;
- payload whitelist per event type;
- search privacy normalization;
- impression placement/position;
- acquisition source server-authoritative;
- dedup helper/behavior;
- no contact/PII payload;
- shared Storefront compatibility if abstraction changed.

---

# 37. Required E2E tests

Минимум:

1. MarketplaceViewed accepted/persisted.
2. ProductImpression public MARKETPLACE Product persisted.
3. ProductViewed public MARKETPLACE Product persisted.
4. BOTH Product interaction source remains MARKETPLACE.
5. STOREFRONT-only Product neutral drop.
6. DRAFT Product neutral drop.
7. ARCHIVED/non-public Product neutral drop.
8. unknown Product neutral drop.
9. CategoryViewed public category persisted.
10. unknown/hidden category neutral drop.
11. SearchPerformed valid event.
12. Search raw PII/contact rejected or sanitized according to chosen contract.
13. forged productId rejected.
14. forged categoryId rejected.
15. forged acquisitionSource rejected.
16. forged partner/seller/customer/user rejected.
17. malformed sessionId rejected.
18. duplicate eventId dedup.
19. arbitrary eventType rejected.
20. oversized/arbitrary nested payload rejected.
21. occurredAt skew rejected.
22. invalid locale/path rejected.
23. AuditLog unchanged.
24. no Authorization required.
25. response leaks no internal state.
26. Storefront behavioral regression.
27. publication channels unchanged.
28. public predicates reused.
29. ProductDraft/staged internals not exposed.
30. persistence failure observable.

---

# 38. Frontend tests

Минимум:

- Marketplace home fires once;
- ProductCard impression fires once;
- PDP view fires once;
- search committed once;
- category viewed once;
- no event from SSR metadata/prefetch;
- no Authorization;
- failure-safe;
- navigation not blocked;
- shared sessionId;
- locale RU/AZ/EN;
- StrictMode no logical duplicate;
- Storefront instrumentation regression;
- account/internal routes unaffected.

---

# 39. Browser verification

На live Preview/dev:

A. Marketplace home → one MarketplaceViewed.  
B. Rendered Product cards → impressions.  
C. Open PDP → ProductViewed.  
D. Search → one SearchPerformed.  
E. Category → CategoryViewed.  
F. BOTH Product still source MARKETPLACE.  
G. Storefront-only product cannot generate persisted Marketplace Product event.  
H. No Authorization header.  
I. sessionId stable during session.  
J. locale RU/AZ/EN reflected correctly.  
K. refresh/rerender semantics do not create accidental duplicates beyond defined page-view semantics.  
L. failed telemetry does not break navigation.  
M. AuditLog unaffected.  
N. console errors = 0.  
O. smoke data cleaned.

---

# 40. Full regression

Backend:
- `tsc --noEmit`;
- unit;
- marketplace behavioral e2e;
- storefront behavioral;
- public catalog;
- category schema;
- moderation;
- product media;
- seller identity;
- storefront;
- buyer identity;
- buyer cabinet;
- auth/RBAC;
- temporal readiness;
- full serial e2e.

Frontend:
- `tsc --noEmit`;
- vitest;
- production `next build`.

Migration:
- fresh test DB;
- `migrate deploy`;
- `migrate status`;
- diff/no drift.

---

# 41. Definition of Done

Step завершён только если:

- Marketplace behavioral events durable;
- semantic definitions документированы;
- public predicates server-authoritative;
- acquisitionSource не forgeable;
- publication ≠ acquisition сохранено;
- Marketplace/Storefront source isolation доказана;
- no PII/contact leakage;
- no raw internal IDs from client;
- dedup работает;
- temporal semantics корректны;
- StrictMode/SSR не создают ложные logical events;
- AuditLog/Outbox separation сохранена;
- future analytics сможет считать базовые Marketplace interactions;
- analytics engine/dashboard НЕ реализованы;
- Order/Booking/Payment не изменены;
- regression green.

---

# 42. Architecture decision triggers

Остановиться и вернуть:

`ARCHITECTURE DECISION REQUIRED`

если для реализации необходимо:

- создать новый Analytics bounded context;
- перенести ownership существующих Storefront events;
- destructive migration behavioral data;
- связать telemetry с authenticated Customer/User;
- ввести persistent visitor tracking;
- изменить acquisition semantics;
- писать behavioral events в Order/Booking/Payment;
- ослабить Step 1.11 seller privacy.

---

# 43. Формат итогового отчёта

Вернуть:

# PHASE 1 — STEP 1.13B — ОТЧЁТ

1. Current → Target mapping
2. Architecture / ownership decision
3. Storefront compatibility
4. Data model / migration
5. Event taxonomy
6. Event semantic definitions
7. Event envelope
8. Publication vs acquisition vs behavioral context
9. Trusted vs client-supplied fields
10. Anonymous session model
11. Authenticated Buyer privacy boundary
12. Public ingestion API
13. Marketplace Product predicate
14. Category predicate
15. Search privacy contract
16. Impression semantics
17. Deduplication
18. Temporal semantics
19. Neutral-drop semantics
20. Frontend instrumentation
21. SSR/StrictMode protections
22. Marketplace ↔ Storefront isolation
23. AuditLog / Outbox separation
24. Security/privacy
25. Index/performance
26. Analytics readiness achieved
27. Acquisition propagation boundary
28. Migration safety/replay
29. ADR/docs changes
30. Unit tests
31. E2E tests
32. Frontend tests
33. Browser verification
34. Full regression
35. Migration status/drift
36. Issues found/fixed
37. Deferred Decision candidates
38. Remaining analytics debt
39. Out-of-scope confirmation
40. ARCHITECTURE DECISION REQUIRED

Не переходить к Step 1.14 / 1.15 / Phase 2.

Финальная строка:

`PHASE 1 STEP 1.13B COMPLETED — WAITING FOR REVIEW`
