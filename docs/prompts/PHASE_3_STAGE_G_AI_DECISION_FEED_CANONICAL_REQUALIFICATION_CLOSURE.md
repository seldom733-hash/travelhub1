# PHASE 3 --- STAGE G

# AI DECISION FEED --- CANONICAL RE-QUALIFICATION & FORMAL CLOSURE

## NO RE-IMPLEMENTATION / ROADMAP STATUS RECONCILIATION

## PRE-STAGE-H GATE

------------------------------------------------------------------------

## 1. ОБЯЗАТЕЛЬНОЕ ТРЕБОВАНИЕ К ЯЗЫКУ

Все ответы разработчика, findings, таблицы, evidence, результаты
проверок и финальный отчёт должны быть предоставлены **НА РУССКОМ
ЯЗЫКЕ**.

Technical identifiers, paths, code, enums, commands, SHA и commit
messages можно сохранять в оригинальном виде.

------------------------------------------------------------------------

# 2. ВАЖНО: STAGE G НЕ НУЖНО РЕАЛИЗОВЫВАТЬ ЗАНОВО

Canonical roadmap определяет:

``` text
Stage G — AI Decision Feed Reconciliation
```

Но фактическая работа этого stage уже была выполнена досрочно как
blocking gate перед Stage F:

``` text
PHASE_3_AI_DECISION_FEED_SEMANTIC_LOCALIZATION_RECONCILIATION
```

и завершилась:

``` text
VERDICT A — AI DECISION FEED SEMANTICS RECONCILED /
LOCALIZATION VERIFIED /
FINANCIAL NO-FABRICATION CLOSED /
STAGE F READY
```

Поэтому задача текущего prompt:

``` text
НЕ re-implement Stage G
НЕ переписывать AI Decision Feed
НЕ добавлять новые features
```

а **формально re-qualify уже выполненную работу против canonical Stage G
scope** и, если coverage полное, закрыть Stage G в roadmap.

------------------------------------------------------------------------

# 3. ТЕКУЩИЙ STATUS

``` text
Stage C — WHAT       COMPLETE
Stage D — WHY        COMPLETE
Stage E — IMPACT     COMPLETE
Stage F — ACTION     COMPLETE

Decision Loop        CLOSED

AI Decision Feed semantic reconciliation     COMPLETE
AI Feed localization RU/AZ/EN                VERIFIED
AI Feed financial no-fabrication             CLOSED
AI Feed ACTION-authority conflict             CLOSED

Canonical Stage G formal status               TO RE-QUALIFY NOW
Stage H                                     DO NOT START
```

------------------------------------------------------------------------

# 4. CANONICAL STAGE G SCOPE

Проверить существующий canonical roadmap / architecture documents и
подтвердить фактический scope Stage G.

Минимально ожидаемая canonical семантика Stage G:

``` text
AI Decision Feed Reconciliation

- reconcile hardcoded/legacy feed logic;
- use traceable evidence;
- reconcile with DecisionSignal architecture;
- integrate/align with WHY and IMPACT authority where applicable;
- remove fabricated potential values / arbitrary financial estimates;
- prevent a second independent decision truth;
- preserve AI Feed as informational insight where it is legitimately separate;
- localization/presentation must not bypass canonical contracts.
```

Если roadmap содержит дополнительные Stage G requirements ---
перечислить их дословно по смыслу и включить в coverage matrix.

------------------------------------------------------------------------

# 5. SOURCE-OF-TRUTH AUDIT

Найти и проверить минимум:

``` text
canonical roadmap
Phase 3 architecture report
Stage C report
Stage D report
Stage E report
Stage F report
AI Decision Feed Semantic & Localization Reconciliation report
relevant ADRs
current implementation
```

Не полагаться только на предыдущий VERDICT.

------------------------------------------------------------------------

# 6. COVERAGE MATRIX --- MANDATORY

Создать:

  --------------------------------------------------------------------------
  Canonical Stage G   Already implemented? Evidence         Gap?
  requirement                                               
  ------------------ --------------------- ---------------- ----------------
  Legacy/hardcoded                                          
  feed                                                      
  reconciliation                                            

  Evidence                                                  
  traceability                                              

  DecisionSignal                                            
  relationship                                              
  defined                                                   

  WHY alignment                                             

  IMPACT alignment                                          

  No fabricated                                             
  financial values                                          

  No second                                                 
  financial truth                                           

  ACTION boundary                                           

  RU/AZ/EN                                                  
  localization                                              

  Runtime                                                   
  verification                                              

  Tests                                                     
  --------------------------------------------------------------------------

Добавить строки, если canonical roadmap требует больше.

------------------------------------------------------------------------

# 7. AI FEED ARCHITECTURAL CLASSIFICATION

Подтвердить действующее решение:

``` text
AI Decision Feed
→ Category B — Separate informational insight
```

Но доказать, что Category B не означает:

``` text
independent financial authority
independent ACTION authority
untraceable AI-generated numbers
duplicate DecisionSignal truth
```

------------------------------------------------------------------------

# 8. DECISIONSIGNAL RELATIONSHIP

Для каждого текущего типа AI Feed insight:

``` text
delayed bookings
high demand
low paid share / conversion
historical performance
```

дать classification:

``` text
duplicates canonical DecisionSignal? YES/NO
shares evidence? YES/NO
uses WHY authority? YES/NO / N/A
uses IMPACT authority? YES/NO / N/A
separate informational insight justified? YES/NO
```

Если существует реальный semantic duplication --- это gap.

Не создавать искусственную связь только ради формального Stage G
closure.

------------------------------------------------------------------------

# 9. FINANCIAL NO-FABRICATION RE-VERIFY

Подтвердить отсутствие в current production path:

``` text
+165 AZN/week
+135 AZN/week
n × 15 AZN/week
arbitrary opportunity coefficient
fabricated revenue uplift
fabricated loss
fabricated profit
```

Проверить код, API и browser runtime.

------------------------------------------------------------------------

# 10. AFFECTED VOLUME

Ранее:

``` text
Potential value: 22355.21 AZN
```

было reconciled в:

``` text
Затронутый объём: 22 355 ₼
```

с authority:

``` text
SUM(booking.amount)
```

Re-verify:

``` text
source rows
formula
DB value
API value
UI value
currency
label semantics
```

Не называть affected volume:

``` text
Revenue
Profit
Loss
Potential Revenue
```

------------------------------------------------------------------------

# 11. HIGH DEMAND

Re-verify factual rule.

Для representative service вернуть:

``` text
service:
period:
orders:
qualifying statuses:
threshold/rule:
DB:
API:
UI:
financial uplift present: NO
```

------------------------------------------------------------------------

# 12. LOW PAID SHARE / CONVERSION

Проверить, что current terminology соответствует формуле.

Representative example:

``` text
5 / 14
36%
```

Вернуть:

``` text
numerator:
denominator:
cohort:
statuses:
partial payment handling:
refund handling:
cancelled handling:
final semantic label:
```

Если это не conversion, raw term `conversion` не должен возвращаться.

------------------------------------------------------------------------

# 13. HISTORICAL PERFORMANCE

Representative archived service:

``` text
orders before archiving:
archive authority:
rule/threshold:
evidence:
UI wording:
```

Не превращать historical count в прогноз будущих продаж.

------------------------------------------------------------------------

# 14. ACTION BOUNDARY AFTER STAGE F

Stage F теперь COMPLETE.

Проверить, что AI Feed после Stage F всё ещё:

``` text
не создаёт собственные executable actions;
не возвращает legacy recommendation prose как parallel ACTION authority;
не обходит Stage F action contract/RBAC;
```

Не добавлять Stage F actions в AI Feed в этом prompt.

Если будущая интеграция желательна --- записать только как future
consideration.

------------------------------------------------------------------------

# 15. LLM / AI BOUNDARY

Установить фактическое текущее поведение:

``` text
Uses LLM: YES/NO
LLM generates numbers: YES/NO
LLM generates financial values: YES/NO
LLM changes evidence: YES/NO
LLM creates executable actions: YES/NO
```

Если Feed фактически deterministic, зафиксировать это.

Не переименовывать секцию автоматически.

------------------------------------------------------------------------

# 16. LOCALIZATION RE-VERIFY

Canonical titles:

``` text
RU → Лента решений ИИ
AZ → AI Qərar Lentesi
EN → AI Decision Feed
```

Проверить actual browser runtime.

System-generated content:

``` text
RU → EN/AZ leaks = 0
AZ → RU/EN leaks = 0
EN → RU/AZ leaks = 0
raw i18n keys = 0
```

Proper names/user content исключить.

------------------------------------------------------------------------

# 17. CURRENCY

Platform Reporting Currency:

``` text
AZN
```

User-facing presentation:

``` text
₼
```

Проверить отсутствие unintended:

``` text
$
USD
AZN/week
raw fabricated financial presentation
```

------------------------------------------------------------------------

# 18. STAGE F REGRESSION

Поскольку Stage G формально закрывается после фактического Stage F
implementation, убедиться, что Stage F не вернул конфликт:

``` text
AI Feed recommendations as actions
duplicate ACTION buttons
financial promises
AI-generated executable actions
```

------------------------------------------------------------------------

# 19. NO REIMPLEMENTATION RULE

Если все canonical Stage G requirements уже покрыты:

``` text
code changes SHOULD BE ZERO
```

кроме:

``` text
documentation
roadmap status
report
```

Не менять production code только ради создания diff.

------------------------------------------------------------------------

# 20. MINIMAL REMEDIATION POLICY

Если обнаружен реальный небольшой gap:

``` text
исправить только Stage G gap
```

Не расширять scope на Stage H.

Если gap архитектурный --- вернуть VERDICT C вместо большого redesign
без review.

------------------------------------------------------------------------

# 21. RUNTIME VALIDATION

Проверить actual browser:

``` text
RU full AI Decision Feed
AZ full AI Decision Feed
EN full AI Decision Feed
```

Предоставить concise actual DOM evidence.

------------------------------------------------------------------------

# 22. TESTS

Запустить relevant suites минимум:

``` text
AI Feed frontend tests
Command Center frontend tests
Dashboard backend tests
TSC backend/frontend
build backend/frontend
```

Если production code не менялся, не создавать искусственные tests без
необходимости.

------------------------------------------------------------------------

# 23. REQUIRED DELIVERABLE A --- CANONICAL SCOPE

Вернуть:

``` text
Canonical Stage G name:
Canonical source:
Canonical requirements:
Dependencies:
Expected successor:
```

------------------------------------------------------------------------

# 24. REQUIRED DELIVERABLE B --- COVERAGE

Полная matrix:

  Requirement   Existing implementation   Evidence   PASS/GAP
  ------------- ------------------------- ---------- ----------

------------------------------------------------------------------------

# 25. REQUIRED DELIVERABLE C --- SEMANTIC AUTHORITY

``` text
Delayed bookings:
High demand:
Low paid share:
Historical performance:
Affected volume:
Financial estimates:
DecisionSignal relationship:
WHY relationship:
IMPACT relationship:
ACTION relationship:
```

------------------------------------------------------------------------

# 26. REQUIRED DELIVERABLE D --- NO-FABRICATION

``` text
arbitrary coefficients found:
+AZN/week found:
fabricated revenue/profit/loss found:
affected volume DB/API/UI:
currency:
```

------------------------------------------------------------------------

# 27. REQUIRED DELIVERABLE E --- RUNTIME

``` text
RU browser:
AZ browser:
EN browser:

raw keys:
mixed system languages:
unexpected $/USD:
fabricated +AZN/week:
```

------------------------------------------------------------------------

# 28. REQUIRED DELIVERABLE F --- REGRESSION

``` text
Backend tests:
Frontend tests:
Backend TSC:
Frontend TSC:
Backend build:
Frontend build:
Stage F regression:
```

------------------------------------------------------------------------

# 29. REQUIRED DELIVERABLE G --- GIT

``` text
Starting HEAD:
Final HEAD:
Production code changed: YES/NO
Docs changed:
Migrations:
Commit:
Pushed:
Working tree clean:
```

------------------------------------------------------------------------

# 30. DOCUMENTATION

Создать:

``` text
docs/prompts/PHASE_3_STAGE_G_AI_DECISION_FEED_CANONICAL_REQUALIFICATION_CLOSURE_REPORT.md
```

Отчёт полностью на русском.

------------------------------------------------------------------------

# 31. CANONICAL ROADMAP UPDATE

Только при VERDICT A additive update:

``` text
Stage G — AI Decision Feed Reconciliation
→ COMPLETE

Implementation note:
→ Stage G canonical scope was materially completed earlier by the
  pre-Stage-F AI Decision Feed Semantic & Localization Reconciliation gate.
→ This Stage G pass formally re-qualified that implementation against
  the canonical roadmap and closed the roadmap status.
```

Не переписывать историю так, будто работа впервые выполнена сейчас.

------------------------------------------------------------------------

# 32. NEXT STAGE

При успешном VERDICT A:

``` text
NEXT → Stage H
```

Canonical Stage H:

``` text
Executive / Operational / Financial Decision Enrichment
```

Но **Stage H НЕ ЗАПУСКАТЬ автоматически**.

------------------------------------------------------------------------

# 33. STAGE H --- НЕ ТРОГАТЬ

Не реализовывать сейчас:

``` text
Expected / Collected / Outstanding Revenue enrichment
Revenue Mix
Marketplace / Storefront SaaS contribution
broader Executive/Operational/Financial enrichment
new KPI cards
new financial architecture
```

Это scope Stage H.

------------------------------------------------------------------------

# 34. ACCEPTANCE CRITERIA

VERDICT A только если:

1.  Canonical Stage G source найден и процитирован в отчёте.
2.  Все Stage G requirements reconciled.
3.  AI Feed не является второй financial truth.
4.  AI Feed не является второй ACTION authority.
5.  Fabricated `+AZN/week` отсутствует.
6.  Arbitrary financial coefficients отсутствуют.
7.  Affected volume доказан DB/API/UI.
8.  High-demand rule traceable.
9.  Low-paid-share semantics traceable.
10. Historical-performance semantics traceable.
11. DecisionSignal relationship явно определён.
12. WHY/IMPACT relationship явно определён.
13. Stage F regression PASS.
14. RU/AZ/EN browser runtime PASS.
15. AZN authority сохранён.
16. Tests/TSC/build PASS.
17. Roadmap history сохранена additively.
18. Stage H не запускался.
19. Отчёт предоставлен на русском.

------------------------------------------------------------------------

# 35. FINAL VERDICT

Вернуть ровно один:

## VERDICT A --- STAGE G CANONICALLY RE-QUALIFIED / AI DECISION FEED RECONCILIATION FORMALLY CLOSED / STAGE H READY

или:

## VERDICT B --- STAGE G REMEDIATION REQUIRED

Разделить gaps:

``` text
Canonical coverage:
DecisionSignal relationship:
WHY/IMPACT:
Financial semantics:
No-fabrication:
ACTION boundary:
Localization:
Runtime:
Tests:
Roadmap:
```

или:

## VERDICT C --- BLOCKED / STAGE G ARCHITECTURE CONFLICT

Только если фактическая реализация не может быть reconciled с canonical
Stage G без отдельного architecture decision.

------------------------------------------------------------------------

# 36. STOP

После отчёта:

**STOP.**

Не запускать Stage H/I/J автоматически.

Дождаться review и отдельного разрешения.
