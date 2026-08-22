# PHASE 2 — STEP 2.17B PERFORMANCE REMEDIATION

## Final Implementation Prompt

Ты работаешь в существующем репозитории **TravelHub**.

Текущий статус этапа:

- **Step 2.17B Final Re-Qualification (Round 2): завершён**;
- итоговый вердикт: **VERDICT B — VALID SYSTEM FAIL**;
- **Step 2.17B остаётся NOT APPROVED**;
- следующий разрешённый этап: **Step 2.17B Performance Remediation**;
- baseline квалификационного прогона: commit `d9f25bb`;
- изменения отчёта и Roadmap зафиксированы коммитами `a9dbbd3` → `efa6e9f` → `ef90335`;
- на момент передачи контекста `HEAD == upstream`;
- isolated representative DB `travelhub_perf_r2fq_095905`, использованная для Round 2, удалена после прогона.

Цель текущей задачи — доказательно выявить и устранить причины трёх подтверждённых performance failures, не ослабляя frozen-критерии, не маскируя проблемы настройками харнесса и не изменяя бизнес-семантику системы.

После remediation нельзя автоматически считать Step 2.17B одобренным. Исправления должны только подготовить систему к отдельному полному прогону **Final Re-Qualification Round 3**.

---

## 1. Подтверждённый baseline Round 2

Полная frozen-матрица была выполнена на REPRESENTATIVE dataset с canonical configuration и без tuning.

| Гейт | Результат Round 2 |
|---|---|
| Steady 15 min @ 50 RPS | PASS — 45,000 запросов @ 50.0/s; Class A p95 20 ms, Class B p95 35 ms |
| Peak 15 min @ 100 RPS | PASS — 90,000 запросов @ 100.0/s |
| Burst 60 s @ 200 RPS | PASS — 12,000 запросов @ 199.8/s |
| Soak 30 min @ 50 RPS / 250 | PASS — 90,000 запросов, 0 unexpected |
| Payment 2/10 RPS | PASS — Class E p95 243/432 ms |
| Payment concurrency 50 | Correctness PASS; Class E tail p95 около 4.3 s — remediation observation |
| Booking/Order 6 chains/s | PASS — 348/360 |
| Booking/Order burst 20 chains/s | VALID FAIL — 103/300 даже при concurrency 50; chain p95 14.2 s |
| Login 2/5 RPS | PASS — Class F p95 113/100 ms |
| EventBus burst 1,000 / recovery 5,000 | PASS |
| Multi-instance 2+2 | PASS — 6,000/6,000; баланс 3,149/3,150 |
| EventBus steady backlog ≤100 | VALID FAIL — fresh backlog 171 > 100; oldest PENDING 1.7 s ≤ 10 s |

Дополнительные подтверждённые факты:

- EventBus F-2 воспроизведён на чистом прогоне: новый результат `171`, исторический результат `178`;
- Booking/Order burst не создаёт дублей и сохраняет convergence `1:1`, но требуемая нагрузка не прикладывается;
- root cause Booking/Order burst пока **не доказан**;
- в payment-харнессе найден артефакт: paced warmup переиспользовал idempotency keys;
- payment-гейты были корректно перезапущены с `--warmup=0`;
- точность проверки подтверждена условием `completedSlots === started`;
- этот дефект харнесса уже задокументирован и не должен использоваться как объяснение системных failures.

Регрессионный baseline после Round 2:

- backend TypeScript check: PASS, 0 ошибок;
- backend build: PASS;
- backend unit: 753 PASS;
- backend e2e: 1,194 PASS;
- frontend TypeScript check: PASS, 0 ошибок;
- frontend Vitest: 135 PASS;
- frontend build: PASS;
- migrations: 58/58;
- schema drift: 0;
- artifact checker: PASS.

---

## 2. Scope текущего remediation

Работа ограничена тремя направлениями:

1. **EventBus steady backlog F-2** — backlog `171 > 100`.
2. **Booking/Order burst 20 chains/s** — `103/300`, chain p95 `14.2 s`.
3. **Payment Class E concurrency-50 tail** — correctness PASS, но p95 около `4.3 s`.

Разрешены только изменения, необходимые для:

- инструментированной диагностики;
- доказательства root cause;
- устранения доказанного bottleneck;
- добавления целевых regression/performance checks;
- актуализации технической документации, отчёта и Roadmap по фактическим результатам.

Не расширяй scope на общую оптимизацию приложения, косметический рефакторинг, новые функции или unrelated cleanup.

---

## 3. Неприкосновенные ограничения

### 3.1 Frozen workload и критерии

Запрещено:

- снижать RPS, chains/s, concurrency или длительность frozen-гейтов;
- увеличивать допустимый EventBus backlog выше `100`;
- ослаблять latency/error/correctness thresholds;
- уменьшать representative dataset;
- удалять тяжёлые операции из сценариев;
- менять request mix, think time, pacing или семантику цепочек ради PASS;
- исключать медленные результаты из статистики;
- подменять end-to-end latency внутренней latency отдельного участка;
- считать незавершённые слоты успешными;
- использовать warmup, который переиспользует idempotency keys или загрязняет measured phase;
- повышать concurrency харнесса без доказательства, что именно клиентский лимит был причиной;
- выполнять ручной/canonical-невалидный tuning только для получения зелёного результата.

Если обнаружен новый дефект харнесса, его можно исправить только при наличии воспроизводимого доказательства. До и после исправления нужно показать, что workload semantics и frozen acceptance criteria сохранились.

### 3.2 Correctness и бизнес-инварианты

Оптимизация не должна нарушать:

- idempotency;
- отсутствие duplicate bookings/orders/payments/events;
- Booking ↔ Order convergence `1:1`;
- корректность транзакционных границ;
- порядок и надёжность domain events;
- retry/recovery semantics;
- multi-instance correctness;
- auth и tenant isolation;
- существующие API contracts;
- миграционную совместимость;
- observability и auditability.

Запрещено добиваться ускорения через fire-and-forget там, где операция по контракту обязана быть подтверждена, через потерю событий, отключение durable processing или перенос обязательной работы за пределы измеряемой цепочки без архитектурного обоснования.

### 3.3 Конфигурация и инфраструктура

- Не скрывай исправление только в локальной untracked-конфигурации.
- Все необходимые настройки должны быть canonical, документированы и воспроизводимы.
- Не увеличивай ресурсы инфраструктуры как единственное «исправление», пока не доказано, что система корректно использует текущие ресурсы и bottleneck действительно ресурсный.
- Любое изменение worker count, batch size, polling interval, pool size, lock strategy или queue concurrency должно иметь расчёт, доказательство и проверку побочных эффектов.

---

## 4. Обязательный порядок работы

### 4.1 Preflight и сохранение baseline

Перед изменениями:

1. Прочитай актуальные:
   - Roadmap;
   - Step 2.17B qualification report;
   - performance runbook;
   - frozen matrix/specification;
   - harness documentation;
   - связанные ADR и operational notes.
2. Проверь текущий branch, `HEAD`, upstream и состояние worktree.
3. Не перезаписывай и не удаляй чужие незакоммиченные изменения.
4. Подтверди реальные команды запуска и canonical configuration из репозитория.
5. Найди кодовые пути EventBus, Booking/Order chain и Payment Class E.
6. Зафиксируй baseline соответствующих targeted repro до внесения исправлений.

Если фактический HEAD отличается от указанного в handoff, продолжай только после документирования расхождения и проверки, что нужные Round 2 артефакты присутствуют.

### 4.2 Диагностика до исправления

Для каждого направления сначала сформулируй проверяемые гипотезы, затем собери измерения, которые могут подтвердить или опровергнуть каждую гипотезу.

Нельзя объявлять root cause на основании одной корреляции, одного медленного SQL-запроса или общего предположения.

Доказательство должно связывать:

`workload → saturation/wait → конкретный code/resource path → observed failure`.

Используй минимально инвазивную инструментализацию. Она должна позволять отделить:

- client-side scheduling и achieved arrival rate;
- queueing до приложения;
- HTTP/application latency;
- ожидание connection pool;
- длительность транзакции;
- SQL execution и lock waits;
- event enqueue/claim/process/ack;
- retries/backoff;
- worker utilization;
- CPU, memory, event-loop lag и GC;
- downstream latency;
- end-to-end chain completion.

Инструментализация не должна включать sensitive payloads, credentials, tokens или персональные данные.

---

## 5. Workstream A — EventBus steady backlog F-2

### 5.1 Failure definition

- frozen acceptance: steady backlog `≤100`;
- Round 2: backlog `171`;
- historical observation: `178`;
- oldest PENDING: `1.7 s`, что проходит отдельный лимит `≤10 s`;
- формальный итог: **FAIL**, даже при проходящем oldest-age criterion.

### 5.2 Обязательная диагностика

Измерь минимум:

- produced events/s и processed events/s;
- backlog во времени, а не только финальный snapshot;
- event age distribution;
- claim batch size и фактический размер batch;
- poll/idle intervals;
- число активных workers и их utilization;
- время claim, handler execution и ack/finalization;
- retries, failures и reclaims;
- DB pool wait;
- SQL duration и lock waits для claim/update;
- долю времени worker в active work и ожидании;
- распределение событий между инстансами;
- поведение graceful shutdown и финального drain;
- различие между устойчивым backlog, sampling artifact и sawtooth polling floor.

Проверь как минимум следующие классы гипотез:

- polling cadence формирует неизбежный backlog floor;
- batch/worker throughput ниже steady production rate;
- worker concurrency ограничена кодом или конфигурацией;
- DB connection pool/locks ограничивают claim или completion;
- обработка сериализуется неожиданной блокировкой;
- retry/backoff удерживает PENDING события;
- unfair multi-instance claiming;
- метрика backlog снимается в некорректной фазе;
- часть обработчиков значительно медленнее остальных.

### 5.3 Требования к исправлению

Исправляй только доказанную причину. Возможные типы изменений допустимы, но не предписаны: корректировка claim strategy, batching, worker concurrency, polling/wakeup, индексов, транзакционных границ или handler bottleneck.

После исправления докажи:

- backlog устойчиво `≤100` в canonical steady test;
- oldest PENDING `≤10 s`;
- нет потери, дублей или неправильного порядка событий;
- burst/recovery `1,000/5,000` не регрессировал;
- multi-instance `2+2` не регрессировал;
- CPU/DB pressure не перенесла failure в другой гейт;
- shutdown/recovery semantics сохранены.

---

## 6. Workstream B — Booking/Order burst 20 chains/s

### 6.1 Failure definition

- frozen target: 20 chains/s;
- ожидаемое количество: 300 chains;
- Round 2 completion: `103/300`;
- harness concurrency уже повышалась до `50`, но failure сохранился;
- chain p95: `14.2 s`;
- duplicates: `0`;
- Booking ↔ Order convergence: `1:1`;
- root cause: **NOT YET PROVEN**.

Нельзя считать, что причина находится в харнессе, только потому что achieved rate ниже target. Нельзя считать, что причина находится в backend, пока client scheduling и concurrency accounting не измерены отдельно.

### 6.2 Разложение end-to-end chain

Добавь или используй correlation/chain ID и измерь отдельные интервалы:

1. scheduled start → actual client start;
2. client start → request accepted;
3. request accepted → booking committed;
4. booking committed → event published/visible;
5. event visible → order processing start;
6. order processing start → order committed;
7. order committed → convergence observed;
8. полная chain end-to-end latency.

Также измерь:

- started, completed, timed out, failed и cancelled slots;
- achieved starts/s по временным интервалам;
- in-flight chains во времени;
- client semaphore wait и socket/connection wait;
- server request queueing;
- event-loop lag;
- DB pool wait;
- transaction duration;
- наиболее дорогие SQL-запросы;
- row/table/advisory lock waits;
- deadlocks и retries;
- EventBus lag внутри chain;
- различия между Booking и Order участками;
- хвост latency p95/p99/max;
- resource saturation клиента, API, workers, PostgreSQL и Redis, если Redis участвует в пути.

### 6.3 Проверяемые классы гипотез

Проверь минимум:

- closed-loop или semaphore-limited harness не способен прикладывать 20 starts/s;
- ограничение HTTP connections/sockets/client scheduler;
- слишком длинная синхронная транзакция Booking;
- pool starvation;
- lock contention на общих строках/счётчиках/availability/inventory;
- serializable/advisory locking;
- синхронное ожидание downstream event/order processing;
- EventBus throughput или polling delay;
- неограниченный retry/backoff;
- N+1 или отсутствующий индекс;
- глобальная сериализация tenant/user/resource path;
- timeout меньше фактического времени корректного завершения;
- измеритель convergence сам является bottleneck.

### 6.4 Требования к исправлению

После доказательства root cause внеси минимальное архитектурно корректное исправление.

Targeted verification должна подтвердить:

- workload действительно прикладывает frozen arrival rate 20 chains/s;
- стартовано ровно ожидаемое количество слотов;
- завершение соответствует frozen gate, а не достигается увеличением незадокументированного grace period;
- duplicates = 0;
- Booking ↔ Order convergence = `1:1`;
- API/business semantics не изменены;
- chain p95 существенно улучшен и соответствует frozen qualification criteria;
- normal gate 6 chains/s остаётся PASS;
- EventBus и Payment гейты не регрессировали.

Если после исправления клиентская сторона всё ещё не прикладывает workload, результат остаётся FAIL независимо от correctness завершившихся цепочек.

---

## 7. Workstream C — Payment Class E concurrency-50 tail

### 7.1 Observation definition

- payment 2/10 RPS: PASS, p95 `243/432 ms`;
- concurrency 50: correctness PASS;
- concurrency-50 Class E p95 около `4.3 s`;
- warmup/idempotency artifact уже устранён запуском с `--warmup=0`;
- валидность measured run должна проверяться через `completedSlots === started`.

Это remediation observation, а не основание переписывать успешные correctness criteria задним числом.

### 7.2 Обязательная диагностика

Разложи tail latency минимум на:

- client scheduling/semaphore wait;
- HTTP connection wait;
- application queueing;
- idempotency lookup/insert;
- DB pool wait;
- transaction time;
- SQL и lock waits;
- external/payment-provider stub или downstream segment;
- event publication;
- response serialization;
- retries/conflicts;
- p50/p95/p99/max по операциям и по полной Class E latency.

Проверь contention по одинаковым и уникальным idempotency keys, но measured frozen run обязан использовать корректные уникальные ключи согласно сценарию.

### 7.3 Требования к исправлению

- Не ослабляй idempotency и correctness.
- Не возвращай ответ до обязательной commit/confirmation boundary.
- Не исключай timeout/slow samples из percentile.
- Не используй warmup с повторными ключами.
- Сохрани `completedSlots === started`.
- Покажи улучшение tail на concurrency 50 и отсутствие регрессии payment 2/10 RPS.
- Проверь отсутствие duplicate charges/payments и корректность повторного запроса с тем же idempotency key.

---

## 8. Реализация и качество изменений

Для каждого code/config/schema change:

1. Укажи доказанный bottleneck, который оно устраняет.
2. Объясни, почему изменение минимально и не меняет frozen semantics.
3. Добавь тест, предотвращающий возврат дефекта, где это практически возможно.
4. Сохрани обратную совместимость.
5. Для миграции обеспечь безопасный forward path и отсутствие drift.
6. Для новых индексов оцени write amplification и влияние на production-sized data.
7. Для concurrency/batching оцени DB pool budget и суммарную конкуренцию всех инстансов.
8. Для polling/worker changes проверь idle load, shutdown, retry и recovery.
9. Не оставляй временную диагностическую инструментализацию, создающую чрезмерный шум или high-cardinality production metrics.

Не делай механического массового рефакторинга. Не удаляй существующую логику без доказанной необходимости.

---

## 9. Обязательная верификация

### 9.1 Targeted tests

После каждого исправления выполни изолированный targeted repro соответствующего failure на representative data и canonical configuration.

Минимальный targeted набор:

- EventBus steady backlog gate;
- EventBus burst/recovery;
- Booking/Order 6 chains/s;
- Booking/Order burst 20 chains/s;
- Payment 2 RPS;
- Payment 10 RPS;
- Payment concurrency 50;
- relevant multi-instance check.

Не объединяй результаты разных коммитов или разных конфигураций в один PASS.

### 9.2 Полная регрессия

После code changes выполни все canonical проверки репозитория, включая минимум:

- backend TypeScript check;
- backend build;
- backend unit suite;
- backend e2e suite;
- frontend TypeScript check;
- frontend Vitest suite;
- frontend production build;
- migrations up/check;
- migration count и schema drift check;
- artifact checker;
- lint/format checks, если они являются обязательными в репозитории.

Не исправляй unrelated failures молча. Отделяй regression, pre-existing issue и environment issue доказательствами.

### 9.3 Full frozen matrix

Полный Final Re-Qualification Round 3 **не входит автоматически** в remediation.

Если Roadmap явно требует отдельный approval boundary, остановись после targeted verification и полной регрессии. Подготовь handoff для Round 3, но не объявляй Step 2.17B APPROVED.

Если в актуальном Roadmap явно разрешено выполнить Round 3 в рамках того же задания, он должен быть:

- отдельным чистым прогоном;
- на новой isolated DB;
- на REPRESENTATIVE dataset;
- с canonical configuration;
- без tuning между гейтами;
- с сохранением полной frozen-матрицы;
- с полным набором сырых артефактов;
- с удалением isolated DB только после сохранения доказательств.

При отсутствии такого явного разрешения **не запускай Round 3**.

---

## 10. Evidence requirements

Для каждого workstream предоставь:

### Before

- точную команду;
- commit SHA;
- DB/dataset identity;
- canonical config identity;
- workload parameters;
- raw counters;
- latency percentiles;
- resource/queue/lock measurements;
- подтверждённый failure.

### Root cause proof

- проверенные гипотезы;
- данные, которыми гипотезы опровергнуты или подтверждены;
- причинную цепочку;
- конкретный bottleneck;
- объяснение, почему это root cause, а не сопутствующий симптом.

### After

- точную команду;
- commit SHA;
- идентичные frozen workload parameters;
- изменённые метрики;
- correctness counters;
- сравнение before/after;
- отсутствие регрессии соседних гейтов.

Все результаты должны ссылаться на сохранённые machine-readable artifacts, а не только на скриншоты или ручное резюме.

---

## 11. Документация

Обнови только актуальные canonical документы:

- Step 2.17B remediation report;
- performance runbook — только если изменились воспроизводимые команды или canonical config;
- frozen matrix/spec — только для исправления доказанной ошибки формулировки, но не для ослабления критерия;
- Roadmap status;
- ADR/operational note, если исправление изменяет архитектурно значимое поведение.

В документации явно раздели:

- Round 2 observed failure;
- доказанный root cause;
- реализованное исправление;
- targeted verification;
- regression status;
- remaining risks;
- readiness/not-readiness к Round 3.

Не переписывай историю Round 2 и не превращай прошлый FAIL в PASS.

---

## 12. Git discipline

- Не используй destructive git commands.
- Не удаляй и не перезаписывай чужие изменения.
- Коммиты должны быть логически разделены и проверяемы.
- Не включай generated runtime data, secrets, локальные БД или временные профили.
- Перед завершением проверь `git status`, diff, историю новых коммитов и соответствие upstream.
- Push выполняй только если это прямо разрешено действующим workflow/заданием.
- Не заявляй `HEAD == upstream`, пока это не проверено фактически.

Предпочтительная структура коммитов, если она соответствует реальным изменениям:

1. diagnostic instrumentation/tests;
2. EventBus remediation;
3. Booking/Order burst remediation;
4. Payment tail remediation;
5. documentation and Roadmap update.

Не создавай пустые коммиты ради этой структуры и не дроби атомарное изменение искусственно.

---

## 13. Stop conditions

Остановись и зафиксируй BLOCKED/FAIL, если:

- representative dataset или canonical config недоступны;
- frozen workload нельзя воспроизвести;
- не удаётся отделить harness limitation от system limitation;
- root cause не доказан;
- исправление требует ослабления correctness или acceptance criteria;
- требуется неразрешённое изменение инфраструктурного sizing;
- обнаружено нарушение данных, дубли, потеря событий или convergence не `1:1`;
- миграция создаёт drift;
- targeted test проходит только после ручного tuning;
- regression suite красная из-за внесённых изменений;
- рабочее дерево содержит конфликтующие пользовательские изменения, которые нельзя безопасно обойти.

В таком случае не маскируй результат частичным PASS и не переходи к Round 3.

---

## 14. Definition of Done для remediation

Remediation может считаться завершённой только когда одновременно выполнено всё:

- root cause EventBus F-2 доказан;
- EventBus steady backlog targeted gate проходит с backlog `≤100`;
- oldest PENDING остаётся `≤10 s`;
- EventBus burst/recovery и multi-instance не регрессировали;
- root cause Booking/Order burst доказан;
- frozen workload реально прикладывает 20 chains/s;
- ожидаемое количество chains стартует и обрабатывается в рамках frozen criteria;
- duplicates = 0;
- Booking ↔ Order convergence = `1:1`;
- normal Booking/Order 6 chains/s остаётся PASS;
- причина Payment Class E tail доказана или, если она неустранима в текущем scope, документирована с убедительными доказательствами и риском;
- payment concurrency-50 tail улучшен без нарушения correctness;
- payment 2/10 RPS не регрессировал;
- полная regression matrix зелёная;
- migrations и drift checks зелёные;
- evidence artifacts сохранены;
- отчёт и Roadmap обновлены;
- подготовлен точный handoff для Final Re-Qualification Round 3.

Даже при выполнении Definition of Done финальный статус текущего этапа:

> **Step 2.17B Performance Remediation — COMPLETED; READY FOR FINAL RE-QUALIFICATION ROUND 3**

Запрещено выставлять:

> **Step 2.17B — APPROVED**

до отдельного успешного полного Round 3.

---

## 15. Обязательный финальный отчёт исполнителя

В конце предоставь отчёт строго в следующей структуре.

### A. Executive summary

- итог remediation;
- готовность к Round 3;
- список исправленных и оставшихся проблем.

### B. Repository state

- branch;
- initial SHA;
- final SHA;
- upstream status;
- worktree status.

### C. Root-cause matrix

| Workstream | Observed failure | Proven root cause | Evidence | Fix |
|---|---|---|---|---|
| EventBus F-2 | | | | |
| Booking/Order burst | | | | |
| Payment Class E tail | | | | |

### D. Changes

- изменённые файлы;
- миграции/индексы;
- конфигурация;
- тесты;
- observability;
- документация.

### E. Before/after results

| Gate | Round 2 baseline | After remediation | Verdict |
|---|---:|---:|---|
| EventBus steady backlog | 171, limit ≤100 | | |
| EventBus oldest PENDING | 1.7 s, limit ≤10 s | | |
| Booking/Order 6 chains/s | 348/360 | | |
| Booking/Order burst 20 chains/s | 103/300; p95 14.2 s | | |
| Payment 2 RPS | p95 243 ms | | |
| Payment 10 RPS | p95 432 ms | | |
| Payment concurrency 50 | correctness PASS; p95 ~4.3 s | | |
| EventBus burst/recovery | PASS | | |
| Multi-instance 2+2 | PASS | | |

### F. Correctness evidence

- duplicates;
- idempotency;
- Booking ↔ Order convergence;
- event loss/retry/recovery;
- payment correctness;
- multi-instance balance.

### G. Regression results

- backend tsc/build/unit/e2e;
- frontend tsc/vitest/build;
- migrations/drift;
- artifact checker;
- прочие canonical checks.

### H. Artifacts

- пути к raw results;
- логи;
- machine-readable summaries;
- profiles/traces/queries;
- remediation report;
- Roadmap update.

### I. Commits

- SHA и назначение каждого нового коммита;
- push/upstream status.

### J. Remaining risks

- остаточные риски;
- недоказанные гипотезы;
- ограничения измерений;
- что обязательно проверить в Round 3.

### K. Final verdict

Используй только один из вариантов:

1. `REMEDIATION COMPLETED — READY FOR FINAL RE-QUALIFICATION ROUND 3`
2. `REMEDIATION PARTIAL — NOT READY FOR ROUND 3`
3. `VALID SYSTEM FAIL — ROOT CAUSE/FIX INCOMPLETE`
4. `BLOCKED — ENVIRONMENT OR EVIDENCE INVALID`

Не объявляй Step 2.17B APPROVED в рамках этого задания.

---

## 16. Начало выполнения

Начни с preflight и чтения canonical документов. Затем воспроизведи targeted failures на чистом representative окружении, докажи root cause каждого workstream и только после этого вноси минимальные исправления.

Не переходи к реализации на основании предположений. Не изменяй frozen criteria. Не запускай Final Re-Qualification Round 3 без явного разрешения актуального Roadmap.
