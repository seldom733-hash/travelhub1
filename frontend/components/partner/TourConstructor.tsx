"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
  tourBuilderApi,
  type BuilderComponent,
  type BuilderQuote,
  type BuilderState,
  type ComponentKind,
  type ComponentPayload,
  type DictionariesResponse,
  type DictionaryEntry,
} from "@/lib/tour-builder-api";
import { type VariantFacets } from "@/lib/matrix-combine";
import RoomTypesChecklist from "@/components/partner/RoomTypesChecklist";
import MatrixBuilder from "@/components/partner/MatrixBuilder";
import PriceCalendarEditor from "@/components/partner/PriceCalendarEditor";

/**
 * Partner Tour Builder — полноэкранный конструктор пакетного тура
 * (/partner/products/new/constructor и /partner/products/[id]/constructor).
 *
 * Мастер: 1 Основная информация → 2 Проживание → 3 Перелёт → 4 Трансфер →
 * 5 Страховка → 6 Предпросмотр и публикация. Шаг хранится в ?step=.
 * Автосохранение черновика на каждом шаге (PATCH /products/:id).
 * UI-эстетика — по разделу 8 промпта: плотная «расчётная» вёрстка,
 * табличные цифры, семантика цвета (зелёный = скидка, терракот = надбавка,
 * красный = стоп).
 */

const STEPS = ["Основная информация", "Проживание", "Перелёт", "Трансфер", "Страховка", "Предпросмотр"] as const;

const KIND_LABEL: Record<ComponentKind, string> = {
  accommodation: "Проживание",
  flight: "Перелёт",
  transfer: "Трансфер",
  insurance: "Страховка",
  extra: "Допуслуга",
};

const KIND_COLOR: Record<ComponentKind, string> = {
  accommodation: "text-sky-300",
  flight: "text-violet-300",
  transfer: "text-amber-300",
  insurance: "text-emerald-300",
  extra: "text-neutral-300",
};

interface Props {
  productId: string | null; // null = новый черновик (создаётся на шаге 1)
}

interface BasicForm {
  title: string;
  description: string;
}

const num = (v: string): number | null => {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const AZN_PER: Record<string, (fx: { usdAzn: number; eurAzn: number }) => number> = {
  AZN: () => 1,
  USD: (fx) => fx.usdAzn,
  EUR: (fx) => fx.eurAzn,
};

export default function TourConstructor({ productId }: Props) {
  const router = useRouter();
  const [id, setId] = useState<string | null>(productId);
  const [step, setStep] = useState(0);
  const [state, setState] = useState<BuilderState | null>(null);
  const [basic, setBasic] = useState<BasicForm>({ title: "", description: "" });
  // Форма валюты/курсов шага «Основная информация» (сохраняется через package-rules).
  const [curForm, setCurForm] = useState({ currency: "USD", usdAzn: "1.7", eurAzn: "1.85" });
  const [loading, setLoading] = useState(!!productId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const currency = state?.package.currency ?? "USD";

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const s = Number(sp.get("step") || "1");
    if (s >= 1 && s <= STEPS.length) setStep(s - 1);
  }, []);

  const gotoStep = useCallback(
    (s: number) => {
      setStep(s);
      const sp = new URLSearchParams(window.location.search);
      sp.set("step", String(s + 1));
      window.history.replaceState(null, "", `${window.location.pathname}?${sp.toString()}`);
    },
    [],
  );

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    void tourBuilderApi
      .getState(id)
      .then((s) => {
        setState(s);
        setBasic({ title: s.product.title, description: s.product.description ?? "" });
        setCurForm({
          currency: s.package.currency ?? "USD",
          usdAzn: String(s.package.fx?.usdAzn ?? 1.7),
          eurAzn: String(s.package.fx?.eurAzn ?? 1.85),
        });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  /* ── Черновик: создание/обновление базовой информации ──────────────────── */

  const saveBasic = async (): Promise<string | null> => {
    setError("");
    if (!basic.title.trim()) {
      setError("Укажите название тура");
      return null;
    }
    setSaving(true);
    try {
      if (!id) {
        const res = await api.post<{ product: { id: string } }>("/products", {
          type: "TOUR",
          title: basic.title.trim(),
          description: basic.description.trim() || undefined,
          attributes: { packageKind: "PACKAGE" },
          tariffs: [],
        });
        const newId = res.product.id;
        setId(newId);
        // Обновляем URL на редактирование (не теряем прогресс при F5).
        window.history.replaceState(null, "", `/partner/products/${newId}/constructor`);
        return newId;
      }
      await api.patch(`/products/${encodeURIComponent(id)}`, {
        title: basic.title.trim(),
        description: basic.description.trim() || undefined,
      });
      return id;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setSaving(false);
    }
  };

  /** Форма валюты/курсов изменена относительно сохранённых значений пакета. */
  const currencyDirty =
    curForm.currency !== (state?.package.currency ?? "USD") ||
    Number(curForm.usdAzn) !== (state?.package.fx?.usdAzn ?? 1.7) ||
    Number(curForm.eurAzn) !== (state?.package.fx?.eurAzn ?? 1.85);

  /**
   * Сохранение валюты/курсов на уже существующий черновик.
   * Смена валюты → confirm (конвертация всех цен по курсам); отмена → откат формы.
   */
  const persistCurrency = async (pid: string): Promise<"ok" | "skipped" | "error"> => {
    const usdAzn = Number(curForm.usdAzn);
    const eurAzn = Number(curForm.eurAzn);
    if (!(usdAzn > 0) || !(eurAzn > 0)) {
      setError("Курсы USD и EUR к AZN должны быть больше 0");
      return "error";
    }
    if (!currencyDirty) return "skipped";
    const saved = state?.package.currency ?? "USD";
    const target = curForm.currency;
    if (target !== saved) {
      const aznPer = (c: string) => AZN_PER[c]?.({ usdAzn, eurAzn }) ?? 1;
      const factor = aznPer(target) / aznPer(saved);
      const ok = window.confirm(
        `Сменить валюту пакета ${saved} → ${target}? Все введённые цены будут конвертированы ` +
          `(×${factor.toFixed(4)} по вашим курсам: 1 ${saved} = ${aznPer(saved).toFixed(4)} AZN).`,
      );
      if (!ok) {
        setCurForm((f) => ({ ...f, currency: saved }));
        return "skipped";
      }
    }
    setSaving(true);
    try {
      await tourBuilderApi.setPackageRules(pid, {
        fxUsdAzn: usdAzn,
        fxEurAzn: eurAzn,
        ...(target !== saved ? { currency: target as "USD" | "EUR" | "AZN" } : {}),
      });
      await refresh(pid);
      setNotice(target !== saved ? `Валюта пакета: ${target} — цены конвертированы` : "Валюта и курсы сохранены");
      return "ok";
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return "error";
    } finally {
      setSaving(false);
    }
  };

  /** Кнопка «Сохранить валюту и курсы» (создаёт черновик при необходимости). */
  const saveCurrency = async () => {
    setError("");
    let pid = id;
    if (!pid) {
      pid = await saveBasic();
      if (!pid) return;
    }
    await persistCurrency(pid);
  };

  const next = async () => {
    if (step === 0) {
      const pid = await saveBasic();
      if (!pid) return;
      // Не уходим с шага с «грязной» формой валюты — иначе цены войдут не в той валюте.
      if (currencyDirty) {
        const r = await persistCurrency(pid);
        if (r === "error") return;
      }
      gotoStep(1);
      return;
    }
    gotoStep(step + 1);
  };

  const back = () => gotoStep(Math.max(0, step - 1));

  const saveAndExit = async () => {
    if (step === 0 && !id) {
      const pid = await saveBasic();
      if (!pid) return;
    }
    router.push("/partner/products");
  };

  /* ── Компоненты ─────────────────────────────────────────────────────────── */

  const refresh = useCallback(async (pid: string) => {
    const s = await tourBuilderApi.getState(pid);
    setState(s);
  }, []);

  const addComponent = async (kind: ComponentKind, name: string, basePrice: number | null, payload: ComponentPayload) => {
    if (!id) { setError("Сначала заполните основную информацию"); return; }
    setError("");
    setSaving(true);
    try {
      await tourBuilderApi.addComponent(id, {
        kind,
        name,
        basePrice: basePrice ?? 0,
        componentPayload: payload,
      });
      await refresh(id);
      setNotice(`Компонент «${name}» добавлен`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const removeComponent = async (componentId: string) => {
    if (!id) return;
    setSaving(true);
    try {
      await tourBuilderApi.removeComponent(id, componentId);
      await refresh(id);
      setNotice("Компонент удалён");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const componentsByKind = useMemo(() => {
    const m = new Map<ComponentKind, BuilderComponent[]>();
    for (const c of state?.package.components ?? []) {
      const list = m.get(c.kind) ?? [];
      list.push(c);
      m.set(c.kind, list);
    }
    return m;
  }, [state]);

  /* ── Шаг «Проживание»: справочники, матрица, редактор календаря ────────── */

  const [dicts, setDicts] = useState<DictionariesResponse | null>(null);
  const [calOpen, setCalOpen] = useState<{ componentId: string; tab: "calendar" | "quota" } | null>(null);
  const [busy, setBusy] = useState(false);

  const reloadDicts = useCallback(async () => {
    try {
      setDicts(await tourBuilderApi.getDictionaries());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    if (step === 1 && !dicts) void reloadDicts();
  }, [step, dicts, reloadDicts]);

  /* Лейблы справочников — только английские (en → code), без переводов. */
  const entryLabel = (e: DictionaryEntry) => e.names?.en || e.code;

  const toggleRoomType = async (entry: DictionaryEntry, checked: boolean) => {
    if (!id) return;
    setBusy(true);
    setError("");
    try {
      if (checked) {
        await tourBuilderApi.addComponent(id, {
          kind: "accommodation",
          name: entryLabel(entry),
          basePrice: 0,
          componentPayload: { roomTypeId: entry.id, mealSupplements: {} },
        });
        setNotice(`Тип «${entryLabel(entry)}» добавлен в пакет`);
      } else {
        const comp = componentsByKind.get("accommodation")?.find((c) => c.payload.roomTypeId === entry.id);
        if (comp) {
          await tourBuilderApi.removeComponent(id, comp.componentId);
          if (calOpen?.componentId === comp.componentId) setCalOpen(null);
          setNotice(`Тип «${entryLabel(entry)}» убран из пакета`);
        }
      }
      await refresh(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  /** Создаёт юнит под тип номера, если его нет; возвращает componentId. */
  const ensureUnit = async (roomTypeId: string): Promise<string | null> => {
    if (!id) return null;
    const existing = componentsByKind.get("accommodation")?.find((c) => c.payload.roomTypeId === roomTypeId);
    if (existing) return existing.componentId;
    const entry = dicts?.roomTypes.find((e) => e.id === roomTypeId);
    const res = await tourBuilderApi.addComponent(id, {
      kind: "accommodation",
      name: entry ? entryLabel(entry) : "Проживание",
      basePrice: 0,
      componentPayload: { roomTypeId, mealSupplements: {} },
    });
    await refresh(id);
    return res.unitId;
  };

  const createVariant = async (componentId: string, facets: VariantFacets) => {
    if (!id) return;
    setBusy(true);
    try {
      await tourBuilderApi.createVariant(id, componentId, {
        viewCode: facets.viewCode ?? undefined,
        mealCode: facets.mealCode,
        placementCode: facets.placementCode,
        extraBed: !!facets.extraBed,
        extraSofa: !!facets.extraSofa,
      });
      await refresh(id);
      setNotice("Вариант создан");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setBusy(false);
    }
  };

  const updateVariant = async (componentId: string, variantId: string, facets: VariantFacets) => {
    if (!id) return;
    setBusy(true);
    try {
      await tourBuilderApi.updateVariant(id, componentId, variantId, {
        viewCode: facets.viewCode ?? undefined,
        mealCode: facets.mealCode,
        placementCode: facets.placementCode,
        extraBed: !!facets.extraBed,
        extraSofa: !!facets.extraSofa,
      });
      await refresh(id);
      setNotice("Вариант обновлён (календарь сохранён)");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  /** Фикс-цены Ext.Bed/Ext.Sofa пакета (блок «Доп. опции номера»). */
  const saveExtPrices = async (prices: { extraBedPrice: number; extraSofaPrice: number }) => {
    if (!id) return;
    setBusy(true);
    try {
      await tourBuilderApi.setPackageRules(id, prices);
      await refresh(id);
      setNotice("Цены доп.опций сохранены");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setBusy(false);
    }
  };

  /** Baby Cot — галочка «возможность предоставить» (не ось матрицы). */
  const toggleBabyCot = async (v: boolean) => {
    if (!id) return;
    setBusy(true);
    try {
      await tourBuilderApi.setPackageRules(id, { babyCot: v });
      await refresh(id);
      setNotice(v ? "Baby Cot включён (бесплатно)" : "Baby Cot убран");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setBusy(false);
    }
  };

  const removeVariant = async (componentId: string, variantId: string) => {
    if (!id) return;
    setBusy(true);
    try {
      await tourBuilderApi.removeVariant(id, componentId, variantId);
      await refresh(id);
      setNotice("Вариант удалён");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  /* ── Расчёт (шаг 6) ────────────────────────────────────────────────────── */

  const [qParams, setQParams] = useState({ departureDate: "", nights: "7", adults: "2", childAges: "" });
  const [quote, setQuote] = useState<BuilderQuote | null>(null);
  const [qLoading, setQLoading] = useState(false);
  const [viewerMode, setViewerMode] = useState(false);
  const [viewerDetail, setViewerDetail] = useState<number | null>(null);

  /* Витрина: строки вариантов проживания (выбранный + альтернативы) → gross. */
  const viewerAccom = quote?.lines.find((l) => l.kind === "accommodation") ?? null;
  const viewerRows = viewerAccom
    ? [
        ...(viewerAccom.variant
          ? [{ ...viewerAccom.variant, amount: viewerAccom.amount, formulas: viewerAccom.formulas, chosen: true }]
          : []),
        ...(viewerAccom.alternatives ?? []).map((a) => ({ ...a, amount: a.amount ?? 0, formulas: a.formulas ?? [], chosen: false })),
      ]
    : [];

  /** Валюта расчёта: из ответа quote (валюта пакета), иначе — текущая валюта. */
  const qCur = quote?.currency || currency;

  const runQuote = async () => {
    if (!id) return;
    setError("");
    const nights = num(qParams.nights);
    const adults = num(qParams.adults);
    if (!qParams.departureDate || !nights || !adults) {
      setError("Заполните дату вылета, ночи и взрослых");
      return;
    }
    setQLoading(true);
    try {
      const children = qParams.childAges
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((a) => ({ age: Number(a) }));
      const q = await tourBuilderApi.quote(id, { departureDate: qParams.departureDate, nights, adults, children });
      setQuote(q);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setQLoading(false);
    }
  };

  const submitModeration = async () => {
    if (!id) return;
    setSaving(true);
    setError("");
    try {
      await api.post(`/products/${encodeURIComponent(id)}/submit-moderation`);
      setNotice("Тур отправлен на модерацию");
      setTimeout(() => router.push("/partner/products"), 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  /* ── Рендер ────────────────────────────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200">
      {/* Шапка конструктора */}
      <header className="sticky top-0 z-20 border-b border-neutral-800 bg-neutral-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3">
          <div className="flex items-baseline gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-500/90">Конструктор тура</span>
            {state?.product.code && <span className="font-mono text-xs text-neutral-500">{state.product.code}</span>}
          </div>
          <button
            onClick={saveAndExit}
            className="rounded border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 transition-colors hover:border-neutral-500 hover:text-white"
          >
            Сохранить черновик и выйти
          </button>
        </div>
        {/* Индикатор шага */}
        <div className="mx-auto max-w-[1400px] px-6 pb-3">
          <ol className="flex flex-wrap gap-1 text-[11px]">
            {STEPS.map((label, i) => (
              <li key={label}>
                <button
                  onClick={() => (i === 0 || id) && gotoStep(i)}
                  disabled={i > 0 && !id}
                  className={`rounded-sm px-2 py-1 transition-colors ${
                    i === step
                      ? "bg-amber-500/15 font-semibold text-amber-300 outline outline-1 outline-amber-500/40"
                      : i < step || id
                        ? "text-neutral-400 hover:bg-neutral-800/60"
                        : "text-neutral-700"
                  }`}
                >
                  <span className="font-mono">{i + 1}</span> · {label}
                </button>
              </li>
            ))}
          </ol>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-6">
        {error && (
          <div className="mb-4 rounded border border-red-900/50 bg-red-950/30 px-4 py-2 text-sm text-red-300">{error}</div>
        )}
        {notice && !error && (
          <div className="mb-4 rounded border border-emerald-900/50 bg-emerald-950/30 px-4 py-2 text-sm text-emerald-300">{notice}</div>
        )}
        {loading && <div className="py-16 text-center text-sm text-neutral-500">Загрузка…</div>}

        {/* ШАГ 1 — Основная информация */}
        {!loading && step === 0 && (
          <section className="max-w-2xl space-y-4">
            <Field label="Название тура">
              <input
                value={basic.title}
                onChange={(e) => setBasic({ ...basic, title: e.target.value })}
                placeholder="Напр.: Стамбул — 7 ночей, перелёт + отель + трансфер"
                className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-amber-500/60"
              />
            </Field>
            <Field label="Описание">
              <textarea
                value={basic.description}
                onChange={(e) => setBasic({ ...basic, description: e.target.value })}
                rows={4}
                className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-amber-500/60"
              />
            </Field>

            {/* Валюта пакета и курсы партнёра (все цены шагов 2–6 — в этой валюте) */}
            <div className="space-y-3 rounded border border-neutral-800 bg-neutral-900/40 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Валюта пакета и курсы</div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="Валюта всех цен">
                  <select
                    value={curForm.currency}
                    onChange={(e) => setCurForm({ ...curForm, currency: e.target.value })}
                    className="w-full rounded border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 font-mono text-sm outline-none focus:border-amber-500/60"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="AZN">AZN</option>
                  </select>
                </Field>
                <Field label="Курс USD → AZN">
                  <input
                    value={curForm.usdAzn}
                    onChange={(e) => setCurForm({ ...curForm, usdAzn: e.target.value })}
                    inputMode="decimal"
                    className="w-full rounded border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 font-mono text-sm tabular-nums outline-none focus:border-amber-500/60"
                  />
                </Field>
                <Field label="Курс EUR → AZN">
                  <input
                    value={curForm.eurAzn}
                    onChange={(e) => setCurForm({ ...curForm, eurAzn: e.target.value })}
                    inputMode="decimal"
                    className="w-full rounded border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 font-mono text-sm tabular-nums outline-none focus:border-amber-500/60"
                  />
                </Field>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => void saveCurrency()}
                  disabled={saving}
                  className="rounded border border-amber-500/60 px-3 py-1.5 text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-500/10 disabled:opacity-40"
                >
                  {saving ? "Сохранение…" : "Сохранить валюту и курсы"}
                </button>
                <span className="font-mono text-[11px] text-neutral-500">
                  текущая: {currency} · 1 AZN = 1 AZN (базовая)
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-neutral-500">
                Введите курсы USD и EUR к AZN — по ним конвертируются все цены при смене валюты
                (тарифы, календарь, таксы, доп.опции). Проценты (скидки, надбавки %) не пересчитываются.
              </p>
            </div>

            <p className="text-xs text-neutral-500">
              Черновик создастся при переходе к следующему шагу — прогресс сохраняется автоматически.
            </p>
          </section>
        )}

        {/* ШАГИ 2–5 — Компоненты */}
        {!loading && step >= 1 && step <= 4 && (
          <div className="space-y-6">
            {step === 1 && (
              <RoomTypesChecklist
                dictionaries={dicts}
                components={componentsByKind.get("accommodation") ?? []}
                busy={busy}
                onToggle={(entry, checked) => void toggleRoomType(entry, checked)}
                onProposed={reloadDicts}
                onError={setError}
                onNotice={setNotice}
              />
            )}
            <ComponentStep
              kind={(["accommodation", "flight", "transfer", "insurance"] as const)[step - 1]}
              components={componentsByKind.get((["accommodation", "flight", "transfer", "insurance"] as const)[step - 1]) ?? []}
              currency={currency}
              onAdd={addComponent}
              onRemove={removeComponent}
              saving={saving}
              onOpenEditor={step === 1 ? (componentId, tab) => setCalOpen({ componentId, tab }) : undefined}
            />
            {step === 1 && (
              <MatrixBuilder
                dictionaries={dicts}
                components={componentsByKind.get("accommodation") ?? []}
                busy={busy}
                currency={currency}
                extraBedPrice={state?.package.extraBedPrice ?? null}
                extraSofaPrice={state?.package.extraSofaPrice ?? null}
                babyCot={state?.package.babyCot ?? false}
                onEnsureUnit={ensureUnit}
                onCreateVariant={createVariant}
                onUpdateVariant={updateVariant}
                onRemoveVariant={removeVariant}
                onSaveExtPrices={saveExtPrices}
                onToggleBabyCot={toggleBabyCot}
                onError={setError}
              />
            )}
            {step === 1 &&
              calOpen &&
              id &&
              (() => {
                const comp = state?.package.components.find((c) => c.componentId === calOpen.componentId);
                if (!comp) return null;
                return (
                  <PriceCalendarEditor
                    key={`${calOpen.componentId}:${calOpen.tab}`}
                    productId={id}
                    component={comp}
                    currency={currency}
                    initialTab={calOpen.tab}
                    onNotice={setNotice}
                    onError={setError}
                    onSaved={() => refresh(id)}
                    onClose={() => setCalOpen(null)}
                  />
                );
              })()}
          </div>
        )}

        {/* ШАГ 6 — Предпросмотр и публикация */}
        {!loading && step === 5 && id && (
          <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
            <div className="space-y-4">
              <Panel title="Тестовые параметры">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Field label="Дата вылета">
                    <input type="date" value={qParams.departureDate} onChange={(e) => setQParams({ ...qParams, departureDate: e.target.value })} className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 font-mono text-sm outline-none focus:border-amber-500/60" />
                  </Field>
                  <Field label="Ночей">
                    <input type="number" min={1} value={qParams.nights} onChange={(e) => setQParams({ ...qParams, nights: e.target.value })} className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 font-mono text-sm outline-none focus:border-amber-500/60" />
                  </Field>
                  <Field label="Взрослых">
                    <input type="number" min={1} value={qParams.adults} onChange={(e) => setQParams({ ...qParams, adults: e.target.value })} className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 font-mono text-sm outline-none focus:border-amber-500/60" />
                  </Field>
                  <Field label="Дети (возрасты, ч/з запятую)">
                    <input value={qParams.childAges} onChange={(e) => setQParams({ ...qParams, childAges: e.target.value })} placeholder="напр.: 5, 9" className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 font-mono text-sm outline-none focus:border-amber-500/60" />
                  </Field>
                </div>
                <button onClick={runQuote} disabled={qLoading} className="mt-3 rounded bg-amber-500/90 px-4 py-1.5 text-sm font-semibold text-neutral-950 transition-colors hover:bg-amber-400 disabled:opacity-40">
                  {qLoading ? "Расчёт…" : "Рассчитать"}
                </button>
              </Panel>

              {quote && (
                <>
                  {/* Переключатель режима отображения */}
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      onClick={() => setViewerMode(false)}
                      className={`rounded-sm px-2.5 py-1 ${!viewerMode ? "bg-neutral-800 font-semibold text-white" : "text-neutral-400 hover:text-neutral-200"}`}
                    >
                      Расчёт партнёра
                    </button>
                    <button
                      onClick={() => setViewerMode(true)}
                      className={`rounded-sm px-2.5 py-1 ${viewerMode ? "bg-neutral-800 font-semibold text-white" : "text-neutral-400 hover:text-neutral-200"}`}
                    >
                      Что увидит турист
                    </button>
                  </div>

                  {quote.warnings.length > 0 && (
                    <div className="rounded border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
                      <ul className="list-disc space-y-1 pl-4">
                        {quote.warnings.map((w, i) => <li key={i}>{w}</li>)}
                      </ul>
                    </div>
                  )}

                  {!viewerMode ? (
                    <Panel title="Расчётный лист">
                      <div className="divide-y divide-neutral-800">
                        {quote.lines.map((l, i) => (
                          <details key={i} className="group py-2">
                            <summary className="flex cursor-pointer items-center justify-between text-sm">
                              <span>
                                <span className={`mr-2 font-mono text-[10px] uppercase tracking-wider ${KIND_COLOR[l.kind]}`}>{KIND_LABEL[l.kind]}</span>
                                {l.name}
                                {!l.required && <span className="ml-2 text-[10px] text-neutral-500">(необязательный)</span>}
                              </span>
                              <span className="font-mono tabular-nums">{l.amount.toFixed(2)} {qCur}</span>
                            </summary>
                            <ul className="mt-1.5 space-y-0.5 border-l-2 border-neutral-800 pl-3 text-xs text-neutral-400">
                              {l.formulas.map((f, j) => <li key={j} className="font-mono tabular-nums">{f}</li>)}
                            </ul>
                          </details>
                        ))}
                      </div>
                      {/* Итоговый блок */}
                      <dl className="mt-4 space-y-1 border-t border-neutral-800 pt-3 text-sm">
                        <Row k="Сумма компонентов" v={quote.totals.net} currency={qCur} />
                        {quote.totals.packageDiscountPct > 0 && <Row k={`Скидка за сборку пакета −${quote.totals.packageDiscountPct}%`} v={-quote.totals.packageDiscount} tone="green" currency={qCur} />}
                        <Row k="Нетто партнёра" v={quote.totals.partnerNet} currency={qCur} />
                        <Row k={`Комиссия платформы ${quote.totals.commissionPct}%`} v={quote.totals.commission} currency={qCur} />
                        {quote.totals.grossOverride != null && (
                          <div className="flex items-center justify-between">
                            <dt className="text-xs text-red-300">Брутто (переопределено вручную)</dt>
                            <dd className="font-mono tabular-nums">
                              <span className="mr-2 text-xs text-neutral-500 line-through">{quote.totals.grossCalculated.toFixed(2)}</span>
                              <span className="text-red-300">{quote.totals.grossOverride.toFixed(2)}</span> {qCur}
                            </dd>
                          </div>
                        )}
                        <div className="flex items-center justify-between border-t border-neutral-800 pt-2 text-base font-semibold text-white">
                          <dt>Брутто</dt>
                          <dd className="font-mono tabular-nums">{quote.totals.gross.toFixed(2)} {qCur}</dd>
                        </div>
                      </dl>
                    </Panel>
                  ) : (
                    <Panel title="Витрина — превью покупателя">
                      <h3 className="text-lg font-semibold text-white">{state?.product.title}</h3>
                      {viewerRows.length > 0 && (
                        <table className="mt-3 w-full text-sm">
                          <thead>
                            <tr className="border-b border-neutral-800 text-left text-[10px] uppercase tracking-wide text-neutral-500">
                              <th className="py-1.5 font-medium">Вариант</th>
                              <th className="py-1.5 font-medium">Размещение</th>
                              <th className="py-1.5 font-medium">Номеров</th>
                              <th className="py-1.5 text-right font-medium">Цена, {qCur}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-800/60">
                            {viewerRows.map((r, i) => (
                              <Fragment key={i}>
                                <tr
                                  onClick={() => setViewerDetail(viewerDetail === i ? null : i)}
                                  className={`cursor-pointer transition-colors hover:bg-neutral-900/60 ${r.chosen ? "text-amber-200" : "text-neutral-300"}`}
                                >
                                  <td className="py-1.5">
                                    {r.name}
                                    {r.chosen && <span className="ml-2 rounded-sm bg-amber-500/15 px-1.5 py-px text-[10px] text-amber-300">выбран</span>}
                                    {r.viewCode == null && <span className="ml-1.5 text-[10px] text-neutral-500">без вида</span>}
                                  </td>
                                  <td className="py-1.5 font-mono text-xs text-neutral-400">{r.placementCode ?? "—"}</td>
                                  <td className="py-1.5 font-mono tabular-nums text-neutral-400">{r.rooms}</td>
                                  <td className="py-1.5 text-right font-mono tabular-nums">{r.amount.toFixed(2)}</td>
                                </tr>
                                {viewerDetail === i && (
                                  <tr>
                                    <td colSpan={4} className="pb-2">
                                      <ul className="space-y-0.5 border-l-2 border-neutral-800 pl-3 text-xs text-neutral-400">
                                        {r.formulas.map((f, j) => (
                                          <li key={j} className="font-mono tabular-nums">{f}</li>
                                        ))}
                                      </ul>
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            ))}
                          </tbody>
                        </table>
                      )}
                      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-neutral-300">
                        {quote.lines
                          .filter((l) => l.kind !== "accommodation")
                          .map((l, i) => <li key={i}>{l.name}</li>)}
                      </ul>
                      <div className="mt-3">
                        <span className="text-xs text-neutral-500">Цена за пакет</span>
                        <div className="font-mono text-2xl font-bold tabular-nums text-amber-300">{quote.totals.gross.toFixed(2)} {qCur}</div>
                      </div>
                    </Panel>
                  )}

                  {/* Доступность: узкое место */}
                  {quote.availability.bottleneck && (
                    <div className="rounded border border-neutral-800 bg-neutral-900/60 px-4 py-3 text-xs text-neutral-300">
                      Доступность пакета на дату: <span className="font-mono tabular-nums text-white">{quote.availability.bottleneck.available ?? "—"}</span>
                      {quote.availability.bottleneck.available != null && <> · узкое место: <span className="text-red-300">{quote.availability.bottleneck.name}</span></>}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Sticky панель публикации */}
            <div className="lg:sticky lg:top-28 lg:self-start">
              <Panel title="Публикация">
                <p className="text-xs leading-relaxed text-neutral-400">
                  Проверьте расчёт слева. Публикация отправит тур на модерацию — после одобрения модератором тур появится в поиске платформы.
                </p>
                <button
                  onClick={submitModeration}
                  disabled={saving || !state?.package.components.length}
                  className="mt-3 w-full rounded bg-emerald-500/90 px-4 py-2 text-sm font-semibold text-neutral-950 transition-colors hover:bg-emerald-400 disabled:opacity-40"
                >
                  Отправить на модерацию
                </button>
                {!state?.package.components.length && (
                  <p className="mt-2 text-[11px] text-neutral-500">Добавьте хотя бы один компонент пакета.</p>
                )}
              </Panel>
            </div>
          </div>
        )}

        {/* Навигация шагов */}
        {!loading && (
          <div className="mt-8 flex items-center justify-between border-t border-neutral-800 pt-4">
            <button onClick={back} disabled={step === 0} className="rounded border border-neutral-700 px-4 py-1.5 text-sm text-neutral-300 transition-colors hover:border-neutral-500 disabled:opacity-30">
              ← Назад
            </button>
            {step < 5 ? (
              <button onClick={next} disabled={saving} className="rounded bg-amber-500/90 px-5 py-1.5 text-sm font-semibold text-neutral-950 transition-colors hover:bg-amber-400 disabled:opacity-40">
                {saving ? "Сохранение…" : "Далее →"}
              </button>
            ) : <span />}
          </div>
        )}
      </main>
    </div>
  );
}

/* ── Шаг компонента: список добавленных + форма добавления ────────────────── */

function ComponentStep({
  kind,
  components,
  currency,
  onAdd,
  onRemove,
  saving,
  onOpenEditor,
}: {
  kind: Exclude<ComponentKind, "extra">;
  components: BuilderComponent[];
  /** Валюта пакета — для подписей денежных полей формы. */
  currency: string;
  onAdd: (kind: ComponentKind, name: string, basePrice: number | null, payload: ComponentPayload) => void;
  onRemove: (componentId: string) => void;
  saving: boolean;
  onOpenEditor?: (componentId: string, tab: "calendar" | "quota") => void;
}) {
  const [name, setName] = useState("");
  const [basePrice, setBasePrice] = useState("");
  // Специфичные поля формы по виду ресурса (раздел 4 промпта: у каждого своя ось цены).
  const [mealBreakfast, setMealBreakfast] = useState("");
  const [ladder, setLadder] = useState("10:199; 20:249; 999:299");
  const [taxes, setTaxes] = useState("45");
  const [depDate, setDepDate] = useState("");
  const [depCap, setDepCap] = useState("180");
  const [perVehicle, setPerVehicle] = useState(false);
  const [capacity, setCapacity] = useState("4");
  const [brackets, setBrackets] = useState("1-7:19; 8-14:29; 15-21:39; 22+:49");
  const [childCoeff, setChildCoeff] = useState("0.6");

  const parseLadder = (): Array<{ upToSeat: number; price: number }> =>
    ladder.split(";").map((s) => s.trim()).filter(Boolean).map((s) => {
      const [a, b] = s.split(":").map(Number);
      return { upToSeat: a, price: b };
    }).filter((t) => Number.isFinite(t.upToSeat) && Number.isFinite(t.price));

  const parseBrackets = (): Array<{ bracket: string; pricePerAdult: number }> =>
    brackets.split(";").map((s) => s.trim()).filter(Boolean).map((s) => {
      const [a, b] = s.split(":");
      return { bracket: a.trim(), pricePerAdult: Number(b) };
    }).filter((t) => t.bracket && Number.isFinite(t.pricePerAdult));

  const submit = () => {
    if (!name.trim()) return;
    const price = num(basePrice);
    let payload: ComponentPayload = {};
    if (kind === "accommodation") {
      payload = {
        mealSupplements: mealBreakfast.trim() ? { breakfast: num(mealBreakfast) ?? 0 } : {},
      };
    } else if (kind === "flight") {
      payload = {
        fareLadder: parseLadder(),
        taxesPerPax: num(taxes) ?? 0,
        defaultFare: price,
        departures: depDate ? [{ date: depDate, capacity: num(depCap) ?? 0, sold: 0, priceOverride: null }] : [],
        childPct: 75,
        infantPct: 10,
      };
    } else if (kind === "transfer") {
      payload = { unit: perVehicle ? "per_vehicle" : "per_pax", capacity: perVehicle ? num(capacity) : null, surcharges: [] };
    } else if (kind === "insurance") {
      payload = { durationBrackets: parseBrackets(), childCoefficient: num(childCoeff) ?? 0.6 };
    }
    onAdd(kind, name.trim(), price, payload);
    setName("");
    setBasePrice("");
  };

  const addDep = async () => {};

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
      <Panel title={`Компоненты: ${KIND_LABEL[kind]}`}>
        {components.length === 0 ? (
          <p className="py-6 text-center text-sm text-neutral-500">Пока ничего не добавлено.</p>
        ) : (
          <div className="divide-y divide-neutral-800">
            {components.map((c) => {
              const t = c.tariffs[0];
              const periods = c.tariffs.reduce((acc, x) => acc + x.periods.length, 0);
              return (
                <div key={c.componentId} className="flex items-center justify-between py-2.5">
                  <div>
                    <div className="text-sm text-white">{c.name}</div>
                    <div className="mt-0.5 flex gap-3 font-mono text-[11px] text-neutral-500">
                      <span>{c.unitCode}</span>
                      {kind === "accommodation" && (
                        <span className="text-sky-400/80">
                          {c.tariffs.length} вариант(ов) · {periods} период(ов)
                        </span>
                      )}
                      {t && kind !== "accommodation" && <span>база {t.price?.toFixed(2)} {t.currency}</span>}
                      {t && t.periods.length > 0 && kind !== "accommodation" && <span className="text-sky-400/80">{t.periods.length} период(ов) цен</span>}
                      {kind === "flight" && c.payload.departures && <span>{c.payload.departures.length} вылет(ов)</span>}
                      {kind === "transfer" && <span>{c.payload.unit === "per_vehicle" ? `за машину (до ${c.payload.capacity})` : "с человека"}</span>}
                      {kind === "insurance" && <span>{c.payload.durationBrackets?.length ?? 0} диапазон(ов)</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {kind === "accommodation" && onOpenEditor && (
                      <>
                        <button
                          onClick={() => onOpenEditor(c.componentId, "calendar")}
                          className="rounded border border-neutral-700 px-2 py-0.5 text-xs text-sky-300 transition-colors hover:border-sky-500/60"
                        >
                          Календарь
                        </button>
                        <button
                          onClick={() => onOpenEditor(c.componentId, "quota")}
                          className="rounded border border-neutral-700 px-2 py-0.5 text-xs text-neutral-300 transition-colors hover:border-neutral-500"
                        >
                          Квота
                        </button>
                      </>
                    )}
                    <button onClick={() => onRemove(c.componentId)} className="text-xs text-neutral-500 transition-colors hover:text-red-400">
                      Удалить
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel title={`Добавить ${KIND_LABEL[kind].toLowerCase()}`}>
        <div className="space-y-3">
          <Field label="Название">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === "accommodation" ? "Deluxe Room" : kind === "flight" ? "Блок мест Baku→Antalya" : kind === "transfer" ? "Sedan, аэропорт—отель" : "Страховка Basic"} className="w-full rounded border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-sm outline-none focus:border-amber-500/60" />
          </Field>
          <Field label={kind === "flight" ? `Тариф GDS по умолчанию, ${currency} (когда блок исчерпан)` : kind === "insurance" ? "Базовая цена (не используется в расчёте)" : `Базовая цена, ${currency}`}>
            <input value={basePrice} onChange={(e) => setBasePrice(e.target.value)} inputMode="decimal" className="w-full rounded border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 font-mono text-sm tabular-nums outline-none focus:border-amber-500/60" />
          </Field>

          {kind === "accommodation" && (
            <Field label={`Надбавка за питание (завтрак), ${currency}/сутки на взрослого`}>
              <input value={mealBreakfast} onChange={(e) => setMealBreakfast(e.target.value)} inputMode="decimal" className="w-full rounded border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 font-mono text-sm tabular-nums outline-none focus:border-amber-500/60" />
            </Field>
          )}

          {kind === "flight" && (
            <>
              <Field label="Лестница тарифа блока «мест до : цена» (ч/з ; )">
                <input value={ladder} onChange={(e) => setLadder(e.target.value)} className="w-full rounded border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 font-mono text-sm tabular-nums outline-none focus:border-amber-500/60" />
              </Field>
              <Field label={`Таксы/топливный сбор, ${currency} с человека (без комиссии платформы)`}>
                <input value={taxes} onChange={(e) => setTaxes(e.target.value)} inputMode="decimal" className="w-full rounded border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 font-mono text-sm tabular-nums outline-none focus:border-amber-500/60" />
              </Field>
              <Field label="Первый вылет: дата + вместимость блока">
                <div className="flex gap-2">
                  <input type="date" value={depDate} onChange={(e) => setDepDate(e.target.value)} className="flex-1 rounded border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 font-mono text-sm outline-none focus:border-amber-500/60" />
                  <input value={depCap} onChange={(e) => setDepCap(e.target.value)} inputMode="numeric" className="w-24 rounded border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 font-mono text-sm tabular-nums outline-none focus:border-amber-500/60" />
                </div>
              </Field>
            </>
          )}

          {kind === "transfer" && (
            <label className="flex items-center gap-2 text-sm text-neutral-300">
              <input type="checkbox" checked={perVehicle} onChange={(e) => setPerVehicle(e.target.checked)} className="accent-amber-500" />
              Тариф «за машину» (иначе — с человека)
            </label>
          )}
          {kind === "transfer" && perVehicle && (
            <Field label="Вместимость машины">
              <input value={capacity} onChange={(e) => setCapacity(e.target.value)} inputMode="numeric" className="w-full rounded border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 font-mono text-sm tabular-nums outline-none focus:border-amber-500/60" />
            </Field>
          )}

          {kind === "insurance" && (
            <>
              <Field label="Ставки по длительности «диапазон: цена» (ч/з ; )">
                <input value={brackets} onChange={(e) => setBrackets(e.target.value)} className="w-full rounded border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 font-mono text-sm tabular-nums outline-none focus:border-amber-500/60" />
              </Field>
              <Field label="Коэффициент для детей до 12 лет (0–1)">
                <input value={childCoeff} onChange={(e) => setChildCoeff(e.target.value)} inputMode="decimal" className="w-full rounded border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 font-mono text-sm tabular-nums outline-none focus:border-amber-500/60" />
              </Field>
            </>
          )}

          <button onClick={submit} disabled={saving || !name.trim()} className="w-full rounded bg-amber-500/90 px-4 py-2 text-sm font-semibold text-neutral-950 transition-colors hover:bg-amber-400 disabled:opacity-40">
            Добавить компонент
          </button>
          {kind === "accommodation" && (
            <p className="text-[11px] leading-relaxed text-neutral-500">
              Варианты (вид/питание/размещение) создаются «Матрицей вариантов», цены по датам и квота — в редакторе
              календаря ниже; этот ввод останется типовым юнитом без фасетов.
            </p>
          )}
        </div>
      </Panel>
    </div>
  );
}

/* ── UI-примитивы (плотная «расчётная» эстетика, раздел 8.0) ──────────────── */

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded border border-neutral-800 bg-neutral-900/40">
      <h2 className="border-b border-neutral-800 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-neutral-400">{title}</h2>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-wide text-neutral-500">{label}</span>
      {children}
    </label>
  );
}

function Row({ k, v, tone, currency = "USD" }: { k: string; v: number; tone?: "green"; currency?: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-neutral-400">{k}</dt>
      <dd className={`font-mono tabular-nums ${tone === "green" ? "text-emerald-400" : "text-neutral-200"}`}>{v >= 0 ? "" : "−"}{Math.abs(v).toFixed(2)} {currency}</dd>
    </div>
  );
}
