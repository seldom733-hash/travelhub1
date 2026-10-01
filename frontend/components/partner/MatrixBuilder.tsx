"use client";

import { useEffect, useMemo, useState } from "react";
import { type BuilderComponent, type DictionariesResponse } from "@/lib/tour-builder-api";
import {
  type VariantFacets,
  collectVariantRefs,
  combineAxes,
  diffWithExisting,
  facetKey,
  mergeRows,
} from "@/lib/matrix-combine";

/**
 * Конструктор матрицы вариантов (шаг «Проживание»). Каждый тип опции —
 * отдельный визуальный блок с галочками: Тип номера × Вид × Питание ×
 * Размещение × Ext. Bed × Ext. Sofa → «Сгенерировать комбинации» (Cartesian)
 * → таблица строк. Ext. Bed/Ext.Sofa — булевы оси; фикс-цена опции хранится
 * на уровне пакета (USD/сут, 0 = бесплатно). Сверка с существующими
 * вариантами по facetKey: «✓ есть» не пересоздаётся; редакт фасетов =
 * updateVariant (календарь сохраняется, план §2.2.2).
 */

const BLANK_VIEW = "-noview-";

interface EditState {
  key: string;
  ref: { componentId: string; variantId: string };
  facets: VariantFacets;
}

const emptyManual = { roomTypeId: "", viewCode: "", mealCode: "", placementCode: "", extBed: false, extSofa: false };

/** Галочка опции в блоке. */
function Check({
  on,
  onChange,
  children,
  title,
  disabled,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-center gap-1.5 text-xs text-neutral-200 ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
      title={title}
    >
      <input
        type="checkbox"
        checked={on}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 accent-amber-500"
      />
      <span>{children}</span>
    </label>
  );
}

/** Отдельная карточка-блок одного типа опций. */
function AxisCard({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-neutral-800 bg-neutral-900/40">
      <div className="border-b border-neutral-800 px-4 py-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-neutral-400">{title}</h3>
        {hint && <p className="mt-0.5 text-[11px] text-neutral-500">{hint}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5">{children}</div>
    </div>
  );
}

export default function MatrixBuilder({
  dictionaries,
  components,
  busy,
  currency = "USD",
  extraBedPrice,
  extraSofaPrice,
  babyCot,
  onEnsureUnit,
  onCreateVariant,
  onUpdateVariant,
  onRemoveVariant,
  onSaveExtPrices,
  onToggleBabyCot,
  onError,
}: {
  dictionaries: DictionariesResponse | null;
  components: BuilderComponent[];
  busy?: boolean;
  /** Валюта пакета — для подписей цен доп.опций. */
  currency?: string;
  /** Фикс-цена Ext.Bed/Ext.Sofa пакета, в валюте пакета/сут (null = 0 = бесплатно). */
  extraBedPrice?: number | null;
  extraSofaPrice?: number | null;
  /** Детская кровать (Baby Cot) — галочка «возможность предоставить», не ось матрицы. */
  babyCot?: boolean;
  /** Создаёт юнит под тип номера, если ещё нет (возвращает componentId | null). */
  onEnsureUnit: (roomTypeId: string) => Promise<string | null>;
  onCreateVariant: (componentId: string, facets: VariantFacets) => Promise<void>;
  onUpdateVariant: (componentId: string, variantId: string, facets: VariantFacets) => Promise<void>;
  onRemoveVariant: (componentId: string, variantId: string) => Promise<void>;
  /** Сохраняет фикс-цены доп.опций пакета (package-rules). Бросает при ошибке. */
  onSaveExtPrices: (prices: { extraBedPrice: number; extraSofaPrice: number }) => Promise<void>;
  /** Переключает Baby Cot (package-rules). Бросает при ошибке. */
  onToggleBabyCot: (v: boolean) => Promise<void>;
  onError: (msg: string) => void;
}) {
  const [sel, setSel] = useState<{
    rooms: Set<string>;
    views: Set<string>;
    meals: Set<string>;
    placements: Set<string>;
    extBed: Set<string>;
    extSofa: Set<string>;
  }>(() => ({
    rooms: new Set(),
    views: new Set(),
    meals: new Set(),
    placements: new Set(),
    // Ось по умолчанию = «без доп.опции» — матрица работает без доп.осей.
    extBed: new Set(["no"]),
    extSofa: new Set(["no"]),
  }));
  const [generated, setGenerated] = useState<VariantFacets[] | null>(null);
  const [manual, setManual] = useState<VariantFacets[]>([]);
  const [manualRow, setManualRow] = useState(emptyManual);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [prices, setPrices] = useState({ bed: String(extraBedPrice ?? 0), sofa: String(extraSofaPrice ?? 0) });
  const [savingPrices, setSavingPrices] = useState(false);
  const [savingCot, setSavingCot] = useState(false);

  useEffect(() => {
    setPrices({ bed: String(extraBedPrice ?? 0), sofa: String(extraSofaPrice ?? 0) });
  }, [extraBedPrice, extraSofaPrice]);

  /* Справочники показываем только на английском (en → code), без переводов. */
  const roomTypes = useMemo(
    () => (dictionaries?.roomTypes ?? []).map((e) => ({ id: e.id, code: e.code, name: e.names?.en || e.code })),
    [dictionaries],
  );
  const views = useMemo(
    () => [
      ...(dictionaries?.viewTypes ?? []).map((e) => ({ code: e.code, name: e.names?.en || e.code })),
      { code: "", name: "— (no view)" },
    ],
    [dictionaries],
  );
  const meals = useMemo(
    () => (dictionaries?.mealTypes ?? []).map((e) => ({ id: e.code, code: e.code, name: e.names?.en || e.code })),
    [dictionaries],
  );
  const placements = useMemo(
    () => (dictionaries?.placementTypes ?? []).map((e) => ({ id: e.code, code: e.code, name: e.names?.en || e.code })),
    [dictionaries],
  );

  const refs = useMemo(() => collectVariantRefs(components), [components]);
  const rows = useMemo(() => (generated ? mergeRows(generated, manual) : manual), [generated, manual]);
  const diffed = useMemo(() => diffWithExisting(rows, refs), [rows, refs]);
  const missing = diffed.filter((r) => !r.ref);

  const toggle = (axis: keyof typeof sel, key: string) => {
    setSel((s) => {
      const next = new Set(s[axis]);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { ...s, [axis]: next };
    });
  };

  /** Множество {"no","yes"} → значения оси в порядке [false, true]. */
  const extValues = (s: Set<string>) => Array.from(s).sort().map((v) => v === "yes");

  const generate = () => {
    setGenerated(
      combineAxes({
        roomTypes: roomTypes.filter((r) => sel.rooms.has(r.id)),
        views: views.filter((v) => sel.views.has(v.code || BLANK_VIEW)).map((v) => ({ code: v.code || null, name: v.name })),
        meals: meals.filter((m) => sel.meals.has(m.code)),
        placements: placements.filter((p) => sel.placements.has(p.code)),
        extraBed: extValues(sel.extBed),
        extraSofa: extValues(sel.extSofa),
      }),
    );
    setEdit(null);
  };

  /** Создать строку: ensure-юнит → createVariant. */
  const createRow = async (facets: VariantFacets): Promise<string | null> => {
    const existing = components.find((c) => c.payload.roomTypeId === facets.roomTypeId);
    const componentId = existing?.componentId ?? (await onEnsureUnit(facets.roomTypeId));
    if (!componentId) return null;
    await onCreateVariant(componentId, facets);
    return componentId;
  };

  const createAllMissing = async () => {
    for (const m of [...missing]) {
      try {
        await createRow(m.facets);
      } catch (e) {
        onError(e instanceof Error ? e.message : String(e));
        return;
      }
    }
  };

  const saveEdit = async () => {
    if (!edit) return;
    try {
      await onUpdateVariant(edit.ref.componentId, edit.ref.variantId, edit.facets);
      setEdit(null);
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    }
  };

  const addManualRow = () => {
    if (!manualRow.roomTypeId || !manualRow.mealCode || !manualRow.placementCode) return;
    const facets: VariantFacets = {
      roomTypeId: manualRow.roomTypeId,
      roomTypeName: roomTypes.find((r) => r.id === manualRow.roomTypeId)?.name,
      viewCode: manualRow.viewCode || null,
      mealCode: manualRow.mealCode,
      placementCode: manualRow.placementCode,
      ...(manualRow.extBed ? { extraBed: true } : {}),
      ...(manualRow.extSofa ? { extraSofa: true } : {}),
    };
    const merged = mergeRows(manual, [facets]);
    if (merged.length > manual.length) setManual(merged);
    setManualRow(emptyManual);
  };

  const bedNum = Number(prices.bed || 0);
  const sofaNum = Number(prices.sofa || 0);
  const pricesDirty =
    (Number.isFinite(bedNum) ? Math.max(0, bedNum) : 0) !== (extraBedPrice ?? 0) ||
    (Number.isFinite(sofaNum) ? Math.max(0, sofaNum) : 0) !== (extraSofaPrice ?? 0);

  const savePrices = async () => {
    const bed = Number.isFinite(bedNum) ? Math.max(0, bedNum) : 0;
    const sofa = Number.isFinite(sofaNum) ? Math.max(0, sofaNum) : 0;
    setSavingPrices(true);
    try {
      await onSaveExtPrices({ extraBedPrice: bed, extraSofaPrice: sofa });
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingPrices(false);
    }
  };

  /** Baby Cot — простая галочка (не ось матрицы), сохраняется сразу. */
  const toggleBabyCot = async (v: boolean) => {
    setSavingCot(true);
    try {
      await onToggleBabyCot(v);
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingCot(false);
    }
  };

  const viewLabel = (code: string | null) => (code == null ? "—" : (views.find((v) => v.code === code)?.name ?? code));
  const labelOf = (list: Array<{ code: string; name: string }>, code: string) => list.find((x) => x.code === code)?.name ?? code;

  return (
    <div className="space-y-3">
      <AxisCard title="Тип номера" hint="Галочками отметьте типы комнат — из них соберётся матрица">
        {roomTypes.length ? (
          roomTypes.map((r) => (
            <Check key={r.id} on={sel.rooms.has(r.id)} onChange={() => toggle("rooms", r.id)}>
              {r.name}
            </Check>
          ))
        ) : (
          <span className="text-xs text-neutral-500">справочник не загружен</span>
        )}
      </AxisCard>

      <AxisCard title="Вид из окна" hint="«— (без вида)» — вариант без вида (viewCode пустой)">
        {views.map((v) => (
          <Check key={v.code || BLANK_VIEW} on={sel.views.has(v.code || BLANK_VIEW)} onChange={() => toggle("views", v.code || BLANK_VIEW)}>
            {v.name}
          </Check>
        ))}
      </AxisCard>

      <AxisCard title="Питание">
        {meals.map((m) => (
          <Check key={m.code} on={sel.meals.has(m.code)} onChange={() => toggle("meals", m.code)}>
            {m.name}
          </Check>
        ))}
      </AxisCard>

      <AxisCard title="Размещение">
        {placements.map((p) => (
          <Check key={p.code} on={sel.placements.has(p.code)} onChange={() => toggle("placements", p.code)}>
            {p.name}
          </Check>
        ))}
      </AxisCard>

      {/* Блок доп. опций: две булевы оси + фикс-цены пакета */}
      <div className="rounded border border-neutral-800 bg-neutral-900/40">
        <div className="border-b border-neutral-800 px-4 py-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-neutral-400">Доп. опции номера</h3>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            Ext. Bed и Ext. Sofa — отдельные оси матрицы (умножают комбинации). Цена фиксированная, {currency}/сут на номер; 0 = бесплатно.
          </p>
        </div>
        <div className="space-y-2 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="w-44 shrink-0 text-[11px] uppercase tracking-wide text-neutral-500">Доп. кровать (Ext. Bed)</span>
            <Check on={sel.extBed.has("no")} onChange={() => toggle("extBed", "no")}>
              Без
            </Check>
            <Check on={sel.extBed.has("yes")} onChange={() => toggle("extBed", "yes")}>
              Ext. Bed
            </Check>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="w-44 shrink-0 text-[11px] uppercase tracking-wide text-neutral-500">Диван (Ext. Sofa)</span>
            <Check on={sel.extSofa.has("no")} onChange={() => toggle("extSofa", "no")}>
              Без
            </Check>
            <Check on={sel.extSofa.has("yes")} onChange={() => toggle("extSofa", "yes")}>
              Ext. Sofa
            </Check>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-neutral-800/70 pt-2.5">
            <span className="w-44 shrink-0 text-[11px] uppercase tracking-wide text-neutral-500">Детская кровать</span>
            <Check
              on={babyCot === true}
              onChange={(v) => void toggleBabyCot(v)}
              disabled={savingCot || busy}
              title="Не участвует в матрице — просто возможность предоставить"
            >
              Baby Cot (бесплатно)
            </Check>
            <span className="text-[11px] text-neutral-500">не входит в матрицу — просто возможность предоставить</span>
          </div>
          <div className="flex flex-wrap items-end gap-3 border-t border-neutral-800/70 pt-2.5">
            <label className="block">
              <span className="mb-0.5 block text-[10px] uppercase tracking-wide text-neutral-500">Цена Ext. Bed, {currency}/сут</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={prices.bed}
                onChange={(e) => setPrices((p) => ({ ...p, bed: e.target.value }))}
                className="w-32 rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs outline-none focus:border-amber-500/60"
              />
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[10px] uppercase tracking-wide text-neutral-500">Цена Ext. Sofa, {currency}/сут</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={prices.sofa}
                onChange={(e) => setPrices((p) => ({ ...p, sofa: e.target.value }))}
                className="w-32 rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs outline-none focus:border-amber-500/60"
              />
            </label>
            <button
              onClick={() => void savePrices()}
              disabled={savingPrices || !pricesDirty}
              className="rounded border border-emerald-700/70 px-3 py-1.5 text-xs text-emerald-300 transition-colors hover:border-emerald-500 disabled:opacity-40"
            >
              Сохранить цены
            </button>
            <span className="text-[11px] text-neutral-500">0 = бесплатно</span>
          </div>
        </div>
      </div>

      {/* Матрица: кнопки + таблица строк */}
      <div className="rounded border border-neutral-800 bg-neutral-900/40">
        <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-2.5">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-neutral-400">Матрица вариантов</h3>
          <div className="flex gap-2">
            <button
              onClick={generate}
              disabled={
                busy ||
                !sel.rooms.size ||
                !sel.views.size ||
                !sel.meals.size ||
                !sel.placements.size ||
                !sel.extBed.size ||
                !sel.extSofa.size
              }
              className="rounded bg-amber-500/90 px-3 py-1 text-xs font-semibold text-neutral-950 transition-colors hover:bg-amber-400 disabled:opacity-40"
            >
              Сгенерировать комбинации
            </button>
            <button
              onClick={() => void createAllMissing()}
              disabled={busy || !missing.length}
              className="rounded border border-emerald-700/70 px-3 py-1 text-xs text-emerald-300 transition-colors hover:border-emerald-500 disabled:opacity-40"
            >
              Создать недостающие ({missing.length})
            </button>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="px-4 py-5 text-center text-xs text-neutral-500">
            Выберите галочки в блоках выше и нажмите «Сгенерировать комбинации» — либо добавьте строку вручную.
          </p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-neutral-800 text-left text-[10px] uppercase tracking-wide text-neutral-500">
                <th className="px-4 py-2 font-medium">Тип</th>
                <th className="px-2 py-2 font-medium">Вид</th>
                <th className="px-2 py-2 font-medium">Питание</th>
                <th className="px-2 py-2 font-medium">Размещение</th>
                <th className="px-2 py-2 font-medium">Ext.Bed</th>
                <th className="px-2 py-2 font-medium">Ext.Sofa</th>
                <th className="px-2 py-2 font-medium">Статус</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {diffed.map(({ facets, ref }) => {
                const key = facetKey(facets);
                const editing = edit?.key === key;
                const roomName = roomTypes.find((r) => r.id === facets.roomTypeId)?.name ?? facets.roomTypeId;
                const hasUnit = components.some((c) => c.payload.roomTypeId === facets.roomTypeId);
                return (
                  <tr key={key} className={editing ? "bg-amber-500/5" : undefined}>
                    <td className="px-4 py-1.5 text-white">{roomName}</td>
                    <td className="px-2 py-1.5">{viewLabel(facets.viewCode)}</td>
                    <td className="px-2 py-1.5">{labelOf(meals, facets.mealCode)}</td>
                    <td className="px-2 py-1.5">{labelOf(placements, facets.placementCode)}</td>
                    <td className="px-2 py-1.5">{facets.extraBed ? "✓" : "—"}</td>
                    <td className="px-2 py-1.5">{facets.extraSofa ? "✓" : "—"}</td>
                    <td className="px-2 py-1.5">
                      {ref ? (
                        <span className="text-emerald-400">✓ есть</span>
                      ) : hasUnit ? (
                        <span className="text-amber-400">не создан</span>
                      ) : (
                        <span className="text-neutral-500">нет юнита</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      {editing ? (
                        <span className="flex items-center justify-end gap-1.5">
                          <select
                            value={edit.facets.viewCode ?? ""}
                            onChange={(e) => setEdit({ ...edit, facets: { ...edit.facets, viewCode: e.target.value || null } })}
                            className="rounded border border-neutral-700 bg-neutral-900 px-1 py-0.5 text-xs outline-none focus:border-amber-500/60"
                          >
                            {views.map((v) => (
                              <option key={v.code || BLANK_VIEW} value={v.code}>
                                {v.name}
                              </option>
                            ))}
                          </select>
                          <select
                            value={edit.facets.mealCode}
                            onChange={(e) => setEdit({ ...edit, facets: { ...edit.facets, mealCode: e.target.value } })}
                            className="rounded border border-neutral-700 bg-neutral-900 px-1 py-0.5 text-xs outline-none focus:border-amber-500/60"
                          >
                            {meals.map((m) => (
                              <option key={m.code} value={m.code}>
                                {m.name}
                              </option>
                            ))}
                          </select>
                          <select
                            value={edit.facets.placementCode}
                            onChange={(e) => setEdit({ ...edit, facets: { ...edit.facets, placementCode: e.target.value } })}
                            className="rounded border border-neutral-700 bg-neutral-900 px-1 py-0.5 text-xs outline-none focus:border-amber-500/60"
                          >
                            {placements.map((p) => (
                              <option key={p.code} value={p.code}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                          <label className="flex items-center gap-1 text-[11px] text-neutral-300" title="Ext. Bed">
                            <input
                              type="checkbox"
                              checked={edit.facets.extraBed === true}
                              onChange={(e) => setEdit({ ...edit, facets: { ...edit.facets, extraBed: e.target.checked } })}
                              className="h-3 w-3 accent-amber-500"
                            />
                            Bed
                          </label>
                          <label className="flex items-center gap-1 text-[11px] text-neutral-300" title="Ext. Sofa">
                            <input
                              type="checkbox"
                              checked={edit.facets.extraSofa === true}
                              onChange={(e) => setEdit({ ...edit, facets: { ...edit.facets, extraSofa: e.target.checked } })}
                              className="h-3 w-3 accent-amber-500"
                            />
                            Sofa
                          </label>
                          <button onClick={() => void saveEdit()} className="text-emerald-400 hover:text-emerald-300">
                            Сохранить
                          </button>
                          <button onClick={() => setEdit(null)} className="text-neutral-500 hover:text-neutral-300">
                            ✕
                          </button>
                        </span>
                      ) : (
                        <span className="flex justify-end gap-2">
                          {ref ? (
                            <>
                              <button
                                onClick={() => setEdit({ key, ref, facets: { ...facets } })}
                                className="text-neutral-400 hover:text-white"
                              >
                                Редакт
                              </button>
                              <button
                                onClick={() => void onRemoveVariant(ref.componentId, ref.variantId)}
                                className="text-neutral-500 hover:text-red-400"
                              >
                                Удалить
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => void createRow(facets).catch((e) => onError(e instanceof Error ? e.message : String(e)))}
                              disabled={busy}
                              className="text-amber-300 hover:text-amber-200 disabled:opacity-40"
                            >
                              Создать
                            </button>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Ручная строка */}
        <div className="flex flex-wrap items-end gap-2 border-t border-neutral-800 px-4 py-3">
          <ManualRowSelect
            label="Тип"
            options={roomTypes.map((r) => ({ value: r.id, name: r.name }))}
            value={manualRow.roomTypeId}
            onChange={(v) => setManualRow((s) => ({ ...s, roomTypeId: v }))}
          />
          <ManualRowSelect
            label="Вид"
            options={views.map((v) => ({ value: v.code, name: v.name }))}
            value={manualRow.viewCode}
            onChange={(v) => setManualRow((s) => ({ ...s, viewCode: v }))}
          />
          <ManualRowSelect
            label="Питание"
            options={meals.map((m) => ({ value: m.code, name: m.name }))}
            value={manualRow.mealCode}
            onChange={(v) => setManualRow((s) => ({ ...s, mealCode: v }))}
          />
          <ManualRowSelect
            label="Размещение"
            options={placements.map((p) => ({ value: p.code, name: p.name }))}
            value={manualRow.placementCode}
            onChange={(v) => setManualRow((s) => ({ ...s, placementCode: v }))}
          />
          <div className="flex gap-3 pb-1.5">
            <Check on={manualRow.extBed} onChange={(v) => setManualRow((s) => ({ ...s, extBed: v }))}>
              Ext. Bed
            </Check>
            <Check on={manualRow.extSofa} onChange={(v) => setManualRow((s) => ({ ...s, extSofa: v }))}>
              Ext. Sofa
            </Check>
          </div>
          <button
            onClick={addManualRow}
            disabled={!manualRow.roomTypeId || !manualRow.mealCode || !manualRow.placementCode}
            className="rounded border border-neutral-700 px-2.5 py-1.5 text-xs text-neutral-200 transition-colors hover:border-amber-500/60 disabled:opacity-40"
          >
            + строка вручную
          </button>
        </div>
      </div>
    </div>
  );
}

function ManualRowSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: string; name: string }>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[10px] uppercase tracking-wide text-neutral-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs outline-none focus:border-amber-500/60"
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}
