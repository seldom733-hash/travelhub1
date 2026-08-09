# PHASE 1 — STEP 1.9: BUYER IDENTITY & PUBLIC-TO-AUTHENTICATED TRANSITION

## Статус входа

Steps 1.0–1.8 — APPROVED.

Начни только **PHASE 1 — STEP 1.9: Buyer Identity & Public-to-Authenticated Transition**.

Не начинай checkout, cart, Payment/PSP, split payment, Sales, OrderRequested, Booking creation, Buyer Cabinet full, Partner Finance или Settlement/Payout.

## 1. Цель

Обеспечить корректный переход anonymous посетителя Marketplace в authenticated BUYER без потери контекста.

```text
Anonymous Marketplace
→ Product/Search
→ Login/Register
→ BUYER authenticated
→ return to original public context
→ future Buyer actions
```

BUYER остаётся внешней ролью и не получает `/app/*` или `/partner/*`.

## 2. Аудит перед изменениями

Покажи:
- login/register flows;
- User model;
- BUYER role;
- session/token handling;
- `/auth/me`;
- redirect logic;
- `safeNextPath`;
- PublicLayout account state;
- profile/account routes;
- registration validation;
- existing Buyer/Customer mapping.

Не создавай вторую auth system.

## 3. Buyer boundary

BUYER:
- public Marketplace read;
- own account/profile;
- future own Orders/Bookings/Payments/Documents/Support;
- no internal Work Centers;
- no Partner Cabinet;
- no internal Catalog permissions.

## 4. Registration

Public self-registration создаёт только BUYER.

Минимум:
```text
email
password
firstName
lastName
locale?
phone? if modeled
required consents if modeled
```

Client не может передать произвольную role.

## 5. Login

После login:
- session/token valid;
- `/auth/me` → BUYER;
- safe `next` возвращает к исходному public route;
- без `next` → `/`;
- BUYER никогда не уходит в `/app/dashboard`.

## 6. Safe return context

Поддержать:
```text
/products/tour-x
→ /login?next=/products/tour-x
→ login
→ /products/tour-x
```

Аналогично `/search?...` и `/categories/...`.

`next` только same-origin relative path.

Блокировать:
- `//evil.com`
- encoded slash bypass
- protocol URLs
- `javascript:` / `data:`
- malformed path tricks

Переиспользовать/harden existing `safeNextPath`.

## 7. Registration context

Registration также сохраняет safe `next` и locale. После успешной регистрации пользователь возвращается к исходному public context.

## 8. PublicLayout account state

Anonymous:
```text
Login
Register
```

BUYER:
```text
Account
Logout
```

Internal employee:
```text
Marketplace
Work Area
Account/Logout
```

PARTNER:
```text
Marketplace
Partner Cabinet
Account/Logout
```

## 9. Account foundation

Создать минимум:
```text
/account
/account/profile
```

Это identity/profile foundation, не полный Buyer Cabinet.

## 10. Profile

BUYER читает/обновляет только свои разрешённые поля.

Нельзя менять:
- role;
- permissions;
- partnerId;
- internal status fields;
- чужой userId.

Backend actor context authoritative.

## 11. Buyer ↔ Customer mapping

Если mapping BUYER→CRM Customer уже существует — переиспользовать.

Если отсутствует и требует архитектурного решения:
```text
ARCHITECTURE DECISION REQUIRED
```

Не создавать дубли Customer молча.

## 12. Account states

Соблюдать существующие:
```text
ACTIVE
INACTIVE
SUSPENDED
```

Inactive/suspended BUYER не должен сохранять действующий доступ.

Если email verification уже существует — интегрировать. Не вводить нового mail provider в этом шаге.

## 13. Session/logout

Logout:
- очищает auth;
- очищает cached user state;
- не сбрасывает locale/search без необходимости;
- возвращает на public context.

Network abort/non-401 не должен разлогинивать валидного пользователя. Сохранить исправление Step 1.8.

## 14. RBAC

BUYER не получает:
```text
catalog.product.read
catalog.category_schema.read
moderation.*
partner.*
internal users/admin permissions
```

Public Catalog остаётся отдельным `@Public` contract.

Own-profile permissions — granular own-scope.

## 15. Route gates

Проверить:
- anonymous `/account/*` → login + safe next;
- BUYER `/account/*` allowed;
- BUYER `/app/*` denied;
- BUYER `/partner/*` denied;
- PARTNER/internal behaviour не сломан.

## 16. Localization

RU/AZ/EN для:
- login;
- register;
- account/profile;
- validation;
- auth errors;
- inactive/suspended states;
- logout.

Locale сохраняется через auth roundtrip.

## 17. Security

Проверить:
- role injection;
- mass assignment;
- forged userId;
- forged partnerId;
- direct profile IDOR;
- open redirect;
- token leakage;
- stale cached session;
- inactive user;
- logout correctness.

## 18. Tests

Минимум:

1. anonymous регистрирует BUYER;
2. нельзя зарегистрироваться как ADMIN;
3. нельзя зарегистрироваться как PARTNER;
4. duplicate email rejected;
5. BUYER login success;
6. `/auth/me` → BUYER;
7. safe next к Product сохраняется;
8. `/search?...` next сохраняется;
9. external next rejected;
10. encoded slash attack rejected;
11. locale сохраняется;
12. anonymous `/account` → login;
13. BUYER `/account` allowed;
14. BUYER `/app/*` denied;
15. BUYER `/partner/*` denied;
16. internal Catalog API denied;
17. own profile read;
18. чужой profile denied;
19. own profile update;
20. role change denied;
21. permission change denied;
22. partnerId set denied;
23. inactive BUYER denied;
24. logout clears auth but preserves locale;
25. network abort не logout'ит;
26. Marketplace anonymous regression green;
27. Partner Cabinet regression green;
28. internal app regression green;
29. RU/AZ/EN auth UI;
30. frontend build/typecheck/tests green;
31. backend regression green.

## 19. Не делать

Не реализовывать:
```text
full Buyer Cabinet
checkout
cart
Payment
PSP
split payment
Order
Booking
Buyer documents
Buyer support history
Reviews/Ratings
wishlist/favorites
loyalty
```

## 20. Definition of Done

- BUYER registration/login;
- safe public return context;
- `/account/*` foundation;
- own-scope profile;
- `/app/*` and `/partner/*` denied;
- no internal Catalog permissions;
- locale preserved;
- safe session/logout;
- security tests green;
- frontend tests/build/typecheck green;
- backend regression green.

## 21. После выполнения

Предоставь:
1. changed files;
2. registration flow;
3. login flow;
4. safe-next implementation;
5. `/account/*` routes;
6. profile API/model;
7. Buyer RBAC;
8. middleware/gates;
9. Customer mapping status;
10. i18n;
11. security;
12. frontend tests;
13. Playwright/browser tests;
14. backend tests;
15. typecheck/build;
16. regressions;
17. git diff summary;
18. issues;
19. `ARCHITECTURE DECISION REQUIRED`, if any.

Не переходи к Step 1.10 автоматически.

Финальная строка строго:

```text
PHASE 1 STEP 1.9 COMPLETED — WAITING FOR REVIEW
```
