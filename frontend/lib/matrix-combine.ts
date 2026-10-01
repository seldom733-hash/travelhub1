/**
 * Матрица вариантов (шаг «Проживание»): декартово произведение осей
 * Тип номера × Вид × Питание × Размещение × Ext.Bed × Ext.Sofa → строки
 * фасетов, дедуп по facetKey, сверка с уже созданными вариантами (ref из getState).
 *
 * Ось «Вид» содержит null («-», без вида) — decision #4.
 * Булевы оси Ext.Bed/Ext.Sofa: false = «без» (ключ не попадает в строку/ключ),
 * true = «с доп.опцией» (суффикс в facetKey).
 * Чистые функции, без сети.
 */

export interface VariantFacets {
  /** RoomType.id (то, что хранится в ServiceUnit.attributes.payload.roomTypeId). */
  roomTypeId: string;
  /** Только для отображения (имя типа из справочника). */
  roomTypeName?: string;
  /** null = «-» (без вида). */
  viewCode: string | null;
  mealCode: string;
  placementCode: string;
  /** Доп. опции (оси матрицы); true только когда включены. */
  extraBed?: boolean;
  extraSofa?: boolean;
}

export interface MatrixRef {
  componentId: string;
  variantId: string;
}

export interface FacetOption {
  id: string;
  code: string;
  name: string;
}

/**
 * Стабильный ключ строки матрицы. Строки без доп.опций сохраняют прежний
 * формат (без суффикса) — совместимость с уже созданными вариантами.
 */
export const facetKey = (f: VariantFacets): string => {
  const base = `${f.roomTypeId}|${f.viewCode ?? ""}|${f.mealCode}|${f.placementCode}`;
  if (!f.extraBed && !f.extraSofa) return base;
  return `${base}|${f.extraBed ? 1 : 0}${f.extraSofa ? 1 : 0}`;
};

export interface MatrixAxes {
  roomTypes: FacetOption[];
  /** Каждый элемент — вид; code: null означает строку «-». */
  views: Array<{ code: string | null; name: string }>;
  meals: FacetOption[];
  placements: FacetOption[];
  /**
   * Булевы оси доп.опций: false = «без», true = «с доп».
   * undefined = ось не участвует (точно как раньше); [] = пустая ось → [].
   */
  extraBed?: boolean[];
  extraSofa?: boolean[];
}

/**
 * Декартово произведение с сохранением порядка осей:
 * roomTypes × views × meals × placements × extraBed × extraSofa.
 * Пустая обязательная ось → []; доп.ось по умолчанию = [false].
 */
export function combineAxes(axes: MatrixAxes): VariantFacets[] {
  const { roomTypes, views, meals, placements } = axes;
  if (!roomTypes.length || !views.length || !meals.length || !placements.length) return [];
  const beds = axes.extraBed ?? [false];
  const sofas = axes.extraSofa ?? [false];
  if (!beds.length || !sofas.length) return [];
  const rows: VariantFacets[] = [];
  for (const rt of roomTypes) {
    for (const v of views) {
      for (const m of meals) {
        for (const pl of placements) {
          for (const b of beds) {
            for (const s of sofas) {
              rows.push({
                roomTypeId: rt.id,
                roomTypeName: rt.name,
                viewCode: v.code,
                mealCode: m.code,
                placementCode: pl.code,
                ...(b ? { extraBed: true } : {}),
                ...(s ? { extraSofa: true } : {}),
              });
            }
          }
        }
      }
    }
  }
  return rows;
}

/**
 * Сгенерированные + ручные строки → единый список без дублей по facetKey
 * (сгенерированные первыми, ручные добавляются только недостающие).
 */
export function mergeRows(generated: VariantFacets[], manual: VariantFacets[]): VariantFacets[] {
  const seen = new Set<string>();
  const out: VariantFacets[] = [];
  for (const r of [...generated, ...manual]) {
    const k = facetKey(r);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

/**
 * Сверка строк с существующими вариантами: refs — map facetKey →
 * { componentId, variantId } (собирается из getState). ref != null → строка
 * уже создана (кнопка «Удалить»); иначе — «Создать».
 */
export function diffWithExisting(
  rows: VariantFacets[],
  refs: Map<string, MatrixRef>,
): Array<{ facets: VariantFacets; ref: MatrixRef | null }> {
  return rows.map((facets) => ({ facets, ref: refs.get(facetKey(facets)) ?? null }));
}

/**
 * Сбор ref-карты из состояния: unit (payload.roomTypeId) + его тарифы
 * (Tariff.inclusions viewCode/mealCode/placementCode/extraBed/extraSofa).
 */
export function collectVariantRefs(
  components: Array<{
    componentId: string;
    payload: Record<string, unknown>;
    tariffs: Array<{ id: string; inclusions: Record<string, unknown> | null }>;
  }>,
): Map<string, MatrixRef> {
  const refs = new Map<string, MatrixRef>();
  for (const c of components) {
    const roomTypeId = c.payload.roomTypeId;
    if (typeof roomTypeId !== "string") continue;
    for (const t of c.tariffs) {
      const inc = t.inclusions ?? {};
      const view = typeof inc.viewCode === "string" ? inc.viewCode : null;
      const meal = typeof inc.mealCode === "string" ? inc.mealCode : "";
      const placement = typeof inc.placementCode === "string" ? inc.placementCode : "";
      refs.set(
        facetKey({
          roomTypeId,
          viewCode: view,
          mealCode: meal,
          placementCode: placement,
          extraBed: inc.extraBed === true,
          extraSofa: inc.extraSofa === true,
        }),
        {
          componentId: c.componentId,
          variantId: t.id,
        },
      );
    }
  }
  return refs;
}
