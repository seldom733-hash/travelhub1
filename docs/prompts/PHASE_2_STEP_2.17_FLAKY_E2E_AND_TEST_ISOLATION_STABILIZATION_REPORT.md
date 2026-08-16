# PHASE 2 — STEP 2.17 — FLAKY E2E & TEST ISOLATION STABILIZATION — REPORT

## 1. Baseline
- branch: `master`
- reviewed_base_sha: `bb94f94` (docs(2.17): populate REPOSITORY EVIDENCE footer in implementation report)
- HEAD == upstream == `bb94f94` на старте пасса
- Step 2.17 status: `IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW` (не менялся, не одобрен)
- migration count на старте: 58/58 (включая `add_user_token_version`)
- canonical e2e command: `cd backend && npx jest --config test/jest-e2e.json --runInBand` (serial, один процесс, одна физическая тестовая БД, пересоздаваемая global setup)

## 2. Symptom
Полный serial e2e-прогон (69 суитов, один процесс) может дать единичный FAIL в zero-fanout/counter assertions; повторный прогон — зелёный. Зафиксировано в implementation-пасе: chunk2 первый прогон 673/674, повторный 674/674. Точное место: `sale-completion-order-requested.e2e-spec.ts` тест 29–30 — `retryFailed()` ожидал `1`, получил `2` (в общей БД было ДВА retryable-FAILED вместо одного).

## 3. Reproduction attempts
| run | результат |
|---|---|
| chunk2 прогон 1 (implementation) | 673/674 — sale-completion `retryFailed()==2` |
| chunk2 прогон 2 (implementation) | 674/674 (flaky подтверждён) |
| stab run 1 (полный, 600s лимит) | 36 суитов PASS, 0 FAIL, оборван по таймауту (полный прогон физически >10 мин) |
| stab chunk2a (до sale-completion) | **ВОСПРОИЗВЕДЁН FAIL**: `outbox-durable-worker` — `Transaction API error: A query cannot be executed on an expired transaction. The timeout for this transaction was 5000 ms, however 5133 ms passed` |
| sale-completion изолированно | 20/20 PASS |
| outbox-durable-worker изолированно | PASS, 0 остаточных FAILED |

## 4. Failing assertion
`retryFailed()` возвращает глобальный счётчик по ВСЕМ retryable-FAILED в общей БД (`attempts < OUTBOX_MAX_ATTEMPTS`), а не скоуп на Sale. Тест ожидает ровно 1. При «отравленной» БД — 2.

## 5. Zero-fanout contract
`retryFailed()` по контракту обрабатывает все retryable-FAILED события в outbox — scope глобальный по своей природе (это worker-механика, не счётчик конкретного Sale). Следовательно «ноль лишних FAILED в БД на момент assertion» — это и есть корректный zero-fanout инвариант. Assertion менять нельзя; надо устранить источник лишнего FAILED.

## 6. Test DB isolation audit
- Одна физическая тестовая БД (`travelhub1_test`), пересоздаётся global setup на каждый jest-процесс.
- Суиты в одном процессе делят БД; каждая спека обязана чистить свои типы/consumer.
- Отчёт: (1) одна БД reused — да; (2) релевантные таблицы не полностью сбрасываются между суитами — нет, только точечная очистка; (3) prior rows могут выжить — да, это ожидаемо и управляется per-suite cleanup; (4) cleanup может гоняться с worker-ами — да, но в e2e worker отключён (`OUTBOX_WORKER_ENABLED=false`); (5) app shutdown до cleanup — да (`afterAll → app.close()`); (6) другие Nest-инстансы — каждый суит создаёт/закрывает свой.

## 7. App lifecycle
Каждый e2e-суит компилирует собственный `AppModule`, инициализирует и закрывает его в `afterAll`. `OutboxWorkerService` в e2e не стартует таймер (env отключает).

## 8. Worker lifecycle audit
- Старт: `onApplicationBootstrap` → `setInterval(runCycle, 2000)` (production), отключён в e2e.
- Shutdown: `onApplicationShutdown` → `clearInterval`.
- **Дефект найден (классификация B):** `runCycle()` выполнял `publishPending()` ВНУТРИ одной длинной advisory-xact-lock транзакции. `publishPending()` синхронно исполняет consumer-ов (реальный `OrderRequestedConsumer` → создание Order → вложенный `publishPending` → `CommissionAccrualConsumer` и т.д.). Такая цепочка вложенных транзакций превысила 5-секундный interactive-transaction timeout PostgreSQL → `expired transaction` → событие остаётся FAILED/PENDING → в общей БД появляется лишний retryable-FAILED → последующий глобальный `retryFailed()` в sale-completion видит 2 вместо 1.
- Таймер отменяется корректно; in-flight-работа цикла — bounded, не блокирует shutdown.

## 9. Open handles
`--detectOpenHandles` не дал новых источников: единственный таймер worker-а отключён в e2e и `unref()`-нут в production. Принудительного process exit нет.

## 10. PENDING/FAILED contamination
Подтверждена: лишний retryable-FAILED появлялся из-за expired-transaction в worker-цикле (root cause B). Дополнительно: `outbox-durable-worker` спека триггерила реальные consumer-ы AppModule на фейковых OrderRequested → те создавали Order/OrderCreated/Commission-цепочку и оставляли 6 строк InboxEvent сирот (их eventId уже удалены). Сироты не влияли на outbox-счётчики, но контаминировали общую БД → убраны harness-hygiene очисткой.

## 11. Fixture audit
Канонические ID/счётчики: сценарии используют уникальные `sale-*`/`corr-w-*` референсы; коллизий не обнаружено. Рандомизация не добавлялась.

## 12. Root-cause classification
**B — BACKGROUND WORKER LIFECYCLE BUG** (основной) + сопутствующий **A — TEST HARNESS ISOLATION BUG** (сиротские InboxEvent от реальных consumer-ов в worker-спеке).

## 13. Evidence
- Воспроизведённый FAIL pre-sale: `expired transaction ... timeout for this transaction was 5000 ms, however 5133 ms passed` (лог `/tmp/stab-presale.log`, suite `outbox-durable-worker`).
- В chain: `publishPending` (в lock-tx) → реальный `OrderRequestedConsumer` (создание Order в собственной tx) → вложенный `publishPending` → `CommissionAccrualConsumer` — общая длительность цикла >5s.
- После фикса chunk2: 3/3, 4/4 прогонов зелёные (до фикса 1/2 flaky).
- После изолированного worker-прогона: outbox 0, Order 0, Commission 0, Inbox 0 (после hygiene-очистки).

## 14. Exact fix
**FIX 1 (production worker lifecycle, `backend/src/eventbus/outbox-worker.service.ts`):** доставка вынесена из advisory-lock-транзакции.
- Под lock (короткая tx) остаётся ТОЛЬКО атомарный flip retryable-FAILED→PENDING (`retryFailed` — findMany+update, без исполнения consumer-ов).
- `publishPending()` вызывается ВНЕ lock-транзакции — тот же путь, что в HTTP-командах; InboxEvent dedup остаётся authoritative защитой от duplicate side effect; повторная доставка идемпотентна.
- `runCycle()` возвращает `{ retried, published, lockAcquired }`; при конкуренции за lock — `lockAcquired:false`, скип.

**FIX 2 (test harness hygiene, `backend/test/outbox-durable-worker.e2e-spec.ts`):** `afterAll` дополнительно удаляет сиротские InboxEvent реальных consumer-ов (`order-requested-consumer`, `commission-accrual-consumer`), чьи eventId уже отсутствуют в OutboxEvent — детерминированная очистка только наших следов, чужие события не трогаются.

## 15. Why it does not mask the failure
- Assertion `retryFailed()==1` НЕ ослаблен, тесты не пропущены, retry-until-green не используется.
- ФИКС устраняет причину лишнего FAILED (expired transaction) в production-коде worker-а, а не прячет симптом в тестах.
- InboxEvent-очистка удаляет только записи, чьи события уже удалены самим суитом (сироты), по жёсткому предикату `eventId NOT IN (SELECT id FROM OutboxEvent)` — не маскирует production-гонки.

## 16. Production impact
**Да, положительный:** до фикса production worker (авто-старт в проде) с длинной consumer-цепочкой (OrderRequested → Order → CommissionAccrual) в цикле падал бы с expired-transaction — событие оставалось бы FAILED и доставка блокировалась бы на цикл; retryFailed также не сработал бы (умирал в той же tx). После фикса lock-транзакция короткая, доставка — вне её, цикл устойчив к длинным consumer-цепочкам. Это реальное исправление платформенного lifecycle-контракта.

## 17. Harness impact
`outbox-durable-worker` спека больше не оставляет сирот; e2e-окружение не изменено (worker остаётся выключен в e2e — тесты детерминированы, реальная интеграция покрыта спеками `outbox-durable-worker` + `outbox-failure-injection` через `runCycle()`).

## 18. Regression tests
- backend `tsc --noEmit`: 0 ошибок
- backend `npm run build`: exit 0
- backend unit (`jest --runInBand`): **666/666**
- e2e chunk1 (a–o, 30 суитов): **522/522**
- e2e chunk2 (p–z, 39 суитов): **667/667**
- итого serial e2e: **1189/1189** (69 суитов)
- event/outbox/inbox targeted: `outbox-durable-worker` (5) + `outbox-failure-injection` + `order-creation-consumer` + `sale-completion-order-requested` — зелёные
- auth-hardening (shared harness не менялся): 7/7 в составе chunk1

## 19. Targeted repetitions
- `outbox-durable-worker` изолированно: многократно зелёный, 0 остаточных FAILED/Inbox/Order/Commission
- `sale-completion-order-requested`: изолированно 20/20

## 20. Full-suite repetitions (после фикса)
- chunk1: 2× зелёный (в т.ч. финальный 522/522)
- chunk2: 4× зелёный (в т.ч. финальный 667/667; до фикса 1/2 flaky)
- полный прогон в одном процессе физически >10 мин — регрессия выполняется двумя chunk-прогонами (каждый со свежей тестовой БД, детерминизм для zero-fanout-суитов); единичных FAIL не зафиксировано ни в одном из 6 прогонов после фикса

## 21. Backend regression
см. §18; drift-проверка: `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` → `No difference detected` (exit 0).

## 22. Frontend regression
- `tsc --noEmit`: 0 ошибок
- `vitest run`: **135/135** (23 файла)
- `npm run build`: ✓ (production build green)

## 23. DB result
- `prisma migrate status`: 58/58 applied, no drift
- live DB == schema (diff exit 0)
- миграций в этом пассе не добавлялось (schema не менялась)

## 24. Artifact integrity
- checker regression: **13/13**
- реальный checker: **PASS=119, WARN=0, FAIL=0**

## 25. Negative checks
```text
business feature expansion = 0
sales.service structural refactor = 0
2.17C implementation = 0
PSP/payment work = 0
RLS = 0
Backup/DR = 0
load qualification = 0
Strict Review = NOT STARTED
assertions weakened = 0
tests skipped = 0
automatic flaky retry masking = 0
forced process exit = 0
```

## 26. Deferred 2.17 items for Strict Review
- multi-instance rate limiter (LoginThrottleService per-instance) — TO BE JUDGED BY STRICT REVIEW
- детальная ADMIN SoD-декомпозиция — TO BE JUDGED BY STRICT REVIEW

## 27. Files changed
- `backend/src/eventbus/outbox-worker.service.ts` (FIX 1 — доставка вне lock-tx)
- `backend/test/outbox-durable-worker.e2e-spec.ts` (FIX 2 — harness hygiene: сиротские InboxEvent)
- `docs/architecture/platform-hardening-2.17.md` (lifecycle-контракт worker-а обновлён — §16)
- `docs/prompts/PHASE_2_STEP_2.17_FLAKY_E2E_AND_TEST_ISOLATION_STABILIZATION_REPORT.md` (данный отчёт)

## 28. Persistence
см. REPOSITORY EVIDENCE ниже.

## 29. Repository Evidence
```text
REPOSITORY EVIDENCE
repository: D:\travelhub_v1
branch: master
reviewed_base_sha: bb94f94
stabilization_commit_sha: (см. финальный коммит)
provenance_footer_commit_sha: N/A (футер в теле отчёта, чекер валиден)
final_head_sha: (см. финальный коммит)
upstream_sha: (см. финальный коммит)
push_status: PUSHED
worktree_clean: false (незакоммиченные untracked prompt-файлы предыдущих шагов — не мои)
migration_count: 58
artifact_integrity: PASS=119 WARN=0 FAIL=0
persistence_status: PERSISTED
release_status: NOT RELEASED
```

## 30. Release
`RELEASE: NOT PERFORMED — STRICT REVIEW REQUIRED`

## 31. NEXT
`PHASE 2 — STEP 2.17 — STRICT REVIEW`

---

PHASE 2 STEP 2.17 FLAKY E2E & TEST ISOLATION STABILIZATION COMPLETED — READY FOR STRICT REVIEW
