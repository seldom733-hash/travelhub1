# PHASE 3 — UI-C1.2H.1 — GLOBAL HELP / BUSINESS DICTIONARY — ARCHITECTURE MAP

> Документ фиксирует глобальную архитектуру TravelHub Help / Business Dictionary.
> Help ≠ коллекция KPI-подсказок: KPI Help — только один из entry points.
>
> Статус документа: ARCHITECTURE MAP (docs-only). Решения D1–D5 зафиксированы.
> Production-код не изменялся на момент написания.

---

## 1. Purpose

Зафиксировать архитектуру **глобального TravelHub Business Dictionary / Help Center**,
расширяемого на все существующие и будущие домены платформы, поверх принятой
`UI-C1.2H` реализации (первое production coverage: Requests / Orders / Bookings / Payments).

Границы этапа (H.1 §21, §23):

```text
Global Help Architecture
+ Extensible Registry (typed)
+ Current Coverage
+ Future Coverage Map
```

а не написание контента будущих доменов. Для будущих доменов действует правило:
без канонического business authority — только `FUTURE / NOT YET CANONICAL`, никаких
выдуманных definitions / KPI / formulas / statuses / workflows / policies.

---

## 2. Current H implementation (факты)

| Файл | Роль |
|---|---|
| `frontend/lib/help-registry.ts` (1278 стр.) | Typed Registry: 68 entries, `HelpDomain = requests\|orders\|bookings\|payments`, `HelpEntryType = kpi\|status\|group` |
| `frontend/lib/help-i18n.ts` (753 стр.) | Typed i18n-мост RU/AZ/EN (`HELP_DICT` + `helpT`), title пер-использует label-ключи страниц |
| `frontend/app/app/help/page.tsx` | `/app/help`: список тем по 4 доменам, `?topic=` deep links, detail-панель, unknown-topic `role="alert"` |
| `frontend/components/commerce/MetricHelpPopover.tsx` | A11y trigger + `role="dialog"` popover (Escape, focus return) |
| `frontend/components/commerce/CommerceKpiCard.tsx` | Опциональный `helpId` |
| `frontend/components/Shell.tsx` | `nav.help` в группе Service, без permission |

Инвентарь 68 entries: Requests 15 (1 KPI + 12 status + 2 group), Orders 21
(1 + 12 + 4 payment + 4 group), Bookings 18 (1 + 13 + 4 group), Payments 14
(1 + 6 PaymentStatus + 4 RefundStatus + 3 group).

Связывание KPI-карточек: Requests 13/13, Orders 17/17, Bookings 14/14,
Payments 11/11 (валютные карточки без help — корректно: это данные, не статусы).

Качество H: тесты registry 20 + help-center 20; G-регрессия 331/331; full vitest
717/718 (единственный failure — pre-existing i18n NBSP, не связан с H); TSC PASS;
`next build` PASS; runtime console 0; security surface NONE (backend не изменялся).

---

## 3. Global Help architecture (target)

```text
TRAVELHUB HELP / BUSINESS DICTIONARY
│
├── Platform / General Concepts          (workspaces, RBAC/entitlement, контексты)
├── Command Center                       (Executive/Operational/Financial/Marketplace)
├── Analytics                            (presets, метрики, drilldowns)
├── Operations / Commerce
│   ├── Requests   [CURRENT]
│   ├── Orders     [CURRENT]
│   ├── Bookings   [CURRENT]
│   └── Payments   [CURRENT, finance ownership]
├── Finance                              (payments [CURRENT]; ledger/commission/settlement → FUTURE)
├── Sales / Partner Network              (onboarding, seller profiles, reverse flow → FUTURE)
├── Catalog                              (products/services — BLOCKED, PROD-01)
├── CRM                                  (→ FUTURE)
├── Marketing                            (→ FUTURE)
├── Support                              (→ FUTURE)
├── Admin / Users                        (роли/политики → FUTURE)
├── Marketplace / Storefront             (→ FUTURE, GMV/Revenue invariant)
└── Shared Business Concepts             (сквозные концепции → FUTURE)
```

Многоуровневая модель контента (H.1 §7):

```text
Level 1 — Contextual Help      → краткое объяснение (KPI-поповер)     [реализовано: short]
Level 2 — Business Definition  → definition/scope/formula/period      [реализовано: description + metadata]
Level 3 — Business Dictionary  → concept/purpose/relationships/lifecycle/reconciliation
                                 [архитектурно поддержано полями; полный L3-контент — по мере доменов]
```

Не каждый entry обязан иметь все уровни. KPI — один из entry types; в Registry
поддерживаются типы: `topic / concept / kpi / status / formula / workflow / policy`.

---

## 4. Domain taxonomy (доказанная архитектурой, не выдуманная)

Источники доказательности: `frontend/components/Shell.tsx` (nav-группы + RBAC),
`frontend/app/app/*` (production-маршруты), `docs/architecture/*`, `docs/adr/*`.

| Area | Evidence | Статус |
|---|---|---|
| platform | Workspace-модель (platform vs partner), ADR-0002 (auth/rbac), ADR-0014 (tenant), docs platform-vs-partner-workspace-context-model-phase3 | FUTURE |
| command-center | `/app/command-center` (`analytics.read`), секции Executive/Operational/Financial/Marketplace, dashboard-command-center-backend-3.1 | FUTURE |
| analytics | `/app/analytics`, `frontend/lib/metric-drilldown.ts` (METRIC_CONFIGS), analytics-foundation docs | FUTURE |
| operations | Shell group «Операции»: requests/orders/bookings; COMMERCE_LIFECYCLE_CANONICAL_CONTRACT | **CURRENT** |
| finance | Shell group «Финансы»: payments; finance-domain-foundation, refund-flow, ledger/commission docs | **CURRENT** (payments); FUTURE (шире finance) |
| sales | Shell group «Partner Network»: partners/onboarding, seller-profiles; sales-domain-foundation, sales-center-backend, reverse-* docs | FUTURE |
| catalog | `/app/catalog` (products/services); **PROD-01 OPEN** (debt register L640) | **BLOCKED** |
| crm | `/app/crm` (three-context CRM), ADR-0007 | FUTURE |
| marketing | `/app/marketing` (campaigns) | FUTURE |
| support | `/app/support` (cases: VALID_TRANSITIONS, CASE_TYPES, PRIORITIES) | FUTURE |
| admin | `/app/users` (роли/права), ADR-0002 | FUTURE |
| marketplace | ADR-0006 (storefront commercial model), ADR-0008, storefront-business-capability-model; GMV invariant | FUTURE |
| shared | Cross-domain концепции (customer/payer/traveler, order→booking→payment chain, groups) | FUTURE |

Hard invariant: Marketplace GMV ≠ Storefront Commerce Volume ≠ TravelHub Revenue
(H.1 §14) — финансовые definitions только с каноническим источником.

---

## 5. Current production coverage

- 4 commerce-домена, 68 entries, RU/AZ/EN, stable IDs `{domain}.{id}`.
- Канонические универсумы: Requests 12, Orders 12 + 4 payment, Bookings 13,
  Payments 6 PaymentStatus + 4 RefundStatus. `PARTIALLY_CONFIRMED`/`CASH` отсутствуют;
  PaymentStatus ≠ RefundStatus.
- Entry points в production: KPI-карточки 4 реестров (55 карточек с helpId) +
  `/app/help` список/детали по stable ID.
- Правило: `paymentStatus > refundStatus > currencyCard` (Payments deep-link
  precedence) — семантика не меняется.

---

## 6. Future domain coverage

| Area | Authority сегодня | Правило контента |
|---|---|---|
| command-center / analytics | Метрики + presets (backend), METRIC_CONFIGS | Контент только после подтверждения канонических metric sources (типы kpi/formula) |
| support | UI-статусы + VALID_TRANSITIONS есть, но не канонизированы в Help | status-entries после аудита |
| crm / marketing | UI-статусы есть | После канонизации + i18n-аудита (сейчас часть лейблов hardcoded) |
| finance (шире payments) | Docs-foundations есть; UI-метрик нет | NOT YET CANONICAL для UI-метрик |
| sales | Docs есть; UI-канон неполон (seller-profiles лейблы hardcoded English) | После канонизации |
| platform | ADR/docs | policy/workflow-entries (RBAC, workspace) — после аудита |
| catalog | PROD-01 OPEN | **BLOCKED** — definitions/formulas запрещены до resolution |
| marketplace | ADR-0006 | Только с каноническим источником (GMV/Revenue) |
| shared | Canonical arch §5 (customer/payer/traveler) | concept-entries — кандидаты, после аудита |

Правило: будущий домен не получает content-entries, пока не доказан canonical
business authority. Пометка в Registry/документации: `FUTURE / NOT YET CANONICAL`.

---

## 7. Canonical business concepts (кандидаты, не definitions)

Зафиксированы как кандидаты будущих concept-entries (без выдуманных текстов):

- Workspace context (Platform vs Partner), Entitlement ≠ Permission (docs phase3);
- Customer / Payer / Traveler роли (canonical architecture §5);
- Commercial lifecycle chain: Product → Quote → Checkout → Sale → Order → Booking → Payment → Voucher → Delivery → Completion (COMMERCE_LIFECYCLE_CANONICAL_CONTRACT);
- Request как pre-order validation workflow (не primary Order path);
- Reverse marketplace flow: BuyerRequest → Proposals → Opportunity → conversion;
- Groups как группирующие headings, не новые статусы.

Ни один из них не вводится в Registry до отдельного content-approval.

---

## 8. Metric / status / concept relationships

Связи — только по stable ID (H.1 §8), через типизированные поля:

```text
relatedMetrics?: string[]
relatedStatuses?: string[]     (новое в H.1 model)
relatedConcepts?: string[]     (новое в H.1 model)
```

Пример отношения (существующая цепочка, связи по FK в домене, не строковым парсингом):

```text
Order
├── Order Status         (lifecycle)
├── Order Payment Status (отдельное измерение)
├── Booking              (fulfillment entity)
├── Payment              (финансовая транзакция)
└── Refund
```

Правила: никаких дублей definitions; группы ссылаются на свои status-entries;
уникальность stable ID; отсутствие циклических двусмысленностей.

---

## 9. Entry points

| Entry point | Статус | Примечание |
|---|---|---|
| KPI-карточка (Commerce KPI) | Реализовано (H) | `MetricHelpPopover`, 55 карточек |
| Статус (через KPI-карточку) | Реализовано (H) | Registry самодостаточен: Status Help не зависит от KPI-card |
| `/app/help` темы + stable-ID deep links | Реализовано (H) | |
| Табличные колонки / статус-badge на списках | FUTURE (отдельный UI-этап) | |
| Detail-страницы | FUTURE | |
| Концепт / workflow / policy (L3) | Архитектурно поддержано; UI при контенте | |
| Page/Section/action-level «?» | Не ставить на каждый UI-элемент (H.1 §12) | Правило: только осмысленные точки |

---

## 10. Navigation

Текущее: `/app/help` — список 4 доменов (Заявки 15 / Заказы 21 / Бронирования 18 /
Платежи 14), `?topic=` detail, «← Ко всем темам».

Эволюция (когда появится контент будущих доменов):

```text
Business Dictionary
├── Все темы
├── По разделам (areas)
├── Метрики      (type = kpi|formula)
├── Статусы      (type = status)
├── Бизнес-термины (type = concept)
└── Процессы и правила (type = workflow|policy)
```

Фильтрация по `area` + `type` реализуется на том же registry без новой архитектуры.
Текущие 4 production-домена сохраняются как есть.

---

## 11. Search

- Поля: title, short, description, stable ID, domain, area, aliases (новое поле модели).
- Только по Registry entries; никогда по бизнес-данным.
- На 68 entries поиск НЕ нужен → зафиксирован как **future enhancement**;
  критерий включения: registry ≥ ~150 entries или ≥ 2 areas с контентом.

---

## 12. i18n

- RU / AZ / EN для всех user-facing строк; stable ID language-neutral.
- Explicit mapping (`localizationKeys {title, short, description}`), никакого
  слепого `t(id, locale)`; missing key = contract error.
- Масштабирование: при добавлении доменов `HELP_DICT` разносится по per-area
  файлам (сейчас один `help-i18n.ts`, 753 строки только на Commerce).
- Raw-key/fallback policy H сохраняется; page-level hardcoded Russian fallback
  запрещён (в Requests устранён в H).

---

## 13. Accessibility

- H-контракт сохраняется: trigger name/role/keyboard/Escape/focus return,
  `role="dialog"`, не hover-only.
- Требования для будущей навигации: topic list / detail / breadcrumbs —
  семантические заголовки, keyboard flow, SR-видимый контент, фокус при навигации.

---

## 14. Workspace / entitlement

- Модель Help metadata поддерживает `workspace` (platform | partner | both) и
  `entitlement` (справочная метка capability/plan, НЕ permission).
- Help никогда не запрашивает и не раскрывает tenant-sensitive данные;
  workspace-specific topics явно обозначаются.
- Текущее `/app/help` доступно в Platform shell без permission (нечувствительная
  документация); Partner workspace — будущая entry-точка.

---

## 15. Authority chain

```text
BACKEND DOMAIN / QUERY SERVICES        ← business calculation authority (значения KPI)
        ↓
HELP / METRIC REGISTRY (typed)         ← metadata authority (definition/scope/formula/relations)
        ↓
i18n (RU/AZ/EN)                        ← локализованный текст
        ↓
HELP UI / KPI POPOVER / /app/help      ← consumers only
```

Registry НЕ источник KPI values; Help UI НЕ источник business truth; i18n НЕ
источник metric semantics. Help не обращается к API (Network: 0 запросов).

---

## 16. PROD-01 boundary

- `PROD-01` (Seller Service Cards / Product Model / Service Category Reporting)
  зарегистрирован в `docs/TRAVELHUB_DEBT_REGISTER.md` (L640), статус OPEN.
- Пока каноническая product/service модель не разрешена:
  - Catalog-домен в таксономии присутствует как **BLOCKED**;
  - никаких product-entries, definitions, formulas, reporting-измерений;
  - Help Registry не ссылается на продукт/сервис/категорию как на canonical concept.

---

## 17. Open decisions (статус)

| Решение | Статус |
|---|---|
| D1 — объём H.1 | **РЕШЕНО**: Docs + Registry model extension (без контента будущих доменов) |
| D2 — таксономия ID | **РЕШЕНО (план)**: `area` как аддитивное типизированное поле + `domain`-маппинг; существующие stable ID и deep-links `?topic=` не меняются |
| D3 — порядок будущих доменов | roadmap §18; content после per-domain authority-аудита |
| D4 — debt-регистр (hardcoded лейблы вне Commerce: seller-profiles, catalog PRODUCT_TYPES) | Отдельный micro-update `TRAVELHUB_DEBT_REGISTER.md`, НЕ внутри H.1 (зафиксировано здесь как finding) |
| D5 — PROD-01 boundary | Catalog BLOCKED до resolution |

---

## 18. Recommended roadmap

```text
[ ] H.1 docs + Registry model extension           ← ТЕКУЩИЙ ЭТАП (после approval)
[ ] H.1 qualification + report + git closure

Будущие content-этапы (каждый — с authority-аудитом и отдельным approval):
[ ] support      → status/concept entries (UI-статусы есть)
[ ] crm / marketing → status entries после канонизации лейблов
[ ] command-center / analytics → kpi/formula entries (metric sources подтвердить)
[ ] platform     → policy/workflow (workspace/RBAC) entries
[ ] finance (ledger/commission/settlement) → после появления канонических UI-метрик
[ ] sales        → после канонизации (сейчас часть лейблов hardcoded)
[ ] catalog      → ПОСЛЕ resolution PROD-01
[ ] marketplace  → только с каноническим GMV/Revenue источником
[ ] shared       → concept-entries (customer/payer/traveler, lifecycle chain)

UI-этапы (по мере контента):
[ ] Навигация Help Center: разделы/фильтры type+area
[ ] Search (критерий: ≥150 entries или ≥2 areas)
[ ] Status Help на табличных badge/колонках
[ ] Partner-workspace entry point
```

Каждый этап сохраняет: 68 H entries без изменения бизнес-семантики, canonical
status universes, KPI/URL/Header-Period семантику, RBAC/tenant изоляцию.

---

## Git state (на момент карты)

```text
HEAD / origin/master: 5a3395aa13fc2477566363ed6a71c7cbd75deb20
UI-C1.2H: ACCEPTED (implementation ebbc7a2, FINAL f20850d, fix 5a3395a)
Working tree: только untracked H.1 prompt (docs/prompts/) + данный файл (docs/reports/)
Production code: НЕ изменялся
```
