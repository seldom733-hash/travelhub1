# M4 --- PHONE-FIRST CUSTOMER IDENTITY & COMMERCE NOTIFICATIONS

## Objective

Implement M4 without reopening M3. The central decision is:

**LOGIN = normalized phone number.**

Email remains a contact/profile attribute, not the login.

M4 must unify Website and WhatsApp customer identity and prepare
extension points for Facebook, Instagram and TikTok.

------------------------------------------------------------------------

## 1. Mandatory repository discovery

Before coding inspect the actual repository and existing
schema/services/tests for:

-   User / BUYER
-   Customer and User↔Customer
-   Auth, registration, login, password and account
-   Request, Order, Booking
-   Checkout
-   Traveler
-   Communication
-   WhatsApp M3
-   Outbox / EventBus
-   Notification infrastructure
-   RBAC and Audit
-   frontend registration/login/account

Also inspect migrations and existing data.

Do not recreate existing entities or assume field names. Do not silently
remove email or create a parallel identity system.

------------------------------------------------------------------------

## 2. Identity model

Keep these concepts separate:

``` text
Customer = business/customer identity
User/BUYER = authenticated account
Traveler = person travelling
Payer = person paying
Request → Order → Booking = commerce lifecycle
```

Target logical model:

``` text
User / BUYER
├── loginPhone    ← LOGIN
├── email         ← CONTACT
├── passwordHash
└── customerId

Customer
├── phone         ← IDENTITY / CHANNEL
├── firstName
├── lastName
└── ...
```

If the repository uses different names, adapt to the existing model.

`User.loginPhone` and `Customer.phone` must use normalized E.164
representation where applicable.

Request and Order remain owned through `customerId`; phone must never
replace `customerId`.

------------------------------------------------------------------------

## 3. Registration

Registration UI must use:

``` text
Страна       [ 🇦🇿 Azerbaijan (+994) ▼ ]
Телефон      [ 50 123 45 67 ]
Имя
Фамилия
Email
Пароль
Подтверждение пароля
```

Country code and local number must not be duplicated.

Frontend may format the number, but backend must independently validate
and normalize it.

Examples must normalize consistently:

``` text
+994 50 123 45 67
00994 50 123 45 67
050 123 45 67
```

according to the selected country.

Protect against sequential and concurrent duplicate registration.

------------------------------------------------------------------------

## 4. Phone uniqueness and security

One authenticated User/BUYER must not have multiple accounts using the
same normalized login phone.

Protect:

-   brute-force login;
-   account enumeration;
-   password recovery;
-   phone verification;
-   phone changes;
-   rate limits;
-   audit.

Never expose whether a phone belongs to an account through an insecure
public endpoint.

Never log passwords or OTP secrets.

------------------------------------------------------------------------

## 5. Customer Resolver

Create/reuse one channel-independent Customer Resolver for:

``` text
Website registered
Website guest
WhatsApp
Future Facebook
Future Instagram
Future TikTok
```

Target:

``` text
Customer Entry Layer
        ↓
Customer Resolver
        ↓
Customer
        ↓
User / BUYER
        ↓
Request → Order → Booking
```

Resolution rules:

1.  normalize phone;
2.  search by phone;
3.  one match → matched;
4.  multiple candidates → ambiguous, no automatic selection;
5.  FIO is a verification/candidate signal;
6.  same FIO with different phones must not auto-merge;
7.  zero matches → new-customer candidate;
8.  creation/linking must happen at the correct business boundary.

Do not create channel-specific Customer models.

------------------------------------------------------------------------

## 6. Scenario A --- registered Website customer

``` text
Registration
→ phone + country + FIO + email + password
→ normalize phone
→ Customer Resolver
→ existing Customer: reuse
  or new Customer: create
→ User/BUYER
→ login = normalized phone
→ Search → Service → Checkout
→ Request → Order → Traveler Data → Booking
```

If User already exists, do not create another and do not silently reset
the password.

------------------------------------------------------------------------

## 7. Scenario B --- Website guest checkout

Visitors may freely search, view cards, prices and conditions.

Do not require registration for browsing.

Only when the visitor selects `Оформить заказ`:

``` text
Guest
→ onboarding form
→ phone + country + FIO + email + password
→ Customer Resolver
→ Customer
→ User/BUYER, login = phone
→ Request → Order
```

The guest chooses the password.

If an existing User is found, reuse it; do not create a second account
or silently reset the password.

Do not collect passport/traveler data merely for account creation;
traveler data remains requirement-driven.

------------------------------------------------------------------------

## 8. Scenario C --- WhatsApp first contact

Do NOT redirect a WhatsApp-first customer to generic website
registration.

The WhatsApp phone is already known.

``` text
WhatsApp
→ operator receives request
→ resolve Customer by phone
```

Existing Customer:

``` text
verify FIO
→ establish first/repeat contact
→ reuse Customer
→ Request
```

No Customer:

``` text
operator sends data-collection form in WhatsApp
→ customer provides FIO/email/required profile data
→ operator rechecks identity
→ create Customer
→ create/link User/BUYER
→ login = WhatsApp phone
→ operator manually authorizes/activates
```

The client decides whether they want to use the personal account.

Do not force website registration.

------------------------------------------------------------------------

## 9. Account activation

Do not make operators invent or store permanent passwords.

Preferred:

``` text
User created
→ secure activation link
→ customer confirms identity
→ customer sets password
```

Login is the normalized phone.

If a temporary credential is required by the existing auth design, store
only its secure representation and force replacement at activation.

Never store permanent plaintext passwords.

------------------------------------------------------------------------

## 10. Login, recovery and phone change

Primary login:

``` text
phone + password
```

Design the domain so future OTP authentication is possible:

``` text
phone → OTP → authentication
```

Full OTP may be deferred if outside M4.

Recovery must verify phone ownership. Email is not a hidden alternate
login.

Changing the login phone is a sensitive operation. It must include
appropriate authentication, new-phone verification, uniqueness checks,
User/Customer consistency, token/session implications and audit. If part
of the UI is deferred, document it explicitly.

------------------------------------------------------------------------

## 11. Customer/User/Traveler boundaries

Do not:

-   create a new Customer whenever a User is created if an existing
    Customer can be resolved;
-   create a User for every Traveler;
-   automatically create CRM Customers for every Traveler;
-   use raw phone or email as Request/Order ownership.

Use:

``` text
Request.customerId
Order.customerId
```

Traveler data remains separate and requirement-driven.

------------------------------------------------------------------------

## 12. Commerce notifications

Implement/complete a channel-agnostic Notification Layer beside existing
communication:

``` text
Request / Order / Booking state change
                 ↓
          Notification Layer
                 ↓
       WhatsApp / Email / future channels
```

Do not directly couple:

``` text
RequestService → WhatsAppService
OrderService   → WhatsAppService
BookingService → WhatsAppService
```

M4 must support at least:

-   Request accepted
-   Request → Order
-   Traveler data required
-   Booking confirmed

Where a User/account exists, include an account link, e.g.:

`Вы можете следить за статусом заявки, заказа и бронирования в личном кабинете TravelHUB: [Перейти в личный кабинет]`

For WhatsApp-first customers:

`Использовать личный кабинет необязательно — мы также будем информировать вас здесь, в WhatsApp.`

Do not force account usage.

------------------------------------------------------------------------

## 13. Communication continuity

WhatsApp and personal account are two views of the same lifecycle.

Do not copy or create separate communication histories.

Reuse M3 conversation/communication architecture.

M3 already provides the WhatsApp foundation; M4 integrates with it
rather than redesigning it.

------------------------------------------------------------------------

## 14. Future channels

Prepare interfaces/adapters for:

``` text
Facebook
Instagram
TikTok
```

Do not implement these integrations in M4.

They must feed the same Customer Entry Layer → Customer Resolver →
Customer/User model.

------------------------------------------------------------------------

## 15. Migration and existing data

Before schema changes inspect:

-   current User records;
-   existing phone values;
-   duplicate phones;
-   users without phones;
-   Customers with phones;
-   existing email-based authentication.

Define a safe migration strategy.

Do not perform destructive migration or silently corrupt existing
accounts.

If some existing users cannot be migrated automatically, document the
migration/reconciliation procedure and test it.

If internal staff and customer accounts share User, protect staff
authentication from accidental breakage.

------------------------------------------------------------------------

## 16. Tests

Add tests for:

### Phone

-   country + local number;
-   international number;
-   formatting variants;
-   invalid number;
-   unsupported country;
-   duplicate country code;
-   concurrent duplicate registration.

### Registration/login

-   new Customer + User;
-   existing Customer reuse;
-   existing User reuse;
-   phone + password login;
-   wrong password;
-   unknown phone;
-   disabled User.

### Resolver

-   one match;
-   zero matches;
-   ambiguous candidates;
-   same FIO/different phone;
-   same phone/multiple candidates.

### Website

-   browsing without registration;
-   guest checkout onboarding;
-   Customer reuse;
-   User creation;
-   Request creation.

### WhatsApp

-   existing Customer;
-   new Customer;
-   User create/link;
-   optional account link;
-   no forced website registration.

### Cross-channel

``` text
WhatsApp → Customer → User
Website login → same Customer/User
Guest checkout → same Customer when applicable
```

No duplicate Customer/User.

### Notifications

Test all four commerce status notifications, account link, idempotency
and suppression/blocked delivery.

------------------------------------------------------------------------

## 17. Required E2E scenarios

1.  New Website visitor → phone registration → Customer/User → phone
    login → Request.
2.  Guest → browse → checkout → phone onboarding → Customer/User →
    Request.
3.  WhatsApp first contact → operator resolution → Customer/User →
    optional account link → Request.
4.  WhatsApp customer → Website phone login → same Customer/User and
    existing commerce data.
5.  WhatsApp + Website → no duplicate Customer.
6.  Same FIO + different phones → no automatic merge.
7.  Same phone + ambiguous candidates → manual resolution.
8.  Request/Order/Booking status → WhatsApp notification → account link.

------------------------------------------------------------------------

## 18. UI

Customer login:

``` text
Телефон
[ 🇦🇿 +994 ▼ ] [ 50 123 45 67 ]

Пароль
[ ******** ]

[ Войти ]
```

Registration uses the same reusable phone component.

Do not implement phone parsing independently on multiple pages.

------------------------------------------------------------------------

## 19. Backward compatibility

Do not break:

-   staff/admin/operator authentication;
-   partner authentication;
-   RBAC;
-   CRM Customer;
-   WhatsApp M3;
-   account endpoints;
-   Request/Order/Booking.

Inspect whether staff and BUYER share the same User model before
changing authentication.

------------------------------------------------------------------------

## 20. Audit and RBAC

Audit:

-   Customer created;
-   User created;
-   Customer/User linked;
-   manual identity resolution;
-   phone changed;
-   account activation/recovery;
-   notification sent/failed;
-   suppression.

Preserve existing roles. Operators must be able to resolve ambiguous
WhatsApp identity. Customers must never access another Customer merely
by knowing a phone number.

------------------------------------------------------------------------

## 21. Implementation policy

Before work:

``` bash
git status
git branch --show-current
git rev-parse HEAD
```

Use existing services and contracts where possible.

Add migrations and regression tests.

Do not commit or push without explicit authorization.

Do not reopen M3 unless a concrete M4 compatibility defect requires a
minimal change.

------------------------------------------------------------------------

## 22. M4 gate

Create a final `M4-GATE-REPORT.md`.

Evaluate:

``` text
Repository Discovery: PASS/FAIL
Phone Identity Model: PASS/FAIL
Phone Normalization: PASS/FAIL
Registration: PASS/FAIL
Phone Login: PASS/FAIL
Password/Recovery: PASS/FAIL
Customer Resolver: PASS/FAIL
Duplicate Prevention: PASS/FAIL
Website Registered Flow: PASS/FAIL
Website Guest Flow: PASS/FAIL
WhatsApp First Contact: PASS/FAIL
Cross-Channel Continuity: PASS/FAIL
Request Ownership: PASS/FAIL
Order Ownership: PASS/FAIL
Traveler Separation: PASS/FAIL
Notification Layer: PASS/FAIL
WhatsApp Notifications: PASS/FAIL
Account Links: PASS/FAIL
RBAC: PASS/FAIL
Audit: PASS/FAIL
Security: PASS/FAIL
Migration/Data Compatibility: PASS/FAIL
Backend Tests: PASS/FAIL
Frontend Tests: PASS/FAIL
E2E: PASS/FAIL
Regression: PASS/FAIL

FINAL RESULT: M4 FINAL PASS / M4 FAIL
```

Do not declare PASS with an unresolved M4 defect.

------------------------------------------------------------------------

## 23. Explicitly deferred

Do not implement during M4 unless specifically required by the above
contract:

-   Facebook integration;
-   Instagram integration;
-   TikTok integration;
-   full OTP provider integration if not already available;
-   unrelated CRM redesign;
-   unrelated WhatsApp M3 refactoring.

------------------------------------------------------------------------

## 24. Final response

Report:

1.  M4 FINAL PASS/FAIL;
2.  exact test counts;
3.  migrations;
4.  changed files;
5.  phone-first status;
6.  Customer Resolver status;
7.  Website registered status;
8.  guest checkout status;
9.  WhatsApp first-contact status;
10. notification status;
11. cross-channel continuity;
12. security findings;
13. migration/data issues;
14. pre-existing failures;
15. location of `M4-GATE-REPORT.md`;
16. readiness for the next phase.

Do not ask the project owner to repeat information already available in
the repository or this prompt.
