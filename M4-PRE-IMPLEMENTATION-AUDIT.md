# M4 PRE-IMPLEMENTATION AUDIT

Read-only audit of the TravelHUB repository against the M4 target (phone-first identity + common Customer Resolver). No source, schema, migration, config or test files were modified. No commits. No pushes. Tests run only where read-only (see §13).

## 1. Executive Summary

The repository is a healthy, fully green codebase (backend 130 suites / 2085 tests, frontend 53 files / 937 tests, all passing) with a **completed and frozen M3 WhatsApp module** and **zero M4 identity work implemented**.

- **CURRENT LOGIN IDENTIFIER = `username`** (`User.username @unique`), behaving like email because registration defaults `username = email`. Not phone; not even email directly.
- `User` has **no phone field at all**. `Customer.phone` is nullable, unindexed, unnormalized. `Customer.email` is **required + unique** — the inverse of phone-first.
- **No Customer Resolver exists.** Two disjoint mechanisms instead: (a) CRM/auth create-or-link keyed by normalized **email only** (`ensureCustomerForBuyer`); (b) WhatsApp-only phone matching (`findCustomerIdsByCanonicalPhone` + private `matchCustomer`) → `UNMATCHED/MATCHED/AMBIGUOUS`.
- **No guest checkout, no `/checkout` route, no cart**; checkout is staff-only. Buyer registration collects no country/phone. No activation link, no OTP, no self-service password reset (admin-only), no refresh tokens, no notification layer (0 matches).
- **Boundaries are intact**: Customer ≠ User ≠ Traveler ≠ Payer; traveler data never creates User/Customer (one violation exists only in `legacy/`, not runtime).
- The M4 resolver **can be introduced without duplicating WhatsApp logic** — the extractable core is already isolated in plain functions (`shared/phone/phone.ts` + `inbound.service.ts:96-108` + a 6-line 0/1/>1 branch).

Two preconditions before implementation: (1) the working tree carries the **entire uncommitted M1–M3 WhatsApp implementation** (61 changed paths) — M4 must not build on an uncommitted baseline; (2) a **doc-internal identity-key conflict** (A-29 "phone = strong identifier" vs accepted ADR-0003 "canonical key = normalized email") must be resolved as an ADR decision, not a code refactor.

**Verdict: READY WITH REQUIRED CHANGES.**

## 2. Repository / Commit / Branch

| Item | Value | Evidence |
|---|---|---|
| Branch | `master` | `git branch --show-current` |
| HEAD | `28c4dcd` "test: fix all pre-existing failing suites (backend 6, frontend 2)" (2026-10-02) | `git log --oneline -3` |
| Working tree | **DIRTY — 61 changed paths** | `git status --short` |
| Uncommitted content | Whole M1–M3 WhatsApp implementation: `backend/src/integrations/whatsapp/**`, `backend/prisma/schema.prisma` (` M`: whatsapp datasource :29, `WHATSAPP` channel enum :2665, entire `whatsapp.*` block :5456-5739), **6 untracked migration dirs** (`20260912180000_constructor_foundation_remediation`, `20261002120000_whatsapp_foundation_m1`, `20261002130000_whatsapp_permissions`, `20261002140000_whatsapp_m2_lifecycle_receipts`, `20261002150000_whatsapp_m3_inbound_conversations`, `20261003220000_whatsapp_media_files`), M3/M4 prompts, `M3-GATE-REPORT.md` | `git status --short` |
| Generated client | gitignored (`.gitignore:12 backend/src/generated/`), present on disk incl. WhatsApp models | `git check-ignore -v` |
| Stack | Prisma 7 (client → `backend/src/generated/prisma`), NestJS backend, Next.js frontend, Baileys 6.7.24 | schema.prisma, package.json |

## 3. Current Identity Architecture

### 3.1 User — `backend/prisma/schema.prisma:2876-2909`

| Field | Line | Facts |
|---|---|---|
| `code` | 2878 | `@unique` (`USR-00000001`) |
| `username` | 2879 | **`@unique` — the login identity** |
| `email` | 2880 | `String? @unique` — **nullable** (PG unique allows multiple NULLs) |
| `passwordHash` | 2881 | required |
| `customerId` | 2889 | plain scalar, **no FK, no unique, no relation** (object scope BUYER, comment :2887) |
| `partnerId` | 2888 | same — unconstrained |
| `tokenVersion` | 2895 | JWT revocation counter |
| phone / loginPhone | — | **NOT PRESENT** — schema grep for phone/login yields only `lastLoginAt` :2891 |

```
Is email unique?                YES (schema.prisma:2880; User_email_key, 20260807194102_add_security_rbac/migration.sql:78)
Is phone present?               NO — NOT PRESENT on User (nor in any migration)
Is phone unique?                N/A — NOT PRESENT
Separate login field?           NO column; login field = username (schema.prisma:2879)
CURRENT LOGIN IDENTIFIER        User.username @unique — auth.service.ts:239-248 (+ lowercase fallback)
customerId present?             YES, nullable, unconstrained (schema.prisma:2889)
Multiple Users → one Customer?  YES possible — no unique/FK on customerId
User without Customer?          YES at DB level; app invariant "ACTIVE BUYER ⇒ valid customerId"
                               enforced only in register tx (auth.service.ts:113-114) and repair
                               sweep (security.service.ts:395-440)
```

### 3.2 Customer — `backend/prisma/schema.prisma:1880-1900`

| Field | Line | Facts |
|---|---|---|
| `email` | 1887 | **`String @unique` — REQUIRED** (init `20260807190230_init/migration.sql:159,420`) |
| `phone` | 1888 | **`String?` — nullable, NOT unique, NOT indexed** (only index `@@index([status])` :1898; no `ALTER TABLE crm.Customer` in any of 106 migrations) |
| `firstName`/`lastName`/`companyName` | 1884-1886 | optional |
| `code` | 1882 | `@unique` (`CUS-*`) |
| Normalization | — | **none at write time** — raw phone stored (`crm.service.ts:104,283,356,1529,1715`); email normalized on some paths (`shared/field-validation.ts:9`, used `crm.service.ts:342,394`) but `createCustomer` writes raw (:92-93,:103) |
| Duplicate risk | — | phone: same phone in multiple formats across Customers → WhatsApp full scan returns `AMBIGUOUS` (`inbound.service.ts:94-108`); email: case-variant duplicates possible (case-sensitive unique + one non-normalizing write path) |

### 3.3 Boundaries (separate models confirmed)

- `Customer` (crm :1880) · `OrderTraveler` (order :2280, `orderId` FK + `customerId?` copy :2284) · `Passenger` (booking :2607, `bookingId` FK, **no customerId/userId**) · `QuoteTraveler` :3709 · `CheckoutIntentTraveler` :3989.
- Model named `Traveler`: NOT PRESENT. Model named `Payer`: NOT PRESENT.
- `Communication` :2725 — `contextType/contextId`, **no `customerId` column**.

## 4. Current Authentication

### 4.1 Flow trace

| Step | Evidence |
|---|---|
| Login endpoint | `POST /api/v1/auth/login` — `backend/src/security/auth/auth.controller.ts:195-211` (`@Public()`) |
| Login DTO | `{ username!, password! }` only — `auth.controller.ts:52-58` |
| **Lookup** | `auth.service.ts:235-248` — `findUnique({where:{username: raw}})` then case-insensitive `findFirst({where:{username: raw.toLowerCase()}})`. **Email is never queried at login.** |
| Answer | `CURRENT LOGIN IDENTIFIER = username (case-insensitive)` |
| Why it behaves like email | `username = (input.username ?? email)` (`auth.service.ts:76`); partner hard-codes `username = email` (:166); seeded admin = `username:"admin"`, `email:null` (`security.service.ts:101`) |
| Password hashing | bcryptjs cost 10 — `auth.service.ts:88,177` |
| JWT | payload `{sub, username, role, tv}` (`auth.service.ts:352`); secret `JWT_SECRET ?? "dev-insecure-secret-change-me"`, TTL 8h (`security.module.ts:32-35`) |
| Cookie | `travelhub.auth`, HttpOnly, SameSite=Lax, 8h (`auth.controller.ts:239-248`) |
| Refresh token | **NOT PRESENT** (deferred, comment `auth.service.ts:338`) |
| Revocation | real — `revokeSession` increments `tokenVersion` (:273-278); `JwtAuthGuard` calls `me(sub,tv)` **every request** (`jwt-auth.guard.ts:43`); mismatch → 401 "Session has been revoked" (:332) |
| Guards | global `JwtAuthGuard` + fail-closed `PermissionsGuard` (`app.module.ts:44-45`); `@Public/@RequirePermissions/@CurrentUser` (`decorators.ts:8,16,20`); `@Roles()/RolesGuard`: NOT PRESENT |
| Throttle | 10/15min per `username|ip`, **in-memory per replica** (`auth.controller.ts:199-204`, `login-throttle.service.ts:17-39`) |
| Session probe | `GET /auth/session` never 401 (`auth.controller.ts:188-193`); `GET /auth/me` strict 401 (:213-217) |
| Logout | `POST /auth/logout` → revoke + clear cookie (:219-236) |

### 4.2 Missing auth features (all NOT PRESENT)

Self-service password reset · forgot-password endpoint · email verification · phone verification/OTP · activation token · refresh token · MFA · mail transport (0 hits nodemailer/smtp/sendgrid) · `Session`/`RefreshToken`/OTP Prisma models. Only **admin-forced reset**: `PATCH /users/:id/password` (`users.controller.ts:185` → `security.service.ts:297`: rehash + tokenVersion bump + audit, value never logged).

### 4.3 Frontend auth storage

- HttpOnly cookie is the truth; no JS-readable token (`frontend/lib/api.ts:3-13,20-32`, asserted `lib/api.spec.ts:15,24`).
- Session: `GET /auth/session` (`lib/api.ts:119-129`) via `useCurrentUser` (`lib/use-user.ts:22-66`); 401 → clear + redirect (`lib/api.ts:55-64`).
- `AuthUser {id,code,username,email,fullName,role,roleTitle,partnerId,customerId,permissions}` — **no phone** (`lib/api.ts:41-53`).
- Login UI: field `username`, label "Логин" (`app/login/page.tsx:80-86`, `lib/i18n.tsx:451`), placeholder `"admin"`.

### 4.4 Repository-wide `email = login` assumptions (complete inventory)

| Category | Locations |
|---|---|
| Code (runtime) | `auth.service.ts:76` (username default), `:166` (partner "логин = email"), `:74-75,:237` comments; `auth.controller.ts:15` doc comment |
| Tests (email-as-username login) | `test/d5-storefront-scope-isolation.e2e-spec.ts:91`, `test/d6-booking-fullpage.e2e-spec.ts:49`, `test/ui-c6-request-server-authority.e2e-spec.ts:110,118`, `test/analytics-readiness.e2e-spec.ts:134`, `test/buyer-identity.e2e-spec.ts:291-296` |
| CRM identity lookups (`where:{email}`, NOT login) | `crm.service.ts:92,345,398,1516,1702`; `account/account.service.ts:296-298` |
| Schema | `schema.prisma:2879-2880` (username/email unique), `:1887` (Customer.email required unique) |
| Frontend | `app/register/page.tsx:31,95-106`; `app/login/page.tsx:30,80-86`; `lib/account-api.ts:16`; `lib/api.ts:45,135,176`; `app/account/profile/page.tsx:9-11` ("email — канонический identity"); `app/account/layout.tsx:109,146` |
| Admin contradiction | seeded `admin` has `email=null` (`security.service.ts:101-110`), `.env.example:15-17` → **any email-identifier refactor breaks admin login** |
| Legacy (not runtime) | `legacy/src/app/api/auth/login/route.ts:23` (lookup by email); `legacy/src/lib/auth.ts:9-11` (plaintext-prefix compare) |
| Docs | `docs/adr/ADR-0003-buyer-customer-mapping.md:87-88`; `TravelHub_Phase_1_Step_1.9_...Customer_Mapping.md:120`; `PHASE_3_PRE_STEP_3.12_...AUTH_LOGIN_REMEDIATION.md:56,71` |

## 5. Current Registration

### 5.1 Backend — `POST /api/v1/auth/register`

- DTO (`auth.controller.ts:20-50`): `username?`, **`email` required `@IsEmail`**, `password` (8-128), `firstName?`, `lastName?`, `fullName?`. **`country` NOT PRESENT. `phone` NOT PRESENT.**
- Flow (`auth.service.ts:62-129`): normalize email (:73) → `username = username ?? email` (:76) → dup username/email → 409 (:81-84) → bcrypt (:88) → one transaction: `User` BUYER (:92) → `crm.ensureCustomerForBuyer(tx,{email,…})` (:106) → backfill `User.customerId` (:114) → audit (:116) → auto-login (:128).
- Forged keys: `assertNoForbiddenKeys(..., REGISTER_FORBIDDEN_KEYS)` (`auth.controller.ts:161`) → 422 for `role/partnerId/customerId/permissions`. Global `ValidationPipe` is `whitelist:true` **without** `forbidNonWhitelisted` (`shared/validation-pipe.ts:16-19`) → unknown keys silently stripped.
- Existing Customer by email → **linked, not duplicated**; CRM failure → full rollback (`backend/test/buyer-identity.e2e-spec.ts:192-223`).
- Partner register (`POST /auth/partner-register`, `auth.controller.ts:169-177`): the **only** registration collecting `country` (required) + `contactPhone` — stored **unnormalized** (`@IsString @MaxLength(50)`, `auth.controller.ts:124-127`); `username = email` hard-coded (`auth.service.ts:166`); creates `User` + `PartnerApplication`, **no Customer**.

### 5.2 Frontend — `frontend/app/register/page.tsx`

State :29-33 = firstName/lastName/email/password/confirm; email input `type="email"` :100 required; submit gate :142 (email + password≥8). Payload :46 → `{email,password,firstName?,lastName?}` (`lib/account-api.ts:144-146`, `RegisterInput:15-20`). **No country, no phone, no `register.country`/`register.phone` i18n keys (0 hits).** Only the partner form (`app/become-a-partner/page.tsx:83,160-166,193`) collects country/phone.

**Conclusion:** country + phone **cannot** be collected in buyer registration today; email is mandatory in both DTO and UI.

## 6. Customer Creation Matrix

### 6.1 Customer creation — production (4 sites, all `backend/src/modules/crm/crm.service.ts`)

| Location | Trigger | Existing lookup | Duplicate protection | Creates User | Creates Customer |
|---|---|---|---|---|---|
| `crm.service.ts:90` `createCustomer` (create :96) | `POST /customers` (`crm.controller.ts:172-175`, perm `crm.customer.write`) | `findUnique({where:{email}})` :92 → 409 :93 | email pre-check + DB `email @unique` + `nextCode("CUS")` | NO | YES |
| `crm.service.ts:338` `ensureCustomerForBuyer` (create :349) | internal: `auth.service.ts:106` (register tx), `security.service.ts:429` (repair) | `findUnique({where:{email}})` :345 → reuse :346 | normalized email reuse + DB unique | caller | YES |
| `crm.service.ts:1484` `intakePartnerCustomer` (create :1521) | `POST /partner/customers/intake` (perm `crm.customer.create_own` **+ PRO tier** :1502-1505) | :1516 → reuse :1518 | email reuse-or-create | NO | YES |
| `crm.service.ts:1676` `platformIntakeCustomer` (create :1707) | `POST /partners/:partnerId/intake` (perm `crm.partner.write`) | :1702 → reuse :1704 | email reuse-or-create | NO | YES |

**All four key exclusively on normalized email — never phone or FIO** (explicit `crm.service.ts:330-331`: "имя/телефон не являются ключом связи").

### 6.2 User creation — production (4 sites)

| Location | Trigger | Gate | Dup protection | Creates Customer |
|---|---|---|---|---|
| `auth.service.ts:92` (register) | `POST /auth/register` `@Public` | DTO + forbidden keys | username/email pre-check only; **no P2002 catch → race = 500** | YES via :106 |
| `auth.service.ts:181` (partner-register) | `POST /auth/partner-register` `@Public` | role forced PARTNER | DB unique | **NO** |
| `security.service.ts:101` (seedAdmin) | startup idempotent | none | idempotent by username/email | NO |
| `security.service.ts:462` (createStaff) | `POST /users` (perm `settings.write`) | username/email pre-check + P2002 covered (`security.service.spec.ts:233`) | DB unique; accepts `customerId` :472 but HTTP route forces `undefined` (`users.controller.ts:160-163`) | NO |
| (+ repair) `security.service.ts:385-430` | `POST /users/reconcile-buyer-customers` | `settings.write` | reuse-by-email :429 | back-fills Customers |

### 6.3 Seeds / tests / other

- Seeds: `backend/src/seed/demo-seed.ts:333,1013` `customer.createMany({skipDuplicates:true})` (writes `CRM-*` codes, bypassing `nextCode("CUS")`); `backend/src/perf/lib/seed.ts:236,113-132` via HTTP.
- Tests create Customers/Users directly in ~18 e2e files (e.g. `test/d3-request-flow.e2e-spec.ts:138`, `test/whatsapp-m3.e2e-spec.ts:113`, `analytics-foundation.e2e-spec.ts:70-97`) — bypass the service layer by design.
- **WhatsApp: NONE FOUND** — zero `customer.create|user.create` under `backend/src/integrations/whatsapp/**`; phone→Customer is lookup-only.
- **No raw SQL** `INSERT INTO crm.Customer/security.User`; no `CustomerService`/`resolveCustomer`/`findOrCreateCustomer` symbol outside `ensureCustomerForBuyer`.
- `legacy/` (not runtime): `legacy/prisma/seed.ts:200-350` user upserts; no Customer model at all.

**Duplicate-creation risk for M4:** every path dedups by email only; there is **no phone-keyed dedup anywhere** — introducing phone identity opens a new duplicate axis unless the Resolver gates all entry points.

## 7. Request / Order / Booking

Chain (cross-schema ID references only, no FKs — baseline rule `schema.prisma:13`):

```
User.customerId (schema.prisma:2889) ── set only by ensureCustomerForBuyer (auth.service.ts:106)
  └─ Customer (schema.prisma:1880, email @unique)
       ├─ Request.customerId?      :2372 (written request.service.ts:238, NOT existence-validated)
       ├─ CheckoutIntent.customerId :3919
       ├─ Sale.customerId          sales-completion.service.ts:109
       ├─ Order.customerId?        :2136 (nullable = "internal assisted flow"; order.service.ts:418)
       ├─ OrderTraveler.customerId? :2284 — copied from Order (order.service.ts:516)
       ├─ Booking — NO customerId (via Booking.orderId → Order.customerId, :2513)
       ├─ Passenger — NO customerId/userId (from OrderTraveler, booking.subscribers.ts:200)
       ├─ Payment.customerId = order.customerId (payment.service.ts:123,147)
       └─ Document/Invoice/Support Case — customerId refs (support.service.ts:113 IS validated)
```

- **No email/userId stored as commerce ownership anywhere**: `ownerEmail/buyerEmail/customerEmail/ownerPhone` etc. NONE FOUND; `userId` in order/booking/finance = audit actor only (`request.service.ts:280,699,884`, `payment.service.ts:167,312`).
- **Guest checkout: NONE FOUND.** All checkout routes behind `JwtAuthGuard + PermissionsGuard` with `sales.checkout.write` (`checkout.controller.ts:213-219`); public routes are GET-only browse; anonymous `supplier.create-request` creates a `TourRequest` with **zero identity fields**, no Customer/User/Order (`public-supplier.controller.ts:287-309`; `frontend/lib/supplier-api.ts:177,195-208`; AZAL `lib/flight-api.ts:142-146` bypasses `/api/v1` with no credentials).
- PDP anonymous CTA → `/login?next=…` (`frontend/app/products/[slug]/page.tsx:242-249`), comment "Checkout/Booking не создаются" (:23).
- **Communication continuity:** `Communication` has no `customerId` column; linkage = `contextType=CUSTOMER, contextId=customerId` (inbound `inbound.service.ts:582-583`, outbound `outbound.service.ts:219-225`) + `CommunicationThread.buyerCustomerId` (`schema.prisma:2819`); client cannot inject `customerId` (`communication.validation.ts:45`).
- Gap: `Request.customerId` accepted from staff clients **without existence validation** (`request.service.ts:238`); Support Case shows the correct pattern (`support.service.ts:90-93`).

## 8. Traveler / Passenger / Payer

### 8.1 Model separation (CONFIRMED — no runtime conflation)

| Concept | Model | Location | Identity fields |
|---|---|---|---|
| CRM customer | `Customer` | schema.prisma:1880 | email (required unique), phone (nullable) |
| Auth user | `User` | schema.prisma:2876 | username (unique), email (nullable unique) |
| Order traveler (sub-model) | `OrderTraveler` | schema.prisma:2280 | firstName/lastName/passport… + `customerId?` denormalized copy :2284 |
| Booking pax | `Passenger` | schema.prisma:2607 | firstName/lastName/… — **no customerId, no userId** |
| Quote pax | `QuoteTraveler` | schema.prisma:3709 | no identity refs |
| Checkout draft pax | `CheckoutIntentTraveler` | schema.prisma:3989 | no identity refs |
| Payment payer | — | **no `Payer` model** — payer = denormalized snapshot on `Payment`/`Sale` |

No model named `Traveler` or `Payer` exists. Passengers/travelers never create or link Users or Customers.

### 8.2 Violations (all outside runtime)

1. `legacy/src/lib/legacy-db.ts` + `legacy/prisma/seed.ts` — legacy stack, not imported by runtime.
2. Dormant `createStaff(customerId)` — `security.service.ts:462` accepts `customerId`, but HTTP route hard-codes `customerId: undefined` (`users.controller.ts:160-163`); unused outside unit tests.
3. `OrderTraveler.customerId` (`schema.prisma:2284`) — intentional denormalization copied from Order (`order.service.ts:516`); documented.
4. `TravelerInput` DTO blocks `customerId` — traveler DTO exposes no customer fields.

**Verdict: boundaries hold. M4 may proceed without touching traveler/passenger flows.**

## 9. WhatsApp M3 Resolver-Relevant Behavior (frozen)

### 9.1 Phone extraction

- `extractCanonicalPhone(raw)` — `backend/src/integrations/whatsapp/inbound/inbound.service.ts:77-92`: strips `+`, digits, `994`/`00994` → `9XXXXXXXXX`, leading `0` → drop, require 9–15 digits, else `null`. Thin wrapper over `shared/phone/phone.ts` (`toE164Az`/`normalizePhone`).

### 9.2 Lookup + matching

- `findCustomerIdsByCanonicalPhone(canonical)` — `inbound.service.ts:96-108`: queries **all Customers**, normalizes each `phone` via `toE164Az` in JS, collects ids. **Full scan, in-memory filter** (no DB index on phone).
- `matchCustomer(canonical, customerIds)` — `inbound.service.ts:463-488`, **private function**:
  - 0 ids → `{status:"UNMATCHED", customerId:null}`
  - 1 id → `{status:"MATCHED", customerId}` + confidence/note
  - >1 id → `{status:"AMBIGUOUS", customerId:null}` + candidate ids in note
- Persisted on `WhatsAppConversation` (`schema.prisma:5515` `WhatsAppMatchingStatus`: `UNMATCHED|MATCHED|AMBIGUOUS`; `customerId?`, `matchNote?`, `matchedAt?`).
- Lifecycle (`inbound.service.ts:110-160`): find-or-create conversation by `waJid` → match → store status → set `Conversation.customerId` on first successful match.
- Manual link: `POST /whatsapp/conversations/:id/customer` (`conversations.service.ts:260-352`) — perm `whatsapp.conversation.manage`, audit, `matchNote:"manual"`.
- **No unlink endpoint** — confirmed absent.
- Outbound: `sendManual` takes raw phone `to`, `toE164Az` at edge, created Message gets `customerId:null` (`outbound.service.ts:219-225`) — outbound never resolves a Customer by phone.

### 9.3 FROZEN scope (M3 freeze list — do not refactor)

Provider/Baileys layer (`integrations/whatsapp/provider/*`), `baileys-loader.ts`, inbound pipeline (dedup/STOP/ordering), `matchCustomer` behavior + statuses, RBAC/audit wiring, media persist + timeline (`mediaFilename/mediaPath/hasMedia`), `whatsapp-m3.e2e-spec.ts:369-440` regression guard.

**M4 implication:** phone→Customer resolution is **WhatsApp-private and not reusable as-is** — extracting it to a shared module is the M4 step, but must be behavior-preserving (covered by the M3 e2e guard).

## 10. Frontend Identity Assumptions

| Area | Evidence |
|---|---|
| Login | `app/login/page.tsx:30,80-86` — single `username` field, label «Логин»; no phone/email toggle |
| Register | `app/register/page.tsx:29-33,95-106,142` — email mandatory, no country/phone inputs |
| Session user | `lib/api.ts:41-53` `AuthUser` — **no phone field**; `lib/use-user.ts:22-66` |
| Logout/401 | `lib/api.ts:55-64` clear + redirect |
| Profile | `app/account/profile/page.tsx:9-11` — «email — канонический identity»; email editable, phone absent |
| Routes | **No `/checkout` route** (`app/` glob: cart/checkout absent) |
| WhatsApp link UI | conversation ↔ Customer **link** control present, **no unlink button** (matches API) |
| i18n | no `register.phone`/`register.country` keys (`lib/i18n.tsx` grep) |
| Partner form | only country/phone UI: `app/become-a-partner/page.tsx:83,160-166` |

Frontend has **zero** phone-input or country-selector components outside the partner form.

## 11. Tests / Verification State

| Suite | Command | Result | When |
|---|---|---|---|
| Backend unit/integration | `npx jest --runInBand` | **130 suites / 2085 tests PASS** (run twice) | this session |
| Backend typecheck | `npx tsc --noEmit` | clean | this session |
| Frontend unit | `npx vitest run` | **53 files / 937 tests PASS** | this session |
| Frontend typecheck | `npx tsc --noEmit` | clean | this session |
| Backend e2e (99 suites) | `npm run test:e2e` | **NOT RUN — forbidden**: global setup drops/recreates test DB (state-mutating) | — |

M3 freeze regression: `backend/test/whatsapp-m3.e2e-spec.ts:369-440` (must stay green in M4).

Post-M3 fix verified: `conversations.service.ts:236` outbound `messageType` now `"document"` when media present (was hardcoded `"text"`); typecheck + 6 conversation tests green.

## 12. Doc vs Code Discrepancies (M4-relevant)

| # | Doc claim | Code reality |
|---|---|---|
| D1 | **A-29 / M4 prompt**: «phone = strong identifier» | **ADR-0003 (ACCEPTED, `docs/adr/ADR-0003-buyer-customer-mapping.md:87-88`)**: canonical Customer key = normalized **email**; phone = secondary. Direct conflict → ADR decision required before code |
| D2 | M4 prompt: Customer Resolver «shared» | No shared resolver exists; only WhatsApp-private match (`inbound.service.ts:463-488`) + email-keyed `ensureCustomerForBuyer` (`auth.service.ts:106`) |
| D3 | M4 prompt: register collects country/phone | DTO `auth.controller.ts:20-50` + UI `register/page.tsx` — neither field exists |
| D4 | M4 prompt: phone login | Login = username only (`auth.controller.ts:52-58`) |
| D5 | M4 prompt: guest checkout | No checkout route; checkout staff-only (`checkout.controller.ts:213-219`) |
| D6 | M4 prompt: activation/OTP delivery | Notification layer **0 matches** (no mail transport, no SMS) — delivery channel undefined |
| D7 | ADR-0003 «email canonical» | `Customer.email` unique **case-sensitive** + one non-normalizing write path (`crm.service.ts:92-93`) → case-variant duplicates possible |
| D8 | `M0-03-assumptions-register.md:37`: WhatsApp phone matching | Implemented as described — but full-scan + `AMBIGUOUS` on phone formats; A-29 treats phone as strong identifier anyway |
| D9 | `M3-GATE-REPORT.md` / media docs | Matches code (media columns, `/media/:origin/:id`, document messageType) — no drift |

## 13. Read-Only Compliance

- Modified files: **only** this report (`M4-PRE-IMPLEMENTATION-AUDIT.md`, untracked deliverable).
- No schema/migration/config/source/test edits. No `prisma migrate` commands. No formatters. No commits/pushes.
- Tests run: backend jest + frontend vitest + both `tsc --noEmit` (read-only). e2e skipped (destructive setup) — listed as a pre-M4 verification item.
- Earlier in session (WhatsApp media feature, before this audit task): `conversations.service.ts:236` messageType fix + migration `20261003220000_whatsapp_media_files` were written — M3 work, tested, part of the dirty baseline (§2).

## 14. Verdict

**READY WITH REQUIRED CHANGES.**

Blockers before M4 coding starts (process/decision, not code defects):

1. **Dirty baseline**: 61 changed paths (whole M1–M3 WhatsApp implementation) uncommitted. M4 must not stack on an uncommitted baseline — commit M3 first (explicit user approval required).
2. **Identity-key decision**: A-29 «phone strong» vs ADR-0003 «email canonical» — needs a superseding ADR (M4 defines `User.loginPhone` + `CustomerResolver`; email Customer-uniqueness stays or is relaxed).
3. **Delivery channel undefined**: activation link / OTP / password-reset delivery has zero infrastructure (no mail/SMS provider). M4 must ship delivery or scope it out explicitly.

Non-blocking but required design decisions: registration country/phone fields (DTO+i18n), phone login lookup + fallback, guest checkout scope (no checkout UI exists), WhatsApp unlink endpoint, resolver extraction location + behavior-parity guarantee.

## 15. M4 Changes — Identity Model

Required changes to `backend/prisma/schema.prisma` (new migration only; never `prisma migrate dev`):

1. `User.loginPhone String? @unique` — login identity. Keep `username` (existing unique) for back-compat; login accepts username **or** loginPhone.
   - Backfill: `UPDATE security.User SET "loginPhone" = …` from `Customer.phone` via `customerId` where canonical-normalizable and unique.
2. `User.country String?` — registration country (ISO) if kept on User (alternative: Customer — decide in ADR).
3. **Do NOT** make `Customer.phone` unique at DB level (existing multi-format duplicates → migration failure). Use normalized shadow column `Customer.phoneCanonical String?` + partial unique index, or resolver-side dedup before write.
4. `Customer.email` stays required+unique unless ADR-0003 is superseded; default plan: **keep email required** for created customers, allow phone-primary **login** without changing Customer uniqueness.
5. No FK changes on `Request/Order/Booking.customerId` (out of M4 scope).

## 16. M4 Changes — Common Customer Resolver

1. Extract from `backend/src/integrations/whatsapp/inbound/inbound.service.ts`:
   - `findCustomerIdsByCanonicalPhone` (:96-108), `matchCustomer` (:463-488), `extractCanonicalPhone`/`shared/phone/phone.ts` → new `backend/src/shared/customer-resolver/` (or `modules/identity/`), exported `resolveCustomer({phone?, email?, userId?})` → `UNMATCHED | MATCHED | AMBIGUOUS | CONFLICT` with candidate ids.
   - Behavior-preserving: WhatsApp imports the extracted function; M3 e2e `whatsapp-m3.e2e-spec.ts:369-440` must stay green (extraction = refactor, statuses unchanged).
2. Email path delegates to `ensureCustomerForBuyer` semantics (create-or-link by normalized email) — `crm.service.ts:338`.
3. Call sites to migrate onto the resolver (order): WhatsApp inbound (`inbound.service.ts`), register (`auth.service.ts:106`), CRM create paths (:90/:1484/:1676 — dedup guard), future checkout.
4. Add DB index on `Customer.phone` (or canonical shadow column) — current full scan (:96-108) does not scale.
5. AMBIGUOUS: never auto-link; staff resolution via existing manual link (`conversations.service.ts:260`); add **unlink** endpoint (new, additive).

## 17. M4 Changes — Auth Flows

1. **Register** (`auth.controller.ts:20-50` DTO + `auth.service.ts:62-129`): add `country` (ISO) + `phone`; normalize via `shared/phone/phone.ts`; store `User.loginPhone` + `Customer.phone` (+ `phoneCanonical`); keep `username = email` default; forbidden-keys list unchanged.
2. **Phone login**: extend login DTO with `identifier` (username/email/phone) or add `phone`; lookup order: username → loginPhone (canonical) → legacy email-as-username; keep case-insensitive fallback (`auth.service.ts:239-248`); throttle keying (`login-throttle.service.ts`) must consider the new field.
3. **Frontend**: `app/login/page.tsx` identifier field; `app/register/page.tsx` country select + phone input + i18n keys (`lib/i18n.tsx`); `AuthUser` gains `phone` (`lib/api.ts:41-53`); profile phone display/edit.
4. **Activation/OTP** (scoped unless delivery decided): define token model + endpoints; without delivery channel, ship admin/manual activation only and document.
5. Password reset: currently admin-only — keep unless M4 scope adds self-service.

## 18. M4 Changes — Checkout / Guest

1. **Guest checkout does not exist** — M4 either (a) creates it (new public `CheckoutIntent`-based flow keyed by email+phone → resolver → `Order.customerId`), or (b) explicitly defers. Net-new surface; no existing code to modify.
2. Staff checkout (`checkout.controller.ts`) — no change beyond resolver-backed customer resolution.
3. Communication linkage (`contextType=CUSTOMER`) follows resolved Customer automatically — verify after resolver swap.

## 19. Must-Not-Touch (M3 freeze)

- `backend/src/integrations/whatsapp/provider/**`, `baileys-loader.ts`
- Inbound pipeline: dedup, STOP/START, ordering (`inbound.service.ts` — import refactor only, no behavior change)
- `matchCustomer` statuses + `WhatsAppMatchingStatus` enum values
- Media layer: `/whatsapp/uploads`, `/media/:origin/:id`, `mediaEmitChain`, timeline `hasMedia/mediaFilename` (`conversations.service.ts:155,236`)
- RBAC guards/audit logging wiring
- `backend/test/whatsapp-m3.e2e-spec.ts` contracts (:369-440)
- `legacy/**` — read-only reference, never modify

## 20. Evidence Index (key file:line)

| Claim | Evidence |
|---|---|
| Login = username | `backend/src/security/auth/auth.service.ts:239-248`, `auth.controller.ts:52-58,195-211` |
| No phone on User | `backend/prisma/schema.prisma:2876-2909` |
| Customer email required/unique, phone nullable | `schema.prisma:1887-1888` |
| Email-keyed customer creation | `backend/src/modules/crm/crm.service.ts:92,345,398,1516,1702` |
| Register = email only | `auth.controller.ts:20-50`, `auth.service.ts:62-129`, `frontend/app/register/page.tsx:46,95-106` |
| WhatsApp phone match (private) | `integrations/whatsapp/inbound/inbound.service.ts:77-108,463-488` |
| Manual link, no unlink | `integrations/whatsapp/conversations/conversations.service.ts:260-352` |
| No guest checkout / no /checkout | `checkout.controller.ts:213-219`, frontend `app/` glob |
| No notification layer | repo-wide grep (nodemailer/smtp/sendgrid/SMS) = 0 runtime hits |
| ADR-0003 email canonical | `docs/adr/ADR-0003-buyer-customer-mapping.md:87-88` |
| Tests green | jest 130/2085, vitest 53/937, tsc clean (this session) |
| Dirty baseline | `git status --short` → 61 paths, HEAD `28c4dcd` |

