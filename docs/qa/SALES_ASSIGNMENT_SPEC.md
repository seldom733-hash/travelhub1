# Автоматическое распределение заявок — согласованная спецификация

Дата: 2026-11-03. Статус: аудит завершён, решения владельца зафиксированы, production-миграция ещё не применялась.

## Решения владельца

1. Менеджеры распределения — пользователи с ролью `SALES_MANAGER`.
2. «Ожидание клиента» — статус `CUSTOMER_ACCEPTED` и `CUSTOMER_PAYMENT_TIMEOUT`.
3. SLA первого контакта — 30 минут с момента назначения.
4. Максимальная нагрузка — индивидуальная, в профиле менеджера.
5. При отсутствии доступных менеджеров уведомляются ADMIN и DIRECTOR.
6. Автоматический retry очереди не делаем — только ручное назначение руководителем.
7. Менеджер может взять заявку себе вручную.

## Существующая архитектура (аудит)

- `Request` не имеет ответственного менеджера, назначения и SLA-полей.
- Отдельной модели `Employee` нет; сотрудник — `security.User` + `Role`.
- Модели уведомлений нет.
- Уведомление финансиста — это `GET /finance/payments/pending-count` + polling в `Shell.tsx` каждые 30 секунд + `animate-pulse`. Получателя, read-state и записи уведомления нет.
- История заявки — `RequestHistory`; её расширяем действиями назначения, отдельную историю не создаём.
- Создание заявок централизовано в `RequestService.createRequest`.

## Целевые модели

### Request

```prisma
assignedManagerId   String?
assignedAt          DateTime?
assignmentType      String?   // AUTO | MANUAL | SELF
assignmentState     String    @default("UNASSIGNED") // ASSIGNED | UNASSIGNED | QUEUED
firstOpenedAt       DateTime?
processingStartedAt DateTime?
firstContactAt      DateTime?
slaDueAt            DateTime?
assignmentVersion   Int       @default(1)
```

Индексы: `(assignedManagerId, status)`, `(assignmentState, createdAt)`, `(slaDueAt, status)`.

### SalesManagerProfile

```prisma
userId                         String @unique
participatesInAutoDistribution Boolean @default(true)
availability                   String  @default("AVAILABLE") // AVAILABLE | TEMP_UNAVAILABLE | INACTIVE
maxActiveRequests              Int?
allowedRequestTypes            Json?
lastAssignedAt                 DateTime?
```

### UserNotification

```prisma
recipientId String
type        String   // REQUEST_ASSIGNED | REQUEST_REASSIGNED | PAYMENT_CONFIRMATION
entityType  String
entityId    String
title       String
body        String?
payload     Json?
dedupeKey   String @unique
readAt      DateTime?
createdAt   DateTime @default(now())
```

## Нагрузка

```text
activeLoad = NEW + IN_PROCESSING + WAITING_CUSTOMER + WAITING_SUPPLIER + WAITING_PAYMENT
```

Завершённые и отменённые не входят. Просроченные — флаг, не отдельная строка нагрузки.

## Алгоритм

1. Только ACTIVE `SALES_MANAGER` с `participatesInAutoDistribution=true`, `availability=AVAILABLE`.
2. Исключить `load >= maxActiveRequests`.
3. Минимальная нагрузка.
4. Round Robin: `lastAssignedAt ASC NULLS FIRST`, затем стабильный `userId`.
5. Транзакция + `SELECT ... FOR UPDATE` по Request.
6. Записать назначение, `lastAssignedAt`, `RequestHistory`, `UserNotification`.
7. Если назначить некого — `assignmentState=QUEUED`, уведомление ADMIN и DIRECTOR.

## Ручное переназначение

Доступно `request.assignment.reassign`; менеджер может взять себе через `request.assignment.self_assign`.
Сохраняются предыдущий/новый менеджер, актор, причина, время. Финансовые данные и состав сделки не меняются.

## Уведомления

Единый слой для платежей и заявок:

```text
GET  /notifications?unread=true
GET  /notifications/unread-count
POST /notifications/:id/read
POST /notifications/read-all
```

Ответ счётчика:

```json
{ "total": 4, "requests": 3, "payments": 1 }
```

`Shell` опрашивает один endpoint; «Заявки» и «Платежи» мигают по своим counts.

## RBAC

```text
request.assignment.read
request.assignment.manage
request.assignment.reassign
request.assignment.self_assign
request.assignment.settings
request.load.read
request.load.read.department
request.stats.read
```

## Этапы

1. Миграции моделей (не применять в production без отдельного подтверждения).
2. AssignmentService + тесты алгоритма.
3. Хук в `RequestService.createRequest`.
4. Notification API + перевод платежного бейджа на общий слой.
5. Панель загрузки, очередь, модалка переназначения.
6. Ручные сценарии 1–38 и отчёт.

## Ограничения

- Не создавать вторую систему заявок.
- Не дублировать Employee.
- Не менять финансовые данные.
- Production-миграция — только после отдельного подтверждения.
