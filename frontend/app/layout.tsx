import type { Metadata } from "next";
import { Onest, Unbounded } from "next/font/google";
import "./globals.css";
import { LocaleProvider } from "@/lib/i18n";

const bodyFont = Onest({
  subsets: ["latin", "cyrillic"],
  variable: "--font-body",
  display: "swap",
});

const displayFont = Unbounded({
  subsets: ["latin", "cyrillic"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

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
    <html lang="az" className={`${bodyFont.variable} ${displayFont.variable}`}>
      <body>
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
