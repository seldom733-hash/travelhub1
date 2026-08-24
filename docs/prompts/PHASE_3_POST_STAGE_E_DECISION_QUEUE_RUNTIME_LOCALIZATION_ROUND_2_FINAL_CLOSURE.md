# PHASE 3 --- POST-STAGE-E

# DECISION QUEUE RUNTIME LOCALIZATION --- ROUND 2 FINAL CLOSURE

## NEGATIVE DURATION SEMANTICS + BROWSER DOM ACCEPTANCE

## STAGE F BLOCKING GATE

------------------------------------------------------------------------

## 1. ОБЯЗАТЕЛЬНОЕ ТРЕБОВАНИЕ К ЯЗЫКУ

Все ответы разработчика, findings, root-cause analysis, отчёты,
результаты тестов, runtime evidence и финальный VERDICT должны быть
предоставлены **НА РУССКОМ ЯЗЫКЕ**.

Technical identifiers, paths, enums, commands, SHA и code сохранять в
оригинальном виде.

------------------------------------------------------------------------

## 2. ТЕКУЩИЙ СТАТУС

Предыдущий Round 2 сообщил:

``` text
VERDICT A — RUNTIME LOCALIZATION ROOT CAUSES CLOSED /
DECISION QUEUE VERIFIED / STAGE F READY
```

Этот VERDICT **НЕ ПРИНИМАЕТСЯ как финальный** по двум причинам:

1.  Negative duration был исправлен через:

``` ts
Math.abs()
Math.max(0, ...)
```

без доказательства корректной временной семантики.

2.  В отчёте приведены tests/API verification, но отсутствует требуемое
    доказательство **actual browser DOM validation** для всех 6 AZ
    signal cards.

Текущий authoritative status:

``` text
Stage E                                      COMPLETE
Round 2 localization architecture fixes     ACCEPTED
Round 2 final runtime closure                REQUIRED
Stage F                                      BLOCKED
```

------------------------------------------------------------------------

## 3. ЧТО УЖЕ ПРИНИМАЕТСЯ И НЕ НУЖНО ПЕРЕДЕЛЫВАТЬ БЕЗ ПРИЧИНЫ

Следующие изменения Round 2 считаются правильным направлением:

``` text
Impact dimension.label
→ labelKey + params

AZ relativeTime support
raw payment enum localization
0 gün sonra → bu gün
Impact RU hardcoded labels → locale-neutral keys
```

Не откатывать их.

------------------------------------------------------------------------

# PART A --- NEGATIVE DURATION SEMANTIC CLOSURE

## 4. ПРОБЛЕМА

Было:

``` text
Ən köhnə ləğv
-2657 dəq
```

Round 2 сообщил:

``` text
Root cause: seed data future dates vs runtime
Fix: Math.abs() + Math.max(0, ...)
```

Такое исправление **не принимается без domain proof**.

`Math.abs()` может превратить future event в past age.

Пример:

``` text
now       = 24 Aug
cancelled = 26 Aug

cancelledAt - now = +2 days
now - cancelledAt = -2 days

Math.abs(...) = 2 days
```

После этого UI может утверждать, что отмена произошла «2 дня назад»,
хотя событие находится в будущем.

------------------------------------------------------------------------

## 5. ОБЯЗАТЕЛЬНО УСТАНОВИТЬ DATE AUTHORITY DETECTOR

Для `RecentCancellationsDetector` определить:

``` text
какое timestamp поле является authority;
что означает "recent cancellation";
какое окно используется;
какой reference time используется;
как учитывается timezone;
может ли future-dated record входить в detector.
```

Вернуть точную формулу до и после исправления.

------------------------------------------------------------------------

## 6. FUTURE-DATED EVENTS

Если detector по смыслу ищет отмены за последние N дней, canonical
predicate должен семантически соответствовать:

``` text
windowStart <= cancellationTimestamp <= now
```

а не:

``` text
cancellationTimestamp >= windowStart
```

если последнее допускает future records.

Использовать реальные имена полей и существующую repository
architecture.

------------------------------------------------------------------------

## 7. ЗАПРЕЩЁННЫЕ MASKING FIXES

Не использовать как самостоятельное решение:

``` ts
Math.abs(...)
Math.max(0, ...)
Math.min(...)
```

для превращения некорректной временной выборки в визуально положительное
число.

Clamping допустим только как defensive presentation safeguard **после**
корректного domain filtering и с объяснением.

------------------------------------------------------------------------

## 8. DEMO DATASET

Demo dataset покрывает:

``` text
01.01.2026 — 31.12.2026
```

Поэтому часть событий может быть future-dated относительно runtime.

Это нормально для demo dataset, но detectors должны корректно различать:

``` text
past event
current event
future event
```

Не менять весь seed только ради того, чтобы скрыть defect detector.

------------------------------------------------------------------------

## 9. REQUIRED NEGATIVE-DURATION RCA

В отчёте предоставить:

``` text
Detector:
Timestamp authority:
Runtime/reference timestamp:
Timezone authority:
Window start:
Window end:
Example future record:
Why it entered detector:
Old predicate:
Old age formula:
Root cause classification:
Corrected predicate:
Corrected age formula:
Defensive presentation clamp needed: YES/NO
```

------------------------------------------------------------------------

## 10. ROOT CAUSE CLASSIFICATION

Выбрать фактическую классификацию:

``` text
QUERY_WINDOW_DEFECT
CALCULATION_DIRECTION_DEFECT
TIMEZONE_DEFECT
SEED_DATA_EXPECTED_FUTURE_RECORD
SEMANTIC_CONTRACT_DEFECT
OTHER
```

Можно выбрать несколько, если доказано.

------------------------------------------------------------------------

## 11. REQUIRED DATE TESTS

Добавить regression cases минимум:

``` text
past cancellation inside 7-day window     → included
past cancellation outside window          → excluded
cancellation exactly at window boundary   → deterministic
cancellation at now                        → valid / zero age
future cancellation                       → excluded
future cancellation must not become age via Math.abs
```

Timezone boundary case добавить, если detector использует
timezone-sensitive timestamps.

------------------------------------------------------------------------

# PART B --- ACTUAL BROWSER DOM ACCEPTANCE

## 12. ПОЧЕМУ API VERIFICATION НЕДОСТАТОЧЕН

Предыдущий localization remediation уже однажды имел passing tests, но
реальный браузер продолжал показывать mixed-language UI.

Поэтому:

``` text
API correct ≠ UI correct
dictionary correct ≠ UI correct
unit tests correct ≠ runtime localization proven
```

Для VERDICT A требуется actual rendered DOM.

------------------------------------------------------------------------

## 13. AZ --- ВСЕ 6 SIGNAL TYPES ОБЯЗАТЕЛЬНЫ

Проверить в реальном браузере:

``` text
SERVICES_WITHOUT_SALES
UPCOMING_BOOKINGS
PENDING_REFUNDS
RECENT_CANCELLATIONS
FAILED_PAYMENTS
BOOKING_CONFIRMATION_DELAY
```

Использовать реальные repository signal codes, если названия отличаются.

------------------------------------------------------------------------

## 14. ДЛЯ КАЖДОЙ AZ CARD ПРОВЕРИТЬ

``` text
status/category
title
subtitle
objects
observations
evidence
WHY heading
WHY claim strength
WHY primary driver
WHY contributing factors
IMPACT heading
IMPACT labels
IMPACT values
units
money
durations
relative timestamps
enum values
lifecycle actions
```

------------------------------------------------------------------------

## 15. AZ HARD GATE

В system-generated AZ DOM должно быть:

``` text
Russian UI fragments          = 0
raw English units             = 0
raw English relative time     = 0
raw payment enums             = 0
raw i18n keys                 = 0
raw "AZN" presentation        = 0
negative age/wait duration    = 0
duplicated raw durations      = 0
```

Proper nouns и user-entered content исключить из language scan.

------------------------------------------------------------------------

## 16. ОБЯЗАТЕЛЬНО ПРОВЕРИТЬ ИМЕННО РАНЕЕ НАБЛЮДАВШИЕСЯ LEAKS

AZ runtime не должен содержать system-generated:

``` text
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

Также:

``` text
count
minutes
days
hours
h ago
just now
BANK_TRANSFER
MOBILE_PAYMENT
```

------------------------------------------------------------------------

## 17. MONEY RUNTIME

Platform Reporting Currency authority остаётся:

``` text
AZN
```

Presentation:

``` text
₼
```

Проверить, что Decision Queue не показывает:

``` text
1320 AZN
$
USD
```

когда это user-facing monetary value.

------------------------------------------------------------------------

## 18. RELATIVE TIME RUNTIME

AZ должен показывать locale-correct relative time, например semantic
equivalent:

``` text
Aşkar edildi: 3 saat əvvəl
Son müşahidə: indicə
```

а не:

``` text
3h ago
just now
```

------------------------------------------------------------------------

## 19. PAYMENT ENUM RUNTIME

Не должно быть primary UI:

``` text
BANK_TRANSFER
CARD
MOBILE_PAYMENT
```

Проверить фактические localized labels в AZ.

------------------------------------------------------------------------

## 20. WHY RUNTIME

Проверить, что AZ WHY не содержит mixed fragments вроде:

``` text
31 из 31 — без настроенной доступности
31 опубликованы недавно
3 из 8
```

------------------------------------------------------------------------

## 21. IMPACT RUNTIME

Особое внимание Stage E IMPACT.

Для всех 6 signals Impact должен быть полностью locale-safe через:

``` text
labelKey
params
typed value/unit
frontend locale resolution
```

Никаких backend hardcoded Russian display labels.

------------------------------------------------------------------------

# PART C --- PREVIOUS SEMANTIC QUESTIONS

## 22. SERVICES WITHOUT SALES VALUE BINDING

Предыдущий runtime показывал подозрительное:

``` text
31 недавно опубликовано
0 count
```

Подтвердить после Round 2:

``` text
unsoldProductCount:
withoutAvailabilityCount:
withAvailabilityCount:
recentlyPublishedCount:
```

и mapping:

``` text
evidence → API → Impact → DOM
```

Если уже исправлено --- доказать runtime evidence.

------------------------------------------------------------------------

## 23. UPCOMING BOOKINGS --- 51 VS 50

Предыдущий runtime:

``` text
51 bron
Obyektlər: 50
```

В отчёте обязательно дать:

``` text
booking count:
affectedEntities count:
affected entity type(s):
deduplication behavior:
why counts differ:
correct by design: YES/NO
```

Не изменять числа только ради визуального совпадения.

------------------------------------------------------------------------

# PART D --- RU / EN REGRESSION

## 24. RU BROWSER CHECK

Минимум 3 representative cards.

Hard gate:

``` text
CJK fragments          = 0
AZ system fragments    = 0
raw EN units           = 0
raw payment enums      = 0
raw i18n keys          = 0
negative durations     = 0
```

------------------------------------------------------------------------

## 25. EN BROWSER CHECK

Минимум 3 representative cards.

Hard gate:

``` text
RU system fragments    = 0
AZ system fragments    = 0
raw enum leakage       = 0
raw i18n keys          = 0
negative durations     = 0
```

English user-facing units допустимы, если они являются formatter output,
а не вторым raw contract value.

------------------------------------------------------------------------

# PART E --- TESTING

## 26. PRODUCTION RENDERING PATH

Tests должны использовать тот же path, что production:

``` text
API DTO
→ DecisionQueue
→ presenters
→ formatters
→ i18n
→ DOM
```

Не ограничиваться проверкой наличия translation keys.

------------------------------------------------------------------------

## 27. REQUIRED COMPONENT TESTS

Добавить/подтвердить parameterized tests:

``` text
6 signal types × AZ
```

с representative:

``` text
WHY
IMPACT
evidence
duration
money
enum
relative time
```

------------------------------------------------------------------------

## 28. REQUIRED NEGATIVE DURATION TEST

Test должен доказать не просто:

``` text
rendered value >= 0
```

а:

``` text
future cancellation is excluded from recent-cancellation detector
```

если именно это соответствует установленной domain semantics.

------------------------------------------------------------------------

# PART F --- REQUIRED DELIVERABLES

## 29. DELIVERABLE A --- TEMPORAL RCA

Таблица:

  Проверка                 Результат
  ------------------------ -----------
  Timestamp authority      
  Runtime/reference time   
  Timezone                 
  Old query window         
  Future record behavior   
  Old calculation          
  Root cause               
  Correct query            
  Correct calculation      
  Math.abs removed?        
  Regression test          

------------------------------------------------------------------------

## 30. DELIVERABLE B --- AZ 6-CARD DOM EVIDENCE

Для каждой карточки предоставить actual rendered text AFTER fix:

``` text
1. SERVICES_WITHOUT_SALES
2. UPCOMING_BOOKINGS
3. PENDING_REFUNDS
4. RECENT_CANCELLATIONS
5. FAILED_PAYMENTS
6. BOOKING_CONFIRMATION_DELAY
```

Не target copy. Только фактический browser DOM output.

------------------------------------------------------------------------

## 31. DELIVERABLE C --- RUNTIME COUNTS

``` text
AZ:
RU system fragments          =
raw EN units                 =
raw EN relative time         =
raw enums                    =
raw keys                     =
raw AZN                      =
negative durations           =
duplicated raw durations     =

RU:
CJK fragments                =
AZ system fragments          =
raw EN units                 =
raw enums                    =
raw keys                     =

EN:
RU system fragments          =
AZ system fragments          =
raw enums                    =
raw keys                     =
```

------------------------------------------------------------------------

## 32. DELIVERABLE D --- SEMANTIC RECONCILIATION

``` text
ServicesWithoutSales:
  unsold =
  without availability =
  with availability =
  recently published =
  mapping correct = YES/NO

UpcomingBookings:
  bookings =
  affected entities =
  entity types =
  difference explained =
  correct by design = YES/NO
```

------------------------------------------------------------------------

## 33. DELIVERABLE E --- TEST RESULTS

``` text
New tests:
Backend tests:
Frontend tests:
Backend TSC:
Frontend TSC:
Backend build:
Frontend build:
Browser AZ 6/6:
Browser RU:
Browser EN:
```

------------------------------------------------------------------------

## 34. DELIVERABLE F --- FILES / GIT

``` text
Starting HEAD:
Final HEAD:
Files changed:
New files:
Migrations:
Commit:
Pushed to origin:
Working tree clean:
```

------------------------------------------------------------------------

## 35. REPORT

Создать:

``` text
docs/prompts/PHASE_3_POST_STAGE_E_DECISION_QUEUE_RUNTIME_LOCALIZATION_ROUND_2_FINAL_CLOSURE_REPORT.md
```

Отчёт полностью на русском.

------------------------------------------------------------------------

# PART G --- SCOPE CONTROL

## 36. НЕ ТРОГАТЬ STAGE F

Не реализовывать:

``` text
ACTION routing
recommended actions
automation
Stage F
```

------------------------------------------------------------------------

## 37. AI DECISION FEED --- НЕ ИСПРАВЛЯТЬ В ЭТОМ PROMPT

Отдельно уже обнаружены проблемы `AI Decision Feed`, включая:

``` text
168 bookings delayed
Potential value: 22355.21 AZN
+165 AZN/week
+135 AZN/week
high demand
low conversion
```

Особенно важно:

``` text
11 × 15 AZN = +165 AZN/week
9 × 15 AZN = +135 AZN/week
```

Это потенциально конфликтует с Stage E No-Fabrication authority.

**НЕ ИСПРАВЛЯТЬ AI Decision Feed в рамках этого prompt.**

После успешного closure текущего gate будет отдельный:

``` text
AI Decision Feed Semantic & Localization Reconciliation
```

------------------------------------------------------------------------

# PART H --- ACCEPTANCE

## 38. VERDICT A РАЗРЕШЁН ТОЛЬКО ЕСЛИ

1.  `Math.abs()` masking fix устранён либо строго доказана его domain
    correctness.
2.  Future cancellations не превращаются в past age.
3.  RecentCancellations temporal semantics доказаны.
4.  Date/window regression tests проходят.
5.  Все 6 AZ signal cards проверены в actual browser.
6.  AZ Russian system fragments = 0.
7.  AZ raw EN units = 0.
8.  AZ `h ago/just now` = 0.
9.  AZ raw payment enums = 0.
10. AZ raw i18n keys = 0.
11. AZ raw `AZN` presentation = 0.
12. Negative age/wait durations = 0 по корректной domain причине.
13. Duplicated raw durations = 0.
14. ServicesWithoutSales mapping доказан.
15. Upcoming 51 vs 50 semantics доказаны/исправлены.
16. RU browser regression PASS.
17. EN browser regression PASS.
18. Production-path tests PASS.
19. Stage F не запускался.
20. AI Decision Feed не изменялся.
21. Финальный отчёт предоставлен на русском.

------------------------------------------------------------------------

# 39. FINAL VERDICT

Вернуть **ровно один**:

## VERDICT A --- ROUND 2 FINAL CLOSURE COMPLETE / RUNTIME LOCALIZATION VERIFIED / STAGE F TECHNICALLY READY

Только если все acceptance criteria выполнены.

или:

## VERDICT B --- ROUND 2 FINAL CLOSURE REMEDIATION REQUIRED

Список unresolved items:

``` text
Temporal semantics:
AZ runtime:
WHY:
IMPACT:
Evidence:
Units:
Relative time:
Enums:
Services mapping:
Upcoming entities:
RU regression:
EN regression:
```

или:

## VERDICT C --- BLOCKED / TEMPORAL OR PRESENTATION CONTRACT GAP

Только если обнаружен архитектурный blocker.

------------------------------------------------------------------------

# 40. STOP

После отчёта:

**STOP.**

Не запускать автоматически Stage F.

Следующим отдельным gate после успешного closure будет:

``` text
AI Decision Feed Semantic & Localization Reconciliation
```

и только после его review будет принято решение о запуске Stage F.
