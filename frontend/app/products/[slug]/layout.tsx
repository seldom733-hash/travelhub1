import type { ReactNode } from "react";
import PublicLayout from "@/components/PublicLayout";

/**
 * Витринный chrome для карточки товара живёт в LAYOUT, а не в page.tsx.
 *
 * Так шапка/футер/категории не пересоздаются на каждом шаге навигации:
 * раньше `<PublicLayout>` был внутри page.tsx, поэтому каждый переход
 * (в т.ч. показ loading-состояния → контент) разбирал и собирал chrome
 * заново вместе с повторным запросом категорий.
 */
export default function ProductLayout({ children }: { children: ReactNode }) {
  return <PublicLayout>{children}</PublicLayout>;
}
