# TravelHub --- Implementation Prompt Phase 1 — Baseline 1.5.1 FINAL SYNC

> **Источник истины:** `TravelHub_Architecture_Master_Baseline_1.5_Marketplace_Catalog_Final.docx`.
> При любом расхождении приоритет имеет Master. Изменение domain ownership, lifecycle, ID policy,
> event contract или RBAC допускается только через ADR с последующей синхронизацией всех файлов комплекта.


## Роль исполнителя

Ты --- senior full-stack / solution architect. Реализуй Phase 1
TravelHub без изменения утвержденной архитектуры. Не упрощай границы
доменов ради скорости.

## 0. Перед началом

1.  Изучи существующий репозиторий.
2.  Не удаляй работающую логику без необходимости.
3.  Сохраняй текущий стек проекта.
4.  Любое изменение схемы БД делай миграцией.
5.  В конце предоставь список измененных файлов, миграций, API и тестов.

## 1. Цель Phase 1

Создать технический фундамент и минимально рабочую операционную цепочку:

``` text
Catalog
  → CRM mini
  → Order
  → Booking
```

Это **bootstrap**, потому что полноценный Sales Center реализуется в
Phase 2.

Прямое создание Order в Phase 1 --- временный служебный сценарий, а не
финальная архитектура.

После Phase 2 основной flow:

``` text
Lead → Opportunity → Quote → Sale → OrderRequested → Order → BookingRequested → Booking
```

## 2. Общая платформа

Реализуй:

-   единый auth middleware;
-   request/correlation ID;
-   centralized error handling;
-   validation;
-   audit infrastructure;
-   event bus abstraction;
-   transactional outbox;
-   idempotent consumer storage/inbox;
-   pagination/filter/sort contract;
-   shared API response conventions;
-   optimistic locking/version fields;
-   createdAt/updatedAt/createdBy/updatedBy.

## 3. Catalog Center

### Владеет

-   Product;
-   Tariff;
-   Availability.

ID Product:

``` text
PRD-00000001
```


### Категории и category schema — обязательный foundation

Phase 1 должен заложить Catalog так, чтобы Phase 3 Marketplace не потребовал переделки модели Product.

Используется единый `Catalog.Product` для всех туристических услуг. Нельзя создавать отдельные bounded contexts или несвязанные product entities для Hotel/Tour/Transfer/Excursion/Car Rental и других категорий.

Канонические верхнеуровневые категории берутся из Master. Category model/schema должна позволять хранить и валидировать:

- обязательные и необязательные category-specific attributes;
- category-specific search/filter fields;
- правила availability;
- допустимые Tariff/Option;
- требования к медиа;
- набор секций Product Detail Page.

Примеры:

``` text
Размещение → check-in/check-out, room type, meal, amenities
Трансфер    → from/to, vehicle type, capacity
Экскурсия  → date/time, duration, meeting point, language
Тур        → itinerary, days/nights, included/excluded
Аренда авто→ pickup/dropoff, class, transmission, deposit, restrictions
```

Расширение списка категорий не должно требовать создания нового domain.

### Product media foundation

Медиа принадлежит Catalog и является частью Product workflow. Это не отдельный domain.

Реализация должна иметь Catalog-owned media record/asset (внутренне допустимо назвать entity `ProductMedia`, если это соответствует стилю проекта), как минимум с:

``` text
mediaId
productId
type
storageKey / public URL abstraction
originalFileName
mimeType
size
width
height
sortOrder
isPrimary
caption
altText
moderation/publication state
createdBy
createdAt / updatedAt
```

Обязательные возможности:

- multi-upload;
- назначение primary image;
- изменение порядка;
- caption/alt text;
- preview;
- replace/delete;
- server-side MIME/signature validation;
- безопасный storage key;
- JPEG/PNG/WebP как базовые web-safe форматы;
- thumbnails/derivatives;
- image optimization;
- удаление ненужных metadata;
- storage abstraction — не хардкодить локальный filesystem в domain API.

PARTNER может управлять медиа только собственных Product. Неопубликованная замена изображения не должна появляться в Public Marketplace до разрешенного publish transition.

Публикация Product должна валидировать media requirements category schema. Если policy требует изображение, нельзя опубликовать Product без допустимого primary image.

Минимальный API должен предусмотреть эквивалентные операции, адаптированные к существующему routing style:

``` text
POST   /catalog/products/:id/media
PATCH  /catalog/products/:id/media/:mediaId
DELETE /catalog/products/:id/media/:mediaId
POST   /catalog/products/:id/media/:mediaId/set-primary
POST   /catalog/products/:id/media/reorder
```

Не делай публичным internal storage path.


### Product lifecycle

Использовать lifecycle мастер-документа Catalog. Публикация должна быть
контролируемой; публичная витрина читает только опубликованные продукты.

### API

Минимально:

``` text
POST   /catalog/products
GET    /catalog/products
GET    /catalog/products/:id
PATCH  /catalog/products/:id
POST   /catalog/products/:id/publish
POST   /catalog/products/:id/archive
```

Реализовать server-side filters, pagination, sorting.

Catalog не создает Order/Booking.

## 4. CRM mini

Phase 1 реализует минимально необходимые:

-   Customer;
-   Contact;
-   Company;
-   Partner;
-   Supplier.

IDs:

``` text
CUS-*
CNT-*
COM-*
PAR-*
SUP-*
```

`COM-*` только Company.

Communication не должна использовать COM. Если нужен внутренний ID
журнала --- `CML-*`.

CRM является SSOT клиентских и контрагентских мастер-данных.

## 5. Order Center

### Владеет

-   Order;
-   OrderItem;
-   OrderTraveler;
-   Fulfillment.

### IDs

``` text
Order.id     ORD-00000001
Order.number TH-2026-000154
```

Оба значения сохраняются. `id` --- внутренний business ID, `number` --- пользовательский номер.

`TH-YYYY-######`: `YYYY` берется из `Order.createdAt` в UTC; `######` выделяется атомарно внутри года. `Order.number` имеет UNIQUE constraint. Idempotency `OrderRequested` проверяется до выделения нового Order/number.

### Bootstrap creation

До Phase 2 разреши служебное создание Order через отдельный
endpoint/permission, например:

``` text
POST /orders/bootstrap
```

Не называй его основным checkout endpoint.

Зафиксируй в коде/документации, что после Phase 2 Order создается consumer-ом `OrderRequested`.
После успешного ввода Phase 2 `/orders/bootstrap` ОБЯЗАТЕЛЬНО удаляется. Не оставляй его как ADMIN/import exception.
Если позднее будет утвержден import/admin-create use case, он получает отдельную command/API и отдельный permission/audit contract.

### OrderTraveler

Order должен хранить участников заказа до Booking.

Минимальные поля:

-   id;
-   orderId;
-   customerId nullable;
-   firstName;
-   lastName;
-   birthDate;
-   citizenship;
-   gender;
-   passport fields where applicable;
-   dataCompleteness;
-   version.

### Lifecycle

Реализуй:

``` text
Новый
→ В обработке
→ Ожидает данных
→ Готов к бронированию
→ Передан в Booking Center
→ Частично исполнен
→ Исполнен
→ Готов к закрытию
→ Закрыт
```

Дополнительно:

``` text
Отменен
Проблемный
Приостановлен
```

Backend-коды Order строго канонические:

``` text
NEW, IN_PROCESSING, WAITING_FOR_DATA, READY_FOR_BOOKING, SENT_TO_BOOKING,
PARTIALLY_FULFILLED, FULFILLED, READY_TO_CLOSE, CLOSED, CANCELLED, PROBLEM, SUSPENDED
```

UI использует локализованные labels и не хранит их как enum.

Не реализовывай статус как свободно редактируемый enum-field.

Сделай command/actions:

-   accept;
-   mark-waiting-data;
-   resume-processing;
-   validate-for-booking;
-   request-booking;
-   suspend;
-   cancel;
-   mark-ready-to-close;
-   close.

Каждый action:

-   проверяет permission;
-   проверяет preconditions;
-   пишет audit;
-   изменяет version;
-   публикует event при необходимости.

### Передача в Booking

Только из состояния `Готов к бронированию`.

Действие:

``` text
Передать в Booking Center
```

публикует:

``` text
BookingRequested
```

Payload должен содержать только необходимые snapshot/reference данные и
IDs.

## 6. Booking Center

### Владеет

-   Booking;
-   Reservation;
-   Passenger;
-   SupplierConfirmation.

ID:

``` text
BKG-00000001
```

### Создание

Booking создается consumer-ом:

``` text
BookingRequested
```

Не `OrderApproved`.

Consumer идемпотентный: повторное событие не создает второй Booking.

### Passenger

Passenger создается для конкретного Booking на основании подтвержденных
OrderTraveler data.

Passenger не заменяет OrderTraveler.

### Lifecycle

Реализуй:

``` text
Новый
→ Подготовка запроса
→ Отправлен поставщику
→ Ожидает подтверждения
→ Подтвержден
→ Исполняется
→ Завершен
```

Дополнительные:

-   Требует уточнения;
-   Отклонен поставщиком;
-   Изменение запрошено;
-   Отмена запрошена;
-   Отменен;
-   Проблемный.

Backend-коды Booking строго канонические:

``` text
NEW, PREPARING_REQUEST, SENT_TO_SUPPLIER, AWAITING_CONFIRMATION, CONFIRMED,
IN_SERVICE, COMPLETED, NEEDS_CLARIFICATION, SUPPLIER_REJECTED,
CHANGE_REQUESTED, CANCELLATION_REQUESTED, CANCELLED, PROBLEM
```

### Events

Минимум:

``` text
BookingCreated
BookingConfirmed
BookingRejected
BookingChanged
BookingCancelled
```

Order подписывается на эти события и обновляет **свое агрегированное
состояние**, но Booking не пишет в Order DB.

## 7. Phase 1 UI

Сделай внутренние рабочие центры:

-   Catalog Center;
-   Order Center;
-   Booking Center;
-   CRM mini.

Структура:

``` text
Header
Filters / Actions
KPI
Work queues
Main workspace
Context side panel
AI placeholder/assistant area
```

Order Center должен иметь:

-   KPI;
-   рабочие очереди;
-   таблицу заказов;
-   карточку Order;
-   OrderTraveler;
-   linked Bookings;
-   timeline/status history;
-   blockers;
-   next action.

Booking Center:

-   KPI;
-   очереди;
-   таблица Booking;
-   supplier status;
-   SLA;
-   карточка Booking;
-   linked Order read-only.

## 8. Marketplace foundation

Не нужно реализовывать весь marketplace в Phase 1, но Catalog/Auth/media foundation уже обязаны поддерживать будущий Public Marketplace без миграции базовой Product-модели.

Минимальные invariants:

- anonymous read только опубликованной версии Product и разрешенного media;
- PARTNER ownership/object scope для собственных draft Product и их media;
- MODERATOR review/approve/reject без права редактировать поля Product от имени PARTNER;
- существенное изменение уже опубликованного Product/media создает новую непубличную версию/изменение и не появляется на витрине до повторного разрешенного publish transition;
- BUYER scope может быть добавлен позже без изменения Catalog ownership;
- public routes отделены от internal admin permissions;
- Product Detail Page использует category schema, Tariff, Availability и опубликованную media gallery.

Не смешивай public routes с internal admin permissions.

## 9. Тесты

Обязательные integration/e2e:

1.  Product создается и публикуется.
2.  Customer создается.
3.  Bootstrap Order создается с ORD-\* и TH-\*.
4.  OrderTraveler сохраняется.
5.  Order без обязательных данных не может стать `Готов к бронированию`.
6.  `request-booking` публикует BookingRequested.
7.  Booking consumer создает один BKG-\*.
8.  Повтор BookingRequested не создает дубликат.
9.  BookingConfirmed обновляет агрегированное состояние Order.
10. Backend Order/Booking сохраняет status code, а UI label локализуется отдельно.
11. `OrderReadyForBooking` публикуется при переходе в READY_FOR_BOOKING.
12. `OrderFulfilled` публикуется при FULFILLED; `OrderClosed` — при CLOSED.
13. SALES_MANAGER не получает order write по умолчанию.
14. Audit записывает статусные переходы.
15. Product одной category использует общий Product model + category schema, без отдельного bounded context.
16. PARTNER не может изменить чужой Product или media.
17. PARTNER может загрузить несколько изображений своего draft Product, назначить primary и изменить порядок.
18. Публикация блокируется, если category policy требует primary image, а его нет.
19. Неопубликованная замена media у опубликованного Product не появляется в anonymous/public read до разрешенного publish transition.
20. MODERATOR может approve/reject/request changes, но не редактирует содержимое Product от имени PARTNER.

## 10. Definition of Done

Phase 1 завершена, когда реально работает:

``` text
Product
→ Customer
→ bootstrap Order
→ OrderTraveler validation
→ Ready for Booking
→ BookingRequested
→ Booking
→ BookingConfirmed
→ Order aggregate updated
```

и архитектура не блокирует замену bootstrap creation на `OrderRequested`
в Phase 2.
