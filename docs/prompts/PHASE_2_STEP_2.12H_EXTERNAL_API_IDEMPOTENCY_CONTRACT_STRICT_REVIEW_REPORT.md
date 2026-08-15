# PHASE 2 — STEP 2.12H — EXTERNAL API IDEMPOTENCY CONTRACT — STRICT REVIEW REPORT

## 1. Verdict

`PHASE 2 STEP 2.12H STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`

Критический вопрос («может ли retried payment.create создать второй
committed Payment после concurrency/crash/restart/stale recovery») доказан
ответом **нет** — двойная гарантия: HTTP-слот (DB unique slotKey) +
Payment business invariant (partial unique `Payment_one_active_per_order` +
findFirst-check). Fault-injection e2e T20/T22 доказали это исполняемо.

## 2. Methodology

Repository-first adversarial review: фактический git-дифф `68c28bc →
cd8ed56` (20 файлов), повторное чтение всего production-кода (service,
interceptor, constants, decorator, slot-key, fingerprint, PaymentService
business-idempotency path, schema, migration), claims matrix против кода,
fault-injection e2e (crash window C), adversarial unit tests (§36), полная
регрессия фактическими командами. Отчёт не принимался на веру.

## 3. Repository baseline

- branch `master`, HEAD == upstream == `25cb2cb` (до review-фиксов);
- pre-2.12H SHA = `68c28bc`; implementation commit `cd8ed56`;
  provenance/footer commit `25cb2cb`;
- worktree: 0 tracked changes (только untracked prompts, не тронуты).

## 4. Reviewed diff / provenance

Exact changed-file inventory `git diff --name-status 68c28bc cd8ed56`
(20 файлов): production infra (8 idempotency-модуля + app.module +
finance.controller), schema + migration (1), tests (e2e new + 3 modified +
2 unit spec), docs (arch doc, implementation report, Roadmap). Unexpected
files: 0.

## 5. Claims matrix

| Claim | Repository Evidence | Verdict |
|---|---|---|
| protected operation set minimal | route/metadata audit (`@Idempotent("payment.create")` единственный) | PASS |
| header validation correct | constants spec (7) + e2e T1/T2 | PASS |
| principal scope safe | auth pipeline (guards до interceptor) + T10/T11/T12 | PASS |
| fingerprint deterministic | code + adversarial unit #1–#9 | PASS |
| PostgreSQL durable | schema/migration/runtime (events.ExternalIdempotencyRecord) | PASS |
| raw key not stored | schema/write audit + e2e T23 | PASS |
| DB uniqueness backstop | slotKey UNIQUE + P2002 + T7/T8/T19/T22 | PASS |
| identical replay safe | T4/T14/T24 | PASS |
| divergent replay safe | T5/T6/T21 | PASS |
| restart replay safe | T9 (второй Nest instance, тот же DB) | PASS |
| crash-window safe | fault injection T20/T22 + unit #10 | PASS |
| Payment authority preserved | write-path audit (0 Payment writers вне PaymentService) | PASS |
| no PSP/webhook scope | route/dependency/runtime audit T18 | PASS |

## 6. Protected operations

V1 = `POST /api/v1/finance/payments` (`payment.create`) — payment-initiation
boundary, hard prerequisite 2.12B. Explicit registry `IDEMPOTENT_OPERATIONS`,
fail-closed (unknown operation → ошибка при декорировании). Не обёрнуты:
transitions (CAS-идемпотентны, повторный → 409 — канонический контракт),
reads, другие домены. Будущие операции добавляются registry-ом без слома
slot-семантики (slot включает operation). PASS.

## 7. Header contract

Missing/empty → 400; whitespace-only → 400; >128 → 400; invalid printable
chars (пробел/!/,@/;/=/#//) → 400; valid chars pass; duplicate values —
Node/Express join с ", " → charset-reject (400), Array-форма тоже
детерминированно отклоняется (constants spec #6); case: HTTP headers
case-insensitive (read через `headers["idempotency-key"]`). Ни одного raw
framework error — все контролируемые 400. PASS.

## 8. Principal / tenant isolation

Scope = `scopeType="USER"` + `request.user.id` (серверный контекст,
устанавливается JwtAuthGuard). Никогда body/query/headers. Response lookup
только после установления principal (interceptor проверяет `request.user`
fail-closed). T10: одинаковый literal key разных пользователей → разные
слоты, оба исполняются, 0 cross-replay. T11: аноним с чужим key → 401 до
слота. RLS не заявлен (ADR-0014 остаётся границей). PASS.

## 9. Auth/RBAC ordering

Nest lifecycle: middleware (RequestContext + body-parser) → guards
(JwtAuthGuard → PermissionsGuard, оба APP_GUARD) → interceptors (pre;
IdempotencyInterceptor APP_INTERCEPTOR) → pipes → handler → interceptors
(post) → filters. Idempotency срабатывает ПОСЛЕ guards: 401/403 не могут
быть обойдены replay-ом (T11/T12). Fingerprint строится на validated DTO
(та же ValidationPipe, whitelist+transform) — правильная validated boundary
(не raw transport). PASS.

## 10. Fingerprint authority

`sha256(canonical({params, body}))`; body — validated DTO через
`GLOBAL_VALIDATION_PIPE_OPTIONS` (whitelist удаляет forged/stripped поля —
fingerprint семантический, не raw). Property insertion order независим
(рекурсивная сортировка ключей); arrays order-preserved; path params
включены; query вне входа (документировано; у V1 protected ops нет
semantically-relevant query); omitted≠null fail-loud; decimal/currency
строки не нормализуются (2.12A canonical representation, «150.00»≠«150»);
volatile transport metadata excluded by construction (не вход). Invariant:
семантически идентичные → одинаковый fingerprint; семантически разные → не
коллайдят (unit #1–#9). PASS.

## 11. Validation / mass-assignment ordering

Interceptor валидирует body ДО claim (ValidationPipe transform) —
validation-failure не создаёт слот. Whitelist удаляет неизвестные поля из
fingerprint; controller-а assertNoForbiddenKeys (raw body) ловит forged
server-owned поля → 422 → claim rollback (T4-pattern в payment-flow:
forge → 422, 0 Payment). PASS.

## 12. Slot-key construction

`sha256(JSON([scopeType, scopeId, operation, clientKey]))` — digest
(64 hex), детерминирован, delimiter-безопасен (JSON-массив, не join строк).
Включает все канонические размерности: principal scope, operation, opaque
key. Коллизии: sha256 + включение всех размерностей; unit #10–#14. PASS.

## 13. Raw-key storage

Digest-only: raw `Idempotency-Key` нигде не персистится (T23: JSON
всей записи не содержит raw key; slotKey — 64-hex digest). В logs/errors
ключ не выводится (code audit: error-сообщения без значений). AuditLog
не содержит ключ (audit details — code/orderId/amount/currency, T24).
PASS.

## 14. DB model / migration

`events.ExternalIdempotencyRecord` (schema.prisma) + migration
`20260815044715_add_external_idempotency_contract` (additive): enum
IN_PROGRESS/COMPLETED, slotKey UNIQUE, indexes
(scopeType+scopeId+operation; status+claimedAt), bounded fields. 0 backfill,
0 destructive ALTER. Schema ↔ migration согласованы (prisma validate +
migrate diff). Fresh replay (harness migrate deploy) — OK. Drift 0. PASS.

## 15. DB uniqueness

slotKey UNIQUE = PostgreSQL correctness authority. Claim insert → P2002 →
re-read → classify (replay/divergent/in-progress/stale). Никаких
process-local mutex. Известные гонки → controlled 409/replay, 0 raw 500
(T7/T8/T19/T22). PASS.

## 16. Concurrent identical

T7: same key + same body, `Promise.all` (независимые HTTP-запросы/транзакции)
→ ровно один Payment-факт, один idempotency-факт, оба ответа несут один
Payment, 0 raw 500. PASS.

## 17. Concurrent divergent

T8: same key + разные orderId → один execution (201), divergent → 409,
суммарно ровно один Payment-факт. Stored fingerprint не заменяется (T21:
после 409 слот остаётся stale IN_PROGRESS, корректный retry восстанавливает).
PASS.

## 18. Restart replay

T9: второй Nest instance (свежий модуль/контекст) на том же PostgreSQL →
same-key retry → DB-backed replay того же Payment без re-execution
бизнеса (payment count 1). PASS.

## 19. Crash-window analysis

Пять окон (arch doc §12): (1) до claim — ничего; (2) claim до business —
stale takeover → re-execute; (3) business commit до complete — stale
takeover → re-execute БЕЗОПАСНО (business idempotency, двойная гарантия
§23); (4) complete до HTTP — replay; (5) process death — (2)+(3).
Не exactly-once delivery: re-execution возможна после stale crash, но
повторного ФАКТА нет — документировано, не скрыто. PASS (доказательство
окна C — §20).

## 20. Crash-window C proof

Fault injection e2e T20: Payment закоммичен → complete пропущен (слот
принудительно IN_PROGRESS + stale claimedAt + null response) → retry после
stale recovery → **тот же Payment id**, Payment count 1 (нет второго),
PaymentCreated outbox count 1 (нет дубликата), PaymentHistory count 1,
слот восстановлен COMPLETED + responseStatus 201. T22: два concurrent
same-key retry после crash-остатка → ни одного raw 500, один факт, слот
COMPLETED. Зависимость от business invariant доказана (§23). Raw 500 = 0.
PASS.

## 21. Stale-CAS recovery

Stale = `claimedAt < now - IDEMPOTENCY_STALE_AFTER_MS` (30s, technical
bound — не бизнес-retention). CAS takeover: `UPDATE ... WHERE slotKey AND
status=IN_PROGRESS AND claimedAt < cutoff` (count==1 → владелец). Concurrent
reclaimers: один CAS-победитель, проигравший → re-read → replay или
controlled 409 (unit #6 + e2e T22). COMPLETED unreclaimable (проверяется
ДО stale-логики; unit #14 со старым claimedAt → replay, 0 takeover).
Active non-stale record не украдён (unit #15: fresh → bounded wait → 409,
0 takeover). Poisoned IN_PROGRESS recovery: stale takeover (T20/T21).
Никакого process-local authority. Timeout не выдуман как business policy —
30s документирован как техническая crash-граница (OBS, §45). PASS.

## 22. Time semantics

claim `claimedAt` — app-время (`new Date()`); DB default now() на
`createdAt`. Сравнения staleness — app-время на проверяющей стороне.
Скew > 30s мог бы сместить классификацию stale — зафиксировано как
не-гарантия (OBS, §45); для V1 с 30s bound и ms-уровневыми операциями
недостижимо практически. Все timestamps UTC. PASS (с OBS).

## 23. Business-idempotency dependency

Двойная (layered) гарантия, НЕ конвейт:
- **HTTP slot**: `ExternalIdempotencyRecord.slotKey UNIQUE` — один слот на
  (principal, operation, key); identical retry → replay без бизнеса;
- **Payment business invariant** (production code + DB): partial unique
  `Payment_one_active_per_order` (migration 20260814120000, `@@unique([orderId],
  where: {isActivePayment: true})`) + `createPayment` findFirst-active-check
  внутри `$transaction` (возвращает существующий → no-op) + P2002 →
  controlled 409. Доказано исполняемо: T20 (re-execution возвращает тот же
  факт), payment-flow T6/T7 (business-level retry/concurrency), unit
  payment.service.spec.

Concurrent retry safety: findFirst + partial unique сериализуют двух
конкурентов — один факт, проигравший — контролируемый 409. PASS.

## 24. Replay contract

Business-result replay: HTTP status (201) + safe body (payment DTO,
PII-free). Без Authorization/Set-Cookie (T15: replay без set-cookie),
без tracing/request-ids первого запроса, без секретов, без лишнего PII.
T14: replay body deep-equal оригиналу; T24: replay НЕ дублирует
PaymentCreated/PaymentHistory/AuditLog. PASS.

## 25. Failure semantics

| Failure | Слот | Результат |
|---|---|---|
| auth 401 | никогда не заявлен (guards до слота) | 401 |
| RBAC 403 | никогда не заявлен | 403 |
| validation 4xx | никогда не заявлен (валидация до claim) | 400/422 |
| domain 404/422 | claim удалён (rollback) | бизнес-статус |
| domain 409 (business) | claim удалён | 409 |
| unexpected 5xx | claim удалён (best-effort) | 500 без false COMPLETED |
| known DB race | replay/controlled 409/COMPLETED | 201/409, 0 raw 500 |
| complete P2025 (FIX 1) | слот удалён конкурентно, факт committed | результат возвращён, не 500 |

Нет false completed success (COMPLETED только после успешного business
execute; unit #12/#13). Нет permanently poisoned slot без контракта
(T13: ключ после rollback полностью переиспользуем). PASS.

## 26. In-progress behavior

Fresh IN_PROGRESS duplicate: bounded deterministic wait (100ms poll, ≤2s) →
COMPLETED → replay, иначе controlled 409. Нет бесконечного ожидания, нет
busy-loop (sleep между poll), нет fabricated success, нет локального
polling authority (решение — по состоянию DB). PASS.

## 27. Payment lifecycle authority

Repo-wide Payment writers после 2.12H: только `PaymentService`
(create/confirm/fail/cancel + RefundService читает). Idempotency-слой НЕ
мутирует status/version/milestones/amount/currency — хранит только safe
response копию DTO (T17: replay сохраняет PENDING, milestones null).
Любой прямой Payment write из idempotency = HIGH — отсутствует. PASS.

## 28. Provider-operation boundary

`deriveProviderOperationKey` (2.12A) не тронут: server-derived из
(paymentCode, operation), клиент никогда его не задаёт. Внешний
Idempotency-Key — HTTP request scope, НЕ провайдер-authority. Future
mapping `external request → canonical business fact → server-derived
provider operation` сохранён. PASS.

## 29. Inbox/outbox separation

`ExternalIdempotencyRecord` — отдельная сущность от `InboxEvent`
(consumer dedup по eventId) и `OutboxEvent`. Никакого event-based HTTP
request dedup. EventBus semantics не изменены (0 правок в eventbus/).
PASS.

## 30. Domain events

0 новых business domain events (diff: ни одного event-типа/emit добавлено;
idempotency-слой не эмитит). PASS.

## 31. PSP/webhook boundary

Route-graph audit (e2e T18): 0 webhook/callback роутов. Source audit
(T18): 0 axios/node-fetch/http/stripe/adyen/paypal в idempotency-модуле.
Repo-wide grep после 2.12H: единственные упоминания — pre-existing doc
comments. 0 credentials, 0 signature verifier, 0 raw-body PSP middleware,
0 provider dedup/reorder runtime. PASS.

## 32. Split/Commission boundary

0 SPLIT_AT_PAYMENT/NATIVE_SPLIT runtime (только doc comments 2.12A/2.12C);
0 CommissionPolicy/Commission/CommissionAccrual изменений (diff 0 по этим
файлам); partner-collect e2e в targeted регрессии — green. PASS.

## 33. Cross-domain Finance boundary

0 LedgerTransaction/ProviderFee/Settlement/Payout/Refund/Dispute/Invoice
новых записей/изменений от 2.12H (diff 0; e2e T18-consistent; finance
negative audits в payment-flow T11 boundary). PASS.

## 34. Platform-risk boundaries

RLS = 0 (ADR-0014); global event schemaVersion retrofit = 0; Backup/DR = 0;
load framework = 0 (concurrency-тесты — НЕ load qualification, заявлено);
Step 2.17 CI/outbox/legacy = 0. PASS.

## 35. Retention / data growth

V1 explicit: no-auto-expiry / deferred cleanup (нет канонического retention
authority — число не выдумано). Запись bounded: slotKey/fingerprint (64
hex), scope/operation (string), responseBody — safe DTO (payment create
DTO мал, PII-free). Lookup — по slotKey (PK-unique, no table scan).
Stale IN_PROGRESS — bounded 30s + takeover (не накапливается бесконечно).
Операционные hazards: рост таблицы без cleanup — зафиксирован как
deferred (Step 2.17/будущий retention); indexes присутствуют. PASS (с OBS).

## 36. Security / PII / logging

Raw key не хранится и не логируется (T23 + code audit); нет
Authorization/cookies/secrets/payment credentials в слоте; responseBody —
whitelisted business DTO; error-сообщения без значений ключа; AuditLog —
только безопасные refs (T24). PASS.

## 37. Test quality audit

Прочитаны фактические T1–T24 и unit-тесты:
- interceptor НЕ обходится моками в e2e (реальный HTTP через supertest,
  реальный AppModule, реальный ValidationPipe);
- concurrency — настоящие независимые HTTP-запросы (Promise.all) на один
  сервер/DB, НЕ fake; T9 — отдельный Nest instance (не singleton);
- cross-principal T10 — два РАЗНЫХ созданных пользователя (не same-user);
- source grep (T18) — только дополнение к route-graph/runtime audits, не
  единственное доказательство;
- race-тесты не сериализованы await-ами (Promise.all);
- failure-тесты достигают реального business service (T13 404 через
  PaymentService, T20 fault-injection на реальном слоте).
Единственный тестовый нюанс: duplicate-header физически сложно отправить
через superagent (Node join) — покрыт unit (constants spec #6) +
документировано поведение join с ",". PASS.

## 38. Adversarial tests (prompt §36)

1. duplicate header values — unit (constants #6) ✔
2. property-order-independent fingerprint — unit (fingerprint #2) ✔
3. nested canonicalization — unit (fingerprint #2) ✔
4. omitted vs null — unit (fingerprint #7) ✔
5. forbidden/stripped-field behavior — payment-flow T4 (forge → 422) +
   whitelist-validated fingerprint ✔
6. cross-principal same key — e2e T10 ✔
7. concurrent identical via independent contexts — e2e T7 (+T19 ×3) ✔
8. concurrent divergent — e2e T8 ✔
9. crash after Payment commit before idempotency completion — e2e T20
   (fault injection) ✔
10. concurrent stale reclaim — e2e T22 ✔
11. completed record cannot be reclaimed — unit #14 ✔
12. active non-stale record cannot be stolen — unit #15 ✔
13. replay does not duplicate Payment event/history — e2e T24 ✔
14. raw key not persisted/logged — e2e T23 + code audit ✔
15. unknown P2002 not treated as replay — unit #11 (non-P2002 rethrow;
    P2002 на create всегда слот-конфликт — единственный unique) ✔
16. unknown internal error not converted into false completed — unit
    #12/#13 ✔

## 39. P2002 / error handling

Каждый P2002 catch проверен: claim-create P2002 = slotKey conflict
(единственный unique на таблице) → re-read → classify (никогда no-op
success); non-P2002 → rethrow (unit #11). Complete P2025 → FIX 1
(§44). deleteMany — best-effort с warn, не проглатывает основную ошибку.
PASS.

## 40. API docs

`docs/architecture/external-api-idempotency-contract.md` точно описывает:
protected endpoint, header rules, principal/operation scope, fingerprint,
identical retry, divergent reuse, in-progress, failure/replay semantics,
crash-window C, stale recovery, зависимость от Payment business
idempotency, guarantees/non-guarantees (не exactly-once). Overclaims: 0
(после FIX 1 report §27 OBS 3 обновлён на фактическое поведение P2025).
PASS.

## 41. Architecture docs

Arch doc — отдельный документ с полным разделом design/term/guarantees;
implementation report §1–§31; Roadmap entry — фактический текст (регрессия
совпадает с воспроизведённой). PASS.

## 42. Migration / fresh replay / drift

`migrate status`: 57/57 up-to-date; fresh replay через канонический
harness (globalSetup `migrate deploy` на travelhub1_test) — успешно в
каждом e2e-прогоне; live→schema diff: empty (drift 0). Никакого
`db push`. PASS.

## 43. Findings

- FIX 1 (LOW): complete-P2025 race — слот удалён конкурентным rollback-ом
  между business commit и complete → raw 500 возможен в pathological
  >30s-window; исправлено (возврат committed result, не 500) + unit #10.
- OBS 1: время staleness — app-clock на проверяющей стороне; скew > 30s
  мог бы сместить классификацию; для V1 недостижимо практически,
  зафиксировано как non-guarantee (§22).
- OBS 2: duplicate-header физически join-ится Node в "a, b" → charset
  reject (400); Array-форма отклонена тоже; поведение документировано.
- OBS 3: recursion «P2002 → слот исчез → retry execute» — bounded
  фактической гонкой; не бесконечен (deletor завершается); оставлено как
  есть, документировано.
- OBS 4: retention/deferred cleanup — таблица растёт без cleanup (V1
  решение, §35); Step 2.17/будущий retention.
- OBS 5: status derivation — Nest применяет @Post default 201 после
  interceptors; deriveStatus + явный res.status на replay; проверено
  T14/T15/T19.

## 44. Review fixes

- FIX 1: `IdempotencyService.executeFresh` — P2025 на complete →
  возвращаем закоммиченный бизнес-результат (0 raw 500);
- FIX 2 (tests): +13 adversarial unit (constants 7, service 6: P2025,
  non-P2002, generic-error, completed-unreclaimable, non-stale-not-stolen);
- FIX 3 (tests): +5 e2e fault-injection (T20 crash window C, T21 divergent
  hijack, T22 concurrent stale reclaim, T23 raw-key, T24 no-duplicate
  event/history).

## 45. Observations

См. §43 OBS 1–5. Отдельно: e2e время T20–T22 включает 2s bounded-wait
paths (детерминированный 409) — намеренно, в пределах testTimeout.

## 46. Backend regression

- `tsc --noEmit` clean; `npm run build` OK;
- full unit: **655/655** (51 suites; +13 adversarial vs 2.12H impl 642);
- idempotency e2e spec: **24/24** (T1–T24, default config, clean exit);
- targeted e2e (payment-flow, provider-abstraction, chargeback, refund,
  finance-domain, auth-rbac, commission-policy, partner-collect): **8/8
  suites PASS**;
- full serial e2e: **1177/1177 (67 suites), 0 FAIL** (+5 T20–T24 vs
  implementation 1172).

## 47. Frontend regression

Frontend не изменён: `tsc --noEmit` clean; Vitest **135/135**; `next build`
OK.

## 48. DB regression

migrate status 57/57 up-to-date; fresh replay (canonical harness) OK; drift
0 (live→schema diff empty).

## 49. Artifact integrity

`scripts/check-roadmap-artifacts.mjs`: **PASS=102 WARN=0 FAIL=0** (61 approved
steps, 484 references; после Roadmap-апдейта; checker regression 13/13).

## 50. Negative checks

real PSP network 0; production PSP adapters 0; webhook/callback routes 0;
signature verification 0; provider webhook dedup 0; AUTHORIZED transition 0;
SPLIT_AT_PAYMENT 0; Commission authority changes 0;
Ledger/ProviderFee/Settlement/Payout runtime changes 0; provider
Refund/Dispute execution 0; RLS 0; global schemaVersion retrofit 0;
Backup/DR 0; load framework 0; Step 2.17 implementation 0; Step 2.12B
implementation 0. (grep-аудиты + route-graph T18 + diff 68c28bc→cd8ed56.)

## 51. Files changed (review pass)

- `backend/src/shared/idempotency/idempotency.service.ts` (FIX 1);
- `backend/src/shared/idempotency/idempotency.constants.spec.ts` (new);
- `backend/src/shared/idempotency/idempotency.service.spec.ts` (+6);
- `backend/test/external-idempotency-contract.e2e-spec.ts` (+5 T20–T24);
- `docs/architecture/external-api-idempotency-contract.md` (уточнён §12/§18
  про P2025-поведение);
- `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md` (2.12H →
  APPROVED; NEXT → 2.12B);
- этот отчёт.

## 52. Roadmap / dependency update

2.12H → `✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`;
NEXT → `PHASE 2 — STEP 2.12B — <exact canonical title из Roadmap>`.
Dependency chain: `2.12A APPROVED → 2.12H APPROVED → 2.12B`. 2.12B НЕ
начат.

## 53. Persistence

Двухкоммитная конвенция: review-коммит, затем footer/provenance-коммит.

## 54. Repository Evidence

REPOSITORY EVIDENCE
repository: travelhub_v1 (local canonical identity)
branch: master
head: 085d6fa
origin: 085d6fa
worktree_clean: false (unrelated untracked prompts)
migration_count: 57
reviewed_state: COMMIT
reviewed_diff_base: 68c28bc
reviewed_diff_head: 085d6fa
persistence_status: PERSISTED
persistence_sha: 085d6fa

## 55. Release

RELEASE: NOT PERFORMED — NEXT DEPENDENCY STEP REQUIRED

## 56. Exact NEXT

`PHASE 2 — STEP 2.12B — PAYMENT PROVIDER INTEGRATION (PSP/webhook execution)` —
НЕ начинается в этом проходе.

## 57. Final statement

Двойная гарантия «ни одного второго committed Payment» доказана
исполняемо: HTTP-слот (DB unique) + Payment business invariant (partial
unique + findFirst-check). Fault-injection (T20/T22) воспроизвёл crash
window C и stale recovery без дубликатов и без raw 500. FIX 1 закрыл
единственный найденный raw-500 риск (P2025 complete race, LOW,
pathological window). Все hard gates PASS; регрессия зелёная; 2.12B не
начат.
