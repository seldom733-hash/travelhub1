# PHASE 2 — STEP 2.10C — FINANCE TEMPORAL CONTRACT — STRICT REVIEW REPORT

**Verdict:** `PHASE 2 STEP 2.10C STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`
**Date:** 2026-08-14
**Review type:** independent adversarial (implementation report treated as claims, verified against actual repository state)

---

## 1. Verdict

**`PHASE 2 STEP 2.10C STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`**

Все hard gates пройдены. Найдено 2 дефекта (1 высокой серьёзности в
валидаторе, 1 пробел в покрытии) + 1 документационный пробел — все
исправлены минимальными review-fixes с регрессионными тестами; полная
регрессия зелёная. Архитектурных блокеров нет.

## 2. Repository baseline

- branch: `master`; HEAD = origin/master (без новых коммитов; изменения —
  рабочие файлы 2.10C).
- Working tree: schema.prisma, finance.validation(.spec).ts, ledger.service.ts,
  e2e (ledger/finance-domain), docs (api.md, arch docs, Roadmap, report-ы),
  untracked migration `20260814090000_add_ledger_occurred_at` +
  `finance-temporal-contract.md` + prompt/report-файлы.
- Prisma migration count: **50** (49 до 2.10C); latest:
  `20260814090000_add_ledger_occurred_at`.
- Roadmap: 2.10C был `IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`
  (после ревью → APPROVED WITH REVIEW FIXES, §38).
- Step 2.11 / 2.12+ **не начаты** (repo-wide проверено: 0 новых producer-ов,
  lifecycle, PSP, событий, ledger-постинга).

## 3. Sources inspected

`schema.prisma` (LedgerTransaction + вся finance-схема); migration SQL
`20260814090000_add_ledger_occurred_at`; `ledger.service.ts` (полностью);
`finance.controller.ts`; `finance.validation.ts` (+ spec);
`finance.service.ts`; `finance.module.ts`; `settlement.service.ts`;
`shared/field-validation.ts`; `eventbus/domain-events.ts` /
`eventbus.service.ts`; RBAC permissions/constants (без изменений); e2e:
`ledger-transaction-foundation`, `finance-domain-foundation`,
`provider-fee-settlement-payout-foundation`, `temporal-readiness`,
`phase2-entry-audit`, `booking-temporal-contract` (конвенция); e2e harness
(`e2e.global-setup.ts`/`e2e-db-config.ts`); `docs/contracts/api.md`/`events.md`/
`ids.md`; `docs/architecture/ledger-transaction-foundation.md`,
`finance-temporal-contract.md`, `temporal-readiness.md`; Roadmap v3;
implementation report 2.10C. Дополнительно: repo-wide поиск по всем
temporal-полям и всем writer-ам LedgerTransaction (не по известным файлам).

## 4. Temporal vocabulary audit

Инвентарь (repo-wide, prod-код `backend/src`):

| Field | Класс | Статус |
|---|---|---|
| `LedgerTransaction.occurredAt` | canonical business milestone (2.10C) | ✅ легитимен (producer/authority каноничны) |
| `LedgerTransaction.createdAt` | persistence/audit timestamp | без изменений |
| `LedgerTransaction.updatedAt` | — | отсутствует (append-only) |
| `authorizedAt/capturedAt/paidAt/failedAt/cancelledAt` | Payment lifecycle | **0 вхождений** в prod-коде → deferred 2.12 |
| `requestedAt/approvedAt/refundedAt/processedAt/completedAt` (Refund) | — | **0** → deferred 2.13 |
| `settledAt/paidOutAt/payoutRequestedAt/scheduledAt/sentAt` (Settlement/Payout) | — | **0** → deferred 2.14A/B |
| `voidedAt/reversedAt` | reversal | **0** |
| `occurredAt` в catalog.behavioral / communication / eventbus | unrelated domain fields (client UTC event time, outbox projection) | отдельные домены, не Finance; не путать |

**Hard gate PASS:** Step 2.10C не ввёл ни одного lifecycle-милстоуна с
несуществующей producer-семантикой.

## 5. `occurredAt` semantic review

- `occurredAt` = когда бизнес/финансовый факт наступил (UTC instant);
  `createdAt` = когда TravelHub персистировал запись.
- Код (ledger.service.ts docstring, LedgerCreateInput), тесты (3B), API
  контракт (api.md), arch docs и миграция согласованы. Двусмысленных
  формулировок типа «transaction date» нет.
- Код нигде не выводит бизнес-время из `updatedAt` (у Ledger его нет;
  `updatedAt` не используется как milestone — repo-wide подтверждено).

## 6. Migration review — HARD GATE PASS

SQL: `ALTER TABLE "finance"."LedgerTransaction" ADD COLUMN "occurredAt" TIMESTAMP(3);`
- аддитивная, nullable, без default, без backfill, без destructive rewrite,
  без `db push`; 0 несвязанных изменений схемы;
- fresh replay: harness (см. §39) применяет реальные миграции — все e2e
  стартуют на пересозданной БД; `prisma migrate status` = **50/50, up to
  date** (проверено фактически в этом ревью); drift 0.

## 7. Write-path audit — HARD GATE PASS

Repo-wide поиск writer-ов `LedgerTransaction`/`occurredAt` в `backend/src`:
- `.create` — только `LedgerService.create` (canonical);
- `.update/.updateMany/.upsert/.delete/.deleteMany` в production — **0**;
  (`deleteMany` встречается только в тестовом afterAll-cleanup);
- raw SQL / seeds / jobs / consumers / scripts, пишущие occurredAt — **0**;
- cross-domain writers — **0**.

Ровно один канонический writer: `LedgerService.create`. Несколько authority
отсутствуют → stop-condition §44.1 отрицателен.

## 8. Append-only regression — PASS

- Нет `updatedAt`; нет публичных mutation-эндпоинтов (POST/PATCH/DELETE →
  404, e2e 1/8); нет production update/delete-пути; нет cascade-поведения,
  способного стереть историю;
- `occurredAt` immutable после первого create: public API не патчит,
  внутренний replay не перезаписывает (e2e 3C), concurrent duplicate не
  перезаписывает (e2e 3D), maintenance-путей нет;
- исправление «корректировкой строки» отсутствует и не реализовано
  (компенсирующий факт — будущий одобренный шаг, как в 2.10A).

## 9. Input authority / validation — **REVIEW FIX 1 (HIGH)**

**Дефект:** `validateOccurredAt` полагался на lenient `Date.parse`.

**Evidence (фактический прогон node в этом ревью):**
- `"2026-08-01"` → `2026-08-01T00:00:00Z` (date-only → выдуманная полночь);
- `"2026-08"` → `2026-08-01T00:00:00Z` (месяц → полночь 1-го);
- `"08/01/2026"` → `2026-07-31T20:00:00Z` (US-формат, **локальный TZ**);
- `"August 1, 2026"` → `2026-07-31T20:00:00Z` (human string, **локальный TZ**);
- `"2026-08-01 10:00:00"` → `2026-08-01T06:00:00Z` (space, без offset,
  **локальный TZ**);
- `"2026-02-30T00:00:00Z"` → `2026-03-02T00:00:00Z` (**молчаливая нормализация
  невозможной даты в ДРУГОЙ instant**); `"2026-04-31"` → May 1.

**Нарушенный инвариант:** контракт «server-валидированный ISO 8601 UTC
instant», «никогда не выводится из локальной timezone», «malformed/impossible
никогда не становится authority» — одинаковая строка давала РАЗНЫЕ инстанты
на машинах с разным TZ; невозможная дата становилась authority с другим
instant (data-integrity для authoritative-поля ledger).

**Fix (минимальный, в `finance.validation.ts`):** строгий структурный regex
`^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:?\d{2})$` +
`Date.parse` range-check (month 13, hour 25, minute 60, offset +25:00 →
INVALID) + round-trip: локальные компоненты (offset применён обратно)
обязаны совпадать с написанными (Feb 30/Apr 31 отклоняются).

**Regression test:** unit (offset-эквивалентность Z/+02:00/-04:30/+0200 →
один instant; rejects: date-only, month-only, US-locale, human string,
space-separated, без Z, month 13, hour 25, minute 60, offset +25:00,
Feb 30, Apr 31, non-string) + e2e 3B расширен (offset `+02:00` → один instant
после persistence; `"2026-08-01"`/`"08/01/2026"`/Feb 30 → reject, 0 строк).

**Post-fix:** unit 16/16, ledger e2e 22/22.

## 10. UTC / offset normalization — PASS (после FIX 1)

Проверено фактически: `Z`, `+02:00`, `-04:30`, `+0200` (ISO ±HHMM) →
один и тот же instant `2026-08-14T10:00:00.000Z` (unit); через
Prisma/PostgreSQL round-trip `"2026-08-01T12:00:00+02:00"` →
`2026-08-01T10:00:00.000Z` (e2e 3B). Исходный текстовый offset не
сохраняется (schema этого не обещает) — хранится абсолютный instant.

## 11. Future-time policy — PASS (после docs-fix)

- `occurredAt <= createdAt` НЕ enforced в коде (нет констрейнта) — это
  семантическое ожидание для исторических фактов; producer clock-skew
  (будущий occurredAt) контрактом НЕ запрещён.
- Тест 3B проверяет инвариант на исторической метке (прошлое относительно
  времени прогона) — не флаки по wall-clock (в implementation-фазе была
  исправлена метка `2026-08-14T10:00Z` → `2026-08-01T10:00Z`, которая на
  машинах с ранними часами ломала бы `occurredAt <= createdAt`).
- **Docs-fix (LOW):** future-time policy явно зафиксирована в `api.md`
  (раньше была только в арх-доке §14). Реализация/тесты/доки согласованы.

## 12. First-write-wins review — HARD GATE PASS

- Case A (identical replay): один факт, no-op (e2e 9, 3C) — PASS;
- Case B (другой amount/currency): controlled 409, не молчаливый no-op
  (e2e 9A, 3E) — PASS;
- Case C (тот же payload, другой occurredAt): first-write-wins — существующая
  строка не меняется, второй строки нет, update нет, raw 500 нет (e2e 3C
  sequential, 3D concurrent) — PASS;
- Docs явно объясняют, почему temporal metadata вне divergent-payload
  rejection (§16 2.10C: retry позже не должен расходиться с идентичным
  логическим replay). Противоречия с authority `occurredAt` НЕТ: authority
  определяет, ЧТО валидируется при первом write; first-write-wins определяет
  поведение replay — оба задокументированы и не конфликтуют.

## 13. Replay / concurrency review — PASS (после FIX 2)

**FIX 2 (MEDIUM — пробел покрытия §14/§38):** до ревью отсутствовали
concurrent-тесты для temporal-разногласия и concurrent divergent payload.

Добавлены:
- **e2e 3D** (§38.2): concurrent same payload + разные occurredAt → оба пути
  возвращают один факт (победитель + P2002-replay no-op), первый occurrence
  сохранён, count=1, без raw 500;
- **e2e 3E** (§38.3): concurrent divergent amount → ровно один факт + ровно
  один controlled `ConflictError` (2.10A FIX 1), без raw 500;
- §38.1 (concurrent identical) — существующий e2e 10; §38.4 — все три сценария
  без 500.

**Post-fix:** ledger e2e 22/22.

## 14. P2002 review — PASS

`uniqueConstraintNames` различает известный idempotency-констрейнт
(`LedgerTransaction_sourceType_sourceId_type_key` → replay-обработка) и любой
другой P2002 (например `LTX_code_key` → controlled `ConflictError`, НЕ
трактуется как replay); non-P2002 перевыбрасывается. Глобального
«все P2002 = replay» нет (код прочитан полностью).

## 15. Immutability of `occurredAt` — PASS

Public API не патчит (нет write-путей, 404); internal replay не
перезаписывает (3C); concurrent duplicate не перезаписывает (3D); нет
maintenance-путей в production source (поиск: только `.create`).

## 16. Legacy compatibility — PASS

Pre-2.10C строки с `occurredAt = NULL` листаются и читаются по detail
(e2e 3B noOcc: DTO null; 17: legacy rows читаемы); сериализация не падает;
repair-on-read отсутствует (нет кода); backfill при старте отсутствует
(миграция — ADD COLUMN только).

## 17. Read API contract — PASS

`occurredAt: string | null` (ISO UTC) в list/detail; стабильная форма
(whitelist DTO `ledgerDto`); pagination/фильтры не менялись; фильтрация/
сортировка по `occurredAt` НЕ добавлена (не изобретена без контракта).
Непредусмотренные внутренности не экспонируются.

## 18. Mass-assignment review — PASS

Публичных write-эндпоинтов Ledger нет вовсе (POST/PATCH/DELETE → 404).
`occurredAt` отсутствует во всех клиентских DTO. Forge невозможен по
построению; на master-data поверхностях конвенция loud rejection
(`assertNoForbiddenKeys` → 422) сохранена и не ослаблена (e2e finance #5).
Будущие write-пути обязаны следовать той же конвенции (арх-док §16/§24).

## 19. Payment temporal boundary — HARD GATE PASS

`authorizedAt/capturedAt/paidAt/failedAt/cancelledAt/voidedAt` — **0**
вхождений в prod-коде/схеме/миграциях/событиях (repo-wide поиск); e2e
finance #11 (0 колонок по всей finance-схеме) и ledger #15 (0 на Ledger).
Schema-only модели не стали основанием для fabricated милстоунов.

## 20. Refund temporal boundary — HARD GATE PASS

`requestedAt/approvedAt/refundedAt/processedAt/completedAt` (Refund) — **0**
вхождений; Step 2.13 не начат.

## 21. Settlement temporal boundary — HARD GATE PASS

`settledAt/processedAt/completedAt`/mutable status — **0**; Settlement 2.10B
остался immutable foundation без lifecycle; version-семантика — 2.14A.

## 22. Payout temporal boundary — HARD GATE PASS

`requestedAt/approvedAt/sentAt/paidOutAt/failedAt/cancelledAt` — **0**;
Payout без lifecycle/rail; attempt-семантика — 2.14B. Payout ≠ Payment.

## 23. ProviderFee boundary — PASS

ProviderFee остаётся immutable фактом 2.10B; 2.10C не добавил ему lifecycle/
temporal-полей; его `createdAt` = persistence/audit время (документировано);
`occurredAt` НЕ обобщён на другие Finance-модели (только Ledger).

## 24. Ledger / Payment / Settlement / Payout separation — PASS

`LedgerTransaction.occurredAt` не используется как substitute для
authorization/capture/refund/settlement/payout времени: ни одного
lifecycle-поля/кода, читающего occurredAt как чужой милстоун; документировано
(арх-док §25).

## 25. Events boundary — PASS

0 новых Finance доменных событий (repo-wide: events.md не изменён, eventbus
без новых типов); событие не эмитится «потому что есть occurredAt»; новых
consumer-ов нет; payload не стал authoritative для будущих милстоунов.

## 26. Auto-posting boundary — PASS

Нет автоматического ledger-постинга из Payment/Refund/Commission/
ProviderFee/Settlement/Payout/Order/Booking (e2e 14: ноль cross-domain
мутаций; единственный writer — LedgerService). Producer-интеграция — будущие
канонические шаги.

## 27. Double-entry / balance boundary — PASS

0 chart of accounts, 0 debit/credit legs, 0 balances, 0 reconciliation,
0 reversal-машины, маскирующейся под row-mutation (repo-wide поиск по
production source).

## 28. FX / tax boundary — PASS

`occurredAt` не триггерит и не меняет FX conversion / exchange-rate selection /
tax calculation / effective-date логику (0 кода; семантика только temporal).

## 29. Cross-domain write audit — PASS

0 записей в Order/Booking/Sales/Reverse/Catalog/Availability/CRM/
Communication из temporal-изменений (e2e 14: counts/paymentStatus/paidAmount
без изменений).

## 30. RBAC / PII / AuditLog / provenance — PASS

- RBAC: 0 изменений; `finance.ledger.read` без изменений; anonymous 401 /
  BUYER-PARTNER-OPERATOR-SALES_MANAGER-MODERATOR-MARKETER 403 /
  FINANCE-ADMIN-DIRECTOR-ANALYST 200 (e2e 1-2); temporal-поле не создало
  публичной write-поверхности;
- PII: occurredAt — время, без банковских/card/PSP/token/passport данных;
  audit-детали только `{ code }` (e2e 13: без email/amount);
- AuditLog: replay не создаёт дублей (audit внутри create-tx; replay-путь
  возвращает existing без нового audit-вызова); новых audit-actions нет;
- correlation/causation/actor server-authoritative, HTTP payload не может их
  переопределить (e2e 11-12).

## 31. Test coverage audit — PASS (после FIX 1/2)

Тесты проверяют persisted values (не только schema-текст); t0 — историческая
метка (не flaky wall-clock); DB-инварианты — реальные concurrent-прогоны без
mocks (3D/3E); occurrence отличим от persistence (3B); forged-поля проверены
на отсутствии путей (404) и на loud rejection (422) где применимо.

## 32. Required negative matrix — PASS

1. invalid format → controlled failure (unit + e2e 3B) ✓
2. impossible/non-ISO → отклонено фактическим валидатором (FIX 1) ✓
3. public mutation Ledger → 404 (e2e 1/8) ✓
4. forged server-owned → loud rejection где применимо (finance #5; Ledger без
   write-surface) ✓
5. future occurredAt не запрещён контрактом — задокументировано (api.md) ✓
6-7. divergent amount/currency replay → 409 (e2e 9A, 3E) ✓
8. unknown P2002 не трактуется как replay (код-аудит §14) ✓
9. legacy NULL читаем (e2e 3B) ✓
10-13. forging Payment/Refund/Settlement/Payout милстоунов невозможен (0 полей
   в схеме/коде; e2e finance #11) ✓
14. нет Ledger update/delete пути (e2e 1/8) ✓
15. нет cross-domain мутаций (e2e 14) ✓
16. нет нового event side-effect (events.md, §25) ✓

## 33. Required positive matrix — PASS

1. create без occurredAt → NULL (e2e 3B) ✓
2. create с валидным историческим occurredAt (e2e 3B) ✓
3. persisted instant = тот же абсолютный instant (e2e 3B + offset) ✓
4. createdAt остаётся persistence timestamp, не подменяется (e2e 3B) ✓
5. occurredAt <= createdAt для исторического факта (e2e 3B) ✓
6. identical replay → один факт (e2e 9/3C) ✓
7. replay не перезаписывает первый occurredAt (e2e 3C) ✓
8. concurrent identical → один факт (e2e 10) ✓
9. concurrent temporal disagreement → first-write-wins (e2e 3D) ✓
10-11. list/detail возвращают nullable occurredAt (e2e 3B/4) ✓
12. Ledger foundation (2.10A) зелёный (e2e 22/22) ✓
13. ProviderFee/Settlement/Payout foundation (2.10B) зелёный ✓
14. Finance master-data foundation зелёный (finance 12/12) ✓

## 34. Backend regression

- `tsc --noEmit` — PASS (до и после фиксов);
- unit — **498/498** (42 suites; было 497 до review-фиксов, +1 нетто от
  расширенного spec 2 → 3 теста);
- target suites (finance/ledger/temporal/provider-fee) — PASS;
- full serial e2e — **1059/1059, 59 suites** (было 1057 до фиксов, +2: 3D/3E);
- 0 skipped/focused.

## 35. Frontend regression

Фронт не изменён (git diff — 0 frontend файлов), но прогнано: `tsc --noEmit`
PASS; Vitest **135/135 (23 files)**; `next build` (production) —
**Compiled successfully**. (Baseline совпадает.)

## 36. DB regression

- `prisma migrate status`: **50/50, Database schema is up to date** (проверено
  фактически; новая миграция применена к dev через `migrate deploy`);
- drift 0; fresh replay — harness (drop+recreate + real `migrate deploy`,
  без `db push`); review-fixes схему НЕ меняли (только TS-код валидатора) —
  миграция не требовалась.

## 37. Issues found

| # | Severity | Issue | Violated invariant | Fix | Regression test | Post-fix |
|---|---|---|---|---|---|---|
| 1 | **HIGH** | lenient `Date.parse` в `validateOccurredAt`: date-only/locale/space-форматы → TZ-зависимые инстанты; невозможные даты (Feb 30) молча нормализовались в другой instant | «UTC ISO 8601 instant», «никогда не authority для malformed/impossible», «не выводится из локального TZ» | строгий regex + range-check + round-trip компонентов (finance.validation.ts) | unit (форматы/offsets/Feb 30), e2e 3B (persistence offset + 0 строк на bad input) | unit 16/16, ledger 22/22 |
| 2 | **MEDIUM** | нет concurrent-покрытия §14/§38 (temporal disagreement, divergent payload) | first-write-wins/controlled conflict при гонке | e2e 3D, 3E | — | ledger e2e 22/22 |
| 3 | **LOW** | future-time policy не была явной в api.md (только арх-док) | §12 согласованность docs/код/тесты | api.md: strict-ISO формы + future-time policy | — | docs консистентны |
| 4 | LOW (pre-review) | e2e 3B метка `2026-08-14T10:00Z` в будущем относительно машинных часов ломала `occurredAt <= createdAt` | не-flaky wall-clock | метка → `2026-08-01T10:00Z` (исправлено в implementation-фазе, перепроверено) | e2e 3B | ledger e2e 20/20 → 22/22 |

## 38. Review fixes applied

FIX 1 (HIGH, §9), FIX 2 (MEDIUM, §13), docs-fix (LOW, §11), pre-review fix 3B
(§37 #4). Все — минимальные, без расширения scope, с регрессионными тестами,
которые падали бы до фикса (unit: `"2026-08-14"`/Feb 30 ранее проходили
валидацию; e2e: concurrent-сценарии отсутствовали).

## 39. Architecture decision status

`ARCHITECTURE DECISION REQUIRED` НЕ требуется: единственный writer (stop §44.1);
occurredAt = event occurrence vs persistence — однозначно (occurredAt =
business occurrence, §5); replay с другим occurredAt = first-write-wins — явно
задокументировано и одобрено (Case C, §12); payment/refund/settlement/payout
милстоуны не требуются (производители отсутствуют); мутация исторических
строк не требуется; generic «business date» не вводится; cross-domain writes
не нужны; double-entry/balances не нужны; новых событий без consumer-а нет;
destructive-миграция/backfill не нужны.

## 40. Final certification

**`PHASE 2 STEP 2.10C STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`**

Roadmap v3 обновлён: Step 2.10C → `✅ STRICT REVIEW COMPLETED — APPROVED WITH
REVIEW FIXES (2026-08-14)`. NEXT = **`STEP 2.11 — PRICING & FINANCIAL
SNAPSHOT`** (точное canonical название скопировано из Roadmap v3; НЕ начат в
этом проходе — hard stop соблюдён).
