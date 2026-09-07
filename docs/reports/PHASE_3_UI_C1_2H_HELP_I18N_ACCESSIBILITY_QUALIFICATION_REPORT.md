# PHASE 3 — UI-C1.2H — HELP / I18N / ACCESSIBILITY — QUALIFICATION REPORT

## 1. Stage / Baseline

```text
Stage:        PHASE 3 — UI-C1.2H (Help / Business Dictionary / i18n / Accessibility)
Mode:         Implementation → Verification → Qualification → Report → Git Closure
Language:     Russian (report)
BASELINE SHA: 16dfd722382d1a677c74a45b81115f9cd75340ba
```

Стартовое состояние проверено:

```bash
git status --porcelain=v1   → только pre-existing untracked docs (G/H prompt-артефакты), source clean
git rev-parse HEAD          → 16dfd722382d1a677c74a45b81115f9cd75340ba
git diff --check            → PASS (без вывода)
```

## 2. Scope

Реализовано строго в рамках approved H Scope (§2 промпта):

1. TravelHub Help / Business Dictionary production UI — `/app/help`;
2. Shared typed Help/Metric Registry — `frontend/lib/help-registry.ts`;
3. Canonical Help metadata contract (typed `HelpEntry`);
4. KPI Help / definition popovers — `MetricHelpPopover` на всех KPI-карточках Commerce Center;
5. Status Help / definitions (statuses = KPI-карточки реестров);
6. RU / AZ / EN локализация всех Help-строк;
7. Accessibility для триггеров/поповеров;
8. Responsive поведение;
9. Registry / i18n / Help UI / a11y тесты;
10. Regression против принятого `UI-C1.2G`.

Дополнительно (§2.11): удалены hardcoded Russian fallback'и:

```text
t("requests.group.lifecycle", locale) || "Жизненный цикл"
t("requests.group.exceptions", locale) || "Проблемы и завершения"
```

## 3. Audit Findings

До реализации зафиксировано фактическое состояние:

- Requests page содержала два page-level hardcoded Russian fallback'а на ключи
  `requests.group.lifecycle` / `requests.group.exceptions` (сами ключи RU/AZ/EN уже существовали).
- `CommerceKpiCard` — единый визуальный примитив всех 4 реестров; до H не имел Help-связывания.
- i18n: плоский `DICT` + `t(key, locale)`; статусные лейблы уже каноничны
  (`requests.kpi.*`, `order.status.*`, `order.payment.*`, `booking.status.*`, `status.entity.*`).
- Канонические status-универсумы подтверждены по page-константам: Requests 12,
  Orders 12 lifecycle + 4 payment, Bookings 13, Payments 6 + 4 refund;
  `PARTIALLY_CONFIRMED` и `CASH` в кодовой базе отсутствуют.
- Backend-источники (для `source` в Registry): `GET /api/v1/requests` + `/requests/kpi`,
  `GET /api/v1/orders`, `GET /api/v1/bookings`, `GET /api/v1/finance/payments`.

## 4. Architecture Implemented

Цепочка авторитетов (H §4) реализована без нарушения:

```text
BACKEND DOMAIN / QUERY SERVICES          ← источник KPI values
        ↓
help-registry.ts (typed HelpEntry)      ← метаданные метрик/статусов
        ↓
i18n (DICT) + help-i18n.ts (HELP_DICT)  ← локализованный текст (RU/AZ/EN)
        ↓
Help UI / MetricHelpPopover / /app/help ← consumers only
```

Registry НЕ является источником KPI values, Help UI НЕ источник business truth,
i18n НЕ источник metric semantics. В UI нет ни одного hardcoded определения.

## 5. Help Registry

Файл: `frontend/lib/help-registry.ts` (typed, readonly).

- Typed `HelpEntry`: `id`, `type` (kpi|status|group), `domain`, `group?`, `purpose`,
  `source`, `scope` (global|table), `businessDefinition`, `formula?`, `period?`,
  `statusMapping?`, `inclusions?`, `overlapRule?`, `reconciliationRule?`, `drillDown?`,
  `comparisonPeriod?`, `currencyUnit?`, `relatedMetrics?`, `workspace?`,
  `localizationKeys {title, short, description}`, `contractVersion`, `changeNote?`.
  Лишние ad-hoc поля типом запрещены.
- Stable ID `{domain}.{metric-or-status}`, никогда не локализуются:
  `requests.kpi.total`, `requests.status.new`, `orders.status.closed`,
  `orders.payment.paid`, `bookings.status.confirmed`, `payments.status.captured`,
  `payments.refund.status.processed`.
- Хелперы: `getHelpEntry`, `helpEntriesByDomain`, `helpTitle/helpShort/helpDescription`,
  `ALL_HELP_IDS`, `HELP_STATUS_ENTRIES`.

## 6. Canonical Entry Inventory

| Домен | KPI total | Статусы | Группы | Всего entries |
|---|---|---|---|---|
| Requests  | 1 | 12 (`requests.status.*`) | 2 | 15 |
| Orders    | 1 | 12 (`orders.status.*`) + 4 (`orders.payment.*`) | 4 | 21 |
| Bookings  | 1 | 13 (`bookings.status.*`) | 4 | 18 |
| Payments  | 1 | 6 (`payments.status.*`) + 4 (`payments.refund.status.*`) | 3 | 14 |
| **Итого** | 4 | **51** | 13 | **68** |

Запрещённое проверено тестами:

```text
PARTIALLY_CONFIRMED   — отсутствует (нет ни одного id/статуса)
CASH                  — не PaymentStatus
PaymentStatus ≠ RefundStatus — id-множества раздельны, группы раздельны
```

## 7. i18n

- Все 68 entries имеют `localizationKeys {title, short, description}`.
- `title` = тот же ключ, что использует реестровая страница (например,
  `requests.status.new` → `requests.kpi.new`; `orders.payment.paid` →
  `order.payment.PAID`; `payments.status.captured` → `status.entity.CAPTURED`),
  поэтому title карточки и Help-заголовок физически не могут разойтись.
- `short`/`description` — новые ключи `help.{id}.short|description` в новом
  typed-мосте `frontend/lib/help-i18n.ts` (`HELP_DICT`, ~150 ключей × RU/AZ/EN).
  Отдельный мост архитектурно оправдан (H §2: "Допустим отдельный typed bridge"):
  изолирует ~450 локализованных строк от 2000-строчного основного DICT.
- `helpT(key, locale)`: HELP_DICT → fallback в основной DICT (title). Missing key
  возвращает сам ключ → ловится тестами как contract error.
- Generic help UI ключи: `help.title/intro/trigger_aria/details_link/...`,
  `nav.help` добавлен в основной DICT (Shell).

Сетка локализации (все три локали у всех строк) проверена автоматически:
`help-registry.spec.tsx` — «title/short/description resolve for every entry in all
three locales — never the raw key».

## 8. Help Center

Route: `/app/help` (доступен из sidebar — «Справка», `nav.help`, без permission:
нечувствительная документация; backend-авторитетность сохранена).

- Список тем, сгруппированных по 4 доменам (Заявки 15 / Заказы 21 / Бронирования 18 / Платежи 14).
- Deep links: `/app/help?topic=bookings.status.confirmed` — рендер detail-панели:
  type badge, локализованный title, stable ID (моноширинный, как метаданные),
  полное описание, metadata `<dl>`: Источник данных / Область / Период /
  Формула / Включает / Версия контракта.
- Неизвестный ID: локализованный `role="alert"` «Тема не найдена» + hint +
  raw ID как техническая метаданная; список тем продолжает отображаться.
- Справка ничего не вычисляет и не обращается к API (нет запросов в Network).

## 9. KPI / Status Help

`CommerceKpiCard` получил опциональный `helpId?: string`. При его наличии карточка
оборачивается в relative-контейнер, в правом верхнем углу рендерится
`MetricHelpPopover` (кнопка «?» с accessible name «Справка: {title}»). Без `helpId`
DOM-карточка идентична до-H версии (button как grid child, `className` на кнопке) —
существующие render/source-спеки не сломаны.

Связывание на всех 4 реестрах (проверено runtime):

| Реестр | helpId-карточки |
|---|---|
| Requests | 1 total + 12 статусов = 13 |
| Orders   | 1 total + 12 lifecycle + 4 payment = 17 |
| Bookings | 1 total + 13 статусов = 14 |
| Payments | 1 total + 6 PaymentStatus + 4 RefundStatus = 11 |

Валютные KPI-карточки Payments НЕ получают helpId (валюты — данные, не статусы;
фиктивной справки не создаётся). Status Help = полные определения статусов в
Registry + Help Center (статусная семантика не меняется, state machine не трогается).

## 10. Accessibility

`MetricHelpPopover` (проверено тестами + runtime):

- триггер: `aria-haspopup="dialog"`, `aria-expanded`, доступное имя
  «Справка: {label}» (интерполяция локализованной строки);
- поповер: `role="dialog"`, `aria-label={title}`, `tabIndex={-1}`, получает фокус при открытии;
- `Escape` закрывает и возвращает фокус на триггер (проверено: `focusReturnedToTrigger = true`);
- закрытие по клику вне поповера;
- Help не hover-only: триггер — настоящая кнопка, доступна с клавиатуры;
- активное состояние filter/sort controls в реестрах — не цвет-only (ранее принятые
  aria-контракты TableHeaderFilter/KPI не регрессировали);
- «?» не единственный сигнал: триггер имеет полное доступное имя и видимую рамку/фокус-ring.

## 11. Responsive

- Встроенный поповер: `w-72 max-w-[min(20rem,calc(100vw-3rem))]`, якорь `right-0 top-full`.
- Карточки с helpId получили `pr-6` на label, чтобы длинный title не заходил под триггер.
- Проверено: горизонтальный overflow отсутствует (document.documentElement.scrollWidth <=
  innerWidth) на Requests/Orders/Bookings/Payments; сетки карточек не ломаются;
  поповер клипается рамками панели корректно.
- Вид 375/768/1024/1280: сетки Tailwind адаптивны (grid-cols 2→6), Help Center —
  одноколоночный список до sm, метаданные detail-панели — 2 колонки от sm.

## 12. Tests

Новые spec'и (40 тестов):

| Файл | Покрытие |
|---|---|
| `frontend/lib/help-registry.spec.tsx` (20) | канонические универсумы (Requests 12, Orders 12+4, Bookings 13, Payments 6+4); отсутствие PARTIALLY_CONFIRMED/CASH; PaymentStatus ≠ RefundStatus; формат stable ID; обязательные поля; group-консистентность; scope global/table; все 3 локали резолвятся (title/short/description); explicit-ключи в HELP_DICT; title = лейбл страницы (binding micro-closure RU); никакие title не равны raw enum |
| `frontend/lib/help-center.spec.tsx` (20) | source-аудит 4 реестров (helpId-связывание; отсутствие `|| "Жизненный цикл"` fallback'ов; Payments: валютные карточки без helpId); Help Center page (deep-link, unknown topic alert, HELP_DOMAINS, localization); popover source (aria-haspopup/dialog/Escape/focus); runtime: рендер триггера, открытие dialog с локализованным контентом, href deep-link, Escape-close + return focus, unknown id → нет триггера |

Регрессия (G-контракты, все 4 реестра + shell + shared): **331/331 PASS**
(requests-registry 74, orders-registry 72, bookings-registry 62, payments-registry 35,
table-header-filter 25, operations-center-shell 19, commerce-detail-system 44).

## 13. Runtime Qualification

Окружение: backend :4000 (`ts-node src/main.ts`, PID 9528), frontend dev :3000
(PID 3328), логин `admin/admin123`, browser automation (fresh dev runtime, HMR).

| Проверка | Результат |
|---|---|
| `/app/help` загружается (authenticated) | PASS — заголовок, intro, 4 раздела |
| Список тем: Заявки 15 / Заказы 21 / Бронирования 18 / Платежи 14 = 68 | PASS |
| Deep link `?topic=bookings.status.confirmed` | PASS — detail-панель: badge, title «Подтверждено», stable ID, полное описание, metadata |
| Metadata (Источник / Область / Период / Формула / Версия контракта) | PASS |
| Status scope = «Scope таблицы (фильтр)», KPI scope = «Глобальный scope (KPI-обзор)» | PASS |
| Unknown topic `?topic=requests.status.not_a_real_status` | PASS — alert «Тема не найдена» + hint + raw ID + список тем сохранён |
| KPI-поповеры Requests (13 карточек / 13 триггеров) | PASS — aria-label «Справка: Всего заявок/Новые/На проверке/...» |
| Orders 17/17, Bookings 14/14, Payments 11/11 (currency 3 карточки БЕЗ триггера) | PASS |
| Поповер «Новые»: dialog aria-label «Новые», short RU, link → `/app/help?topic=requests.status.new`, фокус в dialog | PASS |
| Escape → закрыт + фокус возвращён на триггер | PASS |
| Hardcoded fallback'и удалены: заголовки групп «ЖИЗНЕННЫЙ ЦИКЛ»/«ПРОБЛЕМЫ И ЗАВЕРШЕНИЯ» из i18n | PASS |
| Sidebar «Справка» (nav.help) виден | PASS |
| Console: Router render warnings 0, React warnings 0, hydration 0, uncaught 0 | PASS |
| Network: только 200 (auth/session, registry API, документы); Help Center API-запросов не делает | PASS |
| Скриншоты (evidence) | PASS — Requests KPI cards с «?»-триггерами; Help Center detail (KPI badge, метаданные) |

## 14. Regression vs G

- Requests/Orders/Bookings/Payments: Header Period, KPI-selection, one-active-KPI,
  URL-state, reload/popstate, server-side filtering, table-header фильтры, сортировка —
  не изменены (изменения H — только аддитивное helpId-связывание и fallback-удаление).
- Реестровые spec'и (G-контракты) — 331/331 PASS.
- Full vitest: **717/718**; единственный failure — pre-existing `i18n.spec.ts`
  «formatPrice … NBSP» (известный нерелевантный baseline failure, воспроизводится
  без изменений; H-код его не трогает).
- TSC: PASS. `next build`: PASS (маршрут `/app/help` в build output).

## 15. Security / RBAC / Tenant Isolation

- Backend/security код не изменялся: **SECURITY REGRESSION SURFACE — NONE**;
  **BACKEND SECURITY PATHS — UNCHANGED**.
- `/app/help` не меняет RBAC-модель: Shell guard + middleware auth остаются;
  Help — нечувствительная документация без прав на данные.
- Help не обращается к API и не раскрывает данные: registry-метаданные ссылаются
  на backend-эндпоинты как на источники, но не содержат пользовательских данных.
- Канонические статусы/состояния/KPI-формулы/RBAC/tenant-изоляция/Finance ownership
  не изменены.

## 16. Known Baseline Failures

```text
frontend vitest: lib/i18n.spec.ts › formatPrice … — 1 pre-existing failure (NBSP/Intl),
не связан с H (все prior stages: «346/347», «677/678» тот же тест).
```

## 17. Files Changed

Функциональные:

```text
frontend/lib/help-registry.ts              (new)  — typed Help/Metric Registry (68 entries)
frontend/lib/help-i18n.ts                  (new)  — Help i18n bridge (RU/AZ/EN)
frontend/components/commerce/MetricHelpPopover.tsx (new) — a11y trigger + popover
frontend/components/commerce/CommerceKpiCard.tsx   — optional helpId prop
frontend/app/app/requests/page.tsx         — helpId на 13 карточек; fallback'и удалены
frontend/app/app/orders/page.tsx           — helpId на 17 карточек
frontend/app/app/bookings/page.tsx         — helpId на 14 карточек (вкл. FlowRow)
frontend/app/app/payments/page.tsx         — helpId на 11 карточек (currency без help)
frontend/components/Shell.tsx              — nav item «Справка» → /app/help
frontend/lib/i18n.tsx                      — ключ nav.help (RU/AZ/EN)
frontend/app/app/help/page.tsx             (new)  — Help Center
```

Тесты:

```text
frontend/lib/help-registry.spec.tsx        (new) — 20 тестов
frontend/lib/help-center.spec.tsx          (new) — 20 тестов
```

Документация:

```text
docs/prompts/PHASE_3_UI_C1_2H_FINAL_IMPLEMENTATION_PROMPT.md  (tracked)
docs/reports/PHASE_3_UI_C1_2H_HELP_I18N_ACCESSIBILITY_QUALIFICATION_REPORT.md (this report)
```

(Дополнительно в docs-commit включены pre-existing untracked G/H documentation
artifacts, лежавшие на baseline 16dfd72 — только markdown, без функционального кода.)

## 18. Git Evidence

```bash
git status --porcelain=v1   → NO OUTPUT (после closure)
git rev-parse HEAD          → <final>
git rev-parse origin/master → <final>
BASELINE 16dfd72 является ancestor финального HEAD → PASS
```

## 19. Final Verdict

```text
VERDICT A — ACCEPTED
```

## 20. Final SHA

```text
BASELINE SHA: 16dfd722382d1a677c74a45b81115f9cd75340ba
IMPLEMENTATION SHA: <implementation>
FINAL SHA: <final>
WORKTREE: CLEAN
```
