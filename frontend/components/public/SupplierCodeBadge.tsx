"use client";

import { t, useLocale } from "@/lib/i18n";

/**
 * Единственная публичная метка продавца: CRM Partner.code.
 * Имя/бренд продавца сюда не передаётся и не рендерится.
 */
export default function SupplierCodeBadge({ code, className }: { code: string | null | undefined; className?: string }) {
  const locale = useLocale();
  if (!code) return null;
  return (
    <p className={className ?? "text-[11px] text-slate-500"}>
      {t("card.supplier_code", locale)}: <span className="font-mono">{code}</span>
    </p>
  );
}
