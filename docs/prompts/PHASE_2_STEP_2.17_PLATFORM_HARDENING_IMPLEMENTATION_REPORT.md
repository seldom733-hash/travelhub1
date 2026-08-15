# PHASE 2 — STEP 2.17 — PLATFORM HARDENING — IMPLEMENTATION REPORT

Дата: 2026-08-16.

## 1. Резюме

Step 2.17 (канонический NEXT по `PHASE_2_NEXT_EXECUTABLE_STEP_RECONCILIATION`)
реализован: закрыты все 10 подтверждённых платформенных findings (CI, token
storage, logout revocation, rate limiting, PermissionsGuard, CORS, outbox
publisher, durable retry, legacy isolation, README) + envelope version.

## 2. Findings — независимая верификация (до изменений)

1. **CI сломан** — `.github/workflows/ci.yml`: `npm ci` из корня (нет
   package.json), `DATABASE_URL: file:./dev.db` (legacy SQLite, backend —
   PostgreSQL multiSchema). ПОДТВЕРЖДЕНО кодом.
2. **JWT в JS-readable сторадже** — frontend: localStorage `travelhub.token` +
   JS-cookie `travelhub.auth` (client-set). ПОДТВЕРЖДЕНО.
3. **logout не отзывал токен** — `auth.controller.ts` только audit, без
   revocation; JWT живёт JWT_EXPIRES_IN (8h). ПОДТВЕРЖДЕНО.
4. **rate limiting отсутствует** — login без ограничений. ПОДТВЕРЖДЕНО.
5. **PermissionsGuard fail-open** — `if (!user) return true`. ПОДТВЕРЖДЕНО.
6. **CORS `origin: true`** — `main.ts`. ПОДТВЕРЖДЕНО.
7. **`retryFailed` без production-вызывающего** — 0 callers. ПОДТВЕРЖДЕНО.
8. **`publishPending` inline post-commit** — нет фонового publisher/claim.
   ПОДТВЕРЖДЕНО.
9. **legacy/ — параллельное приложение** (Next.js+SQLite, свой package.json,
   prisma schema, dev.db, users-credentials.txt). ПОДТВЕРЖДЕНО.
10. **README отставал** (CI «нерабочий», «outbox-воркер отсутствует»).
    ПОДТВЕРЖДЕНО.

## 3. Current → Target matrix

| Область | Current | Target |
|---|---|---|
| CI | root npm ci + SQLite | backend/frontend roots, PostgreSQL, migrate deploy, unit+e2e, build |
| Event delivery | inline publishPending, retryFailed без caller | OutboxWorker (advisory-lock, bounded, auto-retry) |
| Envelope | без version | additive `version: 1` |
| Token storage | localStorage + JS-cookie | HttpOnly cookie (Secure prod, SameSite=Lax) |
| Logout | audit only | tokenVersion revocation + cookie clear |
| Login abuse | нет | in-memory throttle (10/15min) → 429 |
| PermissionsGuard | fail-open | fail-closed (403) |
| CORS | origin:true | allowlist (CORS_ORIGINS) + credentials |
| Legacy | в репо | изолирован от CI/build/deploy (не удалён) |
| README | устарел | синхронизирован с runtime truth |
| ADMIN/SoD | ALL_PERMISSIONS | классифицирован (bootstrap policy), не тронут |

## 4. CI/CD baseline repair

`.github/workflows/ci.yml` переписан (см. `docs/architecture/platform-hardening-2.17.md`
§5). Доказательства: package roots корректны, PostgreSQL 15 service,
`prisma migrate deploy` (реальные миграции), полный serial e2e, frontend
typecheck/tests/build. SQLite/legacy — вне CI.

## 5. Durable event delivery

`OutboxWorkerService` — фоновый bounded цикл `retryFailed → publishPending`
(interval OUTBOX_WORKER_INTERVAL_MS=2000, batch OUTBOX_WORKER_BATCH=100),
advisory xact lock (multi-instance), controlled errors, unref, status().
Регистрация в EventBusModule; e2e — OUTBOX_WORKER_ENABLED=false.

## 6. Durable retry

retryable FAILED (`attempts < OUTBOX_MAX_ATTEMPTS=5`, nextAttemptAt <= now) →
PENDING → доставка; exhausted — poison (не выбирается, остаётся FAILED + error).
InboxEvent dedup — authoritative (0 duplicate side effect).

## 7. Envelope version

`toOutboxEnvelope` → `version: 1` (additive). Обратная совместимость с
legacy-событиями без version (трактуются как v1).

## 8. Auth/session

HttpOnly cookie + Authorization header (оба пути). `/auth/session` — public
проба. Frontend — in-memory флаг + credentials include.

## 9. Logout/session invalidation

`User.tokenVersion`; logout — инкремент + cookie clear + audit; me() валидирует
tv; повторный logout идемпотентен.

## 10. Login abuse protection

`LoginThrottleService`: sliding window 10/15min по `username|ip`; 429; reset при
успехе. Ограничение per-instance документировано.

## 11. PermissionsGuard fail-closed

required permissions + missing user → 403 ForbiddenException (unit-доказано);
public без metadata → true; без права → 403.

## 12. CORS/CSRF

Allowlist из CORS_ORIGINS, credentials:true. CSRF review: SameSite=Lax +
JSON Content-Type + CORS allowlist — достаточно для одно-origin топологии;
double-submit только при multi-origin (не выдумываем).

## 13. Legacy isolation

legacy/ вне CI/build/deploy/imports/Prisma (source-audit); не удалён;
credential-файлы legacy не раскрываются, rotation документирован.

## 14. README

Синхронизирован: CI рабочий, durable worker, HttpOnly cookie + revocation,
rate limiter ограничение, legacy статус, домены/схемы, команды.

## 15. ADMIN / SoD

`ADMIN: ALL_PERMISSIONS` — controlled super-admin bootstrap policy (начальный
ADMIN аккаунт). Права НЕ удалены; детальная SoD-декомпозиция — будущий
отдельный шаг (не выдумываем authority).

## 16. Observability

OutboxWorker: per-cycle log (retried/published), status() (pending/failed/
retryableFailed/exhausted/workerEnabled). Rate limiter: count(key).

## 17. AbortError/network regression

useCurrentUser: сетевые сбои НЕ разлогинивают (только /auth/session результат);
401 на защищённых путях — редирект /login?next (path-guarded).

## 18. API contract changes

- `GET /auth/session` — НОВЫЙ (public, `{user}|{user:null}`).
- `POST /auth/login|register|partner-register` — Set-Cookie HttpOnly
  (тело без изменений; accessToken по-прежнему возвращается).
- `POST /auth/logout` — tokenVersion increment + cookie clear.
- Остальные контракты не изменены (e2e-regression 1188/1188).

## 19. Schema change

`security.User.tokenVersion Int @default(0)` — миграция
`20260815202441_add_user_token_version`. Никаких db push.

## 20. Frontend changes

lib/api.ts, lib/use-user.ts, app/login/page.tsx, components/Shell.tsx,
app/partner/layout.tsx, app/account/layout.tsx, lib/api.spec.ts.

## 21. Unit results

666/666 (51 suites; +11: cors.spec 5, permissions-guard.spec 6).

## 22. E2E results (auth-hardening)

7/7: HttpOnly cookie, cookie-auth me, logout revocation (старый токен → 401),
logout идемпотентен + cookie clear, PermissionsGuard fail-closed (401/403 на
protected без auth), audit без секретов, brute-force 429.

## 23. E2E results (outbox durable worker)

5/5: worker disabled в e2e, PENDING → фоновый цикл, retryable FAILED →
auto-retry + side effect ровно 1 раз, exhausted poison, advisory lock.

## 24. Outbox failure-injection regression

2/2 (Step 1.18 contract сохранён: FAILED durable, manual recovery, dedup).

## 25. Full backend e2e regression

1188/1188 (69 suites; два serial блока по 600с, каждый — свежая тестовая БД,
детерминизм zero-fanout суитов). Единичный flaky (shared-DB interference) при
первом прогоне chunk2 — при повторном прогоне 674/674 (см. §30 Issues).

## 26. Frontend regression

tsc --noEmit: 0 ошибок. vitest: 135/135 (23 suites). Production build: ✓
(compiled 6.8s, static pages 36/36).

## 27. Migration replay/status

58/58 applied; migrate diff (migrations → schema) — пусто (drift 0).

## 28. Negative coverage (15 items)

1. CI не использует legacy SQLite — ✓ (ci.yml, source-audit);
2. package roots корректны — ✓;
3. PENDING event recover без HTTP traffic — ✓ (outbox-durable-worker);
4. retryable FAILED retried — ✓;
5. non-retryable not retried — ✓ (failure-injection: повторный publishPending 0);
6. retry exhaustion deterministic — ✓ (poison test);
7. concurrent publishers без duplicate effect — ✓ (advisory lock + Inbox dedup);
8. missing user + required permission denies — ✓ (permissions-guard.spec);
9. public без metadata остаётся public — ✓;
10. rate limit 429 — ✓ (auth-hardening);
11. arbitrary CORS origin rejected — ✓ (cors.spec);
12. logout invalidates — ✓ (tokenVersion → 401);
13. JS-readable credential persistence отсутствует — ✓ (api.spec: 0 localStorage);
14. auth/security logs без секретов — ✓ (audit-no-secrets e2e);
15. legacy вне текущего CI/build — ✓.

## 29. Positive coverage

- backend build/typecheck: ✓; PostgreSQL migration replay: ✓ (58/58, drift 0);
- full unit: ✓ 666; full serial e2e: ✓ 1188/1188;
- frontend tsc/vitest/build: ✓;
- normal login ниже порога: ✓ (все e2e логины успешны);
- authorized protected request: ✓; logout: ✓; allowed CORS origin: ✓ (unit);
- normal outbox publish: ✓; transient retry recovery: ✓; Inbox/idempotency: ✓;
- OrderRequested→Order: ✓ (order-creation-consumer); BookingRequested→Booking: ✓;
- Finance/ledger regressions: ✓ (ledger-transaction-foundation, chunk2).

## 30. Issues found

1. **Interference (известная)**: первый полный прогон — 1 flaky failure
   (shared-DB zero-fanout counts); повторный прогон блока — 674/674. Не
   регрессия; при serial-прогонах в одном процессе суиты делят БД.
2. **Rate limiter in-memory per-instance** — документированное ограничение;
   multi-instance → external store (будущий шаг).
3. **CSRF** — SameSite=Lax модель достаточна для одно-origin топологии;
   double-submit deferred до multi-origin.

## 31. Deferred items

- multi-instance rate limiting; event schemaVersion для будущих payload-версий;
  RLS (ADR-0014); Backup/DR (2.17A); Load (2.17B); sales decomposition (2.17C);
  ADMIN SoD детальная декомпозиция; double-submit CSRF.

## 32. Out-of-scope confirmation

PSP/payment/checkout/booking/settlement не начаты; 2.17A/2.17B/2.17C/2.18 не
начаты; 2.12B/2.12C/2.12I/ADR-0015 не тронуты.

## 33. Migration status

`20260815202441_add_user_token_version` — applied (58/58), drift 0. dev/prod
DB вручную не менялись.

## 34. Dev/prod impact

- Prod: при deploy требуется migrate (tokenVersion). Существующие сессии с
  токенами без tv — payload.tv undefined → me() без tv не отклоняет
  (совместимость); при первом logout инвалидируются.
- Dev: `.env` — CORS_ORIGINS опционален (default localhost:3000);
  OUTBOX_WORKER_* опционален (defaults).

## 35. Release notes

- Outbox: durable background delivery + auto-retry (multi-instance safe).
- Auth: HttpOnly cookie, logout revocation, fail-closed guard, login throttle,
  CORS allowlist.
- CI: рабочий PostgreSQL e2e pipeline.

## 36. Architecture decisions

- Durable worker с advisory-lock циклом (а не SKIP LOCKED пострovoчно):
  сериализация цикла, минимальный diff, доказанная безопасность.
- Envelope version additive v1.
- HttpOnly cookie + Authorization dual-path (не ломает API-клиентов).
- tokenVersion (а не JWT blacklist): нулевой side-state, мгновенная
  инвалидация всех токенов пользователя.
- In-memory throttle (single-instance): документировано.

## 37. Artifact integrity

Чекер roadmap-artifacts будет запущен перед коммитом (PASS/WARN/FAIL — после).

## 38. ADR relevance

ADR-0009/0010 (event envelope/correlation) — не изменены; cookie-сессия —
серверная, ADR-0010 envelope version additive.

## 39. REPOSITORY EVIDENCE — REQUIRED

REPOSITORY EVIDENCE
repository: TravelHub (D:\travelhub_v1)
branch: master
head: <заполняется при коммите>
origin: <заполняется при коммите>
worktree_clean: false (см. §30; untracked prompt-файлы предыдущих шагов остаются)
migration_count: 58
reviewed_state: COMMIT
reviewed_diff_base: <заполняется при коммите>
reviewed_diff_head: <заполняется при коммите>
persistence_status: NOT_PERSISTED
persistence_sha: N/A
push_status: NOT_PUSHED

## 40. PERSISTENCE STATUS IN FINAL RESPONSE

- verdict: IMPLEMENTED — WAITING FOR STRICT REVIEW;
- branch: master;
- commit SHA: <при коммите>;
- persistence: COMMITTED → PUSHED (после push);
- upstream equality: verify после push.

## 41. Files changed

- .github/workflows/ci.yml (переписан);
- backend/prisma/schema.prisma (+tokenVersion);
- backend/prisma/migrations/20260815202441_add_user_token_version/ (новая);
- backend/src/eventbus/domain-events.ts (envelope version);
- backend/src/eventbus/eventbus.service.ts (tx-aware publish/retry);
- backend/src/eventbus/eventbus.module.ts (worker registration);
- backend/src/eventbus/outbox-worker.service.ts (новый);
- backend/test/e2e.env.ts (OUTBOX_WORKER_ENABLED=false);
- backend/src/security/auth/jwt-auth.guard.ts (cookie + tv);
- backend/src/security/auth/auth.controller.ts (cookie, logout revoke, session,
  throttle);
- backend/src/security/auth/auth.service.ts (tokenVersion, sessionUser);
- backend/src/security/auth/permissions.guard.ts (fail-closed);
- backend/src/security/security.module.ts (LoginThrottleService);
- backend/src/shared/login-throttle.service.ts (новый);
- backend/src/shared/errors.ts (+TooManyRequestsError);
- backend/src/shared/cors.ts (новый) + cors.spec.ts;
- backend/src/security/auth/permissions-guard.spec.ts (новый);
- backend/src/main.ts (cookie-parser, CORS allowlist);
- backend/package.json (+cookie-parser);
- backend/test/auth-hardening.e2e-spec.ts (новый, 7 тестов);
- backend/test/outbox-durable-worker.e2e-spec.ts (новый, 5 тестов);
- frontend/lib/api.ts, lib/use-user.ts, lib/api.spec.ts;
- frontend/app/login/page.tsx, components/Shell.tsx, app/partner/layout.tsx,
  app/account/layout.tsx;
- README.md;
- docs/architecture/platform-hardening-2.17.md (новый);
- docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md (2.17 status);
- docs/prompts/PHASE_2_STEP_2.17_PLATFORM_HARDENING_IMPLEMENTATION_REPORT.md
  (этот файл).
