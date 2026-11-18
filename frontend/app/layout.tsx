import type { Metadata } from "next";
import "./globals.css";
import { LocaleProvider } from "@/lib/i18n";
import DateInputFormat from "@/components/DateInputFormat";

// Build environments without access to fonts.gstatic.com must not fail.
// The display/body stacks are declared in globals.css and fall back to the
// system fonts when Manrope/Playfair are not installed.

export const metadata: Metadata = {
  title: "Navitravel — Marketplace",
  description: "Navitravel: каталог туристических услуг. Marketplace + внутренние рабочие центры.",
};

/**
 * Root layout without an internal shell:
 *   /      → public marketplace
 *   /app/* → internal app shell (auth/RBAC)
 *   /login → standalone auth entry
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="az">
      <body>
        <LocaleProvider>{children}</LocaleProvider>
        <DateInputFormat />
      </body>
    </html>
  );
}
