# PHASE 3 — PRE-STEP 3.12 — REQUEST CENTER — FINAL EVIDENCE CLOSURE

## Цель

Закрыть **только недостающие доказательства** после реализации `REQUEST CENTER UI/UX + SEARCH + ENTITY DISPLAY + DETAIL PAGE + TABLE LAYOUT + PLATFORM SIDEBAR IA`.

Текущую реализацию **не переделывать без выявленного дефекта**. Предыдущий отчёт уже заявляет readable `/app/requests`, human-readable сущности, расширенный search, dedicated `/app/requests/{id}`, `Дата подтверждения`, horizontal scroll и sidebar grouping, но `VERDICT A` был преждевременным из-за отсутствующих tests/runtime/export/security/git evidence.

## LANGUAGE REQUIREMENT — MANDATORY

Все отчёты и prose-документация должны быть преимущественно **на русском языке**: findings, root cause analysis, security findings, runtime evidence, conclusions и verdict explanations.

Английский разрешён только для technical identifiers: paths, class/method/DTO/model/table names, endpoints, HTTP methods/status codes, CLI/Git commands, commit messages, enums, permissions, code snippets и стандартизированных `VERDICT` strings.

Если итоговый отчёт преимущественно английский — задача незавершена. Никаких plaintext passwords/secrets/tokens; использовать redaction/placeholders.

## 1. STARTING STATE

До изменений зафиксировать:

```text
git status
git branch --show-current
git rev-parse HEAD
git rev-parse origin/master
```

Указать реальный Starting SHA. Не использовать `<pending>` в финальном отчёте.

## 2. SCOPE FREEZE

Не выполнять новый redesign Request Center и не менять без доказанного дефекта Shared Commerce Sequence, Request lifecycle, SLA/TTL semantics, canonical references, sidebar IA, Request Detail IA, entity-display contract, Platform/Storefront scope, seed architecture или Product Freshness.

Если evidence обнаруживает реальный regression — исправить минимально и описать root cause.

## 3. TARGETED BACKEND SEARCH TESTS — HARD GATE

Предыдущий отчёт прямо признал отсутствие backend search tests. Добавить targeted integration/e2e tests минимум для:

```text
Request reference
customer display name
CRM-* customer code
service/product title
supplier/partner display name
PRN-* partner code
```

Дополнительно проверить partial textual match для names/titles, case-insensitive semantics если они заявлены API, pagination после search, search + существующие filters, zero-result search и scope/permission isolation.

Не ограничиваться unit mocks Prisma, если они не доказывают реальный query contract.

## 4. FRONTEND TARGETED TESTS — HARD GATE

Добавить/обновить tests минимум для:

```text
MKT-REQ-* rendered as actionable reference
click → /app/requests/{id}
dedicated detail page
no primary right drawer/modal flow
human-readable customer
human-readable service
human-readable supplier
confirmation-date column
sidebar "Заявки"
active sidebar state on /app/requests/{id}
```

Не ослаблять существующие assertions ради PASS.

## 5. AUTHENTICATED SEARCH RUNTIME — 6 ОБЯЗАТЕЛЬНЫХ СЦЕНАРИЕВ

Для каждого записать exact query, UI filtered total, representative returned Request reference(s), почему результат доказывает dimension, PASS/FAIL.

Обязательные сценарии:

1. `MKT-REQ-*` — Request reference.
2. Реальное customer name.
3. Реальный `CRM-*`.
4. Реальный service/product title.
5. Реальный supplier name, например `Baku Tours Pro`.
6. Реальный `PRN-*`.

Все 6 должны быть PASS. Наличие backend-кода не является runtime evidence.

## 6. SEARCH RESULT INTEGRITY

Для representative results проверить соответствие query через `Клиент / Услуга / Поставщик / Request reference`. Нельзя считать поиск корректным только по изменившемуся total. Проверить pagination хотя бы на одном multi-page search result.

## 7. REQUEST DETAIL ROUTING — HARD RUNTIME GATE

На реальной заявке доказать три сценария:

```text
A. click MKT-REQ-* from registry → dedicated Request Detail
B. direct URL /app/requests/{id-or-route-key} → Request Detail
C. browser refresh on Request Detail → same Request Detail
```

Во всех случаях canonical Request reference совпадает, нет primary right drawer/modal, sidebar корректен и `Заявки` active.

## 8. REQUEST DETAIL DATA EVIDENCE

На representative converted Request проверить:

```text
Request reference
status
customer name + CRM-*
service title/code
supplier name + PRN-*
display price/currency
confirmed price/currency
supplier SLA deadline
supplier response timestamp
customer TTL deadline where applicable
customer accepted timestamp where applicable
related Order
related Booking where applicable
related Payment(s) where applicable
```

Связи должны исходить из backend FK/relationships, а не вычисляться из reference strings.

## 9. CONFIRMATION DATE SEMANTICS

Доказать, что `Дата подтверждения` использует canonical supplier response/confirmation timestamp (`supplierRespondedAt` или фактический domain equivalent), а не `updatedAt`.

Проверить:

1. confirmed/responded Request → дата есть;
2. Request без supplier response → `—`;
3. price-change response → timestamp соответствует supplier response semantics.

Если representative runtime record отсутствует, покрыть targeted fixture/test и явно это указать.

## 10. HORIZONTAL SCROLL RUNTIME

Доказать фактическое поведение:

```text
table container → horizontal scroll
page body → no unintended horizontal overflow
sidebar → stable
header/KPI/filter/export → remain within viewport
```

Наличие `overflow-x-auto` в source само по себе не является runtime evidence.

## 11. CSV EXPORT — REAL DOWNLOAD

1. Задать search/filter.
2. Зафиксировать filtered total.
3. Скачать реальный CSV.
4. Parse файл.
5. Посчитать data rows.
6. Проверить headers.
7. Проверить representative values.

Минимально проверить Request reference, human-readable Customer/Service/Supplier, Displayed price, Confirmed price, Confirmation date и Status. Truncated UUID не должен быть primary exported identity.

## 12. XLSX EXPORT — REAL DOWNLOAD

Повторить для XLSX: filtered total, data rows, headers, representative values.

Hard reconciliation при canonical full-filtered export:

```text
Filtered population = CSV data rows = XLSX data rows
```

Если canonical export contract иной — доказать его из проекта.

## 13. SECURITY / SCOPE — HARD GATE

Показать evidence для:

- unauthorized request → denied;
- insufficient permission → denied;
- direct detail URL cannot bypass scope;
- search cannot return out-of-scope entities;
- human-readable related-entity projection respects scope;
- frontend hiding is not security enforcement.

Если shared Request service используется Partner Workspace, проверить tenant isolation соответствующего path. `acquisitionSource` не использовать как единственную authorization boundary.

## 14. REGRESSION BASELINE — ДОКАЗАТЬ, А НЕ НАЗВАТЬ PRE-EXISTING

Предыдущий отчёт показывал Backend `1395/1420`, Frontend `282/283`. Для каждого remaining failure зафиксировать:

```text
suite/test
Starting SHA status
Final SHA status
introduced by this remediation? YES/NO
```

Если failure идентично существовал на Starting SHA, это может быть documented baseline residual. Новый failure после remediation запрещает `VERDICT A`.

Дать точную арифметику totals/pass/fail/skip.

## 15. BUILD / TYPECHECK / TARGETED TEST MATRIX

Отчёт должен содержать:

```text
Backend typecheck
Backend build
Backend targeted Request tests
Backend relevant integration/e2e
Backend full suite
Frontend typecheck
Frontend build
Frontend targeted Request tests
Frontend full suite
```

Для каждого: command, PASS/FAIL, test count, failure count.

## 16. SIDEBAR FINAL RUNTIME CHECK

Проверить фактически:

```text
Рабочий стол
Центр управления
Аналитика

ОПЕРАЦИИ
  Заявки
  Заказы
  Бронирования

КОММЕРЧЕСКОЕ УПРАВЛЕНИЕ
  Каталог
  CRM
  Маркетинг

ПАРТНЁРСКАЯ СЕТЬ
  Партнёры
  Продавцы

СЕРВИС
  Поддержка

АДМИНИСТРИРОВАНИЕ
  Пользователи
```

Проверить active state на `/app/requests` и `/app/requests/{id}`. Не добавлять несуществующий Finance Center.

## 17. FINAL GIT CLOSURE

После всех исправлений/evidence:

```text
git status
git rev-parse HEAD
git rev-parse origin/master
```

Если workflow требует push — выполнить его. Report обязан содержать реальные Starting SHA, Implementation/Closure SHA, Final SHA, origin/master. Никаких `<pending>`, `TBD`, `unknown`.

## 18. ROADMAP

Обновить `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md` только additive способом. Не стирать историю premature `VERDICT A`; зафиксировать Final Evidence Closure и итоговую re-qualification с реальными SHA.

## 19. FINAL REPORT — MANDATORY STRUCTURE

Создать отдельный Markdown report преимущественно на русском:

```text
# REQUEST CENTER — FINAL EVIDENCE CLOSURE — REPORT

Starting SHA
Final SHA
origin/master
Previous Residual Gaps
Closure Matrix
Targeted Backend Tests
Targeted Frontend Tests
Authenticated Search Runtime
  S1 Request Reference
  S2 Customer Name
  S3 CRM Code
  S4 Service Title
  S5 Supplier Name
  S6 PRN Code
Request Detail Routing
Request Detail Data
Confirmation Date Semantics
Horizontal Scroll Runtime
CSV Evidence
XLSX Evidence
Export Reconciliation
Security / Scope Evidence
Regression Baseline Comparison
Full Test Matrix
Sidebar Runtime
Residual Gaps
Roadmap Update
Final Verdict
```

## 20. ACCEPTANCE MATRIX

`VERDICT A` разрешён только если:

```text
[ ] Backend search by Request reference test PASS
[ ] Backend search by customer name test PASS
[ ] Backend search by CRM-* test PASS
[ ] Backend search by service title test PASS
[ ] Backend search by supplier name test PASS
[ ] Backend search by PRN-* test PASS
[ ] Frontend Request navigation targeted tests PASS
[ ] Human-readable entity targeted tests PASS
[ ] Confirmation-date targeted tests PASS
[ ] Runtime S1 Request reference PASS
[ ] Runtime S2 customer name PASS
[ ] Runtime S3 CRM-* PASS
[ ] Runtime S4 service title PASS
[ ] Runtime S5 supplier name PASS
[ ] Runtime S6 PRN-* PASS
[ ] Registry click → full detail PASS
[ ] Direct detail URL PASS
[ ] Detail browser refresh PASS
[ ] No right drawer/modal primary detail PASS
[ ] Request Detail representative data PASS
[ ] Confirmation timestamp semantics PASS
[ ] Horizontal table scroll runtime PASS
[ ] No whole-page horizontal overflow PASS
[ ] Real CSV download PASS
[ ] Real XLSX download PASS
[ ] Filtered total = CSV rows = XLSX rows PASS
[ ] Unauthorized detail denied PASS
[ ] Permission/scope enforcement PASS
[ ] Search scope isolation PASS
[ ] Starting-vs-Final regression baseline documented
[ ] No new regression introduced
[ ] Sidebar runtime PASS
[ ] Active state list/detail PASS
[ ] Real Final SHA recorded
[ ] Real origin/master recorded
[ ] Roadmap additive update PASS
[ ] Report predominantly Russian PASS
```

Любой недоказанный hard item → `VERDICT B`.

## 21. FINAL VERDICT

Допустимы только:

```text
VERDICT A — REQUEST CENTER — FINAL EVIDENCE CLOSURE — COMPLETED
```

или:

```text
VERDICT B — REQUEST CENTER — FINAL EVIDENCE CLOSURE — INCOMPLETE
```

При `VERDICT B` перечислить конкретные незакрытые hard gates.

## 22. STOP RULE

После targeted tests, authenticated runtime, export reconciliation, security/scope evidence, regression baseline comparison, git closure, report, roadmap update и final verdict — **STOP**.

Не начинать автоматически Product Freshness, Partner Performance Attribution, Booking KPI Semantics, Finance Center, PRE-STEP 3.12 overall final requalification, STEP 3.12 или другие roadmap stages.

---

# END-TO-END TEMPORAL VISIBILITY & AUDIT TRAIL — HARD CONTRACT

Request Center должен показывать полную применимую временную цепочку объекта от создания до конечного состояния. Технический `updatedAt` запрещено использовать вместо timestamp бизнес-события.

## Canonical timeline

Для representative Request получить из реальной domain model и отображать, где применимо:

```text
Request.createdAt
→ supplier SLA deadline
→ supplierRespondedAt / supplier confirmation timestamp
→ customer TTL deadline
→ customerAcceptedAt
→ Request conversion timestamp
→ Order.createdAt
→ Booking.createdAt
→ Payment.createdAt
→ paidAt
→ serviceDate
→ completedAt
→ cancelledAt / rejectedAt / timeoutAt / refundedAt
```

Не придумывать отсутствующие timestamps. Для ещё не наступившего или неприменимого события показывать `—`.

## Request Detail — full temporal history

На `/app/requests/{id}` должна быть доступна понятная полная chronology, например:

```text
Заявка создана                 <timestamp>
SLA поставщика до              <timestamp>
Ответ поставщика               <timestamp | —>
Клиент должен ответить до      <timestamp | —>
Клиент подтвердил              <timestamp | —>
Конвертирована в заказ         <timestamp | —>
Заказ создан                   <timestamp | —>
Бронирование создано           <timestamp | —>
Оплата инициирована            <timestamp | —>
Оплачено                       <timestamp | —>
Дата услуги                    <timestamp | —>
Завершено                      <timestamp | —>
Отменено/отклонено/timeout     <timestamp | —>
Возврат                        <timestamp | —>
```

## «КОНВЕРТИРОВАНО В» — дата обязательна

Блок вида:

```text
КОНВЕРТИРОВАНО В
Заказ                 MKT-ORD-000622
Статус заказа         CLOSED
Сумма                 130 AZN
```

неполон. Требуется:

```text
КОНВЕРТИРОВАНО В
Заказ                 MKT-ORD-000622
Дата конвертации      <canonical timestamp>
Статус заказа         CLOSED
Сумма                 130 AZN
```

Сначала проверить domain model. Canonical source:

```text
1. explicit Request.convertedAt / conversion event timestamp — если существует;
2. иначе Order.createdAt — если создание Order является canonical моментом Request → Order.
```

Запрещено использовать `Request.updatedAt`, `Order.updatedAt`, frontend-generated timestamp или выводить дату из reference number. В отчёте явно зафиксировать выбранный canonical source.

## Temporal chronology invariants

Для successful converted chain проверить применимую chronology. Не навязывать неверный порядок там, где domain contract допускает иной workflow. Каждую anomaly классифицировать как:

```text
runtime/domain defect
seed/data defect
legitimate business ordering
missing timestamp
```

Не скрывать anomaly из evidence.

## DB → API → UI → EXPORT reconciliation

Для representative chain доказать эквивалентность момента времени:

```text
DB
= API
= Request Detail
= Registry, если поле отображается
= CSV, если поле экспортируется
= XLSX, если поле экспортируется
```

Допустимо ISO UTC в API и local/workspace timezone в UI только при эквивалентности instant.

## Registry / Detail / Export contract

Не требуется помещать все даты в registry.

```text
Registry → ключевые operational timestamps
Detail → полная применимая chronology
CSV/XLSX operational report → полный применимый temporal dataset
```

В Request registry сохранить минимум:

```text
Создана
SLA дедлайн
Дата подтверждения
Дата услуги
```

## CSV/XLSX temporal completeness

Проверить наличие/семантику применимых полей:

```text
Request createdAt
supplier SLA deadline
supplier response/confirmation
customer TTL deadline
customer acceptedAt
conversion date
Order createdAt
Booking createdAt
Payment createdAt / paidAt
serviceDate
completed/cancelled/rejected/timeout/refunded timestamp
```

Если текущий export — только compact registry export, доказать, где находится полный temporal report. Если полного temporal export нет — это blocker.

## Targeted temporal tests

Добавить минимум:

```text
converted Request exposes conversion timestamp
canonical conversion source is used
updatedAt is not conversion timestamp
supplierRespondedAt drives confirmation date
unresponded Request shows —
converted chain exposes related timestamps
completed chain exposes completion timestamp
terminal non-converted path exposes applicable terminal timestamp
scope/security preserved for temporal DTO fields
CSV temporal fields
XLSX temporal fields
DB/API/export timestamp equivalence
```

## Authenticated temporal runtime

Проверить три representative сценария:

```text
T1 Converted
T2 Pending / not converted
T3 Terminal exceptional: REJECTED / UNAVAILABLE / SUPPLIER_TIMEOUT /
   CUSTOMER_TIMEOUT / CANCELLED
```

Для T1 показать всю доступную цепочку. Для T2 непроизошедшие события не должны получать fabricated timestamps. Для T3 показать реальный terminal timestamp, если он хранится domain model.

## Project-wide Temporal Visibility & Auditability Contract

Additive зафиксировать в canonical roadmap:

```text
Every business object must expose its applicable lifecycle timestamps
from creation through terminal state.

Technical updatedAt must not substitute for business-event timestamps.
```

Дальнейшая область применения:

```text
Requests
Orders
Bookings
Payments
Refunds
CRM-related lifecycle where applicable
other operational registries/reports
```

В этом prompt полная реализация обязательна для Request Center; остальные модули массово не переделывать.

## TEMPORAL ACCEPTANCE MATRIX — HARD GATE

`VERDICT A` дополнительно запрещён, пока не выполнено:

```text
[ ] Full Request temporal timeline implemented/verified
[ ] Request.createdAt visible
[ ] Supplier SLA deadline visible
[ ] Supplier response/confirmation timestamp visible where applicable
[ ] Customer TTL deadline visible where applicable
[ ] customerAcceptedAt visible where applicable
[ ] Conversion date visible for converted Request
[ ] Canonical conversion timestamp source documented
[ ] updatedAt NOT used as conversion date
[ ] Order.createdAt visible for converted Request
[ ] Booking.createdAt visible where applicable
[ ] Payment.createdAt visible where applicable
[ ] paidAt visible where applicable
[ ] serviceDate visible where applicable
[ ] completedAt visible where applicable
[ ] cancellation/rejection/timeout/refund timestamps visible where applicable
[ ] Missing/non-applicable events render as —
[ ] No fabricated timestamps
[ ] Temporal chronology targeted tests PASS
[ ] DB → API → Detail reconciliation PASS
[ ] Registry reconciliation PASS where applicable
[ ] CSV temporal reconciliation PASS
[ ] XLSX temporal reconciliation PASS
[ ] Converted Request runtime timeline PASS
[ ] Pending Request runtime timeline PASS
[ ] Terminal/exception Request runtime timeline PASS
[ ] Project-wide temporal contract recorded additively in roadmap
```

Любой недоказанный temporal hard gate → `VERDICT B`.
