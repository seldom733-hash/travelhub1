# Step 2.17 — Platform Hardening (architecture)

Дата: 2026-08-16. Статус: IMPLEMENTED — WAITING FOR STRICT REVIEW.

## 1. Контекст и цели

Закрытие системно-широких платформенных рисков, подтверждённых независимой
верификацией кода (не из отчётов):

1. CI нерабочий (root `npm ci` + legacy SQLite);
2. сессионный credential — JS-readable (localStorage + document.cookie);
3. logout не отзывал токен;
4. login без rate limiting;
5. PermissionsGuard fail-open;
6. CORS `origin: true`;
7. `retryFailed` без production-вызывающего;
8. `publishPending` — inline post-commit, без фонового publisher;
9. legacy-приложение в репозитории;
10. README отставал от runtime truth.

## 2. Durable event delivery (OutboxWorker)

Проблема: `publishPending()` вызывался только инлайном после коммита HTTP-команд;
падение процесса между коммитом и вызовом оставляло событие в PENDING навсегда.
`retryFailed()` не имел production-вызывающего — retryable FAILED (OrderRequested)
никогда не ретраились автоматически.

Решение:

- **`OutboxWorkerService`** (`src/eventbus/outbox-worker.service.ts`) — фоновый
  bounded цикл: `retryFailed(limit) → publishPending(limit)` каждые
  `OUTBOX_WORKER_INTERVAL_MS` (default 2000ms), batch `OUTBOX_WORKER_BATCH`
  (default 100).
- **Multi-instance safety**: каждый цикл берёт pg advisory xact lock
  (`pg_try_advisory_xact_lock(hashtext('travelhub:outbox-worker'))`) внутри
  транзакции — только один инстанс исполняет цикл за раз, конкуренты скипают.
- **Controlled errors**: исключения цикла логируются, worker не падает.
- **No tight loop**: интервал, не занятой цикл; `timer.unref()` — процесс не
  держится таймером.
- **Event identity/lineage**: retryFailed/publishPending НЕ меняют
  eventId/correlation/causation; InboxEvent dedup — authoritative защита от
  duplicate side effect (не полагаемся на exactly-once доставку).
- **Наблюдаемость**: каждый цикл логирует published/retried counts; `status()`
  даёт бэклоги (pending/failed/retryableFailed/exhausted).
- **e2e**: `OUTBOX_WORKER_ENABLED=false` (test/e2e.env.ts) — тесты детерминированы,
  фоновый таймер не вмешивается; worker-цикл вызывается явно в спеках.

События с `retryable: true` (OrderRequested): FAILED с `attempts < MAX_ATTEMPTS`
и `nextAttemptAt <= now` переводятся обратно в PENDING (тот же eventId) и
доставляются; exhausted (attempts >= MAX_ATTEMPTS) — poison, не выбираются,
остаются FAILED с error (наблюдаемость, ручное вмешательство документировано).

## 3. Event envelope version

`toOutboxEnvelope()` добавляет `version: 1` (additive schemaVersion decision).
Существующие события без version трактуются как v1 (обратная совместимость);
новые payload-версии получают собственную миграцию payload-контракта при
появлении (owner — будущие шаги, не выдумываем).

## 4. Auth hardening

### 4.1 Серверная HttpOnly session cookie

- Login/register/partner-register ставят `travelhub.auth` — HttpOnly, `Secure`
  в production, `SameSite=Lax`, `path=/`, maxAge = JWT_EXPIRES_IN (8h default).
- JS не читает токен; frontend НЕ хранит credential в localStorage/document.cookie.
- `JwtAuthGuard` читает токен из `Authorization: Bearer` (API-клиенты/e2e,
  legacy контракт) ИЛИ из cookie (браузер). Приоритет — header.
- `GET /auth/session` — публичная сессионная проба: `{ user } | { user: null }`,
  без 401 (frontend на каждом mount определяет сессию по cookie; невалидный/
  истёкший/revoked/INACTIVE → null). `/auth/me` остаётся strict 401 для
  защищённых контуров.
- Frontend: `auth` стор — in-memory флаг сессии (не credential); fetch с
  `credentials: "include"`; `useCurrentUser` — через `/auth/session`.

### 4.2 Logout revocation (tokenVersion)

- `security.User.tokenVersion Int @default(0)` (миграция `add_user_token_version`).
- JWT payload содержит `tv`; `AuthService.me(userId, tv)` отклоняет токены со
  старым tv (даже не истёкшие) → 401.
- Logout: инкремент tokenVersion (все ранее выданные токены недействительны) +
  очистка cookie + audit. Повторный logout идемпотентен.

### 4.3 PermissionsGuard fail-closed

- `@RequirePermissions(...)` + отсутствующий `request.user` → 403
  (ранее — тихий no-op `if (!user) return true`). Misconfiguration
  (public + permission metadata) больше не маскируется.
- Public без metadata → public (без изменений).

### 4.4 Login rate limiting

- `LoginThrottleService` — in-memory sliding window (10 попыток / 15 мин) по
  ключу `username|ip`; превышение → controlled 429 TooManyRequestsError.
- Успешный вход сбрасывает окно. Учётная перечисление не усиливается
  (одинаковый 401/429 для несуществующего и существующего пользователя).
- **Ограничение (документированное)**: in-memory per-instance — корректно для
  single-instance deployment; multi-instance требует external store (Redis/DB) —
  вне scope 2.17, при масштабировании обязателен отдельный шаг.

### 4.5 CORS allowlist

- `origin: true` → явный allowlist из `CORS_ORIGINS` (CSV, default
  `http://localhost:3000`), `credentials: true`. Произвольные origins отклонены
  (unit-доказательство), пустой allowlist — fail-closed.
- CSRF review: cookie SameSite=Lax + credentials только с явным allowlist;
  state-changing запросы — JSON Content-Type (cross-site form не сможет);
  SameSite=Lax не отправляет cookie на cross-site POST. Документировано
  (п.7 ниже).

## 5. CI repair

`.github/workflows/ci.yml` переписан:

- корни пакетов: `backend/` и `frontend/` (не root — там нет package.json);
- backend: npm ci → tsc --noEmit → unit → PostgreSQL 15 service →
  `prisma migrate deploy` (реальные миграции) → полный serial e2e
  (`TEST_DATABASE_URL` с суффиксом `test`, изолированный MinIO-бинар);
- frontend: npm ci → tsc --noEmit → vitest → production build;
- `legacy/` в CI не участвует; SQLite-конфигурация legacy не используется;
- `.env` не в git (CI env wins).

## 6. Legacy isolation

- `legacy/` — историческое Next.js+SQLite-приложение: НЕ участвует в CI,
  build, deploy, Prisma generation, импортах текущего backend/frontend
  (проверено source-audit). Директория не удаляется (история).
- Credential-файлы legacy (users-credentials.txt) — не текущие secrets;
  в отчёте не раскрываются; документировано требование rotation/удаления.

## 7. CSRF assessment (SameSite + CORS)

Cookie-сессии + CORS не являются CSRF-защитой сами по себе; принятая модель:

1. `SameSite=Lax` — cross-site POST/PUT/DELETE не приносит cookie
   (state-changing запросы защищены от cross-site form/fetch без CORS).
2. CORS allowlist + `credentials: true` — cross-site fetch с cookie требует
   явного разрешения origin; произвольные origins не получают ответ.
3. State-changing API — JSON `Content-Type` (браузерный cross-site form не
   может отправить application/json без CORS preflight).
4. Одинаковый origin frontend/backend через proxy (Next `/api/v1`) — cookie
   same-site по умолчанию.

Этого достаточно для текущей топологии (одно origin-домен, cookie SameSite=Lax);
double-submit/Origin-check добавятся только если появится multi-origin topology
(новый шаг, не выдумываем).

## 8. ADMIN / SoD assessment

`ADMIN: ALL_PERMISSIONS` классифицирован как **controlled super-admin bootstrap
policy**: канонический ADMIN — начальный аккаунт (ADMIN_USERNAME/ADMIN_PASSWORD),
полные права. Это намеренная политика bootstrap, не silent governance gap;
детальная SoD-декомпозиция (separation между Security/Finance/Moderation/
Catalog operations) — отдельный будущий шаг (в scope 2.17 не выдумываем
business authority). Никаких прав автоматически не удалено.

## 9. Frontend (auth-поверхность)

- `lib/api.ts`: in-memory session flag; `credentials: "include"`;
  `fetchSessionUser()` (GET /auth/session); НЕ пишет в localStorage/cookie.
- `lib/use-user.ts`: источник истины — /auth/session; сетевые сбои не
  разлогинивают (AbortError-регрессия не возвращается).
- `proxy.ts` (server-side boundary /app|/partner|/account): читает HttpOnly
  cookie server-side — без изменений контракта.
- Layouts (Shell/Partner/Buyer): guard на `user` (не на `auth.token`) —
  cookie-сессия после refresh определяется /auth/session.
- Login page: уже-залогиненный пользователь — через /auth/session.

## 10. Границы (out of scope)

- multi-instance rate limiter (external store) — deferred;
- event schemaVersion для будущих payload-версий — owner = будущие шаги;
- RLS (ADR-0014), Backup/DR (2.17A), Load/Performance (2.17B) — отдельные gates;
- sales.service decomposition — Step 2.17C;
- PSP/payment/checkout/booking — не начаты.

## 11. Доказательства

- unit: 655 + cors.spec (5) + permissions-guard.spec (6) = **666**;
- e2e: auth-hardening 7/7, outbox-durable-worker 5/5, outbox-failure-injection 2/2,
  полный serial e2e **1188/1188** (69 suites, два блока по 600с);
- frontend: tsc 0, vitest **135/135**, production build ✓;
- миграции: **58/58** applied, drift 0.
