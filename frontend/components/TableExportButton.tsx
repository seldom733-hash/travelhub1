"use client";

import { useState } from "react";
import { useLocale, t } from "@/lib/i18n";

interface TableExportButtonProps {
  /** URL to the export endpoint (e.g., /api/v1/orders/export) */
  exportUrl: string;
  /** Extra query params to include (filters, period, etc.) */
  extraParams?: Record<string, string>;
  /** Optional label override */
  label?: string;
  /** Button size */
  size?: "sm" | "md";
}

export default function TableExportButton({
  exportUrl,
  extraParams = {},
  label,
  size = "sm",
}: TableExportButtonProps) {
  const locale = useLocale();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doExport = async (format: "csv" | "xlsx") => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL(exportUrl, window.location.origin);
      for (const [k, v] of Object.entries(extraParams)) {
        if (v !== undefined && v !== null && v !== "") {
          url.searchParams.set(k, v);
        }
      }
      url.searchParams.set("format", format);

      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Export failed (${res.status})`);
      }

      const blob = await res.blob();
      const ext = format === "csv" ? "csv" : "xlsx";
      const mime =
        format === "csv"
          ? "text/csv; charset=utf-8"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([blob], { type: mime }));
      a.download = `export.${ext}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const btnBase =
    size === "sm"
      ? "rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
      : "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50";

  return (
    <span className="inline-flex items-center gap-1 relative group">
      <button
        onClick={() => doExport("csv")}
        disabled={loading}
        className={btnBase}
        title={t("export.csv", locale)}
      >
        {loading ? "…" : "CSV"}
      </button>
      <button
        onClick={() => doExport("xlsx")}
        disabled={loading}
        className={btnBase}
        title={t("export.xlsx", locale)}
      >
        {loading ? "…" : "XLSX"}
      </button>
      {error && (
        <span className="absolute -bottom-6 left-0 text-[10px] text-red-500 whitespace-nowrap z-10">
          {error}
        </span>
      )}
    </span>
  );
}
