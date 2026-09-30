# PROMPT: IMPLEMENTATION — INDEPENDENT TOURS FROM FLIGHTS + HOTELS

## 1. ЦЕЛЬ

Реализовать в TravelHUB механизм автоматического формирования **самостоятельных туров (Independent Tours)** на основе реально доступных:

1. авиабилетов / авиарейсов;
2. отелей.

Самостоятельный тур состоит **ТОЛЬКО из двух компонентов**:

```text
FLIGHT + HOTEL
```

В состав самостоятельного тура **НЕ входят**:

- трансфер;
- страховка;
- экскурсии;
- дополнительные услуги;
- другие туристические услуги.

Система должна самостоятельно анализировать доступные авиабилеты и предложения отелей, определять совместимые направления и даты, а затем формировать из них готовые `IndependentTourOffer`.

---

# 2. ГЛАВНОЕ БИЗНЕС-ПРАВИЛО

Система не должна начинать построение туров от заранее заданного списка направлений.

Она должна работать от **реальной доступности авиабилетов**.

Основной алгоритм:

```text
AVAILABLE FLIGHTS
        ↓
COUNTRIES / CITIES / AIRPORTS / DATES
        ↓
POSSIBLE STAY PERIODS 3–7 DAYS
        ↓
HOTEL SEARCH FOR SAME DESTINATION + DATES
        ↓
HOTEL AVAILABILITY
        ↓
AIRPORT / GATEWAY RESOLUTION
        ↓
FLIGHT + HOTEL COMPATIBILITY
        ↓
PRICE CALCULATION
        ↓
INDEPENDENT TOUR OFFER
        ↓
REVALIDATION
        ↓
BOOKING
```

---

# 3. ОБЯЗАТЕЛЬНО: СНАЧАЛА ИЗУЧИТЬ ТЕКУЩУЮ АРХИТЕКТУРУ

Перед реализацией необходимо полностью изучить существующий TravelHUB.

Не создавать параллельную архитектуру, если необходимые сущности, сервисы или механизмы уже существуют.

Проверить:

- Flight domain;
- Hotel domain;
- Tour domain;
- Search;
- Providers;
- Provider adapters;
- Geography;
- Airports;
- Cities;
- Countries;
- Resorts;
- Currency;
- Pricing;
- Commission;
- Booking;
- Availability;
- Offer;
- Product;
- supplier catalog;
- external providers;
- TravelHUB Catalog;
- existing mappings;
- cache;
- background jobs;
- scheduled tasks;
- database entities;
- API;
- frontend models.

Особенно проверить существующую архитектуру:

```text
Flight
Hotel
Tour
Provider
Adapter
Offer
Product
Search
Booking
Geography
Airport
Currency
Pricing
```

Если в проекте уже существует эквивалент необходимой сущности или сервиса — **использовать его**, а не создавать дубликат.

---

# 4. ИСТОЧНИКИ АВИАБИЛЕТОВ

Система должна использовать существующий механизм поиска авиабилетов TravelHUB.

Не создавать отдельную независимую систему поиска авиабилетов.

Необходимо получить нормализованный список доступных flight offers.

Каждый flight offer должен содержать как минимум:

```text
id
source
offerId
originAirport
destinationAirport
departureDate
departureTime
arrivalDate
arrivalTime
price
currency
availability
```

Если существующая модель содержит больше информации — использовать существующую модель.

---

# 5. ИСТОЧНИКИ ОТЕЛЕЙ

Система должна использовать существующий Hotel Search.

Источниками могут быть:

### EXTERNAL_PROVIDER

Например:

```text
Compass
Summer
Kazunion
Anex
```

Для внешних источников использовать существующие Hotel adapters:

```text
CompassHotelAdapter
SummerHotelAdapter
KazunionHotelAdapter
AnexHotelAdapter
```

Tour adapters не использовать для Hotel Search.

### TRAVELHUB_CATALOG

Если отель находится во внутреннем каталоге TravelHUB:

```text
TravelHUB Hotel Catalog
```

отдельный adapter для каждого зарегистрированного поставщика создавать не нужно.

Использовать существующий механизм каталога.

---

# 6. НОРМАЛИЗАЦИЯ

Независимый тур должен работать не непосредственно с ответами конкретных поставщиков, а с нормализованными объектами TravelHUB.

Например:

```text
NormalizedFlightOffer
NormalizedHotelOffer
```

или с существующими эквивалентами проекта.

Не привязывать `IndependentTourService` напрямую к:

```text
Compass API
Summer API
Kazunion API
Anex API
```

Он должен работать через существующий Search / Provider abstraction.

---

# 7. АНАЛИЗ ДОСТУПНЫХ АВИАБИЛЕТОВ

Система должна сначала получить доступные авиабилеты.

Для каждого результата определить:

```text
origin
destination airport
destination city
destination country
departure date
departure time
arrival date
arrival time
return date
return time
price
currency
source
```

После этого построить множество доступных направлений:

```text
Country
City
Airport
Available dates
```

Пример:

```text
Azerbaijan
    ↓
Baku
    ↓
Dubai
    ↓
DXB
    ↓
Flights:
01.10
02.10
03.10
05.10
...
```

---

# 8. НЕ ОГРАНИЧИВАТЬСЯ ОДНИМ ДНЁМ

После определения доступных дат вылета необходимо определить возможные даты возвращения.

Допустимая продолжительность:

```text
3
4
5
6
7
```

дней.

Проверять только эти варианты.

```text
departureDate
+
3–7 days
=
possible returnDate
```

Но окончательное количество ночей и расчёт duration должны соответствовать **существующим бизнес-правилам TravelHUB**.

Не создавать новую несовместимую с проектом систему `days/nights`.

Если в проекте уже существует правило:

```text
3 days = 2 nights
```

или другое определение — использовать именно существующее правило.

---

# 9. УЧИТЫВАТЬ РЕАЛЬНЫЕ DATE/TIME

Нельзя считать, что дата вылета автоматически равна дате прибытия.

Например:

```text
Departure:
01.10 23:50

Arrival:
02.10 04:30
```

В этом случае фактическая дата прибытия:

```text
02.10
```

а не:

```text
01.10
```

Дата hotel check-in должна рассчитываться с учётом фактического arrival datetime.

Аналогично учитывать:

- overnight flights;
- timezone;
- arrival next day;
- return flight date;
- hotel check-out.

Если текущая архитектура уже содержит timezone handling — использовать её.

---

# 10. ПОИСК ОТЕЛЕЙ

После формирования возможных flight periods система должна искать отели.

Например:

```text
Flight:

Baku → Dubai
01.10 → 06.10

↓

Hotel Search:

Dubai
check-in: 01/02.10*
check-out: 06.10
```

Точная дата check-in определяется существующими бизнес-правилами и фактическим временем прибытия.

Главное:

**Hotel Search должен выполняться на основе фактического периода пребывания, а не просто на основе диапазона flight dates.**

---

# 11. СООТВЕТСТВИЕ НАПРАВЛЕНИЯ

Необходимо сопоставить:

```text
Flight destination
```

с:

```text
Hotel destination
```

Использовать существующую TravelHUB Geography.

Иерархия:

```text
Country
    ↓
City
    ↓
Resort
    ↓
Hotel
```

Не создавать отдельную Geography для Independent Tours.

---

# 12. ГОРОД С СОБСТВЕННЫМ АЭРОПОРТОМ

Если destination city имеет собственный airport:

```text
City
    ↓
Airport
```

можно использовать этот аэропорт напрямую.

Например:

```text
Dubai
    ↓
DXB
```

---

# 13. ГОРОД / RESORT БЕЗ СОБСТВЕННОГО АЭРОПОРТА

Это критически важная часть механизма.

Если hotel destination:

```text
City / Resort
```

не имеет собственного аэропорта, система **не должна просто выбирать ближайший аэропорт по расстоянию**.

Необходимо определить, какие аэропорты реально используются для организации поездок в данный destination.

---

# 14. GATEWAY AIRPORT MAPPING

Необходимо использовать существующие TravelHUB mappings, а если их недостаточно — создать отдельный слой:

```text
GatewayAirportMapping
```

Он должен связывать:

```text
Country
City
Resort
Airport
Source
Provider
Priority
Active
```

Пример:

```text
Antalya Resort
    ↓
AYT
```

или:

```text
Resort X
    ↓
Airport A
Airport B
```

Если для одного destination существует несколько допустимых аэропортов, необходимо сохранять все подтверждённые варианты.

---

# 15. ИСТОЧНИКИ GATEWAY MAPPING

Использовать источники в следующем порядке:

```text
1. Existing TravelHUB mappings

2. Existing provider mappings/data

3. Compass

4. Summer

5. Kazunion

6. Anex

7. Manual Admin confirmation
```

Это не означает, что необходимо обязательно создавать отдельные запросы к каждому поставщику.

Если необходимая информация уже существует в TravelHUB — использовать её.

---

# 16. НЕ ГАДАТЬ AIRPORT

Запрещено автоматически создавать gateway mapping на основании:

```text
nearest airport
distance
geographical proximity
AI assumption
```

если отсутствует подтверждённая бизнес-связь.

Если система не знает, какой аэропорт используется для destination:

```text
AIRPORT_MAPPING_UNKNOWN
```

В таком случае самостоятельный тур **не создавать**.

---

# 17. ПРИМЕР

Есть hotel:

```text
Country:
Turkey

Resort:
X

Airport:
нет
```

Существующие tour operators показывают:

```text
B2C/B2B tours:
AYT → Resort X
```

Тогда создаётся/используется:

```text
GatewayAirportMapping

Resort X
    ↓
AYT
```

После этого:

```text
Flight:
Baku → AYT

Hotel:
Resort X

↓

Compatible Independent Tour
```

---

# 18. НЕ ПУТАТЬ HOTEL CITY И AIRPORT CITY

Например:

```text
Flight:
Baku → AYT

Hotel:
Resort X
```

Если Resort X обслуживается аэропортом AYT, это может быть валидная комбинация.

Нельзя требовать:

```text
flight.destinationCity === hotel.city
```

во всех случаях.

Необходима логика:

```text
flight airport
      ↓
gateway mapping
      ↓
hotel city/resort
```

---

# 19. INDEPENDENT TOUR КАК COMBINATION

Самостоятельный тур не должен обязательно становиться новым физическим Product.

Архитектурно предпочтительно рассматривать его как комбинацию двух Offer:

```text
IndependentTourOffer
    ├── FlightOffer
    └── HotelOffer
```

Например:

```ts
IndependentTourOffer {
    id;

    destination;

    stay;

    flight;

    hotel;

    totalPrice;

    availability;

    sourceMetadata;
}
```

Использовать реальные существующие domain models проекта вместо создания дубликатов.

---

# 20. ПРЕДЛАГАЕМАЯ СТРУКТУРА

Если в проекте нет аналогичной модели, использовать концептуально:

```ts
IndependentTourOffer {
    id;

    destination: {
        countryId;
        cityId?;
        resortId?;
        airportId;
    };

    stay: {
        departureDate;
        arrivalDate;
        checkInDate;
        checkOutDate;
        returnDate;
        durationDays;
        nights;
    };

    flight: {
        offerId;
        sourceId;
        price;
        currency;
    };

    hotel: {
        offerId;
        sourceId;
        hotelId?;
        hotelName;
        roomType?;
        accommodation?;
        meal?;
        price;
        currency;
    };

    totalPrice: {
        amount;
        currency;
    };

    availability: {
        status;
    };

    sourceMetadata: {
        flightSource;
        hotelSource;
        gatewayMappingSource?;
    };
}
```

Это только концептуальная модель.

Если аналогичные структуры уже есть в проекте — использовать существующие.

---

# 21. FLIGHT SOURCE И HOTEL SOURCE

Авиабилет и отель могут происходить из разных источников.

Например:

```text
Flight:
TravelHUB Flight Provider

Hotel:
Compass
```

или:

```text
Flight:
Provider A

Hotel:
TravelHUB Catalog
```

Не запрещать такую комбинацию, если существующая архитектура Booking позволяет забронировать оба компонента.

Всегда сохранять:

```text
flightSource
hotelSource
```

---

# 22. BOOKING COMPATIBILITY

Перед созданием IndependentTourOffer необходимо проверить:

```text
Can flight be booked?
Can hotel be booked?
```

Если один из компонентов не поддерживает необходимый booking flow, система не должна показывать предложение как гарантированно бронируемое, если существующая архитектура этого не допускает.

Нужно сохранить информацию о способе бронирования каждого компонента.

---

# 23. PRICE

Цена самостоятельного тура:

```text
TOTAL =
FLIGHT PRICE
+
HOTEL PRICE
```

Не добавлять:

```text
transfer
insurance
excursion
```

Если в TravelHUB уже существует:

```text
commission
markup
currency conversion
fees
pricing rules
```

использовать существующий Pricing механизм.

Не создавать отдельный второй механизм расчёта комиссии.

---

# 24. ВАЛЮТА

Использовать существующий Currency Service.

Если:

```text
Flight = USD
Hotel = EUR
```

не выполнять собственную конвертацию внутри IndependentTourService.

Использовать существующий:

```text
CurrencyService
PricingService
Money
```

или соответствующие существующие сервисы проекта.

---

# 25. COMPATIBILITY CHECK

Перед созданием IndependentTourOffer проверить:

### Destination

```text
flight destination
        ↓
airport mapping
        ↓
hotel destination
```

### Dates

```text
flight arrival
        ↓
hotel check-in

hotel check-out
        ↓
return flight
```

### Duration

```text
3–7 days
```

### Availability

```text
flight available
hotel available
```

### Booking

```text
flight bookable
hotel bookable
```

---

# 26. ОБЯЗАТЕЛЬНАЯ ПРОВЕРКА RETURN FLIGHT

Нельзя создавать тур только потому, что существует:

```text
outbound flight
```

Должен существовать совместимый:

```text
return flight
```

на допустимую дату.

Например:

```text
Outbound:
01.10

Duration:
5 days

↓

Return:
06.10
```

Система должна проверить наличие реального flight offer на эту дату.

---

# 27. ПЕРЕБОР ВОЗМОЖНЫХ ДАТ

Для каждого доступного outbound flight:

```text
departureDate
```

проверить:

```text
departureDate + 3 days
departureDate + 4 days
departureDate + 5 days
departureDate + 6 days
departureDate + 7 days
```

Для каждого варианта:

```text
find return flight
        ↓
find hotel
        ↓
validate compatibility
```

---

# 28. ПРИМЕР

Есть:

```text
Baku → Dubai

01.10
02.10
04.10
```

Система строит варианты:

```text
01.10 → 04.10
01.10 → 05.10
01.10 → 06.10
01.10 → 07.10
01.10 → 08.10

02.10 → 05.10
02.10 → 06.10
...
```

Но только те варианты, для которых существует:

```text
return flight
+
hotel availability
```

становятся IndependentTourOffer.

---

# 29. НЕЛЬЗЯ СОЗДАВАТЬ ВИРТУАЛЬНУЮ ДОСТУПНОСТЬ

Запрещено создавать:

```text
fake flight
fake hotel
estimated availability
assumed price
```

Если данных нет:

```text
NO OFFER
```

---

# 30. РЕАЛЬНЫЕ ЦЕНЫ

Independent Tour должен строиться на основе текущих доступных цен.

Но необходимо учитывать, что flight/hotel inventory может измениться.

Поэтому:

```text
IndependentTourOffer
```

является комбинацией текущих Offers, а не вечной гарантией цены.

---

# 31. REVALIDATION

Перед booking необходимо обязательно выполнить повторную проверку:

```text
Flight availability
Flight price

Hotel availability
Hotel price
```

Если цена или availability изменилась:

```text
REVALIDATION_FAILED
```

или использовать существующий механизм price change / rebooking confirmation.

Нельзя бронировать устаревший Offer без revalidation, если текущая архитектура требует проверки.

---

# 32. ПОСТРОЕНИЕ ПРЕДЛОЖЕНИЙ

Общий pipeline:

```text
1. Search Flights

2. Normalize Flights

3. Extract:
   countries
   cities
   airports
   dates

4. Generate possible stay periods:
   3–7 days

5. Find return flights

6. Resolve destination geography

7. Resolve gateway airport

8. Search Hotels

9. Normalize Hotels

10. Match:
    Flight + Hotel

11. Validate dates

12. Validate availability

13. Validate booking capability

14. Calculate total price

15. Create IndependentTourOffer

16. Deduplicate

17. Return results
```

---

# 33. GATEWAY RESOLUTION PIPELINE

Использовать:

```text
Hotel Destination
        ↓
Does destination have airport?
        ↓
YES
        ↓
Use destination airport

NO
        ↓
Find GatewayAirportMapping
        ↓
Mapping exists?
        ↓
YES
        ↓
Use mapped airport

NO
        ↓
AIRPORT_MAPPING_UNKNOWN
        ↓
Do not auto-create offer
```

---

# 34. НЕ УДАЛЯТЬ GEOGRAPHY

Отсутствие текущего:

```text
flight
hotel
offer
```

не означает отсутствие:

```text
country
city
resort
airport
```

Master Geography должна существовать независимо от текущей availability.

---

# 35. DEDUPLICATION

Необходимо предусмотреть deduplication.

Один и тот же IndependentTourOffer не должен появляться несколько раз только из-за:

```text
duplicate provider response
duplicate hotel response
duplicate mapping
duplicate flight
```

Использовать существующий механизм deduplication, если он есть.

Если нет — определить стабильный ключ комбинации.

Например:

```text
origin
destination/gateway
departureDate
returnDate
flightOffer
hotelOffer
room
meal
```

Но не создавать искусственные дубликаты.

---

# 36. MULTIPLE HOTELS

Для одного flight combination может существовать множество отелей:

```text
Flight A
    ↓
Hotel 1
Hotel 2
Hotel 3
Hotel 4
```

Каждая валидная комбинация должна быть отдельным Offer.

---

# 37. MULTIPLE FLIGHTS

Для одного hotel:

```text
Flight 1
Flight 2
Flight 3
```

могут существовать разные IndependentTourOffers.

Например:

```text
Flight 1 + Hotel A
Flight 2 + Hotel A
Flight 3 + Hotel A
```

если все комбинации совместимы.

---

# 38. MULTIPLE GATEWAY AIRPORTS

Если destination имеет:

```text
Gateway A
Gateway B
```

и существуют flights в оба аэропорта:

```text
Baku → A
Baku → B
```

необходимо рассматривать оба варианта, если оба mapping подтверждены.

Не выбирать один аэропорт только потому, что он географически ближе.

---

# 39. PROVIDER PROVENANCE

Для каждого gateway mapping хранить provenance:

```text
source
providerId
createdAt
updatedAt
priority
```

Пример:

```text
source = SUMMER
providerId = ...
```

или:

```text
source = TRAVELHUB
```

---

# 40. ПРИОРИТЕТ MAPPING

Если существует несколько mappings, использовать:

```text
priority
```

но не удалять остальные валидные mappings.

Пример:

```text
Resort X

AYT priority 1
DLM priority 2
```

Оба остаются валидными.

---

# 41. ADMIN

Для `AIRPORT_MAPPING_UNKNOWN` необходимо предусмотреть возможность последующего подтверждения администратором.

Например:

```text
Geography
  ↓
Gateway Airports
```

Администратор может:

```text
add mapping
edit mapping
disable mapping
change priority
```

После этого destination становится доступным для Independent Tour generation.

---

# 42. ERROR STATES

Предусмотреть явные состояния:

```text
NO_FLIGHT
NO_RETURN_FLIGHT
NO_HOTEL
NO_GATEWAY_MAPPING
AIRPORT_MAPPING_UNKNOWN
DATE_MISMATCH
AVAILABILITY_CHANGED
PRICE_CHANGED
NOT_BOOKABLE
INVALID_DURATION
```

Не скрывать причину, если предложение не может быть создано.

---

# 43. LOGGING

Логировать pipeline:

```text
Independent Tour Generation

Flight search:
N results

Destinations:
N

Possible date combinations:
N

Return flights:
N

Hotel results:
N

Gateway mappings:
N

Compatible combinations:
N

Generated offers:
N

Rejected:
NO_HOTEL = N
NO_RETURN_FLIGHT = N
NO_GATEWAY_MAPPING = N
DATE_MISMATCH = N
...
```

Логи не должны содержать секреты API.

---

# 44. PERFORMANCE

Не выполнять без необходимости:

```text
Flight Search
×
all dates
×
all hotels
×
all providers
```

Необходимо использовать:

- batching;
- caching;
- existing provider cache;
- normalized geography;
- date grouping;
- deduplication;
- ограничение количества повторных запросов;
- существующие rate-limit механизмы.

---

# 45. PROVIDER RATE LIMITS

Не создавать отдельный rate-limit механизм внутри Independent Tour Service.

Использовать существующий Provider infrastructure:

```text
HTTP client
session
cookies
rate limiting
retry
timeout
provider configuration
logging
```

Independent Tour Service должен работать поверх существующего provider layer.

---

# 46. ОШИБКА ОДНОГО PROVIDER

Ошибка одного поставщика не должна ломать генерацию всего списка.

Например:

```text
Compass → ERROR

Summer → OK
Kazunion → OK
TravelHUB Catalog → OK
```

Результаты от доступных источников должны продолжать обрабатываться.

Использовать существующий error isolation механизм.

---

# 47. ON-DEMAND И PRECOMPUTATION

Архитектура должна позволять два режима:

### ON-DEMAND

```text
Search
↓
Flight
↓
Hotel
↓
Independent Tour
```

### PRECOMPUTED

```text
IndependentTourOffers
```

Фоновый процесс периодически строит предложения.

Но даже precomputed offers должны проходить revalidation перед booking.

---

# 48. API

Если в проекте отсутствует соответствующий API, определить endpoint по существующему стилю проекта.

Концептуально:

```http
GET /independent-tours/search
```

или:

```http
POST /independent-tours/search
```

Request должен использовать существующую модель SearchRequest.

Не создавать новый формат параметров, если существующий Search уже поддерживает необходимые параметры.

---

# 49. FRONTEND

Frontend должен получать нормализованный:

```text
IndependentTourOffer
```

и отображать минимум:

```text
Flight
Hotel
Destination
Dates
Duration
Price
Currency
Availability
```

Пример:

```text
Dubai

01 Oct → 06 Oct
5 days

Flight
Baku → Dubai
01 Oct

Dubai → Baku
06 Oct

Hotel
5 nights
Hotel Name
Room / Meal

Total:
$XXX
```

---

# 50. НЕ ПОКАЗЫВАТЬ TRANSFER И INSURANCE

Independent Tour UI не должен автоматически добавлять:

```text
Transfer
Insurance
```

Если они существуют как отдельные продукты TravelHUB, они могут быть доступны отдельно, но не должны входить в состав Independent Tour.

---

# 51. BOOKING

При бронировании:

```text
IndependentTour
        ↓
Flight Booking
+
Hotel Booking
```

Необходимо использовать существующие booking flows.

Не создавать фиктивный единый provider booking, если flight и hotel принадлежат разным системам.

Сохранять:

```text
flightBookingReference
hotelBookingReference
```

если это соответствует существующей модели.

---

# 52. PARTIAL BOOKING

Необходимо проверить существующие бизнес-правила проекта относительно ситуации:

```text
Flight booked
Hotel failed
```

или:

```text
Hotel booked
Flight failed
```

Не придумывать новый financial/rollback механизм без анализа текущего Booking architecture.

Если проект уже имеет transaction / compensation / rollback механизм — использовать его.

---

# 53. ACCEPTANCE CRITERIA

Реализация считается завершённой только если выполнены все условия.

### A. Flight discovery

Система определяет:

```text
countries
cities
airports
dates
```

из реальных flight offers.

### B. Duration

Принимаются:

```text
3
4
5
6
7
```

Отклоняются:

```text
2
8
```

### C. Return flight

Для каждого Independent Tour существует совместимый return flight.

### D. Hotel

Для соответствующего периода существует доступный hotel offer.

### E. Airport

Если destination имеет airport:

```text
use destination airport
```

Если не имеет:

```text
use confirmed gateway mapping
```

### F. Unknown mapping

Если mapping отсутствует:

```text
AIRPORT_MAPPING_UNKNOWN
```

и Independent Tour автоматически не создаётся.

### G. No transfer

Independent Tour содержит:

```text
Flight
Hotel
```

и не содержит:

```text
Transfer
Insurance
```

### H. Price

Цена рассчитывается:

```text
Flight
+
Hotel
```

с использованием существующего Pricing/Currency/Commission механизма.

### I. Revalidation

Перед booking:

```text
Flight revalidation
Hotel revalidation
```

### J. Different sources

Поддерживается:

```text
Flight Source A
+
Hotel Source B
```

если существующая booking architecture позволяет это.

---

# 54. ОБЯЗАТЕЛЬНЫЕ E2E TESTS

Создать E2E/integration tests минимум для следующих сценариев.

## TEST 1 — DIRECT AIRPORT

```text
Flight:
Baku → Dubai Airport

Hotel:
Dubai

Airport:
DXB

Expected:
IndependentTour created
```

## TEST 2 — RESORT WITHOUT AIRPORT

```text
Flight:
Baku → AYT

Hotel:
Resort X

Resort X:
no airport

Gateway mapping:
Resort X → AYT

Expected:
IndependentTour created
```

## TEST 3 — UNKNOWN GATEWAY

```text
Flight:
Baku → UNKNOWN_AIRPORT

Hotel:
Resort X

No gateway mapping

Expected:
AIRPORT_MAPPING_UNKNOWN
No IndependentTour
```

## TEST 4 — HOTEL UNAVAILABLE

```text
Flight:
available

Hotel:
unavailable

Expected:
No IndependentTour
Reason:
NO_HOTEL
```

## TEST 5 — OUTBOUND ONLY

```text
Outbound:
available

Return:
unavailable

Expected:
No IndependentTour
Reason:
NO_RETURN_FLIGHT
```

## TEST 6 — VALID 3 DAYS

```text
Departure:
01.10

Return:
04.10

Expected:
Accepted
```

## TEST 7 — VALID 7 DAYS

```text
Departure:
01.10

Return:
08.10

Expected:
Accepted
```

## TEST 8 — INVALID 2 DAYS

```text
Departure:
01.10

Return:
03.10

Expected:
Rejected
```

## TEST 9 — INVALID 8 DAYS

```text
Departure:
01.10

Return:
09.10

Expected:
Rejected
```

## TEST 10 — DIFFERENT SOURCES

```text
Flight:
Provider A

Hotel:
Provider B

Expected:
IndependentTour created

flightSource = Provider A
hotelSource = Provider B
```

если booking architecture поддерживает cross-provider booking.

---

# 55. DATA MODEL / DATABASE

Перед созданием новых migrations проверить существующие таблицы.

Не создавать новую таблицу, если текущая модель уже позволяет хранить комбинацию:

```text
FlightOffer
HotelOffer
```

Если persistence для IndependentTour действительно необходим, создать минимальную модель.

Она должна хранить references на исходные offers, а не дублировать весь flight/hotel data без необходимости.

---

# 56. НЕ ДУБЛИРОВАТЬ PROVIDER LOGIC

Запрещено:

```text
IndependentTourService
    ├── Compass API
    ├── Summer API
    ├── Kazunion API
    └── Anex API
```

Правильно:

```text
IndependentTourService
        ↓
FlightSearchService
HotelSearchService
        ↓
Provider Layer
        ↓
Adapters
```

---

# 57. АРХИТЕКТУРНАЯ СХЕМА

Целевая логика:

```text
                    ┌─────────────────────┐
                    │ Flight Search       │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Normalized Flights  │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Date Combinations    │
                    │ 3–7 days             │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Return Flights       │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Geography Resolver   │
                    └──────────┬──────────┘
                               │
                     ┌─────────┴──────────┐
                     │                    │
                     ▼                    ▼
              Direct Airport       Gateway Mapping
                     │                    │
                     └─────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Hotel Search        │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Hotel Offers        │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Compatibility       │
                    │ Validator           │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Price Calculator     │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ IndependentTourOffer│
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Revalidation        │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Booking             │
                    └─────────────────────┘
```

---

# 58. РЕКОМЕНДУЕМЫЕ COMPONENTS

Если аналогов нет, определить следующие компоненты:

```text
IndependentTourSearchService

IndependentTourBuilder

IndependentTourMatcher

IndependentTourCompatibilityService

IndependentTourPricingService

GatewayAirportResolver

GatewayAirportMappingRepository

IndependentTourRevalidationService
```

Но перед созданием каждого сервиса обязательно проверить существующую архитектуру.

Не создавать сервисы только ради соответствия этому списку.

---

# 59. ОСОБОЕ ПРАВИЛО ДЛЯ GATEWAY AIRPORT

Gateway Airport — это не просто техническое поле Hotel.

Это отдельная бизнес-связь:

```text
Destination
    ↓
Gateway Airport
```

Она должна быть переиспользуема не только Independent Tours, но и другими механизмами TravelHUB, которым необходимо понимать, через какой аэропорт обслуживается destination.

---

# 60. ВАЖНО: НЕ ЛОМАТЬ СУЩЕСТВУЮЩИЕ TOURS

Реализация Independent Tours не должна ломать:

```text
Existing Tours
Flight Search
Hotel Search
Provider integrations
Booking
Geography
StoreFront
Marketplace
```

Особенно важно сохранить работоспособность существующих:

```text
Compass
Summer
Kazunion
Anex
```

tour integrations.

---

# 61. ОБРАТНАЯ СОВМЕСТИМОСТЬ

Все существующие API и domain models должны продолжать работать.

Если требуется изменение существующей модели:

1. определить impact;
2. сохранить backward compatibility;
3. создать migration;
4. обновить tests;
5. проверить существующие Tours.

---

# 62. ПОРЯДОК РЕАЛИЗАЦИИ

Работать строго по этапам.

## PHASE 1 — AUDIT

Изучить текущий проект:

```text
Flight
Hotel
Tour
Provider
Adapter
Search
Geography
Airport
Booking
Pricing
Currency
```

Составить карту существующих компонентов.

## PHASE 2 — NORMALIZED DATA

Проверить существующие:

```text
FlightOffer
HotelOffer
Geography
Airport
```

и определить, какие модели можно переиспользовать.

## PHASE 3 — GATEWAY MAPPING

Реализовать/расширить:

```text
GatewayAirportMapping
GatewayAirportResolver
```

Использовать существующие mappings в первую очередь.

## PHASE 4 — DATE ENGINE

Реализовать:

```text
3–7 days
```

с использованием существующей логики TravelHUB для:

```text
days
nights
check-in
check-out
```

## PHASE 5 — MATCHING

Реализовать:

```text
Flight
+
Return Flight
+
Hotel
+
Gateway
```

compatibility.

## PHASE 6 — INDEPENDENT TOUR OFFER

Создать нормализованный IndependentTourOffer.

## PHASE 7 — PRICING

Подключить существующий:

```text
Currency
Pricing
Commission
```

## PHASE 8 — REVALIDATION

Перед booking реализовать/подключить:

```text
Flight Revalidation
Hotel Revalidation
```

## PHASE 9 — BOOKING

Подключить существующие booking flows.

## PHASE 10 — E2E TESTS

Реализовать все обязательные сценарии.

---

# 63. ФОРМАТ ОТЧЁТА ПОСЛЕ РЕАЛИЗАЦИИ

После завершения работы предоставить отчёт:

```text
1. Existing architecture audited

2. Reused components

3. New components

4. Database changes

5. API changes

6. Gateway mappings

7. Flight matching logic

8. Hotel matching logic

9. Duration logic

10. Pricing logic

11. Revalidation

12. Booking

13. Tests

14. Test results

15. Potential risks

16. Files changed
```

---

# 64. КРИТИЧЕСКИЕ ЗАПРЕТЫ

Не делать:

```text
❌ создавать тур только из hotel
❌ создавать тур только из flight
❌ использовать длительность < 3 дней
❌ использовать длительность > 7 дней
❌ придумывать return flight
❌ придумывать hotel availability
❌ придумывать price
❌ выбирать ближайший аэропорт без подтверждения
❌ автоматически создавать gateway mapping без источника
❌ добавлять transfer
❌ добавлять insurance
❌ дублировать provider adapters
❌ создавать отдельную Geography для Independent Tours
❌ ломать существующие Tours
❌ обходить существующий Booking architecture
❌ создавать второй Pricing/Currency механизм
```

---

# 65. ИТОГОВОЕ БИЗНЕС-ПРАВИЛО

TravelHUB должен уметь автоматически находить реальные комбинации:

```text
FLIGHT
+
HOTEL
=
INDEPENDENT TOUR
```

при выполнении условий:

```text
Flight exists
+
Return flight exists
+
Hotel exists
+
Destination matches
+
Gateway airport confirmed
+
Duration = 3–7 days
+
Dates compatible
+
Availability valid
+
Booking possible
```

Результатом является самостоятельный тур:

```text
┌─────────────────────────────┐
│     INDEPENDENT TOUR        │
├─────────────────────────────┤
│ Flight                      │
│ Hotel                       │
│ Destination                │
│ Dates                       │
│ Duration 3–7 days           │
│ Total Price                 │
│ Availability                │
└─────────────────────────────┘
```

Без:

```text
Transfer
Insurance
```

Главный принцип:

> **Не придумывать туристические продукты. Формировать их только из реально существующих и совместимых flight и hotel offers, используя подтверждённую TravelHUB Geography и Gateway Airport Mapping.**
