"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import Pagination from "@/components/Pagination";
import { useCan } from "@/lib/use-can";
import { t, useLocale } from "@/lib/i18n";
import {
  hotelMatchingApi,
  type HotelMatchCandidatePage,
  type HotelMatchSide,
  type HotelSupplierRefRow,
} from "@/lib/hotel-matching-api";

const PAGE_SIZE = 20;

function SideCard({
  side,
  label,
}: {
  side: HotelMatchSide;
  label: string;
}) {
  const locale = useLocale();
  const tr = (ru: string, az: string, en: string) => (locale === "az" ? az : locale === "en" ? en : ru);
  return (
    <div className="rounded-lg border border-line bg-panel px-3 py-2 text-xs">
      <div className="text-ink/60">{label}</div>
      <div className="mt-1 font-medium text-ink">{side.name}</div>
      <div className="mt-1 flex flex-wrap gap-1 text-ink/60">
        <span>{side.countryCode || "—"}</span>
        <span>·</span>
        <span>{side.cityName || "—"}</span>
        {side.stars != null && <span>· {side.stars}*</span>}
      </div>
      <div className="mt-1 text-ink/60">
        {tr("Ссылок", "Keçid", "Refs")}: {side.refCount} · {side.suppliers.join(", ") || "—"}
      </div>
      <div className="mt-0.5 font-mono text-[10px] text-ink/40">{side.id}</div>
    </div>
  );
}

function RefsList({
  refs,
  onSplit,
  busy,
  canWrite,
}: {
  refs: HotelSupplierRefRow[];
  onSplit: (id: string) => void;
  busy: string;
  canWrite: boolean;
}) {
  const locale = useLocale();
  const tr = (ru: string, az: string, en: string) => (locale === "az" ? az : locale === "en" ? en : ru);
  if (refs.length === 0) return <div className="text-xs text-ink/60">{tr("Нет привязок", "Keçid yoxdur", "No refs")}</div>;
  return (
    <ul className="divide-y divide-line">
      {refs.map((ref) => (
        <li key={ref.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
          <div className="min-w-0">
            <span className="font-mono text-brand">{ref.supplierCode}</span>
            <span className="mx-1.5 text-ink/40">/</span>
            <span className="font-mono text-ink">{ref.externalKey}</span>
            <div className="truncate text-ink/60">{ref.name}</div>
          </div>
          <button
            type="button"
            disabled={!canWrite || busy === ref.id}
            onClick={() => onSplit(ref.id)}
            className="rounded border border-line px-2 py-1 text-xs text-ink/70 hover:bg-white disabled:opacity-40"
            aria-label={tr("Разделить", "Ayır", "Split")}
          >
            {busy === ref.id ? "…" : tr("Разделить", "Ayır", "Split")}
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function HotelMatchingPage() {
  const locale = useLocale();
  const tr = (ru: string, az: string, en: string) => (locale === "az" ? az : locale === "en" ? en : ru);
  const canWrite = useCan("catalog.product.write");

  const [page, setPage] = useState(1);
  const [data, setData] = useState<HotelMatchCandidatePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [refs, setRefs] = useState<Record<string, HotelSupplierRefRow[]>>({});

  const load = useCallback(async (target: number) => {
    setLoading(true);
    setError("");
    try {
      const result = await hotelMatchingApi.candidates(PAGE_SIZE, (target - 1) * PAGE_SIZE);
      setData(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(page);
  }, [load, page]);

  const toggleRefs = useCallback(async (key: string, hotelA: string, hotelB: string) => {
    if (openKey === key) {
      setOpenKey(null);
      return;
    }
    setOpenKey(key);
    setBusy("evidence");
    try {
      const [a, b] = await Promise.all([hotelMatchingApi.refs(hotelA), hotelMatchingApi.refs(hotelB)]);
      setRefs((prev) => ({ ...prev, [hotelA]: a.refs, [hotelB]: b.refs }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }, [openKey]);

  const afterMutation = useCallback(async (result: { ok: boolean; message: string }) => {
    setNotice(result.message);
    if (result.ok) {
      setOpenKey(null);
      await load(page);
    }
  }, [load, page]);

  const merge = useCallback(async (canonicalId: string, duplicateId: string) => {
    setBusy(duplicateId);
    try {
      await afterMutation(await hotelMatchingApi.merge(canonicalId, duplicateId));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }, [afterMutation]);

  const split = useCallback(async (refId: string) => {
    setBusy(refId);
    try {
      await afterMutation(await hotelMatchingApi.split(refId));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }, [afterMutation]);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={t("nav.hotel_matching", locale)}
        breadcrumbs={["TravelHub", t("nav.catalog", locale), t("nav.hotel_matching", locale)]}
        actions={
          <Link
            href="/app/catalog"
            className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink/60 hover:bg-panel"
          >
            ← {t("crm.back_to_list", locale)}
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <p className="mb-4 text-xs text-ink/60">
          {tr(
            "Кандидаты — только похожие названия в одном городе. Объединять можно только после проверки привязок: совпадение имени не доказывает, что это один отель.",
            "Namə uyğunluq şəhər daxilində yoxlanılır. Birləşdirmədən əvvəl keçidləri yoxlayın: adın oxşarlığı eyni oteli sübut etmir.",
            "Candidates are name similarities within one city. Review refs before merging: a matching name does not prove the same hotel.",
          )}
        </p>

        {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>}
        {notice && <div className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700">{notice}</div>}

        {loading && <div className="text-sm text-ink/60">{t("crm.loading", locale)}</div>}

        {!loading && data && (
          <>
            {data.items.length === 0 && (
              <div className="rounded-lg border border-line bg-white p-6 text-sm text-ink/60">
                {tr("Кандидатов нет", "Namizəd yoxdur", "No candidates")}
              </div>
            )}

            <div className="space-y-3">
              {data.items.map((item, index) => {
                const key = `${item.hotelA.id}|${item.hotelB.id}`;
                const expanded = openKey === key;
                return (
                  <div key={key} className="rounded-xl border border-line bg-white p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs text-ink/60">
                        {tr("Сходство", "Oxşarlıq", "Similarity")}: {(item.similarity * 100).toFixed(0)}% · {item.reason}
                      </div>
                      <button
                        type="button"
                        onClick={() => void toggleRefs(key, item.hotelA.id, item.hotelB.id)}
                        aria-expanded={expanded}
                        className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-panel"
                      >
                        {expanded ? tr("Скрыть привязки", "Keçidləri gizlət", "Hide refs") : tr("Проверить привязки", "Keçidləri yoxla", "Review refs")}
                      </button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <SideCard side={item.hotelA} label={tr("Отель A", "Otel A", "Hotel A")} />
                      <SideCard side={item.hotelB} label={tr("Отель B", "Otel B", "Hotel B")} />
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={!canWrite || busy !== ""}
                        onClick={() => void merge(item.hotelA.id, item.hotelB.id)}
                        className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-40"
                      >
                        {busy === item.hotelB.id ? "…" : tr("Оставить A, слить B", "A saxla, B birləşdir", "Keep A, merge B")}
                      </button>
                      <button
                        type="button"
                        disabled={!canWrite || busy !== ""}
                        onClick={() => void merge(item.hotelB.id, item.hotelA.id)}
                        className="rounded-lg border border-brand/30 bg-brand/5 px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand/10 disabled:opacity-40"
                      >
                        {busy === item.hotelA.id ? "…" : tr("Оставить B, слить A", "B saxla, A birləşdir", "Keep B, merge A")}
                      </button>
                      {!canWrite && (
                        <span className="self-center text-xs text-ink/50">
                          {tr("Нет прав на изменение", "Dəyişiklik icazəsi yoxdur", "No write permission")}
                        </span>
                      )}
                    </div>

                    {expanded && (
                      <div className="mt-4 grid gap-4 border-t border-line pt-3 sm:grid-cols-2">
                        <div>
                          <div className="mb-1 text-xs font-semibold text-ink">{tr("Привязки A", "A keçidləri", "Refs of A")}</div>
                          {busy === "evidence" ? (
                            <div className="text-xs text-ink/60">{t("crm.loading", locale)}</div>
                          ) : (
                            <RefsList refs={refs[item.hotelA.id] ?? []} onSplit={(id) => void split(id)} busy={busy} canWrite={canWrite} />
                          )}
                        </div>
                        <div>
                          <div className="mb-1 text-xs font-semibold text-ink">{tr("Привязки B", "B keçidləri", "Refs of B")}</div>
                          {busy === "evidence" ? (
                            <div className="text-xs text-ink/60">{t("crm.loading", locale)}</div>
                          ) : (
                            <RefsList refs={refs[item.hotelB.id] ?? []} onSplit={(id) => void split(id)} busy={busy} canWrite={canWrite} />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4">
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                total={data.total}
                locale={locale}
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
