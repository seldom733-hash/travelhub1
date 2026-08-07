import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import GlobalErrorHandler from "@/components/GlobalErrorHandler";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TravelHub — путешествия по всему миру",
  description:
    "Единая платформа для путешествий: туры, отели, санатории, авиабилеты, экскурсии, гиды, фотографы и трансферы. Забронируйте путешествие мечты в несколько кликов.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        {/* Ловит непойманные JS-ошибки (window.onerror / unhandledrejection) и показывает тост */}
        <GlobalErrorHandler />
      </body>
    </html>
  );
}
