# ПЛАН: единый каталог фотографий отелей Navitravel

Дата аудита: 2026-10-15. БД: `travelhub` (реальная). Аудит read-only.

## 1. Что есть сейчас (аудит)

### 1.1 Модель данных
Отдельной сущности «отель» в схеме **нет**. Отели — это `catalog."Product"`:

| Факт | Значение |
|---|---|
| `catalog."Product"` type=TOUR | 5 478 |
| `catalog."Product"` type=HOTEL | 2 857 |
| Поставщики в каталоге | KOMPAS 8 143, SUMMERTOUR 192 |
| Уникальных пар (supplierCode, hotelKey) | **5 331** |
| `hotelKey` в словаре `geo.SupplierGeoLink` (kind=HOTEL) | 22 999 (ANEX 11 816, KOMPAS 11 183) |
| `catalog."ProductMedia"` | **0 строк** (S3-медиа, привязана к productId) |

Идентичность отеля сегодня:
- `attributes.hotelKey` — **нативный id отеля у поставщика** (KOMPAS/SUMMERTOUR/KAZUNION). Стабилен: один и тот же `hotelKey` встречается и в туре, и в услуге «Отели».
- Название: `attributes.hotelName` (KOMPAS, в т.ч. с «(Город)»), `attributes.hotel` (SUMMERTOUR).
- Гео: `countryCode`, `country`, `city`, `resort`, `stars`.
- `geo.SupplierGeoLink` (kind=HOTEL): `supplierCode + externalId(=hotelKey) → label(название) + geoCountryId/geoCityId/geoResortId` — **существующий словарь отелей поставщиков**, 22 999 записей со 100% заполненным label.

**Доказано:** пересёр `hotelKey` тур ↔ отель услуги даёт 1 319 совпадений, и названия совпадают дословно
(`40252 → "Al Hayat Hotel* 4*"` и в туре «(Sharjah)», и в услуге, city=Sharjah). То есть `hotelKey` — это физический отель.

### 1.2 Что уже умеет фото сегодня
- `backend/scripts/fetch-hotel-photos.ts` — загрузчик: ищет фото Tripadvisor через **Bing Images** (HTML Tripadvisor закрыт DataDome; CDN картинок открыт), качает в `frontend/public/hotels/`.
- Имена файлов **зависят от контекста**:
  - тур → `<tourinc>-<hotelKey>.jpg` (напр. `3332-25099.jpg`);
  - услуга «Отели» → `htl-<hotelKey>.jpg` (напр. `htl-25099.jpg`).
- `frontend/lib/hotel-photo.ts` — ключ **парсится из slug** (`hotelPhotoKeyFromSlug`), затем HEAD-пробник jpg/png + кеш.
- `frontend/app/hotels/[file]/route.ts` — отдаёт `/hotels/*` (только jpg/jpeg/png).
- Бэкенд `public-catalog.service.ts::hotelPhotoUrl(slug)` — та же slug-эвристика.
- На диске сейчас **3 файла**: `htl-46890.jpg`, `htl-47260.jpg`, `htl-49409.jpg`.

### 1.3 Корень проблемы дублирования
Один физический отель получает **разные файлы** в зависимости от того, где он показан:
`3332-25099.jpg` (тур) ≠ `htl-25099.jpg` (услуга) ≠ `5555-25099.jpg` (другой тур с тем же отелем).
Плюс у разных поставщиков — свои hotelKey → свои файлы. Ровно то, что задача требует устранить.

## 2. Целевая архитектура

### 2.1 Канонический реестр отелей (2 таблицы)
`ProductMedia` не подходит: он привязан к `productId` и к S3-ключам, а нам нужна **одна** фотография на физический отель, общая для многих продуктов. Поэтому заводим минимальный реестр (существующей модели отеля в проекте нет).

**`catalog."Hotel"`** (физическая гостиница):
`id` PK · `name` · `normalizedName` · `stars` · `countryCode` · `countryName` · `cityName` · `resortName` ·
`photoFile` (`hotel_<id>.webp`) · `photoStatus` (NONE|OK|FAILED|REVIEW) · `photoSource` · `photoSourceUrl` ·
`photoAttribution` · `photoWidth/Height/Bytes` · `photoUpdatedAt` · `createdAt` · `updatedAt`

**`catalog."HotelSupplierRef"`** (внешние id поставщиков → одна запись отеля):
`id` PK · `hotelId` FK · `supplierCode` · `externalKey` (hotelKey/hotelInc) · `name` · `countryCode` · `cityName` ·
`resortName` · `stars` · `hotelHref` · `source` (product|geolink) · `firstSeenAt` · `lastSeenAt`
**UNIQUE (supplierCode, externalKey)**

### 2.2 Правила сопоставления
1. **Внутри поставщика:** `(supplierCode, hotelKey)` = один отель. Автоматически. Это уже объединяет тур и услугу (1 319 отелей KOMPAS) и убирает файлы `3332-25099` vs `htl-25099`.
2. **Между поставщиками:** объединяем только при совпадении `normalizedName + countryCode + cityName` **и** единственном кандидате. Иначе — отдельная запись + метка на ручную проверку (не сливать по одному названию).
3. Неоднозначные — в отчёт `ambiguous.json`.

### 2.3 Фотокаталог
- Один файл на отель: `frontend/public/hotels/hotel_<id>.webp` (если webp недоступен — `.jpg`, имя всё равно `hotel_<id>`).
- Резолвинг: `Product.attributes(supplierCode, hotelKey)` → `HotelSupplierRef` → `Hotel.photoFile` → `/hotels/hotel_<id>.webp`.
- Замена фото в реестре автоматически меняет картинку во **всех** разделах (тур, отель, поиск, конструктор) — копий нет.
- Загрузчик идемпотентный (повторный запуск не плодит дубликаты), с журналом и проверкой целостности.

### 2.4 Интеграция
- Backend `public-catalog.service.ts`: `hotelImage` считать из реестра (вместо slug-эвристики), fallback на старый slug-файл.
- Frontend: `hotel-photo.ts` — доверять URL из API (slug-парсинг оставить как fallback); добавить **webp** в пробу и в `app/hotels/[file]/route.ts`; `Hotels.tsx` подключить к фото (сейчас не показывает локальное фото вовсе); `MediaGallery` — использовать `hotelImage` из API.
- Конструктор туров (`TourConstructor.tsx`) и глобальный поиск — подключить тот же источник.

## 3. Этапность и артефакты
- **B (сопоставление):** `backend/scripts/hotel-registry.ts --build` → таблицы + `hotel-registry.json` + `ambiguous.json`.
- **C (фото):** `backend/scripts/hotel-photo-catalog.ts --fetch [--limit=N] [--only=id]` → `hotel_<id>.webp` + журнал.
- **D (интеграция):** backend resolver + frontend (hotel-photo, Hotels.tsx, MediaGallery, route.ts webp).
- **E (тесты):** 10 кейсов из задания + `tsc` + сборка.

## 3a. Статус (выполнено полностью)
Этапы A–E реализованы и покрыты тестами; итог и числа — в
`docs/prompts/HOTEL_PHOTO_CATALOG_REPORT.md`. Заказчик выбрал **вариант 3**
(источник Tripadvisor, ответственность на нём) — загрузка выполнена на все отели:
**4 603 из 4 878** (94,4 %), без фото — 275.

## 4. РИСК ПРАВ НА ИЗОБРАЖЕНИЯ (решение заказчика получено — вариант 3)
Фотографии Tripadvisor — пользовательский контент, защищённый авторским правом; их массовая выкачка и
публикация на коммерческом сайте нарушает ToS Tripadvisor и права авторов. Задание прямо запрещает
загружать фото без подтверждённых прав. Поэтому **массовую загрузку запускаю только после явного решения**:
- вариант 1 — пилот (≈10 отелей) для проверки пайплайна, остальное — по списку на согласование;
- вариант 2 — взять официально лицензируемый источник (официальные фото отелей / партнёрские фиды поставщиков);
- вариант 3 — заказчик подтверждает ответственность за источник Tripadvisor и запускаем на все отели.
