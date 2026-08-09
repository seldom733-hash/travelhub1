# PHASE 1 — STEP 1.13: BUYER CABINET FOUNDATION

## 0. Контекст

Step 1.12.3 APPROVED.

Authoritative решения, которые уже существуют и НЕ должны переопределяться:

- BUYER registration/login;
- обязательный Buyer ↔ CRM Customer mapping через `User.customerId`;
- own account/profile contract;
- ADR-0003 — узкая Security ↔ CRM orchestration для Buyer registration;
- public Marketplace / Product / Storefront routing;
- Product publication channels;
- Marketplace vs Storefront commercial boundary;
- acquisition source foundation;
- Storefront behavioral events;
- Partner Cabinet;
- Partner onboarding;
- Moderation;
- Public Catalog;
- RU/AZ/EN UI foundation;
- canonical Sales/Order/Booking/Finance commercial flow будет реализовываться в Phase 2.

Этот Step — **Buyer Cabinet Foundation**, а не начало Phase 2 commercial flow.

Не переходить к Step 1.13A / 1.13B / 1.14 или Phase 2.

## 1. Цель

Создать полноценный безопасный Buyer Cabinet shell и read-model foundation для будущих:

- Orders;
- Bookings;
- Payments;
- Documents;
- Support;
- purchase timeline.

Но если соответствующие canonical домены/данные ещё не существуют — не придумывать их и не создавать fake business logic.

Cabinet должен:
1. показывать Buyer собственный профиль;
2. иметь canonical routes/navigation будущих разделов;
3. показывать реальные существующие данные там, где backend уже имеет authoritative ownership;
4. показывать корректные empty/not-available states там, где Phase 2 ещё не реализована;
5. обеспечивать строгий BUYER own-scope;
6. не давать BUYER internal `/app/*` доступ;
7. не использовать CRM Customer как замену Order/Booking/Payment domain.

## 2. Buyer identity source

Security identity:

`security.User`
→ role = BUYER
→ `customerId`

CRM identity:

`crm.Customer`

Важно:

`User.customerId` — ссылка на canonical Buyer customer identity.

Frontend:
- не принимает/не передаёт customerId как security source;
- не выбирает Customer;
- не может читать чужой Customer по ID.

Backend определяет Customer только через authenticated actor.

Не расширять ADR-0003 на новые cross-domain writes без отдельного ADR.

## 3. Buyer Cabinet routing

Создать canonical buyer tree:

- `/account`
- `/account/profile`
- `/account/orders`
- `/account/bookings`
- `/account/payments`
- `/account/documents`
- `/account/support`

Допустима дополнительная:
- `/account/activity` или `/account/timeline`

только если она строится из реальных существующих facts/events, а не mock data.

Не использовать `/app/*` для BUYER.

Anonymous `/account/*`
→ `/login?next=...`

PARTNER:
→ не получает Buyer Cabinet как BUYER.

Internal roles:
→ сохраняют internal routing rules.

BUYER:
→ `/account/*`.

## 4. Buyer Cabinet layout

Создать отдельный `BuyerAccountLayout`.

Минимум:
- account navigation;
- current Buyer summary;
- locale selector;
- logout;
- mobile navigation;
- loading/error states.

Не переиспользовать internal `Shell` таким образом, чтобы BUYER увидел internal menus.

Не показывать Partner Cabinet nav.

## 5. Account overview

`/account` должен быть полезным даже до Phase 2.

Показывать только реальные доступные данные:

- Buyer name;
- account/customer code, если безопасно;
- profile completeness;
- email/profile information согласно own profile contract;
- будущие purchase sections как real counters только если authoritative data уже существует.

Если Orders/Bookings/Payments canonical flow ещё не существует:
- не показывать выдуманные KPI;
- не создавать fake counters;
- использовать neutral empty state:
  - «Заказов пока нет»
  - «Бронирований пока нет»
  - «Платежей пока нет»

Не создавать data fixtures в production code.

## 6. Profile

`/account/profile`

Использовать существующий own-scope account/profile API.

Проверить:
- User fields vs Customer business/profile fields;
- email synchronization rules;
- forbidden keys;
- role/customerId/status cannot be forged;
- BUYER A не читает/не изменяет BUYER B.

Не создавать отдельную параллельную profile entity.

## 7. Orders read-model foundation

`/account/orders`

Ключевой принцип:

Buyer Cabinet **не владеет Order**.

Если существующий Order domain уже имеет legacy/canonical records, сначала определить:
- что реально authoritative;
- есть ли безопасная Buyer linkage;
- можно ли read-only показать существующие данные без закрепления неправильной модели.

Не создавать новый Order lifecycle.

Не создавать Order из Buyer Cabinet.

Не использовать `/orders/bootstrap`.

Если canonical Buyer-owned Order read contract ещё отсутствует:
- создать только безопасный read-model/API contract, который возвращает реальные существующие records, если связь доказуема;
- либо оставить controlled empty/not-yet-available state.

Никаких direct CRM → Order writes.

## 8. Bookings read-model foundation

`/account/bookings`

Booking ownership остаётся Booking domain.

Buyer видит только свои future/current bookings через доказанную Customer/Order/Traveler relation.

Не создавать Booking из frontend.

Не вводить `BookingRequested` раньше Step 2.x.

Не менять Booking lifecycle.

Если текущие legacy Bookings нельзя безопасно связать с Buyer:
- не угадывать ownership;
- не показывать их;
- документировать gap.

## 9. Payments read-model foundation

`/account/payments`

Finance domain ещё не должен преждевременно расширяться.

Не реализовывать:
- PSP;
- payment intent;
- charge;
- refund engine;
- commission;
- settlement;
- payout.

Если legacy Payments существуют:
- определить, являются ли они пригодными для safe Buyer read;
- не объявлять legacy Payment canonical Finance model только ради UI.

Buyer payment page может быть empty-state foundation до Phase 2.

Никогда не показывать:
- PSP secrets;
- provider credentials;
- raw card data;
- Partner payout data;
- internal finance notes.

## 10. Documents read-model foundation

`/account/documents`

Показывать только документы, которые:
- принадлежат/доступны Buyer;
- связаны с реальными Order/Booking/Payment/Support contexts;
- прошли соответствующие access rules.

Если Documents domain ещё не завершён:
- route/layout/empty state допустим;
- не создавать fake voucher/invoice.

## 11. Support foundation

`/account/support`

Не реализовывать полноценный Support domain раньше Phase 3.

Допустимо:
- entry point;
- список существующих Buyer-visible communications/tickets только если canonical entity уже есть;
- empty state;
- CTA «Связаться с поддержкой» только если реальный безопасный flow уже существует.

Не использовать legacy chat fragments как новый canonical Support model без решения.

## 12. Buyer purchase timeline

Не строить fake timeline.

Timeline допустим только из реальных:
- Order events/timestamps;
- Booking events/timestamps;
- Payment events/timestamps;
- Refund;
- Documents;
- Support.

Поскольку Phase 2 ещё не реализована полностью, сейчас:
- можно создать interface/placeholder read contract;
- нельзя reconstruct историю из `updatedAt`;
- нельзя создавать synthetic events.

Полноценная timeline — Step 2.16A.

## 13. Temporal readiness

Buyer Cabinet должен отображать business timestamps только если они имеют canonical meaning.

Не использовать:
- `updatedAt` как «дата заказа»;
- `updatedAt` как «дата оплаты»;
- Product.createdAt как «дата покупки».

Разделять:
- entity created time;
- Order submitted/confirmed;
- Booking requested/confirmed;
- service date/time;
- Payment authorized/captured;
- Refund processed.

Если нужных timestamps ещё нет — показывать меньше данных, а не угадывать.

Все даты форматируются locale-aware.

Backend semantics — UTC; service date/time позже учитывает IANA timezone.

## 14. Object scope / IDOR

BUYER scope должен быть server-side.

Проверить минимум:

- Buyer A не читает profile B;
- Buyer A не читает Order B;
- Buyer A не читает Booking B;
- Buyer A не читает Payment B;
- Buyer A не читает Document B;
- Buyer A не читает Support B;
- forged customerId rejected/ignored;
- forged userId rejected/ignored;
- URL ID другого Buyer → neutral 404/403 согласно contract.

Frontend не является security boundary.

## 15. RBAC

BUYER не получает internal permissions «для удобства UI».

Если нужны новые rights — только узкие buyer-own permissions.

Например концептуально:
- `account.profile.read_own`
- `account.profile.update_own`
- `account.order.read_own`
- `account.booking.read_own`
- `account.payment.read_own`
- `account.document.read_own`
- `account.support.read_own`

Названия адаптировать к текущей permission matrix.

Не давать BUYER:
- internal CRM read;
- Partner data access;
- moderation;
- catalog internal write;
- finance internal rights.

## 16. Public → authenticated transition

Сохранить deep-link behavior.

Примеры:

Anonymous:
`/account/orders`
→ `/login?next=/account/orders`
→ login BUYER
→ `/account/orders`

Anonymous с Product:
`/products/:slug`
→ login
→ safe `next` возвращает в исходный public context, если flow это предусматривает.

Продолжить защиту от open redirect / encoded slash.

## 17. Marketplace / Storefront independence

Buyer Cabinet не должен менять behavior public Marketplace/Storefront.

Logged-in BUYER:
- public Marketplace использует public API;
- public Storefront использует public API;
- наличие token не должно заставлять public pages переходить на internal endpoints.

Storefront behavioral tracking остаётся без Authorization.

## 18. Acquisition source boundary

Step 1.12.3 уже создал Storefront behavioral source context.

Buyer Cabinet сейчас не должен:
- определять salesChannel постфактум;
- записывать `MARKETPLACE`/`PARTNER_STOREFRONT` в Order, которого ещё нет;
- создавать conversion facts.

Если future read model показывает acquisition source — только если authoritative source реально сохранён соответствующим будущим commercial flow.

## 19. CRM Customer privacy

CRM Customer может содержать данные, не предназначенные для self-service Buyer UI.

Создать whitelist projection.

Не сериализовать raw `crm.Customer`.

Не показывать:
- CRM notes;
- internal tags;
- internal manager;
- internal segmentation;
- risk/fraud notes;
- Partner-specific CRM relationship data;
- internal audit fields.

Buyer Account Profile ≠ internal CRM Customer 360° view.

## 20. Future Partner CRM boundary

Не создавать `PartnerCustomerRelationship` в этом Step.

Не давать BUYER доступ к Partner CRM notes/tags/tasks.

Buyer Cabinet и будущий Partner CRM — разные projections одного/связанных customer contexts.

ADR-0007 boundary сохраняется.

## 21. i18n RU/AZ/EN

Все Buyer Cabinet system strings:
- navigation;
- statuses;
- empty states;
- actions;
- validation;
- dates;
- error messages

локализовать RU/AZ/EN.

Не реализовывать DD-001 multilingual Product content.

Product/Order/Booking textual business content показывается согласно существующим contracts/fallbacks, без нового translation system.

## 22. Accessibility / responsive

Обязательно:
- desktop/tablet/mobile;
- keyboard;
- focus states;
- semantic headings;
- labels;
- screen-reader friendly status text;
- tables/cards adaptive;
- long IDs/statuses/dates;
- loading skeletons;
- no horizontal overflow.

## 23. Security

Проверить:
- auth gate `/account/*`;
- role gate BUYER;
- object scope;
- no raw CRM;
- no internal DTO leakage;
- no admin/partner/internal menus;
- XSS-safe rendering;
- safe links;
- error responses без чужих IDs/PII;
- session handling;
- AbortError/network failures не разлогинивают;
- 401 semantics корректны.

## 24. Backend API strategy

Не создавать огромный «buyer-dashboard» endpoint, который соединяет все домены прямыми cross-schema joins без ownership boundary.

Предпочтительно:
- собственные domain read APIs;
- application/read-model composition;
- read by canonical IDs;
- explicit projection.

Если для Buyer overview нужен composite read model — он должен быть read-only и не становиться владельцем Order/Booking/Finance data.

Если существующая архитектура не позволяет это без нарушения ADR:
`ARCHITECTURE DECISION REQUIRED`.

## 25. No fake data principle

Запрещено:
- hardcoded Orders;
- fake Bookings;
- fake Payment history;
- synthetic timeline;
- generated statistics ради красивого UI.

Empty state лучше fake feature.

Browser smoke fixtures допустимы только в isolated test/dev и удаляются после проверки.

## 26. Deferred Decisions compliance

Не реализовывать решения DD-001…DD-020.

Особенно:
- Product translations;
- AI translation;
- Storefront Trial;
- plans/pricing;
- billing;
- recurring;
- Partner CRM entitlements;
- analytics matrix;
- commission;
- custom domains.

Если Buyer Cabinet вскрывает новый вопрос, который сознательно лучше отложить:
- не решать самовольно;
- указать candidate для следующего `DD-021+`.

## 27. Required backend tests

Минимум:

1. anonymous `/account/*` → 401/backend gate;
2. BUYER own profile 200;
3. forged customerId rejected;
4. BUYER A cannot read B;
5. PARTNER denied Buyer-only endpoint;
6. MODERATOR/internal role behavior explicit;
7. account projection excludes CRM internal fields;
8. Orders own-scope;
9. Bookings own-scope;
10. Payments own-scope;
11. Documents own-scope;
12. Support own-scope;
13. no fake data;
14. temporal fields not reconstructed from updatedAt;
15. role/permission matrix;
16. regression existing buyer-identity;
17. public Marketplace regression;
18. Storefront regression.

Если domain data ещё не существует — тестировать controlled empty contract, а не invent records.

## 28. Required frontend tests

Минимум:

1. BuyerAccountLayout;
2. nav;
3. anonymous redirect;
4. BUYER access;
5. PARTNER denied/redirect;
6. profile render/edit;
7. profile validation;
8. orders empty/loading/error;
9. bookings empty/loading/error;
10. payments empty/loading/error;
11. documents empty/loading/error;
12. support empty/loading/error;
13. RU/AZ/EN;
14. safe next/deep links;
15. network abort does not logout;
16. public pages still no internal API;
17. responsive nav;
18. accessibility smoke.

## 29. Browser verification

Production-equivalent browser scenarios:

A. anonymous `/account` → login with safe next;  
B. BUYER login → `/account`;  
C. profile data = own Customer projection;  
D. edit profile persists;  
E. Orders page renders real/empty state without fake data;  
F. Bookings page same;  
G. Payments page same;  
H. Documents page same;  
I. Support page same;  
J. BUYER direct `/app/dashboard` denied/redirected;  
K. BUYER direct `/partner/storefront` denied/redirected;  
L. PARTNER direct `/account` denied/redirected;  
M. public Marketplace while BUYER logged in still uses public API;  
N. public Storefront while BUYER logged in still uses public API and behavioral no-auth tracking;  
O. RU → AZ → EN;  
P. mobile navigation;  
Q. refresh/deep link;  
R. no console errors happy-path.

## 30. Regression

Backend:
- `tsc --noEmit`;
- unit;
- buyer-identity;
- auth/RBAC;
- partner onboarding/cabinet;
- public catalog;
- storefront;
- behavioral events;
- product scope/media;
- moderation;
- full serial e2e.

Frontend:
- `tsc --noEmit`;
- vitest;
- production build;
- browser smoke.

Migration:
- только если schema реально меняется;
- `migrate deploy`;
- clean replay;
- no drift;
- no db push.

## 31. Explicit out of scope

НЕ начинать:

- Sale;
- Quote;
- Checkout;
- Cart;
- canonical Order creation;
- Booking creation/change;
- Payment intent/PSP;
- Refund;
- Commission;
- Settlement;
- Payout;
- Partner Finance;
- full Documents domain;
- full Support domain;
- buyer purchase timeline from synthetic data;
- Marketplace-wide behavioral events Step 1.13B;
- temporal mass-refactor Step 1.13A;
- Order events Step 1.14;
- correlation infrastructure Step 1.15;
- Partner CRM;
- analytics engine.

## 32. Architecture decision triggers

Вернуть `ARCHITECTURE DECISION REQUIRED`, если для Step нужно:

- писать Security напрямую в CRM вне ADR-0003;
- писать Buyer Cabinet в Order/Booking/Finance schemas;
- создавать новый canonical Order/Booking/Payment model;
- объявлять legacy entity canonical без reconciliation;
- давать BUYER internal CRM access;
- смешивать Buyer Account и Partner CRM;
- строить giant cross-domain owned model;
- вводить Sales/Payment lifecycle раньше Phase 2.

## 33. Definition of Done

Step 1.13 завершён только если:

- `/account/*` имеет отдельный Buyer Cabinet layout;
- authenticated BUYER own-scope;
- profile работает через canonical Buyer/Customer mapping;
- Orders/Bookings/Payments/Documents/Support routes существуют;
- показываются только реальные безопасные данные либо честные empty states;
- fake commercial data отсутствует;
- никакой преждевременной Phase 2 logic;
- object scope/IDOR закрыт;
- CRM internals не утекли;
- public Marketplace/Storefront boundaries не сломаны;
- RU/AZ/EN;
- responsive/accessibility baseline;
- temporal semantics не подделаны;
- regression green;
- Step 1.13A/1.13B не начаты.

## 34. Формат отчёта

Вернуть:

# PHASE 1 — STEP 1.13 — ОТЧЁТ

1. Current → Target mapping
2. Architecture/read-model strategy
3. Buyer identity/Customer projection
4. Route tree
5. BuyerAccountLayout
6. Account overview
7. Profile
8. Orders foundation
9. Bookings foundation
10. Payments foundation
11. Documents foundation
12. Support foundation
13. Timeline decision
14. RBAC/object scope/IDOR
15. Public→auth transition
16. Marketplace/Storefront isolation
17. Temporal semantics
18. RU/AZ/EN
19. Accessibility/responsive
20. Backend tests
21. Frontend tests
22. Browser verification
23. Full regression
24. Migration status
25. Issues found
26. Deferred Decisions candidates
27. Out-of-scope confirmation
28. ARCHITECTURE DECISION REQUIRED

Не переходить к Step 1.13A / 1.13B / 1.14.

Финальная строка:

`PHASE 1 STEP 1.13 COMPLETED — WAITING FOR REVIEW`
