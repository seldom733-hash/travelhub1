# CTA «Для партнёров»: только для гостя

Дата: 2026-10-27.

## Правило

- **Гость** (`user === null` после проверки сессии) видит «Для партнёров» в
  desktop/mobile меню и «Стать партнёром» в footer.
- **Авторизованный BUYER / PARTNER / ADMIN** не видит партнёрский CTA; справа
  отображается действие его роли: личный кабинет / партнёрский кабинет /
  рабочее место.
- До завершения проверки сессии CTA скрыт, чтобы не мигал у авторизованного
  пользователя.

## Реализация

- `useCurrentUserStatus()` в `frontend/lib/use-user.ts` — возвращает
  `{ user, ready }`; `ready=false`, пока `/auth/session` не ответил.
  `useCurrentUser()` оставлен как обратно совместимый wrapper.
- `MarketplaceHeader`:
  - desktop: `userReady && user === null`;
  - mobile: то же условие.
- `MarketplaceFooter`: ссылка `/become-a-partner` скрывается, если
  `ready && user !== null`.
- `PublicLayout` (отдельный публичный header для `/register`, `/products`,
  `/become-a-partner`): та же проверка `userReady && user === null`.
- Страница `/become-a-partner` остаётся публичной по прямому URL; скрытие
  ссылки — навигационное, не security-boundary.

## Проверка

Playwright, главная `/`:

| Пользователь | Header CTA | Footer CTA |
|---|---|---|
| Гость | 1 | 1 |
| PARTNER | 0 | 0 |
| ADMIN | 0 | 0 |

Mobile guest (меню открыто): 1 видимая ссылка.

PublicLayout (`/register`): guest header CTA 1, PARTNER 0.

Сборка frontend — PASS; `tsc --noEmit` — PASS.
