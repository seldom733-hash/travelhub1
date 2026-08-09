# PHASE 1 — STEP 1.8: PARTNER CABINET FOUNDATION

## Статус входа

Steps 1.0–1.7 — APPROVED.

Уже реализовано:
- Catalog Product + Category Schema;
- Product Media;
- PARTNER ownership/object scope;
- Moderation workflow;
- Public Catalog API;
- Public Marketplace routing;
- Public Marketplace UI;
- RU/AZ/EN frontend foundation.

Начни только **PHASE 1 — STEP 1.8: Partner Cabinet Foundation**.

Не начинай Buyer Cabinet, checkout, Payment/PSP, Sales, OrderRequested, Booking changes, Finance settlement/payout implementation или полный Partner Finance Center.

## 1. Цель

Создать рабочий кабинет PARTNER, где партнёр управляет только своими туристическими услугами через уже существующие Catalog/Media/Moderation contracts.

Цепочка:

```text
PARTNER login
→ Partner Cabinet
→ My Products
→ Create / Edit Product
→ Category-specific attributes
→ Tariffs / Availability
→ Product Media
→ Preview
→ Submit for moderation
→ Moderation status / feedback
→ Changes requested → edit → re-submit
```

Не создавать вторую Product model и не обходить Catalog API.

## 2. Сначала аудит

До изменений покажи:
- текущие routes внешних ролей;
- login redirect PARTNER;
- Product API для PARTNER;
- ownership policy;
- Product lifecycle;
- ProductDraft;
- Category Schema endpoints;
- ProductMedia endpoints;
- moderation history/result endpoints;
- Tariff/Availability API;
- auth/session store;
- Step 1.7 i18n foundation;
- reusable frontend components.

## 3. Partner routes

Отдельный внешний контур:

```text
/partner
/partner/products
/partner/products/new
/partner/products/:id
/partner/products/:id/edit
/partner/products/:id/media
/partner/products/:id/moderation
/partner/products/:id/preview
```

PARTNER не должен попадать в employee `/app/*`.

## 4. PartnerLayout

Минимум:
- brand/logo;
- My Products;
- moderation status entry;
- account/profile entry;
- locale selector;
- logout.

Employee Work Centers не показывать.

## 5. Partner overview

`/partner` может показывать:
- My Products total;
- Draft;
- In moderation;
- Changes requested;
- Published;
- Archived.

Только own-scope. Сложную BI/Finance аналитику не делать.

## 6. My Products

`/partner/products`:
- server-side own-scope;
- search;
- lifecycle/moderation filters;
- category;
- sort;
- pagination;
- thumbnail;
- title;
- category;
- status;
- moderation status;
- price summary if available;
- updatedAt;
- allowed actions.

Cross-partner leakage недопустима.

## 7. Create Product

`/partner/products/new`:
- ownership назначает backend из actor context;
- category;
- title;
- short/full description;
- category-specific attributes;
- tariffs/options where supported;
- availability where supported;
- media after initial save or in wizard.

Не доверять `partnerId` из frontend.

## 8. Dynamic Category Schema form

Frontend строит форму по ACTIVE Category Schema.

Поддержать типы:

```text
string
text
number
integer
boolean
date
time
enum
currency
```

Validation:
- required;
- min/max;
- enum;
- pattern where safe;
- client feedback;
- backend authoritative.

Не делать отдельные data models Hotel/Tour/Transfer.

## 9. Edit lifecycle

### DRAFT
Direct edit.

### CHANGES_REQUESTED
Edit + re-submit.

### PUBLISHED
Изменения идут в `ProductDraft` N+1. Live N не меняется.

### SUBMITTED / IN_REVIEW
Read-only.

UI должен явно показывать current published version и pending proposal.

## 10. Product editor sections

Минимум:

```text
Basic Information
Category Attributes
Pricing / Tariffs
Availability
Media
Conditions / Policies
Preview
Moderation
```

Не показывать секции без authoritative model.

## 11. Product Media UI

Использовать Step 1.2 backend:
- multi-upload;
- thumbnails;
- set primary;
- reorder;
- caption;
- alt text;
- replace;
- delete;
- requirement counters;
- errors.

Для PARTNER preview использовать authenticated preview contract. DRAFT media не должна становиться public.

## 12. Media requirements UX

Показать:
- minImages;
- maxImages;
- primaryImageRequired;
- allowed types;
- videoAllowed capability.

Video UI не делать, если backend video upload не поддерживает.

## 13. Tariffs / Options

Если backend ownership/write contract готов:
- name;
- price;
- currency;
- option/conditions;
- active context.

Если write contract отсутствует или ownership не определён:

```text
ARCHITECTURE DECISION REQUIRED
```

Не реализовывать Payment/Settlement.

## 14. Availability

Если Catalog Availability write для PARTNER уже определён:
- ranges/dates;
- slots/capacity;
- status.

Если нет — не расширять permissions самостоятельно.

Availability ≠ Booking reservation.

## 15. Preview

PARTNER имеет authenticated preview draft/change proposal.

DRAFT Product не должен быть доступен через public `/products/:slug`.

## 16. Submit to moderation

Перед submit:
- validation summary;
- media requirements;
- missing fields;
- tariff/availability blockers.

После submit форма read-only по lifecycle.

## 17. Moderation result/history

Показывать:
- status;
- submittedAt;
- reviewedAt;
- decision;
- localized reason label;
- moderator comment;
- requested changes;
- previous submissions.

Только own Product.

## 18. Changes requested / re-submit

При `CHANGES_REQUESTED`:
- show feedback;
- reopen edit;
- preserve previous submission;
- allow new submit.

Не перезаписывать историю.

## 19. Published state

После approve:
- Published badge;
- link «Посмотреть на витрине»;
- future edits → N+1 proposal.

## 20. Archive/unpublish

Только если PARTNER имеет соответствующий permission/command.

Не добавлять destructive delete published Product.

## 21. i18n

Минимум RU/AZ/EN:
- navigation;
- form labels;
- validation;
- statuses;
- moderation reasons;
- actions;
- empty/error states.

Technical codes/status enum не локализовать в data model.

## 22. Responsive & accessibility

Поддержать desktop/tablet/mobile.

Особенно:
- long forms;
- media reorder;
- filters;
- moderation feedback.

Accessibility:
- labels;
- error linkage;
- keyboard navigation;
- uploader;
- focus;
- confirmations;
- semantic statuses.

## 23. Unsaved changes / stale conflict

Предупреждать о несохранённых изменениях.

При version/stale conflict:
- не перетирать server state;
- показать conflict;
- предложить reload/review;
- no blind retry.

## 24. Security

Проверить:
- PARTNER A чужой Product;
- direct `/partner/products/:id`;
- forged productId/partnerId;
- media чужого Product;
- moderation history чужого Product;
- preview чужого Product;
- draft public exposure;
- PARTNER → `/app/*`.

Frontend restrictions не заменяют backend security.

## 25. Обязательные tests

Минимум:

1. PARTNER login → Partner Cabinet;
2. BUYER не входит в `/partner`;
3. internal role не получает Partner ownership автоматически;
4. PARTNER видит только свои Product;
5. create Product ownership backend;
6. forged partnerId blocked/ignored;
7. dynamic Category Schema form;
8. string/text;
9. number/integer;
10. boolean;
11. date;
12. time;
13. enum;
14. currency;
15. DRAFT editable;
16. SUBMITTED read-only;
17. IN_REVIEW read-only;
18. CHANGES_REQUESTED editable;
19. PUBLISHED edit → N+1 proposal;
20. live N unchanged before approve;
21. media multi-upload;
22. primary/reorder;
23. media errors;
24. authenticated draft preview;
25. submit moderation;
26. moderation history;
27. changes feedback;
28. re-submit;
29. published storefront link;
30. cross-partner IDOR blocked;
31. RU;
32. AZ;
33. EN;
34. mobile smoke;
35. accessibility smoke;
36. Marketplace regression green;
37. backend regression green.

## 26. Не делать

Не реализовывать:

```text
Buyer Cabinet
checkout
cart
Payment
PSP
split payment
Settlement
Payout
Sales
OrderRequested
Booking changes
Partner financial statements
Partner payout onboarding
Reviews/Ratings
AI tools
```

## 27. Definition of Done

Step 1.8 завершён только если:
- `/partner/*` есть;
- PartnerLayout есть;
- My Products own-scope;
- Product create/edit работает;
- dynamic schema form работает;
- ProductDraft N+1 UX работает;
- ProductMedia management работает;
- preview не leak'ит draft;
- submit/re-submit moderation работает;
- moderation feedback/history работает;
- lifecycle guards соблюдаются;
- RU/AZ/EN работает;
- responsive/accessibility baseline;
- frontend tests/build/typecheck green;
- Marketplace regression green;
- backend regression green.

## 28. После выполнения

Предоставь:
1. route tree `/partner/*`;
2. изменённые файлы;
3. PartnerLayout;
4. dashboard/summary;
5. My Products;
6. Product create/edit architecture;
7. Category Schema dynamic form;
8. Tariff integration;
9. Availability integration;
10. Media UI;
11. draft preview;
12. moderation submit/history;
13. ProductDraft N+1 UX;
14. i18n;
15. security/IDOR tests;
16. frontend unit/component tests;
17. Playwright/browser tests;
18. typecheck/build;
19. Marketplace regression;
20. backend regression;
21. git diff summary;
22. найденные проблемы;
23. `ARCHITECTURE DECISION REQUIRED`, если есть.

Не переходи к Step 1.9 автоматически.

Финальная строка строго:

```text
PHASE 1 STEP 1.8 COMPLETED — WAITING FOR REVIEW
```
