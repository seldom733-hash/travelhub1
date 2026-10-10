# M4 IMPLEMENTATION PROMPT — PHONE-FIRST CUSTOMER IDENTITY (generated from M4_PRE_CODING_ARCHITECTURE_DECISION + M4-PRE-IMPLEMENTATION-AUDIT)

**Status:** READY TO IMPLEMENT — architecture approved (`docs/adr/ADR-0016-phone-first-customer-identity.md`, §22 of decision doc), M3 baseline committed, working tree clean.
**Authoritative inputs (in priority order):**
1. `docs/prompts/M4_PRE_CODING_ARCHITECTURE_DECISION.md` — approved target architecture.
2. `M4-PRE-IMPLEMENTATION-AUDIT.md` — verified repo state with file:line evidence.
3. `docs/adr/ADR-0016-phone-first-customer-identity.md` — ADR-0003 supersession (identity-key clause only).
4. `docs/prompts/M4_PHONE_FIRST_CUSTOMER_IDENTITY_PROMPT.md` — original requirements **except where contradicted by 1–3** (e.g. do NOT assume checkout exists, do NOT assume activation delivery exists).

**Owner decisions already fixed:**
- Activation/OTP = **option B** (mechanics only, delivery deferred, documented; no fake activation, no operator-set passwords).
- M3 baseline committed (`2c75467` + 6 commits) — never stack on a dirty tree.
- ADR-0003 conflict resolved via ADR-0016 — do not re-litigate in code.

This prompt covers **M4.1 → M4.2** (identity foundation + common resolver). M4.3–M4.6 follow in separate prompts once M4.1/M4.2 gate passes.

---

## 0. Ground rules (non-negotiable)

- Never run `prisma migrate dev` (shadow-DB drift); write migration SQL by hand + `migrate deploy`.
- Generated Prisma client is gitignored (`backend/src/generated/`) — run `npx prisma generate`.
- No ESLint runs; verify with backend `npx tsc --noEmit` + `npx jest --runInBand`, frontend `npx tsc --noEmit` + `npx vitest run`.
- No commits unless the project owner asks.
- M3 freeze list (decision §7): Baileys provider, QR/session lifecycle, inbound dedup, STOP/START, ordering, matching statuses, media, RBAC, audit, Communication history — **behavior must remain byte-identical**; only the identity-resolution boundary may change. `backend/test/whatsapp-m3.e2e-spec.ts:369-440` must stay green.
- Never modify `legacy/**`.

---

## M4.1 — Identity foundation

### 1. Phone canonicalization (exists — reuse, don't rewrite)

- `backend/src/shared/phone/phone.ts` (`toE164Az`, `normalizePhone`) is the **single** E.164 normalizer across channels. Add a generic E.164/AZ helper only if gaps are proven; keep `extractCanonicalPhone` (`integrations/whatsapp/inbound/inbound.service.ts:77-92`) delegating to it.

### 2. Schema / migration (new migration dir, hand-written SQL)

Target (ADR-0016 §2.1, §2.3):

```prisma
model User {
  // existing: username @unique (legacy), email String? @unique (contact)
  loginPhone String? @unique   // E.164 canonical; NULL until migrated
  country    String?           // ISO code, registration country (M4.3)
}
```

- **Do NOT** add `@unique` on `Customer.phone`. Instead add `Customer.phoneCanonical String?` (E.164, nullable) + `@@index` and a **partial** unique index (`WHERE "phoneCanonical" IS NOT NULL`) — only after inspecting real data for duplicates (decision §6: "after inspecting real data"). First run a read-only duplicate report query; if partial unique fails on existing data, ship indexless `phoneCanonical` + resolver-side dedup in M4.1 and constraint in M4.6.
- `Customer.email @unique` stays untouched (decision §3).
- Migration must be idempotent-guarded per repo convention (see `20260912180000_constructor_foundation_remediation` pattern).

### 3. Backfill (conservative, no invention)

- Script/report (dry-run first, admin command or one-shot script — match `repairBuyerCustomers` pattern in `security.service.ts:385-440`):
  - For `User` with `customerId` → `Customer.phone`: normalize; set `User.loginPhone` **only if** canonical is valid AND no other User already owns it; set `Customer.phoneCanonical`.
  - Users without an unambiguous canonical phone → left NULL (decision §17: do not invent, do not merge by FIO).
  - Admin (`username=admin`, `email=null`, no phone) → `loginPhone=NULL`, still logs in via legacy username.
- Never overwrite a non-null `loginPhone`.

### 4. Login compatibility layer (no behavior change yet)

- Introduce a single lookup helper in `auth.service.ts` (near :235-248) that resolves `identifier` → User by: exact `username` → case-insensitive `username` → exact `loginPhone`. Login DTO gains optional `loginPhone`/`identifier` handling but **existing username login must behave identically** (throttle keying in `login-throttle.service.ts` must incorporate the new field without weakening current limits).
- JWT payload unchanged (`sub, username, role, tv`) — `username` stays the session identity.

### 5. Tests (M4.1)

- Unit: canonicalization edge cases (AZ +994/0/00 prefixes, invalid lengths), backfill dry-run/real (unique collision, NULL cases), login lookup precedence.
- Migration verification: clean-DB `migrate deploy` + existing-DB idempotent re-run (CI does clean-DB; local does re-run).

**M4.1 gate:** typecheck clean, backend+frontend suites green, whatsapp-m3 e2e contract untouched, migration idempotent, backfill dry-run report produced.

---

## M4.2 — Common Customer Resolver

### 1. Extract (behavior-preserving refactor)

New module `backend/src/shared/customer-resolver/` (or `modules/identity/` — pick one, justify in code comment only if repo convention demands):

- Move/port from `integrations/whatsapp/inbound/inbound.service.ts`:
  - `findCustomerIdsByCanonicalPhone` (:96-108),
  - `matchCustomer` (:463-488) — the 0/1/>1 branch,
  - keep statuses `UNMATCHED | MATCHED | AMBIGUOUS` identical (enum `WhatsAppMatchingStatus` stays as-is; resolver returns the same status vocabulary — do NOT add new enum values in M4.2).
- Exported API (channel-independent, decision §5):

```ts
resolveCustomer(input: { phone?: string; email?: string; userId?: string }):
  Promise<{ status: "UNMATCHED" | "MATCHED" | "AMBIGUOUS"; customerId: string | null; candidates?: string[]; note?: string }>
```

- Rules: phone is the resolver key; email path delegates to `ensureCustomerForBuyer` semantics (`crm.service.ts:338`, CRM-owned write only — ADR-0003 п.3 still in force per ADR-0016 §1); FIO is verification-only signal, never a merge key.

### 2. Rewire entry points (one at a time, tests each)

1. WhatsApp inbound: `inbound.service.ts` calls the shared resolver — diff must show pure extraction, M3 e2e green.
2. Register (`auth.service.ts:106`): resolve-before-create — existing Customer by canonical phone is **reused** (link, not duplicate); email path unchanged.
3. CRM create paths (`crm.service.ts:90`, `:1484`, `:1676`): duplicate-prevention guard on canonical phone (reject/link instead of create when `phoneCanonical` matches).
4. Manual link endpoint stays (`conversations.service.ts:260-352`); **add unlink** endpoint (new, additive, `whatsapp.manage` + audit) — decision doc §M4 audit required-changes.

### 3. AMBIGUOUS policy

- Never auto-link, never auto-merge. Surfaced to staff (existing Inbox candidate UI + manual link; unlink now possible).
- Log/audit both link and unlink with actor.

### 4. Performance

- The full scan (`inbound.service.ts:96-108`) is acceptable only while index missing; once `phoneCanonical` index ships, switch lookup to indexed query on `phoneCanonical` with legacy-scan fallback for NULL-canonical rows (documented).

**M4.2 gate:** resolver covered by unit tests incl. 0/1/>1 + email-reuse + phone-reuse; whatsapp-m3 e2e green; no new matching statuses; no auto-merge possible by construction (test: same FIO, different phone → no merge).

---

## M4.3+ (preview — separate prompts)

- **M4.3 Auth/Registration:** register DTO+UI gains `country, phone` (i18n keys `register.*`), `loginPhone = phone`; phone login UI (`app/login/page.tsx` identifier field); `AuthUser.phone` (`lib/api.ts:41-53`); profile display. Activation mechanics token model per option B (no delivery).
- **M4.4 WhatsApp:** common resolver adoption on top of M4.2, onboarding (WhatsApp-first → collect data → re-check → Customer; no forced website registration; activation link preferred, deferred), M3 freeze intact.
- **M4.5 Guest checkout:** net-new surface (audit: no `/checkout` route exists) — controlled sub-phase after identity core.
- **M4.6 Hardening:** races, duplicate prevention, migration verification, regression, browser smoke, M4 gate.

## Final architecture reminder (decision §21)

```text
Website / WhatsApp / Future → Customer Resolver → Customer → (User: loginPhone+password+email) & (Commerce: Request→Order→Booking via customerId)
Customer ≠ User ≠ Traveler ≠ Payer; phone ≠ commerce owner; email uniqueness retained.
```
