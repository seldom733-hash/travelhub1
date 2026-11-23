"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { useCan } from "@/lib/use-can";
import { useLocale } from "@/lib/i18n";
import { sx } from "@/lib/supplier-labels";
import {
  supplierCatalogApi,
  type SupplierCatalogCapability,
  type SupplierCatalogRun,
  type SupplierCatalogRunItem,
  type SupplierCatalogRunServiceType,
  type PhotoReviewItem,
} from "@/lib/supplier-catalog-api";

const SERVICE_LABEL: Record<string, string> = { tours: "Туры", hotels: "Отели", all: "Все услуги" };
const ACTION_LABEL: Record<string, string> = {
  CREATE: "Новые",
  UPDATE: "Обновления",
  RESTORE: "Восстановления",
  ARCHIVE: "Архивация",
  AMBIGUOUS: "Неоднозначные",
  LEGACY_ARCHIVED: "Старый архив",
  UNCHANGED: "Без изменений",
  ERROR: "Ошибки",
};

function formatDate(value: string | null, locale: string): string {
  if (!value) return "—";
  const tag = locale === "az" ? "az-AZ" : locale === "en" ? "en-GB" : "ru-RU";
  return new Date(value).toLocaleString(tag);
}

function runCountryLabel(run: SupplierCatalogRun, allLabel: string): string {
  if (run.countryCode === "ALL") return allLabel;
  // Country code is the canonical display value in the update report.
  if (run.countryCode) return run.countryCode;
  const scope = run.scope as { sourceScopes?: Array<{ countryLabel?: string }> } | null;
  return scope?.sourceScopes?.find((item) => item.countryLabel)?.countryLabel ?? "—";
}

function errorList(errors: SupplierCatalogRun["errors"]): string[] {
  if (!errors) return [];
  if (Array.isArray(errors)) return errors;
  return errors.fatal ? [errors.fatal] : [];
}

function itemServiceName(item: SupplierCatalogRunItem): string {
  const after = item.after as Record<string, unknown> | null;
  const before = item.before as Record<string, unknown> | null;
  const candidate =
    after?.title ?? after?.hotelName ?? after?.name ??
    before?.title ?? before?.hotelName ?? before?.name;
  return typeof candidate === "string" && candidate.trim() ? candidate : "—";
}

type DiscoveryReport = {
  supplierCode: string;
  serviceType: string;
  discovered: number;
  skipped: number;
  countries: Array<{ key: string; label: string }>;
  added: string[];
  removed: Array<{ key: string; label: string }>;
  at: string;
};

export default function SupplierUpdatesPage() {
  const locale = useLocale();
  const tr = (ru: string, az: string, en: string) => sx(locale, ru, az, en);
  const serviceLabel = (service: string) =>
    service === "tours" ? tr("Туры", "Turlar", "Tours")
      : service === "hotels" ? tr("Отели", "Otellər", "Hotels")
        : service === "all" ? tr("Все услуги", "Bütün xidmətlər", "All services")
          : service;
  const runStatusLabel = (status: string) =>
    status === "COMPLETED" ? tr("Завершён", "Tamamlanıb", "Completed")
      : status === "PARTIAL" ? tr("Частично", "Qismən", "Partial")
        : status === "FAILED" ? tr("Ошибка", "Xəta", "Failed")
          : status === "CANCELLED" ? tr("Отменён", "Ləğv edilib", "Cancelled")
            : status === "PREVIEWING" ? tr("Предпросмотр", "Önbaxış", "Previewing")
              : status === "PREVIEW_READY" ? tr("Готов к применению", "Tətbiqə hazır", "Ready to apply")
                : status === "APPLYING" ? tr("Применяется", "Tətbiq olunur", "Applying")
                  : status;
  const coverageLabel = (coverage: string) =>
    coverage === "COMPLETE" ? tr("Полное", "Tam", "Complete")
      : coverage === "PARTIAL" ? tr("Частичное", "Qismən", "Partial")
        : coverage === "FAILED" ? tr("Ошибка", "Xəta", "Failed")
          : coverage;
  const actionLabel = (action: string) =>
    action === "CREATE" ? tr("Новые", "Yeni", "New")
      : action === "UPDATE" ? tr("Обновления", "Yeniləmələr", "Updates")
        : action === "RESTORE" ? tr("Восстановления", "Bərpalar", "Restores")
          : action === "ARCHIVE" ? tr("Архивация", "Arxivləmə", "Archive")
            : action === "AMBIGUOUS" ? tr("Неоднозначные", "Qeyri-müəyyən", "Ambiguous")
              : action === "LEGACY_ARCHIVED" ? tr("Старый архив", "Köhnə arxiv", "Legacy archive")
                : action === "UNCHANGED" ? tr("Без изменений", "Dəyişiklik yoxdur", "Unchanged")
                  : action === "ERROR" ? tr("Ошибки", "Xətalar", "Errors")
                    : action;
  const canManage = useCan("supplier.search.manage");  const [capabilities, setCapabilities] = useState<SupplierCatalogCapability[]>([]);
  const [loadingCaps, setLoadingCaps] = useState(true);
  const [supplierCode, setSupplierCode] = useState("");
  const [serviceType, setServiceType] = useState<SupplierCatalogRunServiceType>("tours");
  const [countryKey, setCountryKey] = useState("");
  const [run, setRun] = useState<SupplierCatalogRun | null>(null);
  const [runs, setRuns] = useState<SupplierCatalogRun[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [discoveryReport, setDiscoveryReport] = useState<DiscoveryReport | null>(null);
  const [photoReviews, setPhotoReviews] = useState<PhotoReviewItem[]>([]);
  const [photoReviewBusy, setPhotoReviewBusy] = useState<string | null>(null);

  const loadRuns = useCallback(async () => {
    try {
      setRuns(await supplierCatalogApi.runs(30));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  /** Update the visible runs table immediately — без ожидания полной перезагрузки. */
  const upsertRun = useCallback((next: SupplierCatalogRun) => {
    setRuns((current) => [next, ...current.filter((item) => item.id !== next.id)]);
  }, []);

  const loadPhotoReviews = useCallback(async () => {
    try {
      setPhotoReviews(await supplierCatalogApi.photoReviews());
    } catch (e) {
      // Photo review is an optional panel; do not hide the catalog report if
      // the review endpoint is temporarily unavailable.
      setPhotoReviews([]);
    }
  }, []);

  const resolvePhotoReview = async (id: string, action: "approve" | "reject") => {
    setPhotoReviewBusy(id);
    setError("");
    try {
      if (action === "approve") await supplierCatalogApi.approvePhotoReview(id);
      else await supplierCatalogApi.rejectPhotoReview(id);
      await loadPhotoReviews();
      setNotice(action === "approve" ? "Фото подтверждено и сохранено." : "Кандидат отклонён.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPhotoReviewBusy(null);
    }
  };

  const setRunInUrl = useCallback((id: string | null) => {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("run", id);
    else url.searchParams.delete("run");
    window.history.replaceState(null, "", url);
  }, []);

  const discoverCountries = async () => {
    if (!supplierCode || serviceType === "all") return;
    setBusy(true);
    setError("");
    setNotice("");
    setDiscoveryReport(null);
    try {
      const before = new Set(
        capabilities
          .filter((cap) => cap.supplierCode === supplierCode && cap.serviceTypes.includes(serviceType))
          .flatMap((cap) => cap.countries.map((country) => country.key)),
      );
      const result = await supplierCatalogApi.discoverCountries({ supplierCode, serviceType });
      const added = result.countries
        .filter((country) => !before.has(country.key))
        .map((country) => country.key);
      setCapabilities(await supplierCatalogApi.capabilities());
      setDiscoveryReport({
        supplierCode,
        serviceType,
        discovered: result.discovered,
        skipped: result.skipped,
        countries: result.countries,
        added,
        removed: result.removed ?? [],
        at: new Date().toISOString(),
      });
      setNotice(
        result.discovered > 0 || (result.removed?.length ?? 0) > 0
          ? `Список стран обновлён: добавлено ${result.discovered}, удалено ${result.removed?.length ?? 0}, распознано ${result.countries.length}.`
          : `Список стран проверен: новых нет, распознано ${result.countries.length}, пропущено ${result.skipped}.`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    let alive = true;
    supplierCatalogApi.capabilities()
      .then((items) => {
        if (!alive) return;
        setCapabilities(items);
        const first = items.find((item) => item.countries.length > 0);
        if (first) {
          setSupplierCode(first.supplierCode);
          setServiceType(first.serviceTypes[0]);
          setCountryKey(first.countries[0]?.key ?? "");
        }
      })
      .catch((e) => { if (alive) setError((e as Error).message); })
      .finally(() => { if (alive) setLoadingCaps(false); });
    void loadRuns();
    void loadPhotoReviews();
    return () => { alive = false; };
  }, [loadRuns, loadPhotoReviews]);

  const suppliers = useMemo(() => {
    const map = new Map<string, { code: string; name: string; serviceTypes: Set<string> }>();
    for (const cap of capabilities) {
      const current = map.get(cap.supplierCode) ?? { code: cap.supplierCode, name: cap.name, serviceTypes: new Set<string>() };
      cap.serviceTypes.forEach((s) => current.serviceTypes.add(s));
      map.set(cap.supplierCode, current);
    }
    return [...map.values()];
  }, [capabilities]);

  const services = useMemo(() => {
    const set = new Set<string>();
    capabilities
      .filter((cap) => cap.supplierCode === supplierCode)
      .forEach((cap) => cap.serviceTypes.forEach((s) => set.add(s)));
    const values = [...set] as SupplierCatalogRunServiceType[];
    if (values.length > 1) values.push("all");
    return values;
  }, [capabilities, supplierCode]);

  const countries = useMemo(() => {
    const all = { key: "ALL", label: "Все страны" };
    if (serviceType === "all") {
      const map = new Map<string, string>();
      for (const cap of capabilities) {
        if (cap.supplierCode !== supplierCode || !cap.countries.length) continue;
        for (const country of cap.countries) map.set(country.key, country.label);
      }
      return [all, ...[...map.entries()].map(([key, label]) => ({ key, label }))];
    }
    const list = capabilities.find((cap) => cap.supplierCode === supplierCode && cap.serviceTypes.includes(serviceType))?.countries ?? [];
    return list.length ? [all, ...list] : [];
  }, [capabilities, supplierCode, serviceType]);

  const unavailable = useMemo(
    () => capabilities.filter((cap) => cap.unavailableReason).map((cap) => `${cap.supplierCode}: ${cap.unavailableReason}`),
    [capabilities],
  );

  useEffect(() => {
    if (services.length && !services.includes(serviceType)) setServiceType(services[0]);
  }, [services, serviceType]);

  useEffect(() => {
    if (!countries.some((country) => country.key === countryKey)) {
      setCountryKey(countries.find((country) => country.key !== "ALL")?.key ?? countries[0]?.key ?? "");
    }
  }, [countries, countryKey]);

  const pollRun = useCallback(async (id: string) => {
    const next = await supplierCatalogApi.run(id);
    setRun(next);
    upsertRun(next);
    if (next.status !== "PREVIEWING" && next.status !== "APPLYING") {
      await loadRuns();
      // Discovery runs before an ALL preview (and after scoped previews);
      // refresh the selector so a newly discovered country appears without
      // a page reload.
      setCapabilities(await supplierCatalogApi.capabilities());
    }
    return next;
  }, [loadRuns, upsertRun]);

  useEffect(() => {
    if (!run || !["PREVIEWING", "APPLYING"].includes(run.status)) return;
    const timer = window.setInterval(() => {
      void pollRun(run.id).catch((e) => setError((e as Error).message));
    }, 1500);
    return () => window.clearInterval(timer);
  }, [run, pollRun]);

  // Poll every active run in the table, not only the selected one. This keeps
  // «Предпросмотр» → «Завершён/Ошибка/Отмена» in sync without a page reload.
  const hasActiveRuns = runs.some((item) => ["PREVIEWING", "APPLYING"].includes(item.status));
  useEffect(() => {
    if (!hasActiveRuns) return;
    const timer = window.setInterval(() => {
      void supplierCatalogApi.runs(30)
        .then((next) => {
          setRuns(next);
          setRun((current) => current ? (next.find((item) => item.id === current.id) ?? current) : current);
        })
        .catch((e) => setError((e as Error).message));
    }, 1500);
    return () => window.clearInterval(timer);
  }, [hasActiveRuns]);

  // The selected run id is kept in the URL so a refresh / shared link opens
  // the same saved preview report instead of an empty panel.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("run");
    if (!id) return;
    void pollRun(id).catch((e) => {
      setError((e as Error).message);
      setRunInUrl(null);
    });
  }, [pollRun, setRunInUrl]);

  const openRun = (id: string) => {
    setRunInUrl(id);
    void pollRun(id).catch((e) => setError((e as Error).message));
  };

  const preview = async () => {
    if (!supplierCode || !countryKey) return;
    setBusy(true);
    setError("");
    try {
      const created = await supplierCatalogApi.preview({ supplierCode, serviceType, countryKey });
      setRun(created);
      upsertRun(created);
      setRunInUrl(created.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!run) return;
    setBusy(true);
    setError("");
    try {
      const next = await supplierCatalogApi.confirm(run.id);
      setRun(next);
      upsertRun(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const restoreLegacy = async (itemId: string) => {
    if (!run) return;
    setBusy(true);
    setError("");
    try {
      const next = await supplierCatalogApi.manualRestore(run.id, itemId);
      setRun(next);
      upsertRun(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const counts = run?.counts ?? {};
  const errors = errorList(run?.errors ?? null);
  const sourceScope = (run?.scope as { sourceScopes?: Array<{ dateFrom?: string; dateTo?: string; coverage?: { pagesFetched?: number; pageCount?: number } }> } | null)?.sourceScopes?.[0];
  const emptySource = Boolean(run && !["PREVIEWING", "APPLYING"].includes(run.status) && (run.items?.length ?? 0) === 0);
  const canConfirm = Boolean(canManage && run?.status === "PREVIEW_READY" && run.coverage !== "FAILED");
  const archiveBlocked = Boolean((counts.ARCHIVE ?? 0) > 0 && run?.coverage !== "COMPLETE");

  return (
    <div className="min-h-screen bg-panel">
      <PageHeader title={tr("Обновление услуг — Поставщики", "Xidmətlərin yenilənməsi — Təchizatçılar", "Service updates — Suppliers")} breadcrumbs={["TravelHub", tr("Обновление услуг", "Xidmətlərin yenilənməsi", "Service updates"), tr("Поставщики", "Təchizatçılar", "Suppliers")]} />
      <main className="mx-auto max-w-6xl space-y-5 p-6">
        {!canManage && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {tr("Раздел доступен только сотрудникам с правом запуска синхронизации поставщиков.", "Bölmə yalnız təchizatçı sinxronizasiyasını işə salmaq hüququ olan əməkdaşlar üçün əlçatandır.", "Available only to staff allowed to run supplier synchronization.")}
          </div>
        )}
        {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
        {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}

        {discoveryReport && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4"
            role="presentation"
            onClick={() => setDiscoveryReport(null)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="discovery-report-title"
              className="max-h-[85vh] w-full max-w-xl overflow-auto rounded-2xl border border-line bg-white p-5 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 id="discovery-report-title" className="text-lg font-semibold text-ink">{tr("Отчёт об обновлении списка стран", "Ölkə siyahısının yenilənmə hesabatı", "Country list update report")}</h2>
                  <p className="mt-1 text-xs text-ink/60">
                    {discoveryReport.supplierCode} · {serviceLabel(discoveryReport.serviceType)} · {formatDate(discoveryReport.at, locale)}
                  </p>
                </div>
                <button
                  type="button"
                  autoFocus
                  onClick={() => setDiscoveryReport(null)}
                  className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink/60 hover:bg-panel"
                >
                  {tr("Закрыть", "Bağla", "Close")}
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-emerald-700">{tr("Новых", "Yeni", "New")}</div>
                  <div className="text-xl font-semibold text-emerald-800">{discoveryReport.discovered}</div>
                </div>
                <div className="rounded-lg border border-line bg-panel px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-ink/60">{tr("Распознано", "Tanınan", "Recognized")}</div>
                  <div className="text-xl font-semibold text-ink">{discoveryReport.countries.length}</div>
                </div>
                <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-amber-700">{tr("Пропущено", "Buraxılan", "Skipped")}</div>
                  <div className="text-xl font-semibold text-amber-800">{discoveryReport.skipped}</div>
                </div>
                <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-rose-700">{tr("Удалено", "Silinən", "Removed")}</div>
                  <div className="text-xl font-semibold text-rose-800">{discoveryReport.removed.length}</div>
                </div>
              </div>

              {discoveryReport.removed.length > 0 && (
                <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                  <div className="font-semibold">{tr("Убраны из списка — больше нет в справочнике поставщика:", "Siyahıdan çıxarıldı — təchizatçı məlumat kitabında artıq yoxdur:", "Removed from the list — no longer in the supplier directory:")}</div>
                  <div className="mt-1">
                    {discoveryReport.removed.map((country) => `${country.key} ${country.label}`).join(" · ")}
                  </div>
                </div>
              )}

              {discoveryReport.countries.length === 0 ? (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                  {tr("Поставщик не вернул ни одной страны. Список не изменён.", "Təchizatçı heç bir ölkə qaytarmadı. Siyahı dəyişdirilmədi.", "The supplier returned no countries. The list was not changed.")}
                </div>
              ) : (
                <div className="mt-4 max-h-72 overflow-auto rounded-lg border border-line">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-panel text-ink/60">
                      <tr>
                        <th className="px-3 py-2">{tr("Код", "Kod", "Code")}</th>
                        <th className="px-3 py-2">{tr("Страна", "Ölkə", "Country")}</th>
                        <th className="px-3 py-2">{tr("Статус", "Status", "Status")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {discoveryReport.countries.map((country) => {
                        const isNew = discoveryReport.added.includes(country.key);
                        return (
                          <tr key={country.key} className="border-t border-line">
                            <td className="px-3 py-2 font-mono text-[11px] text-ink/60">{country.key}</td>
                            <td className="px-3 py-2 text-ink">{country.label || "—"}</td>
                            <td className="px-3 py-2">
                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${isNew ? "bg-emerald-50 text-emerald-700" : "bg-panel text-ink/60"}`}>
                                {isNew ? tr("добавлена", "əlavə edilib", "added") : tr("уже была", "artıq var idi", "already existed")}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="mt-3 text-[11px] text-ink/60">
                {tr("Отчёт только по справочнику стран. Цены и карточки услуг он не меняет — для этого нужен preview и подтверждение.", "Hesabat yalnız ölkə məlumat kitabı haqqındadır. Qiymətləri və xidmət kartlarını dəyişmir — bunun üçün preview və təsdiq lazımdır.", "This report covers the country directory only. It does not change prices or service cards — use preview and confirmation for that.")}
              </p>
            </div>
          </div>
        )}

        <section className="rounded-xl border border-line bg-white p-5">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-ink/60">
            <span className="rounded-full bg-panel px-2 py-1">{tr("1. Поставщик", "1. Təchizatçı", "1. Supplier")}</span>
            <span>→</span>
            <span className="rounded-full bg-panel px-2 py-1">{tr("2. Страна", "2. Ölkə", "2. Country")}</span>
            <span>→</span>
            <span className="rounded-full bg-panel px-2 py-1">{tr("3. Категория", "3. Kateqoriya", "3. Category")}</span>
            <span>→</span>
            <span className="rounded-full bg-panel px-2 py-1">{tr("4. Проверить", "4. Yoxla", "4. Check")}</span>
            <span>→</span>
            <span className="rounded-full bg-panel px-2 py-1">{tr("5. Отчёт", "5. Hesabat", "5. Report")}</span>
            <span>→</span>
            <span className="rounded-full bg-panel px-2 py-1">{tr("6. Подтвердить", "6. Təsdiqlə", "6. Confirm")}</span>
          </div>

          {loadingCaps ? (
            <div className="h-20 animate-pulse rounded-lg bg-panel" />
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              <label className="text-xs font-medium text-ink/60">
                {tr("Поставщик", "Təchizatçı", "Supplier")}
                <select
                  value={supplierCode}
                  onChange={(e) => setSupplierCode(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
                >
                  {suppliers.map((supplier) => <option key={supplier.code} value={supplier.code}>{supplier.name}</option>)}
                </select>
              </label>
              <label className="text-xs font-medium text-ink/60">
                {tr("Категория услуги", "Xidmət kateqoriyası", "Service category")}
                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value as SupplierCatalogRunServiceType)}
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
                >
                  {services.map((service) => <option key={service} value={service}>{serviceLabel(service)}</option>)}
                </select>
              </label>
              <label className="text-xs font-medium text-ink/60">
                {tr("Страна", "Ölkə", "Country")}
                <select
                  value={countryKey}
                  onChange={(e) => setCountryKey(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
                >
                  {countries.map((country) => <option key={country.key} value={country.key}>{country.key === "ALL" ? tr("Все страны", "Bütün ölkələr", "All countries") : country.key}</option>)}
                </select>
              </label>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {countryKey === "ALL" && (
              <div className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {tr("Выбрано полное обновление всех стран выбранной категории. Preview может выполняться долго; применяйте только после проверки отчёта.", "Seçilmiş kateqoriyanın bütün ölkələri üzrə tam yenilənmə seçilib. Preview uzun çəkə bilər; yalnız hesabatı yoxladıqdan sonra tətbiq edin.", "Full update of all countries in the selected category is selected. Preview may take a while; apply only after checking the report.")}
              </div>
            )}
            <button
              type="button"
              onClick={() => void preview()}
              disabled={!canManage || busy || !supplierCode || !countryKey}
              className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {tr("Проверить услуги", "Xidmətləri yoxla", "Check services")}
            </button>
            <button
              type="button"
              onClick={() => void discoverCountries()}
              disabled={!canManage || busy || !supplierCode || serviceType === "all"}
              className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50"
              title={tr("Найти новые страны в справочнике поставщика и добавить их в список", "Təchizatçı məlumat kitabında yeni ölkələri tap və siyahıya əlavə et", "Find new countries in the supplier directory and add them to the list")}
            >
              {tr("Обновить список стран", "Ölkə siyahısını yenilə", "Update country list")}
            </button>
            <button
              type="button"
              onClick={() => void confirm()}
              disabled={!canConfirm || busy}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {tr("Подтвердить обновление", "Yenilənməni təsdiqlə", "Confirm update")}
            </button>
            {run && ["PREVIEWING", "PREVIEW_READY"].includes(run.status) && (
              <button
                type="button"
                onClick={() => void supplierCatalogApi.cancel(run.id).then((next) => { setRun(next); upsertRun(next); }).catch((e) => setError((e as Error).message))}
                className="rounded-lg border border-line px-4 py-2 text-sm text-ink/60"
              >
                {tr("Отменить", "Ləğv et", "Cancel")}
              </button>
            )}
            <span className="text-xs text-ink/60">
              {tr("Preview не меняет каталог. Изменения применяются только после подтверждения.", "Preview kataloqu dəyişmir. Dəyişikliklər yalnız təsdiqdən sonra tətbiq olunur.", "Preview does not change the catalog. Changes apply only after confirmation.")}
            </span>
          </div>

          {unavailable.length > 0 && (
            <div className="mt-3 rounded-lg bg-panel px-3 py-2 text-[11px] text-ink/60">
              {unavailable.map((item) => <div key={item}>{item}</div>)}
            </div>
          )}
        </section>

        {run && (
          <section className="rounded-xl border border-line bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-ink">{tr("Предварительный отчёт", "İlkin hesabat", "Preview report")}</h2>
                <div className="mt-1 text-xs text-ink/60">
                  {run.supplierCode} · {serviceLabel(run.serviceType)} · {runCountryLabel(run, tr("Все страны", "Bütün ölkələr", "All countries"))} · {formatDate(run.createdAt, locale)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${run.status === "COMPLETED" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : run.status === "FAILED" || run.status === "PARTIAL" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>{run.status}</span>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${run.coverage === "COMPLETE" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : run.coverage === "FAILED" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>coverage: {run.coverage}</span>
              </div>
            </div>

            {archiveBlocked && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {tr("Архивация заблокирована: полнота каталога не подтверждена. Обновления/восстановления можно применить, архив — только после complete preview.", "Arxivləmə bloklanıb: kataloqun tamlığı təsdiqlənməyib. Yeniləmələr/bərpalar tətbiq oluna bilər, arxiv yalnız tam preview-dən sonra.", "Archiving is blocked: catalog completeness is not confirmed. Updates/restores can be applied; archive only after a complete preview.")}
              </div>
            )}
            {run.coverage === "COMPLETE" && (counts.ARCHIVE ?? 0) > 0 && (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {tr("В отчёте", "Hesabatda", "The report contains")} {counts.ARCHIVE} {tr("карточек к архивации. Проверьте список перед подтверждением.", "arxivlənməli kart var. Təsdiqdən əvvəl siyahını yoxlayın.", "cards to archive. Review the list before confirming.")}
              </div>
            )}
            {emptySource && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {tr("Поставщик вернул", "Təchizatçı qaytardı", "The supplier returned")} <strong>0 {tr("предложений", "təklif", "offers")}</strong> {tr("за проверяемый период", "yoxlanılan dövr üçün", "for the checked period")}
                {sourceScope?.dateFrom && sourceScope?.dateTo ? ` ${sourceScope.dateFrom} — ${sourceScope.dateTo}` : ""}.
                {tr("Цены и карточки не изменены. Обычно это означает, что у поставщика нет доступных тарифов на эти даты,", "Qiymətlər və kartlar dəyişdirilmədi. Adətən bu, təchizatçının bu tarixlər üçün tarifinin olmaması deməkdir,", "Prices and cards were not changed. Usually this means the supplier has no available rates for these dates,")}
                {tr("либо изменился сезон/окно продаж. Повторите проверку на другой период или проверьте наличие на сайте поставщика.", "və ya mövsüm/satış pəncərəsi dəyişib. Yoxlamanı başqa dövr üçün təkrarlayın və ya təchizatçının saytında mövcudluğu yoxlayın.", "or the season/sales window changed. Retry the check for another period or verify availability on the supplier site.")}
              </div>
            )}

            <div className="mt-4 grid gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {["CREATE", "UPDATE", "RESTORE", "ARCHIVE", "AMBIGUOUS", "LEGACY_ARCHIVED", "ERROR"].map((action) => (
                <div key={action} className="rounded-lg border border-line bg-panel px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-ink/60">{actionLabel(action)}</div>
                  <div className="text-lg font-semibold text-ink">{counts[action] ?? 0}</div>
                </div>
              ))}
            </div>

            {errors.length > 0 && (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                {errors.slice(0, 20).map((message) => <div key={message}>{message}</div>)}
              </div>
            )}

            {run.items && run.items.length > 0 && (
              <div className="mt-4 max-h-[460px] overflow-auto rounded-lg border border-line">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-panel text-ink/60">
                    <tr>
                      <th className="px-3 py-2">{tr("Действие", "Əməliyyat", "Action")}</th>
                      <th className="px-3 py-2">{tr("Название услуги", "Xidmətin adı", "Service name")}</th>
                      <th className="px-3 py-2">{tr("Фото", "Foto", "Photo")}</th>
                      <th className="px-3 py-2">{tr("Внешний ключ", "Xarici açar", "External key")}</th>
                      <th className="px-3 py-2">{tr("Причина", "Səbəb", "Reason")}</th>
                      <th className="px-3 py-2">{tr("Применено", "Tətbiq edilib", "Applied")}</th>
                      <th className="px-3 py-2">{tr("Ручное действие", "Əl əməliyyatı", "Manual action")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {run.items.map((item) => (
                      <tr key={item.id} className="border-t border-line">
                        <td className="whitespace-nowrap px-3 py-2 font-medium text-ink">{actionLabel(item.action)}</td>
                        <td className="px-3 py-2 text-ink">{itemServiceName(item)}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${item.photo === "YES" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                            {item.photo === "YES" ? tr("Да", "Bəli", "Yes") : tr("Нет", "Xeyr", "No")}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] text-ink/60">{item.supplierRef ?? item.externalKey}</td>
                        <td className="px-3 py-2 text-ink/60">{item.error ?? item.reason ?? "—"}</td>
                        <td className="px-3 py-2">{item.applied ? tr("да", "bəli", "yes") : tr("нет", "xeyr", "no")}</td>
                        <td className="px-3 py-2">
                          {item.action === "LEGACY_ARCHIVED" && !item.applied && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void restoreLegacy(item.id)}
                              className="rounded border border-amber-200 px-2 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                            >
                              {tr("Восстановить вручную", "Əl ilə bərpa et", "Restore manually")}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        <section className="rounded-xl border border-line bg-white p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-ink">{tr("Фото на проверку имени", "Ad yoxlaması üçün foto", "Photos for name review")}</h2>
              <p className="mt-1 text-xs text-ink/60">
                {tr("Найдено частичное совпадение с отелем — подтвердите, что фото относится к нужной услуге.", "Otel ilə qismən uyğunluq tapıldı — fotonun lazımi xidmətə aid olduğunu təsdiqləyin.", "A partial hotel match was found — confirm that the photo belongs to the right service.")}
              </p>
            </div>
            <button type="button" onClick={() => void loadPhotoReviews()} className="text-xs text-ink/60 hover:text-ink">{tr("Обновить", "Yenilə", "Refresh")}</button>
          </div>
          {photoReviews.length === 0 ? (
            <div className="py-4 text-sm text-ink/60">{tr("Нет фото-кандидатов, требующих проверки.", "Yoxlama tələb edən foto namizədi yoxdur.", "No photo candidates need review.")}</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {photoReviews.map((review) => (
                <div key={review.id} className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50/40 p-3">
                  <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-panel">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={review.candidateUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      onError={(event) => { event.currentTarget.style.display = "none"; }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-ink">{review.name}</div>
                    <div className="text-[11px] text-ink/60">{review.cityName} · {review.countryName}</div>
                    <div className="mt-2 text-[11px] text-ink/60">
                      {tr("Найдено:", "Tapıldı:", "Found:")} <span className="font-medium">{review.candidateTitle || tr("без названия", "adsız", "untitled")}</span>
                      {review.score > 0 ? ` · ${tr("совпадение", "uyğunluq", "match")} ${review.score}` : ""}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        disabled={photoReviewBusy === review.id}
                        onClick={() => void resolvePhotoReview(review.id, "approve")}
                        className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-800 disabled:opacity-50"
                      >
                        {tr("Подтвердить", "Təsdiqlə", "Confirm")}
                      </button>
                      <button
                        type="button"
                        disabled={photoReviewBusy === review.id}
                        onClick={() => void resolvePhotoReview(review.id, "reject")}
                        className="rounded border border-line px-2 py-1 text-[11px] text-ink/60 disabled:opacity-50"
                      >
                        {tr("Отклонить", "Rədd et", "Reject")}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-line bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink">{tr("Последние запуски", "Son işə salmalar", "Recent runs")}</h2>
            <button type="button" onClick={() => void loadRuns()} className="text-xs text-ink/60 hover:text-ink">{tr("Обновить", "Yenilə", "Refresh")}</button>
          </div>
          {runs.length === 0 ? (
            <div className="py-6 text-center text-sm text-ink/60">{tr("Запусков пока нет.", "Hələ işə salma yoxdur.", "No runs yet.")}</div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-ink/60">
                  <tr>
                    <th className="px-2 py-2">{tr("Дата", "Tarix", "Date")}</th>
                    <th className="px-2 py-2">{tr("Поставщик", "Təchizatçı", "Supplier")}</th>
                    <th className="px-2 py-2">{tr("Категория", "Kateqoriya", "Category")}</th>
                    <th className="px-2 py-2">{tr("Страна", "Ölkə", "Country")}</th>
                    <th className="px-2 py-2">{tr("Статус", "Status", "Status")}</th>
                    <th className="px-2 py-2">{tr("Покрытие", "Əhatə", "Coverage")}</th>
                    <th className="px-2 py-2">{tr("Автор", "Müəllif", "Author")}</th>
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((item) => (
                    <tr key={item.id} className="cursor-pointer border-t border-line hover:bg-panel" onClick={() => openRun(item.id)}>
                      <td className="px-2 py-2 text-ink/60">{formatDate(item.createdAt, locale)}</td>
                      <td className="px-2 py-2 font-medium">{item.supplierCode}</td>
                      <td className="px-2 py-2">{serviceLabel(item.serviceType)}</td>
                      <td className="px-2 py-2">{runCountryLabel(item, tr("Все страны", "Bütün ölkələr", "All countries"))}</td>
                      <td className="px-2 py-2"><span className={`rounded-full border px-2 py-0.5 font-semibold ${item.status === "COMPLETED" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : item.status === "FAILED" || item.status === "PARTIAL" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>{runStatusLabel(item.status)}</span></td>
                      <td className="px-2 py-2">{coverageLabel(item.coverage)}</td>
                      <td className="px-2 py-2 text-ink/60">{item.createdByName ?? "—"}</td>
                      <td className="px-2 py-2">{["PREVIEWING", "APPLYING"].includes(item.status) && <button type="button" onClick={(e) => { e.stopPropagation(); void supplierCatalogApi.cancel(item.id).then((next) => { upsertRun(next); if (run?.id === item.id) setRun(next); }).catch((err) => setError((err as Error).message)); }} className="rounded border border-rose-200 px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50">{tr("Остановить", "Dayandır", "Stop")}</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
