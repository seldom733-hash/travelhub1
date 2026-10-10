# M4 IMPLEMENTATION REPORT — PHONE-FIRST CUSTOMER IDENTITY

Status: **M4 FINAL PASS**

Date: 2026-10-04
Branch: `master` (all M4 work uncommitted, awaiting owner review — nothing pushed)

---

## 1. Executive summary

M4 implemented phone-first customer identity end to end, in phases M4.0–M4.6 per
`docs/prompts/M4_FINAL_IMPLEMENTATION_PROMPT.md`:

- **Schema**: `User.loginPhone` (unique, canonical E.164), `User.country`,
  `Customer.phoneCanonical` (+ index), `ActivationToken` mechanics model — with two
  hand-written SQL migrations applied via `prisma migrate deploy`.
- **Customer Resolver**: one shared, pure resolver (`shared/customer-resolver`) used by
  CRM, WhatsApp inbound, registration and guest checkout. Phone is the primary key,
  email a contact/reuse attribute, FIO never a merge key. Statuses stay
  `UNMATCHED | MATCHED | AMBIGUOUS` — no auto-merge, ever.
- **Auth**: phone+password login with legacy-username compatibility path, login
  throttling, phone-first registration UI (country → phone → FIO → email → password),
  activation-token mechanics per owner decision **option B** (mechanics only, no delivery
  provider, no operator-invented passwords).
- **WhatsApp**: first-contact onboarding endpoint (resolver → Customer create/reuse →
  conversation link), covered by new e2e.
- **Guest checkout**: public `POST /api/v1/checkout/guest` (anonymous → resolver →
  Customer create/reuse → Request) + storefront UI form on product detail pages.
  Server-authoritative price (guest never supplies money), staff Quote→Sale→Order
  pipeline for conversion.
- **Race hardening (§11)**: Postgres advisory identity locks in all four
  `Customer`-creation paths + deterministic `P2002 → 409` mapping (no HTTP 500 on
  concurrent identity races), with an e2e race test proving *exactly one* Customer.
- **Gates**: backend `tsc`/`jest` green (133 suites / 2152 tests), frontend
  `tsc`/`vitest` green (53 files / 937 tests), M4 e2e suites green, M3 freeze green,
  migrations clean, browser smoke green.

All failing tests found during the final regression were **verified to fail identically
on the baseline commit** and are listed in §13/§18 as pre-existing, not M4-scoped.

## 2. Exact baseline commit

```text
branch     master
HEAD       0d7de62 — "docs(m4): pre-coding architecture decision, audit prompt and completed audit"
baseline   0d7de62 (M3 FINAL PASS state, 12 commits ahead of origin/master — not pushed)
```

Baseline was verified per M4.0 (branch/HEAD/M3-present/M3-gate). A baseline worktree is
available at `D:\travelhub_baseline` (used only to prove pre-existing test failures).

## 3. Files changed

`git diff 0d7de62` → **35 tracked files changed: +1620 / −123**; **17 new (untracked)
files**. Summary by area:

Modified (tracked):

```text
backend/prisma/schema.prisma
backend/src/app.module.ts
backend/src/modules/crm/crm.service.ts                  (resolver guards, M4.6 locks)
backend/src/modules/crm/crm.controller.ts
backend/src/modules/crm/crm.service.intake.spec.ts
backend/src/modules/order/request.service.ts            (Actor.id widened to null)
backend/src/modules/order/order.service.ts              (Actor.id widened to null)
backend/src/security/auth/auth.service.ts               (phone precedence, register, audit)
backend/src/security/auth/auth.controller.ts
backend/src/security/security.service.ts                (loginPhone backfill)
backend/src/security/security.module.ts
backend/src/security/account/account.service.ts
backend/src/security/users.controller.ts
backend/src/shared/login-throttle.service.ts            (normalizeLoginKey, bounded cleanup)
backend/src/shared/login-throttle.spec.ts
backend/src/integrations/whatsapp/conversations/conversations.service.ts   (onboardCustomer)
backend/src/integrations/whatsapp/conversations/conversations.service.spec.ts
backend/src/integrations/whatsapp/inbound/inbound.service.ts               (resolver delegation)
backend/src/integrations/whatsapp/whatsapp-conversations.controller.ts     (POST onboard)
backend/src/integrations/whatsapp/whatsapp.module.ts                       (CrmModule import)
+ 15 spec files touched for updated mocks/assertions (catalog/marketing/support/…)
frontend/app/login/page.tsx
frontend/app/register/page.tsx
frontend/app/account/profile/page.tsx
frontend/app/account/layout.spec.tsx
frontend/app/products/[slug]/page.tsx                   (guest checkout placements)
frontend/lib/account-api.ts
frontend/lib/api.ts
frontend/lib/i18n.tsx                                   (checkout.*/auth i18n keys)
frontend/lib/public-api.ts                              (guestCheckout API)
```

New (untracked):

```text
backend/prisma/migrations/20261004100000_m4_phone_first_identity/migration.sql
backend/prisma/migrations/20261004120000_m4_activation_token_mechanics/migration.sql
backend/src/shared/customer-resolver/customer-resolver.ts (+ .spec.ts)
backend/src/security/activation.service.ts
backend/src/modules/checkout/checkout.module.ts
backend/src/modules/checkout/guest-checkout.service.ts (+ controller, spec)
backend/src/modules/crm/m4-phone-identity.spec.ts
backend/test/m4-phone-auth.e2e-spec.ts
backend/test/m4-whatsapp-onboarding.e2e-spec.ts
backend/test/m4-guest-checkout.e2e-spec.ts
frontend/components/public/GuestCheckoutForm.tsx
docs/adr/ADR-0016-phone-first-customer-identity.md      (ADR — §32)
docs/prompts/M4_FINAL_IMPLEMENTATION_PROMPT.md, M4_IMPLEMENTATION_PROMPT.md (owner docs)
```

## 4. Schema / migration changes

| Migration | Contents |
|---|---|
| `20261004100000_m4_phone_first_identity` | `User.loginPhone TEXT UNIQUE` (+ partial index semantics via `@unique`), `User.country`, `Customer.phoneCanonical` + `idx_customer_phone_canonical` |
| `20261004120000_m4_activation_token_mechanics` | `security.ActivationToken` table (`tokenHash` unique, `expiresAt`, `usedAt`, `issuedBy`), `User.activationTokens` relation |

Rules honored (§27/§8): hand-written SQL only, `npx prisma migrate deploy` only
(never `migrate dev` in the flow), no invented phone numbers, no silent merges —
backfill endpoints (`security` loginPhone backfill, `crm.backfillPhoneCanonical`) are
idempotent, report conflicts instead of merging, and were run/verified in e2e.

`Customer.phone` was **intentionally NOT made `@unique`**: the data audit found real
duplicate/format-divergent values (documented in ADR-0016 and migration comments);
uniqueness is enforced going forward by resolver guards + M4.6 advisory locks, and the
constraint remains deferred until a data-dedup decision (§19).

## 5. Customer Resolver design

`backend/src/shared/customer-resolver/customer-resolver.ts` — single pure module:

```text
resolveCustomer(db, { phone?, email? }) -> { customerId?, source: none|phone|email|username, status: UNMATCHED|MATCHED|AMBIGUOUS }
findCustomerIdsByCanonicalPhone(db, canonical) -> id[]     (incl. legacy rows w/o phoneCanonical)
```

- Normalization: only `normalizePhoneE164(raw, region)` (`shared/phone`) — one canonical
  E.164 representation; `normalizeEmail = trim().toLowerCase()`.
- Phone-first: canonical phone lookup wins; email is a deterministic fallback reuse key
  (unique constraint); FIO is never a key; AMBIGUOUS (>1 owners) → hard stop, no pick,
  no merge, no third duplicate.
- Consumers: CRM intake paths, WhatsApp inbound (`matchCustomer` delegates),
  registration (`ensureCustomerForBuyer`), guest checkout.
- Unit coverage: 15/15 resolver tests (0/1/>1 matches, normalization variants, legacy
  fallback, AMBIGUOUS, cross-owner email conflict).

## 6. Authentication changes

- Lookup precedence (documented §12 of the prompt + ADR-0016 + code comments):
  `canonical phone → User.loginPhone` first; `username` (incl. literal email input) →
  legacy compatibility path; email never becomes a login identity.
- All passwords/session mechanics/HttpOnly-cookie/`tokenVersion` revocation unchanged.
- Throttling: same sliding window, key = `normalizeLoginKey(identifier)|ip`
  (canonical phone collapses all formatting variants); bounded map cleanup.
- Audit: `auth.login` records `details.via` (login method) — phone PII deliberately kept
  out of audit details (§33).
- Activation (option B): `ActivationToken` issue (plaintext returned exactly once in the
  response, SHA-256 hash stored, single-use `usedAt`, expiry, `issuedBy` audit),
  `POST /auth/activate`. No delivery provider, no operator-set passwords, no fake
  delivery.

## 7. Registration changes

- Phone-first register API/UI: `country` (ISO alpha-2) + `phone` + FIO + email +
  password; server normalizes to `loginPhone`/`phoneCanonical`, enforces duplicate
  phone/email deterministically (409), never accepts forged `customerId`/`role`
  (ValidationPipe whitelist).
- Customer creation/reuse via `ensureCustomerForBuyer` (resolver rules), atomic with
  User creation in one transaction; `Customer` ≠ `User` boundary preserved.
- Frontend `/register`: country selector (COUNTRY_NAMES) → phone → FIO → email →
  password with client-side coarse checks (server authoritative); auto-login after
  register; phone-first `/login` field (placeholder +994 …) with legacy username still
  accepted; profile page can manage phone; i18n ru/az/en.

## 8. WhatsApp integration

- `POST /api/v1/whatsapp/conversations/:id/onboard` — first-contact onboarding:
  shared resolver → MATCHED reuse / UNMATCHED create (CRM-owned) / AMBIGUOUS → explicit
  manual-linking refusal; conversation linked to the resolved Customer; audit without
  PII.
- `whatsapp.module` now imports `CrmModule`; inbound `matchCustomer` delegates to the
  shared resolver (no duplicated matching logic).
- M3 contracts untouched: `whatsapp-m2` and `whatsapp-m3` e2e green in the final gate.

## 9. Guest checkout status

Implemented (§23/§24/§28):

- `POST /api/v1/checkout/guest` — `@Public`, per-IP throttle (10 fails/15 min → 429),
  DTO-validated (400/422), whitelist strips forged fields, product existence check
  before any write (404), resolver → Customer **create/reuse** (never merge) →
  `Request` in `NEW` with `quantity`/`travelerCount` defaults, `displayedPrice = null`,
  `displayedCurrency = "AZN"` (server constant `GUEST_CHECKOUT_CURRENCY`; guest never
  supplies money), history actor `guest-checkout`/`actorId = null`, audit
  `checkout.guest_created` with no PII.
- Customer-only identity: guest creates **no User** (registration not forced, option B
  forbids invented passwords; §10 no forced registration).
- Staff conversion: propose-price → customer-accept → convert → canonical `Order` with
  the guest `customerId` as commerce owner; traveler PATCH creates no `User`.
- No `CheckoutIntent` in the guest path: guest checkout is the §23 Request→Order flow;
  staff Quote→Sale pipeline remains the commercial path (documented decision, see §18).
- Frontend: `GuestCheckoutForm` on product detail pages (tour + non-tour placements),
  success panel with request reference, 409/429/422/404-specific error messages
  (ru/az/en), price never sent.

## 10. Activation/OTP status

- Mechanics complete (owner option B): issue/consume/expiry/single-use/hash-only
  storage + audit (`account.activation_issued`, `account.activation`).
- Delivery **deferred** (SMS/e-mail/WhatsApp-link provider is an external dependency
  decision); no code pretends to send anything; report of the endpoint response carries
  the plaintext token exactly once for wiring by a future delivery phase.

## 11. Notification layer status

Unchanged from M3: existing notification architecture continues to apply; M4 added no
new delivery channels. Phone-first identity means future channels can key on canonical
phone / `loginPhone`. Activation delivery integration point documented in §10.

## 12. Security changes

- Login rate limiting extended (throttle key normalization), no bypasses.
- Whitelist/validation on all new endpoints; guest endpoint is public-only by explicit
  `@Public` annotation; `PermissionsGuard` behavior unchanged.
- Audit (§33) — what exists now:

```text
auth.login                 (details.via only — no phone PII)
auth.register, auth.logout, account.profile_updated (profile phone edits)
account.activation_issued / account.activation     (no secrets logged)
checkout.guest_created     (customerId/resolvedSource/productId — no PII)
CustomerHistory "created"  (every Customer write path)
Outbox event CustomerCreated (canonical refs only)
```

- Not emitted (considered, documented as gap in §19): dedicated `customer.resolved` /
  `customer.identity_conflict` AuditLog actions — conflicts currently surface as 409 +
  resolver status, guest flow records `resolvedSource`.
- Never logged: passwords, activation secrets/plaintext, session secrets (verified by
  e2e assertions on audit rows).

## 13. Tests (unit)

| Gate | Result |
|---|---|
| backend `npx tsc --noEmit` | **EXIT 0** |
| backend `npx jest --runInBand` | **133/133 suites, 2152/2152 tests PASS** |
| frontend `npx tsc --noEmit` | **EXIT 0** |
| frontend `npx vitest run` | **53/53 files, 937/937 tests PASS** |

M4-specific unit suites (all green): `customer-resolver.spec` (15),
`m4-phone-identity.spec` (CRM write paths, backfill, guards), `login-throttle.spec`,
`activation` coverage in auth specs, `guest-checkout.service.spec` (8),
`whatsapp.module.spec` onboard tests (9).

## 14. E2E

M4 suites (isolated test DB per suite, migrations applied from scratch each run):

| Suite | Result |
|---|---|
| `m4-phone-auth.e2e-spec.ts` | **10/10 PASS** (phone login, legacy login, duplicate phone/email, throttle, session revocation, forbidden fields, activation mechanics) |
| `m4-whatsapp-onboarding.e2e-spec.ts` | **9/9 PASS** (MATCHED/UNMATCHED/AMBIGUOUS, no User, conversation link) |
| `m4-guest-checkout.e2e-spec.ts` | **8/8 PASS** (validation/whitelist, onboarding без User, phone/email reuse, AMBIGUOUS 409, staff pipeline → Order + traveler, **M4.6 race: 5 concurrent → exactly 1 Customer, only 201/409**, throttle 429) |

§30 regression batch (19 suites, one invocation): **12 PASS / 7 FAIL** — the 7 failures
are pre-existing (see below).

- PASS: `whatsapp-m2`, `whatsapp-m3` (M3 freeze), `rbac-parity`, `auth-hardening`,
  `restart-persistence`, `validation-pipe`, `m4-phone-auth`, `m4-whatsapp-onboarding`,
  `m4-guest-checkout`, `buyer-identity`, `d3-traveler-collection`,
  `ui-c6-request-server-authority`.
- FAIL: `d3-request-flow`, `order-lifecycle-completion`, `auth-rbac`,
  `booking-lifecycle-completion`, `checkout-commercial-intent`,
  `order-creation-consumer`, `booking-requested-consumer` — **all 7 re-run at baseline
  `0d7de62` in the baseline worktree: same 7 suites fail, identical failing-test count
  (34 at baseline = 34 now), identical failing test names where printed** → pre-existing,
  outside M4 scope (§36: reported, not fixed).
- `rbac-catalog-crm` (separately re-run): 1/4 FAIL — the known pre-existing
  "ADMIN — positive control" failure, verified at baseline earlier in this effort.

## 15. Browser smoke (§31)

Executed against the running dev stack (backend restarted on new code — PID 21008,
port 4000; frontend :3000):

| Step | Result |
|---|---|
| Registration: country → phone → FIO → email → password → account | **PASS** — form validated (submit enabled), `POST /api/v1/auth/register` → **201**, auto-login, redirect `/account` |
| Login: phone → password → authenticated account | **PASS** — `0559876543` + password → landed `/account`, account endpoints 200 |
| Existing legacy account | **PASS** — `admin`/`admin123` (username path) → `/app/dashboard` |
| WhatsApp (browser leg) | **PASS** — `/app/whatsapp` admin inbox renders with resolver-state filters (Все / Без клиента / Привязаны / **Неоднозначные**) and conversations; the incoming-phone → resolver → Customer → conversation flow is covered by `m4-whatsapp-onboarding` e2e (browser cannot inject WhatsApp channel traffic) |
| Guest checkout: anonymous → onboarding → Request | **PASS** — PDP guest form → `POST /api/v1/checkout/guest` → **201**, UI success panel "Заявка создана, номер MKT-REQ-00000001" (Order conversion covered by e2e pipeline test) |

Smoke artifacts intentionally left in the dev DB for auditability: user
`m4smoke_20261004@test.local`, customers `m4smoke_20261004@test.local` /
`m4guest_smoke@test.local`, request `MKT-REQ-00000001`.

## 16. Migration verification

```text
npx prisma migrate status     → 108 migrations found; "Database schema is up to date!" (EXIT 0)
prisma migrate diff (DB → schema, --exit-code) → EXIT 2 with 4 pre-existing items
```

Drift items (all pre-existing, none M4-related):

```text
tables PartnerActiveCategory, RoomView (DB-only, absent from schema since before baseline)
RoomType.aliases column (DB-only)
SupplierGeoLink index name mismatch
```

Evidence they are pre-existing: `git log -S` shows these names never existed in
`schema.prisma`; migration SQL comments document them as "pre-existing dev-DB drift …
intentionally left untouched" since `20260926120000`; the M4 migrations contain zero
mentions of them; and the baseline schema lacks them too. The **M4 portion of the diff
is empty** — schema and DB agree on `loginPhone`/`country`/`phoneCanonical`/
`ActivationToken` exactly as migrated. e2e `globalSetup` re-applies all 108 migrations
from scratch on every run (further deploy verification).

## 17. M3 regression

| Check | Result |
|---|---|
| `whatsapp-m3.e2e-spec.ts` (§29 freeze) | **PASS** (run twice this session) |
| `whatsapp-m2.e2e-spec.ts` | **PASS** |
| `auth-hardening`, `rbac-parity`, `restart-persistence`, `validation-pipe` | **PASS** |
| M3 baseline commit still intact | `0d7de62` recorded; no M4 commit created (no owner authorization) |

## 18. Known limitations

1. **Pre-existing baseline failures (8 suites)** — reported, not fixed (§36):
   `rbac-catalog-crm` (ADMIN positive control) plus the 7 §30 suites in §14. All
   verified failing identically at `0d7de62`; common symptom family includes
   ADMIN/product-create 403 in Phase-2 era suites. Not M4-scoped.
2. **Login/guest throttle is in-memory, per-instance** (documented since Step 2.17);
   multi-instance deployment needs an external store.
3. **Activation delivery (option B)**: mechanics only — no SMS/e-mail/WhatsApp delivery
   provider; plaintext token returned once in the issue response.
4. **`Customer.phone` is not `@unique`** — real legacy duplicates exist; AMBIGUOUS
   resolver + advisory locks prevent new duplicates; constraint deferred (§4).
5. **Guest enumeration trade-off**: guest flow answers reuse/conflict states
   (`created:false` / 409) consistent with register's duplicate-409 behavior — parity
   with existing registration was chosen over stricter obfuscation (documented).
6. **`GUEST_CHECKOUT_CURRENCY = "AZN"`** server constant: guest requests display in
   AZN until staff proposes price in sale currency (order conversion gate still rejects
   money-less converts until propose/accept).
7. **No `CheckoutIntent` in the guest path** — deliberate (§9); staff commercial
   pipeline untouched.
8. **Throttle key ignores proxy chain** (`req.ip` as seen by Express) — behind a
   reverse proxy this needs `trust proxy` configuration (pre-existing property).
9. Dev environment: backend dev server was restarted to run M4 code (old PID 54660 →
   new PID 21008); log at `%TEMP%\opencode\backend-m46.log`.

## 19. Deferred work

- Fixing the 8 pre-existing baseline e2e failures (owner decision, outside M4 scope).
- `Customer.phone @unique` after a data-dedup pass (AMBIGUOUS groups exist in dev data).
- Dedicated `customer.resolved` / `customer.identity_conflict` audit actions
  (currently covered by 409 + `resolvedSource` in `checkout.guest_created`).
- Activation delivery provider + true OTP issuance flow (owner decision beyond option B).
- External (Redis/DB) throttle store for multi-instance scaling.
- Commits: **nothing committed** — 35 modified + 17 new files await owner review; the
  owner decides commit strategy (per §37 no push, no unrelated commits).

## 20. Final M4 verdict

Gate criteria (§35):

```text
phone-first identity functioning ................... PASS (unit + e2e + browser phone login)
Customer Resolver functioning ...................... PASS (unit 15/15 + e2e flows)
no duplicate Customer creation in covered flows .... PASS (guards + M4.6 advisory lock race e2e: exactly 1)
legacy compatibility verified ...................... PASS (legacy username login e2e + browser admin login)
M3 regression green ............................... PASS (whatsapp-m2/m3 + M3 gate suites)
auth/security tests green ........................ PASS (auth-hardening, m4-phone-auth, rbac-parity,
                                                           login-throttle; auth-rbac/rbac-catalog-crm
                                                           fail pre-existing at baseline — explained)
relevant commerce flows green ..................... PASS (guest pipeline → Order, d3-traveler-collection,
                                                           ui-c6-request-server-authority; checkout-commercial
                                                           intent failure pre-existing at baseline)
frontend green .................................... PASS (tsc EXIT 0, vitest 937/937)
migrations clean .................................. PASS (migrate status up to date; zero M4 drift)
browser smoke green ............................... PASS (§31 all steps, see §15)
no unexplained M4-scoped failures ................ PASS (every failure baseline-verified and documented)
```

**M4 FINAL PASS**

---

Per §37: report produced with exact test results, migration state, M3 regression state
and browser smoke state; nothing pushed; no unrelated commits created; stopping here —
the project owner decides the next stage.
