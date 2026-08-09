# PHASE 1 — STEP 1.6: PUBLIC MARKETPLACE ROUTING & FRONTEND SPLIT

## Статус входа

Steps 1.0–1.5 — APPROVED.

Backend Public Catalog Read Foundation завершён:
- anonymous public product list;
- public categories;
- public filters;
- public Product Card contract;
- public Product Detail contract;
- stable public media delivery;
- published-version isolation;
- moderation integration;
- regression suite green.

Начни только **PHASE 1 — STEP 1.6: Public Marketplace Routing & Frontend Split**.

Не начинай checkout, cart, Sales, OrderRequested, Booking, Finance, Payment, Partner Cabinet full implementation, Buyer Cabinet full implementation или Moderation Center UI.

---

## 1. Цель

Разделить frontend TravelHub на два явных контура:

```text
PUBLIC MARKETPLACE
/
├─ /
├─ /search
├─ /products/:slug
├─ /categories/:slug
└─ future checkout/account routes

INTERNAL APPLICATION
/app/*
├─ /app/dashboard
├─ /app/catalog
├─ /app/orders
├─ /app/bookings
├─ /app/finance
├─ /app/crm
├─ /app/analytics
└─ остальные внутренние Work Centers
```

Главный invariant:

```text
/          = Public Marketplace
/app/*     = Internal TravelHub application
```

Внутренний Dashboard больше не является публичной стартовой страницей.

---

## 2. Сначала изучи текущий frontend

До изменений покажи:

- Next.js version и routing model;
- `app/` / `pages/` structure;
- текущий `/`;
- Dashboard route;
- auth middleware;
- layouts;
- navigation/sidebar;
- internal pages;
- Catalog/Tours pages;
- Booking pages;
- Payments pages;
- Chat/Reviews/Profile pages;
- public API client;
- auth store/session handling;
- localization routing;
- current loading/error boundaries;
- current design system/components.

Не переписывай frontend с нуля.

Составь mapping:

```text
Current route
→ target public/internal route
→ keep / move / redirect / deprecate
```

---

## 3. Public root

Route:

```text
/
```

должен быть доступен anonymous и представлять Public Marketplace shell.

На Step 1.6 достаточно routing/shell integration.

Полноценный Marketplace visual implementation будет Step 1.7.

Но `/` уже должен:

- использовать public layout;
- не требовать login;
- иметь public header/navigation;
- иметь место/контракт для search;
- загружать минимальный published catalog content через Step 1.5 API либо безопасный placeholder/read integration;
- не показывать internal sidebar/dashboard controls.

---

## 4. Public routes

Подготовить минимум:

```text
/
 /search
 /products/[slug]
 /categories/[slug]
```

Routes должны работать без authentication.

Использовать Step 1.5 public API:

```text
GET /api/v1/public/products
GET /api/v1/public/products/:slug-or-id
GET /api/v1/public/categories
GET /api/v1/public/categories/:slug
GET /api/v1/public/categories/:slug/filters
```

Не обращаться к internal `/products` для public pages.

---

## 5. Product Detail route

Route:

```text
/products/[slug]
```

должен быть готов использовать `PublicProductDetail`.

На Step 1.6 можно реализовать минимальную функциональную страницу/skeleton, достаточную доказать:

- route работает;
- anonymous access;
- public API only;
- 404 для непубличного Product;
- no internal fields;
- stable public media URLs.

Полный PDP UI будет Step 1.7.

---

## 6. Search route

Route:

```text
/search
```

должен принимать URL query params и передавать их в Public Catalog API.

Минимально:

```text
q
category
page
pageSize
sort
category-specific filters
```

URL должен быть shareable/bookmarkable.

Не хранить основной search state только в client memory.

---

## 7. Category route

Route:

```text
/categories/[slug]
```

должен использовать:

- public category endpoint;
- category-specific filter metadata;
- public product list.

Не хардкодить Hotel/Tour/etc. как отдельные frontend data models.

---

## 8. Internal application prefix

Все внутренние Work Centers должны находиться под:

```text
/app/*
```

Минимум определить canonical routes:

```text
/app/dashboard
/app/analytics
/app/sales
/app/catalog
/app/orders
/app/bookings
/app/crm
/app/finance
/app/marketing
/app/support
/app/users
/app/documents
/app/calendar
/app/reports
/app/integrations
/app/ai
/app/system
/app/settings
/app/moderation
```

Не обязательно реализовывать отсутствующие страницы в Step 1.6.

Для отсутствующих Work Centers допустим controlled placeholder/Not Implemented route только если это соответствует текущему проекту.

Не создавать фиктивный функционал.

---

## 9. Existing route migration

Существующие внутренние routes нельзя просто удалить.

Для каждого:

- определить новый `/app/*` route;
- сохранить working page/component;
- обновить internal links;
- при необходимости добавить redirect со старого internal URL;
- не редиректить public `/` обратно на Dashboard.

Пример:

```text
/dashboard → /app/dashboard
/bookings  → /app/bookings
/payments  → /app/finance or existing temporary mapping
```

Фактический mapping определить после аудита текущего frontend.

---

## 10. Authentication boundary

Public:

```text
/
 /search
 /products/*
 /categories/*
```

не требуют authentication.

Internal:

```text
/app/*
```

требует authenticated internal user и соответствующий RBAC.

Не достаточно скрыть sidebar.

Middleware/server guard должен блокировать anonymous access к internal routes.

---

## 11. Role boundaries

Internal roles:

```text
ADMIN
DIRECTOR
FINANCE
MARKETER
ANALYST
MODERATOR
SALES_MANAGER
OPERATOR
```

External roles:

```text
PARTNER
BUYER
```

Step 1.6 не должен автоматически давать PARTNER/BUYER доступ ко всему `/app/*`.

Если Partner Cabinet/Buyer Cabinet routes уже существуют, не смешивай их с internal employee Work Centers.

Future boundaries:

```text
/partner/*
/account/*
```

или существующий canonical equivalent.

---

## 12. Authenticated redirect behavior

Определи предсказуемое поведение:

- anonymous открывает `/` → остаётся Marketplace;
- internal authenticated user открывает `/` → Marketplace всё равно доступен;
- internal user выбирает «Рабочая область» → `/app/dashboard`;
- anonymous открывает `/app/...` → login/403 flow;
- authenticated BUYER не отправляется автоматически в internal Dashboard;
- PARTNER не отправляется автоматически в internal Dashboard.

Не превращай `/` в role-dependent route.

---

## 13. Layout separation

Создать/использовать отдельные layouts:

```text
PublicLayout
InternalAppLayout
```

PublicLayout:

- marketplace header;
- logo;
- categories/search entry;
- locale selector;
- login/account entry;
- public footer.

InternalAppLayout:

- internal header;
- breadcrumbs;
- sidebar/work-center navigation;
- notifications/actions;
- user/internal context.

Не тащи internal sidebar в public bundle/layout без необходимости.

---

## 14. Navigation

Public navigation должна вести только на public-safe routes.

Internal navigation должна использовать `/app/*`.

Проверить:

- breadcrumbs;
- sidebar items;
- logo click;
- back links;
- deep links;
- refresh on nested route.

Не оставлять hardcoded старые internal URLs.

---

## 15. API client separation

Разделить public/internal API usage логически.

Public pages используют только public Catalog API.

Нельзя:

```text
Public page
→ attach privileged JWT
→ call internal Catalog API
```

Даже если пользователь залогинен, Marketplace representation должен использовать public contract.

Internal pages продолжают использовать authenticated APIs.

---

## 16. SSR / Server Components / hydration

Следуй существующей Next.js architecture.

Не переводить весь frontend на новый rendering paradigm без необходимости.

Public pages должны быть пригодны для будущего SEO/server rendering.

Не делай критический public content исключительно after-mount client fetch, если текущий stack позволяет server-side fetch.

Полный SEO — позже, но architecture не должна его блокировать.

---

## 17. Localization

Сохранить RU/AZ/EN architecture.

Public routes и labels локализуются существующим механизмом.

Не использовать translated product/category labels как technical slug/ID.

Если locale prefix уже существует:

```text
/ru/...
/az/...
/en/...
```

не ломать его.

Если нет — не вводить новую URL locale architecture без отдельного требования.

---

## 18. Error states

Public:

- Product not found/unpublished → neutral 404;
- public API unavailable → public-safe error state;
- empty search → empty-state, не internal error dump.

Internal:

- unauthenticated → login;
- forbidden → 403/permission state;
- missing Work Center → controlled 404/not implemented.

---

## 19. Loading states

Разделить public/internal loading UX.

На Step 1.6 достаточно корректных:

```text
loading
error
empty
not-found
```

для public shell/search/PDP routes.

Не тратить шаг на финальную визуальную полировку.

---

## 20. Legacy frontend preservation

Не удалять работающие компоненты:

- auth;
- tours/catalog;
- bookings;
- payments;
- chat;
- reviews;
- profile;
- dashboard;
- localization.

Сначала перенести/адаптировать routes.

Legacy feature может позже мигрировать в другой domain, но Step 1.6 — не место для удаления.

---

## 21. Security

Проверить:

- anonymous `/app/*`;
- BUYER `/app/*`;
- PARTNER `/app/*`;
- direct nested route;
- client-side route transition;
- hard refresh;
- server rendering;
- JWT leakage into public responses;
- internal API usage from public pages.

Public HTML/JSON не должен содержать internal permissions/session secrets.

---

## 22. Performance

Не загружать internal app bundle целиком на public `/`, если routing architecture позволяет разделение.

Публичный shell должен быть lightweight.

Не делать premature optimization, но проверить очевидные cross-layout imports.

---

## 23. Tests

Минимально доказать:

1. `/` доступен anonymous;
2. `/` не показывает internal Dashboard;
3. `/search` доступен anonymous;
4. `/products/:slug` использует public API;
5. unpublished Product → 404;
6. `/categories/:slug` работает;
7. public pages не вызывают internal `/products`;
8. `/app/dashboard` требует auth;
9. anonymous `/app/dashboard` → auth boundary;
10. BUYER не получает internal Dashboard;
11. PARTNER не получает employee Work Centers;
12. internal ADMIN route работает;
13. internal OPERATOR route работает по permissions;
14. старый Dashboard route redirect/migration работает согласно map;
15. internal sidebar links используют `/app/*`;
16. public header links не ведут на internal routes;
17. deep link `/app/...` survives refresh;
18. locale behavior не сломан;
19. public API error → public error state;
20. regression frontend tests зелёные;
21. backend regression Step 1.5 остаётся зелёным, если frontend test environment вызывает backend.

---

## 24. Не делать в Step 1.6

Не реализовывать:

```text
final Marketplace visual design
full homepage sections
full PDP design
checkout
cart
payment
Sales
OrderRequested
Booking changes
Partner Cabinet full
Buyer Cabinet full
reviews
recommendations
SEO/sitemap
marketing pages
```

---

## 25. Definition of Done

Step 1.6 завершён только если:

- `/` = public Marketplace shell;
- `/search`, `/products/:slug`, `/categories/:slug` существуют;
- public routes anonymous;
- public pages используют Step 1.5 API;
- `/app/*` = internal application;
- internal routes auth/RBAC protected;
- PublicLayout и InternalAppLayout разделены;
- old internal routes безопасно migrated/redirected;
- internal functionality не потеряна;
- public/internal navigation разделена;
- localization сохранена;
- security tests зелёные;
- frontend typecheck/build/tests зелёные;
- backend regression не сломан.

---

## 26. После выполнения

Предоставь:

1. current→target route map;
2. список изменённых файлов;
3. public route tree;
4. internal `/app/*` route tree;
5. layout architecture;
6. auth middleware changes;
7. role boundary behavior;
8. public/internal API client separation;
9. redirects;
10. localization impact;
11. preserved legacy pages/features;
12. security tests;
13. frontend tests;
14. frontend typecheck/build;
15. backend regression status;
16. git diff summary;
17. найденные проблемы;
18. `ARCHITECTURE DECISION REQUIRED`, если есть.

Не переходи к Step 1.7 автоматически.

Финальная строка строго:

```text
PHASE 1 STEP 1.6 COMPLETED — WAITING FOR REVIEW
```
