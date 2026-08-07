import type { Metadata } from "next";
import "./globals.css";
import Shell from "@/components/Shell";

export const metadata: Metadata = {
  title: "TravelHub — Phase 1",
  description: "TravelHub Phase 1: Catalog → Order → Booking",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
