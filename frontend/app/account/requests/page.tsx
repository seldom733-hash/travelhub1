"use client";

import { useEffect, useState } from "react";
import { accountApi, type OwnRequestsResult } from "@/lib/account-api";
import { t, useLocale, formatPrice } from "@/lib/i18n";

export default function AccountRequestsPage() {
  const locale = useLocale();
  const [data, setData] = useState<OwnRequestsResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    accountApi
      .getRequests({ pageSize: 50 })
      .then((r) => { if (alive) setData(r); })
      .catch((e: Error) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t("crm.detail.requests", locale)}</h1>
        <p className="mt-1 text-sm text-slate-500">Заявки до создания заказа. Если платформа изменила цену, показана старая и новая цена.</p>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}
      {!data && !error && <div className="text-sm text-slate-400">Загрузка…</div>}
      {data && data.items.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Заявок пока нет.</div>
      )}

      <div className="space-y-2">
        {data?.items.map((r) => (
          <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-mono text-xs text-blue-600">{r.referenceNumber}</div>
                <div className="mt-1 font-semibold text-slate-900">{r.serviceTitle || "—"}</div>
                <div className="mt-1 text-xs text-slate-500">{r.code} · {new Date(r.createdAt).toLocaleDateString("ru-RU")}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">Цена</div>
                {r.priceChanged ? (
                  <div className="mt-1 flex items-center justify-end gap-2">
                    <span className="text-sm text-slate-400 line-through">{formatPrice(r.oldPrice, r.currency, locale) ?? "—"}</span>
                    <span className="text-base font-bold text-emerald-700">{formatPrice(r.newPrice, r.currency, locale) ?? "—"}</span>
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">Цена изменена</span>
                  </div>
                ) : (
                  <div className="mt-1 text-base font-bold text-slate-800">{formatPrice(r.newPrice ?? r.oldPrice, r.currency, locale) ?? "—"}</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
