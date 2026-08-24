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


# ROUND 2 OVERRIDE — RUNTIME ROOT-CAUSE REMEDIATION

> Этот раздел имеет приоритет над Round 1 там, где требования расходятся.

## STATUS

Предыдущий `VERDICT A — DECISION QUEUE FULL LOCALIZATION VERIFIED / STAGE F READY`
**ОТКЛОНЁН фактическим runtime evidence**.

```text
Stage E  → COMPLETE
Stage F  → BLOCKED
Round 2  → REQUIRED
```

Unit/static tests недостаточны. VERDICT A разрешён только после browser DOM validation.

## AUTHORITATIVE DEFECTS FROM AZ RUNTIME

### Services without sales
```text
31 из 31 — без настроенной доступности
31 опубликованы недавно
Услуг без продаж
31 count
Без доступности: 31, с доступностью: 0
31 недавно опубликовано
0 count
3h ago
just now
```

### Upcoming bookings
```text
Предстоящих бронирований
51 count
Объём предстоящих бронирований
3h ago
just now
```

Также доказать семантику:
```text
51 bookings
Obyektlər: 50
```

### Pending refunds
```text
Запросов на возврат
20 count
Запрошенная сумма возвратов
Самый длительный запрос: 170 дн
244,817 minutes
3h ago
just now
```

### Recent cancellations
```text
Ən köhnə ləğv: -2673 dəq
Отменённых заказов
25 count
Стоимость отменённых заказов
За период: 7 дн.
7 days
```

### Failed payments
```text
3 из 8 — BANK_TRANSFER
Неуспешных платежей
8 count
Сумма неуспешных попыток
Распределение ошибок
BANK_TRANSFER:3;CARD:3;MOBILE_PAYMENT:2
Самый старый сбой: 205 дн 4 ч назад
295,497 minutes
```

### Booking confirmation delay
```text
1651 minutes
1320 AZN
240 minutes
Заблокированных бронирований
5 count
GMV затронутых заказов
5 превысили SLA (4 ч)
1,651 minutes
```

## ROOT-CAUSE TRACE — MANDATORY

Проследить production path:

```text
DecisionSignal
→ evidence
→ WHY attribution
→ IMPACT contract
→ evidence presenter
→ WHY presenter
→ IMPACT presenter
→ enum/unit/duration/relative-time formatters
→ i18n key + params
→ active locale
→ DecisionQueue DOM
```

Для каждого runtime leak указать конкретный source file/component и root cause.

Нельзя закрыть Round 2 формулировкой «добавлены переводы».

## IMPACT CONTRACT

Проверить, не хранит ли Stage E готовые русские display strings.

Bad:
```json
{"label":"Предстоящих бронирований","value":51,"unit":"count"}
```

Нужно locale-neutral semantic representation, например:
```text
labelKey / semantic type
typed value
typed unit
structured params
```

с локализацией на presentation layer.

## WHY CONTRACT

AZ WHY не должен состоять из AZ heading + Russian generated sentence.

WHY должен локализоваться через semantic message key + structured params,
а не через fixed Russian explanation.

Проверить все 6 rules.

## SINGLE FORMATTER AUTHORITY

Установить единый locale-aware presentation path для:

```text
COUNT
MONEY
DURATION
RELATIVE_TIME
PERIOD
RATIO
ENUM
```

Запрещено показывать raw:
```text
count
minutes
days
hours
3h ago
just now
```
в AZ UI.

### Duration examples
Проверить 5, 65, 1651, 244817, 295497 minutes в RU/AZ/EN.

### Relative time
AZ не должен показывать:
```text
Aşkar edildi: 3h ago
Son müşahidə: just now
```

## DUPLICATED RAW VALUES

Запрещено:
```text
Самый длительный запрос: 170 дн
244,817 minutes
```

или:
```text
За период: 7 дн.
7 days
```

Один business fact → одна human-readable presentation, если второе значение не несёт отдельного смысла.

## NEGATIVE DURATION — BLOCKING RCA

```text
Ən köhnə ləğv: -2673 dəq
```

Не применять `Math.abs()`/clamp без доказательства.

Вернуть:
```text
source timestamp
reference timestamp
calculation direction
timezone
seed/runtime date relationship
classification:
  CALCULATION_DEFECT /
  SEED_DATA_FUTURE_DATE /
  TIMEZONE_DEFECT /
  SEMANTIC_DEFECT
fix
regression test
```

Demo dataset охватывает 01.01.2026–31.12.2026, поэтому отдельно проверить,
не трактуют ли detectors будущие относительно runtime события как прошлые.

## PAYMENT METHOD ENUMS / SEMANTICS

Raw:
```text
BANK_TRANSFER
CARD
MOBILE_PAYMENT
```
не должны быть primary UI.

Локализовать enum values.

Также проверить semantic defect:
```text
Dominant xəta kodu
```
при значениях `BANK_TRANSFER/CARD/MOBILE_PAYMENT`.

Если это payment methods, label не должен называть их error codes.

## MONEY

PLATFORM authority:
```text
AZN
presentation → ₼
```

`1320 AZN` в user-facing Decision Queue заменить locale-safe formatting,
не меняя authoritative numeric value.

## WHY / IMPACT PARAM FORMATTING

Structured params форматировать по semantic type:

```text
1651 minutes → human duration
1320 money   → 1,320 ₼
COUNT        → localized count presentation
ENUM         → localized enum
RATIO        → localized semantic ratio
```

## SERVICES WITHOUT SALES — VALUE BINDING AUDIT

Runtime:
```text
31 недавно опубликовано
0 count
```

Проверить mapping:

```text
unsoldProductCount
withoutAvailabilityCount
withAvailabilityCount
recentlyPublishedCount
```

DB/evidence → API → Impact contract → UI.

Не ограничиваться переводом.

## UPCOMING BOOKINGS — 51 VS 50

Вернуть:
```text
booking count:
affectedEntities count:
affected entity types:
deduplication:
why difference exists:
correct by design: YES/NO
fix if needed:
```

Не делать числа равными без contract authority.

## "0 DAYS LATER"

`ən yaxın 0 gün sonra` — плохой UX.

Если событие сегодня, использовать locale-natural representation (`Bu gün` / equivalent)
или более точную duration, если available.

Не менять booking semantics.

## HARD AZ RUNTIME GATE

Для system-generated DOM всех 6 AZ cards после fix:

```text
Russian UI fragments          = 0
raw English units             = 0
raw English relative time     = 0
raw enums                     = 0
raw i18n keys                 = 0
negative age/wait durations   = 0
duplicated raw durations      = 0
raw "AZN" presentation        = 0
```

Proper nouns/user content исключить из scanner.

## RU / EN REGRESSION

RU:
```text
CJK = 0
AZ system fragments = 0
raw EN units = 0
raw enums = 0
```

EN:
```text
RU system fragments = 0
AZ system fragments = 0
raw enum leakage = 0
raw i18n keys = 0
```

## BROWSER VALIDATION — MANDATORY

VERDICT A невозможен только по grep/unit tests.

Обязательно:
```text
AZ → all 6 signal cards
RU → minimum 3 representative cards
EN → minimum 3 representative cards
```

Предоставить **actual rendered DOM text dump** для всех 6 AZ cards после fix.

## PRODUCTION-PATH TESTS

Предыдущие tests passed while runtime failed.

Добавить component/integration tests, которые реально:

```text
render DecisionQueue
set locale = AZ
inject representative API signal with WHY + IMPACT
assert actual DOM
```

для всех 6 signal types (parameterized допустимо).

### AZ must NOT contain
```text
Услуг без продаж
Без доступности
Предстоящих бронирований
Объём предстоящих бронирований
Запросов на возврат
Запрошенная сумма возвратов
Самый длительный запрос
Отменённых заказов
Стоимость отменённых заказов
За период
Неуспешных платежей
Сумма неуспешных попыток
Распределение ошибок
Самый старый сбой
Заблокированных бронирований
GMV затронутых заказов
превысили SLA
```

### AZ must NOT render raw
```text
count
minutes
days
hours
h ago
just now
BANK_TRANSFER
MOBILE_PAYMENT
```

## REQUIRED DELIVERABLES — ROUND 2

### A. Root Cause Matrix
| Runtime defect | Source | Root cause | Fix | Production-path test |
|---|---|---|---|---|
| AZ IMPACT RU | | | | |
| AZ WHY RU | | | | |
| count | | | | |
| minutes/days | | | | |
| 3h ago/just now | | | | |
| raw payment enums | | | | |
| negative cancellation duration | | | | |
| raw AZN | | | | |
| duplicated durations | | | | |
| Services value mismatch | | | | |
| 51 vs 50 | | | | |

### B. 6-Signal AZ BEFORE/AFTER
Для каждого signal дать реальный browser DOM BEFORE и AFTER.

### C. Formatter Authority
```text
count:
duration:
relative time:
money:
ratio:
enum:
WHY params:
IMPACT params:
```

### D. Services Reconciliation
```text
DB/evidence:
API:
Impact contract:
UI:
unsold:
without availability:
with availability:
recently published:
```

### E. Upcoming 51 vs 50
Дать точное semantic explanation.

### F. Negative Duration RCA
Дать timestamps/calculation/timezone/root cause/fix/test.

### G. Runtime Counts
```text
AZ:
RU fragments = 0
raw EN units = 0
raw enums = 0
raw keys = 0
negative durations = 0
duplicated raw values = 0

RU:
CJK = 0
AZ fragments = 0
raw EN units = 0

EN:
RU fragments = 0
AZ fragments = 0
```

### H. Tests
Exact counts:
```text
New Round 2 tests:
Decision Queue tests:
Frontend Vitest:
Frontend TSC:
Frontend build:
Backend tests/TSC/build if changed:
Browser runtime:
```

### I. Git
```text
Starting HEAD:
Final HEAD:
Files changed:
New files:
Migrations:
Commit:
Pushed:
Working tree clean:
```

## REPORT

Создать:

```text
docs/prompts/PHASE_3_POST_STAGE_E_DECISION_QUEUE_RUNTIME_LOCALIZATION_ROOT_CAUSE_REMEDIATION_ROUND_2_REPORT.md
```

Отчёт полностью на русском.

## ROADMAP

Зафиксировать additive:

```text
Post-Stage-E Localization Round 1
→ PASS rejected by runtime evidence

Post-Stage-E Localization Round 2
→ <final verdict>

Stage F
→ BLOCKED until Round 2 VERDICT A
```

## ROUND 2 ACCEPTANCE

VERDICT A только если:

1. Root cause найден для каждого observed leak.
2. Все 6 AZ cards browser-validated.
3. AZ IMPACT полностью AZ.
4. AZ WHY полностью AZ.
5. Evidence values locale-formatted.
6. raw `count` = 0.
7. raw/duplicated minutes/days = 0.
8. `h ago`/`just now` in AZ = 0.
9. raw payment enums = 0.
10. raw AZN = 0; ₼ preserved.
11. Negative cancellation duration fixed by root cause.
12. Services value mapping reconciled.
13. 51 vs 50 semantics proven/fixed.
14. RU regression PASS.
15. EN regression PASS.
16. Tests exercise production rendering path.
17. Actual browser DOM dump supplied.
18. Stage F NOT started.

## VERDICT

Return exactly one:

### VERDICT A — RUNTIME LOCALIZATION ROOT CAUSES CLOSED / DECISION QUEUE VERIFIED / STAGE F READY

### VERDICT B — RUNTIME LOCALIZATION REMEDIATION REQUIRED

Разделить:
```text
WHY
IMPACT
Evidence
Units
Relative time
Enums
Duration
Data/semantic reconciliation
Runtime
```

### VERDICT C — BLOCKED / PRESENTATION CONTRACT ARCHITECTURE GAP

Только если current WHY/IMPACT contract принципиально не позволяет locale-safe presentation
без отдельного architecture change.

## STOP

После отчёта STOP.

Не запускать автоматически Stage F/G/H/I/J, Stage 2.14.x или Employee Performance implementation.
