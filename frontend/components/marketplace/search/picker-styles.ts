/**
 * Единые размеры пикеров поиска — единственный источник истины.
 *
 * Эталон — форма поиска туров (TourSearch): подписи 13px, контролы 15px,
 * высота py-2, скругление rounded-xl. Любой пикер одного назначения (дата,
 * ночи, взрослые/дети, направление, отель, категория) во всех формах поиска
 * обязан брать класс отсюда, иначе размеры снова разъедутся.
 */

/** Подпись над пикером. */
export const PICKER_LABEL = "mb-0.5 block text-[13px] font-medium text-neutral-400";

/** Строка формы: контролы выравниваются по нижнему краю и переносятся. */
export const PICKER_ROW = "flex flex-wrap items-end gap-3";

/** Ширины контейнеров — контентные, как в поиске туров. */
export const PICKER_W_FROM = "min-w-[180px] flex-[1_1_180px]";
export const PICKER_W_TO = "min-w-[200px] flex-[1_1_200px]";
export const PICKER_W_NIGHTS = "min-w-[160px] flex-[1_1_160px]";
export const PICKER_W_DATE_RANGE = "min-w-[360px] flex-[1_1_360px]";

/** Поля ввода и select'ы. */
export const PICKER_CONTROL =
  "w-full rounded-xl border border-dark-border bg-dark-card px-3 py-2 text-[15px] text-white outline-none transition-colors focus:border-gold/50";

/** То же, но с иконкой слева: место под иконку — pl-9. */
export const PICKER_CONTROL_ICON =
  "w-full rounded-xl border border-dark-border bg-dark-card py-2 pl-9 pr-3 text-[15px] text-white outline-none transition-colors focus:border-gold/50";

/** Кнопка-триггер выпадающего picker'а. */
export const PICKER_TRIGGER =
  "flex w-full items-center gap-2 rounded-xl border border-dark-border bg-dark-card px-3 py-2 text-left outline-none transition-colors hover:border-gold/40 focus:border-gold/50";

/** Текст внутри триггера. */
export const PICKER_TRIGGER_TEXT = "min-w-0 flex-1 truncate text-[15px]";

/** Чекбокс-«таблетка» («туда-обратно», «выбрать отель»). */
export const PICKER_CHECKBOX =
  "flex cursor-pointer items-center gap-2 rounded-xl border border-dark-border bg-dark-card px-4 py-2 text-[15px] text-neutral-300 transition-colors hover:border-gold/30 hover:text-white";

/** Главная кнопка поиска (ширину задаёт форма). */
export const PICKER_SUBMIT =
  "flex w-full items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-[15px] font-semibold transition-opacity";

/** Ширина одиночного поля-даты: под «00.00.0000» + иконка и рамка. */
export const PICKER_DATE_WIDTH_EXTRA = 76;
/** Ширина однозначного select'а: место под стрелку и внутренние отступы. */
export const PICKER_DIGIT_WIDTH_EXTRA = 56;
