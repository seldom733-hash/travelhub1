# PHASE 3 — COMMAND CENTER / DECISION INTELLIGENCE
## STAGE C — ACCEPTANCE REVIEW & PRE-STAGE-D GATE

# LANGUAGE REQUIREMENT — MANDATORY

Все ответы разработчика, findings, evidence, выводы и финальный VERDICT должны быть предоставлены **НА РУССКОМ ЯЗЫКЕ**.
Технические идентификаторы, пути, endpoints, поля, enum, SHA, команды и код сохранять в оригинальном виде.

# 1. PURPOSE

Stage C сообщил `VERDICT A — STAGE C COMPLETE`. Перед Stage D выполнить короткий acceptance review трех потенциально важных точек:

1. `6 detectors` vs `4 runtime signals`;
2. detector execution / performance architecture;
3. корректность изменения route `api/v1/dashboard/decision-signals → dashboard/decision-signals`.

Это не новый implementation stage. Не реализовывать Stage D/E/F/G/H/I.

# 2. CHECK A — 6 DETECTORS VS 4 SIGNALS

Проверить все:

- `PendingBookingsDetector`
- `FailedPaymentsDetector`
- `RecentCancellationsDetector`
- `PendingRefundsDetector`
- `UpcomingBookingsDetector`
- `ServicesWithoutSalesDetector`

Вернуть таблицу:

| Detector | Executed | Condition true | Signal created/reobserved | Visible in Active | Reason |
|---|---:|---:|---:|---:|---|

Допустимо: `6 executed → 4 conditions true → 4 signals`.

Недопустимо, если сигнал потерян из-за wiring, exception, fingerprint collision, RBAC, pagination, API/frontend mapping.

Проверить failure isolation: ошибка одного detector не должна блокировать остальные и не должна маскироваться как доказанное отсутствие проблем.

# 3. CHECK B — DETECTOR EXECUTION PATH

Установить exact runtime call graph:

```text
browser
→ dashboard request
→ controller
→ dashboard service
→ buildNeedsAttention()
→ detector orchestration
→ DecisionSignal persistence/query
→ DTO
→ frontend
```

Ответить:

- какой endpoint инициирует detectors;
- сколько detector runs приходится на один page load;
- запускаются ли они при каждом refresh;
- запускаются ли повторно для comparison/sections;
- выполняются ли DB scans синхронно на каждый dashboard request.

Измерить, а не угадывать:

| Measurement | Result |
|---|---|
| Dashboard HTTP requests per page load | |
| Detector runs per page load | |
| Total detector duration | |
| `buildNeedsAttention()` duration | |
| DecisionSignal query duration | |
| Dashboard endpoint duration | |
| DB query count | measured / NOT MEASURED |

Классифицировать:

`ACCEPTABLE FOR CURRENT ARCHITECTURE` / `ACCEPTABLE WITH DOCUMENTED LIMIT` / `REMEDIATION REQUIRED`.

Не строить scheduler/event architecture без evidence необходимости.

Проверить concurrency: два одновременных запуска не должны создавать duplicate DecisionSignals или ломать fingerprint/dedup semantics.

# 4. CHECK C — API ROUTE

Reported change:

```text
api/v1/dashboard/decision-signals
→ dashboard/decision-signals
```

Проверить:

- `main.ts` global prefix;
- URI versioning;
- controller prefix;
- route decorators;
- frontend API base URL;
- реальный browser network URL.

Вернуть:

```text
Nest global prefix:
Versioning:
Controller prefix:
Frontend requested URL:
Final public URL:
Runtime HTTP status:
```

Однозначно объяснить, почему route change был `CORRECT` или `INCORRECT`.

Проверить единый canonical public route для:

- GET list;
- GET `:id`;
- POST acknowledge;
- POST resolve;
- POST dismiss.

Не должно быть `/api/v1/api/v1/...`, `/api/dashboard/...` или иных accidental variants.

# 5. NETWORK + RBAC SMOKE

Предоставить sanitized runtime evidence:

```text
GET decision-signals URL:
HTTP status:

POST acknowledge URL:
HTTP status:

POST resolve/dismiss URL:
HTTP status:
```

Без токенов.

Проверить:

```text
authorized → success
unauthorized category/user → 403 или server-side filtered result согласно контракту
```

Route fix не должен обходить guards.

# 6. ACTIVE / HISTORY

Подтвердить actual semantics:

```text
Active = OPEN + ACKNOWLEDGED
History = RESOLVED + DISMISSED
```

Если contract отличается — описать authoritative behavior.

Не считать History signal потерянным из Active.

# 7. PRODUCT BOUNDARY

Подтвердить:

| Dimension | Stage C |
|---|---|
| WHAT | IMPLEMENTED |
| WHY | NOT IMPLEMENTED — Stage D |
| IMPACT | NOT IMPLEMENTED — Stage E |
| ACTION | lifecycle/navigation only; business action → Stage F |

Не добавлять fake WHY, fake severity/impact или recommendations.

# 8. AZN SMOKE

Проверить, что B.2 не регрессировал:

```text
PLATFORM aggregate monetary values → AZN/₼
unexpected $ → absent
```

# 9. TESTS

Если product code не менялся, достаточно focused acceptance/regression evidence.

Если обнаружен defect и код исправлен — прогнать соответствующий regression scope.

Вернуть:

```text
Detector coverage:
DecisionSignal tests:
Dashboard tests:
Frontend tests:
TSC:
Route smoke:
RBAC smoke:
Browser/runtime:
AZN smoke:
```

# 10. REPORT

Создать:

```text
docs/prompts/PHASE_3_STAGE_C_ACCEPTANCE_REVIEW_PRE_STAGE_D_GATE_REPORT.md
```

Отчёт полностью на русском языке.

# 11. FILES / GIT EVIDENCE

Вернуть:

```text
Starting HEAD:
Final HEAD:
Product code changed: YES/NO
Total changed files:
Product code commit:
Report/docs commit:
Pushed to origin: YES/NO
Working tree clean: YES/NO
```

Не заявлять push без проверки.

# 12. ROADMAP

Если Stage C подтверждён:

```text
Stage C
→ VERDICT A remains valid
→ PRE-STAGE-D GATE PASSED
→ Stage D READY
```

Не создавать новый top-level implementation stage.

Если найден defect — сохранить additive remediation evidence.

# 13. ACCEPTANCE CRITERIA

Gate PASS только если:

1. Все 6 detectors зарегистрированы и реально исполняются.
2. Причина `6 detectors → 4 signals` доказана.
3. Нет потерянных signals из-за wiring/RBAC/pagination/frontend defects.
4. Detector execution path установлен.
5. Нет неприемлемого detector-on-render performance defect.
6. Concurrent execution сохраняет dedup semantics.
7. Canonical DecisionSignal public route доказан.
8. List/get/lifecycle routes consistent.
9. Route fix не обошёл RBAC.
10. Active/History semantics корректны.
11. Нет fake WHY/IMPACT/business ACTION.
12. AZN regression отсутствует.
13. Runtime evidence предоставлен.
14. Финальный отчёт на русском языке.

# 14. VERDICT

Вернуть ровно один.

## VERDICT A — STAGE C ACCEPTED / PRE-STAGE-D GATE PASSED

Если все три review areas подтверждены.

После этого `Stage D — WHY Attribution → READY`, но Stage D автоматически не запускать.

## VERDICT B — STAGE C REMEDIATION REQUIRED

Если найден исправимый defect в detector wiring, signal loss, performance, route, RBAC или runtime. Указать минимальный remediation scope.

## VERDICT C — BLOCKED

Только если acceptance невозможно доказать из-за отсутствующей prerequisite capability/environment.

# 15. STOP

После review **STOP**. Stage D не реализовывать. Вернуть report на русском языке и ждать review.
