---
name: navitravel-backend
description: Navitravel backend engineering workflow — NestJS modules, Prisma 7 schemas/migrations, PostgreSQL schemas, finance invariants, and safe API changes. Use for backend features, data migrations, and service/controller changes in this repository.
---

# Navitravel Backend

Use this skill for `backend/` work in Navitravel.

## Start from the domain

- Read the existing module before changing it: controller → DTO → service → Prisma model.
- Respect PostgreSQL schema ownership: `catalog`, `geo`, `finance`, `order`, `crm`, `security`.
- Money, obligations, payments, refunds, and settlements are finance-domain invariants. Never recompute them casually or trust client-submitted prices.
- Prefer server-authoritative derivation for prices and state transitions.

## Change checklist

1. Find the existing pattern in the same module; extend it instead of inventing a parallel one.
2. Update Prisma schema and create a migration when persistence changes.
3. Keep DTO/query validation and permissions explicit.
4. Update or add focused Jest specs for calculation and permission edge cases.
5. Run `npm run build` in `backend/`.
6. If runtime verification is needed, restart the backend deliberately and check the exact endpoint.

## Prisma and migrations

- Prisma client is generated under `backend/src/generated/prisma`.
- Do not run destructive reset commands against the working database.
- This repository has historical failed migrations; `prisma migrate deploy` may refuse to continue. Verify before applying SQL manually and record what was applied.
- Keep migrations additive unless the task explicitly requires data deletion.

## Useful commands

```powershell
cd backend
npm run build
npx prisma generate
```

Tests are colocated as `*.spec.ts`; run the narrowest relevant suite first.

## Guardrails

- Do not change unrelated schemas or generated files.
- Do not silently swallow supplier/API failures; preserve the error path.
- Do not expose raw internal errors, secrets, or provider payloads to clients.
- Check that new query params are actually forwarded to the adapter/service that uses them.
