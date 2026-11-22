"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowCounterClockwise, ArrowClockwise, DotsSixVertical, Eye, Plus, Trash } from "@phosphor-icons/react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { BlockDefinition, SectionView } from "@/lib/constructor-api";
import { contentBlockNeedsAttention } from "@/lib/content-blocks";
import type { BuilderTemplate } from "@/lib/builder-templates";
import { useLocale, t } from "@/lib/i18n";

export const BLOCK_FIELD_LABELS: Record<string, string> = {
  heading: "Заголовок",
  subheading: "Подзаголовок",
  body: "Текст",
  text: "Текст",
  ctaLabel: "Текст кнопки",
  ctaHref: "Ссылка кнопки",
  label: "Текст кнопки",
  href: "Ссылка",
  successMessage: "Сообщение после отправки",
  pageSize: "Количество продуктов",
  itemsText: "Вопросы и ответы (по одному на строку: вопрос | ответ)",
  imagesText: "Изображения (по одной ссылке на строку)",
};

const FIELD_LABELS_I18N: Record<string, { az: string; en: string }> = {
  heading: { az: "Başlıq", en: "Heading" },
  subheading: { az: "Alt başlıq", en: "Subheading" },
  body: { az: "Mətn", en: "Text" },
  text: { az: "Mətn", en: "Text" },
  ctaLabel: { az: "Düymə mətni", en: "Button text" },
  ctaHref: { az: "Düymə linki", en: "Button link" },
  label: { az: "Düymə mətni", en: "Button text" },
  href: { az: "Link", en: "Link" },
  successMessage: { az: "Göndərmədən sonra mesaj", en: "Message after submit" },
  pageSize: { az: "Məhsulların sayı", en: "Number of products" },
  itemsText: { az: "Suallar və cavablar (hər sətirdə: sual | cavab)", en: "Questions and answers (one per line: question | answer)" },
  imagesText: { az: "Şəkillər (hər sətirdə bir link)", en: "Images (one link per line)" },
};
const FIELD_PLACEHOLDERS_I18N: Record<string, { az: string; en: string }> = {
  heading: { az: "Məsələn: Yadda qalan səyahətlər", en: "For example: Journeys to remember" },
  subheading: { az: "Müştəriyə faydanızı qısa izah edin", en: "Briefly explain your value to the customer" },
  body: { az: "Şirkət, təcrübə və istiqamətlər haqqında danışın", en: "Tell about the company, experience and destinations" },
  text: { az: "Sayt altlığının mətni", en: "Website footer text" },
  ctaLabel: { az: "Kataloqa bax", en: "View catalogue" },
  label: { az: "Əlaqə saxla", en: "Contact us" },
  successMessage: { az: "Təşəkkür edirik! Müraciət göndərildi.", en: "Thank you! Your request has been sent." },
};
const MULTILINE = new Set(["body", "text", "itemsText", "imagesText"]);
const NUMERIC = new Set(["pageSize"]);
const FIELD_PLACEHOLDERS: Record<string, string> = {
  heading: "Например: Путешествия, которые запоминаются",
  subheading: "Коротко объясните, чем вы полезны клиенту",
  body: "Расскажите о компании, опыте и направлениях",
  text: "Текст подвала сайта",
  ctaLabel: "Смотреть каталог",
  label: "Связаться",
  ctaHref: "#products",
  href: "#contacts",
  successMessage: "Спасибо! Заявка отправлена.",
  itemsText: "Как забронировать тур? | Выберите тур и оставьте заявку\nМожно ли оплатить картой? | Да, картой или переводом",
  imagesText: "https://example.com/photo-1.jpg\nhttps://example.com/photo-2.jpg",
};
const FAQ_SAMPLE = "Как забронировать тур? | Выберите тур на сайте и оставьте заявку — менеджер свяжется с вами.\nМожно ли оплатить картой? | Да, оплата доступна банковской картой.";

function displayName(def: BlockDefinition | undefined, type: string, locale: string): string {
  return def?.displayName?.[locale] ?? type;
}

function needsContent(section: SectionView): boolean {
  return contentBlockNeedsAttention(section.blockType, section.settings);
}

function seoText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const rec = value as Record<string, unknown>;
    return String(rec.ru ?? rec.az ?? rec.en ?? "");
  }
  return "";
}

export function BlockSettingsFields({
  settings,
  blockType,
  galleryMedia,
  onChange,
  className = "",
}: {
  settings: Record<string, unknown>;
  blockType?: string;
  galleryMedia?: Array<{ id: string; url: string; altText?: string | null }>;
  onChange: (key: string, value: string | number) => void;
  className?: string;
}) {
  const locale = useLocale();
  const fieldLabel = (key: string) => locale === "az" ? (FIELD_LABELS_I18N[key]?.az ?? BLOCK_FIELD_LABELS[key]) : locale === "en" ? (FIELD_LABELS_I18N[key]?.en ?? BLOCK_FIELD_LABELS[key]) : BLOCK_FIELD_LABELS[key];
  const fieldPlaceholder = (key: string) => locale === "az" ? (FIELD_PLACEHOLDERS_I18N[key]?.az ?? FIELD_PLACEHOLDERS[key]) : locale === "en" ? (FIELD_PLACEHOLDERS_I18N[key]?.en ?? FIELD_PLACEHOLDERS[key]) : FIELD_PLACEHOLDERS[key];
  const entries = Object.entries(settings).filter(([key]) => key in BLOCK_FIELD_LABELS);
  const missingContent = contentBlockNeedsAttention(blockType ?? "", settings);
  return (
    <div className={`space-y-3 ${className}`}>
      {missingContent && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
          {blockType === "content-faq"
            ? "Каждая строка должна содержать вопрос и ответ через «|» (подойдёт также «—» или «:»). Без пар блок не выводится на сайте."
            : blockType === "content-gallery"
              ? "Добавьте хотя бы одну ссылку на изображение (http/https). Пока ссылок нет, блок не выводится на сайте."
              : "Заполните текст о компании. Пока текст пуст, блок не выводится на сайте."}
          {blockType === "content-faq" && (
            <button
              type="button"
              onClick={() => onChange("itemsText", FAQ_SAMPLE)}
              className="mt-2 block rounded border border-amber-300 bg-white px-2 py-1 text-[11px] font-medium text-amber-800 hover:bg-amber-100"
            >
              Вставить пример вопросов
            </button>
          )}
        </div>
      )}
      {entries.map(([key, value]) => (
        <label key={key} className="block text-xs font-medium text-ink/60">
          {fieldLabel(key)}
          {MULTILINE.has(key) ? (
            <textarea
              value={String(value ?? "")}
              onChange={(e) => onChange(key, e.target.value)}
              placeholder={fieldPlaceholder(key)}
              rows={key === "body" || key === "text" ? 5 : 4}
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm font-normal text-ink outline-none focus:border-emerald-400"
            />
          ) : NUMERIC.has(key) ? (
            <input
              type="number"
              min={1}
              max={24}
              value={Number(value ?? 0)}
              onChange={(e) => onChange(key, Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm font-normal text-ink outline-none focus:border-emerald-400"
            />
          ) : (
            <input
              value={String(value ?? "")}
              onChange={(e) => onChange(key, e.target.value)}
              placeholder={fieldPlaceholder(key)}
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm font-normal text-ink outline-none focus:border-emerald-400"
            />
          )}
        </label>
      ))}
      {blockType === "content-gallery" && galleryMedia && galleryMedia.length > 0 && (
        <div>
          <div className="mb-1 text-[11px] font-medium text-ink/60">Медиатека</div>
          <div className="grid grid-cols-4 gap-2">
            {galleryMedia.map((m) => {
              const ref = `media:${m.id}`;
              const selected = String(settings.imagesText ?? "").split("\n").includes(ref);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    const current = String(settings.imagesText ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
                    const next = selected ? current.filter((s) => s !== ref) : [...current, ref];
                    onChange("imagesText", next.join("\n"));
                  }}
                  className={`overflow-hidden rounded-lg border-2 ${selected ? "border-emerald-500" : "border-transparent hover:border-line"}`}
                  title={m.altText ?? "Добавить в галерею"}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.url} alt={m.altText ?? ""} className="aspect-square w-full object-cover" />
                </button>
              );
            })}
          </div>
        </div>
      )}
      {entries.length === 0 && <p className="text-xs text-ink/60">{t("constructor.no_settings", locale)}</p>}
    </div>
  );
}

/**
 * Shared three-pane constructor shell. Marketplace and Storefront provide their
 * own API/state adapters and optional extra tabs; block structure/settings and
 * draft/publish controls are identical.
 */
function SortableSectionRow({
  section,
  index,
  total,
  def,
  selected,
  locale,
  onSelect,
  onMove,
  onToggle,
  onRemove,
}: {
  section: SectionView;
  index: number;
  total: number;
  def: BlockDefinition | undefined;
  selected: boolean;
  locale: string;
  onSelect: () => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.blockInstanceId });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === "Enter") onSelect(); }}
      className={`cursor-pointer rounded-xl border bg-white p-3 transition ${selected ? "border-emerald-400 ring-2 ring-emerald-100" : "border-line"} ${section.enabled ? "" : "opacity-60"} ${isDragging ? "opacity-70" : ""}`}
    >
      <div className="flex items-center gap-2">
        <button type="button" className="cursor-grab text-ink/60 hover:text-ink/60" {...attributes} {...listeners} aria-label="Переместить блок">
          <DotsSixVertical className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-ink">{displayName(def, section.blockType, locale)}</div>
          <div className="truncate text-[11px] text-ink/60">
            {String(section.settings.heading ?? section.settings.body ?? section.settings.text ?? "Без текста")}
          </div>
          {needsContent(section) && (
            <span className="mt-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
              Заполните контент — сейчас блок не выводится
            </span>
          )}
        </div>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" title="Выше" disabled={index === 0} onClick={() => onMove(section.blockInstanceId, -1)} className="rounded p-1 text-ink/60 hover:bg-panel disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
          <button type="button" title="Ниже" disabled={index === total - 1} onClick={() => onMove(section.blockInstanceId, 1)} className="rounded p-1 text-ink/60 hover:bg-panel disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
          <button type="button" title={section.enabled ? "Скрыть" : "Показать"} onClick={onToggle} className="rounded p-1 text-ink/60 hover:bg-panel"><Eye className="h-4 w-4" /></button>
          {def?.removable !== false && (
            <button type="button" title="Удалить" onClick={onRemove} className="rounded p-1 text-rose-400 hover:bg-rose-50"><Trash className="h-4 w-4" /></button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BuilderWorkspace({
  title,
  description,
  previewHref,
  livePreviewHref,
  published,
  saving,
  error,
  tabs,
  activeTab,
  onTabChange,
  registry,
  sections,
  savingLabel,
  publishDisabled = false,
  onSave,
  onPublish,
  onAdd,
  onRemove,
  onToggle,
  onReorder,
  onUpdateSettings,
  onReplaceSections,
  templates,
  onApplyTemplate,
  seo,
  onSaveSeo,
  design,
  onSaveDesign,
  galleryMedia,
  children,
}: {
  title: string;
  description?: string;
  previewHref: string;
  livePreviewHref?: string;
  published: boolean;
  saving: boolean;
  error?: string | null;
  tabs: Array<{ id: string; label: string }>;
  activeTab: string;
  onTabChange: (tab: string) => void;
  registry: BlockDefinition[];
  sections: SectionView[];
  savingLabel: string;
  publishDisabled?: boolean;
  onSave: () => void;
  onPublish: () => void;
  onAdd: (type: string) => void;
  onRemove: (instanceId: string) => void;
  onToggle: (instanceId: string) => void;
  onReorder: (from: number, to: number) => void;
  onUpdateSettings: (instanceId: string, key: string, value: string | number) => void;
  onReplaceSections?: (sections: SectionView[]) => void;
  templates?: BuilderTemplate[];
  onApplyTemplate?: (template: BuilderTemplate) => void;
  seo?: Record<string, unknown> | null;
  onSaveSeo?: (input: { title: string; description: string }) => void | Promise<void>;
  design?: Record<string, unknown> | null;
  onSaveDesign?: (input: { accentColor: string; fontFamily: string }) => void | Promise<void>;
  galleryMedia?: Array<{ id: string; url: string; altText?: string | null }>;
  children?: React.ReactNode;
}) {
  const locale = useLocale();
  const [selectedId, setSelectedId] = useState<string | null>(sections[0]?.blockInstanceId ?? null);
  const [canvasMode, setCanvasMode] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [seoOpen, setSeoOpen] = useState(false);
  const [seoTitle, setSeoTitle] = useState(seoText(seo?.title));
  const [seoDescription, setSeoDescription] = useState(seoText(seo?.description));
  const [brandOpen, setBrandOpen] = useState(false);
  const [accentColor, setAccentColor] = useState(typeof design?.accentColor === "string" ? design.accentColor : "#059669");
  const [fontFamily, setFontFamily] = useState(typeof design?.fontFamily === "string" ? design.fontFamily : "Inter, system-ui, sans-serif");
  const previousIds = useRef(new Set(sections.map((s) => s.blockInstanceId)));

  // When a block is added, open its inspector immediately so the author sees
  // required fields/warnings instead of a silently empty published section.
  useEffect(() => {
    const added = sections.find((s) => !previousIds.current.has(s.blockInstanceId));
    previousIds.current = new Set(sections.map((s) => s.blockInstanceId));
    if (added) setSelectedId(added.blockInstanceId);
  }, [sections]);

  const selected = useMemo(() => sections.find((s) => s.blockInstanceId === selectedId) ?? null, [sections, selectedId]);
  const selectedDef = registry.find((b) => b.type === selected?.blockType);
  const used = new Set(sections.map((s) => s.blockType));
  const undoStack = useRef<SectionView[][]>([]);
  const redoStack = useRef<SectionView[][]>([]);

  const remember = () => {
    undoStack.current.push(sections);
    if (undoStack.current.length > 50) undoStack.current.shift();
    redoStack.current = [];
  };
  const undo = () => {
    const previous = undoStack.current.pop();
    if (!previous || !onReplaceSections) return;
    redoStack.current.push(sections);
    onReplaceSections(previous);
  };
  const redo = () => {
    const next = redoStack.current.pop();
    if (!next || !onReplaceSections) return;
    undoStack.current.push(sections);
    onReplaceSections(next);
  };
  const act = (fn: () => void) => {
    remember();
    fn();
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = sections.findIndex((s) => s.blockInstanceId === active.id);
    const to = sections.findIndex((s) => s.blockInstanceId === over.id);
    if (from >= 0 && to >= 0) act(() => onReorder(from, to));
  };

  const move = (id: string, direction: -1 | 1) => {
    const from = sections.findIndex((s) => s.blockInstanceId === id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= sections.length) return;
    act(() => onReorder(from, to));
  };

  return (
    <div className="space-y-0">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          {description && <p className="mt-1 text-sm text-ink/60">{description}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setCanvasMode((v) => !v)} className={`rounded-lg border px-3 py-2 text-sm ${canvasMode ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-line bg-white text-ink hover:bg-panel"}`}>
            {canvasMode ? "Структура" : "Canvas"}
          </button>
          {templates && templates.length > 0 && onApplyTemplate && (
            <button type="button" onClick={() => setTemplatesOpen(true)} className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink hover:bg-panel">
              {locale === "az" ? "Şablonlar" : locale === "en" ? "Templates" : "Шаблоны"}
            </button>
          )}
          {onSaveSeo && (
            <button
              type="button"
              onClick={() => {
                setSeoTitle(seoText(seo?.title));
                setSeoDescription(seoText(seo?.description));
                setSeoOpen(true);
              }}
              className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink hover:bg-panel"
            >
              SEO
            </button>
          )}
          {onSaveDesign && (
            <button
              type="button"
              onClick={() => {
                setAccentColor(typeof design?.accentColor === "string" ? design.accentColor : "#059669");
                setFontFamily(typeof design?.fontFamily === "string" ? design.fontFamily : "Inter, system-ui, sans-serif");
                setBrandOpen(true);
              }}
              className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink hover:bg-panel"
            >
              Бренд
            </button>
          )}
          <button type="button" onClick={undo} disabled={undoStack.current.length === 0 || !onReplaceSections} title="Отменить" className="rounded-lg border border-line bg-white p-2 text-ink/60 hover:bg-panel disabled:opacity-30">
            <ArrowCounterClockwise className="h-4 w-4" />
          </button>
          <button type="button" onClick={redo} disabled={redoStack.current.length === 0 || !onReplaceSections} title="Повторить" className="rounded-lg border border-line bg-white p-2 text-ink/60 hover:bg-panel disabled:opacity-30">
            <ArrowClockwise className="h-4 w-4" />
          </button>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${published ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
            {published ? t("constructor.published_status", locale) : t("constructor.draft_status", locale)}
          </span>
          <a href={previewHref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink hover:bg-panel">
            <Eye className="h-4 w-4" /> {t("constructor.preview", locale)}
          </a>
          <button type="button" onClick={onSave} disabled={saving} className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink hover:bg-panel disabled:opacity-50">
            {saving ? savingLabel : t("constructor.save_draft", locale)}
          </button>
          <button type="button" onClick={onPublish} disabled={saving || publishDisabled} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            {t("constructor.publish", locale)}
          </button>
        </div>
      </div>

      {error && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>}

      <div className="flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors ${activeTab === tab.id ? "border-b-2 border-emerald-600 text-emerald-700" : "text-ink/60 hover:text-ink"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="pt-6">
        {canvasMode ? (
          <div className="overflow-hidden rounded-xl border border-line bg-panel">
            <div className="flex items-center justify-between border-b border-line bg-white px-3 py-2 text-xs text-ink/60">
              <span>Live preview</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setPreviewKey((k) => k + 1)} className="rounded border border-line px-2 py-1 text-[11px] hover:bg-panel">Обновить</button>
                <a href={livePreviewHref ?? previewHref} target="_blank" rel="noopener noreferrer" className="rounded border border-line px-2 py-1 text-[11px] hover:bg-panel">Открыть</a>
              </div>
            </div>
            <iframe
              key={previewKey}
              src={livePreviewHref ?? previewHref}
              title="Live preview"
              className="h-[70vh] w-full bg-white"
            />
          </div>
        ) : activeTab === "structure" ? (
          <div className="grid gap-4 lg:grid-cols-[230px_minmax(0,1fr)_300px]">
            <aside className="rounded-xl border border-line bg-white p-3">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/60">{t("constructor.add_block", locale)}</h3>
              <div className="space-y-1.5">
                {registry.map((def) => {
                  const disabled = def.singleton && used.has(def.type);
                  return (
                    <button
                      key={def.type}
                      type="button"
                      disabled={disabled}
                      onClick={() => act(() => onAdd(def.type))}
                      className="flex w-full items-start gap-2 rounded-lg border border-dashed border-line px-2.5 py-2 text-left hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Plus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink/60" />
                      <span>
                        <span className="block text-xs font-medium text-ink">{displayName(def, def.type, locale)}</span>
                        <span className="block text-[10px] leading-snug text-ink/60">{def.description?.[locale] ?? ""}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>

            <main className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-ink">{t("constructor.canvas_title", locale)} ({sections.length})</h3>
                <span className="text-[11px] text-ink/60">{t("constructor.structure_hint", locale)}</span>
              </div>
              {sections.length === 0 && (
                <div className="rounded-xl border-2 border-dashed border-line bg-white px-6 py-16 text-center text-sm text-ink/60">
                  {t("constructor.empty_canvas", locale)}
                </div>
              )}
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={sections.map((s) => s.blockInstanceId)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {sections.map((section, index) => (
                      <SortableSectionRow
                        key={section.blockInstanceId}
                        section={section}
                        index={index}
                        total={sections.length}
                        def={registry.find((b) => b.type === section.blockType)}
                        selected={selectedId === section.blockInstanceId}
                        locale={locale}
                        onSelect={() => setSelectedId(section.blockInstanceId)}
                        onMove={move}
                        onToggle={() => act(() => onToggle(section.blockInstanceId))}
                        onRemove={() => act(() => onRemove(section.blockInstanceId))}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </main>

            <aside className="rounded-xl border border-line bg-white p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink/60">{t("constructor.settings_title", locale)}</h3>
              {!selected ? (
                <p className="text-xs text-ink/60">{t("constructor.select_block", locale)}</p>
              ) : (
                <div className="space-y-3">
                  <div>
                    <div className="text-sm font-semibold text-ink">{displayName(selectedDef, selected.blockType, locale)}</div>
                    <div className="text-[11px] text-ink/60">{selectedDef?.description?.[locale]}</div>
                  </div>
                  <BlockSettingsFields
                    settings={selected.settings}
                    blockType={selected.blockType}
                    galleryMedia={galleryMedia}
                    onChange={(key, value) => act(() => onUpdateSettings(selected.blockInstanceId, key, value))}
                  />
                </div>
              )}
            </aside>
          </div>
        ) : (
          children
        )}
      </div>

      {brandOpen && onSaveDesign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={() => setBrandOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-ink">Brand kit</h3>
              <button type="button" onClick={() => setBrandOpen(false)} className="rounded p-1 text-ink/60 hover:bg-panel">✕</button>
            </div>
            <label className="mt-4 block text-xs font-medium text-ink/60">
              Акцентный цвет
              <div className="mt-1 flex gap-2">
                <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="h-9 w-12 rounded border border-line" />
                <input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="w-full rounded-lg border border-line px-3 py-2 text-sm" />
              </div>
            </label>
            <label className="mt-3 block text-xs font-medium text-ink/60">
              Шрифт
              <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm">
                <option value="Inter, system-ui, sans-serif">Inter</option>
                <option value="Georgia, serif">Georgia</option>
                <option value="'Times New Roman', serif">Times New Roman</option>
                <option value="Arial, sans-serif">Arial</option>
              </select>
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setBrandOpen(false)} className="rounded-lg border border-line px-3 py-2 text-sm text-ink/60">Отмена</button>
              <button
                type="button"
                onClick={() => {
                  void Promise.resolve(onSaveDesign({ accentColor, fontFamily })).then(() => setBrandOpen(false));
                }}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Сохранить бренд
              </button>
            </div>
          </div>
        </div>
      )}

      {seoOpen && onSaveSeo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={() => setSeoOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-ink">SEO страницы</h3>
              <button type="button" onClick={() => setSeoOpen(false)} className="rounded p-1 text-ink/60 hover:bg-panel">✕</button>
            </div>
            <label className="mt-4 block text-xs font-medium text-ink/60">
              Title
              <input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} maxLength={70} className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm" />
            </label>
            <label className="mt-3 block text-xs font-medium text-ink/60">
              Description
              <textarea value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} maxLength={180} rows={4} className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm" />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setSeoOpen(false)} className="rounded-lg border border-line px-3 py-2 text-sm text-ink/60">Отмена</button>
              <button
                type="button"
                onClick={() => {
                  void Promise.resolve(onSaveSeo({ title: seoTitle, description: seoDescription })).then(() => setSeoOpen(false));
                }}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Сохранить SEO
              </button>
            </div>
          </div>
        </div>
      )}

      {templatesOpen && templates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={() => setTemplatesOpen(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-ink">{locale === "az" ? "Sayt şablonları" : locale === "en" ? "Site templates" : "Шаблоны сайта"}</h3>
              <button type="button" onClick={() => setTemplatesOpen(false)} className="rounded p-1 text-ink/60 hover:bg-panel">✕</button>
            </div>
            <p className="mt-1 text-xs text-ink/60">{locale === "az" ? "Şablon mövcud strukturu əvəz edəcək. Qaralamanı redaktə edib saxlaya bilərsiniz." : locale === "en" ? "The template will replace the current structure. You can edit and save the draft afterwards." : "Шаблон заменит текущую структуру. Черновик можно будет отредактировать и сохранить."}</p>
            <div className="mt-4 space-y-2">
              {templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => {
                    act(() => onApplyTemplate?.(template));
                    setTemplatesOpen(false);
                  }}
                  className="w-full rounded-xl border border-line p-3 text-left hover:border-emerald-300 hover:bg-emerald-50"
                >
                  <div className="text-sm font-semibold text-ink">{template.title}</div>
                  <div className="text-xs text-ink/60">{template.description}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
