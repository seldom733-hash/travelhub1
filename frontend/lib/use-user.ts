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
        if (alive) setUser(null);
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
          auth.clear();
          if (alive && typeof window !== "undefined") window.location.href = "/login";
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
