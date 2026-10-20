# FSTravel — долг (остановлено, вернёмся позже)

**Статус на 19.10.2026:** работа с FSTravel приостановлена по решению пользователя. Серверы (backend :4000, frontend :3000) работают, синк-цикл остановлен, нагрузки нет.

## Что уже сделано
- FSTravel зарегистрирован в live `SupplierAdapterRegistry` (serviceTypes tours, searchEnabled, maxConcurrency 8, timeoutMs 480000) и CRM (Partner 23389eb0… ACTIVE, имя "FSTravel").
- Plain-HTTP адаптер с captcha auto-solve (ocr2 + ddddocr-скрипты summertour/kompas, blind-guess на пустом OCR), 4 раунда × 3 внешних с фреш-картинкой, сброс сессии после abort.
- Обработка WAF 403 (nginx Forbidden) → `FSTRAVEL_IP_BLOCKED` (раньше тихо парсилось как «0 офферов»).
- Capability-матрица: 26 стран, nights 3–14; добавлены COUNTRY_NAME_TO_ISO2 (польша, германия, испания, …).
- Резолв страны: RU-имя, ISO-2, fuzzy normalized (live-поиск шлёт ISO-2).
- Каталог: Польша (PL) добавлена в Master Geography (была в словаре FSTravel, но отсутствовала в справочнике).
- **Бэкфилл geoCountryId** для 9 447 карточек туров (ANEX/FSTRAVEL/KAZUNION/KOMPAS/SUMMERTOUR) — теперь все находятся по фильтру страны.
- **Разархивированы 314 карточек KOMPAS**, ошибочно архивированных demo-seed.
- Sync-сервисы (FSTRAVEL, ANEX, KOMPAS tours, KAZUNION, SUMMERTOUR, KOMPASHTL) теперь выставляют `geoCountryId` при синке (общий хелпер `geo-country-resolver.ts`) — регрессии не будет.
- Универсальный поиск: FSTravel виден/запрашиваем в списке поставщиков (`/public/supplier/suppliers?service=tours`).
- Цена-календарь 503 «Concurrency limit exceeded» устранён (maxConcurrency 2 → 8).

## Каталог FSTravel на момент остановки
**666 карточек, 9 стран:** Турция 262, Франция 113, Италия 86, Вьетнам 85, Египет 66, Германия 34, Китай 17, Испания 2, Индия 1.

## Что осталось (долг)
1. **Синк 16 стран** (список в `backend/fstravel-countries.json`):
   Таиланд, Польша, Сингапур, Сербия, Сейшелы, Танзания, Южная Корея, Япония, Грузия, Индонезия, Маврикий, Малайзия, Мальдивы, Марокко, ОАЭ, Саудовская Аравия.
2. Шри-Ланка — пропускаем (на anex пусто целый день; по решению пользователя).
3. Ре-синк 8 капча-абортированных (Грузия, Индонезия, Маврикий, Малайзия, Мальдивы, Марокко, ОАЭ, Саудовская Аравия) — теперь идут с новым 403-детектором.
4. Финальная проверка: `backend/fstravel-postcheck.probe.js` (кол-во, AZN-тарифы, отсутствие пустых hotelKey/price), видимость в публичном каталоге, отчёт по странам.
5. Очистка временных файлов: probe-скрипты (`fstravel-postcheck/attrs/partner/captcha/empty/403/count/pl-check/audit-*/archived-check/unarchive/backfill-geo`), `fstravel-fullsync.ps1`, `fstravel-countries.json`, `fstravel-fullsync.log`, `.fstravel-captcha.jpg`, `.fstravel-forbidden.html`, `.fstravel-session.json`, `.probe-*.html`. Оставить `backend/scripts/*-captcha-ocr*.py`.
6. **Фото отелей тур-карточек FSTravel (666) отсутствуют.** Отели FSTravel не зарегистрированы в реестре фото: у продуктов есть `attributes.hotelKey/hotelName`, но нет ни `countryCode`/`city`, ни `geo."SupplierGeoLink"`. Регистрация дала бы ~632 записи без страны и города, которые не склеиваются с отелями KOMPAS/ANEX (другие ключи) и плохо ищутся в источниках фото. Решение при возобновлении: сначала геокодинг/геолинковка стран-городов FSTravel, затем `hotel-registry.ts --supplier=FSTRAVEL --merge-name-only` и `hotel-photo-catalog.ts`.
7. Коммит/пуш — только по явному запросу пользователя (ветка master, ничего не запушено).

## Как возобновить
```powershell
cd C:\Projects\Navitravel\backend
powershell -ExecutionPolicy Bypass -File fstravel-fullsync.ps1
```
Скрипт читает `fstravel-countries.json` и идёт с паузами 15 мин между странами. Запускать ночью/при свободном компе (WAF-блок IP-зависимый, тяжёлые синки не должны мешать живым запросам).

## Связанные файлы
- `backend/src/modules/supplier/fstravel/fstravel.adapter.ts` — адаптер (captcha/403/сессия)
- `backend/src/modules/supplier/fstravel/fstravel-sync.service.ts` — синк (geoCountryId теперь выставляется)
- `backend/src/modules/supplier/geo-country-resolver.ts` — общий резолвер стран
- `backend/fstravel-countries.json` — список оставшихся 16 стран
- `backend/fstravel-fullsync.ps1` / `backend/fstravel-fullsync.log` — цикл и лог
- `C:\Users\Administrator\AppData\Local\Temp\2\opencode\token.txt` — admin JWT (при истечении обновить через `/api/v1/auth/login`)
