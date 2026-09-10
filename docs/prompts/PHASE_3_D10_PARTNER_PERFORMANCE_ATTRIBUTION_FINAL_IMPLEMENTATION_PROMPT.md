# PHASE 3 — D10 — PARTNER PERFORMANCE ATTRIBUTION
## FINAL IMPLEMENTATION PROMPT

### 1. Режим выполнения

**Stage:** D10 — Partner Performance Attribution  
**Current TRUE NEXT:** D10  
**Mode:** Implementation  
**Authority:** существующий repository code + tests + canonical architecture/contracts + утверждённый D10 Scope Audit.

Этот prompt переводит D10 из Scope Audit в Implementation.

---

## 2. Цель D10

Формализовать существующий Partner Performance в Analytics Center и устранить выявленную несогласованность атрибуции.

### Canonical attribution identity

Для Marketplace Partner Performance использовать:

`Order.sellerPartnerId`

Это frozen, server-authoritative seller attribution, зафиксированный при создании Order из frozen Quote ISSUE snapshot.

### Критический дефект

Сейчас:

- Orders → `Order.sellerPartnerId`
- Bookings → `Booking.productId → Product.partnerId`

Это две разные цепочки Partner attribution.

### Требование D10

Привести Partner Performance к единой canonical attribution semantics.

**Booking attribution в Partner Performance должна быть согласована с frozen seller attribution Order, без использования mutable `Product.partnerId` как источника истины для исторической принадлежности Order/Booking к selling Partner.**

---

# 3. ЖЁСТКИЕ ГРАНИЦЫ D10

## IN SCOPE

Реализовать только:

1. Formalization of Partner attribution semantics.
2. Attribution consistency fix.
3. Согласование Partner Performance для:
   - Orders
   - GMV
   - Bookings
   - Completed Bookings
   - Revenue
   - Commission
   - Active Products
   - Booking Completion Rate
4. Документирование authoritative source.
5. Tests/regression evidence.
6. D10 qualification report.

## OUT OF SCOPE

Не реализовывать в рамках D10:

- Finance Center.
- Settlement.
- Payout.
- Payment engine.
- Refund engine.
- Новые financial rules.
- D11 project-wide KPI reconciliation.
- Storefront seller performance.
- Customers.
- Conversion.
- AOV.
- Новую Partner сущность.
- Новый Analytics Center.
- Изменение общей RBAC модели.
- Пересмотр D8 temporal contract.
- Изменение canonical Order lifecycle.
- Самовольное добавление новых KPI.

### Cancelled / Refunded Bookings

Не добавлять как обязательную часть D10.

В Scope Audit это зафиксировано как deferred enhancement. Не расширять scope без отдельного архитектурного решения.

---

# 4. ОБЯЗАТЕЛЬНОЕ ПРАВИЛО: НЕ ПРИДУМЫВАТЬ ДАННЫЕ

Перед изменением кода агент обязан проверить фактическую реализацию:

- Prisma schema.
- `AnalyticsService.getPartnerPerformance()`.
- Analytics controller.
- DTO/query contract.
- Existing Partner Performance response.
- Existing frontend table.
- Existing export path.
- Existing tests.
- Existing attribution/frozen snapshot implementation.

Нельзя предполагать наличие поля, связи, snapshot или historical relation, которых нет в repository.

Если для унификации Booking attribution отсутствует необходимый исторический источник Partner ID, **не создавать silently новую семантику и не брать mutable Product.partnerId как fallback без explicit evidence**.

В таком случае остановиться на architecture decision/gap и зафиксировать это в report.

---

# 5. ПЕРВЫЙ ШАГ — IMPLEMENTATION BASELINE AUDIT

До coding сделать краткий baseline:

```text
HEAD:
origin/master:
working tree:
current Partner Performance endpoint:
current Partner Performance service:
current attribution path for Orders:
current attribution path for Bookings:
current attribution path for Revenue:
current attribution path for Commission:
current tests:
```

Отдельно установить, где физически можно получить frozen seller attribution для Booking.

Проверить минимум:

- Booking → Order relation, если существует.
- Booking → Quote relation, если существует.
- Booking → OrderItem / QuoteItem relation, если существует.
- любой persisted sellerPartnerId в booking-related snapshot.
- любые lifecycle snapshots.
- любые existing registry/read-model projections.

Не создавать relation только ради прохождения теста.

---

# 6. CANONICAL ATTRIBUTION RULE

После baseline сформулировать одну server-side rule:

```text
Partner Performance attribution MUST resolve to the
historical seller attribution associated with the Marketplace Order.
```

Для Order:

```text
Partner = Order.sellerPartnerId
```

Для Booking:

```text
Partner = historical seller attribution of the Marketplace Order
          associated with that Booking
```

`Product.partnerId` может использоваться для **current product ownership / Active Products**, но не должен становиться authoritative historical seller attribution для Booking Performance, если исторический seller attribution существует отдельно.

### Важное различие

Не смешивать:

```text
current product ownership
```

и

```text
historical selling-partner attribution
```

---

# 7. MARKETPLACE SCOPE

Сохранить текущую границу:

```text
acquisitionSource = MARKETPLACE
```

Storefront остаётся вне D10.

Не расширять API или UI для Storefront.

---

# 8. TEMPORAL SEMANTICS

Сохранить D8 contract.

Использовать существующий:

```typescript
resolveQueryPeriod(dto)
```

и canonical:

```text
UTC instants
[start, endExclusive)
server-authoritative timezone/period resolution
```

Не вводить:

- client-side date filtering;
- browser timezone;
- `new Date()` как business semantics;
- inclusive end;
- новый period resolver.

Для каждой метрики сохранить существующий canonical business timestamp, если он уже доказан кодом.

---

# 9. METRIC CONTRACT

Сохранить только следующие D10 metrics:

| Metric | Required |
|---|---:|
| Orders | YES |
| GMV | YES |
| Bookings | YES |
| Completed Bookings | YES |
| Revenue | YES |
| Commission | YES |
| Active Products | YES |
| Completion Rate | YES |

### Attribution expectations

#### Orders

```text
Order.sellerPartnerId
```

#### GMV

```text
Order.amount
+
Order.sellerPartnerId
```

#### Bookings

Использовать historical seller attribution, связанный с Marketplace Order.

Не использовать mutable `Product.partnerId` как historical seller authority.

#### Completed Bookings

То же attribution, что и Bookings, плюс:

```text
status = COMPLETED
```

с сохранением canonical completion timestamp semantics.

#### Revenue

Сохраняется текущая authoritative Finance fact:

```text
Payment.amount
→ Payment.orderId
→ Order.sellerPartnerId
```

D10 только READ/aggregate.

#### Commission

Сохраняется:

```text
Commission.partnerId
```

как Finance authoritative fact.

D10 только READ/aggregate.

#### Active Products

Можно использовать:

```text
Product.partnerId
WHERE status = PUBLISHED
```

поскольку это metric текущего product ownership, а не historical order attribution.

#### Completion Rate

```text
completedBookings / totalBookings
```

Сохранять существующую защиту от деления на ноль и текущую business semantics.

---

# 10. FINANCE BOUNDARY

D10 категорически не должен:

- создавать Payment;
- изменять Payment authority;
- создавать Commission;
- изменять Commission rules;
- создавать Refund;
- создавать Settlement;
- создавать Payout;
- рассчитывать financial authority;
- менять Finance Center.

Допустимо только:

```text
READ → aggregate canonical Finance facts
```

Finance остаётся:

```text
NOT STARTED / DEFERRED
```

---

# 11. BACKEND IMPLEMENTATION

Изменения выполнять максимально локально.

Предпочтительное место:

```text
AnalyticsService.getPartnerPerformance()
```

Но сначала подтвердить это текущим кодом.

Не переписывать AnalyticsService целиком.

Не менять unrelated analytics queries.

Не менять API contract без необходимости.

Если response contract уже достаточен — сохранить его.

Если необходимо добавить техническое поле для корректной атрибуции, обосновать его в report и обновить frontend/tests только при доказанной необходимости.

---

# 12. FRONTEND

Partner Performance остаётся в:

```text
Analytics Center
```

Существующий surface сохраняется.

Не создавать новый Center.

Не переносить Partner Performance в Finance.

Не менять UI без необходимости.

Frontend остаётся consumer only.

Все attribution metrics должны приходить уже рассчитанными сервером.

Не переносить attribution calculation в React/TypeScript frontend.

---

# 13. EXPORT

Сохранить существующий export chain:

```text
Partner Performance query
→ shared ExportService
→ CSV/XLSX
```

Export должен использовать **те же canonical attribution results**, что и таблица.

Не создавать отдельную attribution implementation для CSV/XLSX.

Проверить regression для CSV/XLSX.

---

# 14. SECURITY

Сохранить:

```typescript
@RequirePermissions("analytics.read")
```

и существующий:

```text
resolvePartnerScope()
```

Никаких изменений RBAC scope без отдельной причины.

Обязательно сохранить Partner isolation.

Проверить negative case:

```text
PARTNER A != PARTNER B
```

Partner A не должен получить Partner B data через requested `partnerId`.

---

# 15. TEST REQUIREMENTS

После implementation добавить/обновить tests.

Минимум:

### Attribution

1. Order attribution → `Order.sellerPartnerId`.
2. Booking attribution → same historical seller attribution.
3. Product ownership change не должен ретроактивно менять historical Partner Performance attribution, если historical seller attribution существует.
4. Revenue → Payment → Order seller attribution.
5. Commission → Commission.partnerId.

### Scope

6. Marketplace included.
7. Storefront excluded.

### Temporal

8. Start inclusive.
9. End exclusive.
10. Period resolution remains D8-compliant.

### Security

11. Partner cannot see another Partner data.
12. BUYER/unauthorized roles remain blocked according to existing contract.

### Regression

13. Existing Partner Performance endpoint.
14. Existing frontend consumption.
15. Existing CSV/XLSX export.

---

# 16. EDGE CASES

Обязательно проверить:

- null `sellerPartnerId`;
- Booking без resolvable Marketplace Order;
- Booking with non-Marketplace source;
- cancelled Order;
- completed Booking;
- product transferred to another Partner;
- multiple bookings tied to same Order;
- duplicate aggregation risk;
- zero bookings;
- zero/empty revenue;
- multi-currency behaviour according to existing contract.

Не придумывать fallback semantics.

Каждый unresolved edge case должен быть явно записан.

---

# 17. НЕ ДЕЛАТЬ ЭТОГО

Агенту запрещено:

- переходить к D11;
- переходить к Finance;
- менять roadmap;
- менять TRUE NEXT;
- создавать новые roadmap;
- создавать новую финансовую модель;
- добавлять Storefront analytics;
- расширять scope ради "полноты";
- переписывать unrelated modules;
- удалять existing tests вместо исправления;
- ослаблять RBAC ради прохождения тестов;
- менять D8 semantics;
- менять Order seller attribution authority.

---

# 18. DOCUMENTATION

После code implementation добавить canonical documentation, отражающую:

1. Partner attribution identity.
2. Difference between historical seller attribution and current product ownership.
3. Order attribution.
4. Booking attribution.
5. Revenue attribution.
6. Commission attribution.
7. Marketplace boundary.
8. Temporal semantics.
9. Finance boundary.
10. D10 vs D11 boundary.

Документация должна ссылаться на реальные code/schema sources.

Не писать документ как предположение.

---

# 19. QUALIFICATION REPORT

Создать отдельный evidence report:

```text
evidence/PHASE_3_D10_PARTNER_PERFORMANCE_ATTRIBUTION_QUALIFICATION_REPORT.md
```

Report должен содержать:

## 19.1 Identity

```text
D10:
HEAD:
origin/master:
working tree:
```

## 19.2 Implementation

- changed files;
- exact attribution path;
- exact metric source;
- exact API;
- exact UI.

## 19.3 Tests

Таблица:

| Gate | Result | Evidence |
|---|---|---|
| Attribution | PASS/FAIL | ... |
| Booking consistency | PASS/FAIL | ... |
| Temporal | PASS/FAIL | ... |
| Marketplace scope | PASS/FAIL | ... |
| Finance boundary | PASS/FAIL | ... |
| RBAC | PASS/FAIL | ... |
| UI regression | PASS/FAIL | ... |
| Export regression | PASS/FAIL | ... |
| Full regression | PASS/FAIL | ... |

## 19.4 Gaps

Каждый оставшийся gap указать отдельно:

```text
ID
Severity
Description
Why not blocking
Follow-up owner/stage
```

Не скрывать gaps.

---

# 20. DEFINITION OF DONE

D10 можно считать implementation-complete только если:

```text
[ ] canonical attribution rule implemented or explicitly blocked by proven missing source
[ ] Orders and Bookings use consistent historical seller attribution
[ ] Marketplace scope preserved
[ ] D8 temporal semantics preserved
[ ] Finance boundary preserved
[ ] RBAC preserved
[ ] existing API works
[ ] frontend works
[ ] export works
[ ] attribution tests PASS
[ ] regression tests PASS
[ ] documentation updated
[ ] qualification report created
[ ] git working tree clean
[ ] changes committed
[ ] HEAD == origin/master
```

### Critical gate

Если historical seller attribution для Booking **невозможно доказать из repository**, не имитировать решение.

В этом случае:

```text
D10 = ARCHITECTURE DECISION REQUIRED
```

и завершить implementation без искусственного fallback.

---

# 21. FINAL VERDICT

Допустимые verdict:

### A — D10 CLOSED

Только если все mandatory gates PASS.

### B — VALID SYSTEM FAIL

Если implementation корректна по системе, но один или несколько обязательных acceptance gates объективно не проходят.

### C — ARCHITECTURE DECISION REQUIRED

Если repository не предоставляет необходимый authoritative attribution source и его нельзя безопасно вывести без новой архитектурной decision.

---

# 22. STOP CONDITION

После qualification report:

**STOP.**

Не начинать D11.

Не начинать Finance.

Не менять TRUE NEXT.

Не выполнять следующий stage автоматически.

Финальный вывод должен содержать:

```text
D10 VERDICT:
CURRENT TRUE NEXT:
FINANCE:
CHANGES:
TESTS:
REMAINING GAPS:
NEXT AUTHORIZED ACTION:
```
