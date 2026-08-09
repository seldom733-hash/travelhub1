# PHASE 1 — STEP 1.18: PHASE 1 EXIT AUDIT — STRICT AUDIT PROMPT

## 0. Роль и режим

Проведи финальный независимый **PHASE 1 — STEP 1.18 — Phase 1 Exit Audit** проекта TravelHub.

Это **не implementation feature-step** и не повтор Step 1.17 Hardening.

Canonical Roadmap определяет Step 1.18 как:

> GAP-анализ против актуального Master/Baseline, подтверждение Phase 1 DoD, проверка ADR/migration/security debt, незакрытых архитектурных решений и готовности к Phase 2.

Step 1.17 считать APPROVED после независимого Strict Review и RBAC review-fix.

Не переходить к:
- Step 1.18A;
- Step 2.0;
- Phase 2 implementation.

Не внедрять новые продуктовые возможности только ради того, чтобы «закрыть Phase 1».

Твоя задача — **доказать или опровергнуть готовность Phase 1 к завершению**.

Если найдена локальная blocker-проблема, относящаяся к Phase 1 и не требующая архитектурного решения, допускается точечный Exit-Audit Fix с повторной проверкой.

Если gap требует нового bounded context, нового lifecycle, нового commercial flow, новой privacy/product policy или реализации будущего шага — не исправлять скрытно. Зафиксировать как:
- BLOCKER;
- DEFERRED/FUTURE STEP;
- `ARCHITECTURE DECISION REQUIRED`.

---

# 1. Source of truth hierarchy

Перед аудитом найти и прочитать фактические актуальные документы:

1. `TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`;
2. актуальный Master Plan / Baseline;
3. Phase 1 DoD / phase1-dod, если существует;
4. ADR-0001…последний актуальный ADR;
5. amendments;
6. `contracts/api.md`;
7. `contracts/events.md`;
8. `ids.md`;
9. `temporal-readiness.md`;
10. Deferred Decisions Map;
11. architecture README/index;
12. Prisma schema и все migrations;
13. RBAC permission matrix;
14. relevant implementation/review reports только как вспомогательный history, НЕ как proof.

Если документация конфликтует:
- определить canonical authority;
- зафиксировать конфликт;
- не «усреднять» две версии.

---

# 2. Repository baseline

Зафиксировать:

- branch;
- commit;
- git status;
- user/unrelated dirty files;
- backend/frontend versions;
- DB/migration baseline;
- test DB isolation;
- standard start commands.

Не изменять unrelated user worktree.

---

# 3. Цель Exit Audit

Ответить на один главный вопрос:

> Выполнена ли Phase 1 в объёме, необходимом Roadmap/Master Plan, без скрытых blockers для Phase 2?

Разбить ответ на:

- COMPLETE;
- COMPLETE WITH ACCEPTED DEBT;
- INCOMPLETE — LOCAL FIX REQUIRED;
- INCOMPLETE — ARCHITECTURE DECISION REQUIRED;
- INCOMPLETE — FUTURE STEP MISCLASSIFIED AS PHASE 1.

---

# 4. Reconstruct actual Phase 1 scope

Не брать список завершённых шагов из отчётов на веру.

По repository + Roadmap восстановить фактически реализованные Phase 1 steps:

- 1.x до 1.11;
- 1.11 Seller Identity;
- 1.12.x Storefront;
- 1.13 Buyer Cabinet;
- 1.13A Temporal readiness;
- 1.13B Marketplace behavioral;
- 1.14 Canonical Order events;
- 1.15 Correlation;
- 1.15A Business Event Temporal Contract;
- 1.16 Communication;
- 1.17 Hardening.

Для каждого:

| Step | Roadmap requirement | Actual implementation evidence | Review status | Remaining gap | Blocking? |

Не утверждать COMPLETE только по имени файла/ADR.

---

# 5. Phase 1 DoD reconstruction

Если отдельный Phase 1 DoD документ существует — проверить его пункт за пунктом.

Если DoD распределён между Roadmap/Master/ADR:
- собрать explicit DoD matrix;
- не придумывать новые требования.

Матрица:

| DoD requirement | Evidence | PASS/FAIL/PARTIAL | Debt owner |

Exit Audit должен закончиться конкретной DoD-матрицей.

---

# 6. Baseline / Master Plan GAP analysis

Сравнить фактическую Phase 1 с актуальным Master/Baseline.

Классифицировать каждый обнаруженный gap:

### A. Real Phase 1 blocker
Требование должно было быть выполнено до Phase 2.

### B. Explicit future roadmap step
Не blocker Phase 1.

### C. Deferred Decision
Сознательно не принято продуктовое/коммерческое решение.

### D. Documentation drift
Код и canonical architecture совпадают, stale document отстал.

### E. Obsolete requirement
Только если canonical document явно superseded его.

Не закрывать B/C реализацией в Step 1.18.

---

# 7. Architecture completeness

Проверить boundaries и ownership:

- Catalog;
- Security/Auth;
- CRM;
- Order;
- Booking;
- Events;
- Communication;
- Storefront;
- Buyer/Partner surfaces.

Для каждого:
- owner;
- read/write rules;
- cross-schema policy;
- FK policy;
- events vs sync reads;
- API boundary.

Найти:
- dual ownership;
- orphan model;
- circular ownership;
- cross-domain direct write;
- undocumented schema/domain.

Любой новый ownership conflict = potential architecture blocker.

---

# 8. ADR audit

Составить таблицу всех ADR:

| ADR | Decision | Implemented? | Code consistent? | Docs consistent? | Superseded? | Gap |

Особенно проверить:

- ADR-0001 cross-schema/FK/events;
- seller identity;
- Storefront commercial model;
- Partner/CRM boundary;
- behavioral ownership;
- correlation/request context;
- Business Event Temporal Contract;
- Communication ownership.

ADR не считается выполненным только потому, что файл существует.

---

# 9. Unresolved architecture decisions

Repo/docs-wide найти:

- `TODO architecture`;
- `ARCHITECTURE DECISION REQUIRED`;
- unresolved ADR candidates;
- placeholder decisions;
- open questions;
- comments с «temporary/fallback»;
- Deferred Decisions, которые ошибочно стали runtime dependency.

Классифицировать:
- blocker before Phase 2;
- safe deferred;
- obsolete.

---

# 10. Commercial model readiness

Проверить, что Phase 1 сохраняет утверждённый контракт:

Marketplace:
- commission-oriented channel;
- contacts protected;
- anti-disintermediation;
- Marketplace identity.

Storefront:
- separate SaaS concept;
- entitlement foundation;
- own business identity/contacts;
- publication channel separate.

Проверить:
- нет скрытой commission logic, выдуманной раньше Phase 2;
- нет Billing/Subscription fake domain;
- entitlement не masquerades as paid invoice;
- publication != acquisition.

Commercial pricing/trial/plans — Deferred, не blocker Phase 1, если архитектура extension-ready.

---

# 11. Identity model readiness

Проверить:

- User;
- Customer;
- Partner;
- PublicSellerProfile;
- Storefront business identity;
- actor/system actor;
- Communication participants.

Найти:
- raw User/CRM leak;
- duplicate profile authorities;
- ambiguous ownership;
- Buyer/Partner identity conflation.

Phase 2 должна иметь однозначные canonical references.

---

# 12. RBAC exit gate — CRITICAL

После CRITICAL fix Step 1.17 повторно проверить финальную permission matrix.

Особенно PARTNER:
не должен иметь unrestricted:
- `crm.customer.read`;
- `order.read`;
- `booking.read`;
- dormant Sales/Finance/Documents/Support internal reads.

Проверить seed/reconciliation:
- fresh DB;
- existing stale grant revocation;
- no re-add on boot.

Проверить BUYER аналогично.

Exit Audit не проходит, если external role имеет broad internal permission.

---

# 13. Security debt audit

Собрать все known security debts из:

- ADR;
- review reports;
- code TODO;
- test skips;
- Deferred Decisions;
- docs.

Для каждого:

| Debt | Severity | Exploitable now? | Mitigation | Owner/Future Step | Phase 2 blocker? |

Не смешивать security debt с feature debt.

---

# 14. Privacy / PII readiness

Проверить текущие durable stores и projections:

- CRM;
- Order/Booking;
- Communication;
- Outbox/Inbox;
- AuditLog;
- behavioral events;
- logs;
- public DTO.

Known Communication retention debt оценить:
- является ли Phase 2 blocker;
- есть ли immediate unauthorized exposure;
- есть ли accepted mitigation.

Не строить retention engine, если это Deferred и не blocker.

---

# 15. Public/private boundary exit gate

Финально доказать:

- Marketplace public;
- Storefront public;
- preview private;
- Buyer private;
- Partner private;
- internal private;
- Communication private;
- behavioral anonymous but privacy-limited.

Проверить сырые response projections и route authority.

---

# 16. Marketplace/Storefront readiness for Phase 2

Phase 2 будет строить commercial flow поверх Marketplace/Storefront.

Проверить, что Phase 1 уже даёт стабильные references:

- canonical Product;
- Product/Tariff;
- publication channels;
- Storefront ID/code/slug;
- Partner;
- seller identity;
- entitlement state;
- public predicates.

Не требовать Phase 2 transaction/acquisition persistence сейчас — это future step.

Но отметить любые missing identifiers/ownership facts, из-за которых Phase 2 пришлось бы ломать Phase 1.

---

# 17. Product/Tariff readiness

Проверить:

- Product identity/lifecycle;
- tariff model;
- availability;
- category schema;
- public projections;
- ProductDraft N+1;
- moderation;
- immutable/staged content boundaries.

Не проектировать Quote/Sale сейчас.

Нужно лишь ответить: сможет ли Phase 2 безопасно ссылаться на canonical Product/Tariff и сделать snapshot?

Если нет — blocker/gap.

---

# 18. Buyer readiness

Проверить:

- Customer identity;
- Buyer Cabinet foundation;
- own read models;
- deep-link/auth;
- no broad internal permissions.

Payments/Documents/Support controlled-empty — не считать incomplete, если Roadmap относит домены в Phase 2+.

---

# 19. Partner readiness

Проверить:

- onboarding;
- approved Partner identity;
- Partner Cabinet;
- own Product;
- seller identity;
- Storefront;
- publication channels.

Full Partner CRM/analytics/billing не считать Phase 1 blocker, если Deferred/future.

---

# 20. Order/Booking transitional readiness

Phase 1 имеет foundations/legacy-like lifecycle, Phase 2 построит canonical commercial flow.

Проверить:

- Order canonical events;
- BookingRequested boundary;
- Order/Booking histories;
- object scope;
- temporary `/orders/bootstrap`, если существует;
- explicit roadmap future removal.

Не требовать Step 2.5A timestamps/Step 2.6 removal сейчас.

Но убедиться, что current temporary path не объявлен canonical Phase 2 path ошибочно.

---

# 21. Business event readiness

Проверить:

- Outbox;
- Inbox;
- event envelope;
- eventId;
- eventType;
- occurredAt;
- actor;
- entityId;
- correlation;
- causation;
- immutability;
- dedup.

Known FAILED Outbox retry debt:
- найти;
- оценить;
- определить, блокирует ли Phase 2 entry.

Не реализовывать retry scheduler автоматически в 1.18.

Если без retry междоменные business events могут необратимо теряться при обычном transient failure, это может быть Phase 2 blocker — классифицировать честно.

---

# 22. FAILED Outbox retry debt — explicit decision gate

Это известный технический долг.

Провести фактический анализ:

- что значит FAILED;
- есть ли manual recovery;
- есть ли attempts/error;
- как event publisher работает;
- возможна ли irreversible loss;
- есть ли operational repair command/runbook;
- Phase 2 будет зависеть от reliable events для Sale→Order→Booking→Finance.

Вернуть один из вариантов:

### PASS-DEFERRED
Текущий механизм достаточен до конкретного future reliability step, recovery существует.

### PHASE 2 ENTRY BLOCKER
Без retry/recovery нельзя безопасно строить commercial flow.

### ARCHITECTURE DECISION REQUIRED
Если reliability policy требует отдельного решения.

Не замалчивать debt как «не scope».

---

# 23. Temporal readiness pre-check

Step 1.18A будет отдельным analytics gate, поэтому здесь НЕ выполнять его полностью.

Но Exit Audit должен проверить, что Step 1.18A вообще можно пройти:

- temporal-readiness doc актуален;
- known gaps перечислены;
- no fabricated history;
- critical Phase 1 transitions имеют source of truth.

Если уже очевидно, что история необратимо потеряна — Step 1.18 должен остановить Phase 1 до 1.18A.

---

# 24. Behavioral instrumentation readiness

Проверить только architectural completeness:

Marketplace/Storefront behavioral events:
- durable;
- dedup;
- privacy;
- source;
- session;
- entity refs;
- no AuditLog/Outbox mixing.

Не строить analytics.

Step 1.18A будет проверять достаточность исторических данных глубже.

---

# 25. Communication readiness

Проверить Step 1.16 после fixes:

- canonical CML identity;
- owner;
- contexts;
- actor/participants;
- scope;
- privacy;
- temporal;
- no fake Support domain.

Проверить known Deferred:
- retention/archive;
- Buyer/Partner create;
- Order/Booking own view;
- attachments/read receipts.

Они не blocker Phase 1, если Roadmap/ADR так и фиксируют.

---

# 26. API contract audit

Составить список canonical API families Phase 1.

Проверить:
- route collisions;
- stale legacy endpoints;
- temporary endpoints;
- duplicate APIs for same authority;
- auth semantics;
- consistent IDs/codes.

Особенно отметить endpoints, которые Phase 2 должна удалить/заменить:
например `/orders/bootstrap`, если фактически существует.

Не удалять его в Step 1.18, если Roadmap назначает Step 2.6.

---

# 27. Legacy/deprecation inventory

Найти:

- legacy endpoints;
- legacy models;
- legacy scripts;
- deprecated events;
- compatibility adapters;
- temporary fallbacks.

Для каждого:
- active?
- production-reachable?
- owner?
- removal step?
- Phase 2 blocker?

Не удалять future-step legacy только ради «чистого exit audit».

---

# 28. Data/migration debt audit

Проверить:

- 21+ фактических migrations;
- status;
- clean replay;
- drift;
- historical checksum issues;
- raw SQL-applied migration history;
- backfills;
- nullable legacy unknown;
- schema creation;
- enum evolution;
- indexes.

Составить debt table.

Любой migration issue, который делает fresh install/recovery ненадёжным, = blocker.

---

# 29. Fresh install proof

На полностью пустой test database:

1. apply all migrations;
2. boot backend;
3. run canonical seed/reconciliation;
4. проверить expected baseline;
5. убедиться, что synthetic business data не создана;
6. выполнить selected smoke/e2e.

Это обязательное Exit Gate proof.

---

# 30. Upgrade-path proof

Если возможно безопасно воспроизвести текущую pre-latest/representative Phase 1 DB:
- apply remaining migrations;
- verify no destructive/data-loss behavior.

Если полноценный historical upgrade fixture отсутствует, зафиксировать limitation и опереться на migration SQL audit.

Не фабриковать доказательство.

---

# 31. Seed/reconciliation readiness

Проверить все startup/seed behaviors:

- roles/permissions;
- categories/schema;
- Customer reconciliation/repair;
- Seller profile repair;
- Storefront provisioning policy;
- Communication no-backfill.

Чётко разделить:
- safe idempotent seed;
- explicit repair command;
- forbidden startup data repair.

---

# 32. Business IDs readiness

Проверить canonical IDs Phase 1:

- PRD/CAT/etc фактические;
- Partner/Customer;
- ORD/BKG;
- SF;
- CML;
- другие существующие.

Найти:
- collisions;
- inconsistent prefixes;
- client-generated IDs;
- sequence race;
- missing uniqueness.

Не придумывать Phase 2 IDs вне Roadmap.

---

# 33. Error/observability readiness

Phase 2 будет сложнее event-driven.

Проверить:

- requestId;
- correlationId;
- causationId;
- errors;
- AuditLog references;
- no PII logs;
- diagnostic traceability.

Не требовать vendor APM.

Нужно ответить: может ли команда расследовать один failed business flow по существующим данным?

---

# 34. Test architecture audit

Проверить не только green counts.

Ответить:

- isolated DB?
- production-equivalent ValidationPipe?
- clean migrations?
- serial vs parallel assumptions?
- test pollution?
- smoke data cleanup?
- skipped tests?
- flaky retries masking failures?
- direct DB fixtures bypassing invariants?

Составить confidence assessment.

---

# 35. Regression exit gate

Обязательно повторить:

Backend:
- typecheck;
- unit;
- full e2e serial.

Frontend:
- typecheck;
- vitest;
- production build.

DB:
- migrate status;
- clean replay;
- diff/no drift.

Если environment blocker — не писать PASS.

---

# 36. Browser/runtime exit smoke

Проверить основные Phase 1 surfaces:

- Marketplace;
- Marketplace PDP/search/category;
- Storefront public;
- Storefront PDP;
- Buyer Cabinet;
- Partner Cabinet;
- internal shell/critical page;
- locale switch RU/AZ/EN;
- auth/login/logout/deep link;
- one communication internal flow if no frontend;
- one event lineage via API/runtime.

No console errors на проверенных flows.

Не нужно exhaustive UI QA всех экранов — это exit smoke.

---

# 37. Frontend completeness vs backend foundation

Проверить Phase 1 Roadmap: какие backend foundations сознательно не имеют UI.

Не считать отсутствующий UI gap-ом, если Roadmap/step явно создавал backend foundation.

Но найти случаи, где Phase 1 обещал полноценную рабочую поверхность, а UI реально отсутствует.

Классифицировать честно.

---

# 38. Localization exit gate

Проверить только текущий approved scope:

- RU/AZ/EN system labels;
- canonical geography localization;
- role/status labels;
- no locale-driven identity mutation.

Не требовать translation business content — Deferred.

---

# 39. Performance readiness

Не проводить load test всей системы.

Проверить blocking architectural performance issues:

- unbounded public queries;
- unbounded internal queues;
- obvious N+1;
- missing required pagination;
- missing obvious index;
- huge raw joins/snapshots.

Classify:
- blocker before Phase 2;
- acceptable Phase 1 debt.

---

# 40. Deferred Decisions audit

Прочитать всю актуальную Deferred Decisions Map.

Для каждого DD:

- действительно deferred?
- runtime не зависит от нерешённого значения?
- не реализован случайно?
- future owner/step указан?

Особенно:
- multilingual content;
- AI translation;
- Storefront trial/plans/pricing;
- recurring billing;
- Partner CRM;
- analytics capability matrix;
- custom domains;
- commissions;
- Communication retention/archive/create expansions.

Если runtime требует decision прямо сейчас — это уже не deferred, а blocker.

---

# 41. Known debt inventory

Объединить debt из:

- Step 1.17;
- strict reviews;
- ADR;
- docs;
- TODO;
- Deferred Decisions.

Классифицировать:

### Security debt
### Reliability debt
### Migration debt
### Privacy debt
### Architecture debt
### UX/SEO debt
### Performance debt
### Test debt

Для каждого severity + owner + blocking status.

---

# 42. Phase 2 dependency map

Построить:

| Phase 2 dependency | Phase 1 foundation | Ready? | Gap |

Минимум:

- Sales needs Customer/Partner/Product/Tariff;
- Sale→Order needs event infrastructure;
- Order creation needs canonical IDs/events;
- Booking needs Order boundary;
- Finance will need immutable transaction context later;
- Documents will need Order/Booking/Payment refs;
- Analytics needs 1.18A gate.

Не реализовывать Phase 2 — только readiness map.

---

# 43. Phase 2 blocker definition

Blocker — это не «фича ещё не реализована».

Blocker = Phase 1 foundation настолько неполна/небезопасна, что Phase 2 пришлось бы:
- ломать approved ownership;
- мигрировать невосстановимые данные;
- обходить security;
- строить flow на ненадёжных событиях без recovery;
- использовать неоднозначные canonical IDs;
- угадывать business history;
- переписывать фундаментальный public/private contract.

Использовать это определение строго.

---

# 44. Exit Audit fixes policy

Если найден локальный Phase 1 blocker:
- исправить только минимально;
- оформить `EXIT FIX N`;
- targeted tests;
- full regression.

Не превращать Exit Audit в новый feature sprint.

Если gap назначен на будущий Roadmap step — не исправлять сейчас.

---

# 45. Architecture decision triggers

Вернуть:

`ARCHITECTURE DECISION REQUIRED`

если readiness требует:
- смены bounded-context ownership;
- изменения Marketplace/Storefront commercial model;
- нового cross-domain write pattern;
- новой canonical identity authority;
- новой Communication participant policy;
- fundamental Outbox reliability architecture choice;
- mandatory privacy/retention policy перед Phase 2;
- destructive historical rewrite.

---

# 46. 1.18A boundary — CRITICAL

**Не выполнять Step 1.18A внутри 1.18.**

Step 1.18A отдельно должен доказать, что Product/Moderation/Partner/Buyer/Seller/Storefront имеют достаточные timestamps/events/history и нет невосстановимых lifecycle gaps.

В 1.18:
- проверить, что prerequisites присутствуют;
- перечислить вопросы, которые должен закрыть 1.18A;
- не объявлять Analytics Readiness PASS.

---

# 47. 2.0 boundary

Не выполнять Phase 2 Entry Audit вместо 1.18.

Разница:

### 1.18
Закрывает Phase 1 относительно её собственного DoD/Master/Baseline.

### 1.18A
Закрывает analytics/temporal readiness.

### 2.0
Уже после Phase 1 gates проверяет готовность начать Phase 2 commercial flow.

Не объединять три шага.

---

# 48. Required output artifacts

Создать/обновить только если соответствует repository conventions:

1. `docs/architecture/phase1-exit-audit.md` или существующий эквивалент;
2. Phase 1 DoD status matrix;
3. debt register/update, если такой документ уже существует;
4. Roadmap status update — только если проект реально ведёт statuses в этом файле и convention разрешает его изменение.

Не переписывать canonical Roadmap механически, если он используется как immutable plan.

---

# 49. Approval outcomes

Разрешены только:

## A. READY FOR 1.18A
Phase 1 DoD выполнен; blockers отсутствуют; остался следующий обязательный gate 1.18A.

Финальная строка:

`PHASE 1 STEP 1.18 EXIT AUDIT PASSED — READY FOR STEP 1.18A`

## B. EXIT FIXES COMPLETED — WAITING FOR REVIEW
Локальные blockers исправлены, нужен независимый review Exit Audit.

`PHASE 1 STEP 1.18 EXIT FIXES COMPLETED — WAITING FOR REVIEW`

## C. EXIT AUDIT FAILED — BLOCKERS REMAIN
Есть Phase 1 blockers.

## D. ARCHITECTURE DECISION REQUIRED

Нельзя писать:
- Phase 1 fully completed;
- Ready for Phase 2;

до прохождения Step 1.18A.

---

# 50. Финальный отчёт

Вернуть строго:

# PHASE 1 — STEP 1.18 — PHASE 1 EXIT AUDIT — ОТЧЁТ

1. Verdict
2. Repository baseline
3. Sources of truth
4. Actual Phase 1 step matrix
5. Phase 1 DoD matrix
6. Master/Baseline GAP analysis
7. Architecture/ownership audit
8. ADR audit
9. Unresolved architecture decisions
10. Commercial model readiness
11. Identity model readiness
12. RBAC exit gate
13. Security debt
14. Privacy/PII readiness
15. Public/private boundaries
16. Marketplace/Storefront Phase 2 readiness
17. Product/Tariff readiness
18. Buyer readiness
19. Partner readiness
20. Order/Booking transitional readiness
21. Business-event infrastructure readiness
22. FAILED Outbox retry decision gate
23. Temporal readiness pre-check
24. Behavioral instrumentation readiness
25. Communication readiness
26. API contract audit
27. Legacy/deprecation inventory
28. Migration/data debt
29. Fresh install proof
30. Upgrade-path assessment
31. Seed/reconciliation
32. Business IDs
33. Error/observability readiness
34. Test architecture confidence
35. Full regression
36. Browser/runtime exit smoke
37. Frontend completeness assessment
38. Localization
39. Performance readiness
40. Deferred Decisions audit
41. Consolidated debt register
42. Phase 2 dependency map
43. Phase 2 blockers
44. Exit fixes
45. Docs/artifacts changed
46. Step 1.18A prerequisites/questions
47. Architecture decision status
48. Out-of-scope confirmation

Не переходить к Step 1.18A автоматически.
Не начинать Phase 2.
