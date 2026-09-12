"use client";

import { useLocale, t } from "@/lib/i18n";
import type { BlockDefinition } from "@/lib/constructor-registry";
import { Plus } from "@phosphor-icons/react";

interface Props {
  blocks: BlockDefinition[];
  onAdd: (blockType: string) => void;
}

export default function ConstructorAvailableBlocks({ blocks, onAdd }: Props) {
  const locale = useLocale();

  if (blocks.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-medium text-slate-700">
        {t("constructor.available_blocks", locale)}
      </h3>
      <div className="space-y-2">
        {blocks.map((def) => (
          <button
            key={def.type}
            onClick={() => onAdd(def.type)}
            className="flex w-full items-center gap-2 rounded-lg border border-dashed border-slate-200 px-3 py-2 text-left text-sm transition-colors hover:border-blue-300 hover:bg-blue-50"
          >
            <Plus className="h-4 w-4 shrink-0 text-slate-400" />
            <div className="min-w-0">
              <div className="font-medium text-slate-700">{def.displayName[locale] ?? def.type}</div>
              <div className="truncate text-xs text-slate-400">{def.description[locale]}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
