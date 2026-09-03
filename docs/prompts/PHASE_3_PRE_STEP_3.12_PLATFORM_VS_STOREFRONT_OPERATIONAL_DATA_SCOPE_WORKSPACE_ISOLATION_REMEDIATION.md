\# PHASE 3 — PRE-STEP 3.12 — PLATFORM vs STOREFRONT OPERATIONAL DATA SCOPE \& WORKSPACE ISOLATION REMEDIATION



\## ТИП ЗАДАЧИ



\*\*ARCHITECTURE CORRECTION + IMPLEMENTATION REMEDIATION + CANONICAL DOCUMENTATION UPDATE\*\*



Starting point:



```text

Starting SHA: 8ce5670

```



Предыдущий этап успешно нормализовал `acquisitionSource` и сохранил test/demo dataset, однако после уточнения бизнес-модели выявлена более важная архитектурная проблема:



> \*\*Storefront commerce не является Marketplace commerce TravelHub и не должен попадать в Platform operational centers или Platform Marketplace business analytics.\*\*



При этом Storefront test/demo data \*\*НЕ УДАЛЯТЬ\*\*.



Они необходимы для проверки функциональной готовности:



```text

Partner / Storefront Workspace

Orders

Requests

Bookings

CRM

Payments

Finance

Analytics

filters

pagination

drill-down

tenant isolation

```



\---



\# LANGUAGE REQUIREMENT — MANDATORY



Все создаваемые или обновляемые:



\- Implementation Report;

\- Remediation Report;

\- Strict Review Report;

\- Evidence / Runtime Report;

\- Gap Audit;

\- findings;

\- root cause analysis;

\- architecture decisions;

\- security findings;

\- runtime evidence descriptions;

\- conclusions;

\- recommendations;

\- verdict explanations



должны быть преимущественно \*\*на русском языке\*\*.



Английский разрешён только для:



\- file paths;

\- class/method/DTO/model/table names;

\- API endpoints;

\- HTTP methods/status codes;

\- CLI/Git commands;

\- SQL;

\- commit messages;

\- enums;

\- permission identifiers;

\- code snippets;

\- standardized `VERDICT`.



Если итоговый отчёт преимущественно английский:



```text

TASK INCOMPLETE

```



До исправления языка `VERDICT A` запрещён.



\---



\# 0. STARTING POINT



Перед началом:



```bash

git status

git rev-parse HEAD

git rev-parse origin/master

```



Последний известный SHA:



```text

8ce5670

```



Если фактический HEAD отличается — использовать фактический SHA и объяснить расхождение.



\---



\# 1. CANONICAL BUSINESS RULE — HARD ARCHITECTURE CONTRACT



Зафиксировать в коде, архитектурной документации и canonical roadmap:



```text

MARKETPLACE

→ операционный и коммерческий бизнес TravelHub

→ учитывается Platform Workspace





STOREFRONT COMMERCE

→ собственный бизнес Storefront-партнёра

→ НЕ является Marketplace-бизнесом TravelHub

→ используется в Partner / Storefront Workspace





STOREFRONT → TRAVELHUB

→ подписка и другие прямые платежи Storefront платформе

→ учитываются Platform Finance / Analytics

→ SaaS Revenue / direct platform revenue

```



Ключевой финансовый invariant:



```text

Storefront Commerce Volume

≠

Marketplace GMV

≠

TravelHub Revenue

```



Storefront может продать своим клиентам услуги на любую сумму.



Эта сумма:



```text

НЕ становится Marketplace GMV

НЕ становится Platform GMV

НЕ становится TravelHub Revenue

```



только потому, что Storefront использует инфраструктуру TravelHub.



\---



\# 2. PLATFORM OPERATIONAL CONTRACT



Для Platform Workspace:



```text

Platform Orders

=

Marketplace operational Orders

```



```text

Platform Requests

=

Marketplace operational Requests

```



```text

Platform Bookings

=

Marketplace operational Bookings

```



НЕ:



```text

Platform Orders

=

Marketplace + Storefront

```



НЕ:



```text

Platform Requests

=

Marketplace + Storefront

```



НЕ:



```text

Platform Bookings

=

Marketplace + Storefront

```



Это \*\*не пользовательский фильтр\*\*, а business scope Platform Workspace.



\---



\# 3. STOREFRONT DATA MUST BE PRESERVED



Предыдущая normalization создала полезный representative dataset:



```text

MARKETPLACE records

STOREFRONT records

```



Не откатывать её.



Не удалять Storefront:



```text

Orders

Requests

Bookings

Customers

Payments

Sales

Finance data

```



Не превращать Storefront records в Marketplace records.



Эти данные нужны для проверки:



```text

Storefront Partner Workspace

```



и его функциональной готовности.



\---



\# 4. DATA STORAGE ≠ WORKSPACE VISIBILITY



Зафиксировать архитектурный принцип:



```text

Shared / common persistence

&#x20;       ↓

commercial provenance

&#x20;       ↓

workspace business scope

&#x20;       ↓

tenant scope

&#x20;       ↓

permission

&#x20;       ↓

visible data

```



Физическое существование Storefront record в общей БД:



```text

≠

```



право Platform Workspace включать этот record в operational/business population.



\---



\# 5. ACQUISITION SOURCE REMAINS VALID



Не откатывать:



```text

MARKETPLACE

STOREFRONT

```



и normalization SHA:



```text

8ce5670

```



`acquisitionSource` остаётся полезной provenance dimension.



Но:



```text

acquisitionSource

≠ universal UI applicability

```



Правильно:



```text

acquisitionSource

= откуда возникла commercial activity



Workspace/Center scope

= кому эта activity принадлежит с точки зрения business visibility

```



\---



\# 6. PLATFORM ORDERS CENTER — MARKETPLACE ONLY



Проверить Platform Orders Center полностью:



```text

UI

API

service

repository/query

pagination

filters

sorting

totals

aggregates

drill-down

detail access

```



Storefront Orders:



```text

MUST NOT appear

MUST NOT affect totals

MUST NOT affect pagination

MUST NOT affect aggregate summary

MUST NOT be returned through Platform Orders operational scope

MUST NOT be accessible through Platform Order detail endpoint

```



если endpoint относится именно к Platform operational context.



Expected:



```text

Platform Orders population

=

MARKETPLACE Orders

```



\---



\# 7. PLATFORM REQUESTS — MARKETPLACE ONLY



Проверить фактический domain object, соответствующий:



```text

Заявки / Requests

```



Не предполагать имя entity/table.



Если capability существует:



```text

Platform Requests

→ MARKETPLACE only

```



Storefront Requests:



```text

MUST NOT appear

MUST NOT affect totals

MUST NOT be retrievable through Platform operational scope

```



Если отдельного Request domain/capability сейчас нет:



```text

NOT IMPLEMENTED

```



Не создавать новую сущность только ради данного remediation.



\---



\# 8. PLATFORM BOOKING CENTER — MARKETPLACE ONLY



Проверить:



```text

Booking Center UI

Booking APIs

totals

KPI

filters

pagination

aggregate summary

detail

drill-down

```



Storefront Bookings:



```text

MUST NOT appear

MUST NOT affect totals

MUST NOT affect KPI

MUST NOT affect pagination

MUST NOT be returned through Platform Booking operational scope

```



Expected:



```text

Platform Bookings population

=

MARKETPLACE Bookings

```



\---



\# 9. BACKEND AUTHORITY — HARD REQUIREMENT



Недостаточно:



```text

hide Storefront in frontend

```



или:



```text

remove selector

```



Backend должен server-side обеспечивать Platform business scope.



Conceptually:



```text

PLATFORM workspace

\+

Orders/Requests/Bookings operational context

&#x20;       ↓

MARKETPLACE scope enforced

```



Прямой API request Platform user не должен позволять получить Storefront operational records.



Если:



```text

?acquisitionSource=STOREFRONT

```



или аналогичная манипуляция позволяет Platform endpoint вернуть Storefront Orders/Bookings:



```text

VERDICT B

```



\---



\# 10. SALES CHANNEL SELECTOR — CORRECT APPLICABILITY



Ранее был добавлен shared selector:



```text

ALL

MARKETPLACE

STOREFRONT

```



Он не должен механически использоваться во всех Platform Centers.



Для:



```text

Platform Orders

Platform Requests

Platform Bookings

```



Storefront не является selectable Platform operational scope.



Следовательно:



```text

ALL / MARKETPLACE / STOREFRONT

```



на этих страницах убрать.



Не заменять это cosmetic default:



```text

Marketplace selected by default

```



при возможности переключиться на Storefront.



Business scope должен быть fixed.



\---



\# 11. PLATFORM MARKETPLACE ANALYTICS



Провести аудит Platform Analytics.



Marketplace business metrics должны учитывать только Marketplace commerce.



Например:



```text

Marketplace GMV

Marketplace Orders

Marketplace Requests

Marketplace Bookings

Marketplace Customers

Marketplace customer payments

Marketplace Commission

Marketplace Refunds

Marketplace Conversion

Marketplace Funnel

```



Storefront commerce не должна увеличивать эти metrics.



\---



\# 12. STOREFRONT COMMERCE IS NOT PLATFORM GMV



Пример обязательной semantics:



```text

Marketplace customers purchased:

100,000 AZN



Storefront customers purchased:

70,000 AZN

```



Platform Marketplace GMV:



```text

100,000 AZN

```



НЕ:



```text

170,000 AZN

```



Storefront:



```text

70,000 AZN

```



может использоваться в:



```text

Storefront Partner Analytics

```



но не в Platform Marketplace GMV.



\---



\# 13. PLATFORM COMMAND CENTER



Проверить Platform Command Center.



Если текущие KPI используют:



```text

ALL = MARKETPLACE + STOREFRONT commerce

```



исправить applicability.



Marketplace operational/commercial metrics:



```text

→ MARKETPLACE only

```



Storefront business sales:



```text

→ excluded

```



\---



\# 14. PLATFORM REVENUE MODEL — DO NOT MIX STREAMS



Зафиксировать conceptual separation:



```text

TravelHub Revenue

│

├── Marketplace Revenue

│   └── commission / applicable platform fees

│

└── Storefront SaaS Revenue

&#x20;   └── subscriptions / direct Storefront→TravelHub charges

```



Не реализовывать новый Finance Engine в этой задаче.



Но существующие показатели не должны трактовать:



```text

Storefront sales revenue

```



как:



```text

TravelHub revenue

```



\---



\# 15. PAYMENTS — THREE DIFFERENT BUSINESS POPULATIONS



Это критическое правило.



\## 15.1 Marketplace customer payment



```text

Marketplace customer

&#x20;       ↓

Marketplace Order

&#x20;       ↓

Payment

```



Для Platform:



```text

YES

```



Это Marketplace commerce.



\---



\## 15.2 Storefront customer payment



```text

Storefront customer

&#x20;       ↓

Storefront Order

&#x20;       ↓

Payment

```



Для Platform Marketplace analytics:



```text

NO

```



Это собственная коммерция Storefront.



Она используется в:



```text

Partner / Storefront Workspace

```



\---



\## 15.3 Storefront subscription payment to TravelHub



```text

Storefront Partner

&#x20;       ↓

Subscription

&#x20;       ↓

Payment to TravelHub

```



Для Platform:



```text

YES

```



Это:



```text

TravelHub SaaS Revenue

```



или соответствующий direct Storefront→TravelHub financial flow.



\---



\# 16. PAYMENT CONTRACT — CANONICAL ANSWER



Зафиксировать в документации так, чтобы в будущем вопрос:



> «Учитывает ли платформа платежи Marketplace и Storefront?»



не приводил к неоднозначному ответу.



Canonical answer:



```text

Marketplace customer payments

→ YES

→ Platform Marketplace finance/analytics





Storefront customer commerce payments

→ NO

→ Storefront Partner finance/analytics





Storefront subscription/direct payment to TravelHub

→ YES

→ Platform SaaS finance/analytics

```



\---



\# 17. PLATFORM PAYMENTS UI/API



Проверить существующий Payments registry.



Определить его фактическое назначение.



Если это:



```text

Platform Marketplace Payments

```



то Storefront customer commerce payments должны быть исключены.



Если registry является более широким Platform Finance registry с разными transaction types, populations должны быть явно разделены по business meaning.



Не использовать простой:



```text

MARKETPLACE / STOREFRONT

```



если это смешивает:



```text

Storefront customer payment

```



и:



```text

Storefront subscription payment to TravelHub

```



\---



\# 18. PLATFORM CRM CUSTOMER SCOPE



Storefront end-customers не являются Marketplace customers TravelHub только потому, что Storefront использует TravelHub infrastructure.



Platform Marketplace CRM/customer metrics:



```text

Marketplace customer activity only

```



Storefront customer:



```text

→ Storefront Partner CRM

```



Не удалять customer data.



Нужно правильно scope'ить visibility.



\---



\# 19. PARTNER PERFORMANCE



Platform может анализировать Storefront как:



```text

Partner

SaaS customer

subscription customer

```



Но нельзя автоматически использовать его Storefront commerce как Marketplace performance.



Разделить:



```text

Partner relationship with TravelHub

```



и:



```text

Partner own Storefront commerce

```



\---



\# 20. STOREFRONT / PARTNER WORKSPACE



Storefront test data сохраняются именно для проверки Partner Workspace.



Где capability уже существует, проверить:



```text

Storefront Orders

Storefront Requests

Storefront Bookings

Storefront CRM

Storefront Payments

Storefront Finance

Storefront Analytics

```



Storefront Partner должен видеть:



```text

own tenant data

```



\---



\# 21. TENANT ISOLATION — HARD REQUIREMENT



Storefront Partner A:



```text

→ Partner A data only

```



Storefront Partner B:



```text

→ Partner B data only

```



Проверить минимум:



```text

Partner A cannot read Partner B Orders

Partner A cannot read Partner B Bookings

Partner A cannot read Partner B Payments

Partner A cannot read Partner B Customers

```



`acquisitionSource=STOREFRONT` не является tenant isolation.



Правильно:



```text

Identity

↓

Workspace

↓

Partner/Tenant Scope

↓

Entitlement

↓

Permission

↓

Data

```



\---



\# 22. STORE DATA FOR FUNCTIONAL READINESS



Storefront test/demo data должны позволять в будущем/сейчас проверить:



```text

tables

KPI

period filters

status filters

pagination

sorting

search

aggregates

drill-down

detail pages

customer relations

payment relations

financial summaries

analytics

tenant isolation

```



Поэтому не уменьшать dataset без доказанной необходимости.



\---



\# 23. DATASET PRESERVATION EVIDENCE



Показать before/after counts:



```text

Storefront Orders

Storefront Requests

Storefront Bookings

Storefront Payments

Storefront Customers

```



Expected:



```text

Deleted = 0

Reassigned to Marketplace = 0

```



если только не обнаружена отдельная доказанная data corruption.



Любое изменение Storefront population объяснить ID-level.



\---



\# 24. REPOSITORY-WIDE APPLICABILITY AUDIT



Проверить Platform surfaces, затронутые предыдущим universal Sales Channel Scope.



Для каждого классифицировать:



```text

MARKETPLACE OPERATIONAL

MARKETPLACE ANALYTICS

STOREFRONT SaaS

PARTNER-OWNED STOREFRONT COMMERCE

MIXED BUT EXPLICITLY SEPARATED

NOT IMPLEMENTED

```



Не применять автоматически:



```text

ALL = MARKETPLACE + STOREFRONT

```



\---



\# 25. REQUIRED APPLICABILITY MATRIX



В итоговом отчёте обязательно предоставить:



| Surface / Metric | MARKETPLACE | STOREFRONT commerce | Storefront→TravelHub SaaS |

|---|---:|---:|---:|

| Platform Orders | ✅ | ❌ | N/A |

| Platform Requests | ✅ | ❌ | N/A |

| Platform Bookings | ✅ | ❌ | N/A |

| Platform Marketplace GMV | ✅ | ❌ | N/A |

| Platform Marketplace customer payments | ✅ | ❌ | ❌ |

| Platform Marketplace commission | ✅ | ❌ | ❌ |

| Platform CRM customers | ✅ | ❌ | N/A |

| Platform SaaS Revenue | ❌ | ❌ | ✅ |

| Storefront Partner Orders | ❌ | ✅ own tenant | N/A |

| Storefront Partner Requests | ❌ | ✅ own tenant | N/A |

| Storefront Partner Bookings | ❌ | ✅ own tenant | N/A |

| Storefront Partner customer payments | ❌ | ✅ own tenant | ❌ |

| Storefront subscription billing | ❌ | N/A | ✅ |



Если capability ещё не реализован:



```text

NOT IMPLEMENTED

```



Не создавать fake implementation только ради заполнения таблицы.



\---



\# 26. ID-LEVEL NEGATIVE EVIDENCE



Выбрать минимум:



```text

1 known STOREFRONT Order ID

1 known STOREFRONT Booking ID

1 known STOREFRONT Payment ID

```



Доказать:



```text

Platform operational scope

→ does NOT expose record

```



И где Partner capability существует:



```text

correct Storefront Partner

→ CAN access own record

```



Дополнительно:



```text

other Storefront Partner

→ CANNOT access record

```



\---



\# 27. PLATFORM TOTALS AFTER CORRECTION



После remediation Platform operational totals должны соответствовать Marketplace-only population.



Reference после normalization:



```text

Orders:

MARKETPLACE = 1085

STOREFRONT  = 431

ALL         = 1516

```



После scope correction Platform Orders Center должен показывать population:



```text

MARKETPLACE

```



а не:



```text

1516

```



Использовать фактические runtime counts, а не hardcode reference numbers.



\---



\# 28. BOOKINGS AFTER CORRECTION



Reference после normalization:



```text

Bookings:

MARKETPLACE = 405

STOREFRONT  = 287

ALL         = 692

```



Platform Booking Center должен использовать:



```text

MARKETPLACE population

```



Storefront bookings остаются в dataset для Partner Workspace.



\---



\# 29. PAYMENTS AFTER CORRECTION



Не использовать старое:



```text

ALL = Marketplace + Storefront

```



как Platform financial truth без определения типа payment.



Отчёт должен отдельно показать:



```text

Marketplace customer payments

Storefront customer commerce payments

Storefront→TravelHub subscription/direct payments

```



Если subscription payments ещё не реализованы:



```text

NOT IMPLEMENTED / NO DATASET

```



Не подменять их Storefront customer payments.



\---



\# 30. RUNTIME / BROWSER VERIFICATION



Проверить Platform internal user:



```text

Orders

Requests

Bookings

CRM

Payments

Command Center

Analytics

```



Storefront commerce records не должны попадать в Marketplace operational/business metrics.



Проверить существующий Storefront Partner Workspace:



```text

Orders

Requests

Bookings

CRM

Payments

Finance

Analytics

```



только там, где capability уже существует.



\---



\# 31. DIRECT API BYPASS TEST



Для Platform user попробовать получить известный Storefront record:



```text

direct endpoint

query parameter

filter manipulation

detail URL

```



Storefront operational data не должны становиться доступными из-за ручной передачи:



```text

acquisitionSource=STOREFRONT

```



Frontend hiding без backend denial/scope exclusion:



```text

FAIL

```



\---



\# 32. SECURITY REGRESSION



Проверить:



```text

Platform operational endpoints exclude Storefront commerce

Storefront Partner cannot escape tenant

Storefront Partner cannot read another Partner

RBAC unchanged

Workspace authority unchanged

Entitlement authority unchanged

```



\---



\# 33. AUTOMATED TESTS



Добавить/обновить targeted tests минимум:



```text

Platform Orders excludes STOREFRONT



Platform Requests excludes STOREFRONT

or capability documented as NOT IMPLEMENTED



Platform Bookings excludes STOREFRONT



Platform Marketplace GMV excludes Storefront commerce



Platform Marketplace customer payment metrics exclude Storefront commerce payments



Storefront dataset remains present



Storefront Partner can read own data where capability exists



Storefront Partner cannot read another tenant data



Direct API request cannot bypass Platform operational scope



MARKETPLACE acquisitionSource remains valid



STOREFRONT acquisitionSource remains valid

```



\---



\# 34. REQUIRED TEST RUNS



Запустить минимум:



```text

Frontend typecheck

Frontend tests

Frontend build



Backend typecheck

Backend tests

Backend build



Relevant E2E

Relevant API integration tests

```



Source inspection без runtime/API verification недостаточен.



\---



\# 35. CANONICAL DOCUMENTATION UPDATE — MANDATORY



Обновить архитектурную документацию и canonical roadmap \*\*additively\*\*.



Canonical roadmap:



```text

docs/prompts/TravelHub\_CANONICAL\_IMPLEMENTATION\_ROADMAP\_v3.md

```



Если фактический canonical path отличается — использовать существующий authoritative file и указать путь.



Обязательно зафиксировать:



```text

Storefront Commerce Volume

≠ Marketplace GMV

≠ TravelHub Revenue

```



\---



Также:



```text

Platform Orders / Requests / Bookings

=

Marketplace operational scope only

```



\---



Также:



```text

Storefront commerce test/demo data

is preserved for Partner / Storefront Workspace

functional verification.

```



\---



Также:



```text

Platform considers Storefront financially

only for direct Storefront→TravelHub economic relationships,

primarily subscription / SaaS charges.

```



\---



Также зафиксировать canonical payment answer:



```text

Marketplace customer payment

→ Platform YES



Storefront customer commerce payment

→ Platform Marketplace NO



Storefront subscription/direct payment to TravelHub

→ Platform YES

```



\---



\# 36. PRESERVE ROADMAP HISTORY



Не удалять и не переписывать историю предыдущего:



```text

Shared Sales Channel Scope

```



Вместо этого добавить архитектурное уточнение:



```text

Sales Channel Scope Applicability Correction

```



с объяснением:



> `acquisitionSource` остаётся canonical provenance dimension, но applicability определяется Workspace и business Center. Storefront commerce не является частью Platform Marketplace operational/business scope.



Использовать реальные commit SHA.



\---



\# 37. DO NOT IMPLEMENT NEW SaaS FINANCE ENGINE



Если subscription billing ещё не реализован:



```text

document semantics

```



но не создавать сейчас:



```text

MRR engine

ARR engine

subscription ledger

new billing engine

new Finance Center

```



Это отдельные будущие этапы.



\---



\# 38. DO NOT CHANGE CURRENCY PRESENTATION



Не исправлять здесь:



```text

AZN vs ₼

USD vs $

EUR vs €

```



Это отдельный следующий remediation:



```text

GLOBAL CURRENCY PRESENTATION CONTRACT

```



\---



\# 39. OUT OF SCOPE — HARD STOP



Не выполнять:



```text

Currency Presentation remediation

FX architecture

Treasury

Partner Settlement

new Finance Center

Booking KPI Semantics

public marketplace redesign

full Partner Analytics redesign

Step 3.12

unrelated refactoring

```



\---



\# 40. HARD ACCEPTANCE GATES



`VERDICT A` разрешён только если:



```text

A. Canonical business rule зафиксирован в documentation/roadmap



B. Storefront test/demo records сохранены



C. Platform Orders server-side исключает Storefront



D. Platform Requests server-side исключает Storefront

&#x20;  либо capability честно доказан как NOT IMPLEMENTED



E. Platform Bookings server-side исключает Storefront



F. Platform Marketplace GMV исключает Storefront commerce



G. Platform Marketplace customer-payment metrics исключают Storefront commerce payments



H. Storefront commerce volume не трактуется как TravelHub Revenue



I. Storefront customer commerce payment отделён от Storefront→TravelHub subscription/direct payment



J. Platform CRM Marketplace customer semantics исключает Storefront end-customers



K. Partner Performance не смешивает Storefront own commerce с Marketplace metrics



L. Storefront Partner data сохранены для соответствующего Partner Workspace



M. Tenant isolation доказан



N. Direct Platform API bypass невозможен



O. acquisitionSource normalization не откатили



P. Storefront records не были массово удалены или reassigned



Q. Runtime/browser evidence предоставлен



R. ID-level negative evidence предоставлен



S. Tests/typecheck/build/E2E PASS



T. Documentation/roadmap update выполнен additively



U. Реальные SHA указаны



V. Следующий этап не начат автоматически

```



Любой обязательный недоказанный gate:



```text

VERDICT B

```



Наличие правильного source code без runtime/API evidence недостаточно.



\---



\# 41. FINAL REPORT FORMAT



Итоговый отчёт преимущественно на русском:



```text

\# PLATFORM vs STOREFRONT OPERATIONAL DATA SCOPE \& WORKSPACE ISOLATION



Starting SHA:

Implementation SHA:

Final HEAD:

origin/master:

HEAD == origin:



\## 1. Canonical Business Rule



Marketplace:

Storefront commerce:

Storefront→TravelHub SaaS:



\## 2. Root Cause



Почему universal ALL/MARKETPLACE/STOREFRONT

оказался неверно применён:



\## 3. Applicability Matrix



...



\## 4. Platform Orders



Backend scope:

Frontend:

Before:

After:

Storefront excluded:



\## 5. Platform Requests



Capability:

Scope:

Evidence:



\## 6. Platform Bookings



Backend scope:

Frontend:

Before:

After:

Storefront excluded:



\## 7. Platform Analytics



Marketplace GMV:

Orders:

Bookings:

Customers:

Payments:

Storefront commerce excluded:



\## 8. Command Center



...



\## 9. Payments Semantics



Marketplace customer payments:

Storefront customer commerce payments:

Storefront→TravelHub subscription payments:



\## 10. CRM



Marketplace customers:

Storefront customers:

Scope evidence:



\## 11. Partner Performance



...



\## 12. Storefront Dataset Preservation



Orders:

Requests:

Bookings:

Payments:

Customers:



Deleted:

Reassigned:



\## 13. Partner Workspace



Available capabilities:

Storefront data:

Tenant scope:



\## 14. Tenant Isolation



Partner A:

Partner B:

Cross-tenant attempts:



\## 15. ID-level Negative Evidence



Storefront Order:

Platform result:

Correct Partner result:



Storefront Booking:

Platform result:

Correct Partner result:



Storefront Payment:

Platform result:

Correct Partner result:



\## 16. Runtime / API Evidence



...



\## 17. Tests



Frontend typecheck:

Frontend tests:

Frontend build:



Backend typecheck:

Backend tests:

Backend build:



E2E:

API integration:



\## 18. Documentation / Roadmap Update



Files:

Canonical rules added:

Previous history preserved:



\## 19. Residual Gaps



...



\## VERDICT



VERDICT A / VERDICT B

```



\---



\# 42. GIT / COMPLETION



После implementation:



```bash

git status

git rev-parse HEAD

git rev-parse origin/master

```



Указать реальные:



```text

Starting SHA:

Implementation SHA:

Final HEAD:

origin/master:

HEAD == origin:

```



Не начинать следующий этап автоматически.



\*\*STOP после отчёта.\*\*



Следующий этап запускать только после отдельного решения пользователя.

