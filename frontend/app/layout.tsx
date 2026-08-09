import type { Metadata } from "next";
import "./globals.css";
import { LocaleProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "TravelHub — Marketplace",
  description: "TravelHub: каталог туристических услуг. Marketplace + внутренние рабочие центры.",
};

/**
 * PHASE 1 STEP 1.6 — корневой layout БЕЗ внутреннего Shell.
 *   /        → Public Marketplace (PublicLayout в каждой public-странице)
 *   /app/*   → InternalAppLayout (app/app/layout.tsx, Shell с auth/RBAC)
 *   /login   → standalone (auth entry)
 * LocaleProvider (Step 1.7 §17) оборачивает всё приложение: RU/AZ/EN состояние
 * + синхронизация <html lang>. Internal sidebar не попадает в public bundle.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
