# PHASE 4 — REQUEST MODAL / OFFER SELECTION / CUSTOMER DATA
## STRICT UX IMPLEMENTATION ADDENDUM

**Project:** TravelHUB  
**Phase:** Phase 4 of Supplier Markup implementation  
**Status:** Approved implementation instruction  
**Baseline:** `SUPPLIER_MARKUP_STRICT_IMPLEMENTATION_PROMPT.md`  
**Current state:** Phases 0–3 completed; Phase 4 pending

---

## 0. EXECUTION CONTRACT

Continue implementation of **Phase 4 only**.

Do not start Phase 5 or Phase 6.

Replace the duplicated request-entry UX with one unified flow:

```text
Calendar
    ↓
click on price
    ↓
one modal
    ↓
selected tour
+
offers for this exact tour/date
+
customer data
    ↓
"Подать заявку" on the chosen offer
    ↓
Request
```

Preserve the approved Supplier Markup architecture, server-side pricing authority, phone-first identity model, and existing security gates.

---

## 1. REMOVE THE DUPLICATED REQUEST FORM

The current standalone customer form below the calendar must no longer be the primary request-entry path.

Do not keep two parallel request flows:

```text
A. Calendar → separate form → Send Request

B. Calendar → click price → modal → Request
```

The target is only:

```text
Calendar
   ↓
click price
   ↓
modal
   ↓
customer data + offers
   ↓
"Подать заявку"
   ↓
Request
```

Remove the standalone form from the primary calendar UX.

---

## 2. CALENDAR → MODAL

When the user clicks a price in the calendar, open the request modal.

The modal represents the **specific tour/card selected by the user**.

Do not show unrelated tours or hotels.

Show the selected tour context, for example:

```text
Rixos Downtown Antalya
Antalya, Turkey

15 October 2026
7 nights
2 adults
```

Follow the existing tour/card data model for exact fields.

---

## 3. OFFERS ARE VARIANTS OF THE SELECTED TOUR

The modal shows multiple offers for the selected tour/date.

These are NOT different tours.

They can differ by:

- room type;
- room category;
- room view;
- meal plan;
- tariff conditions;
- other supplier offer attributes.

Example:

```text
Superior Room
Double / Room Only
3 449 USD

Superior Room
Double / Breakfast
3 511 USD

Deluxe Room
Double / Room Only
3 505 USD

Family Room
Ultra All Inclusive
3 780 USD
```

The user must be able to compare these offers in the same modal.

---

## 4. EACH OFFER HAS ITS OWN "ПОДАТЬ ЗАЯВКУ" BUTTON

Every offer must have its own button:

```text
[ Подать заявку ]
```

Example:

```text
Superior Room
Double / Room Only
3 449 USD

                         [ Подать заявку ]


Deluxe Room
Double / Breakfast
3 505 USD

                         [ Подать заявку ]
```

Do not replace these with one global button.

The selected offer is determined by the button the user clicks.

If the user clicks the third offer, the resulting Request must refer to the third offer.

---

## 5. REGISTERED USER

If the user is authenticated and Customer/User data is available, automatically populate the customer section.

Example:

```text
Данные заказчика

Алексей Иванов
+994 50 123 45 67
alexey@example.com

☑ Данные верны
```

Show:

> **Используем данные вашего аккаунта. Проверьте, пожалуйста, их корректность.**

Registered-user offer buttons must be active immediately when the loaded data is valid.

Do not force a registered user to re-enter the same information.

---

## 6. REGISTERED USER — DATA VALIDATION

Automatically loaded data must still pass the current validation rules.

If stored phone or email is invalid, do not create a Request with invalid data.

Show the appropriate validation message and allow correction.

Examples:

> **Введите корректный номер телефона.**

> **Введите корректный адрес электронной почты.**

If the existing account data is valid, the offer buttons are immediately active.

---

## 7. GUEST USER

For an unauthenticated user, customer fields start empty.

Required customer fields:

```text
Имя и фамилия *
Телефон *
Email
```

Example:

```text
Данные заказчика

Имя и фамилия *
[________________________]

Телефон *
[________________________]

Email
[________________________]
```

The exact required/optional status must follow the existing business contract. If Email is optional, an empty Email is valid; if entered, it must always be valid.

---

## 8. DISABLED OFFER BUTTONS FOR GUESTS

When guest customer data is incomplete or invalid:

```text
[ Подать заявку ]
```

on every offer must be disabled.

The offers themselves remain visible and comparable.

Add a helpful explanation:

> **Заполните данные заказчика, чтобы подать заявку.**

The user can browse all offers while the submission actions remain disabled.

---

## 9. ENABLE ALL OFFER BUTTONS AFTER VALID DATA

When the guest has entered valid required customer data:

```text
Имя и фамилия ✓
Телефон ✓
Email ✓ / если заполнен
```

all offer buttons become active simultaneously:

```text
[ Подать заявку ]
```

The user then clicks the button next to the offer they actually want.

There is no additional "select offer" step.

---

## 10. PHONE VALIDATION

Use the project's existing phone-first identity and normalization architecture.

Do not introduce a second phone normalization system.

Phone must be normalized to E.164 on the server.

Example:

```text
+994501234567
```

Clearly invalid input must block request submission.

Examples:

```text
123
+994
+994 abc
000000
```

Display:

> **Введите корректный номер телефона.**

Validation is required on:

- frontend;
- backend.

Frontend validation is not a security boundary.

---

## 11. EMAIL VALIDATION

If Email is provided, validate it using the project's existing email validation conventions.

Valid examples:

```text
user@example.com
name.surname@company.az
```

Invalid examples:

```text
user@
@example.com
user example.com
abc
```

Display:

> **Введите корректный адрес электронной почты.**

If Email is optional under the current contract:

```text
empty Email → allowed
invalid non-empty Email → rejected
```

---

## 12. SERVER-SIDE AUTHORITY

The backend must repeat all important validation.

Never trust frontend validation.

The server must validate/derive:

```text
customer identity
phone
email
selected offer
supplier price
currency
markup
public price
customer final price
price floor
```

Client-supplied commercial values must not become authoritative.

Do not trust client-provided:

```text
supplierPrice
displayedPrice
publicPrice
finalPrice
markupAmount
```

where the server can derive them.

---

## 13. SELECTED OFFER MUST BE EXACT

When the user clicks:

```text
[ Подать заявку ]
```

the resulting Request must refer to the exact supplier offer represented by that row/card.

The commercial context must include the relevant:

```text
tour
date
traveler composition
room type
meal plan
supplier offer identifier
supplier price
supplier currency
TravelHUB markup
public price
```

Do not create a generic Request for the tour while silently losing the selected room/meal/offer.

---

## 14. PRICE CHECK UX

Do not introduce a user-facing button:

```text
Проверить цену
```

The user flow remains:

```text
click price
→ modal
→ click "Подать заявку" for desired offer
```

Price freshness/revalidation remains server-side.

If the server detects a changed supplier price, use the existing price-change/confirmation mechanism.

Do not require a separate manual "check price" action before submitting.

---

## 15. CALENDAR EXPLANATION

The calendar must make the click-to-open behavior obvious.

Add an appropriate explanatory hint near the calendar/prices:

> **Нажмите на цену, чтобы посмотреть варианты и подать заявку.**

or:

> **Нажмите на цену для оформления заявки.**

Do not make the user guess that the price is clickable.

---

## 16. MODAL VISUAL DIRECTION

The current modal is considered too technical/simple.

Implement a richer travel-booking presentation while preserving the existing design system.

The modal should visually contain:

```text
┌─────────────────────────────────────────────────────┐
│ Оформление заявки на тур                         X │
│                                                     │
│ Selected tour                                      │
│ Photo / title / date / nights / travelers          │
│                                                     │
│ ─────────────────────────────────────────────────── │
│                                                     │
│ Варианты размещения и питания                      │
│                                                     │
│ ┌───────────────────────────────────────────────┐   │
│ │ Superior Room                                │   │
│ │ Double • Room Only                            │   │
│ │                                               │   │
│ │                              3 449 USD        │   │
│ │                         [Подать заявку]       │   │
│ └───────────────────────────────────────────────┘   │
│                                                     │
│ ┌───────────────────────────────────────────────┐   │
│ │ Deluxe Room                                  │   │
│ │ Double • Breakfast                            │   │
│ │                              3 505 USD        │   │
│ │                         [Подать заявку]       │   │
│ └───────────────────────────────────────────────┘   │
│                                                     │
│ Данные заказчика                                   │
│                                                     │
│ [registered data / guest form]                     │
└─────────────────────────────────────────────────────┘
```

The exact layout may adapt to the current TravelHUB UI system.

Do not redesign unrelated screens.

---

## 17. REQUEST CREATION

The final action is:

```text
specific offer
+
valid customer
+
authoritative commercial price
        ↓
Request
```

The Request must preserve the commercial snapshot architecture implemented in Phase 3.

Do not bypass:

- Supplier Markup;
- commercial snapshot;
- supplier-price floor;
- currency validation;
- existing Request gates.

---

## 18. ACCEPTANCE CRITERIA — REGISTERED USER

The following must work:

```text
login
↓
customer data automatically loaded
↓
phone/email valid
↓
offer buttons ACTIVE
↓
click offer #3 "Подать заявку"
↓
Request created for offer #3
```

The user must not be forced to re-enter customer data.

---

## 19. ACCEPTANCE CRITERIA — GUEST

The following must work:

```text
guest
↓
customer fields empty
↓
all offer buttons DISABLED
↓
enter valid customer data
↓
all offer buttons ACTIVE
↓
click offer #3
↓
Request created for offer #3
```

---

## 20. ACCEPTANCE CRITERIA — INVALID PHONE

```text
invalid phone
↓
validation error
↓
offer buttons remain DISABLED
```

Message:

> **Введите корректный номер телефона.**

---

## 21. ACCEPTANCE CRITERIA — INVALID EMAIL

```text
invalid email
↓
validation error
↓
offer buttons remain DISABLED
```

Message:

> **Введите корректный адрес электронной почты.**

If Email is optional, empty Email remains allowed.

---

## 22. ACCEPTANCE CRITERIA — CALENDAR

```text
click price
↓
correct selected tour/date modal opens
```

The modal must correspond to the exact tour/date selected in the calendar.

---

## 23. ACCEPTANCE CRITERIA — DUPLICATE FORM

The old standalone form below the calendar must no longer be the primary request path.

There must be one canonical user flow:

```text
Calendar
→ click price
→ modal
→ customer data
→ offer-specific "Подать заявку"
→ Request
```

---

## 24. ACCEPTANCE CRITERIA — PRICE AUTHORITY

Client manipulation must not alter the commercial price.

Test at minimum:

```text
client sends manipulated price
↓
server ignores it as commercial authority
↓
server derives/validates authoritative supplier price
↓
Request contains authoritative commercial snapshot
```

---

## 25. TESTING REQUIREMENTS

At minimum add/adjust tests for:

### Frontend

- registered user auto-fill;
- registered user valid data → buttons active;
- guest → buttons disabled;
- guest valid data → all buttons active;
- invalid phone → buttons disabled;
- invalid email → buttons disabled;
- optional empty email → allowed if contract says optional;
- clicking offer #1 creates/selects offer #1;
- clicking offer #N creates/selects offer #N;
- calendar price opens correct tour/date modal.

### Backend

- phone validation;
- E.164 normalization;
- email validation;
- guest customer resolution/creation through existing resolver;
- selected offer integrity;
- commercial price authority;
- supplier floor;
- snapshot preservation.

### E2E

At minimum:

1. registered user flow;
2. guest flow;
3. invalid phone;
4. invalid email;
5. selected-offer correctness;
6. calendar → modal → Request.

---

## 26. DO NOT CHANGE

Do not change:

- `CommissionPolicy`;
- Storefront seller commission;
- Supplier Markup architecture;
- `FlightSupplier` by inventing `refreshPrice`;
- existing Order money gates;
- Booking → Order lifecycle;
- unrelated supplier integrations;
- unrelated UI.

---

## 27. PHASE 4 STOP GATE

After implementing this UX:

**STOP.**

Do not start Phase 5 or Phase 6.

Produce:

```text
PHASE 4 — IMPLEMENTATION REPORT
```

The report must contain:

1. changed files;
2. frontend changes;
3. backend changes;
4. registered-user flow evidence;
5. guest flow evidence;
6. phone validation evidence;
7. email validation evidence;
8. disabled/enabled offer-button evidence;
9. selected-offer Request evidence;
10. calendar → modal evidence;
11. removal of old standalone request form;
12. tests;
13. TypeScript/typecheck;
14. frontend test results;
15. backend test results;
16. e2e results;
17. known limitations;
18. Git status.

Do not commit or push merely because Phase 4 passes.

Wait for explicit approval before Phase 5/6.

---

## 28. FINAL UX CONTRACT

The final UX must be:

```text
CALENDAR
   ↓
user clicks a price
   ↓
ONE MODAL
   ├── selected tour
   ├── selected date
   ├── nights / travelers
   ├── multiple offers of THIS tour
   │      ├── room
   │      ├── meal
   │      ├── conditions
   │      ├── price
   │      └── [Подать заявку]
   │
   └── customer data
          │
          ├── registered:
          │     auto-filled
          │     confirm correctness
          │     buttons ACTIVE
          │
          └── guest:
                fields empty
                buttons DISABLED
                ↓
                valid data
                ↓
                buttons ACTIVE

user clicks "Подать заявку" beside chosen offer
   ↓
Request for EXACT selected offer
```

**Do not create a second request form outside this modal.**

**Do not create a separate user-facing price-check button.**

**Do not trust client commercial prices.**

**Do not activate offer buttons for a guest until required customer data is valid.**

**Do not require registered users to re-enter already valid customer data.**

**After Phase 4, STOP and report.**
