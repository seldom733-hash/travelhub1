"use client";

import { useState } from "react";
import { useLocale, t } from "@/lib/i18n";
import { BLOCK_REGISTRY } from "@/lib/constructor-registry";
import type { SectionView } from "@/lib/constructor-api";

interface Props {
  sections: SectionView[];
  onUpdateSection: (blockInstanceId: string, patch: Partial<SectionView>) => void;
}

/**
 * Content tab — edit block-specific settings and localized content.
 * Shows each block with its current settings and locale content.
 */
export default function ConstructorContentTab({ sections, onUpdateSection }: Props) {
  const locale = useLocale();

  if (sections.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm text-slate-400">
        {t("constructor.empty_canvas", locale)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        {locale === "ru" ? "Настройте содержимое каждого блока: заголовки, локализация, параметры данных." :
         locale === "az" ? "Hər blokun məzmununu tənzimləyin: başlıqlar, lokallaşdırma, məlumat parametrləri." :
         "Configure each block's content: titles, localization, data parameters."}
      </p>
      {sections.map((section) => (
        <BlockContentEditor
          key={section.blockInstanceId}
          section={section}
          onUpdate={(patch) => onUpdateSection(section.blockInstanceId, patch)}
        />
      ))}
    </div>
  );
}

function BlockContentEditor({
  section,
  onUpdate,
}: {
  section: SectionView;
  onUpdate: (patch: Partial<SectionView>) => void;
}) {
  const locale = useLocale();
  const def = BLOCK_REGISTRY.find((b) => b.type === section.blockType);
  const displayName = def?.displayName?.[locale] ?? section.blockType;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-900">{displayName}</span>
          <span className="text-xs text-slate-400">{section.blockType}</span>
          {!section.enabled && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
              {t("constructor.disabled_badge", locale)}
            </span>
          )}
        </div>
        <span className="text-xs text-slate-400">{expanded ? "▲" : "▼"}</span>
      </button>

      {/* Settings */}
      {expanded && (
        <div className="border-t border-slate-100 px-4 py-4 space-y-4">
          {/* Block type info */}
          <div className="text-xs text-slate-500">
            {locale === "ru" ? "Тип блока" : locale === "az" ? "Blok növü" : "Block type"}: {section.blockType}
          </div>

          {/* Settings JSON editor */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              {locale === "ru" ? "Параметры блока" : locale === "az" ? "Blok parametrləri" : "Block Settings"}
            </label>
            <pre className="overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 max-h-48">
              {JSON.stringify(section.settings, null, 2)}
            </pre>
          </div>

          {/* Data source */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              {locale === "ru" ? "Источник данных" : locale === "az" ? "Məlumat mənbəyi" : "Data Source"}
            </label>
            <pre className="overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 max-h-32">
              {JSON.stringify(section.dataSource, null, 2)}
            </pre>
          </div>

          {/* Locale content */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              {locale === "ru" ? "Локализованное содержимое" : locale === "az" ? "Lokallaşdırılmış məzmun" : "Localized Content"}
            </label>
            {Object.keys(section.localeContent).length > 0 ? (
              <pre className="overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 max-h-32">
                {JSON.stringify(section.localeContent, null, 2)}
              </pre>
            ) : (
              <p className="text-xs text-slate-400 italic">
                {locale === "ru" ? "Нет локализованного содержимого" : locale === "az" ? "Lokallaşdırılmış məzmun yoxdur" : "No localized content"}
              </p>
            )}
          </div>

          {/* Style */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              {locale === "ru" ? "Стиль" : locale === "az" ? "Stil" : "Style"}
            </label>
            <pre className="overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 max-h-32">
              {JSON.stringify(section.style, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
