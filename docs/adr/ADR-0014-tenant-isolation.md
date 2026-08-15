# ADR-0014 — Database Tenant Isolation: Application Isolation Is Canonical; PostgreSQL RLS Deferred

- **Status:** ACCEPTED (2026-08-15)
- **Context:** Phase 2 Critical Platform Risks reconciliation (Risk 1 — PostgreSQL RLS / partner isolation).
- **Related:** ADR-0001 (modular monolith), ADR-0002 (auth/RBAC), ADR-0009 (correlation/request context), ADR-0010 (event envelope), Step 2.17A/2.17B/2.18 reconciliation entries.

## 1. Tenancy model (verified from repository)

TravelHub is a **single-deployment modular monolith** with **application-level row-owner isolation**, not per-tenant database/schema separation and not RLS:

- Actors carry server-authoritative identity: `AuthUser` exposes `role`, `partnerId`, `customerId`, `permissions` (`auth.service.ts`); forged identity fields (`role`/`partnerId`/`customerId`/`status`/`permissions` from body) are explicitly rejected at registration/login (`auth.controller.ts`).
- Partner-owned resources are scoped by `actor.partnerId` in service guards; BUYER-owned resources by `actor.customerId`; staff roles via RBAC permission checks.
- Mass-assignment is closed (`assertNoForbiddenKeys`, 422 on forged server-owned fields); IDOR covered by dedicated e2e suites (partner-scope, buyer-scope).
- No raw SQL outside Prisma; no repository-layer bypass.
- Background consumers run as `SYSTEM` actor with inbox-dedup idempotency.

## 2. Evidence of absence of RLS

- `grep -ril "ROW LEVEL SECURITY|CREATE POLICY" backend/prisma/` → 0 hits (schema + all 56 migrations).
- No `current_setting`/`SET LOCAL`/`app.current_tenant` session-context usage.

## 3. Threat model — bypass classes application isolation cannot fully cover

- Forgotten partner predicate on a new endpoint.
- Raw query or analytics/reporting path without scoping.
- A compromised service path that trusts client-supplied identity.
- Background consumer accidentally writing cross-partner.

These are mitigated today by: single Prisma write-layer, explicit `actor`-derived scoping, RBAC guards, forbidden-key rejection, and e2e IDOR coverage — but they are **process guarantees**, not database guarantees.

## 4. RLS costs/risks (why defer)

- Connection pooling + `SET LOCAL` session-context leakage between pooled connections.
- Cross-partner staff workflows (MODERATOR moderation, Finance read-across-partners, ADMIN) require RLS exceptions/policies per workflow — high complexity for a single-tenant-deployment marketplace.
- Global/shared tables (codes, currencies, policies) need explicit bypass policies.
- Migration/admin access and test complexity rise significantly.
- No evidence any application-path violation exists today (IDOR suites green).

## 5. Decision

**APPLICATION ISOLATION IS CANONICAL. PostgreSQL RLS IS DEFERRED WITH THIS ADR.**

- No RLS rollout before Phase 2 Exit; no RLS dependency for Payment/PSP (2.12A/2.12B).
- Deferral is reviewed at **Step 2.18 Phase 2 Exit Audit** (verification item added to 2.18 entry).
- If a concrete application-path isolation violation is ever found (IDOR regression, unscoped raw query, analytics leak), the decision is revisited immediately with a dedicated RLS hardening step — **not** buried in 2.17.

## 6. Unanswered structural questions (deferred, not decided)

- Whether pooled-connection session context (`SET LOCAL` per request) is compatible with the chosen pooler configuration.
- Policy matrix for staff cross-partner workflows (MODERATOR/FINANCE/ADMIN) if RLS is ever introduced.
- Whether Finance/Admin cross-partner reads should use a separate privileged role vs. policy exceptions.

## 7. Consequences

- None for 2.12A (PSP abstraction is finance-owned, not partner-row-scoped at DB level).
- 2.17 does NOT own an RLS rollout; it owns only the explicit verification that application isolation holds (per 2.17 scope).
