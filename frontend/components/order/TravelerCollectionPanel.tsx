"use client";

/**
 * PHASE 3 PRE-STEP 3.12 D3 — Traveler Collection Panel (Order Center).
 *
 * Собирает данные туристов заказа СТРОГО по pinned requirements snapshot
 * (immutable после termsAcceptedAt — НЕ по текущей Product policy):
 *  - REQUIRED      → видимое + обязательное поле;
 *  - OPTIONAL      → видимое опциональное поле (валидируется формат дат);
 *  - NOT_REQUESTED → НЕ рендерится (минимизация §9 — не запрашиваем/не храним).
 * Traveler 1..N; каждая форма читается/пишется на сервер (PATCH per traveler),
 * поэтому save → refresh → resume работает (данные не только в React state, §13).
 * Финальное подтверждение: validate-completion → final-confirm (server gates:
 * count + REQUIRED + travelerDataCompletedAt + idempotent CAS, §10/§17/§19).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { ti, t, useLocale } from "@/lib/i18n";
import { useCan } from "@/lib/use-can";

export interface TravelerCollectionView {
  pinnedRequirements: Record<string, string> | null;
  termsAcceptedAt: string | null;
  travelerDataCompletedAt: string | null;
  finalConfirmedAt: string | null;
  travelerCount: number | null;
  travelers: Array<{
    id: string;
    firstName: string;
    lastName: string;
    birthDate: string | null;
    citizenship: string | null;
    gender: string | null;
    passportNumber: string | null;
    passportExpiry: string | null;
    dataCompleteness: string;
  }>;
}

/** Канонический порядок полей (совпадает с backend TRAVELER_FIELDS). */
const FIELD_ORDER = ["firstName", "lastName", "birthDate", "citizenship", "gender", "passportNumber", "passportExpiry"] as const;
type Field = (typeof FIELD_ORDER)[number];

const DATE_FIELDS: Field[] = ["birthDate", "passportExpiry"];

function toDateInput(value: string | null): string {
  if (!value) return "";
  return value.slice(0, 10);
}

function fmtTs(value: string | null, locale: "ru" | "az" | "en"): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(locale === "ru" ? "ru-RU" : locale === "az" ? "az-AZ" : "en-US");
}

export default function TravelerCollectionPanel({ orderId }: { orderId: string }) {
  const locale = useLocale();
  const canEdit = useCan("order.edit_noncritical");

  const [view, setView] = useState<TravelerCollectionView | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // Значения форм (server-seeded; business state живёт на сервере — PATCH).
  const [drafts, setDrafts] = useState<Record<string, Partial<Record<Field, string>>>>({});

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError("");
      const data = await api.get<TravelerCollectionView>(`/orders/${orderId}/travelers`);
      setView(data);
      // Resume: первичный seed форм из server-данных (refresh → данные на месте).
      const seed: Record<string, Partial<Record<Field, string>>> = {};
      for (const tr of data.travelers) {
        seed[tr.id] = {
          firstName: tr.firstName ?? "",
          lastName: tr.lastName ?? "",
          birthDate: toDateInput(tr.birthDate),
          citizenship: tr.citizenship ?? "",
          gender: tr.gender ?? "",
          passportNumber: tr.passportNumber ?? "",
          passportExpiry: toDateInput(tr.passportExpiry),
        };
      }
      setDrafts(seed);
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const pinned = view?.pinnedRequirements ?? null;
  const travelers = view?.travelers ?? [];
  const locked = Boolean(view?.finalConfirmedAt);

  const fieldsFor = useMemo(() => {
    if (!pinned) return [];
    return FIELD_ORDER.filter((f) => (pinned[f] ?? "NOT_REQUESTED") !== "NOT_REQUESTED");
  }, [pinned]);

  const isDirty = (travelerId: string): boolean => {
    const draft = drafts[travelerId];
    if (!draft) return false;
    const server = view?.travelers.find((x) => x.id === travelerId);
    if (!server) return false;
    return FIELD_ORDER.some((f) => {
      const current = draft[f] ?? "";
      const stored = f === "birthDate" || f === "passportExpiry" ? toDateInput(server[f]) : server[f] ?? "";
      return current !== stored;
    });
  };

  const saveTraveler = async (travelerId: string) => {
    const draft = drafts[travelerId] ?? {};
    setBusyKey(travelerId);
    setNotice("");
    setError("");
    try {
      // PATCH передаёт ТОЛЬКО изменённые поля (partial save; NOT_REQUESTED
      // отбрасываются сервером).
      const body: Record<string, string> = {};
      for (const f of fieldsFor) {
        const v = draft[f]?.trim() ?? "";
        if (DATE_FIELDS.includes(f) && !v) continue; // пустая дата — пропуск (сброс серверу не нужен)
        body[f] = v;
      }
      await api.patch(`/orders/${orderId}/travelers/${travelerId}`, body);
      setNotice(t("d3.saved_hint", locale));
      await load();
    } catch (e) {
      setError(ti("d3.save_failed", locale, { msg: (e as Error).message }));
    } finally {
      setBusyKey(null);
    }
  };

  const finalConfirm = async () => {
    setBusyKey("confirm");
    setNotice("");
    setError("");
    try {
      const completion = await api.post<{ complete: boolean; reason: string | null }>(`/orders/${orderId}/validate-completion`);
      if (!completion.complete) {
        setError(t("d3.confirm_error", locale) + (completion.reason ? `: ${completion.reason}` : ""));
        return;
      }
      await api.post<{ orderId: string; finalConfirmedAt: string }>(`/orders/${orderId}/final-confirm`);
      setNotice(t("d3.confirmed_ok", locale));
      await load();
    } catch (e) {
      setError(t("d3.confirm_error", locale) + `: ${(e as Error).message}`);
    } finally {
      setBusyKey(null);
    }
  };

  if (loading) {
    return <div className="text-sm text-slate-400">{t("common.loading", locale)}</div>;
  }
  if (loadError || !view) {
    return <div className="text-sm text-red-500">{loadError || t("d3.load_failed", locale)}</div>;
  }
  if (!pinned) {
    return (
      <div className="rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-500">{t("d3.legacy_no_pinned", locale)}</div>
    );
  }

  const travelerCount = view.travelerCount ?? travelers.length;

  return (
    <div className="space-y-4">
      {/* ── D3 milestones (server-owned; не updatedAt) ── */}
      <div className="grid grid-cols-3 gap-3 text-[11px]">
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <div className="text-slate-400">{t("d3.terms_accepted_at", locale)}</div>
          <div className="mt-0.5 font-medium text-slate-700">{fmtTs(view.termsAcceptedAt, locale)}</div>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <div className="text-slate-400">{t("d3.data_completed_at", locale)}</div>
          <div className="mt-0.5 font-medium text-slate-700">{fmtTs(view.travelerDataCompletedAt, locale)}</div>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <div className="text-slate-400">{t("d3.final_confirmed_at", locale)}</div>
          <div className={`mt-0.5 font-medium ${locked ? "text-emerald-700" : "text-slate-700"}`}>{fmtTs(view.finalConfirmedAt, locale)}</div>
        </div>
      </div>

      {notice && <div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{notice}</div>}
      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
      {locked && <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">{t("d3.locked", locale)}</div>}
      {!canEdit && !locked && (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">{t("d3.need_edit_permission", locale)}</div>
      )}

      {travelers.length === 0 ? (
        <div className="rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-500">
          {t("d3.no_travelers", locale)} · {ti("d3.expected_count", locale, { n: travelerCount })}
        </div>
      ) : (
        <div className="space-y-3">
          {travelers.map((tr, idx) => {
            const draft = drafts[tr.id] ?? {};
            const dirty = isDirty(tr.id);
            const complete = tr.dataCompleteness === "COMPLETE";
            return (
              <div key={tr.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-800">
                    {ti("d3.traveler_of", locale, { n: idx + 1, total: travelers.length })}
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                      complete ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {complete ? t("d3.complete_badge", locale) : t("d3.incomplete_badge", locale)}
                  </span>
                </div>
                <div className="mt-3 grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                  {fieldsFor.map((f) => {
                    const state = pinned[f];
                    const required = state === "REQUIRED";
                    const label = t(`d3.field.${f}`, locale);
                    const isDate = DATE_FIELDS.includes(f);
                    return (
                      <label key={f} className="block text-xs">
                        <span className="mb-1 flex items-center gap-1 text-slate-500">
                          {label}
                          {required && <span className="text-red-500">*</span>}
                          {!required && <span className="font-normal text-slate-300">({t("d3.optional", locale)})</span>}
                        </span>
                        <input
                          type={isDate ? "date" : "text"}
                          disabled={locked || !canEdit}
                          value={draft[f] ?? ""}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [tr.id]: { ...(prev[tr.id] ?? {}), [f]: e.target.value },
                            }))
                          }
                          className={`w-full rounded-md border px-2.5 py-1.5 text-sm outline-none disabled:bg-slate-50 disabled:text-slate-400 ${
                            dirty ? "border-blue-300 focus:border-blue-400" : "border-slate-200 focus:border-slate-300"
                          }`}
                        />
                      </label>
                    );
                  })}
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    disabled={locked || !canEdit || busyKey !== null}
                    onClick={() => void saveTraveler(tr.id)}
                    className="rounded-lg bg-slate-800 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {busyKey === tr.id ? t("d3.saving", locale) : t("d3.save", locale)}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Final confirmation (gate: server-side completion) ── */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-800">{t("d3.final_confirm", locale)}</div>
            <div className="mt-0.5 text-xs text-slate-400">{t("d3.final_confirm_hint", locale)}</div>
          </div>
          <button
            type="button"
            disabled={locked || !canEdit || busyKey !== null || travelers.length === 0}
            onClick={() => void finalConfirm()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busyKey === "confirm" ? t("d3.confirming", locale) : t("d3.final_confirm", locale)}
          </button>
        </div>
      </div>
    </div>
  );
}