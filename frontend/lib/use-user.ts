"use client";

import { useEffect, useState } from "react";
import { api, auth, type AuthUser } from "./api";

/** Модульный кэш: несколько компонентов разделяют один запрос /auth/me. */
let cached: { token: string; user: AuthUser } | null = null;

/**
 * Текущий пользователь + его актуальные права.
 * Реактивен к смене токена (login/logout): подписка на auth.subscribe.
 */
export function useCurrentUser(): AuthUser | null {
  const [user, setUser] = useState<AuthUser | null>(cached?.user ?? null);

  useEffect(() => {
    let alive = true;

    const load = () => {
      const token = auth.token;
      if (!token) {
        // Сброс кэша: logout не должен оставлять stale-пользователя, который
        // может мелькнуть при следующем mount (до повторного логина).
        cached = null;
        if (alive) {
          setUser(null);
          // Safety net для защищённых контуров (/app/*, /partner/*, /account/* —
          // Step 1.9): серверный middleware перехватывает anonymous, но если
          // localStorage очищен, а cookie осталась (или middleware не сработал),
          // не оставляем страницу в вечной заглушке — уводим на /login с
          // deep-link. Публичные страницы (/) НЕ трогаем — anonymous-визит
          // должен оставаться на витрине.
          const path = window.location.pathname + window.location.search;
          if (path.startsWith("/app") || path.startsWith("/partner") || path.startsWith("/account")) {
            window.location.href = `/login?next=${encodeURIComponent(path)}`;
          }
        }
        return;
      }
      if (cached?.token === token) {
        if (alive) setUser(cached.user);
        return;
      }
      api
        .get<AuthUser>("/auth/me")
        .then((u) => {
          cached = { token, user: u };
          if (alive) setUser(u);
        })
        .catch(() => {
          // 401 (реальная потеря сессии) уже обрабатывается в api.handle():
          // auth.clear() + редирект на /login с deep-link ?next=; подписка
          // auth.subscribe(load) затем сходится к token=null → setUser(null).
          // Сюда доходят только сетевые сбои: abort fetch при навигации, offline,
          // временный сбой сервера. Они НЕ означают конец сессии — разлогинивать
          // валидного пользователя при переходе между страницами нельзя (иначе
          // любая навигация во время in-flight /auth/me стирает токен). Состояние
          // НЕ трогаем: держим последнего известного пользователя, следующий
          // вызов /auth/me (mount/смена токена) повторит запрос.
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
