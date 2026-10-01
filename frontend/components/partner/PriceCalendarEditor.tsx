"use client";

import { useEffect, useMemo, useState } from "react";
import { tourBuilderApi, type BuilderComponent, type ComponentTariff } from "@/lib/tour-builder-api";
import {
  type ApiPeriod,
  type PriceLayer,
  addDaysIso,
  cellPrice,
  compileLayers,
  decompilePeriods,
  findSamePriorityOverlap,
  removeSpecialDay,
  resolvePrice,
  upsertSpecialDay,
} from "@/lib/price-period-resolver";

/**
 * Редактор календаря проживания (шаг «Проживание»):
 *  - селектор варианта (тариф юнита) + вкладки Календарь / Квота;
 *  - 4 блока слоёв: База / Праздничные / Выходные (dow-чипсы) / Особые дни;
 *  - месячная сетка: финальная цена по resolver-зеркалу, hover → источник,
 *    зелёный = ниже базы, терракота = выше (decision: без ограничений цен);
 *  - режим «Матрица даты × варианты» — bulk-заполнение (диапазон/строка/столбец);
 *  - генератор формул (`Делюкс = Стандарт +15%`) и «Копировать календарь»
 *    Source→Target ±% — материализация периодов в целевые тарифы (replace).
 */

interface QuotaRange {
  from: string;
  to: string;
  rooms: number;
}

interface CellInfo {
  price: number;
  base: number;
  title: string;
  special: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const initLayerMap = (tariffs: ComponentTariff[]) =>
  new Map<string, PriceLayer[]>(tariffs.map((t) => [t.id, decompilePeriods(t.periods)]));

const periodsOf = (layers: PriceLayer[]): ApiPeriod[] =>
  compileLayers(layers).map((c, i) => ({ ...c, id: layers[i]?.id ?? `p${i}`, code: layers[i]?.block ?? "", sellable: true }));

/** Квота: строки Availability → диапазоны (запуски одинаковых значений). */
function seedQuota(tariffs: ComponentTariff[]): { ranges: QuotaRange[]; days: Map<string, number> } {
  const rows = (tariffs[0]?.availability ?? []).filter((r) => r.slotsTotal > 0);
  const days = new Map<string, number>(rows.map((r) => [r.date, r.slotsTotal]));
  const dates = [...days.keys()].sort();
  const ranges: QuotaRange[] = [];
  let run: QuotaRange | null = null;
  for (const d of dates) {
    const rooms = days.get(d)!;
    if (run && run.rooms === rooms && addDaysIso(run.to, 1) === d) run.to = d;
    else {
      run = { from: d, to: d, rooms };
      ranges.push(run);
    }
  }
  return { ranges, days };
}

/** Слои вне [from,to] остаются; внутри — вырезаются (BASE не трогаем);
 *  частичные пересечения — обрезка кусков снаружи; incoming добавляются. */
function replaceRange(layers: PriceLayer[], from: string, to: string, incoming: PriceLayer[]): PriceLayer[] {
  const kept: PriceLayer[] = [];
  for (const l of layers) {
    if (l.block === "BASE" || l.endDate < from || l.startDate > to) {
      kept.push(l);
      continue;
    }
    if (l.startDate < from) kept.push({ ...l, endDate: addDaysIso(from, -1) });
    if (l.endDate > to) kept.push({ ...l, startDate: addDaysIso(to, 1) });
  }
  return [...kept, ...incoming];
}

function clipLayer(l: PriceLayer, from: string, to: string): PriceLayer | null {
  if (l.endDate < from || l.startDate > to) return null;
  return { ...l, startDate: l.startDate < from ? from : l.startDate, endDate: l.endDate > to ? to : l.endDate };
}

function scalePrice(price: number, sign: "+" | "-", value: number, unit: "%" | "$"): number {
  const delta = unit === "%" ? price * (value / 100) : value;
  return Math.max(0, round2(sign === "+" ? price + delta : price - delta));
}

/** Заполнение диапазона: одиночная дата → SPECIAL, диапазон → PERIOD-слой. */
function fillRange(layers: PriceLayer[], from: string, to: string, price: number): PriceLayer[] {
  if (from > to) [from, to] = [to, from];
  if (from === to) return upsertSpecialDay(layers, from, price);
  const kept: PriceLayer[] = [];
  for (const l of layers) {
    if (l.block === "BASE" || l.endDate < from || l.startDate > to) {
      kept.push(l);
      continue;
    }
    if (l.startDate < from) kept.push({ ...l, endDate: addDaysIso(from, -1) });
    if (l.endDate > to) kept.push({ ...l, startDate: addDaysIso(to, 1) });
  }
  return [...kept, { id: `fill:${from}:${to}:${price}`, block: "HOLIDAY", startDate: from, endDate: to, price, dayOfWeek: [] }];
}

const parseNum = (v: string): number | null => {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const MONTHS_RU = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const DOW_RU = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

export default function PriceCalendarEditor({
  productId,
  component,
  currency = "USD",
  initialTab = "calendar",
  onNotice,
  onError,
  onSaved,
  onClose,
}: {
  productId: string;
  component: BuilderComponent;
  /** Валюта пакета — для подписей денежных полей/уведомлений. */
  currency?: string;
  initialTab?: "calendar" | "quota";
  onNotice: (msg: string) => void;
  onError: (msg: string) => void;
  onSaved: () => Promise<void>;
  onClose: () => void;
}) {
  const tariffs = component.tariffs;
  const [variantId, setVariantId] = useState(tariffs[0]?.id ?? "");
  const [tab, setTab] = useState<"calendar" | "quota">(initialTab);
  const [bulk, setBulk] = useState(false);
  const [layerMap, setLayerMap] = useState<Map<string, PriceLayer[]>>(() => initLayerMap(tariffs));
  const [dirty, setDirty] = useState<Set<string>>(() => new Set());
  const [saving, setSaving] = useState(false);
  const [month, setMonth] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [paint, setPaint] = useState<"view" | "special" | "erase">("view");
  const [specialPrice, setSpecialPrice] = useState("");
  const [ranges, setRanges] = useState<QuotaRange[]>(() => seedQuota(tariffs).ranges);
  const [origDays, setOrigDays] = useState<Map<string, number>>(() => seedQuota(tariffs).days);
  const [quotaDirty, setQuotaDirty] = useState(false);
  const [modal, setModal] = useState<"formula" | "copy" | null>(null);
  const [fillValue, setFillValue] = useState("");
  const [fillFrom, setFillFrom] = useState("");
  const [fillTo, setFillTo] = useState("");
  const [fillTariffId, setFillTariffId] = useState("");

  /* Синхронизация с новым состоянием после refresh: сохранённые слои
   * перечитываются, несохранённые (dirty) не теряются. */
  useEffect(() => {
    setLayerMap((prev) => {
      const next = new Map(prev);
      for (const t of component.tariffs) {
        if (!dirty.has(t.id) || !next.has(t.id)) next.set(t.id, decompilePeriods(t.periods));
      }
      return next;
    });
    setVariantId((v) => (component.tariffs.some((t) => t.id === v) ? v : (component.tariffs[0]?.id ?? "")));
    if (!quotaDirty) {
      const s = seedQuota(component.tariffs);
      setRanges(s.ranges);
      setOrigDays(s.days);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [component]);

  const selected = tariffs.find((t) => t.id === variantId) ?? tariffs[0];
  const basePrice = selected?.price ?? 0;
  const layers = (selected && layerMap.get(selected.id)) || [];
  const dirtyCount = dirty.size;

  const setSelLayers = (fn: (ls: PriceLayer[]) => PriceLayer[]) => {
    if (!selected) return;
    setLayerMap((m) => new Map(m).set(selected.id, fn(m.get(selected.id) ?? [])));
    setDirty((d) => new Set(d).add(selected.id));
  };

  const setLayersFor = (tariffId: string, fn: (ls: PriceLayer[]) => PriceLayer[]) => {
    setLayerMap((m) => new Map(m).set(tariffId, fn(m.get(tariffId) ?? [])));
    setDirty((d) => new Set(d).add(tariffId));
  };

  const saveOne = async (tariffId: string, allotment: Array<{ date: string; rooms: number }>) => {
    const compiled = compileLayers(layerMap.get(tariffId) ?? []);
    if (findSamePriorityOverlap(compiled)) {
      throw new Error("Слои пересекаются с одинаковым приоритетом (kind/ширина/dow) — уточните диапазоны или дни недели");
    }
    await tourBuilderApi.saveAccommodationCalendar(productId, component.componentId, {
      tariffId,
      periods: compiled,
      // Пустой набор слоёв стирает календарь только если пользователь сам
      // удалил последний слой (dirty); иначе это no-op, а не wipe.
      clearPeriods: dirty.has(tariffId) && compiled.length === 0,
      allotment,
    });
  };

  const quotaDelta = (): Array<{ date: string; rooms: number }> => {
    const current = new Map<string, number>();
    for (const r of ranges) {
      if (r.from > r.to) continue;
      let d = r.from;
      let guard = 0;
      while (d <= r.to && guard++ < 800) {
        current.set(d, r.rooms);
        d = addDaysIso(d, 1);
      }
    }
    const out: Array<{ date: string; rooms: number }> = [...current].map(([date, rooms]) => ({ date, rooms }));
    for (const [date, rooms] of origDays) if (!current.has(date)) out.push({ date, rooms: 0 });
    return out;
  };

  const saveCalendar = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await saveOne(selected.id, quotaDirty ? quotaDelta() : []);
      setDirty((d) => {
        const n = new Set(d);
        n.delete(selected.id);
        return n;
      });
      if (quotaDirty) {
        const s = seedQuota(component.tariffs);
        const rebuilt = new Map(s.days);
        for (const r of ranges) {
          let d = r.from;
          let guard = 0;
          while (d <= r.to && guard++ < 800) {
            rebuilt.set(d, r.rooms);
            d = addDaysIso(d, 1);
          }
        }
        setOrigDays(rebuilt);
        setQuotaDirty(false);
      }
      onNotice("Календарь сохранён");
      await onSaved();
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const saveBulk = async () => {
    setSaving(true);
    try {
      const ids = [...dirty];
      if (!ids.length && quotaDirty) ids.push(tariffs[0]?.id ?? "");
      let quotaSent = false;
      for (const id of ids) {
        if (!id) continue;
        const allotment = quotaDirty && !quotaSent ? quotaDelta() : [];
        if (allotment.length) quotaSent = true;
        await saveOne(id, allotment);
      }
      setDirty(new Set());
      if (quotaDirty) {
        const s = seedQuota(component.tariffs);
        setOrigDays(s.days);
        setQuotaDirty(false);
      }
      onNotice(`Сохранено вариантов: ${ids.filter(Boolean).length}`);
      await onSaved();
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  /* ── Месячная сетка ─────────────────────────────────────────────────────── */

  const periodsSel = useMemo(() => periodsOf(layers), [layers]);

  const cellOf = (date: string): CellInfo => {
    const r = resolvePrice(periodsSel, date);
    const c = cellPrice(periodsSel, date, basePrice);
    const layer = r ? layers.find((l) => l.id === r.periodId) : null;
    const parts: string[] = [`${c.price.toFixed(2)} ${currency}`, `база ${basePrice.toFixed(2)}`];
    if (r) parts.push(`слой: ${layer?.block ?? r.code} (${r.kind}${r.dayOfWeek.length ? `, dow [${r.dayOfWeek.join(",")}]` : ""})`);
    else parts.push("нет слоя → базовая цена");
    return { price: c.price, base: basePrice, title: parts.join(" · "), special: layer?.block === "SPECIAL" };
  };

  const onDayClick = (date: string) => {
    if (paint === "view") return;
    if (paint === "erase") {
      setSelLayers((ls) => removeSpecialDay(ls, date));
      return;
    }
    const price = parseNum(specialPrice);
    if (price == null) {
      onError("Укажите цену для особых дней (число ≥ 0)");
      return;
    }
    setSelLayers((ls) => upsertSpecialDay(ls, date, price));
  };

  /* ── Bulk-заполнение ────────────────────────────────────────────────────── */

  const applyFill = (tariffIds: string[], mode: "range" | "row") => {
    const price = parseNum(fillValue);
    if (price == null) {
      onError("Укажите цену заполнения");
      return;
    }
    if (!fillFrom) {
      onError("Укажите дату(ы)");
      return;
    }
    const from = mode === "row" ? fillFrom : fillFrom;
    const to = mode === "row" ? fillFrom : fillTo || fillFrom;
    for (const id of tariffIds) setLayersFor(id, (ls) => fillRange(ls, from, to, price));
    onNotice(`Заполнено: ${tariffIds.length} вариант(ов) · ${from}${from === to ? "" : `–${to}`} · ${price} ${currency}`);
  };

  /* ── Квота UI ───────────────────────────────────────────────────────────── */

  const addRange = () => {
    const from = fillFrom;
    const to = fillTo || from;
    const rooms = parseNum(fillValue);
    if (!from || from > to || rooms == null) {
      onError("Квота: нужны даты (от ≤ до) и число номеров");
      return;
    }
    setRanges((rs) => [...rs, { from, to, rooms }]);
    setQuotaDirty(true);
  };

  /* ── Рендер ─────────────────────────────────────────────────────────────── */

  const monthCells = useMemo(() => {
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const y = month.getFullYear();
    const m = month.getMonth();
    const first = new Date(y, m, 1);
    const startOffset = (first.getDay() + 6) % 7; // Monday-first
    const days: Array<{ date: string; inMonth: boolean }> = [];
    for (let i = 0; i < startOffset; i++) {
      days.push({ date: fmt(new Date(y, m, -(startOffset - 1 - i))), inMonth: false });
    }
    const last = new Date(y, m + 1, 0).getDate();
    for (let day = 1; day <= last; day++) days.push({ date: `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`, inMonth: true });
    while (days.length < 42) {
      const i = days.length - (startOffset + last) + 1;
      days.push({ date: fmt(new Date(y, m + 1, i)), inMonth: false });
    }
    return days;
  }, [month]);

  if (!selected) {
    return (
      <div className="rounded border border-neutral-800 bg-neutral-900/40 p-6 text-center text-sm text-neutral-500">
        В юните нет вариантов — создайте их в «Матрице вариантов».
        <div className="mt-3">
          <button onClick={onClose} className="rounded border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300">
            Закрыть
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded border border-neutral-800 bg-neutral-900/40">
      {/* Шапка: юнит, варианты, вкладки */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-neutral-400">
            {tab === "quota" ? "Квота (число номеров)" : "Календарь цен"}
          </h3>
          <span className="text-xs text-neutral-500">{component.name}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => { setTab("calendar"); setBulk(false); }}
            className={`rounded-sm px-2.5 py-1 ${tab === "calendar" && !bulk ? "bg-neutral-800 font-semibold text-white" : "text-neutral-400 hover:text-neutral-200"}`}
          >
            Слои
          </button>
          <button
            onClick={() => { setTab("calendar"); setBulk(true); }}
            className={`rounded-sm px-2.5 py-1 ${bulk ? "bg-neutral-800 font-semibold text-white" : "text-neutral-400 hover:text-neutral-200"}`}
          >
            Матрица даты × варианты
          </button>
          <button
            onClick={() => setTab("quota")}
            className={`rounded-sm px-2.5 py-1 ${tab === "quota" ? "bg-neutral-800 font-semibold text-white" : "text-neutral-400 hover:text-neutral-200"}`}
          >
            Квота
          </button>
          <span className="mx-1 h-4 w-px bg-neutral-800" />
          <button onClick={() => setModal("formula")} className="rounded-sm px-2.5 py-1 text-neutral-400 hover:text-neutral-200">
            Генератор формул
          </button>
          <button onClick={() => setModal("copy")} className="rounded-sm px-2.5 py-1 text-neutral-400 hover:text-neutral-200">
            Копировать календарь
          </button>
          <button onClick={onClose} className="rounded-sm px-2.5 py-1 text-neutral-500 hover:text-neutral-300">
            ✕
          </button>
        </div>
      </div>

      {/* Селектор варианта */}
      {tab === "calendar" && (
        <div className="flex flex-wrap gap-1.5 border-b border-neutral-800 px-4 py-2">
          {tariffs.map((t) => {
            const inc = (t.inclusions ?? {}) as Record<string, unknown>;
            const bits = [t.name, typeof inc.viewCode === "string" ? inc.viewCode : "—"];
            return (
              <button
                key={t.id}
                onClick={() => setVariantId(t.id)}
                title={bits.join(" · ")}
                className={`rounded-sm border px-2.5 py-1 text-xs transition-colors ${
                  t.id === variantId
                    ? "border-amber-500/60 bg-amber-500/10 text-amber-200"
                    : "border-neutral-700 text-neutral-300 hover:border-neutral-500"
                }`}
              >
                {t.name}
                <span className="ml-1.5 font-mono text-[10px] text-neutral-500">{t.periods.length} пер.</span>
                {dirty.has(t.id) && <span className="ml-1 text-amber-400">●</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Календарь: слои ──────────────────────────────────────────────── */}
      {tab === "calendar" && !bulk && (
        <div className="grid gap-4 p-4 lg:grid-cols-[380px_1fr]">
          {/* Блоки слоёв */}
          <div className="space-y-3">
            <Block title="База">
              <BaseBlock
                layer={layers.find((l) => l.block === "BASE")}
                onChange={(l) =>
                  setSelLayers((ls) => [...ls.filter((x) => x.block !== "BASE"), ...(l ? [l] : [])])
                }
              />
            </Block>

            <Block title="Праздничные периоды (от–до, повторяемо)">
              <LayerList
                layers={layers.filter((l) => l.block === "HOLIDAY")}
                showDow={false}
                onRemove={(id) => setSelLayers((ls) => ls.filter((x) => x.id !== id))}
                onChange={(id, patch) => setSelLayers((ls) => ls.map((x) => (x.id === id ? { ...x, ...patch } : x)))}
                onAdd={(l) => setSelLayers((ls) => [...ls, { ...l, block: "HOLIDAY" }])}
                block="HOLIDAY"
              />
            </Block>

            <Block title="Выходные (дни недели + период действия)">
              <LayerList
                layers={layers.filter((l) => l.block === "WEEKEND")}
                showDow
                onRemove={(id) => setSelLayers((ls) => ls.filter((x) => x.id !== id))}
                onChange={(id, patch) => setSelLayers((ls) => ls.map((x) => (x.id === id ? { ...x, ...patch } : x)))}
                onAdd={(l) => setSelLayers((ls) => [...ls, { ...l, block: "WEEKEND", dayOfWeek: l.dayOfWeek.length ? l.dayOfWeek : [5, 6] }])}
                block="WEEKEND"
              />
            </Block>

            <Block title="Особые дни (мультивыбор дат в сетке)">
              <div className="space-y-1">
                {layers.filter((l) => l.block === "SPECIAL").map((l) => (
                  <div key={l.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono text-neutral-300">
                      {l.startDate === l.endDate ? l.startDate : `${l.startDate} – ${l.endDate}`}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-mono tabular-nums text-amber-300">{l.price.toFixed(2)}</span>
                      <button
                        onClick={() => setSelLayers((ls) => removeSpecialDay(ls, l.startDate))}
                        className="text-neutral-500 hover:text-red-400"
                      >
                        ✕
                      </button>
                    </span>
                  </div>
                ))}
                {!layers.some((l) => l.block === "SPECIAL") && (
                  <p className="text-[11px] text-neutral-500">Особых дат нет — выберите режим справа и кликните по дням.</p>
                )}
              </div>
            </Block>

            {/* Кисть */}
            <div className="flex flex-wrap items-center gap-2 rounded border border-neutral-800 bg-neutral-900/40 px-3 py-2 text-xs">
              <span className="text-neutral-500">Клик по дню:</span>
              {(["view", "special", "erase"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setPaint(m)}
                  className={`rounded-sm border px-2 py-0.5 ${
                    paint === m ? "border-amber-500/60 bg-amber-500/10 text-amber-200" : "border-neutral-700 text-neutral-400"
                  }`}
                >
                  {m === "view" ? "просмотр" : m === "special" ? "особая дата" : "убрать дату"}
                </button>
              ))}
              {paint === "special" && (
                <input
                  value={specialPrice}
                  onChange={(e) => setSpecialPrice(e.target.value)}
                  inputMode="decimal"
                  placeholder={`цена ${currency}`}
                  className="w-24 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 font-mono text-xs tabular-nums outline-none focus:border-amber-500/60"
                />
              )}
            </div>
          </div>

          {/* Сетка месяца */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <button
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                className="rounded border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300 hover:border-neutral-500"
              >
                ‹
              </button>
              <span className="text-sm font-semibold text-white">
                {MONTHS_RU[month.getMonth()]} {month.getFullYear()}
              </span>
              <button
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                className="rounded border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300 hover:border-neutral-500"
              >
                ›
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
                <div key={d} className="py-1 text-center text-[10px] uppercase text-neutral-500">
                  {d}
                </div>
              ))}
              {monthCells.map((c) => {
                const info = cellOf(c.date);
                const diff = info.price - info.base;
                const tone =
                  diff < -0.001 ? "text-emerald-400" : diff > 0.001 ? "text-orange-400" : "text-neutral-400";
                return (
                  <button
                    key={c.date}
                    title={info.title}
                    onClick={() => onDayClick(c.date)}
                    className={`rounded border p-1 text-left transition-colors ${
                      !c.inMonth
                        ? "border-transparent opacity-30"
                        : info.special
                          ? "border-amber-700/70 bg-amber-900/30 hover:bg-amber-900/50"
                          : "border-neutral-800 bg-neutral-900/60 hover:border-neutral-700"
                    } ${paint !== "view" && c.inMonth ? "cursor-crosshair" : ""}`}
                  >
                    <div className="text-[10px] text-neutral-500">{Number(c.date.slice(8))}</div>
                    <div className={`font-mono text-[10px] font-semibold tabular-nums ${tone}`}>
                      {info.price.toFixed(0)}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-neutral-500">
              <span><span className="text-emerald-400">зелёный</span> = ниже базы</span>
              <span><span className="text-orange-400">терракота</span> = выше базы</span>
              <span>подсветка = особая дата</span>
              <span>hover → источник цены</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk-матрица ─────────────────────────────────────────────────── */}
      {tab === "calendar" && bulk && (
        <div className="p-4">
          <div className="mb-3 flex flex-wrap items-end gap-2 rounded border border-neutral-800 bg-neutral-900/40 px-3 py-2 text-xs">
            <label className="block">
              <span className="mb-0.5 block text-[10px] uppercase text-neutral-500">Цена, {currency}</span>
              <input
                value={fillValue}
                onChange={(e) => setFillValue(e.target.value)}
                inputMode="decimal"
                className="w-24 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 font-mono tabular-nums outline-none focus:border-amber-500/60"
              />
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[10px] uppercase text-neutral-500">От</span>
              <input
                type="date"
                value={fillFrom}
                onChange={(e) => setFillFrom(e.target.value)}
                className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 font-mono outline-none focus:border-amber-500/60"
              />
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[10px] uppercase text-neutral-500">До (для диапазона)</span>
              <input
                type="date"
                value={fillTo}
                onChange={(e) => setFillTo(e.target.value)}
                className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 font-mono outline-none focus:border-amber-500/60"
              />
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[10px] uppercase text-neutral-500">Столбец</span>
              <select
                value={fillTariffId || variantId}
                onChange={(e) => setFillTariffId(e.target.value)}
                className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 outline-none focus:border-amber-500/60"
              >
                {tariffs.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={() => applyFill([fillTariffId || variantId], "range")}
              className="rounded border border-neutral-700 px-2.5 py-1.5 text-neutral-200 hover:border-amber-500/60"
            >
              Заполнить диапазон (столбец)
            </button>
            <button
              onClick={() => applyFill(tariffs.map((t) => t.id), "row")}
              className="rounded border border-neutral-700 px-2.5 py-1.5 text-neutral-200 hover:border-amber-500/60"
            >
              Заполнить строку (все варианты)
            </button>
            <button
              onClick={() => applyFill(tariffs.map((t) => t.id), "range")}
              className="rounded border border-neutral-700 px-2.5 py-1.5 text-neutral-200 hover:border-amber-500/60"
            >
              Диапазон × все варианты
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-neutral-800 text-left text-[10px] uppercase text-neutral-500">
                  <th className="px-2 py-1.5 font-medium">Дата</th>
                  {tariffs.map((t) => (
                    <th key={t.id} className="px-2 py-1.5 font-medium">
                      {t.name}
                      {dirty.has(t.id) && <span className="ml-1 text-amber-400">●</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/50">
                {monthCells
                  .filter((c) => c.inMonth)
                  .map((c) => (
                    <tr key={c.date} className="hover:bg-neutral-900/40">
                      <td className="whitespace-nowrap px-2 py-1 font-mono text-[11px] text-neutral-400">
                        {c.date} <span className="text-neutral-600">{DOW_RU[new Date(c.date + "T00:00:00Z").getUTCDay()]}</span>
                      </td>
                      {tariffs.map((t) => {
                        const ls = layerMap.get(t.id) ?? [];
                        const info = cellPrice(periodsOf(ls), c.date, t.price ?? 0);
                        const diff = info.price - (t.price ?? 0);
                        return (
                          <td
                            key={t.id}
                            title={`база ${(t.price ?? 0).toFixed(2)}`}
                            className={`px-2 py-1 font-mono tabular-nums ${
                              diff < -0.001 ? "text-emerald-400" : diff > 0.001 ? "text-orange-400" : "text-neutral-400"
                            }`}
                          >
                            {info.price.toFixed(0)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Квота ────────────────────────────────────────────────────────── */}
      {tab === "quota" && (
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-end gap-2 rounded border border-neutral-800 bg-neutral-900/40 px-3 py-2 text-xs">
            <label className="block">
              <span className="mb-0.5 block text-[10px] uppercase text-neutral-500">От</span>
              <input type="date" value={fillFrom} onChange={(e) => setFillFrom(e.target.value)} className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 font-mono outline-none focus:border-amber-500/60" />
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[10px] uppercase text-neutral-500">До</span>
              <input type="date" value={fillTo} onChange={(e) => setFillTo(e.target.value)} className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 font-mono outline-none focus:border-amber-500/60" />
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[10px] uppercase text-neutral-500">Номеров</span>
              <input value={fillValue} onChange={(e) => setFillValue(e.target.value)} inputMode="numeric" className="w-20 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 font-mono tabular-nums outline-none focus:border-amber-500/60" />
            </label>
            <button onClick={addRange} className="rounded border border-neutral-700 px-2.5 py-1.5 text-neutral-200 hover:border-amber-500/60">
              + диапазон квоты
            </button>
            <span className="text-[11px] text-neutral-500">
              Квота одна на тип номера и синхронизируется на все варианты; удалённые даты обнуляются.
            </span>
          </div>

          <table className="w-full text-xs">
            <tbody className="divide-y divide-neutral-800/60">
              {ranges.map((r, i) => (
                <tr key={`${r.from}-${r.to}-${i}`}>
                  <td className="px-2 py-1.5 font-mono text-neutral-300">
                    {r.from}{r.from === r.to ? "" : ` – ${r.to}`}
                  </td>
                  <td className="px-2 py-1.5 font-mono tabular-nums text-amber-300">{r.rooms} номер(ов)</td>
                  <td className="px-2 py-1.5 text-right">
                    <button
                      onClick={() => {
                        setRanges((rs) => rs.filter((_, j) => j !== i));
                        setQuotaDirty(true);
                      }}
                      className="text-neutral-500 hover:text-red-400"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
              {!ranges.length && (
                <tr>
                  <td colSpan={3} className="px-2 py-4 text-center text-neutral-500">
                    Квота не задана — в quote availability будет NOT_CONFIGURED (не «без ограничений»).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Футер сохранения */}
      <div className="flex items-center justify-between border-t border-neutral-800 px-4 py-2.5">
        <span className="text-[11px] text-neutral-500">
          {tab === "quota"
            ? quotaDirty
              ? "Квота изменена (не сохранена)"
              : "Квота синхронизирована"
            : dirtyCount
              ? `Изменено вариантов: ${dirtyCount}${quotaDirty ? " + квота" : ""}`
              : "Изменений нет"}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => (bulk ? void saveBulk() : void saveCalendar())}
            disabled={saving || (tab === "calendar" && !dirty.size && !quotaDirty) || (tab === "quota" && !quotaDirty)}
            className="rounded bg-amber-500/90 px-4 py-1.5 text-xs font-semibold text-neutral-950 transition-colors hover:bg-amber-400 disabled:opacity-40"
          >
            {saving ? "Сохранение…" : tab === "quota" ? "Сохранить квоту" : bulk ? "Сохранить все изменения" : "Сохранить календарь"}
          </button>
        </div>
      </div>

      {modal && (
        <MaterializeModal
          mode={modal}
          currency={currency}
          tariffs={tariffs}
          getLayers={(id) => layerMap.get(id) ?? decompilePeriods(tariffs.find((t) => t.id === id)?.periods ?? [])}
          onApply={(changes) => {
            setLayerMap((m) => {
              const next = new Map(m);
              for (const [id, ls] of changes) next.set(id, ls);
              return next;
            });
            setDirty((d) => {
              const n = new Set(d);
              for (const id of changes.keys()) n.add(id);
              return n;
            });
            setModal(null);
            onNotice(`Обновлено вариантов: ${changes.size}`);
          }}
          onClose={() => setModal(null)}
          onError={onError}
        />
      )}
    </div>
  );
}

/* ── Подкомпоненты ─────────────────────────────────────────────────────────── */

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded border border-neutral-800 bg-neutral-900/40">
      <h4 className="border-b border-neutral-800 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-neutral-500">
        {title}
      </h4>
      <div className="p-3">{children}</div>
    </section>
  );
}

const inputCls =
  "rounded border border-neutral-700 bg-neutral-900 px-2 py-1 font-mono text-xs outline-none focus:border-amber-500/60";

function BaseBlock({ layer, onChange }: { layer: PriceLayer | undefined; onChange: (l: PriceLayer | null) => void }) {
  const [from, setFrom] = useState(layer?.startDate ?? "");
  const [to, setTo] = useState(layer?.endDate ?? "");
  const [price, setPrice] = useState(layer ? String(layer.price) : "");
  useEffect(() => {
    setFrom(layer?.startDate ?? "");
    setTo(layer?.endDate ?? "");
    setPrice(layer ? String(layer.price) : "");
  }, [layer]);
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        <label className="block">
          <span className="mb-0.5 block text-[10px] uppercase text-neutral-500">С</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-0.5 block text-[10px] uppercase text-neutral-500">По</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-0.5 block text-[10px] uppercase text-neutral-500">Цена</span>
          <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" className={`${inputCls} w-20 tabular-nums`} />
        </label>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => {
            const p = parseNum(price);
            if (!from || !to || from > to || p == null) return;
            onChange({ id: "base", block: "BASE", startDate: from, endDate: to, price: p, dayOfWeek: [] });
          }}
          className="rounded border border-neutral-700 px-2.5 py-1 text-xs text-neutral-200 hover:border-amber-500/60"
        >
          Установить базу
        </button>
        {layer && (
          <button onClick={() => onChange(null)} className="rounded border border-neutral-700 px-2.5 py-1 text-xs text-neutral-500 hover:text-red-400">
            Убрать
          </button>
        )}
        {!layer && <span className="text-[11px] text-neutral-500">База не задана → цена тарифа</span>}
      </div>
    </div>
  );
}

function LayerList({
  layers,
  block,
  showDow,
  onRemove,
  onChange,
  onAdd,
}: {
  layers: PriceLayer[];
  block: "HOLIDAY" | "WEEKEND";
  showDow: boolean;
  onRemove: (id: string) => void;
  onChange: (id: string, patch: Partial<PriceLayer>) => void;
  onAdd: (l: PriceLayer) => void;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [price, setPrice] = useState("");
  const [dow, setDow] = useState<number[]>(block === "WEEKEND" ? [5, 6] : []);

  const add = () => {
    const p = parseNum(price);
    if (!from || !to || from > to || p == null) return;
    onAdd({
      id: `${block}:${from}:${to}:${price}:${dow.join(",")}:${Date.now()}`,
      block,
      startDate: from,
      endDate: to,
      price: p,
      dayOfWeek: showDow ? [...dow].sort((a, b) => a - b) : [],
    });
    setPrice("");
  };

  return (
    <div className="space-y-2">
      {layers.map((l) => (
        <div key={l.id} className="space-y-1 rounded border border-neutral-800/70 p-2">
          <div className="flex items-center gap-2 text-xs">
            <input type="date" value={l.startDate} onChange={(e) => onChange(l.id, { startDate: e.target.value })} className={inputCls} />
            <input type="date" value={l.endDate} onChange={(e) => onChange(l.id, { endDate: e.target.value })} className={inputCls} />
            <input
              value={String(l.price)}
              onChange={(e) => {
                const p = parseNum(e.target.value);
                if (p != null) onChange(l.id, { price: p });
              }}
              inputMode="decimal"
              className={`${inputCls} w-20 tabular-nums`}
            />
            <button onClick={() => onRemove(l.id)} className="ml-auto text-neutral-500 hover:text-red-400">
              ✕
            </button>
          </div>
          {showDow && (
            <div className="flex flex-wrap gap-1">
              {DOW_RU.map((label, i) => (
                <button
                  key={label}
                  onClick={() =>
                    onChange(l.id, {
                      dayOfWeek: l.dayOfWeek.includes(i) ? l.dayOfWeek.filter((d) => d !== i) : [...l.dayOfWeek, i].sort((a, b) => a - b),
                    })
                  }
                  className={`rounded-sm border px-1.5 py-0.5 text-[10px] ${
                    l.dayOfWeek.includes(i) ? "border-amber-500/60 bg-amber-500/10 text-amber-200" : "border-neutral-700 text-neutral-500"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}

      <div className="flex flex-wrap items-end gap-2 border-t border-neutral-800/70 pt-2">
        <label className="block">
          <span className="mb-0.5 block text-[10px] uppercase text-neutral-500">С</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-0.5 block text-[10px] uppercase text-neutral-500">По</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-0.5 block text-[10px] uppercase text-neutral-500">Цена</span>
          <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" className={`${inputCls} w-20 tabular-nums`} />
        </label>
        {showDow && (
          <div className="flex gap-1">
            <button
              onClick={() => setDow([5, 6])}
              className="rounded-sm border border-neutral-700 px-1.5 py-1 text-[10px] text-neutral-400 hover:border-amber-500/60"
            >
              пресет Пт–Вс
            </button>
            <button
              onClick={() => setDow([6, 0])}
              className="rounded-sm border border-neutral-700 px-1.5 py-1 text-[10px] text-neutral-400 hover:border-amber-500/60"
            >
              пресет Сб–Вс
            </button>
            <div className="flex gap-0.5">
              {DOW_RU.map((label, i) => (
                <button
                  key={label}
                  onClick={() => setDow((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i].sort((a, b) => a - b)))}
                  className={`rounded-sm border px-1 py-1 text-[10px] ${
                    dow.includes(i) ? "border-amber-500/60 bg-amber-500/10 text-amber-200" : "border-neutral-700 text-neutral-500"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
        <button onClick={add} className="rounded border border-neutral-700 px-2.5 py-1 text-xs text-neutral-200 hover:border-amber-500/60">
          + добавить
        </button>
      </div>
    </div>
  );
}

/* ── Модалка материализации (формулы / копирование) ───────────────────────── */

const FORMULA_RE = /^\s*(.+?)\s*=\s*(.+?)\s*([+-])\s*([\d.]+)\s*(%|\$)?\s*$/;

function MaterializeModal({
  mode,
  currency = "USD",
  tariffs,
  getLayers,
  onApply,
  onClose,
  onError,
}: {
  mode: "formula" | "copy";
  /** Валюта пакета — для подписи единицы абсолютного смещения. */
  currency?: string;
  tariffs: ComponentTariff[];
  getLayers: (tariffId: string) => PriceLayer[];
  onApply: (changes: Map<string, PriceLayer[]>) => void;
  onClose: () => void;
  onError: (msg: string) => void;
}) {
  const [text, setText] = useState("Делюкс = Стандарт +15%");
  const [sourceId, setSourceId] = useState(tariffs[0]?.id ?? "");
  const [targets, setTargets] = useState<Set<string>>(() => new Set(tariffs.slice(1).map((t) => t.id)));
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sign, setSign] = useState<"+" | "-">("+");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState<"%" | "$">("%");

  const nameKey = (s: string) => s.trim().toLowerCase();
  const byName = new Map(tariffs.map((t) => [nameKey(t.name), t]));

  const apply = () => {
    if (!from || !to || from > to) {
      onError("Укажите диапазон дат (от ≤ до)");
      return;
    }
    const changes = new Map<string, PriceLayer[]>();

    if (mode === "formula") {
      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
      const chain = new Map<string, PriceLayer[]>(); // имя ЦЕЛИ → её слои (после формулы)
      for (const line of lines) {
        const m = line.match(FORMULA_RE);
        if (!m) {
          onError(`Строка не распознана: «${line}» (формат: Цель = Источник +15% | +40$)`);
          return;
        }
        const [, dstRaw, srcRaw, s, numStr, u] = m;
        const amt = Number(numStr);
        if (!Number.isFinite(amt)) {
          onError(`Некорректное число в строке: «${line}»`);
          return;
        }
        const srcKey = nameKey(srcRaw);
        const dstKey = nameKey(dstRaw);
        const srcTariff = byName.get(srcKey);
        const srcLayers = chain.get(srcKey) ?? (srcTariff ? decompilePeriods(srcTariff.periods) : null);
        if (!srcLayers) {
          onError(`Источник «${srcRaw}» не найден среди вариантов этого типа номера`);
          return;
        }
        const scaled = srcLayers
          .map((l) => clipLayer(l, from, to))
          .filter((l): l is PriceLayer => !!l)
          .map((l) => ({ ...l, price: scalePrice(l.price, s as "+" | "-", amt, (u as "%" | "$") ?? "$") }));
        chain.set(dstKey, [...(chain.get(dstKey) ?? []), ...scaled]);
      }
      const applied = new Set<string>();
      for (const line of lines) {
        const m = line.match(FORMULA_RE)!;
        const dstKey = nameKey(m[1]);
        if (applied.has(dstKey)) continue;
        applied.add(dstKey);
        const dstTariff = byName.get(dstKey);
        if (!dstTariff) {
          onError(`Цель «${m[1]}» не найдена среди вариантов этого типа номера`);
          return;
        }
        changes.set(dstTariff.id, replaceRange(getLayers(dstTariff.id), from, to, chain.get(dstKey) ?? []));
      }
    } else {
      const v = Number(value);
      if (!Number.isFinite(v) || v < 0) {
        onError("Укажите величину смещения (число ≥ 0)");
        return;
      }
      const src = getLayers(sourceId)
        .map((l) => clipLayer(l, from, to))
        .filter((l): l is PriceLayer => !!l)
        .map((l) => ({ ...l, price: scalePrice(l.price, sign, v, unit) }));
      for (const id of targets) {
        if (id === sourceId) continue;
        changes.set(id, replaceRange(getLayers(id), from, to, src));
      }
      if (!changes.size) {
        onError("Выберите хотя бы один целевой вариант");
        return;
      }
    }

    onApply(changes);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded border border-neutral-800 bg-neutral-950 p-4" onClick={(e) => e.stopPropagation()}>
        <h4 className="text-sm font-semibold text-white">
          {mode === "formula" ? "Генератор формул (лестница комнат)" : "Копировать календарь"}
        </h4>

        {mode === "formula" ? (
          <>
            <p className="mt-1 text-xs leading-relaxed text-neutral-500">
              По строкам в порядке сверху вниз: <span className="font-mono">Делюкс = Стандарт +15%</span> ·{" "}
              <span className="font-mono">Делюкс = Стандарт +40$</span> ($ — сумма в валюте пакета, {currency}). Цепочка считает от уже пересчитанного источника.
              Материализация — периоды внутри диапазона дат в целевые варианты (заменяются).
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              className={`${inputCls} mt-2 w-full font-mono`}
            />
          </>
        ) : (
          <div className="mt-2 space-y-2 text-xs">
            <label className="block">
              <span className="mb-0.5 block text-[10px] uppercase text-neutral-500">Источник</span>
              <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className={`${inputCls} w-full font-sans`}>
                {tariffs.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <span className="mb-1 block text-[10px] uppercase text-neutral-500">Цели</span>
              <div className="flex flex-wrap gap-1.5">
                {tariffs.map((t) => (
                  <button
                    key={t.id}
                    onClick={() =>
                      setTargets((s) => {
                        const n = new Set(s);
                        if (n.has(t.id)) n.delete(t.id);
                        else n.add(t.id);
                        return n;
                      })
                    }
                    className={`rounded-sm border px-2 py-0.5 ${
                      targets.has(t.id) && t.id !== sourceId
                        ? "border-amber-500/60 bg-amber-500/10 text-amber-200"
                        : "border-neutral-700 text-neutral-500"
                    }`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-end gap-2">
              <label className="block">
                <span className="mb-0.5 block text-[10px] uppercase text-neutral-500">Смещение</span>
                <span className="flex gap-1">
                  <select value={sign} onChange={(e) => setSign(e.target.value as "+" | "-")} className={inputCls}>
                    <option value="+">+</option>
                    <option value="-">−</option>
                  </select>
                  <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder="15" className={`${inputCls} w-16 tabular-nums`} />
                  <select value={unit} onChange={(e) => setUnit(e.target.value as "%" | "$")} className={inputCls}>
                    <option value="%">%</option>
                    <option value="$">{currency}</option>
                  </select>
                </span>
              </label>
            </div>
          </div>
        )}

        <div className="mt-3 flex items-end gap-2">
          <label className="block">
            <span className="mb-0.5 block text-[10px] uppercase text-neutral-500">Диапазон с</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-0.5 block text-[10px] uppercase text-neutral-500">по</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
          </label>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:border-neutral-500">
            Отмена
          </button>
          <button onClick={apply} className="rounded bg-amber-500/90 px-3 py-1.5 text-xs font-semibold text-neutral-950 hover:bg-amber-400">
            Материализовать
          </button>
        </div>
      </div>
    </div>
  );
}
