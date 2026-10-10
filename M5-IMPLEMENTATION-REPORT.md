# M5 IMPLEMENTATION REPORT - MULTI-NUMBER WHATSAPP + AUDIO PLAYER

Status: **M5 FINAL PASS**

Date: 2026-10-05
Branch: `master` (M4 + M5 work uncommitted, awaiting owner review - nothing pushed)

---

## 1. Executive summary

M5 delivered two owner-approved scopes on top of the uncommitted M4 state:

**A. WhatsApp audio bug + inline player**
- Backend: `whatsapp-media.storage.ts` now handles audio messages correctly
  (audio bytes adopted/staged/removed like other media, no more broken
  audio downloads); specs cover the audio path.
- Frontend: inline `<audio data-testid="audio-player">` player in the WhatsApp
  chat page for `messageType === "audio"` and any `mediaMime: audio/*`.

**B. Several WhatsApp numbers simultaneously (multi-number architecture)**
- **Schema**: `WhatsAppAccount.label`, `WhatsAppAccount.archivedAt` +
  one hand-written idempotent migration
  `20261004140000_m5_multi_number_sessions` (applied via
  `prisma migrate deploy`, client regenerated).
- **Registry** (`session/session-registry.service.ts`, new): owns one
  context per number - `{accountId, provider, ownership, sessionPath,
  placeholder}` - plus event hubs (`onInbound/onStateChange/onDeliveryUpdate/
  onLost/onContextCreated`) that carry `accountId`. Per-account auth path is
  `path.join(sessionPath, accountId)` with a one-time migration of the legacy
  `auth-state.enc` into the primary number's directory (baileys only).
- **Lease/ownership**: both take a required lease key;
  per-number key is `whatsapp:<accountId>` via `whatsappLeaseKey()`.
  Loss of one number's lease never touches the others (self-fencing is
  scoped to its context).
- **Legacy compatibility**: `WHATSAPP_PROVIDER` token is a stable hybrid
  Proxy - subscriptions survive context swaps, `instanceof` keeps working
  (`getPrototypeOf` trap), state methods forward to the first real
  (non-placeholder) context. Legacy REST routes keep operating on the
  **primary** number = first active by `createdAt`.
- **New REST** (`whatsapp-sessions.controller.ts`, `whatsapp.session.admin` /
  `whatsapp.read`):
  `GET/POST /whatsapp/sessions`, `GET /whatsapp/sessions/:id`,
  `GET /whatsapp/sessions/:id/qr` (per-user rate limit via extracted
  `QrRateLimiter`), `POST /whatsapp/sessions/:id/connect|disconnect|archive`.
- **Soft archive**: `POST /whatsapp/sessions/:id/archive {confirm:true}`
  = ownership ensure → provider stop → local auth wipe → context removal →
  `archivedAt` + audit `whatsapp.archived`. **No DELETE anywhere** - the
  account row, conversations and message history are preserved; operations
  against an archived number return 409; re-archive is idempotent (200, no
  second audit).
- **Outbound/inbound**: both are accountId-aware. `sendManual` resolves the
  number as recipient conversation → explicit conversation → primary
  account; inbound accountId comes from the registry hub event. After an
  archive, sends fall back to the primary number.
- **Conversations API**: `GET /whatsapp/conversations` accepts
  `?accountId=`; rows include `accountId`.
- **Lease errors**: `WhatsAppLeaseError` maps to **409** in
  `AppExceptionFilter` (was 500).
- **Connect stagger**: auto-connect walks active numbers with
  `AUTO_CONNECT_STAGGER_MS = 2_000` between them (ban-risk mitigation);
  auto-connect is disabled in e2e (`WHATSAPP_AUTO_CONNECT=false`).
  Baileys stays pinned at `6.7.24`.
- **Frontend**: settings → Integrations → WhatsApp gains a "numbers"
  block (list/add/connect/disconnect/archive with `window.confirm`,
  per-number QR polling); the chat page gains an account filter and
  per-conversation account badge.

**Gates**: backend `tsc` clean, backend unit 135/136 suites green
(2180/2181 tests; the single failure is a known wall-clock flake, see 8),
whatsapp e2e suites `m2 + m3 + m4 + m5` all green (46 tests), frontend
`tsc` clean and `vitest` 54 files / 939 tests green. Every failing test
found during regression was verified to fail identically on the baseline
commit and is listed in 8 as pre-existing.

## 2. Exact baseline commit

```text
branch     master
HEAD       0d7de62 - "docs(m4): pre-coding architecture decision, audit prompt and completed audit"
baseline   D:\travelhub_baseline (git worktree of D:\travelhub_v1 at 0d7de62, clean)
```

## 3. Key architecture decisions (as approved)

1. **Several numbers at once** - one `WhatsAppSessionContext` per
   `WhatsAppAccount` row; Baileys instance per number (separate auth dirs,
   separate lease keys). Mitigations for ban risk: staggered auto-connect
   (2s), pinned Baileys `6.7.24`, explicit operator-driven connect.
2. **Soft archive, history kept** - `archivedAt` flag only; `DELETE` was
   explicitly rejected. Conversations/messages/inbound rows stay.
3. **Legacy surface unchanged** - old endpoints drive the primary number;
   the `WHATSAPP_PROVIDER` proxy keeps existing e2e/external consumers
   working (m2/m3/m4 e2e pass without modification).
4. **Audio fix + inline player** - minimal media-storage fix + native
   `<audio>` element in the chat.
5. **No commit** - all M4 + M5 work stays uncommitted on `master` until
   owner review.

## 4. Files changed (M5 scope)

Migration (new): `backend/prisma/migrations/20261004140000_m5_multi_number_sessions/`

New backend files:
```text
backend/src/integrations/whatsapp/qr-rate-limit.ts
backend/src/integrations/whatsapp/session/session-registry.service.ts (+ spec, 13 tests)
backend/src/integrations/whatsapp/whatsapp-sessions.controller.ts (+ spec, 6 tests)
backend/test/whatsapp-m5-sessions.e2e-spec.ts (10 tests)
```

Modified backend (M5 deltas within already-modified M4 files):
```text
backend/prisma/schema.prisma                                   WhatsAppAccount.label/archivedAt
backend/src/integrations/whatsapp/lease/session-lease.service.ts      lease key param
backend/src/integrations/whatsapp/ownership/session-ownership.service.ts  per-number key
backend/src/integrations/whatsapp/session/session-runtime.service.ts  accountId-aware rewrite
backend/src/integrations/whatsapp/whatsapp.module.ts            registry wiring, dead provider removed
backend/src/integrations/whatsapp/whatsapp.controller.ts        QrRateLimiter + async qr() fix
backend/src/integrations/whatsapp/outbound/outbound.service.ts  accountId resolution/execution
backend/src/integrations/whatsapp/inbound/inbound.service.ts    hub subscription carries accountId
backend/src/integrations/whatsapp/conversations/conversations.service.ts  ?accountId= filter
backend/src/integrations/whatsapp/whatsapp-conversations.controller.ts    accountId query param
backend/src/integrations/whatsapp/media/whatsapp-media.storage.ts         audio bug fix (part A)
backend/src/shared/exception.filter.ts                          WhatsAppLeaseError -> 409
```

Frontend:
```text
frontend/lib/whatsapp.ts                    accountId on rows/status/session types, fetchWhatsAppSessions()
frontend/lib/i18n.tsx                       wa_int.sessions.* + whatsapp.account.* keys
frontend/app/app/settings/integrations/whatsapp/page.tsx   numbers block (list/add/QR/connect/archive)
frontend/app/app/whatsapp/page.tsx          account filter, account badge, inline <audio> player (part A)
frontend/app/app/whatsapp/page.spec.tsx     (new) page tests
frontend/lib/whatsapp-registry.spec.tsx     updated assertions for accountId qs + sessions fetch
```

## 5. API surface added/changed

```text
GET    /api/v1/whatsapp/sessions                 whatsapp.read           list + status (incl. archived)
POST   /api/v1/whatsapp/sessions                 whatsapp.session.admin  {label?} -> 201 + status + audit
GET    /api/v1/whatsapp/sessions/:id             whatsapp.read           404 unknown
GET    /api/v1/whatsapp/sessions/:id/qr          whatsapp.session.admin  409 outside QR_REQUIRED, rate-limited
POST   /api/v1/whatsapp/sessions/:id/connect     whatsapp.session.admin  confirm, audit resourceId=accountId
POST   /api/v1/whatsapp/sessions/:id/disconnect  whatsapp.session.admin  confirm
POST   /api/v1/whatsapp/sessions/:id/archive     whatsapp.session.admin  confirm; 200 idempotent; then 409 ops
GET    /api/v1/whatsapp/conversations?accountId= whatsapp.read           filter by number
```

Legacy `/whatsapp/status|qr|connect|disconnect|logout|session-reset`
unchanged in shape; they act on the primary number.

Audit actions: `whatsapp.account_created` (new), `whatsapp.archived` (new),
existing ones now carry `resourceId = <accountId>`.

## 6. Schema & migration

```sql
-- backend/prisma/migrations/20261004140000_m5_multi_number_sessions/migration.sql
ALTER TABLE "WhatsAppAccount" ADD COLUMN "label" TEXT;
ALTER TABLE "WhatsAppAccount" ADD COLUMN "archivedAt" TIMESTAMP(3);
```
Idempotent, applied with `npx prisma migrate deploy` + `npx prisma generate`.

**Lease-key data migration (runtime, no SQL).** M5 switches the lease key from
the singleton `"whatsapp"` to `whatsapp:<accountId>`. Without a hand-off the
new key would start a fresh lineage at `fencingToken = 1` while the auth-state
envelope on disk still holds the old, higher token — every persist would then
be rejected as stale (`AuthStateStore` fail-closed) and the primary number
could never save its session. `WhatsAppSessionRegistryService` therefore
renames the legacy row to the primary's key in `bootstrap()` and in
`ensurePrimaryAccountId()` (`migrateLegacyLeaseRow`): preserves the token when
the target key is free; when both rows exist it merges them (MAX) and deletes
the legacy one; no active primary -> no-op. Idempotent, P2002/race-safe,
best-effort (never fails bootstrap).

> Found and fixed on live dev: a first-cut variant deleted the legacy row
> when the target already existed, dropping the higher token (disk=13 vs
> row=2) and leaving the primary permanently stale. Dev DB healed manually
> (`fencingToken` -> 13; re-acquired as 14); regression covered by 3 new
> registry tests (rename / merge / target-wins).

## 7. Tests added

- `session-registry.service.spec.ts` - 18 tests: accounts CRUD, ensureContext
  404/409/503, per-account sessionPath + lease key, removeContext idempotency,
  hub events with accountId, self-fencing, proxy stability/instanceof/
  subscription survival, bootstrap + legacy auth-file migration (2),
  legacy lease-row migration (5: rename preserving token, create-path,
  merge MAX when target exists, target-wins without overwrite, bootstrap
  ordering + no-op without accounts).
- `whatsapp-sessions.controller.spec.ts` - 6 tests: RBAC delegation, create
  (503 disabled, trim, audit, status), get/list, per-user QR rate-limit
  (3/60s -> 429), confirm forwarding.
- `whatsapp-m5-sessions.e2e-spec.ts` - 10 tests: RBAC gates; number creation
  (label trim, audit); per-number connect/disconnect with per-number audit
  `resourceId`; inbound from two numbers with `?accountId=` filtering;
  per-number QR 409/404; archive (confirm 422, archivedAt, context removed,
  idempotent repeat, 409 afterwards); **history preserved after archive**
  (conversation + timeline + inbound row, filtered and unfiltered);
  outbound falls back to the primary number after archive; legacy routes
  still target the primary number.

## 8. Regression results & pre-existing failures

Gates run (2026-10-05):

```text
backend  npx tsc --noEmit                      clean
backend  npx jest --runInBand                  136 suites: 135 pass, 2181 tests: 2180 pass
backend  whatsapp e2e (m2 m3 m4 m5)            4 suites / 46 tests green
         (run as m2+m3+m4 then m4+m5; see NODE_OPTIONS note below)
backend  e2e smoke: validation-pipe            green
frontend npx tsc --noEmit                      clean
frontend npx vitest run                        54 files / 939 tests green
```

Post-fix re-run (lease-row migration, same day): `tsc` clean; whatsapp unit
batch 12 suites / 172 tests green; `whatsapp-m5` e2e 10/10 green; live dev
backend boots with an empty stderr (no `Stale fencing token`), primary
auto-reconnects to `CONNECTED` with a healed monotonic token.

Pre-existing failures (verified on baseline `0d7de62`, NOT M5-scoped):

1. `test/rbac-catalog-crm.e2e-spec.ts` - `POST /products` -> 403
   (known baseline failure, unchanged).
2. `test/auth-rbac.e2e-spec.ts` - "OPERATOR выполняет жизненный цикл Order и
   Booking": admin `POST /products` response has no `body.product`
   (TypeError at line 248). Re-run in the clean baseline worktree:
   identical 1 failed / 11. Pre-existing.
3. `src/perf/perf-harness.spec.ts` - "deterministic run-scoped namespaces"
   wall-clock test fails only under the full 136-suite in-band run
   (load-sensitive); passes 72/72 in isolation. Flake, not a regression.

Env limitations (documented, not regressions):

- **`npm run lint` (frontend) cannot run in this environment**: the script is
  a stub (`"lint": "eslint"`) and `eslint` is neither in `package.json`
  dependencies nor installed globally. All other gates pass.
- **e2e memory**: running 4+ Nest e2e suites in one jest process exceeds the
  default 2 GB heap. Use
  `$env:NODE_OPTIONS="--max-old-space-size=4096"` for multi-suite e2e runs
  (verified: 4 suites green with it).
- Baseline note correction: `auth-rbac` joins `rbac-catalog-crm` as a
  pre-existing e2e failure (both share the admin `POST /products` root).

## 9. Known gaps / follow-ups (out of M5 scope)

1. **Logout when the number is already DISCONNECTED -> 500**
   (`Illegal WhatsApp connection transition: DISCONNECTED -> DISCONNECTED`
   in the mock provider). Pre-existing on baseline (never exercised there
   because e2e always logged out from QR_REQUIRED). Recommendation: make
   logout idempotent (skip the final transition / guard in runtime) in a
   follow-up; m2 test 6 passes because it logs out from QR_REQUIRED.
2. **Baileys `stop()` does not clear `qr`** - open D-item; snapshot may keep
   a stale QR after stop until the next start. Mock provider clears it.
3. **`config.throttle` (D10)** is parsed and exposed but intentionally
   unused (owner-approved deferral).
4. Full ~100-suite e2e run was not executed in one process (heap/time
   limits of this environment); whatsapp suites + targeted smoke were run
   instead, and baseline failures were verified in the worktree.

## 10. How to re-run the gates

```powershell
# backend
npx tsc --noEmit
npx jest --runInBand
$env:NODE_OPTIONS="--max-old-space-size=4096"
npx jest --config test/jest-e2e.json --runInBand whatsapp-m2 whatsapp-m3 m4-whatsapp-onboarding whatsapp-m5

# frontend
npx tsc --noEmit
npx vitest run
```
