# PHASE 3 — POST-STAGE-E
# DECISION QUEUE FULL LOCALIZATION REMEDIATION
## RU / AZ / EN RUNTIME CONSISTENCY GATE

---

# LANGUAGE REQUIREMENT — MANDATORY

Все ответы разработчика, findings, таблицы, результаты тестов, runtime/browser evidence,
отчёт и финальный VERDICT должны быть предоставлены **НА РУССКОМ ЯЗЫКЕ**.

Technical identifiers, i18n keys, paths, field names, enums, endpoints, SHA, commands и code
сохранять в оригинальном виде.

---

# 1. EXECUTION ORDER — IMPORTANT

Этот prompt запускать **ТОЛЬКО ПОСЛЕ завершения Stage E**.

Не запускать параллельно со Stage E, чтобы не смешивать:

```text
Stage E = IMPACT business semantics
this remediation = localization / presentation correctness
```

После Stage E сначала зафиксировать его final HEAD/commit, затем начинать этот remediation.

---

# 2. CONTEXT

Decision Queue уже имеет:

```text
WHAT
WHY
Evidence Presentation
Lifecycle
```

После Stage E также будет иметь:

```text
IMPACT
```

Ранее был исправлен raw evidence rendering через typed presentation adapters.

Однако runtime показывает неполную/смешанную локализацию.

Пример AZ locale:

```text
Qərar növbəsi

Aciq: 6
Qeyde alindi: 0

Aktiv (6)
Tarix (0)

Aciq
Katalog

Услуги без продаж
31 опубликованных услуг без заказов

Obyekt: 31
Gözlem: 48

Satışı olmayan xidmətlər 31

Əlçatanlıq
31 mövcudluq olmadan / 0 mövcudluqla

Yeni nəşr olunub
31 yaxınlarda nəşr olunub
```

Также ранее в RU locale наблюдалось:

```text
5 бронирований等待确认，最老ое 1583 мин. назад
```

Следовательно проблема системная, а не один missing key.

---

# 3. OBJECTIVE

Обеспечить для всей Decision Queue:

```text
RU locale → только корректный RU user-facing text
AZ locale → только корректный AZ user-facing text
EN locale → только корректный EN user-facing text
```

За исключением legitimate proper nouns/user content:

```text
service names
partner names
customer-entered content
IDs/codes where intentionally technical
```

---

# 4. SCOPE — ALL DECISION QUEUE LAYERS

Audit должен покрыть:

```text
Queue header
Summary counters
Active / History tabs
Status badges
Category badges
Signal titles
Signal descriptions
Affected objects
Observation/lifecycle metadata
Evidence
WHY Attribution
IMPACT from Stage E
Durations
Dates
Money
Buttons/actions
Empty states
Error states
Pagination if present
```

Не исправлять только текущую ServicesWithoutSales card.

---

# 5. ALL 6 SIGNAL TYPES — MANDATORY

Проверить:

```text
PendingBookingsDetector
FailedPaymentsDetector
RecentCancellationsDetector
PendingRefundsDetector
UpcomingBookingsDetector
ServicesWithoutSalesDetector
```

Каждый signal должен быть runtime-validated в:

```text
RU
AZ
EN
```

Итого minimum matrix:

```text
6 signal types × 3 locales
```

---

# 6. INCLUDE STAGE E IMPACT

Так как remediation запускается после Stage E, audit обязан включить новые:

```text
IMPACT labels
Impact statuses
Impact dimensions
Impact summaries
Impact factual sentences
Impact units
```

Никакие Stage E strings не должны остаться hardcoded в одном языке.

Не менять Stage E business semantics.

---

# 7. FIND ALL TEXT SOURCES

Найти все источники user-facing Decision Queue text:

```text
frontend i18n dictionaries
signal-evidence.presenter
WHY presenter / mapping
IMPACT presenter / mapping
DecisionQueue component
Kpi/shared formatting helpers
backend DTO strings
detector-generated text
hardcoded JSX strings
fallback strings
enum-to-label mappings
template strings
```

Вернуть source inventory.

---

# 8. NO HARDCODED USER-FACING LANGUAGE

User-facing RU/AZ/EN text не должен быть hardcoded в:

```text
detectors
services
presentation adapters
components
```

если он должен локализоваться.

Предпочтительно:

```text
semantic key + structured params
→ i18n
→ localized runtime text
```

Не переносить i18n responsibility хаотично между backend/frontend.

---

# 9. BACKEND TEXT AUDIT

Особенно проверить, не приходит ли из backend уже готовая русская/английская фраза.

Bad:

```json
{
  "description": "31 опубликованных услуг без заказов"
}
```

для multilingual UI, если frontend не может корректно локализовать её.

Предпочтительно:

```text
messageKey
params
structured evidence
```

или existing project-consistent equivalent.

Не проводить большой API redesign без необходимости.

---

# 10. AZERBAIJANI QUALITY GATE

Исправить не только отсутствие перевода, но и неправильную транслитерацию/орфографию.

Known examples:

```text
Aciq
→ Açıq

Qeyde alindi
→ Qeydə alındı

Katalog
→ Kataloq
```

Проверить wording:

```text
Obyekt
Gözlem
Tarix
Yeni nəşr olunub
mövcudluqla / mövcudluq olmadan
```

на естественный Azerbaijani UI wording.

Не использовать Turkish vocabulary вместо Azerbaijani.

---

# 11. AZ GLOSSARY CONSISTENCY

Создать/использовать единый glossary для recurring concepts:

```text
Open
Acknowledged
Resolved
Dismissed
Active
History
Catalog
Operational
Financial
Marketplace
Objects / affected entities
Observations
Availability
Published
Orders
Bookings
Payments
Refunds
Customers
Partners
Evidence
Cause / driver
Impact
Duration
SLA
```

Не переводить один concept разными словами на соседних карточках без причины.

---

# 12. RUSSIAN QUALITY GATE

RU locale не должен содержать:

```text
Chinese/CJK fragments
Azerbaijani fragments
English template fragments
raw i18n keys
raw enums
```

Known bad example:

```text
5 бронирований等待确认，最老ое 1583 мин. назад
```

Target должен быть естественным RU, например conceptually:

```text
5 бронирований ожидают подтверждения.
Самое длительное ожидание — 26 ч 23 мин.
```

Не копировать example, если actual semantic template отличается.

---

# 13. CJK REGRESSION GUARD

Добавить automated guard для RU/AZ user-facing translation dictionaries/templates:

```text
CJK characters → FAIL
```

за исключением явно allowlisted legitimate user/generated content, если такое вообще участвует в test fixture.

Минимально проверить Unicode ranges, соответствующие Chinese/Japanese/Korean ideographs,
в static localization resources и rendered known signal fixtures.

---

# 14. ENGLISH QUALITY GATE

EN locale также проверить полностью.

Не считать EN корректным только потому, что многие technical identifiers английские.

Bad:

```text
unsoldProductCount
OPEN
CATALOG
oldestPendingMinutes
```

если это user-facing label.

Target:

```text
Services without orders
Open
Catalog
Longest waiting time
```

---

# 15. NO RAW I18N KEYS

Во всех трёх locales:

```text
cc.*
decision.*
signal.*
impact.*
why.*
evidence.*
```

и другие internal translation keys не должны быть visible.

Добавить regression coverage.

---

# 16. NO RAW ENUMS

User-facing:

```text
OPEN
ACKNOWLEDGED
RESOLVED
DISMISSED
OPERATIONAL
CATALOG
CARD
BANK_TRANSFER
MOBILE_PAYMENT
```

должны проходить через localized mapping, если отображаются пользователю.

Не менять underlying enums.

---

# 17. PLURALIZATION — MANDATORY

Исправить фразы вида:

```text
31 опубликованных услуг
5 бронирований
1 бронирование
2 бронирования
21 бронирование
```

RU требует корректных plural forms.

AZ/EN также должны иметь natural count phrasing.

Использовать i18n pluralization capability либо deterministic helper consistent with project architecture.

Не создавать десятки ad-hoc string conditions.

---

# 18. DYNAMIC SENTENCE TEMPLATES

Audit всех template strings с params:

```text
{count}
{minutes}
{amount}
{partnerCount}
{customerCount}
{serviceCount}
```

Порядок слов должен определяться locale template, а не конкатенацией:

```text
count + translatedWord + suffix
```

Это особенно важно для RU/AZ/EN differences.

---

# 19. DURATION FORMATTING

Не показывать большие durations как:

```text
1583 мин.
```

если human-readable formatter уже существует/может быть использован.

Target:

```text
RU: 1 д 2 ч 23 мин
AZ: 1 gün 2 saat 23 dəq
EN: 1d 2h 23m
```

Exact format привести к existing UX convention.

Проверить:

```text
< 1 hour
hours
> 24 hours
multiple days
```

---

# 20. DATE / TIME LOCALIZATION

Проверить:

```text
firstDetected
lastDetected
acknowledgedAt
resolvedAt
```

если видимы.

Locale formatting + project timezone authority должны сохраняться.

Не менять underlying timestamps.

---

# 21. MONEY LOCALIZATION

PLATFORM Command Center authority:

```text
AZN / ₼
```

Проверить во всех locales:

```text
RU
AZ
EN
```

Currency НЕ должна переключаться на USD из-за языка интерфейса.

Locale влияет на text/number formatting, но не business reporting currency.

---

# 22. SERVICES WITHOUT SALES — REQUIRED RUNTIME TARGET

AZ current bad:

```text
Услуги без продаж
31 опубликованных услуг без заказов
Obyekt: 31
Gözlem: 48
```

После fix вся карточка должна быть Azerbaijani.

Пример conceptually:

```text
Satışı olmayan xidmətlər

31 dərc olunmuş xidmət üzrə sifariş yoxdur

Obyektlər: 31
Müşahidələr: 48
```

Но exact wording должен соответствовать approved glossary и natural AZ.

---

# 23. PENDING BOOKINGS — REQUIRED RUNTIME TARGET

RU current known defect:

```text
5 бронирований等待确认，最老ое 1583 мин. назад
```

После fix:

```text
0 CJK
0 mixed-language fragments
human-readable duration
correct pluralization
```

Проверить тот же signal в AZ и EN.

---

# 24. WHY ATTRIBUTION LOCALIZATION

Все Stage D statuses/labels:

```text
PROVEN_CAUSE
OBSERVED_DRIVER
CONTRIBUTING_FACTOR
INSUFFICIENT_EVIDENCE
```

должны иметь корректные RU/AZ/EN labels.

Rule IDs остаются technical и не должны становиться primary UI text.

---

# 25. IMPACT LOCALIZATION

Все Stage E:

```text
ImpactStatus
ImpactDimension
summary labels
financial/customer/operational/partner/SLA/scope
```

должны быть полностью локализованы.

No raw:

```text
PARTIALLY_PROVEN
INFORMATIONAL
FINANCIAL
SLA_TIME
```

в user-facing UI.

---

# 26. LIFECYCLE LOCALIZATION

Проверить:

```text
OPEN
ACKNOWLEDGED
RESOLVED
DISMISSED
```

и actions:

```text
Acknowledge
Resolve
Dismiss
```

в RU/AZ/EN.

---

# 27. OBSERVATION / OBJECT LABELS

После предыдущего remediation product decision по `observationCount`
не пересматривать без причины.

Но если labels остаются:

```text
Объектов
Наблюдений
```

они должны быть корректно локализованы во всех locales.

Не использовать Turkish `Gözlem` как AZ label.

---

# 28. PROPER NOUNS / USER CONTENT

Не пытаться автоматически переводить:

```text
Baku Night Market Experience
Sheki Silk Road Bicycle Tour
partner company names
customer names
```

в рамках этого remediation.

Это отдельная content-localization problem.

Такие names не считаются mixed-language defect.

---

# 29. NO BUSINESS SEMANTIC CHANGES

Строго запрещено этим prompt менять:

```text
DecisionSignal lifecycle
detector conditions
WHY rules
IMPACT rules
financial formulas
GMV semantics
refund semantics
RBAC
tenant scope
Stage E thresholds/status logic
```

Если localization audit обнаружит semantic defect — зафиксировать отдельно, не маскировать переводом.

---

# 30. PRESENTATION ARCHITECTURE

Сохранить separation:

```text
machine-readable domain data
→ presentation adapter
→ i18n key + params
→ localized UI
```

Не возвращаться к raw generic rendering.

---

# 31. FALLBACK POLICY

Audit current i18n fallback.

Fallback не должен silently превращать AZ page в RU/EN mixture.

Для missing translation в development/test желательно detect/fail.

В production policy должна соответствовать existing project i18n architecture,
но missing keys должны быть observable.

---

# 32. STATIC AUDIT

Сделать repository search минимум по:

```text
known Chinese fragments
"等待"
"最老"
"Aciq"
"Qeyde"
"Gözlem"
"Услуги без продаж"
"опубликованных услуг"
```

и другим найденным mixed-language strings.

Не ограничиваться этими literals.

---

# 33. RUNTIME AUDIT

Static grep недостаточен.

Проверить браузером:

```text
RU Decision Queue
AZ Decision Queue
EN Decision Queue
```

на богатом demo dataset.

Переключить locale runtime и проверить реальные 6 signals.

---

# 34. SCREEN-LEVEL LANGUAGE CONSISTENCY

Для каждой locale runtime page:

```text
navigation/header
queue summary
tabs
badges
titles
descriptions
metadata
evidence
WHY
IMPACT
buttons
```

должны быть на одном выбранном UI language.

---

# 35. TEST MATRIX

Минимум:

```text
6 signal types × 3 locales = 18 presentation cases
```

Плюс:

```text
pluralization
duration
raw-key guard
raw-enum guard
CJK guard RU
CJK guard AZ
AZ known transliteration regressions
Stage E impact localization
```

---

# 36. CJK TEST

Добавить test, который fail, если rendered RU/AZ fixtures содержат unexpected CJK Unicode.

Не применять этот test к arbitrary service/user names без allowlist/context.

---

# 37. AZ KNOWN-BAD TEST

Regression test минимум на отсутствие:

```text
Aciq
Qeyde alindi
Gözlem
Katalog
```

в AZ Decision Queue.

Если `Katalog` где-то является legitimate proper noun — scope test appropriately.

---

# 38. RU KNOWN-BAD TEST

Regression test минимум на отсутствие mixed fragment:

```text
等待
最老
```

и других найденных CJK fragments.

---

# 39. RAW KEY TEST

Проверить отсутствие:

```text
unsoldProductCount
productNames
withAvailabilityCount
withoutAvailabilityCount
pendingConfirmationCount
oldestPendingMinutes
affectedGmv
```

в rendered UI всех locales.

---

# 40. IMPACT RAW KEY TEST

После Stage E дополнить guard actual impact contract keys,
например discovered:

```text
impact.*
ImpactStatus enum names
ImpactDimension enum names
internal rule IDs
```

Не предполагать exact names до inspection Stage E implementation.

---

# 41. BROWSER EVIDENCE

Вернуть representative text dump/screenshots для:

```text
RU
AZ
EN
```

Минимум по 2 signals на locale,
включая:

```text
ServicesWithoutSales
PendingBookings
```

и хотя бы один signal с Stage E IMPACT.

---

# 42. REQUIRED DELIVERABLE A — SOURCE INVENTORY

| Source | User-facing text found | Locale-safe? | Fix |
|---|---|---:|---|
| i18n dictionary | | | |
| DecisionQueue | | | |
| evidence presenter | | | |
| WHY presenter | | | |
| IMPACT presenter | | | |
| backend/detectors | | | |
| fallback | | | |

---

# 43. REQUIRED DELIVERABLE B — 6×3 MATRIX

| Signal | RU | AZ | EN | Mixed text | Raw keys | PASS |
|---|---:|---:|---:|---:|---:|---:|
| PendingBookings | | | | | | |
| FailedPayments | | | | | | |
| RecentCancellations | | | | | | |
| PendingRefunds | | | | | | |
| UpcomingBookings | | | | | | |
| ServicesWithoutSales | | | | | | |

---

# 44. REQUIRED DELIVERABLE C — KNOWN DEFECTS BEFORE/AFTER

Обязательно показать:

### Pending Bookings RU

```text
BEFORE:
5 бронирований等待确认，最老ое 1583 мин. назад

AFTER:
<actual corrected runtime>
```

### Services Without Sales AZ

Показать полный representative BEFORE/AFTER block.

---

# 45. REQUIRED DELIVERABLE D — GLOSSARY

Вернуть final recurring Decision Queue glossary:

| Concept | RU | AZ | EN |
|---|---|---|---|
| Decision Queue | | | |
| Open | | | |
| Acknowledged | | | |
| Active | | | |
| History | | | |
| Catalog | | | |
| Objects | | | |
| Observations | | | |
| Evidence | | | |
| Why / Cause | | | |
| Impact | | | |
| Availability | | | |

Добавить другие recurring concepts по результату audit.

---

# 46. REQUIRED DELIVERABLE E — PLURALIZATION / DURATION

Показать tests/results минимум:

```text
1
2
5
21
31
```

для relevant count nouns.

Duration:

```text
5 min
65 min
1583 min
```

во всех трёх locales.

---

# 47. REQUIRED DELIVERABLE F — STAGE E IMPACT LOCALIZATION

Перечислить все Stage E user-facing impact labels/templates и подтвердить:

```text
RU complete
AZ complete
EN complete
raw impact keys = 0
```

---

# 48. REQUIRED DELIVERABLE G — TESTS

Вернуть exact:

```text
New localization tests:
Decision Queue tests:
Frontend Vitest:
Frontend TSC:
Frontend build:
Backend tests if backend changed:
Backend TSC if backend changed:
Runtime/browser:
```

---

# 49. REQUIRED DELIVERABLE H — FILES / GIT

```text
Stage E final HEAD:
Remediation starting HEAD:
Final HEAD:
Files changed:
New files:
Migrations:
Commit:
Pushed to origin: YES/NO
Working tree clean: YES/NO
```

Expected:

```text
DB migrations = 0
```

если audit не обнаружил unrelated architecture issue.

---

# 50. DOCUMENTATION

Создать:

```text
docs/prompts/PHASE_3_POST_STAGE_E_DECISION_QUEUE_FULL_LOCALIZATION_REMEDIATION_REPORT.md
```

Полностью на русском языке.

---

# 51. ROADMAP

Не создавать новый major product stage.

Зарегистрировать как post-Stage-E localization closure/remediation.

Stage F может стать READY только после PASS этого gate,
но автоматически его НЕ запускать.

---

# 52. ACCEPTANCE CRITERIA

VERDICT A только если:

1. Stage E уже завершён.
2. Все 6 signals проверены.
3. RU/AZ/EN проверены runtime.
4. 6×3 matrix complete.
5. Mixed RU/AZ/EN template fragments отсутствуют.
6. CJK в RU/AZ static/runtime user-facing templates отсутствует.
7. Known AZ transliteration defects исправлены.
8. Turkish vocabulary не используется вместо AZ без основания.
9. Raw i18n keys = 0.
10. Raw evidence keys = 0.
11. Raw impact keys = 0.
12. Raw user-facing enums = 0.
13. Signal titles/descriptions localized.
14. Evidence localized.
15. WHY localized.
16. Stage E IMPACT localized.
17. Lifecycle localized.
18. Actions localized.
19. Pluralization корректна.
20. Durations human-readable.
21. Dates/time locale-safe.
22. AZN authority сохранена.
23. Proper nouns/user content не ошибочно классифицированы как UI defect.
24. No business semantic changes.
25. Regression tests added.
26. Frontend tests/TSC/build green.
27. Backend regression green if changed.
28. Browser evidence provided.
29. Report на русском.
30. Stage F not automatically started.

---

# 53. VERDICT

Вернуть ровно один.

## VERDICT A — DECISION QUEUE FULL LOCALIZATION VERIFIED / STAGE F READY

Только если RU/AZ/EN runtime полностью согласованы и Stage E IMPACT также покрыт.

## VERDICT B — LOCALIZATION REMEDIATION REQUIRED

Разделить findings:

```text
RU:
AZ:
EN:
Evidence:
WHY:
IMPACT:
Lifecycle:
Pluralization:
Runtime:
```

и указать minimal remediation.

## VERDICT C — BLOCKED / LOCALIZATION ARCHITECTURE GAP

Только если current API/presentation contract не позволяет локализовать user-facing text
без отдельного architecture change.

---

# 54. STOP

После remediation:

**STOP.**

Не запускать автоматически:

```text
Stage F — Action Routing
Stage G — AI Decision Feed Reconciliation
Stage H — Executive/Operational/Financial Decision Enrichment
Stage I — Storefront Revenue Semantic Fix
Stage J — Full Regression / Security / Evidence Closure
Stage 2.14.x
Employee Performance implementation
```

Вернуть полный отчёт на русском языке и ждать review.
