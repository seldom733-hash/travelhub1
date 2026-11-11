"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { t, useLocale } from "@/lib/i18n";

interface NotificationRow {
  id: string;
  type: string;
  entityType: string;
  entityId: string;
  title: string;
  body: string | null;
  payload: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

interface NotificationsResponse {
  items: NotificationRow[];
  total: number;
  unread: number;
}

export default function AccountNotificationsPage() {
  const locale = useLocale();
  const [data, setData] = useState<NotificationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [decisionBusy, setDecisionBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await api.get<NotificationsResponse>("/account/notifications?pageSize=50"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const markRead = async (row: NotificationRow) => {
    if (row.readAt) return;
    try {
      await api.patch(`/account/notifications/${row.id}/read`, {});
      window.dispatchEvent(new Event("account-notifications-updated"));
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const markAll = async () => {
    try {
      await api.patch("/account/notifications/read-all", {});
      window.dispatchEvent(new Event("account-notifications-updated"));
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const decide = async (row: NotificationRow, decision: "ACCEPT" | "DECLINE") => {
    const requestId = String(row.payload?.requestId ?? row.entityId ?? "");
    if (!requestId) return;
    setDecisionBusy(row.id);
    setError("");
    try {
      await api.post(`/account/requests/${requestId}/decision`, { decision });
      await api.patch(`/account/notifications/${row.id}/read`, {});
      window.dispatchEvent(new Event("account-notifications-updated"));
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDecisionBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("account.notifications", locale)}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Изменения цены, статусов заявок и другие события по вашим обращениям.
          </p>
        </div>
        {data && data.unread > 0 && (
          <button type="button" onClick={() => void markAll()} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">
            Прочитать все
          </button>
        )}
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}

      {loading && !data && <div className="text-sm text-slate-400">Загрузка…</div>}

      {data && data.items.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Уведомлений пока нет.
        </div>
      )}

      <div className="space-y-2">
        {data?.items.map((row) => {
          const pricePayload = row.type.startsWith("REQUEST_PRICE_") ? row.payload : null;
          const actionable = row.type === "REQUEST_PRICE_CHANGED" || row.type === "REQUEST_PRICE_CONFIRMED";
          return (
            <div
              key={row.id}
              role="button"
              tabIndex={0}
              onClick={() => void markRead(row)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") void markRead(row); }}
              className={`block w-full rounded-xl border p-4 text-left transition-colors ${
                row.readAt ? "border-slate-200 bg-white" : "border-blue-200 bg-blue-50/60 hover:bg-blue-50"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {!row.readAt && <span className="size-2 rounded-full bg-blue-600" aria-label="Непрочитано" />}
                    <div className="font-semibold text-slate-900">{row.title}</div>
                  </div>
                  {row.body && <div className="mt-1 text-sm text-slate-600">{row.body}</div>}
                  {pricePayload && (
                    <div className="mt-2 flex items-center gap-2 text-sm">
                      <span className="text-slate-400 line-through">{String(pricePayload.oldPrice ?? "—")}</span>
                      <span className="text-slate-400">→</span>
                      <span className="font-semibold text-emerald-700">
                        {String(pricePayload.newPrice ?? "—")} {String(pricePayload.currency ?? "")}
                      </span>
                    </div>
                  )}
                </div>
                <span className="shrink-0 text-xs text-slate-400">
                  {new Date(row.createdAt).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}
                </span>
              </div>
              {actionable && (
                <div className="mt-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    disabled={decisionBusy === row.id}
                    onClick={() => void decide(row, "ACCEPT")}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Подтвердить
                  </button>
                  <button
                    type="button"
                    disabled={decisionBusy === row.id}
                    onClick={() => void decide(row, "DECLINE")}
                    className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-50"
                  >
                    Отказаться
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
