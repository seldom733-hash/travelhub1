"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  role: string;
  companyName: string | null;
  defaultWorkspace?: string | null;
}

interface AuthContextType {
  user: SessionUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (user: SessionUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Maximum attempts and backoff for transient failures (404/5xx/network).
// We never want a flaky server to silently drop a valid session, so the
// client retries before settling. Only a real 401 is treated as logged out.
const MAX_AUTH_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 500;
const RETRY_MAX_DELAY_MS = 4000;

type AuthCheckResult = "authenticated" | "unauthenticated" | "error";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    // Returns the auth status for a single /api/auth/me request.
    async function checkAuthOnce(): Promise<AuthCheckResult> {
      const res = await fetch("/api/auth/me", { credentials: "include", signal: controller.signal });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user ?? null);
        return "authenticated";
      }
      // A definitive 401 = invalid/expired token → really logged out.
      if (res.status === 401) {
        setUser(null);
        // Best-effort: clear the stale cookie server-side.
        fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
        return "unauthenticated";
      }
      // 404/500/anything else — transient server problem. Do NOT clear the
      // session; the caller will retry.
      return "error";
    }

    async function checkAuth() {
      try {
        for (let attempt = 0; attempt < MAX_AUTH_RETRIES; attempt++) {
          try {
            const result = await checkAuthOnce();
            if (cancelled) return;
            if (result !== "error") return; // authenticated or definitively logged out
          } catch (err) {
            if (cancelled) return;
            if (err instanceof DOMException && err.name === "AbortError") return;
            // Network failure — treated the same as a transient server error.
          }

          // Retry with exponential backoff (1s, 2s, 4s, ... capped at 16s).
          const isLastAttempt = attempt === MAX_AUTH_RETRIES - 1;
          if (isLastAttempt) break;
          const delay = Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS);
          await new Promise((resolve) => setTimeout(resolve, delay));
          if (cancelled) return;
        }

        // All retries exhausted and the server never confirmed a 401.
        // Settle without clearing the cookie: user stays null on screen, but
        // the next page load will re-check and restore the session.
        setUser(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    checkAuth();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const login = (newUser: SessionUser) => {
    setUser(newUser);
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // ignore error
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
