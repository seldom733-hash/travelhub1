# TravelHub — Command Center V2
## Единый промпт для AI-разработчика

### Цель
Модернизировать только **Dashboard → Command Center** и создать воспроизводимый demo/test dataset, из которого Command Center будет рассчитывать KPI, отчёты, alerts и AI insights.

> Command Center должен выглядеть как операционный центр реально работающей туристической платформы, а не как набор hardcoded KPI.

---

## 1. Strict Scope

Изменять разрешено только:
- Dashboard → Command Center
- необходимый seed/demo-data механизм

Не перерабатывать:
- Analytics
- Sales
- Booking Center
- Orders
- Catalog
- CRM
- Users
- Partners
- Finance
- Marketing
- Support
- Reports
- Calendar
- Documents
- System
- Integrations
- AI Center
- Settings

Эти разделы можно использовать как Drill Down destinations, но их собственную функциональность не менять.

---

## 2. Архитектура

Перед изменениями изучить:
- текущий Command Center;
- routes;
- database models;
- enums/statuses;
- existing queries/aggregations;
- RBAC;
- seed/demo mechanism;
- reusable UI components.

Не создавать новую архитектуру без необходимости. Не менять Sidebar, routes, RBAC, API contracts или database schema без крайней необходимости.

---

## 3. Command Center

Структура:

```text
COMMAND CENTER
Global Filters / Data Freshness
Business Health
Needs Attention
AI Decision Feed
Revenue & Sales Pulse
Booking & Order Operations
Platform Health
Live Activity
```

### Global Filters
- Today
- Yesterday
- 7 Days
- 30 Days
- YTD
- Custom Range
- Category
- Region
- Partner
- Sales Channel
- Currency

Использовать существующую filter architecture.

### Data Freshness
Показывать Live / Updated X min ago / Data delayed / Data unavailable.

---

## 4. Business Health

Основные KPI:
1. Revenue
2. Gross Profit
3. Bookings
4. Conversion
5. Average Order Value
6. Active Customers

Каждая карточка по возможности содержит:
- Main Value
- Change %
- Comparison Period
- Target
- Target Achievement
- Mini Trend
- Secondary information
- Status
- Drill Down

Не перегружать карточки.

Пример Revenue:

```text
REVENUE
₼48,250
▲ 14.8%
vs previous period
Target ₼45,000
107.2%
[mini trend]
Tours +21%
View details →
```

Bookings должны показывать Confirmed/Pending и link в существующий Booking Center.

Conversion — trend/target, без создания отдельной Analytics page.

AOV — value/change/top category.

Active Customers — new/returning и link в существующий CRM.

---

## 5. Needs Attention

Это не обычные notifications, а action-oriented exceptions.

Каждый item по возможности содержит:
- Severity
- Problem
- Impact
- Deadline
- Financial impact
- Recommendation
- Action
- Drill Down

Типы:
- Critical: booking/payment failure, supplier outage, SLA breach
- Warning: pending confirmation, delayed payment, refund delay, partner issue
- Opportunity: demand spike, high-conversion product, growing region, high-value segment

Показывать 5–7 наиболее важных элементов.

Пример:

```text
🔴 BOOKINGS AT RISK
12 bookings have not been confirmed.
Supplier: Caspian Tours
Normal: 18 min
Current: 47 min
Potential value: ₼4,860
[Review] [Reassign]
```

Needs Attention должен формироваться из database data, не hardcoded.

---

## 6. AI Decision Feed

Не AI chat. Это feed управленческих рекомендаций.

Структура:

```text
TYPE
Problem
Evidence
Impact
Recommendation
Action
```

Сценарии:
- operational risk;
- opportunity;
- anomaly;
- customer opportunity;
- SLA risk;
- financial anomaly.

Не выполнять опасные действия автоматически: массовые изменения цен, bookings, refunds, commissions и финансовые операции.

Если безопасный backend action уже существует — использовать его. Иначе View/Review/Details.

---

## 7. Revenue & Sales Pulse

Показывать график:
- Today
- 7D
- 30D
- YTD

Summary:
- Gross Revenue
- Net Revenue
- Commission
- Refunds
- Profit

Category summary:
Tours, Hotels, Tickets, Excursions, Transfers и другие существующие категории.

Не создавать отдельную Analytics page.

---

## 8. Booking & Order Operations

Показывать:
- New Orders
- Pending Confirmation
- Confirmed
- Payment Pending
- Cancellation Requests
- Refund Processing
- SLA Breaches

Link → существующий Booking Center.

---

## 9. Platform Health

Summary:
- Supplier APIs
- GDS
- Payments
- Email
- SMS
- AI
- Processing Queue

Показывать status, availability, response time и error rate, если такие данные доступны.

Не превращать Command Center в полноценный monitoring system.

---

## 10. Live Activity

Показывать последние реальные события:
- booking confirmed;
- payment received;
- new order;
- refund requested;
- partner service added;
- cancellation requested;
- support request created.

Не превращать в Audit Log.

---

# 11. Demo/Test Dataset

Создать реалистичную взаимосвязанную базу тестовых данных.

Главная цепочка:

```text
Customer
↓
Order
↓
Booking
↓
Payment
↓
Service
↓
Partner
↓
Commission
↓
Fulfillment
↓
Refund / Cancellation
↓
Support / SLA
↓
Events
↓
Command Center
↓
Insights
```

Не создавать просто случайные записи или hardcoded KPI.

Ориентировочно:
- Customers: 100–300
- Partners: 20–40
- Services: 100–250
- Orders: 500–1,500
- Bookings: 500–1,500
- Support Requests: 50–150
- Tasks: 100+
- AI scenarios/insights: 10–30

Адаптировать под существующие модели.

---

# 12. Период данных

Период создания business events:

**01.01.2026 — 31.12.2026**

Данные должны быть распределены по всем месяцам и кварталам, не одной датой.

Использовать реалистичную сезонность:
- Q1 — ниже;
- Q2 — рост;
- Q3 — высокий сезон;
- Q4 — смешанная динамика.

Должны существовать historical trends и данные для period comparison.

---

# 13. Важнейшее правило дат

**Дата создания заказа и дата оказания услуги — разные даты.**

Использовать существующие поля проекта, например:
- createdAt
- booking date
- serviceStartDate
- serviceEndDate
- completedAt
- cancelledAt
- refundedAt
- resolvedAt

Не добавлять новые поля, если соответствующие уже существуют.

---

# 14. Future / Upcoming Bookings

Обязательно создать заказы, созданные в 2026 году, но относящиеся к будущим датам оказания услуги.

Например:

```text
Created:
20.12.2026

Hotel:
28.12.2026 — 03.01.2027

Payment:
Paid

Booking:
Confirmed

Order:
Upcoming / Open
```

Такой заказ не является Completed.

Создать:
- near-term bookings: 1–7 дней;
- short-term: 8–30 дней;
- medium-term: 1–3 месяца;
- long-term: 3+ месяцев.

---

# 15. Последний созданный заказ

Последний созданный order должен иметь:

```text
createdAt = 31.12.2026
```

Но его service date может быть позже.

Например:

```text
Created:
31.12.2026

Hotel:
05.01.2027 — 10.01.2027

Payment:
Paid

Booking:
Confirmed

Order:
Open / Upcoming
```

Это нормальный рабочий заказ.

Также создать другие незакрытые сценарии:
- fully confirmed upcoming;
- pending confirmation;
- partially confirmed;
- payment pending;
- cancellation requested;
- refund processing;
- support issue open;
- high-value booking requiring attention.

---

# 16. Cross-year bookings

Создать несколько бронирований, пересекающих границу 2026/2027:

```text
Created:
20.12.2026
Service:
29.12.2026 — 04.01.2027
```

и:

```text
Created:
31.12.2026
Service:
05.01.2027 — 10.01.2027
```

Дата создания должна быть в 2026, service date может быть в 2027.

---

# 17. Completed vs Upcoming

Command Center должен различать существующие статусы:
- Completed
- Upcoming
- In Progress
- Pending
- Partially Confirmed / Completed
- Cancelled

Не создавать новые enums только ради demo data.

Не определять завершённость только по createdAt/updatedAt. Использовать существующую бизнес-логику и даты услуги.

---

# 18. Historical Orders

Создать много полностью завершённых заказов по всему году.

Цепочка:

```text
Customer
↓
Order
↓
Booking
↓
Payment
↓
Service
↓
Fulfillment
↓
Completion
```

---

# 19. Partially Completed Orders

Создать multi-service orders, где часть услуг подтверждена/завершена, а часть pending.

Пример:

```text
Order Total: ₼1,250
Hotel: Confirmed
Transfer: Confirmed
Excursion: Pending
Order: Partially Confirmed
```

---

# 20. Multi-Service Orders

Создать заказы из комбинаций:
- Hotel + Transfer + Excursion
- Tour + Transfer
- Hotel + Excursion
- другие логичные комбинации

Они должны позволять проверять AOV, service mix, cross-sell и revenue.

---

# 21. Payments

Создать:
- Fully paid
- Partially paid
- Payment pending
- Payment failed
- Refunded
- Partially refunded

Пример:

```text
Order: ₼1,500
Paid: ₼750
Outstanding: ₼750
```

---

# 22. Refunds

Создать full и partial refunds.

Пример partial:

```text
Order: ₼1,200
Refund: ₼300
Remaining: ₼900
```

Refund должен быть связан с существующими Order/Booking/Payment моделями.

---

# 23. Cancellations

Создать:
- Customer cancellation
- Partner cancellation
- Supplier cancellation
- Payment/system cancellation

Каждая должна иметь order, booking, reason, timestamp и financial impact, если модель это поддерживает.

---

# 24. Support

Создать клиентские и партнёрские обращения.

Использовать существующие статусы:
- New
- Open
- In Progress
- Waiting for Customer
- Waiting for Partner
- Resolved
- Closed

Приоритеты:
- Critical
- High
- Medium
- Low

Создать обращения:
- within SLA;
- approaching SLA;
- SLA breached.

SLA breaches должны попадать в Needs Attention.

---

# 25. Partners

Создать разные типы:
- Tour Operator
- Hotel
- Airline / Ticket Provider
- Excursion Provider
- Guide
- Photographer / Videographer
- Transfer Provider

Сценарии:
- High-performing partner
- Normal partner
- Declining partner
- Risk partner
- New partner

Связать с services, sales, bookings, commissions, cancellations и operational issues.

---

# 26. Services

Создать услуги:
- Tours
- Hotels
- Sanatoriums
- Tickets
- Excursions
- Guides
- Photographers / Videographers
- Transfers

Различать:
- price;
- availability;
- category;
- region;
- partner;
- rating;
- sales volume.

---

# 27. Customer Scenarios

Создать:
- New customer
- Returning customer
- High-value customer
- Customer with cancellations
- Customer with support history
- Customer with refund history

---

# 28. Business Scenarios

Обязательно создать:

1. Successful completed order
2. Partially completed order
3. New pending order
4. Failed payment
5. Delayed supplier confirmation
6. Customer cancellation
7. Full refund
8. Partial refund
9. Support SLA breach
10. Partner performance decline
11. Demand spike
12. Revenue anomaly
13. Multi-service order
14. High-value customer
15. Supplier outage

Если seed architecture позволяет — сохранять scenario identifiers.

---

# 29. Financial Consistency

Финансовые записи должны быть математически согласованы.

Например:

```text
Order Total: ₼1,000
Discount: ₼100
Customer Paid: ₼900
Platform Commission: ₼90
Partner Amount: ₼810
```

Не допускать невозможных значений вроде refund > paid amount, если это не разрешено текущей бизнес-логикой.

Commission использовать только через существующую architecture.

---

# 30. Trends

Seed должен позволять строить временные ряды:
- Revenue
- Orders
- Bookings
- AOV
- Customers
- Cancellations
- Refunds
- Partner performance
- Category demand

Графики Command Center должны строиться из агрегированных database records, а не вручную.

---

# 31. Period Comparison

Данные должны позволять сравнивать:
- Today vs previous day
- 7D vs previous 7D
- 30D vs previous 30D
- current month vs previous month
- current quarter vs previous quarter
- YTD vs previous YTD

---

# 32. Upcoming Business

Command Center должен различать:

### Historical / Completed Business
и
### Future / Committed Business

Например:

```text
Completed Revenue
₼128,420

Upcoming Booking Value
₼48,620

Pending Confirmation
12
```

Upcoming Booking Value не должен автоматически считаться реализованной выручкой.

---

# 33. Reproducible Seed

Seed должен быть воспроизводимым.

Повторный запуск не должен бесконтрольно дублировать записи.

Использовать существующий seed mechanism и при необходимости:
- deterministic IDs;
- upsert;
- cleanup/reset.

Не смешивать demo data с production data.

---

# 34. Validation

После seed проверить:

- данные есть во всех месяцах;
- данные есть во всех кварталах;
- есть completed orders;
- есть new/open orders;
- есть upcoming bookings;
- есть bookings на 2027;
- есть cross-year bookings;
- есть pending confirmations;
- есть partial confirmations;
- есть payment pending;
- есть cancellations;
- есть refunds;
- есть support SLA breaches;
- последний createdAt может быть 31.12.2026;
- последний заказ может оставаться open;
- financial data согласованы;
- relationships валидны.

---

# 35. Command Center Validation

После seed открыть Command Center.

Проверить, что:

- Revenue считается из database;
- Gross Profit считается из financial data;
- Bookings соответствуют records;
- AOV соответствует business logic;
- Refunds соответствуют records;
- Cancellations соответствуют records;
- Pending соответствует статусам;
- Upcoming соответствует будущим service dates;
- Needs Attention формируется из реальных проблем;
- Live Activity получает реальные events;
- trends строятся из истории.

Никаких hardcoded KPI.

---

# 36. Performance

Не создавать N+1 queries.

Переиспользовать existing aggregation/query mechanisms.

Не делать отдельный backend request для каждой маленькой цифры, если данные можно агрегировать.

Realtime использовать только для:
- booking status;
- payment status;
- critical alerts;
- platform health;
- live activity.

Не обновлять весь Dashboard каждую секунду.

---

# 37. Data States

Каждый widget должен иметь:
- Loading / Skeleton
- Loaded
- Empty
- Error + Retry
- Delayed

---

# 38. Implementation Order

1. Audit текущего Command Center.
2. Audit database/seed architecture.
3. Создать demo dataset.
4. Проверить relationships/statuses/dates/financial consistency.
5. Модернизировать Business Health.
6. Реализовать Needs Attention.
7. Реализовать AI Decision Feed.
8. Реализовать Revenue & Sales Pulse.
9. Реализовать Booking & Order Operations.
10. Реализовать Platform Health.
11. Реализовать Live Activity.
12. Проверить filters, responsive, loading/error/empty states.
13. Проверить performance.
14. Финально проверить, что другие разделы не изменились.

---

# 39. Запрещено

Не:
- менять Sidebar;
- перерабатывать другие страницы;
- создавать новый Dashboard;
- создавать новый Booking Center/CRM/Analytics/Finance/System;
- менять database schema без необходимости;
- hardcode KPI;
- hardcode trends;
- hardcode Needs Attention;
- смешивать demo и production;
- выполнять опасные AI actions автоматически;
- создавать N+1 architecture.

---

# 40. Final Principle

Создать:

> **Synthetic TravelHub Business Environment**

который имитирует реально работающую платформу.

Главная цепочка:

```text
CUSTOMER
↓
ORDER
↓
BOOKING
↓
PAYMENT
↓
SERVICE
↓
PARTNER
↓
COMMISSION
↓
FULFILLMENT
↓
REFUND / CANCELLATION
↓
SUPPORT / SLA
↓
EVENTS
↓
COMMAND CENTER
↓
INSIGHTS
↓
ACTION
```

Критически важно:

**createdAt и service date — независимые понятия.**

Например:

```text
Order created:
31.12.2026

Service:
05.01.2027 — 10.01.2027

Payment:
Paid

Booking:
Confirmed

Order:
Upcoming / Open
```

Это нормальный незавершённый рабочий заказ.

Итоговая цель:

> Пользователь открывает Command Center и видит не набор нарисованных цифр, а управленческую картину TravelHub, сформированную из взаимосвязанных database records за весь 2026 год и из будущих бронирований, ожидающих оказания услуг.
