import Shell from "@/components/Shell";

/**
 * PHASE 1 STEP 1.6 — InternalAppLayout (route layout для /app/*).
 *
 * Все внутренние employee Work Centers живут под /app/*. Layout рендерит
 * внутренний Shell (sidebar, auth guard, RBAC-навигация, logout). Public bundle
 * не содержит Shell — он импортируется только здесь (§13/§22).
 *
 * Security-границы:
 *   - middleware.ts: anonymous → /login (server-side, §10);
 *   - Shell: отсутствие token → /login (client, defense in depth);
 *   - Shell: внешние роли (PARTNER/BUYER) → витрина (не employee Work Centers, §11);
 *   - Shell: маршрут без права → /app/dashboard (UX; backend остаётся авторитетным).
 */
export default function InternalAppLayout({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>;
}
