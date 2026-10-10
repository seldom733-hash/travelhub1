# TRAVELHUB — Booking→Order / Order→Request ACTIONS FIX

## PURPOSE

Исправить два связанных бага после успешного `Booking → Order`.

Текущий сценарий:

```text
R1 → O1 → B1 → O1
```

### BUG 1

После успешного `Booking → Order` Booking уже возвращён, но UI продолжает
показывать кнопку **«Вернуть в заказ»**.

Повторный вызов backend правильно отвечает:

```text
Booking BKG-00000101 is already returned;
order ORD-00000201 stays READY_FOR_BOOKING
```

### BUG 2

Тот же Order после успешного `Booking → Order` при нажатии **«Вернуть в заявку»**
получает:

```text
Order ORD-00000201 has 1 booking(s);
return to Request requires Booking→Order design pass
```

Причина, которую необходимо проверить: guard учитывает наличие Booking, но не
отличает активный Booking от уже возвращённого в Order.

---

# 1. OWNER-APPROVED LIFECYCLE

Не менять модель:

```text
Request ⇄ Order ⇄ Booking
```

Целевой round-trip:

```text
R1 → O1 → B1 → O1 → R1
```

Правила:

1. Исторические Request / Order / Booking не удаляются.
2. `Booking → Order` возвращает именно в существующий Order.
3. `Order → Request` возвращает именно в существующий Request.
4. После `Booking → Order` Booking остаётся исторической записью.
5. Возвращённый Booking не должен блокировать `Order → Request`.
6. Наличие исторического Booking само по себе не блокирует `Order → Request`.

---

# 2. BUG 1 — BOOKING AVAILABLE ACTIONS

Найти существующий backend source of truth для `Booking.availableActions`
или эквивалентного action projection.

После успешного:

```text
Booking.returnToOrder()
```

должно быть:

```text
canReturnToOrder = false
```

или соответствующее действие должно отсутствовать в `availableActions`.

Frontend должен показывать кнопку только на основании backend authoritative
`availableActions`.

Не создавать frontend-only правило вроде:

```text
status !== CANCELLED
```

если оно не соответствует domain semantics.

Backend guard повторного `returnToOrder` должен остаться.

---

# 3. BUG 2 — ORDER → REQUEST

Найти текущий guard, который выдаёт:

```text
Order ... has 1 booking(s);
return to Request requires Booking→Order design pass
```

Проверка должна учитывать **активные blocking Booking**, а не просто:

```text
bookingCount > 0
```

### Case A — ALLOW

```text
O1
└─ B1 = returned / cancelled
```

Результат:

```text
O1 → R1 = ALLOW
```

### Case B — BLOCK

```text
O1
├─ B1 = returned / cancelled
└─ B2 = ACTIVE
```

Результат:

```text
O1 → R1 = BLOCK
```

### Case C — ALLOW

```text
O1
├─ B1 = returned / cancelled
└─ B2 = returned / cancelled
```

Результат:

```text
O1 → R1 = ALLOW
```

Не удалять Booking и не создавать новый Booking.

---

# 4. НЕ ДЕЛАТЬ СЛЕПОЙ ПРОВЕРКИ `status=CANCELLED`

Сначала исследовать существующий domain state:

- `returnToOrder` command;
- Booking history;
- Booking status transitions;
- Order availableActions;
- Order → Request guard;
- Booking → Order guard;
- existing design-pass implementation;
- existing tests.

Если уже существует признак/история, показывающая факт возврата, использовать
его.

Не добавлять новое Prisma/schema поле без доказательства необходимости.

---

# 5. ОБЩИЙ SOURCE OF TRUTH

Оба бага должны быть исправлены через согласованную domain projection:

```text
Booking lifecycle state
        ↓
returned/active state
        ↓
Order active-booking calculation
        ↓
availableActions
        ↓
Frontend buttons
```

Для Booking:

```text
returnedToOrder
    ↓
canReturnToOrder = false
```

Для Order:

```text
activeBlockingBookings.length === 0
    ↓
Order → Request allowed
```

Не дублировать lifecycle rules во frontend.

---

# 6. ИСТОРИЯ

После:

```text
B1 → O1
```

НЕ делать:

- DELETE Booking;
- detach Booking;
- удаление history;
- создание B2;
- создание O2;
- создание R2.

Должно сохраниться:

```text
R1
↑
O1
↑
B1 (historical / returned)
```

Последующий:

```text
O1 → R1
```

использует тот же `R1`.

---

# 7. FRONTEND

Проверить action projection для Booking:

После успешного `returnToOrder`:

```text
Вернуть в заказ
```

не отображается.

Для Order:

- только returned Booking → **«Вернуть в заявку» доступна**;
- хотя бы один active blocking Booking → **«Вернуть в заявку» недоступна**.

Frontend не должен самостоятельно вычислять эти правила из status/history.

---

# 8. REGRESSION TESTS

Добавить/обновить тесты.

### Test 1 — Booking return disables action

```text
create B1
return B1 → O1
reload Booking
expect returnToOrder action = false
expect UI button absent
```

### Test 2 — repeated Booking return

```text
B1 → O1
B1 → O1 again
expect existing already-returned guard
expect Order remains READY_FOR_BOOKING
```

### Test 3 — returned Booking does not block Order → Request

```text
R1 → O1 → B1 → O1
O1 → R1
expect success
expect same Request R1
```

### Test 4 — active Booking blocks Order → Request

```text
R1 → O1 → B1(active)
O1 → R1
expect blocked
```

### Test 5 — mixed Booking states

```text
O1
├─ B1 returned
└─ B2 active

O1 → R1
expect blocked
```

### Test 6 — all Booking returned

```text
O1
├─ B1 returned
└─ B2 returned

O1 → R1
expect success
```

### Test 7 — full round-trip

```text
R1 → O1 → B1 → O1 → R1
```

Проверить:

- same Request;
- same Order;
- same Booking;
- no duplicates;
- correct statuses;
- correct histories;
- correct availableActions;
- no stale action buttons.

---

# 9. READ-ONLY INVESTIGATION FIRST

Перед изменением кода:

1. `git status`;
2. найти реализацию `Booking → Order`;
3. найти state/field/history, устанавливаемый при возврате;
4. найти Booking `availableActions`;
5. найти Order → Request guard;
6. найти frontend rendering обеих кнопок;
7. проверить существующие lifecycle tests.

Не создавать новый механизм, если существующий domain state уже достаточен.

---

# 10. DIRTY WORKTREE SAFETY

Не делать:

- reset;
- checkout unrelated files;
- revert existing owner work;
- overwrite unrelated hunks.

Изменять только файлы, необходимые для данного lifecycle/action fix.

---

# 11. TEST EXECUTION

Минимально выполнить:

- targeted Booking lifecycle tests;
- Order → Request tests;
- availableActions/projection tests;
- frontend action/button tests;
- backend/frontend typecheck.

Если среда позволяет без перегрузки ноутбука — соответствующий lifecycle E2E.

Не утверждать, что E2E выполнен, если он не запускался.

---

# 12. ACCEPTANCE CRITERIA

### AC-1

После:

```text
B1 → O1
```

кнопка **«Вернуть в заказ»** отсутствует.

### AC-2

Повторный API вызов `returnToOrder` остаётся защищённым.

### AC-3

После:

```text
R1 → O1 → B1 → O1
```

можно выполнить:

```text
O1 → R1
```

если нет других активных blocking Booking.

### AC-4

Исторический returned Booking не удаляется.

### AC-5

При наличии хотя бы одного active Booking:

```text
O1 → R1
```

остаётся заблокированным.

### AC-6

Возврат идёт в тот же Request:

```text
R1 → O1 → B1 → O1 → R1
```

без R2/O2/B2.

### AC-7

Backend и frontend используют согласованный domain state / `availableActions`.

---

# 13. FINAL REPORT

## A. Root cause

Отдельно:

```text
Bug 1 root cause:
...

Bug 2 root cause:
...
```

## B. Changed files

Полный список.

## C. Tests

```text
Targeted suites:
Passed:
Failed:

Backend typecheck:
Frontend typecheck:

E2E:
RUN / NOT RUN
```

## D. Lifecycle verification

Показать:

```text
R1 → O1 → B1 → O1 → R1
```

и:

```text
same Request: YES
same Order: YES
same Booking: YES
duplicate entities: NO
```

## E. Action verification

```text
Returned Booking:
"Вернуть в заказ" = HIDDEN

Order with only returned bookings:
"Вернуть в заявку" = AVAILABLE

Order with active booking:
"Вернуть в заявку" = BLOCKED
```

## F. Safety

Подтвердить:

```text
No pricing changes
No payment changes
No supplier changes
No D3 weakening
No DB repair
No unrelated lifecycle changes
```

## G. Git

Report:

```text
HEAD:
working tree:
staged:
commit: NO
push: NO
```

unless separately authorized.

---

# FINAL TARGET

После исправления:

```text
R1
 │
 ▼
O1
 │
 ▼
B1
 │
 │ returnToOrder
 ▼
O1
 │
 ├── B1 = historical/returned
 │        └── "Вернуть в заказ" = HIDDEN
 │
 │ returnToRequest
 ▼
R1
```

Главное правило:

> Наличие исторического Booking не блокирует Order → Request.
> Блокирует только реально активный Booking.
