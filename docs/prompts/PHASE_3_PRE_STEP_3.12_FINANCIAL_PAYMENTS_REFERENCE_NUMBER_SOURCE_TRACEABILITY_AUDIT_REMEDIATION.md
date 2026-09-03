# PHASE 3 — PRE-STEP 3.12 — FINANCIAL PAYMENTS BUSINESS REFERENCE & SOURCE TRACEABILITY — AUDIT / REMEDIATION

## LANGUAGE REQUIREMENT — MANDATORY

Все отчёты, evidence, findings, root cause analysis, архитектурные решения, выводы и verdict explanations — преимущественно **на русском языке**. Английский допустим для технических identifiers, paths, API, enums, code, commands и standardized VERDICT strings.

Преимущественно английский отчёт = задача незавершена. Не включать plaintext secrets/passwords/tokens.

## START

Перед работой зафиксировать фактический `Starting SHA = git rev-parse HEAD`. Не использовать старый SHA автоматически. Следующий roadmap stage не начинать.

## RUNTIME FINDING

Проблема обнаружена по официальному drill-down:

```text
Аналитика → Финансовая сводка → Успешные платежи → Payments registry
```

Контрольный URL содержал `from=2026-08-30&to=2026-09-02&preset=LAST_3_DAYS&status=CAPTURED&currency=AZN&fromAnalytics=true`.

Runtime: 7 записей, AZN, `CAPTURED/Зачислен`, но UI показывает примерно:

```text
Платёж         Заказ
PAY-00000939   12d8bf07…
PAY-00000315   6a1de7b8…
```

## CANONICAL CONTRACT TO VERIFY

Ожидаемый Reference Number Contract:

```text
Marketplace: MKT-ORD-* / MKT-REQ-* / MKT-BKG-* / MKT-PAY-*
Storefront commerce: SF001-ORD-* / SF001-BKG-* / SF001-PAY-*
Storefront SaaS billing: SAAS-SF001-*
```

UUID — internal relation key, но не основной user-facing business identifier при наличии `referenceNumber`. Prefix/referenceNumber ≠ authorization.

## GOAL

Доказать и исправить:

1. Почему Marketplace Payment отображается `PAY-*` вместо `MKT-PAY-*`.
2. Почему колонка `Заказ` показывает truncated UUID вместо `Order.referenceNumber` (`MKT-ORD-*`).
3. Что Analytics drill-down открывает ровно authoritative source population KPI.

## NO BLIND PREFIX PATCH

Запрещено просто делать `MKT-${referenceNumber}`.

Для контрольных rows проследить:

```text
DB Payment.referenceNumber / acquisitionSource / orderId
→ DB Order.id / referenceNumber / acquisitionSource
→ API DTO/serializer
→ frontend mapping
→ rendered UI
```

Определить доказанный root cause: DB legacy value, API serializer, wrong UI field, presentation transform или иное.

## PRIMARY-DATA EVIDENCE

Для всех контрольных payments получить:

`Payment.id`, `referenceNumber`, `status`, `currency`, `amount`, `paidAt`, `createdAt`, `acquisitionSource`, `orderId`, а также `Order.id`, `Order.referenceNumber`, `Order.sellerPartnerId`, `Order.acquisitionSource`.

Матрица:

| Payment.id | DB pay ref | API pay ref | UI pay ref | source | Order.id | DB order ref | API order ref | UI order |
|---|---|---|---|---|---|---|---|---|

## MARKETPLACE SCOPE

Доказать server-side Marketplace population через authoritative data/relations, а не prefix. Проверить Financial Summary predicates, Payments endpoint, `fromAnalytics=true`, period, `CAPTURED`, currency и acquisitionSource.

## REQUIRED PRESENTATION

Если relation существует:

```text
Платёж              Заказ
MKT-PAY-00000939     MKT-ORD-00xxxx
```

`Заказ` должен показывать `Order.referenceNumber`, а не UUID. Получать reference через фактическую `Payment.orderId → Order.id` relation, не угадывать sequence.

Если существующий authoritative Order detail route есть — business reference желательно clickable. Fake route не создавать.

Если DB содержит legacy `PAY-*`, определить происхождение, migration history, uniqueness/compatibility consequences. Не выполнять destructive bulk rewrite без evidence.

## ANALYTICS SOURCE INVARIANT

При одинаковых period/currency/status/Marketplace scope:

```text
Financial Summary Successful Payments
= Payments registry filtered total
= CSV data rows
= XLSX data rows
= authoritative source population
```

Для текущего evidence ожидаемый count был 7. Если dataset изменился — использовать текущий count и доказать изменение.

## DATE / STATUS

Доказать фактическое date field. Для successful payments ожидаемо `paidAt ∈ [from,to)`, но не предполагать.

Доказать exact mapping `Successful Payments → CAPTURED` и UI label. Не допустить Analytics по `paidAt`, а registry по `createdAt`.

## EXPORT

На Payments page должна реально присутствовать видимая `Экспорт → CSV/XLSX`, не только component в source.

Проверить:

```text
UI total = CSV rows = XLSX rows
```

Export должен содержать canonical Payment/Order business references плюс reconciliation fields в рамках permissions. Не делать export-only formatter, расходящийся с UI/API contract.

## REGRESSION SCOPE

Поскольку Reference Number Contract ранее считался закрытым, spot-check:

```text
Orders registry   → MKT-ORD-*
Bookings registry → MKT-BKG-*
Payments registry → MKT-PAY-*
```

и related business references.

Если finding системный — исправить shared presentation contract, а не локально Payments.

Storefront spot-check при наличии данных: `SFxxx-ORD-*`, `SFxxx-BKG-*`, `SFxxx-PAY-*`. Не смешивать Marketplace/Storefront.

## SECURITY

Сохранить authentication, workspace/tenant/role/permission/partner isolation. Reference prefix не использовать для authorization. Проверить cross-tenant leakage.

## I18N

RU/AZ/EN: labels, statuses, export/errors. No raw i18n keys. Reference numbers не локализуются.

## TESTS

Backend минимум:
- canonical payment ref;
- related Order ref from actual relation;
- Marketplace/CAPTURED/currency/period filters;
- `[from,to)`;
- no cross-tenant leakage.

Frontend минимум:
- Payment canonical ref rendered;
- Order `referenceNumber`, not UUID;
- drill-down filters preserved;
- CSV/XLSX;
- RU/AZ/EN.

### TEST REPORTING — TRUTHFULNESS

Если `282/283`, писать:

```text
Frontend Tests: FAIL — 282/283
1 failing test: ...
classification: pre-existing / introduced
```

Pre-existing не превращает FAIL в PASS.

## RUNTIME MATRIX

1. Analytics → Financial Summary → Successful Payments: period/currency/count.
2. Click → Payments: URL filters, total, status, currency, dates, no 404/filter loss.
3. Несколько rows: `UI payment ref = canonical DB/API Payment.referenceNumber`; `UI order ref = canonical DB/API Order.referenceNumber`.
4. Export: `UI total = CSV rows = XLSX rows`.
5. Если refs clickable: client click/direct URL/refresh → exact entity, no 404.

## REQUIRED REPORT

Создать:

`docs/reports/PHASE_3_PRE_STEP_3.12_FINANCIAL_PAYMENTS_REFERENCE_NUMBER_SOURCE_TRACEABILITY_REPORT.md`

Включить Starting/Implementation/Final SHA, `HEAD == origin/master`, F1/F2 root causes, DB→API→UI matrix, scope/date/status/currency predicates, KPI↔registry↔CSV↔XLSX reconciliation, relation evidence, regression spot-check, security, RU/AZ/EN, truthful tests, remaining findings, verdict.

## ROADMAP

Если canonical shared reference/source-traceability contract уточняется — additively обновить `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`. Историю не удалять, silent renumber не делать, реальные SHA. Не объявлять весь PRE-STEP закрытым и не начинать следующий stage.

## ACCEPTANCE

`VERDICT A` только если:

```text
[ ] F1 root cause proven
[ ] F2 root cause proven
[ ] DB→API→UI trace complete
[ ] no blind prefix concatenation
[ ] Marketplace Payment shows canonical MKT-PAY-* when contract requires it
[ ] related Order shows canonical MKT-ORD-* when available
[ ] actual Payment→Order relation used
[ ] Analytics filters preserved
[ ] KPI = Payments total = CSV rows = XLSX rows
[ ] period/status/currency semantics reconciled
[ ] Marketplace scope server-authoritative
[ ] security/cross-tenant verified
[ ] Orders/Bookings/Payments refs spot-checked
[ ] RU/AZ/EN verified
[ ] tests truthfully reported
[ ] report predominantly Russian
[ ] real Git SHA
[ ] HEAD == origin/master
```

DB/API/UI root cause not proven, blind `MKT-` prefix, UUID remains instead of available Order reference, or KPI/source mismatch → `VERDICT B`.

## NON-GOALS

Не менять Partner Performance attribution `10↔25`, Booking KPI semantics, GMV/Commission model, не создавать fake Finance/Order pages, не начинать Step 3.12.

## EXECUTION ORDER

```text
1. Record actual SHA
2. Reproduce Analytics drill-down
3. Capture KPI/filter context
4. Inspect DB Payment + Order
5. Inspect API
6. Inspect UI mapping
7. Prove root causes
8. Fix authoritative layer(s)
9. Verify business references
10. Reconcile KPI = registry = CSV = XLSX
11. Regression spot-check
12. Security + RU/AZ/EN
13. Tests + browser runtime
14. Report/roadmap
15. Git sync
16. Verdict
```

## CORE PRINCIPLE

```text
Analytics KPI → Source Registry → Primary Record
→ Canonical Business Reference → Related Business Reference
→ Export / Drill-down

Все слои должны описывать одну authoritative population и реальные relations.
```
