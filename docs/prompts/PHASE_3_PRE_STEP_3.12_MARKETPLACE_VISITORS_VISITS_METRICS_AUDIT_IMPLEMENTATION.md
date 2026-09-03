# PHASE 3 — PRE-STEP 3.12 — MARKETPLACE VISITORS & VISITS METRICS AUDIT + IMPLEMENTATION

## STATUS

**Task type:** Audit-first implementation  
**Scope:** Platform Analytics (`/app/analytics`) — behavioral traffic metrics  
**Do not start implementation until the audit gates below are satisfied.**

Текущим аудитом доказано:

```text
Current «Сессии»
=
COUNT(DISTINCT sessionId)
from:
MarketplaceBehavioralEvent
+
StorefrontBehavioralEvent
```

При этом:

- `sessionId` — анонимный browser session identifier;
- это НЕ unique visitor;
- это НЕ auth/JWT session;
- Marketplace и Storefront сейчас смешиваются в одной метрике;
- Storefront behavioral analytics относится прежде всего к Partner / Storefront Analytics;
- для Platform Marketplace Analytics требуется отдельный Marketplace scope.

Целевая продуктовая модель:

```text
Посетители Marketplace
→ уникальные посетители Marketplace
→ COUNT(DISTINCT visitorId)

Посещения Marketplace
→ отдельные browser sessions Marketplace
→ COUNT(DISTINCT sessionId)
```

Пример:

```text
Посетители Marketplace     8
Посещения Marketplace     11
```

Один visitor может иметь несколько visits/sessions.

---

# LANGUAGE REQUIREMENT — MANDATORY

Все создаваемые/обновляемые отчёты и prose documentation должны быть преимущественно **на русском языке**:

- Implementation Report;
- Remediation Report;
- Strict Review Report;
- Evidence / Runtime Report;
- findings;
- root cause analysis;
- architecture decisions;
- security/privacy findings;
- runtime evidence descriptions;
- conclusions;
- recommendations;
- verdict explanations.

English разрешён только для technical identifiers: paths, class/method/DTO/model/table/field names, endpoints, HTTP methods/status codes, CLI/Git commands, commit messages, enums, permission IDs, code snippets и standardized `VERDICT`.

Если отчёт преимущественно на английском — задача не завершена.

**Не включать plaintext passwords, tokens, cookies, visitor IDs, session IDs, secrets или credentials.**

---

# 1. HARD ARCHITECTURAL CONTRACT

Platform Analytics:

```text
Marketplace traffic
→ Platform Marketplace Analytics

Storefront customer traffic
→ Partner / Storefront Analytics
```

Поэтому:

```text
Platform Marketplace Visitors
≠ Storefront Visitors

Platform Marketplace Visits
≠ Storefront Visits
```

И текущая формула:

```text
Marketplace sessions + Storefront sessions
```

не должна оставаться canonical formula для Platform Marketplace traffic KPI.

Storefront events **не удалять** и не прекращать собирать.

---

# 2. STAGE A — AUDIT VISITOR IDENTITY BEFORE IMPLEMENTATION

## A1. Find existing visitor identity

До создания новой метрики найти в проекте всё, что может играть роль persistent anonymous visitor identity:

```text
visitorId
anonymousId
clientId
deviceId
browserId
trackingId
analyticsId
```

Проверить:

```text
frontend telemetry
behavioral-events.ts
API DTO
MarketplaceBehavioralEvent
StorefrontBehavioralEvent
Prisma schema
analytics services
cookies/localStorage
```

Не создавать новый identifier, пока не доказано, что подходящего существующего нет.

---

## A2. Visitor identity contract

Чтобы identifier мог использоваться для:

```text
COUNT(DISTINCT visitorId)
```

он должен семантически означать одного анонимного browser visitor между несколькими sessions.

Доказать:

```text
visitorId survives session changes
visitorId does not regenerate for every page view
visitorId does not regenerate for every session
visitorId is not JWT/userId
visitorId is opaque
visitorId does not contain PII
```

---

## A3. Visitor vs Session

Зафиксировать контракт:

```text
visitorId
→ persistent anonymous browser identity

sessionId
→ one browsing session
```

Expected relationship:

```text
visitorId A
├── sessionId 1
├── sessionId 2
└── sessionId 3
```

Следовательно для одного и того же корректного Marketplace population/period обычно:

```text
Visitors <= Visits
```

Но не использовать это как единственное доказательство корректности.

---

## A4. Persistence semantics

Установить:

```text
где хранится visitorId
сколько живёт
что происходит после browser restart
что происходит после logout
что происходит после login
что происходит после очистки storage
что происходит в другом browser/device
```

Не пытаться fingerprint-ить пользователя.

---

## A5. Privacy / security gate

Запрещено создавать invasive fingerprinting.

Visitor identity должна быть:

```text
opaque
first-party
non-PII
purpose-limited to analytics
```

Проверить применимые consent/privacy механизмы проекта.

Не использовать:

```text
IP address
raw User-Agent fingerprint
email
phone
name
JWT subject
```

как anonymous visitor identity.

---

## A6. Audit result

Stage A должен завершиться одним из вариантов:

```text
A. EXISTING VISITOR ID IS VALID
B. EXISTING IDENTIFIER EXISTS BUT IS NOT VALID FOR UNIQUE VISITORS
C. NO VISITOR ID EXISTS
```

Если `B` или `C`, описать минимальный корректный design before implementation.

---

# 3. STAGE B — FREEZE TARGET METRIC CONTRACTS

До изменения кода зафиксировать:

## Metric 1

```text
Visible name RU: Посетители Marketplace
Visible name AZ: Marketplace ziyarətçiləri
Visible name EN: Marketplace Visitors

Formula:
COUNT(DISTINCT visitorId)

Source:
MarketplaceBehavioralEvent only

Period:
occurredAt ∈ [from,to)
```

Фактическое поле/source подтвердить Stage A.

## Metric 2

```text
Visible name RU: Посещения Marketplace
Visible name AZ: Marketplace ziyarətləri
Visible name EN: Marketplace Visits

Formula:
COUNT(DISTINCT sessionId)

Source:
MarketplaceBehavioralEvent only

Period:
occurredAt ∈ [from,to)
```

**StorefrontBehavioralEvent не входит ни в одну из этих Platform Marketplace KPI.**

---

# 4. TERMINOLOGY CONTRACT

Product UI должен использовать:

```text
Посетители Marketplace
Посещения Marketplace
```

Не использовать для этих KPI:

```text
Сессии
Уникальные посетители
```

если формула/identity contract не соответствует названию.

Tooltip/help text:

### Посетители Marketplace

```text
Количество уникальных посетителей TravelHub Marketplace за выбранный период.
Один посетитель может совершить несколько посещений.
```

### Посещения Marketplace

```text
Количество отдельных посещений TravelHub Marketplace за выбранный период.
Один посетитель может совершить несколько посещений.
```

Локализовать RU/AZ/EN.

---

# 5. STAGE C — IMPLEMENT VISITOR IDENTITY IF REQUIRED

Выполнять только если Stage A доказал отсутствие подходящего visitor identifier.

Создать минимальный first-party anonymous `visitorId`.

Requirements:

```text
opaque random ID
persistent across multiple sessions
no PII
no fingerprinting
independent from auth identity
```

Не менять существующую `sessionId` semantics.

---

# 6. EVENT MODEL

Marketplace behavioral events должны иметь возможность связать:

```text
visitorId
sessionId
occurredAt
eventType
```

Если schema требует изменения:

- migration required;
- backward compatibility assessed;
- existing representative data preserved;
- no destructive reset/reseed.

Не добавлять Storefront-specific behavior в Marketplace formula.

---

# 7. HISTORICAL DATA — HARD RULE

Если historical Marketplace events не имеют `visitorId`, **не придумывать visitorId задним числом**.

Запрещено:

```text
visitorId = sessionId
```

для исторических данных только ради заполнения KPI, потому что это превратит Visitors в Visits.

Вместо этого выбрать честную стратегию:

```text
Visitors metric available from telemetry cutover date
```

или иной доказуемо корректный подход.

Report должен явно описать historical-data limitation.

---

# 8. API CONTRACT

Platform Analytics API должен возвращать две независимые метрики.

Conceptually:

```text
marketplaceVisitors
marketplaceVisits
```

Имена могут соответствовать существующей архитектуре naming conventions, но должны быть однозначными.

Не оставлять ambiguous field `sessions`, если оно продолжает означать Marketplace + Storefront.

Если backward compatibility требует временно сохранить old field:

```text
mark deprecated
document semantics
do not use it for new Platform KPI
```

---

# 9. BACKEND FORMULAS

Required target semantics:

```text
MarketplaceVisitors(from,to)
=
COUNT(DISTINCT visitorId)
FROM MarketplaceBehavioralEvent
WHERE occurredAt >= from
  AND occurredAt < to
```

и:

```text
MarketplaceVisits(from,to)
=
COUNT(DISTINCT sessionId)
FROM MarketplaceBehavioralEvent
WHERE occurredAt >= from
  AND occurredAt < to
```

Добавить остальные реальные server-authoritative filters, если они необходимы.

**Не включать `StorefrontBehavioralEvent`.**

---

# 10. NULL VISITOR ID SEMANTICS

Если часть Marketplace events не имеет `visitorId`, определить и документировать:

```text
COUNT(DISTINCT visitorId)
```

не должен превращать `NULL` в искусственного visitor.

Показать:

```text
events total
events with visitorId
events without visitorId
coverage %
```

Visitors KPI нельзя объявлять полностью исторически сопоставимым, если telemetry coverage неполная.

---

# 11. FRONTEND

В `/app/analytics` заменить ambiguous traffic representation на две KPI cards:

```text
Посетители Marketplace
Посещения Marketplace
```

Обе должны:

- использовать shared KPI/card architecture;
- поддерживать period selector;
- поддерживать comparison только если backend comparison semantics корректны;
- использовать canonical localization;
- не зависеть от translated label для metric routing.

---

# 12. CARD ORDER / UX

Расположить две метрики рядом или логически последовательно:

```text
Посетители Marketplace
Посещения Marketplace
```

Чтобы пользователь мог читать:

```text
8 посетителей
11 посещений
```

Не перегружать card техническими словами `visitorId/sessionId`.

Technical definition — tooltip/help.

---

# 13. PERIOD CONTRACT

Обе метрики должны использовать одинаковый canonical period contract:

```text
occurredAt ∈ [from,to)
```

и project-wide calendar/explicit custom semantics.

Важно: rolling period и calendar month могут не быть вложенными.

Не считать:

```text
3 дня > месяц
```

аномалией без проверки actual effective intervals.

---

# 14. COMPARISON

Если comparison включён:

```text
current visitors vs previous visitors
current visits vs previous visits
```

Current/comparison formulas и scopes должны совпадать.

Проверить:

```text
zero denominator
null
new telemetry cutover
```

---

# 15. STOREFRONT ANALYTICS PRESERVATION

Не удалять:

```text
StorefrontBehavioralEvent
storefront visitor/session telemetry
```

Эти данные нужны Partner / Storefront Analytics.

Если Platform имеет отдельную internal product-health telemetry, это отдельный будущий/существующий use case, но **не Marketplace traffic KPI**.

---

# 16. CONVERSION / FUNNEL NON-REGRESSION

Предыдущий audit установил, что текущая `Сессии`:

```text
не используется CC Conversion
не используется как funnel start
```

Повторно проверить usages перед удалением/депрекацией old field.

Не менять Conversion/Funnel formulas в рамках этой задачи, если это не требуется для устранения прямой compile/runtime regression.

Любое неожиданное dependency → report finding before semantic redesign.

---

# 17. RUNTIME RECONCILIATION — REQUIRED

Для одного или нескольких periods доказать:

## Visitors

```text
DB:
COUNT(DISTINCT MarketplaceBehavioralEvent.visitorId)
=
API marketplaceVisitors
=
UI «Посетители Marketplace»
```

## Visits

```text
DB:
COUNT(DISTINCT MarketplaceBehavioralEvent.sessionId)
=
API marketplaceVisits
=
UI «Посещения Marketplace»
```

Storefront events должны быть исключены.

---

# 18. STOREFRONT NEGATIVE CONTROL — REQUIRED

Если representative DB содержит Storefront events, доказать:

```text
add/select Storefront events
→ Platform Marketplace Visitors unchanged
→ Platform Marketplace Visits unchanged
```

Не мутировать representative DB ради теста.

Если Storefront events = 0, выполнить negative control в isolated test DB.

---

# 19. VISITOR/SESSION RELATIONSHIP TEST

В isolated test data создать:

```text
visitor A → session 1
visitor A → session 2
visitor B → session 3
```

Expected:

```text
Marketplace Visitors = 2
Marketplace Visits   = 3
```

Это обязательный semantic test.

---

# 20. PERIOD TEST

Создать contained custom intervals:

```text
A ⊆ B
```

Для count metrics expected:

```text
Visitors(A) <= Visitors(B)
Visits(A) <= Visits(B)
```

Отдельно проверить calendar month vs rolling period, не предполагая containment.

---

# 21. CROSS-SESSION VISITOR TEST

Проверить реальный/isolated lifecycle:

```text
same visitor
session expires/new session created
visitorId remains same
sessionId changes
```

Expected:

```text
Visitors +0
Visits +1
```

---

# 22. NEW VISITOR TEST

```text
new anonymous browser identity
```

Expected:

```text
Visitors +1
Visits +1 on first session
```

---

# 23. AUTH TRANSITION TEST

Если telemetry работает для anonymous/authenticated browsing:

```text
anonymous visitor → login
```

не должен автоматически превращаться в двух visitors, если canonical identity design предполагает сохранение same browser visitor.

Не связывать anonymous identities между устройствами через fingerprinting.

---

# 24. BROWSER RUNTIME — REQUIRED

Проверить `/app/analytics`:

```text
RU
AZ
EN
```

Evidence:

```text
correct labels
correct values
period switching
tooltips
no raw i18n keys
no «Сессии» ambiguous old card
```

---

# 25. SOURCE TRACEABILITY

Если KPI clickable:

- destination должен быть semantically honest;
- не отправлять Visitors/Visits в Orders;
- если authoritative traffic detail view отсутствует — KPI может быть non-clickable.

Не создавать fake Analytics detail page только ради ссылки.

---

# 26. SECURITY

Analytics endpoint remains server-authoritative.

Проверить:

```text
analytics.read
workspace authority
no Partner tenant leakage
no visitor/session raw IDs exposed unnecessarily
```

Aggregated KPI API предпочтительнее raw behavioral records.

---

# 27. TESTS

Minimum automated coverage:

```text
visitorId persistence/generation
Visitors DISTINCT visitorId
Visits DISTINCT sessionId
Marketplace-only source
Storefront excluded
visitor A / 2 sessions scenario
period filtering
NULL visitorId behavior
comparison if applicable
```

Run relevant backend/frontend tests and report actual results truthfully.

Если:

```text
282/283
```

то писать:

```text
FAIL — 282/283
```

даже если failing test pre-existing/unrelated.

---

# 28. TYPECHECK / BUILD

Run applicable:

```text
backend typecheck
backend build
frontend typecheck
frontend build
```

Любой existing unrelated failure записывать как actual `FAIL`, с classification, но не маскировать как PASS(scope).

Особенно проверить известный `storefrontSessions` mismatch и сообщить его фактический статус.

---

# 29. REPRESENTATIVE DATA SAFETY

Forbidden:

```text
database reset
representative DB reseed
deleting Storefront events
rewriting historical sessions into visitors
fabricating visitor IDs
```

Migrations must preserve existing data.

---

# 30. REQUIRED METRIC MATRIX

| Metric | Visible label | Source | Formula | Date field | Storefront included? |
|---|---|---|---|---|---|
| Marketplace Visitors | Посетители Marketplace | | | | NO |
| Marketplace Visits | Посещения Marketplace | | | | NO |

---

# 31. REQUIRED IDENTITY MATRIX

| Property | visitorId | sessionId |
|---|---|---|
| Represents | | |
| Persistence | | |
| Regenerated when | | |
| PII | NO | NO |
| Auth identity | NO | NO |
| Used for Visitors | YES | NO |
| Used for Visits | NO | YES |

---

# 32. REQUIRED DATA COVERAGE MATRIX

| Population | Events | With visitorId | Without visitorId | Coverage |
|---|---:|---:|---:|---:|
| Marketplace | | | | |
| Storefront | | | | |

Platform KPI source must remain Marketplace only.

---

# 33. REQUIRED DB/API/UI RECONCILIATION

| Metric | Period | DB | API | UI | Result |
|---|---|---:|---:|---:|---|
| Marketplace Visitors | | | | | |
| Marketplace Visits | | | | | |

Required:

```text
DB = API = UI
```

---

# 34. REQUIRED ISOLATION MATRIX

| Scenario | Visitors | Visits | Result |
|---|---:|---:|---|
| visitor A / session 1 | 1 | 1 | |
| same visitor A / session 2 | 1 | 2 | |
| visitor B / session 3 | 2 | 3 | |
| Storefront-only event added | unchanged | unchanged | |

---

# 35. REQUIRED I18N MATRIX

| Locale | Visitors | Visits |
|---|---|---|
| RU | Посетители Marketplace | Посещения Marketplace |
| AZ | Marketplace ziyarətçiləri | Marketplace ziyarətləri |
| EN | Marketplace Visitors | Marketplace Visits |

If native-language review identifies a more natural AZ phrasing without changing semantics, document it explicitly.

---

# 36. ROADMAP / DOCUMENTATION

Update canonical roadmap additively:

```text
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
```

Record:

```text
Marketplace Visitors metric
Marketplace Visits metric
Marketplace-only behavioral scope
visitorId vs sessionId semantic contract
Storefront telemetry exclusion from Platform Marketplace KPI
historical visitor telemetry limitation if applicable
```

Preserve roadmap history and numbering.

Do not start next stage.

---

# 37. GIT EVIDENCE

Report:

```text
Starting SHA
Implementation SHA
Final HEAD
origin/master
HEAD == origin/master
working tree status
```

Use real SHAs only.

---

# 38. REQUIRED REPORT STRUCTURE

Report predominantly in Russian:

```text
1. Executive Summary
2. Starting Repository State
3. Stage A — Existing Visitor Identity Audit
4. visitorId Semantic Contract
5. sessionId Semantic Contract
6. Privacy / Security Assessment
7. Historical Data Coverage
8. Frozen Metric Contracts
9. Backend Implementation
10. API Contract
11. Frontend Implementation
12. Marketplace / Storefront Isolation
13. Period / Comparison Semantics
14. Runtime DB/API/UI Reconciliation
15. Browser RU/AZ/EN Evidence
16. Automated Tests
17. Typecheck / Build
18. Non-Regression
19. Required Matrices
20. Roadmap Update
21. Git Evidence
22. Residual Risks
23. Final Verdict
```

---

# 39. ACCEPTANCE GATES

All required for `VERDICT A`:

```text
[ ] visitor identity semantics proven
[ ] no fingerprinting/PII
[ ] Visitors = DISTINCT visitorId
[ ] Visits = DISTINCT sessionId
[ ] both use MarketplaceBehavioralEvent only
[ ] Storefront excluded from Platform Marketplace KPI
[ ] period uses authoritative occurredAt contract
[ ] historical coverage truthfully handled
[ ] visitor A / two sessions semantic test PASS
[ ] Storefront negative control PASS
[ ] DB = API = UI Visitors
[ ] DB = API = UI Visits
[ ] RU/AZ/EN runtime PASS
[ ] no ambiguous old «Сессии» card remains in Platform Analytics
[ ] tests reported truthfully
[ ] typecheck/build reported truthfully
[ ] roadmap updated additively
[ ] Git evidence complete
```

---

# 40. VERDICT RULES

## VERDICT A — MARKETPLACE VISITORS & VISITS QUALIFIED

Only if all hard acceptance gates are proven.

## VERDICT B — REMEDIATION REQUIRED

Use if implementation exists but one or more semantic/runtime/isolation gates fail.

## VERDICT C — VISITOR IDENTITY NOT QUALIFIABLE

Use if a reliable privacy-safe visitor identity cannot currently be established.

Do **not** fake Visitors by using:

```text
visitorId = sessionId
```

---

# 41. STOP CONDITION

**STOP after implementation report.**

Do not automatically start:

- separate Strict Review;
- GMV/Financial KPI work;
- Cross-Entity Traceability;
- Booking KPI Audit;
- Final PRE-STEP 3.12 Re-Qualification;
- Step 3.12.

Implementation requires a **separate Strict Review** before being considered fully closed.
