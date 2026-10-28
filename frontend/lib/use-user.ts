"use client";

import { useEffect, useRef, useState } from "react";
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
export function useCurrentUserStatus(): { user: AuthUser | null; ready: boolean } {
  const [user, setUser] = useState<AuthUser | null>(cached?.user ?? null);
  const [ready, setReady] = useState(cached !== null);
  const resolvedToken = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;

    const load = () => {
      const token = auth.token;
      if (cached && cached.token === token) {
        if (alive) {
          resolvedToken.current = token;
          setUser(cached.user);
          setReady(true);
        }
        return;
      }
      // Only hide the CTA when the session token actually changed; a periodic
      // focus/interval revalidation must not make a guest CTA blink.
      if (alive && resolvedToken.current !== token) setReady(false);
      fetchSessionUser()
        .then((u) => {
          cached = { token, user: u };
          resolvedToken.current = token;
          if (!alive) return;
          setUser(u);
          setReady(true);
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
          // mount/смена токена повторит пробу. Для UI считаем сессию проверенной,
          // чтобы не прятать гостевые CTA навсегда при недоступном backend.
          if (alive) {
            resolvedToken.current = token;
            setReady(true);
          }
        });
    };

    load();
    const unsubscribe = auth.subscribe(load);
    // Role/permission changes are authoritative in the DB and enforced on every
    // backend request. For the UI (menus/buttons) revalidate on focus and at a
    // bounded interval, so an already-open session cannot keep stale menus.
    const refresh = () => {
      cached = null;
      load();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibility);
    const interval = window.setInterval(refresh, 60_000);
    return () => {
      alive = false;
      unsubscribe();
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(interval);
    };
  }, []);

  return { user, ready };
}

/** Backward-compatible hook for components that only need the user. */
export function useCurrentUser(): AuthUser | null {
  return useCurrentUserStatus().user;
}
