"use client";

import { useLocale, t } from "@/lib/i18n";
import { useConstructor } from "@/lib/use-constructor";
import ConstructorBlockList from "./ConstructorBlockList";
import ConstructorAvailableBlocks from "./ConstructorAvailableBlocks";

interface Props {
  slug: string;
}

export default function ConstructorCanvas({ slug }: Props) {
  const locale = useLocale();
  const {
    page,
    draft,
    loading,
    saving,
    error,
    availableBlocks,
    saveDraft,
    addBlock,
    removeBlock,
    toggleEnabled,
    reorder,
  } = useConstructor(slug);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 animate-pulse rounded bg-slate-100" />
        <div className="h-48 animate-pulse rounded-lg bg-slate-100" />
      </div>
    );
  }

  if (error && !page) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {t("constructor.home_title", locale)}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {t("constructor.home_description", locale)}
          </p>
        </div>
        <button
          onClick={saveDraft}
          disabled={saving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? t("constructor.saving", locale) : t("constructor.save_draft", locale)}
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Left: Available blocks */}
        <ConstructorAvailableBlocks
          blocks={availableBlocks}
          onAdd={addBlock}
        />

        {/* Right: Canvas */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-slate-700">
            {t("constructor.canvas_title", locale)} ({draft.length})
          </h3>
          <ConstructorBlockList
            sections={draft}
            onReorder={reorder}
            onToggle={toggleEnabled}
            onRemove={removeBlock}
          />
        </div>
      </div>
    </div>
  );
}
