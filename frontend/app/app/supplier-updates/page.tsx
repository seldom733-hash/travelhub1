"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { useCan } from "@/lib/use-can";
import {
  supplierCatalogApi,
  type SupplierCatalogCapability,
  type SupplierCatalogRun,
  type SupplierCatalogRunItem,
  type SupplierCatalogRunServiceType,
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

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("ru-RU");
}

function runCountryLabel(run: SupplierCatalogRun): string {
  if (run.countryCode === "ALL") return "Все страны";
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

export default function SupplierUpdatesPage() {
  const canManage = useCan("supplier.search.manage");
  const [capabilities, setCapabilities] = useState<SupplierCatalogCapability[]>([]);
  const [loadingCaps, setLoadingCaps] = useState(true);
  const [supplierCode, setSupplierCode] = useState("");
  const [serviceType, setServiceType] = useState<SupplierCatalogRunServiceType>("tours");
  const [countryKey, setCountryKey] = useState("");
  const [run, setRun] = useState<SupplierCatalogRun | null>(null);
  const [runs, setRuns] = useState<SupplierCatalogRun[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadRuns = useCallback(async () => {
    try {
      setRuns(await supplierCatalogApi.runs(30));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const discoverCountries = async () => {
    if (!supplierCode || serviceType === "all") return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await supplierCatalogApi.discoverCountries({ supplierCode, serviceType });
      setCapabilities(await supplierCatalogApi.capabilities());
      setNotice(
        result.discovered > 0
          ? `Добавлено новых стран: ${result.discovered}. Обновлённые страны доступны в списке.`
          : `Новых стран не найдено (распознано: ${result.countries.length}, пропущено: ${result.skipped}).`,
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
    return () => { alive = false; };
  }, [loadRuns]);

  const suppliers = useMemo(() => {
    const map = new Map<string, { code: string; name: string; serviceTypes: Set<string> }>();
    for (const cap of capabilities) {
      if (!cap.countries.length) continue;
      const current = map.get(cap.supplierCode) ?? { code: cap.supplierCode, name: cap.name, serviceTypes: new Set<string>() };
      cap.serviceTypes.forEach((s) => current.serviceTypes.add(s));
      map.set(cap.supplierCode, current);
    }
    return [...map.values()];
  }, [capabilities]);

  const services = useMemo(() => {
    const set = new Set<string>();
    capabilities
      .filter((cap) => cap.supplierCode === supplierCode && cap.countries.length > 0)
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
    if (next.status !== "PREVIEWING" && next.status !== "APPLYING") {
      await loadRuns();
      // Discovery runs before an ALL preview (and after scoped previews);
      // refresh the selector so a newly discovered country appears without
      // a page reload.
      setCapabilities(await supplierCatalogApi.capabilities());
    }
    return next;
  }, [loadRuns]);

  useEffect(() => {
    if (!run || !["PREVIEWING", "APPLYING"].includes(run.status)) return;
    const timer = window.setInterval(() => {
      void pollRun(run.id).catch((e) => setError((e as Error).message));
    }, 1500);
    return () => window.clearInterval(timer);
  }, [run, pollRun]);

  const preview = async () => {
    if (!supplierCode || !countryKey) return;
    setBusy(true);
    setError("");
    try {
      const created = await supplierCatalogApi.preview({ supplierCode, serviceType, countryKey });
      setRun(created);
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
      setRun(await supplierCatalogApi.confirm(run.id));
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
      setRun(await supplierCatalogApi.manualRestore(run.id, itemId));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const counts = run?.counts ?? {};
  const errors = errorList(run?.errors ?? null);
  const canConfirm = Boolean(canManage && run?.status === "PREVIEW_READY" && run.coverage !== "FAILED");
  const archiveBlocked = Boolean((counts.ARCHIVE ?? 0) > 0 && run?.coverage !== "COMPLETE");

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader title="Обновление услуг — Поставщики" breadcrumbs={["TravelHub", "Обновление услуг", "Поставщики"]} />
      <main className="mx-auto max-w-6xl space-y-5 p-6">
        {!canManage && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Раздел доступен только сотрудникам с правом запуска синхронизации поставщиков.
          </div>
        )}
        {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
        {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="rounded-full bg-slate-100 px-2 py-1">1. Поставщик</span>
            <span>→</span>
            <span className="rounded-full bg-slate-100 px-2 py-1">2. Страна</span>
            <span>→</span>
            <span className="rounded-full bg-slate-100 px-2 py-1">3. Категория</span>
            <span>→</span>
            <span className="rounded-full bg-slate-100 px-2 py-1">4. Проверить</span>
            <span>→</span>
            <span className="rounded-full bg-slate-100 px-2 py-1">5. Отчёт</span>
            <span>→</span>
            <span className="rounded-full bg-slate-100 px-2 py-1">6. Подтвердить</span>
          </div>

          {loadingCaps ? (
            <div className="h-20 animate-pulse rounded-lg bg-slate-100" />
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              <label className="text-xs font-medium text-slate-600">
                Поставщик
                <select
                  value={supplierCode}
                  onChange={(e) => setSupplierCode(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  {suppliers.map((supplier) => <option key={supplier.code} value={supplier.code}>{supplier.name}</option>)}
                </select>
              </label>
              <label className="text-xs font-medium text-slate-600">
                Категория услуги
                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value as SupplierCatalogRunServiceType)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  {services.map((service) => <option key={service} value={service}>{SERVICE_LABEL[service] ?? service}</option>)}
                </select>
              </label>
              <label className="text-xs font-medium text-slate-600">
                Страна
                <select
                  value={countryKey}
                  onChange={(e) => setCountryKey(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  {countries.map((country) => <option key={country.key} value={country.key}>{country.key === "ALL" ? country.label : country.key}</option>)}
                </select>
              </label>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {countryKey === "ALL" && (
              <div className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Выбрано полное обновление всех стран выбранной категории. Preview может выполняться долго; применяйте только после проверки отчёта.
              </div>
            )}
            <button
              type="button"
              onClick={() => void preview()}
              disabled={!canManage || busy || !supplierCode || !countryKey}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Проверить услуги
            </button>
            <button
              type="button"
              onClick={() => void discoverCountries()}
              disabled={!canManage || busy || !supplierCode || serviceType === "all"}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
              title="Найти новые страны в справочнике поставщика и добавить их в список"
            >
              Обновить список стран
            </button>
            <button
              type="button"
              onClick={() => void confirm()}
              disabled={!canConfirm || busy}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Подтвердить обновление
            </button>
            {run && ["PREVIEWING", "PREVIEW_READY"].includes(run.status) && (
              <button
                type="button"
                onClick={() => void supplierCatalogApi.cancel(run.id).then(setRun).catch((e) => setError((e as Error).message))}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600"
              >
                Отменить
              </button>
            )}
            <span className="text-xs text-slate-400">
              Preview не меняет каталог. Изменения применяются только после подтверждения.
            </span>
          </div>

          {unavailable.length > 0 && (
            <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
              {unavailable.map((item) => <div key={item}>{item}</div>)}
            </div>
          )}
        </section>

        {run && (
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Предварительный отчёт</h2>
                <div className="mt-1 text-xs text-slate-400">
                  {run.supplierCode} · {SERVICE_LABEL[run.serviceType] ?? run.serviceType} · {runCountryLabel(run)} · {formatDate(run.createdAt)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${run.status === "COMPLETED" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : run.status === "FAILED" || run.status === "PARTIAL" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>{run.status}</span>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${run.coverage === "COMPLETE" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : run.coverage === "FAILED" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>coverage: {run.coverage}</span>
              </div>
            </div>

            {archiveBlocked && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Архивация заблокирована: полнота каталога не подтверждена. Обновления/восстановления можно применить, архив — только после complete preview.
              </div>
            )}
            {run.coverage === "COMPLETE" && (counts.ARCHIVE ?? 0) > 0 && (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                В отчёте {counts.ARCHIVE} карточек к архивации. Проверьте список перед подтверждением.
              </div>
            )}

            <div className="mt-4 grid gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {["CREATE", "UPDATE", "RESTORE", "ARCHIVE", "AMBIGUOUS", "LEGACY_ARCHIVED", "ERROR"].map((action) => (
                <div key={action} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-slate-400">{ACTION_LABEL[action]}</div>
                  <div className="text-lg font-semibold text-slate-900">{counts[action] ?? 0}</div>
                </div>
              ))}
            </div>

            {errors.length > 0 && (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                {errors.slice(0, 20).map((message) => <div key={message}>{message}</div>)}
              </div>
            )}

            {run.items && run.items.length > 0 && (
              <div className="mt-4 max-h-[460px] overflow-auto rounded-lg border border-slate-100">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Действие</th>
                      <th className="px-3 py-2">Название услуги</th>
                      <th className="px-3 py-2">Фото</th>
                      <th className="px-3 py-2">Внешний ключ</th>
                      <th className="px-3 py-2">Причина</th>
                      <th className="px-3 py-2">Применено</th>
                      <th className="px-3 py-2">Ручное действие</th>
                    </tr>
                  </thead>
                  <tbody>
                    {run.items.map((item) => (
                      <tr key={item.id} className="border-t border-slate-100">
                        <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-700">{ACTION_LABEL[item.action] ?? item.action}</td>
                        <td className="px-3 py-2 text-slate-700">{itemServiceName(item)}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${item.photo === "YES" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                            {item.photo === "YES" ? "Да" : "Нет"}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] text-slate-500">{item.supplierRef ?? item.externalKey}</td>
                        <td className="px-3 py-2 text-slate-500">{item.error ?? item.reason ?? "—"}</td>
                        <td className="px-3 py-2">{item.applied ? "да" : "нет"}</td>
                        <td className="px-3 py-2">
                          {item.action === "LEGACY_ARCHIVED" && !item.applied && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void restoreLegacy(item.id)}
                              className="rounded border border-amber-200 px-2 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                            >
                              Восстановить вручную
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

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Последние запуски</h2>
            <button type="button" onClick={() => void loadRuns()} className="text-xs text-slate-500 hover:text-slate-900">Обновить</button>
          </div>
          {runs.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-400">Запусков пока нет.</div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-slate-500">
                  <tr>
                    <th className="px-2 py-2">Дата</th>
                    <th className="px-2 py-2">Поставщик</th>
                    <th className="px-2 py-2">Категория</th>
                    <th className="px-2 py-2">Страна</th>
                    <th className="px-2 py-2">Статус</th>
                    <th className="px-2 py-2">Coverage</th>
                    <th className="px-2 py-2">Автор</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((item) => (
                    <tr key={item.id} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50" onClick={() => void pollRun(item.id)}>
                      <td className="px-2 py-2 text-slate-500">{formatDate(item.createdAt)}</td>
                      <td className="px-2 py-2 font-medium">{item.supplierCode}</td>
                      <td className="px-2 py-2">{SERVICE_LABEL[item.serviceType] ?? item.serviceType}</td>
                      <td className="px-2 py-2">{runCountryLabel(item)}</td>
                      <td className="px-2 py-2"><span className={`rounded-full border px-2 py-0.5 font-semibold ${item.status === "COMPLETED" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : item.status === "FAILED" || item.status === "PARTIAL" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>{item.status}</span></td>
                      <td className="px-2 py-2">{item.coverage}</td>
                      <td className="px-2 py-2 text-slate-500">{item.createdByName ?? "—"}</td>
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
