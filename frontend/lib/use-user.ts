"use client";

import { useEffect, useState } from "react";
import { auth, fetchSessionUser, type AuthUser } from "./api";

/**
 * Модульный кэш: несколько компонентов разделяют одну сессионную пробу.
 * Ключ кэша — in-memory токен (null для cookie-сессии): при cookie-аутентификации
 * (после refresh in-memory пуст, но HttpOnly cookie есть) проба /auth/session
 * всегда выполняется на mount — сервер сам решает по cookie.
 */
let cached: { token: string | null; user: AuthUser | null } | null = null;

/**
 * Текущий пользователь + его актуальные права.
 *
 * Step 2.17: источник истины — GET /auth/session (cookie-аутентификация),
 * НЕ localStorage. Реактивен к смене сессии (login/logout): подписка на
 * auth.subscribe. Сетевые сбои (abort/offline) НЕ разлогинивают — держим
 * последнего известного пользователя (AbortError-регрессия не возвращается).
 */
export function useCurrentUser(): AuthUser | null {
  const [user, setUser] = useState<AuthUser | null>(cached?.user ?? null);

  useEffect(() => {
    let alive = true;

    const load = () => {
      const token = auth.token;
      if (cached && cached.token === token) {
        if (alive) setUser(cached.user);
        return;
      }
      fetchSessionUser()
        .then((u) => {
          cached = { token, user: u };
          if (!alive) return;
          setUser(u);
          // Safety net для защищённых контуров (/app/*, /partner/*, /account/*):
          // серверный proxy.ts перехватывает anonymous по отсутствию cookie, но
          // если cookie есть, а сессия недействительна (revoked/expired), уводим
          // на /login с deep-link. Публичные страницы НЕ трогаем — anonymous-
          // визит должен оставаться на витрине.
          if (!u) {
            const path = window.location.pathname + window.location.search;
            if (path.startsWith("/app") || path.startsWith("/partner") || path.startsWith("/account")) {
              window.location.href = `/login?next=${encodeURIComponent(path)}`;
            }
          }
        })
        .catch(() => {
          // Только сетевые сбои (abort/offline). Не разлогиниваем: следующий
          // mount/смена токена повторит пробу.
        });
    };

    load();
    const unsubscribe = auth.subscribe(load);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  return user;
}
