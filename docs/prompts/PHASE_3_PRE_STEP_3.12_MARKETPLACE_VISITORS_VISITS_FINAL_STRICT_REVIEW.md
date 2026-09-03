# PHASE 3 — PRE-STEP 3.12 — MARKETPLACE VISITORS & VISITS FINAL STRICT REVIEW

## STATUS

**Task type:** Strict Review / Re-Qualification  
**Implementation changes:** FORBIDDEN except narrowly scoped fixes discovered by this review and explicitly documented.  
**Next implementation (Platform Analytics Marketplace vs Storefront SaaS separation):** DO NOT START in this task.

Current implementation claims:

```text
MarketplaceBehavioralEvent.visitorId added
visitorId generated client-side and persisted in localStorage
Marketplace Visitors = COUNT(DISTINCT visitorId)
Marketplace Visits   = COUNT(DISTINCT sessionId)
Storefront excluded from both new Platform Marketplace KPI
old marketplaceSessions/storefrontSessions fields preserved for backward compatibility
Analytics UI now shows:
- Посетители Marketplace
- Посещения Marketplace
```

Reported runtime:

```text
3 дня:
marketplaceVisitors = 0
marketplaceVisits   = 11

Месяц:
marketplaceVisitors = 0
marketplaceVisits   = 1
```

Historical coverage:

```text
1228 Marketplace behavioral events
0 with visitorId
coverage = 0%
```

Reported checks include a contradiction that MUST be resolved:

```text
Typecheck: ✅ (pre-existing storefrontSessions mismatch only)
Tests: 282/283 (pre-existing i18n fail only)
```

A typecheck with an existing compile/type error is not PASS.
`282/283` is an actual FAIL, even if the failing test is unrelated/pre-existing.

---

# LANGUAGE REQUIREMENT — MANDATORY

Все отчёты, findings, root cause analysis, runtime/browser evidence, matrices, conclusions и verdict explanations должны быть преимущественно **на русском языке**.

English допускается только для technical identifiers: paths, methods, DTO/model/table/field names, API endpoints, HTTP methods/status codes, SQL, CLI/Git commands, enums, metric IDs, code snippets и standardized `VERDICT`.

Если отчёт преимущественно на английском — задача не завершена.

Не включать plaintext passwords, tokens, cookies, visitorId/sessionId values, secrets или credentials.

---

# 1. REVIEW GOAL

Независимо подтвердить, что реализация двух новых KPI действительно соответствует целевой семантике:

```text
Посетители Marketplace
=
COUNT(DISTINCT visitorId)
FROM MarketplaceBehavioralEvent

Посещения Marketplace
=
COUNT(DISTINCT sessionId)
FROM MarketplaceBehavioralEvent
```

и что:

```text
StorefrontBehavioralEvent
```

не участвует ни в одной из этих двух Platform Marketplace KPI.

---

# 2. REPOSITORY / GIT STATE

Зафиксировать реальные:

```text
Starting SHA
Implementation SHA
Current HEAD
origin/master
HEAD == origin/master
working tree status
```

Никаких placeholder SHA.

---

# 3. SCHEMA / MIGRATION REVIEW

Проверить migration:

```text
20260901120000_add_marketplace_visitor_id
```

Установить:

```text
visitorId nullable?
index exists?
migration applies on existing representative DB?
migration applies on fresh isolated DB?
no destructive changes?
no Storefront schema regression?
```

Если migration не проверена на fresh DB — это отдельный evidence gap.

---

# 4. VISITOR IDENTITY SEMANTIC REVIEW

Проверить `getOrCreateMarketplaceVisitorId()`.

Required contract:

```text
visitorId:
- opaque random identifier
- persistent across multiple sessions
- independent from sessionId
- independent from JWT/auth user
- non-PII
- no fingerprinting
```

Проверить storage key:

```text
travelhub.mp.visitorId
```

и generation format:

```text
vid_<32 hex chars>
```

Убедиться, что collision risk приемлем и generation использует криптографически пригодный random source, если доступен.

---

# 5. SESSION VS VISITOR LIFECYCLE

Независимо доказать:

```text
same browser visitor
→ visitorId remains same

new browsing session
→ sessionId changes
```

Required semantic test:

```text
visitor A / session 1
visitor A / session 2
visitor B / session 3
```

Expected:

```text
Visitors = 2
Visits   = 3
```

---

# 6. BACKEND FORMULA REVIEW

Проверить production query.

Target:

```text
MarketplaceVisitors(from,to)
=
COUNT(DISTINCT visitorId)
FROM MarketplaceBehavioralEvent
WHERE occurredAt >= from
  AND occurredAt < to
```

Target:

```text
MarketplaceVisits(from,to)
=
COUNT(DISTINCT sessionId)
FROM MarketplaceBehavioralEvent
WHERE occurredAt >= from
  AND occurredAt < to
```

Показать exact file/method/query.

---

# 7. STOREFRONT EXCLUSION — HARD GATE

Проверить, что новые KPI не используют:

```text
StorefrontBehavioralEvent
```

Required negative control in isolated DB if representative Storefront behavioral data are absent:

```text
Marketplace visitor/session events → baseline counts
add Storefront-only events
→ Marketplace Visitors unchanged
→ Marketplace Visits unchanged
```

Это обязательный hard gate.

---

# 8. HISTORICAL COVERAGE — CRITICAL UX REVIEW

Current historical coverage:

```text
1228 Marketplace events
visitorId present = 0
coverage = 0%
```

Следовательно новый KPI `Посетители Marketplace` закономерно показывает:

```text
0
```

для исторических периодов.

Нужно проверить, не вводит ли UI пользователя в заблуждение.

Запрещено backfill:

```text
visitorId = sessionId
```

только ради ненулевых исторических Visitors.

Нужно классифицировать UX:

```text
A. ACCEPTABLE
   because UI explicitly communicates telemetry starts from cutover date

B. MISLEADING
   because 0 appears as real historical visitor count
```

Если B — предложить минимальную честную remediation, например:

```text
— / Нет данных
«Данные собираются с <date>»
tooltip / info state
```

Но не придумывать historical visitors.

---

# 9. CUTOVER DATE

Определить точный telemetry cutover:

```text
first event with non-null visitorId
```

или, если ещё нет новых событий:

```text
implementation deployment/runtime activation timestamp
```

Зафиксировать, с какого момента KPI `Marketplace Visitors` становится квалифицируемым.

---

# 10. NULL SEMANTICS

Проверить поведение:

```text
COUNT(DISTINCT visitorId)
```

при 100% NULL historical data.

Убедиться, что:

```text
NULL visitorId
≠ one synthetic visitor
```

и что frontend не превращает:

```text
null / unavailable
```

в misleading `0`, если product contract требует `No data`.

---

# 11. API CONTRACT

Проверить:

```text
marketplaceVisitors
marketplaceVisits
marketplaceSessions
storefrontSessions
```

Установить:

- new fields have unambiguous semantics;
- old fields are genuinely backward-compatible;
- old ambiguous fields are not used by new Platform Analytics KPI;
- deprecation status documented if appropriate.

---

# 12. FRONTEND UI REVIEW

На `/app/analytics` проверить:

```text
Посетители Marketplace
Посещения Marketplace
```

Не должно оставаться ambiguous card:

```text
Сессии
```

для того же metric position.

Проверить card order, values, tooltip/help text and comparison behavior.

---

# 13. I18N — RU/AZ/EN

Required browser verification:

```text
RU:
Посетители Marketplace
Посещения Marketplace

AZ:
Marketplace ziyarətçiləri
Marketplace ziyarətləri

EN:
Marketplace Visitors
Marketplace Visits
```

Проверить:

```text
no raw i18n keys
no fallback language
no semantic mismatch between locales
```

---

# 14. BROWSER RUNTIME — REQUIRED

Code/unit evidence alone недостаточны.

В реальном browser подтвердить:

```text
/app/analytics
RU
AZ
EN
```

и минимум два периода.

Зафиксировать:

```text
UI value
API value
effective period
```

---

# 15. DB → API → UI RECONCILIATION

После появления хотя бы одного нового Marketplace event с visitorId доказать:

## Visitors

```text
DB COUNT(DISTINCT visitorId)
=
API marketplaceVisitors
=
UI Marketplace Visitors
```

## Visits

```text
DB COUNT(DISTINCT sessionId)
=
API marketplaceVisits
=
UI Marketplace Visits
```

Если в representative runtime ещё нет event с visitorId, Visitors runtime reconciliation = `NOT QUALIFIABLE YET`, а не PASS.

---

# 16. PERIOD SEMANTICS

Проверить:

```text
occurredAt ∈ [from,to)
```

для обеих KPI.

Не повторять ошибочное предположение:

```text
3 дня ⊆ текущий календарный месяц
```

без проверки actual intervals.

---

# 17. COMPARISON

Если cards показывают comparison:

```text
Visitors current vs previous
Visits current vs previous
```

Проверить:

```text
same formula
same source
same scope
same period-length semantics
historical visitor coverage
```

Если previous period до visitor telemetry cutover — comparison Visitors может быть неквалифицируемым/вводящим в заблуждение.

---

# 18. PRIVACY / SECURITY

Проверить:

```text
no PII in visitorId
no fingerprinting
no raw visitorId/sessionId unnecessarily returned by aggregate Analytics API
analytics.read enforced server-side
```

Не выводить реальные identifiers в report.

---

# 19. AUTH TRANSITION

Проверить:

```text
anonymous visitor → login
```

Visitor identity не должна автоматически становиться новым visitor, если остаётся тот же browser identity.

При этом не связывать visitors между разными devices/browser через fingerprinting.

---

# 20. AUTOMATED TESTS — REQUIRED

Проверить наличие/добавить narrow review tests where necessary:

```text
visitorId creation format
visitorId persistence
same visitor / two sessions
distinct visitor query
distinct session query
Storefront exclusion
period filter
NULL visitorId behavior
```

Если новые tests отсутствуют — это finding.

---

# 21. TEST RESULT TRUTHFULNESS — HARD RULE

Reported:

```text
282/283
```

must be written as:

```text
FAIL — 282/283
```

Даже если failure:

```text
pre-existing
unrelated
i18n
```

Можно отдельно классифицировать:

```text
Scope impact: NONE / LOW / MATERIAL
```

Но нельзя писать `PASS(scope)`.

---

# 22. TYPECHECK TRUTHFULNESS — HARD RULE

Если `storefrontSessions` mismatch всё ещё вызывает typecheck failure:

```text
Frontend typecheck = FAIL
```

Не:

```text
✅ with pre-existing mismatch
```

Если mismatch больше не ломает actual typecheck, показать command/output proving PASS.

---

# 23. BUILD

Проверить actual:

```text
backend typecheck
backend build
frontend typecheck
frontend build
```

Записать фактические PASS/FAIL.

---

# 24. FRESH DB / MIGRATION EVIDENCE

В isolated DB:

```text
empty DB
→ migrate deploy
→ backend bootstrap
→ telemetry/schema smoke
```

Representative DB не очищать.

---

# 25. NON-REGRESSION

Проверить, что изменения не сломали:

```text
MarketplaceBehavioralEvent ingestion
StorefrontBehavioralEvent ingestion
existing Analytics
period selector
comparison
Command Center
```

Old `storefrontSessions` mismatch должен быть отдельно классифицирован, но не маскирован.

---

# 26. REQUIRED SEMANTICS MATRIX

| Metric | Exact formula | Source | Date field | Storefront included? | Runtime qualified? |
|---|---|---|---|---|---|
| Marketplace Visitors | | | | NO | |
| Marketplace Visits | | | | NO | |

---

# 27. REQUIRED IDENTITY MATRIX

| Property | visitorId | sessionId |
|---|---|---|
| Represents | | |
| Persistence | | |
| Regenerated when | | |
| PII | NO | NO |
| Auth identity | NO | NO |
| Visitors metric | YES | NO |
| Visits metric | NO | YES |

---

# 28. REQUIRED HISTORICAL COVERAGE MATRIX

| Period | Marketplace events | With visitorId | Without visitorId | Coverage | Visitors KPI trustworthy? |
|---|---:|---:|---:|---:|---|
| Historical total | 1228 or actual | | | | |
| Current period | | | | | |
| Post-cutover only | | | | | |

---

# 29. REQUIRED DB/API/UI MATRIX

| Metric | Period | DB | API | UI | Verdict |
|---|---|---:|---:|---:|---|
| Visitors | | | | | |
| Visits | | | | | |

---

# 30. REQUIRED TEST/BUILD MATRIX

| Check | Actual result | Scope impact |
|---|---|---|
| Backend typecheck | | |
| Backend build | | |
| Frontend typecheck | | |
| Frontend build | | |
| Tests | | |
| Fresh DB migration | | |
| Browser RU | | |
| Browser AZ | | |
| Browser EN | | |

---

# 31. ROADMAP

Проверить, что canonical roadmap обновлён additively:

```text
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
```

Должны быть зафиксированы:

```text
Marketplace Visitors
Marketplace Visits
visitorId vs sessionId contract
Marketplace-only KPI scope
Storefront exclusion
historical visitor telemetry limitation/cutover
```

Не начинать следующий stage.

---

# 32. REQUIRED REPORT STRUCTURE

Итоговый отчёт преимущественно на русском:

```text
1. Executive Summary
2. Repository / Git State
3. Schema / Migration Review
4. visitorId Contract
5. sessionId Contract
6. Backend Formula Review
7. Storefront Exclusion
8. Historical Coverage / Cutover
9. API Contract
10. Frontend / I18n
11. Browser Runtime
12. DB/API/UI Reconciliation
13. Period / Comparison
14. Privacy / Security
15. Tests
16. Typecheck / Build
17. Fresh DB
18. Non-Regression
19. Required Matrices
20. Roadmap
21. Findings
22. Residual Risks
23. Final Verdict
```

---

# 33. VERDICT RULES

## VERDICT A — MARKETPLACE VISITORS & VISITS QUALIFIED

Only if:

```text
visitorId semantics proven
Visits semantics proven
Storefront exclusion proven
privacy contract proven
browser RU/AZ/EN proven
tests/typecheck/build truthfully reported
historical 0% coverage handled honestly
DB/API/UI Visitors proven post-cutover OR explicitly NOT QUALIFIABLE until first telemetry with no false PASS
roadmap updated
Git evidence complete
```

If Visitors cannot yet be runtime reconciled because no event with `visitorId` exists, do **not** label that sub-gate PASS.

Overall verdict may only be A if product behavior for pre-cutover data is also honest and post-cutover runtime can be demonstrated.

## VERDICT B — NARROW REMEDIATION REQUIRED

Use when implementation direction is correct but runtime/UX/test/build/migration evidence has gaps.

## VERDICT C — SEMANTIC / PRIVACY DESIGN INVALID

Use if `visitorId` does not actually represent a persistent anonymous visitor identity or introduces inappropriate tracking/fingerprinting.

---

# 34. NEXT STAGE — DO NOT START

After this Strict Review is accepted, the next separate implementation prompt will reorganize Platform Analytics into explicit business sections:

```text
PLATFORM ANALYTICS

MARKETPLACE
→ Marketplace business/traffic/commerce KPIs

STOREFRONT SaaS
→ Platform's SaaS/subscription/product-health KPIs
```

Storefront partner customer commerce analytics remains in Partner / Storefront Analytics.

**Do not implement that separation in this Strict Review.**

---

# 35. STOP CONDITION

STOP after Strict Review report.

No automatic start of:

```text
Platform Analytics Marketplace vs Storefront SaaS separation
GMV remediation
Cross-Entity Traceability
Booking KPI Audit
Final PRE-STEP 3.12 Re-Qualification
Step 3.12
```
