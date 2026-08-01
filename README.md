# TravelHub v1

Единая платформа для путешествий: туры, отели, санатории, авиабилеты, ж/д билеты, экскурсии, гиды, фотографы и трансферы. Забронируйте путешествие мечты в несколько кликов.

## Возможности

**Публичный сайт**
- Каталоги услуг по категориям: туры, отели, санатории, авиабилеты, ж/д, экскурсии, гиды, фотографы, трансферы
- Фильтры по стране и городу (combobox с чекбоксами), типу услуги, поиск
- Страницы услуг со слайдером, рейтингом и отзывами
- Авторизация: вход и регистрация (3-шаговый мастер, роли покупателя и партнёра)
- Личный кабинет `/profile` (защищён proxy)

**Админ-панель** (`/admin`)
- **Command Center**: 8 KPI-карточек, график доходов (день/неделя/месяц/квартал/год), кольцевая диаграмма продаж, задачи, события, AI-рекомендации, мониторинг системы
- **Аналитика**: фильтры по периоду/стране/городу/услуге, KPI, графики, drill-down по странам → городам, воронка продаж, онлайн-пользователи
- Защита: без сессии — редирект на `/login?redirect=/admin`, покупателям доступ запрещён

## Технологии

- [Next.js 16](https://nextjs.org) (App Router, Turbopack)
- [React 19](https://react.dev)
- [Prisma 7](https://www.prisma.io) + SQLite (`better-sqlite3` driver adapter)
- [Tailwind CSS 4](https://tailwindcss.com)
- [TypeScript 5](https://www.typescriptlang.org)

## Требования

- Node.js 20.19+ / 22.12+ / 24+ (для Prisma 7)

## Установка

```bash
# 1. Склонировать репозиторий
git clone https://github.com/seldom733-hash/travelhub1.git
cd travelhub1

# 2. Установить зависимости
npm install
```

## Настройка `.env`

Создайте файл `.env` в корне проекта:

```env
# Путь к SQLite-базе (относительно корня проекта)
DATABASE_URL="file:./dev.db"

# Секрет для подписи HMAC-сессий (обязательно смените в проде!)
SESSION_SECRET="your-very-secret-key"
```

> `SESSION_SECRET` не обязателен локально (используется запасное значение), но **обязательно** задайте его в продакшене.

## Запуск

```bash
# 1. Применить миграции и создать базу (заодно сгенерирует Prisma Client)
npx prisma migrate dev

# 2. Засеять тестовые данные (226 пользователей, 500 услуг, 330 броней, 944 отзыва)
npx tsx prisma/seed.ts

# 3. Запустить dev-сервер
npm run dev
```

> `src/generated/prisma` не хранится в git — на свежем клоне клиент генерируется автоматически при `prisma migrate dev`. Если нужно вручную: `npx prisma generate`.

Откройте [http://localhost:3000](http://localhost:3000).

## Полезные команды

| Команда | Описание |
| --- | --- |
| `npm run dev` | Dev-сервер (Turbopack) |
| `npm run build` | Продакшен-сборка |
| `npm run start` | Запуск продакшен-сборки |
| `npm run lint` | Линт (ESLint) |
| `npx prisma migrate dev` | Применить миграции (в dev) |
| `npx prisma migrate deploy` | Применить миграции (в prod) |
| `npx prisma migrate status` | Статус миграций |
| `npx prisma generate` | Перегенерировать Prisma Client |
| `npx prisma studio` | GUI для просмотра базы |
| `npx tsx prisma/seed.ts` | Засеять тестовые данные |

> Сид идемпотентен: при повторном запуске обновляет пользователей и пересоздаёт услуги/активность с теми же данными (детерминированный PRNG).

## Тестовые учётные записи

| Роль | Email | Пароль |
| --- | --- | --- |
| **Админ** | `admin@travelhub.az` | `admin123` |
| **Партнёр (пример)** | `info@navitravel.az` | `partner123` |
| **Покупатель (демо)** | `buyer@mail.com` | `buyer123` |

Все пароли по ролям:
- Админ — 1 аккаунт, пароль `admin123`
- Партнёры — 20 аккаунтов (`partner04@travelhub.az` … `partner20@travelhub.az`, плюс `info@navitravel.az`, `travelpro@mail.com`, `geotrip@mail.com`), пароль `partner123`
- Покупатели — 200 аккаунтов (`buyer001@mail.com` … `buyer200@mail.com`) + демо `buyer@mail.com`, пароль `buyer123`

Полный список — в файле `users-credentials.txt`.

## Структура проекта

```
prisma/
  schema.prisma          # Модели данных (User, Service, Booking, ServiceView, Review, Country, City)
  migrations/            # SQL-миграции
  seed.ts                # Тестовые данные
src/
  app/
    (site)/              # Публичный сайт (главная, каталоги, логин, регистрация, профиль)
    admin/               # Админ-панель (Command Center, Аналитика)
    api/                 # Route handlers: auth/*, admin/*, catalog (countries, cities, services, stats)
    error.tsx            # Error boundary (публичный сайт)
    global-error.tsx     # Корневой error boundary
    layout.tsx           # Корневой layout
  components/            # UI-компоненты сайта и админки
  lib/
    auth.ts              # Сессии, проверка паролей
    session-token.ts     # HMAC-токены (используются proxy)
    auth-context.tsx     # Клиентский контекст авторизации
    admin-data.ts        # Периоды, агрегации для дашбордов
    catalog.ts           # Логика каталогов
  proxy.ts               # Защита приватных маршрутов (/profile и др.)
```

## Роли и доступ

| Маршрут | Доступ |
| --- | --- |
| `/` и каталоги | Все |
| `/login`, `/register` | Все |
| `/profile` и будущие личные кабинеты | Только авторизованные (proxy) |
| `/admin` | Только админ и партнёры |
| `/api/admin/*` | Только админ и партнёры (401 иначе) |
| `/api/auth/*` | Публичные (с rate-limit) |
