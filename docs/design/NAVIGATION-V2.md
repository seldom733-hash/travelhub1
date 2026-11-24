# Navigation v2 — рабочее пространство

Дата: 2026-11-24

## Решение владельца

```text
O1 = B′  единый Реестр сделок, отдельные Заявки/Заказы/Брони не восстанавливаем
O2 = A → уточнено владельцем: отдельный пункт «Возвраты» убран как дубль; возвраты доступны из «Платежи и возвраты»
O3 = A   документы остаются в карточке сделки
O4 = A   payment-terms: FINANCE/ADMIN/DIRECTOR, проверять и в route-guard
O5 = A   мобильное меню — off-canvas drawer с подписями
O6 = A   все группы открыты + состояние сохраняется
O7 = A   Stage 0 до изменений меню
D1 = A   новое право finance.bonus.read
D2 = A   /app/documents — guarded deep-link, без пункта меню
D3 = A   канонические возвраты — /app/finance/refunds, полный список
D4 = A   демотированные страницы редиректят на dashboard
```

## Реализация

### Единый источник навигации

`frontend/lib/nav.ts`:

```text
NAV_GROUPS / NAV_ITEMS / NAV_BY_HREF
ROUTE_ACCESS — явная fail-closed таблица
canAccess — any-of permissions + primary role
matchRoute — longest-prefix
isRouteAllowed — guard
isNavActive / activeGroupKey
```

`frontend/components/Shell.tsx` импортирует навигацию из `lib/nav.ts`, сохраняет
`export { NAV_GROUPS }` для существующих тестов.

### Меню

```text
28 пунктов
1 верхняя секция + 9 групп
```

Добавлены:

```text
/app/finance/overview
/app/finance/obligations
/app/finance/refunds
/app/finance/ledger
/app/crm
/app/partners/onboarding
/app/seller-profiles
/app/references
```

Убраны:

```text
/app/geography
/app/hotel-directory
/app/references/service-types
/app/references/airlines
/app/references/clients
/app/references/suppliers
/app/finance/reports/debt-as-of
```

`/app/references` — единственный пункт группы «Справочники»; дочерние страницы —
карточки хаба. `refunds` и `ledger` — отдельные пункты, `supplier-payments` —
карточка/ссылка с гейтом `finance.supplier_payout.read`.

### Поведение

```text
все группы открыты при первом входе
localStorage th_sidebar_groups_v2 хранит ЗАКРЫТЫЕ группы
мобильный <768px: off-canvas drawer с подписями, overlay, Esc, scroll lock
desktop → 768px: collapse rail
active state ровно один, хабы exact-match
roles проверяются в route-guard
```

### D1 — бонусы

Добавлено право:

```text
finance.bonus.read
```

Выдано FINANCE и DIRECTOR; ADMIN получает автоматически через ALL_PERMISSIONS.
`GET /finance/manager-bonuses` требует новое право.

Миграция:

```text
backend/prisma/migrations/20261124120000_finance_bonus_permission/migration.sql
```

### Dashboard и drill-down

- карточки dashboard берут доступ из `NAV_BY_HREF` (OR + roles);
- `SectionGrid` ведёт в `/app/finance/deals` и `/app/crm?tab=...`;
- `metric-drilldown` больше не ведёт на удалённые `/app/orders`, `/app/bookings`,
  `/app/crm/partners`;
- back-links detail-страниц ведут в `/app/finance/deals`.

### Stage 0

Приведены к новому контракту:

```text
requests/orders/bookings/documents registry specs
operations-center-shell
help-center
commerce-detail-system
payments-registry
payment-create-contexts
markup-registry
permission-labels
```

Добавлены:

```text
frontend/lib/nav-integrity.spec.ts
frontend/lib/nav-guard.spec.ts
```

## Проверка

```text
frontend npx tsc --noEmit          PASS
frontend npm run build             PASS
frontend vitest run                81 files / 797 tests PASS
backend npm run build              PASS
browser 1440px                     28 links / 9 group headings
browser 390px                      drawer 29 links (28 + marketplace)
RU / EN labels                     no raw nav.* / sidebar.* keys
active state                       /app/crm → one aria-current
group persistence                  closed 20 → reload 20 → open 28
```

## Остаточные ограничения

- `OperationsCenterShell.OPS_TABS` всё ещё объявляет retired-домены;
  единственный потребитель — `/app/payments`, конфигурация скрыта через
  `visibleDomains`. Вынести в отдельную уборку.
- Проверка живых ролей (OPERATOR/FINANCE/MODERATOR) через реальные сессии не
  выполнялась; покрыто unit-тестами nav-guard.
- `finance.bonus.read` применён SQL-ом на локальной БД; миграция добавлена для
  окружений, где выполняется `prisma migrate deploy`.


## Уточнение 2026-11-24

- Пункт «Возвраты» убран из меню, потому что возвраты уже есть в
  «Платежи и возвраты».
- Страница `/app/finance/refunds` остаётся рабочей и доступна из
  «Платежи и возвраты» кнопкой «Управление возвратами».
- «Финансовый журнал»: колонки «Тип» и «Источник» локализованы, значения
  `PAYMENT_CAPTURED`, `REFUND_PROCESSED`, `SUPPLIER_PAYOUT` и source-типы
  отображаются на RU/AZ/EN.
- В карточке сделки формулировка изменена на «Штраф от поставщика» /
  «Штрафы от поставщика».
