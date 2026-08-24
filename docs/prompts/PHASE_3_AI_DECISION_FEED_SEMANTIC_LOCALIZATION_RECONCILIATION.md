# PHASE 3 --- PRE-STAGE-F

# AI DECISION FEED --- SEMANTIC & LOCALIZATION RECONCILIATION

## FINANCIAL NO-FABRICATION / RU-AZ-EN RUNTIME / ACTION BOUNDARY

## STAGE F BLOCKING GATE

------------------------------------------------------------------------

## 1. ОБЯЗАТЕЛЬНОЕ ТРЕБОВАНИЕ К ЯЗЫКУ

Все ответы разработчика, findings, root-cause analysis, таблицы, runtime
evidence, отчёты и финальный VERDICT должны быть предоставлены **НА
РУССКОМ ЯЗЫКЕ**.

Technical identifiers, code, paths, enums, commands, SHA и API fields
сохранять в оригинальном виде.

------------------------------------------------------------------------

## 2. КОНТЕКСТ

Canonical Decision Loop:

``` text
WHAT    → Stage C → COMPLETE
WHY     → Stage D → COMPLETE
IMPACT  → Stage E → COMPLETE
ACTION  → Stage F → TECHNICALLY READY, BUT BLOCKED BY THIS GATE
```

Decision Queue Round 2 Final Closure:

``` text
VERDICT A
Runtime localization verified
Temporal semantics corrected
```

Однако отдельная существующая секция **AI Decision Feed** продолжает
использовать собственную semantic/localization модель и показывает
данные, конфликтующие с Stage E authority.

Поэтому:

``` text
Stage F → DO NOT START
```

до завершения этого reconciliation.

------------------------------------------------------------------------

# 3. AUTHORITATIVE RUNTIME EVIDENCE --- RU

В русском интерфейсе сейчас отображается:

``` text
AI Decision Feed

⚠️ Риски

168 bookings delayed
Potential value: 22355.21 AZN

🚀 Возможности

Puppet Theater Show — high demand
11 orders in last 30 days. Consider increasing exposure.
+165 AZN/week

Weekend in Baku Package — high demand
11 orders in last 30 days. Consider increasing exposure.
+165 AZN/week

Flame Towers Sunset Tour — high demand
9 orders in last 30 days. Consider increasing exposure.
+135 AZN/week

Azerbaijan Cooking Class — high demand
9 orders in last 30 days. Consider increasing exposure.
+135 AZN/week

Absheron Peninsula Tour — high demand
9 orders in last 30 days. Consider increasing exposure.
+135 AZN/week

📦 Каталог

Baku Hammam Experience — low conversion
Only 36% paid (5/14 orders). Review pricing/content.

Caucasus Mountains Expedition — low conversion
Only 38% paid (5/13 orders). Review pricing/content.

Baku → Gabala (Private) — low conversion
Only 36% paid (4/11 orders). Review pricing/content.

Summer Beach & City Tour — strong historical performance
16 orders before archiving. Consider reactivation or replacement.

Night Market Tour (Seasonal) — strong historical performance
13 orders before archiving. Consider reactivation or replacement.

Baku Seaside Hotel (Closed) — strong historical performance
11 orders before archiving. Consider reactivation or replacement.
```

------------------------------------------------------------------------

# 4. AUTHORITATIVE LOCALIZATION DEFECT

RU locale:

``` text
AI Decision Feed  ❌
```

AZ locale уже локализован:

``` text
AI Qərar Lentesi  ✅
```

Canonical section titles:

``` text
RU → Лента решений ИИ
AZ → AI Qərar Lentesi
EN → AI Decision Feed
```

Если repository имеет утверждённый naming convention, сохранить смысл и
документировать отклонение.

------------------------------------------------------------------------

# 5. LOCALIZATION SCOPE

Локализовать не только section heading, но весь **system-generated UI**:

``` text
section title
group headings
risk titles
opportunity suffixes
catalog suffixes
descriptions
metric labels
recommendation text
units
currency presentation
empty/loading/error states
tooltips, если есть
```

Названия услуг являются content и не обязаны переводиться этим
remediation.

------------------------------------------------------------------------

# 6. RU / AZ / EN MATRIX

Минимальный canonical matrix:

  Semantic element   RU                 AZ                 EN
  ------------------ ------------------ ------------------ ------------------
  Feed title         Лента решений ИИ   AI Qərar Lentesi   AI Decision Feed
  Risks              Риски              Risklər            Risks
  Opportunities      Возможности        İmkanlar           Opportunities
  Catalog            Каталог            Kataloq            Catalog

Все остальные тексты должны идти через semantic i18n keys + structured
params.

Не хранить готовые EN/RU sentences в business/service layer.

------------------------------------------------------------------------

# 7. PRIMARY SEMANTIC CONFLICT --- FABRICATED FINANCIAL IMPACT

Runtime:

``` text
11 orders → +165 AZN/week
9 orders  → +135 AZN/week
```

Это математически соответствует:

``` text
11 × 15 AZN/week = 165
9 × 15 AZN/week  = 135
```

Stage E уже установил No-Fabrication authority:

``` text
NO count × arbitrary coefficient
NO n × 15 AZN/week
NO invented lost revenue
NO invented future revenue
NO arbitrary financial severity
```

Следовательно `+165 AZN/week` / `+135 AZN/week` нельзя сохранять как
factual impact, если нет доказуемого business source.

------------------------------------------------------------------------

# 8. MANDATORY FORMULA TRACE

Для каждого financial number AI Feed определить:

``` text
UI value
source function
source fields
formula
coefficient
date scope
currency
business meaning
evidence source
PROVABLE / NOT PROVABLE
```

Особенно:

``` text
+165 AZN/week
+135 AZN/week
Potential value: 22355.21 AZN
```

------------------------------------------------------------------------

# 9. +AZN/WEEK POLICY

Если `+165/+135` основаны на arbitrary coefficient:

``` text
REMOVE from user-facing feed
```

Не заменять на другую выдуманную формулу.

Не переводить просто:

``` text
+165 ₼/неделю
```

Это исправит localization, но оставит semantic defect.

Если существует реальная доказуемая source metric, доказать её DB/API
reconciliation.

------------------------------------------------------------------------

# 10. POTENTIAL VALUE --- REQUIRED AUDIT

Current:

``` text
Potential value: 22355.21 AZN
```

Установить точную формулу.

Если это:

``` text
SUM(actual Order.amount for affected bookings)
```

то это не `potential value`, а фактический affected business volume /
GMV-like scope.

В таком случае:

-   переименовать по доказанному смыслу;
-   не называть Revenue/Profit/Loss;
-   использовать AZN authority;
-   presentation через `₼`;
-   соблюдать Stage E financial semantics.

Если число получено через forecast/coefficient:

``` text
NOT PROVABLE
```

и не показывать как factual financial impact.

------------------------------------------------------------------------

# 11. GMV ≠ REVENUE ≠ PROFIT ≠ LOSS

AI Feed запрещено смешивать:

``` text
GMV
Collected GMV
Payment Volume
Revenue
Commission
Profit
Loss
Potential value
```

Каждый monetary metric должен иметь documented authority.

Stage B.1/B.2 и Stage E financial semantics не переопределять.

------------------------------------------------------------------------

# 12. DUPLICATE DECISION AUTHORITY RISK

Сейчас существуют:

``` text
DecisionSignal
→ WHAT
→ WHY
→ IMPACT
```

и отдельно:

``` text
AI Decision Feed
→ risk/opportunity/catalog rules
→ financial estimates
→ recommendations
```

Нужно определить relationship.

AI Feed **не должен создавать вторую независимую financial truth**.

------------------------------------------------------------------------

# 13. REQUIRED ARCHITECTURAL CLASSIFICATION

Для каждого AI Feed item определить один из вариантов:

``` text
A. Projection/view over canonical DecisionSignal/WHY/IMPACT
B. Separate informational insight with its own evidence contract
C. Legacy rule requiring migration into DecisionSignal architecture
D. Unsupported/fabricated legacy item requiring removal
```

Вернуть matrix для:

``` text
delayed bookings
high demand
low conversion
strong historical performance
```

------------------------------------------------------------------------

# 14. RISKS --- DELAYED BOOKINGS

Current:

``` text
168 bookings delayed
Potential value: 22355.21 AZN
```

Проверить:

``` text
what counts as delayed?
which booking statuses?
which SLA?
which date field?
period/cohort?
does it duplicate BOOKING_CONFIRMATION_DELAY DecisionSignal?
why count differs from Decision Queue if it differs?
```

Если это тот же business condition, предпочтительно не иметь две
расходящиеся authority.

------------------------------------------------------------------------

# 15. OPPORTUNITIES --- HIGH DEMAND

Current:

``` text
11 orders in last 30 days
high demand
Consider increasing exposure.
```

Установить deterministic rule:

``` text
period = ?
qualifying order statuses = ?
threshold = ?
service state = ?
tenant/workspace scope = ?
```

`high demand` допустим только как rule-based observation с traceable
evidence.

Не использовать AI-style prose как замену rule authority.

------------------------------------------------------------------------

# 16. CATALOG --- LOW CONVERSION

Current:

``` text
Only 36% paid (5/14 orders)
```

Проверить denominator/numerator:

``` text
5 = what exact status/condition?
14 = what exact order cohort?
createdAt or payment event period?
cancelled orders included?
partial payments?
refunds?
```

Не использовать термин `conversion`, если формула фактически означает
`paid-order share`.

Если это paid share --- назвать метрику корректно.

------------------------------------------------------------------------

# 17. CATALOG --- HISTORICAL PERFORMANCE

Current:

``` text
16 orders before archiving
strong historical performance
```

Проверить:

``` text
what qualifies as "strong"?
threshold?
comparison baseline?
archived/closed status authority?
historical window?
```

Если `strong` основан только на arbitrary threshold без documented
authority, классифицировать как heuristic и не представлять как
доказанный impact.

------------------------------------------------------------------------

# 18. ACTION BOUNDARY --- CRITICAL

Current Feed содержит:

``` text
Consider increasing exposure.
Review pricing/content.
Consider reactivation or replacement.
```

Это уже рекомендации действий.

Но canonical loop:

``` text
ACTION → Stage F
```

ещё не реализован.

Нужно решить boundary до Stage F.

------------------------------------------------------------------------

# 19. PRE-STAGE-F POLICY

До Stage F AI Feed может показывать:

``` text
observed condition
evidence
verified metric
informational insight
```

но не должен создавать parallel authoritative ACTION engine.

Для existing recommendation prose выбрать и документировать:

``` text
REMOVE until Stage F
```

или:

``` text
retain as explicitly non-authoritative informational hint
```

Требуется обоснование.

Предпочтение: не дублировать будущую Stage F action authority.

------------------------------------------------------------------------

# 20. NO LLM FABRICATION

Если AI Feed действительно использует AI/LLM generation, определить:

``` text
does model generate numbers?
does model generate financial estimates?
does model alter evidence?
does model choose severity?
does model generate recommendations?
```

Mandatory rule:

``` text
LLM MUST NOT invent numeric evidence or financial impact.
```

Все числа должны приходить из deterministic/traceable structured data.

------------------------------------------------------------------------

# 21. NAME "AI DECISION FEED"

Проверить, действительно ли секция использует AI.

Если это полностью deterministic rules engine без AI/LLM, зафиксировать
naming mismatch.

Не переименовывать автоматически --- только дать finding и
recommendation.

------------------------------------------------------------------------

# 22. CURRENCY AUTHORITY

Platform Reporting Currency:

``` text
AZN
```

User-facing monetary presentation:

``` text
₼
```

В RU/AZ/EN интерфейсе не показывать raw:

``` text
22355.21 AZN
165 AZN/week
135 AZN/week
$
USD
```

если это UI presentation.

Форматировать locale-aware, сохраняя AZN.

------------------------------------------------------------------------

# 23. LOCALIZED PARAMETERIZED TEXT

Bad:

``` ts
`${orders} orders in last 30 days. Consider increasing exposure.`
```

Preferred:

``` text
translation key
+ structured params:
  orders
  days
```

А recommendations --- согласно Action Boundary policy.

------------------------------------------------------------------------

# 24. REQUIRED I18N COVERAGE

Проверить RU/AZ/EN для минимум:

``` text
feed title
risk/opportunity/catalog headings
bookings delayed
affected/verified volume label
high demand
orders in last N days
low paid share / correct semantic replacement
paid X of Y orders
historical performance
orders before archiving
all remaining recommendation/hint text if retained
money/unit presentation
empty state
loading/error state if visible
```

------------------------------------------------------------------------

# 25. RUNTIME HARD GATE --- RU

RU system-generated AI Feed DOM:

``` text
English system fragments = 0
AZ system fragments      = 0
raw i18n keys            = 0
raw AZN presentation     = 0
fabricated +AZN/week     = 0
```

Names/content excluded.

Specifically must not contain:

``` text
AI Decision Feed
bookings delayed
Potential value
high demand
orders in last
Consider increasing exposure
low conversion
Only
paid
Review pricing/content
strong historical performance
orders before archiving
Consider reactivation or replacement
AZN/week
```

------------------------------------------------------------------------

# 26. RUNTIME HARD GATE --- AZ

AZ system-generated AI Feed DOM:

``` text
RU system fragments      = 0
EN system fragments      = 0
raw i18n keys            = 0
raw AZN presentation     = 0
fabricated +AZN/week     = 0
```

Section title:

``` text
AI Qərar Lentesi
```

------------------------------------------------------------------------

# 27. RUNTIME HARD GATE --- EN

EN system-generated AI Feed DOM:

``` text
RU system fragments      = 0
AZ system fragments      = 0
raw i18n keys            = 0
fabricated +AZN/week     = 0
```

Section title:

``` text
AI Decision Feed
```

Currency remains AZN business authority, formatted appropriately.

------------------------------------------------------------------------

# 28. BROWSER VALIDATION --- MANDATORY

VERDICT A нельзя выдавать только по:

``` text
grep
dictionary keys
unit tests
API response
```

Проверить реальный browser DOM:

``` text
RU → full AI Decision Feed
AZ → full AI Decision Feed
EN → full AI Decision Feed
```

Предоставить actual rendered DOM text dump.

------------------------------------------------------------------------

# 29. PRODUCTION-PATH TESTS

Добавить tests, проходящие production path:

``` text
backend/API insight
→ frontend mapping
→ i18n
→ formatter
→ rendered AI Decision Feed DOM
```

Минимум RU/AZ/EN.

------------------------------------------------------------------------

# 30. FINANCIAL REGRESSION TESTS

Обязательно assert absence:

``` text
+165 AZN/week
+135 AZN/week
```

и эквивалентных arbitrary `count × coefficient` результатов.

Если formula удаляется, добавить regression test, предотвращающий её
возврат.

------------------------------------------------------------------------

# 31. POTENTIAL VALUE RECONCILIATION TEST

Если `22355.21` остаётся после semantic audit:

``` text
DB source = API = UI exact value
```

и label должен соответствовать доказанному смыслу.

Если не доказуемо --- удалить.

------------------------------------------------------------------------

# 32. LOW-CONVERSION RECONCILIATION

Для одного representative product доказать:

``` text
orders cohort:
paid count:
denominator:
percentage:
DB:
API:
UI:
```

Проверить partial/refunded/cancelled semantics.

------------------------------------------------------------------------

# 33. HIGH-DEMAND RECONCILIATION

Для одного representative product:

``` text
orders:
period:
qualifying statuses:
threshold:
DB:
API:
UI:
```

Без arbitrary financial uplift.

------------------------------------------------------------------------

# 34. HISTORICAL PERFORMANCE RECONCILIATION

Для одного archived service:

``` text
historical orders:
archive timestamp:
rule threshold:
DB:
API:
UI:
```

------------------------------------------------------------------------

# 35. REQUIRED DELIVERABLE A --- INVENTORY

Таблица всех AI Feed rules:

  ------------------------------------------------------------------------------------------
  Rule       Category   Evidence   Formula    Monetary?   Recommendation?   Classification
                                                                            A/B/C/D
  ---------- ---------- ---------- ---------- ----------- ----------------- ----------------

  ------------------------------------------------------------------------------------------

------------------------------------------------------------------------

# 36. REQUIRED DELIVERABLE B --- FINANCIAL AUTHORITY

``` text
+165 AZN/week:
  source =
  formula =
  provable =
  disposition =

+135 AZN/week:
  source =
  formula =
  provable =
  disposition =

22355.21 AZN:
  source =
  formula =
  business meaning =
  DB reconciliation =
  provable =
  final label =
```

------------------------------------------------------------------------

# 37. REQUIRED DELIVERABLE C --- ACTION BOUNDARY

Вернуть:

``` text
Existing recommendation prose:
  increasing exposure =
  pricing/content =
  reactivation/replacement =

Before Stage F:
  retained / removed / informational-only

Why:
How Stage F will become authoritative:
```

------------------------------------------------------------------------

# 38. REQUIRED DELIVERABLE D --- LOCALIZATION MATRIX

  Element                     RU   AZ   EN   Runtime verified
  --------------------------- ---- ---- ---- ------------------
  Feed title                                 
  Risks                                      
  Opportunities                              
  Catalog                                    
  Delayed bookings                           
  High demand                                
  Low paid share/conversion                  
  Historical performance                     
  Recommendation/hint text                   
  Monetary presentation                      

------------------------------------------------------------------------

# 39. REQUIRED DELIVERABLE E --- BROWSER DOM

Предоставить actual rendered text dump:

``` text
RU full feed
AZ full feed
EN full feed
```

Не target strings.

------------------------------------------------------------------------

# 40. REQUIRED DELIVERABLE F --- TESTS

``` text
New tests:
Backend tests:
Frontend tests:
Backend TSC:
Frontend TSC:
Backend build:
Frontend build:
RU browser:
AZ browser:
EN browser:
```

------------------------------------------------------------------------

# 41. REQUIRED DELIVERABLE G --- FILES / GIT

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

# 42. DOCUMENTATION

Создать:

``` text
docs/prompts/PHASE_3_AI_DECISION_FEED_SEMANTIC_LOCALIZATION_RECONCILIATION_REPORT.md
```

Отчёт полностью на русском.

Если требуется архитектурное решение, обновить существующий canonical
ADR additively, не создавая конфликтующую financial authority.

------------------------------------------------------------------------

# 43. SCOPE CONTROL

Не реализовывать Stage F.

Не добавлять:

``` text
action routing
action execution
automation
action priority scoring
LLM-generated financial forecasts
new arbitrary opportunity coefficients
```

------------------------------------------------------------------------

# 44. ACCEPTANCE CRITERIA

VERDICT A разрешён только если:

1.  RU title = `Лента решений ИИ` (или documented canonical equivalent).
2.  AZ title корректен.
3.  EN title корректен.
4.  Весь system-generated Feed локализован RU/AZ/EN.
5.  `+165 AZN/week` и `+135 AZN/week` audited.
6.  Arbitrary `n × 15 AZN/week` удалён.
7.  `Potential value 22355.21` доказан и корректно переименован либо
    удалён.
8.  GMV/Revenue/Profit/Loss semantics не смешиваются.
9.  High-demand rule traceable.
10. Low-conversion/paid-share formula reconciled.
11. Historical-performance rule traceable.
12. AI Feed relationship to DecisionSignal architecture классифицирован.
13. Recommendation prose не создаёт parallel authoritative ACTION
    engine.
14. LLM не может invent numeric/financial evidence.
15. AZN authority сохранён, UI использует ₼.
16. RU runtime system EN fragments = 0.
17. AZ runtime system RU/EN fragments = 0.
18. EN runtime system RU/AZ fragments = 0.
19. Browser DOM evidence предоставлен для 3 locales.
20. Production-path tests проходят.
21. Stage F не запускался.
22. Отчёт предоставлен на русском.

------------------------------------------------------------------------

# 45. FINAL VERDICT

Вернуть ровно один:

## VERDICT A --- AI DECISION FEED SEMANTICS RECONCILED / LOCALIZATION VERIFIED / FINANCIAL NO-FABRICATION CLOSED / STAGE F READY

или:

## VERDICT B --- AI DECISION FEED REMEDIATION REQUIRED

Разделить unresolved items:

``` text
Localization:
Financial semantics:
Potential value:
High demand:
Low conversion:
Historical performance:
DecisionSignal relationship:
Action boundary:
Runtime:
Tests:
```

или:

## VERDICT C --- BLOCKED / AI FEED ARCHITECTURE CONFLICT

Только если существующая архитектура Feed принципиально конфликтует с
canonical DecisionSignal/WHY/IMPACT authority и требует отдельного
architecture decision.

------------------------------------------------------------------------

# 46. STOP

После отчёта:

**STOP.**

Не запускать Stage F автоматически.

После VERDICT A дождаться review и отдельного разрешения на Stage F.
