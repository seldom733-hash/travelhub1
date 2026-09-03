# PHASE 3 — PRE-STEP 3.12 — PROJECT-WIDE SHARED TABLE EXPORT FRAMEWORK — AUDIT & IMPLEMENTATION

## LANGUAGE REQUIREMENT — MANDATORY

Все отчёты, findings, root cause analysis, evidence, архитектурные решения, выводы и рекомендации по этой задаче должны быть преимущественно **на русском языке**.

Английский допускается только для технических идентификаторов: paths, class/method/DTO/model/table names, API endpoints, HTTP methods/status codes, CLI/Git commands, commit messages, enums, permissions, code snippets и standardized VERDICT strings.

**Hard acceptance criterion:** преимущественно английский итоговый отчёт = задача незавершена.

Не включать plaintext secrets/passwords/tokens. Использовать redaction/placeholders.

## STATUS

**Starting SHA:** `5c6aaf6`

Существующие `/orders/export`, `/bookings/export` и `ExportService` необходимо эволюционировать в общий механизм, а не создавать параллельный framework. Следующий roadmap stage автоматически не начинать.

## GOAL

Добавить кнопку **Экспорт → CSV / XLSX** во все существующие meaningful пользовательские таблицы проекта.

Ключевой контракт:

```text
UI filtered total
= authoritative server-side filtered population
= export data row count
```

Экспортируется **вся отфильтрованная выборка**, не текущая страница пагинации.

## 1. COMPLETE TABLE INVENTORY — FIRST

До реализации провести repository-wide audit всех:
- registries/lists/data grids;
- Analytics tables;
- CRM tables;
- Orders/Bookings/Payments;
- Finance/Sales tables;
- Partner Workspace tables;
- Entity 360/detail tables;
- admin/internal business tables;
- reusable table components.

Для каждой:

| Module/Page | Route | Table | Workspace | Classification | Export? | Reason |
|---|---|---|---|---|---|---|

Classification:
`REGISTRY`, `ANALYTICS`, `LOCAL_DETAIL`, `STATIC_PRESENTATION`, `TECHNICAL`, `NOT_EXPORTABLE`.

`REGISTRY` → export обязателен.
`ANALYTICS` → export агрегированной текущей выборки, если meaningful.
`LOCAL_DETAIL` → export, если meaningful dataset.
Статические/layout таблицы механически не экспортировать.

Meaningful table не может быть пропущена без documented justification/blocker.

## 2. SHARED ARCHITECTURE

Целевая схема:

```text
Canonical Domain Filter
        ↓
Authoritative Query Builder
   ├─ Registry + pagination
   ├─ Count
   └─ Export without pagination
             ↓
      Shared ExportService
       ├─ CSV
       └─ XLSX
```

Domain определяет query/filter, разрешённые columns, serializers, relations и security scope. Shared infrastructure — format, encoding, escaping, workbook generation, filenames, errors, empty dataset.

Не создавать дублирующие `*ExportService` для каждого домена, если это одна инфраструктурная задача.

## 3. SHARED FRONTEND CONTROL

Создать/переиспользовать единый shared component уровня `<TableExportButton />`:

```text
Экспорт
├─ CSV
└─ XLSX
```

Единый UX, loading/error states, accessibility, RU/AZ/EN, сохранение текущих filters.

## 4. FILTER / PERIOD / PAGINATION CONTRACT

Export обязан сохранять применимые:
- `from/to`, preset/custom period;
- search;
- status;
- partner/customer;
- currency;
- `acquisitionSource`;
- domain filters;
- sorting where meaningful;
- workspace/tenant/permission scope.

Canonical interval: `[from,to)`.

Если UI фильтруется по `createdAt`, `paidAt`, service date и т.п., export использует **то же поле**.

При `total=347`, `pageSize=20` export = **347 rows**, не 20.

Client-side dump загруженной страницы запрещён.

## 5. REQUIRED COVERAGE

Inventory authoritative, но минимум проверить:
- Orders;
- Bookings;
- Payments;
- CRM Customers;
- CRM Partners;
- meaningful Partner 360 tables;
- meaningful Customer 360 tables;
- Analytics meaningful tables;
- существующие Finance/Sales registries;
- существующие Marketplace Basic / Storefront Pro registries;
- Partner Analytics tables.

Не создавать отсутствующие модули/fake pages.

## 6. EXPORT COLUMN CONTRACT

Business-friendly columns + reconciliation fields в рамках permissions:
- `id` where allowed;
- Code/referenceNumber;
- status;
- relevant dates;
- partner/customer identifiers and names;
- `acquisitionSource`;
- currency/amount;
- related business referenceNumbers;
- authoritative domain fields.

One-to-many relations не терять: stable delimited columns либо documented row expansion.

Internal UUID не раскрывать внешнему Partner user, если это противоречит security policy.

## 7. CSV / XLSX

CSV: UTF-8, correct quoting/escaping, Unicode RU/AZ/EN, deterministic headers, valid empty file.

XLSX: valid workbook, Unicode, stable headers, numeric values as numeric where appropriate, identifiers/referenceNumbers never corrupted/coerced, dates consistently represented.

Stable filenames без PII/secrets.

## 8. SECURITY — CRITICAL

Export = data-exfiltration surface.

Server-authoritative:
- authentication;
- workspace;
- tenant;
- role;
- permission;
- entitlement/capability where applicable;
- partner/entity scope;
- sensitive fields.

```text
User cannot export a row
the server would not allow that user to read.
```

Client `partnerId`, `tenantId`, Code/referenceNumber/prefix ≠ authorization.

Обязательны cross-tenant negative tests.

`Entitlement ≠ Permission`; `PARTNER role ≠ Storefront Pro`.

## 9. ANALYTICS TABLES

Экспортировать именно displayed/authoritative aggregate dataset.

Например Partner Performance export должен содержать те же aggregate rows/metrics по тем же filters. Не заменять Analytics export raw Orders dump.

Raw source traceability остаётся отдельным concern.

## 10. EXISTING DIAGNOSTIC EXPORT — PRESERVE

Baseline finding:

```text
Baku Tours Pro
2026-09-01 → 2026-10-01

Orders registry    = 86
Orders Analytics   = 86
Bookings registry  = 25
Bookings Analytics = 10

Orders with CAPTURED   = 32/86
Bookings with CAPTURED = 24/25
```

Bookings divergence:
- Registry: `Order.sellerPartnerId`;
- Analytics: `Booking.productId → Product.partnerId`;
- 18 bookings: seller=BTP, product owner=other;
- 3 bookings: product owner=BTP, seller=other.

`10 ≠ paid bookings (24)`.

**Не исправлять здесь молча Partner Performance attribution.** Это отдельный semantic task.

Existing Orders/Bookings endpoints должны быть migrated/reused без regression/backward incompatibility.

## 11. API DESIGN

Domain endpoints допустимы:

```text
/orders/export
/bookings/export
/payments/export
/crm/customers/export
...
```

при общем framework.

Запрещён опасный arbitrary endpoint вроде `/export?table=<db model>`.

## 12. EMPTY / ERROR / LARGE DATASETS

0 rows → корректный export (например headers only), без crash.

Обработать unauthorized/forbidden/invalid format/invalid filters/network/generation errors без stack trace/SQL leakage.

Не загружать огромные datasets в browser. Server-side generation. Async queue не внедрять без доказанной необходимости.

## 13. I18N

RU/AZ/EN:
- Экспорт;
- CSV/XLSX;
- loading;
- error;
- no data where applicable.

No raw i18n keys. Подход к localized/canonical column headers зафиксировать и применять последовательно.

## 14. TESTS

Shared backend:
- CSV/XLSX;
- Unicode;
- escaping;
- empty;
- deterministic headers;
- number/date/reference preservation;
- invalid format.

Domain integration:
- same filters as registry;
- pagination ignored;
- period/search/status/scope preserved;
- unauthorized denied;
- cross-tenant denied.

Frontend:
- CSV/XLSX actions;
- query/filter transfer;
- loading/error;
- RU/AZ/EN.

## 15. RUNTIME MATRIX

Для каждого exportable dataset:

| Route | Dataset | Filtered Total | CSV Rows | XLSX Rows | Filters Preserved | Result |
|---|---|---:|---:|---:|---|---|

Registry invariant:

```text
Filtered Total = CSV Rows = XLSX Rows
```

Повторно проверить Baku Tours Pro Orders/Bookings. Если dataset изменился, не подгонять к baseline — доказать текущие counts.

## 16. TEST REPORTING — TRUTHFULNESS

Если `Frontend Tests = 282/283`, писать:

```text
Frontend Tests: FAIL — 282/283
1 failing test: ...
classification: pre-existing / introduced
```

Pre-existing не превращает FAIL в PASS.

## 17. REQUIRED REPORT

Создать:

`docs/reports/PHASE_3_PRE_STEP_3.12_PROJECT_WIDE_SHARED_TABLE_EXPORT_FRAMEWORK_REPORT.md`

Обязательно:
1. Starting/Implementation/Final SHA;
2. `HEAD == origin/master`;
3. полный inventory;
4. classifications/exclusions;
5. shared backend/frontend architecture;
6. Orders/Bookings migration;
7. coverage matrix;
8. filter/pagination equivalence;
9. security/cross-tenant evidence;
10. CSV/XLSX evidence;
11. RU/AZ/EN;
12. runtime matrix;
13. Baku Tours Pro control;
14. tests;
15. limitations/findings;
16. final verdict.

## 18. ROADMAP

Additively синхронизировать:
`docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`

Не удалять историю, не renumber silently, использовать реальные SHA. Сохранить unresolved Partner Performance attribution finding отдельно. Export framework не означает автоматическое закрытие всего PRE-STEP 3.12.

## 19. ACCEPTANCE

`VERDICT A` только если:

```text
[ ] repository-wide table inventory complete
[ ] every meaningful table classified
[ ] every REGISTRY exported or has proven blocker
[ ] meaningful ANALYTICS/LOCAL_DETAIL covered
[ ] shared backend framework
[ ] shared frontend control
[ ] CSV + XLSX
[ ] full filtered population
[ ] no pagination truncation
[ ] filters/period equivalent to registry
[ ] server-authoritative workspace/tenant security
[ ] cross-tenant tests PASS
[ ] RU/AZ/EN
[ ] empty/error cases
[ ] Orders/Bookings migrated without regression
[ ] runtime matrix complete
[ ] Baku Tours Pro diagnostic evidence preserved
[ ] Partner Performance attribution NOT silently changed
[ ] tests truthfully reported
[ ] report predominantly Russian
[ ] roadmap updated additively
[ ] real SHA
[ ] HEAD == origin/master
```

Meaningful table без export/justified blocker → `VERDICT B`.
Security isolation not proven → `VERDICT B`.
Current-page-only export → `VERDICT B`.

## NON-GOALS

Не:
- менять `Bookings 10 → 25`;
- выбирать seller vs product-owner attribution;
- менять GMV/Commission formulas;
- создавать отсутствующий Finance Center/fake pages;
- внедрять Cart/Checkout;
- создавать arbitrary DB export;
- overengineer async export;
- начинать Step 3.12.

## EXECUTION ORDER

```text
1. Full table inventory
2. Classification
3. Audit current ExportService
4. Canonical Shared Export Contract
5. Shared backend
6. Shared frontend control
7. Migrate Orders/Bookings
8. Implement all meaningful existing registries
9. Implement meaningful Analytics/local-detail exports
10. Filter/pagination verification
11. Security verification
12. RU/AZ/EN
13. Automated tests
14. Runtime matrix
15. Baku Tours Pro regression
16. Report + roadmap
17. Git sync
18. Verdict
```

## CORE PRINCIPLE

```text
             AUTHORITATIVE FILTER CONTRACT
                        │
           ┌────────────┼────────────┐
           ↓            ↓            ↓
       UI TABLE       COUNT        EXPORT
       paginated      total       full dataset
           └────────────┴────────────┘

Filtered population membership MUST be identical.
```

Экспорт — часть data contract, а не декоративная кнопка.
