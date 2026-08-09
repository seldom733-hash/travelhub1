# PHASE 1 — STEP 1.13 — STRICT IMPLEMENTATION REVIEW

## Роль

Выполни строгий code/architecture/security review уже реализованного PHASE 1 — STEP 1.13: BUYER CABINET FOUNDATION.

Это не следующий implementation step. Не переходить к Step 1.13A / 1.13B / 1.14 / Phase 2.

Проверяй фактический код, Prisma schema, RBAC matrix, controllers/services, frontend routes/layouts, DTO/projections, e2e, browser behavior и действующие ADR. Не считать implementation report доказательством сам по себе.

## 1. Главные риски

Step 1.13 впервые одновременно:
- даёт BUYER чтение реальных Order;
- даёт BUYER чтение реальных Booking;
- отзывает широкие internal permissions;
- добавляет buyer-own permissions;
- создаёт account read-models поверх Order/Booking data;
- начинает отображать legacy Order/Booking fields;
- вводит empty contracts для Payments/Documents/Support.

Доказать, что это не закрепило неправильную legacy-модель, не нарушило ownership, не создало IDOR и не протащило Phase 2 semantics раньше времени.

## 2. Buyer identity

Проверить authoritative chain:
`authenticated security.User → BUYER → customerId → crm.Customer`.

- customerId только из actor;
- forged customerId/userId не меняют scope;
- Buyer без customerId controlled deny;
- broken customer reference не приводит к чужим данным;
- inactive User denied;
- никаких новых Security→CRM writes вне ADR-0003.

## 3. CRM Customer projection

Проверить whitelist. Не должны утекать CRM notes, tags, manager, segmentation, fraud/risk, audit, Partner-specific relationship data, internal IDs/actors. Raw Prisma Customer не сериализовать.

## 4. RBAC matrix — критично

Доказать, что BUYER больше не имеет:
- `crm.customer.read`
- `order.read`
- `booking.read`
- `finance.payment.read`

и что reconciliation не выдаёт их обратно.

BUYER не должен иметь доступ к:
- `/customers`;
- internal Orders;
- internal Bookings;
- internal Finance/Payment.

Новые own permissions не должны случайно открывать internal controllers.

## 5. ADMIN behavior

Отчёт заявляет `ADMIN → controlled empty (customerId=null)`.

Проверить policy. Если account endpoints по design BUYER-only, ADMIN должен получать explicit 403, а не «пусто» из-за отсутствия customerId. Если current behavior маскирует role-gate bug — REVIEW FIX REQUIRED.

## 6. Orders ownership

Проверить `GET /api/v1/account/orders`.

- server-side predicate `Order.customerId == actor.customerId`;
- никакой post-filter после загрузки;
- никаких writes в Order schema;
- никакого giant cross-domain aggregate;
- чужие/null/broken customerId records не выдаются.

## 7. Order projection semantics

Projection заявлен:
`id, code, number, status, paymentStatus, currency, amount, serviceDate, createdAt, items`.

Проверить, какие поля реально canonical сегодня.

Особенно:
- `paymentStatus` не подменяет будущий Finance Payment;
- `amount` не считается будущим immutable financial snapshot;
- `serviceDate` не подменяет будущие `serviceStartsAt/serviceEndsAt/timezone`;
- currency source понятен;
- items не содержат internal data.

Legacy/display-only semantics должны быть явно задокументированы.

## 8. Orders pagination — отдельный review checkpoint

Сейчас `take:100` без pagination.

Проверить:
- нет silent truncation;
- UI не делает вид, что показывает все заказы;
- API сообщает корректный `total/hasMore` либо имеет минимальную safe pagination;
- hidden cap не становится permanent contract.

Если >100 записей молча теряются — REVIEW FIX REQUIRED.

## 9. Bookings ownership

Проверить:
`Booking.orderId → Order.customerId == actor.customerId`.

- scope server-side;
- orphan/chужой Booking не выдаётся;
- нет N+1;
- BUYER не получает internal Booking endpoints.

## 10. Booking projection semantics

Проверить amount/currency/serviceDate/status/createdAt. Currency из Order не должна закреплять будущую Finance semantics. Если это display fallback — так и задокументировать.

## 11. Payments empty contract

Проверить, что `/account/payments`:
- не читает legacy Payment;
- не создаёт Finance semantics;
- возвращает явный `{items:[], total:0, available:false}`;
- не раскрывает provider/PSP data;
- own permission не открывает internal Finance controller.

## 12. Documents empty contract

Никаких fake vouchers/invoices. Не объявлять legacy files canonical Documents.

## 13. Support empty contract

Legacy Chat не становится Support. Никаких fake ticket/CTA flows.

## 14. Overview counters

- counters scoped по customerId;
- count predicate совпадает с list;
- сбой одного counter не ломает profile;
- нет fake KPI;
- нет неоправданных scans/N+1.

## 15. No fake data

Проверить production/frontend code на hardcoded Orders/Bookings/Payments/KPI/timeline.

## 16. Temporal semantics

Не использовать `updatedAt` как order/payment/booking date.

Проверить честные labels для:
- Order.createdAt;
- Booking.createdAt;
- serviceDate.

Не строить timeline из current status.

## 17. IDOR abuse matrix

Проверить:
1. Buyer A profile B
2. Buyer A Order B
3. Buyer A Booking B
4. forged customerId query/body
5. forged userId
6. PARTNER/MODERATOR/ADMIN
7. anonymous
8. BUYER without customerId
9. broken customer ref
10. inactive BUYER
11. BUYER `/customers`
12. BUYER internal Orders
13. BUYER internal Bookings
14. BUYER internal Payments
15. errors не раскрывают чужие IDs/PII

## 18. Route gates

Проверить:
- anonymous `/account/*` → login?next
- BUYER → account
- PARTNER → partner
- internal → app
- BUYER `/app/*` denied
- BUYER `/partner/*` denied
- PARTNER `/account/*` denied
- deep links + refresh.

## 19. Safe next

Повторно проверить open redirect, encoded slash, protocol-relative URL, nested encoding.

## 20. Marketplace / Storefront isolation

Logged-in BUYER на Marketplace/Product/Category/Storefront всё ещё использует public API. Authorization/internal account API не должны утекать.

## 21. Storefront behavioral regression

Step 1.13 не должен ломать Step 1.12.3:
- tracking без Authorization;
- anonymous session;
- StorefrontViewed/ProductViewed/ContactClicked;
- BUYER login не меняет public tracking contract.

## 22. Partner CRM boundary

`PartnerCustomerRelationship` не реализован, global Customer не загрязнён Partner-specific fields, `/app/crm` не переиспользован как Buyer backend.

## 23. Permissions reconciliation

Так как schema migration нет:
- clean DB;
- existing DB со stale permissions;
- restart reconciliation;
- revoked BUYER permissions исчезают;
- новые permissions появляются;
- PARTNER/MODERATOR не загрязнены.

## 24. Error/status contract

401/403/404/400/422 должны быть controlled. Никаких raw Prisma/500 на обычном bad input.

## 25. Performance

Проверить indexes для `Order.customerId`, `Booking.orderId`, bounded queries, no N+1, no full graph fetch.

## 26. Frontend correctness

Проверить BuyerAccountLayout, loading/partial failures/401/403/404/mobile nav/active nav/logout/locale/profile/empty states/cache isolation/AbortError.

## 27. Payments/Documents/Support page tests — обязательный fix-check

В отчёте сказано, что unit/component tests страниц Payments/Documents/Support отсутствуют.

Добавить минимум tests на:
- loading;
- controlled empty;
- error;
- `available:false`;
- localization;
- no fake content.

Browser smoke не является достаточным единственным proof для новых routes.

Если этих tests реально нет — REVIEW FIX REQUIRED.

## 28. RU/AZ/EN + accessibility

Проверить nav/headings/status labels/empty states/errors/date formatting/persistence, semantic nav/headings/table headers/mobile cards/keyboard/focus/aria/no overflow.

## 29. Deferred Decisions candidates

Implementation report предложил DD candidates:
- pagination Orders/Bookings;
- Buyer Documents composition;
- Support CTA/channel;
- Booking currency contract.

Не добавлять их автоматически в Deferred Decisions Map. Сначала определить, это реальный product/architecture decision или обычная future implementation work.

## 30. Required backend checks

Запустить фактически:
- `tsc --noEmit`;
- unit;
- buyer-cabinet e2e;
- buyer-identity;
- auth-rbac;
- rbac-actions;
- public catalog;
- storefront;
- storefront behavioral;
- partner onboarding/cabinet;
- product scope/media;
- moderation/change proposal;
- полный serial e2e.

## 31. Required frontend checks

Запустить:
- `tsc --noEmit`;
- vitest;
- production build;
- account layout/profile/orders/bookings/payments/documents/support;
- route/safe-next;
- public API isolation;
- Storefront tracking isolation.

## 32. Browser verification

A. anonymous `/account/orders` → login?next  
B. BUYER deep link restored  
C. profile own data  
D. Buyer A cannot see B  
E. Orders real/empty  
F. Bookings real/empty  
G. Payments controlled empty  
H. Documents controlled empty  
I. Support controlled empty  
J. BUYER `/customers` denied  
K. internal Orders denied  
L. internal Bookings denied  
M. internal Payments denied  
N. BUYER `/app/dashboard` denied  
O. BUYER `/partner/storefront` denied  
P. PARTNER `/account` denied  
Q. logged-in Marketplace remains public API  
R. logged-in Storefront remains public API + behavioral no-auth  
S. RU/AZ/EN  
T. mobile/deep-link/refresh  
U. console errors 0.

## 33. Migration/schema

Подтвердить:
- Prisma schema не менялась;
- hidden migration нет;
- no db push;
- permission changes только seed/reconciliation;
- clean test DB + restart даёт правильную matrix.

## 34. Review outcome

Если всё корректно:

`PHASE 1 STEP 1.13 REVIEW PASSED`

Если найдены подтверждённые проблемы — исправить только их, оформить `FIX N`, повторить regression и вернуть:

`PHASE 1 STEP 1.13 REVIEW FIXES COMPLETED — WAITING FOR APPROVAL`

Если требуется изменение архитектуры:

`ARCHITECTURE DECISION REQUIRED`

Не переходить к следующему Step.

## 35. Финальный review report

Обязательно:
1. verdict
2. modules inspected
3. identity mapping
4. CRM privacy
5. RBAC reconciliation
6. internal permission revocation
7. ADMIN behavior
8. Orders ownership
9. Order projection semantics
10. pagination/truncation
11. Bookings ownership
12. Booking projection semantics
13. Payments/Documents/Support contracts
14. temporal semantics
15. IDOR matrix
16. route gates
17. safe-next
18. Marketplace/Storefront isolation
19. behavioral regression
20. performance/indexes
21. frontend state coverage
22. Payments/Documents/Support page tests
23. RU/AZ/EN/accessibility
24. Deferred candidate assessment
25. full regression
26. fixes
27. remaining debt
28. architecture decision status
29. out-of-scope confirmation

`PHASE 1 STEP 1.13 — STRICT REVIEW START`
