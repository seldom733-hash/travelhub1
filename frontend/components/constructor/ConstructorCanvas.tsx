"use client";

import { useState } from "react";
import { useLocale, t } from "@/lib/i18n";
import { useConstructor } from "@/lib/use-constructor";
import ConstructorTabs, { type ConstructorTab } from "./ConstructorTabs";
import ConstructorBlockList from "./ConstructorBlockList";
import ConstructorAvailableBlocks from "./ConstructorAvailableBlocks";
import ConstructorHeaderTab from "./ConstructorHeaderTab";
import ConstructorHeroTab from "./ConstructorHeroTab";
import ConstructorSearchTab from "./ConstructorSearchTab";
import ConstructorFooterTab from "./ConstructorFooterTab";
import ConstructorDesignTab from "./ConstructorDesignTab";
import ConstructorContentTab from "./ConstructorContentTab";
import { FloppyDisk, PaperPlaneRight, Eye } from "@phosphor-icons/react";

interface Props {
  slug: string;
}

export default function ConstructorCanvas({ slug }: Props) {
  const locale = useLocale();
  const [activeTab, setActiveTab] = useState<ConstructorTab>("structure");
  const {
    page,
    draft,
    loading,
    saving,
    error,
    availableBlocks,
    refresh,
    saveDraft,
    publish,
    saveHeaderConfig,
    saveHeroConfig,
    saveSearchConfig,
    saveFooterConfig,
    saveDesignConfig,
    addBlock,
    removeBlock,
    toggleEnabled,
    reorder,
    updateSection,
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

  const isPublished = page?.status === "PUBLISHED" && page?.currentVersion != null;
  const hasDraft = page?.draftVersion != null && (page?.currentVersion == null || page.draftVersion > page.currentVersion);

  return (
    <div className="space-y-0">
      {/* Header with actions */}
      <div className="flex items-center justify-between pb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {t("constructor.home_title", locale)}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {t("constructor.home_description", locale)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Status badge */}
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${isPublished ? "bg-green-100 text-green-700" : hasDraft ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
            {isPublished ? t("constructor.published_status", locale) : hasDraft ? t("constructor.draft_status", locale) : t("constructor.draft_status", locale)}
          </span>

          {/* Preview */}
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <Eye className="h-4 w-4" />
            {t("constructor.preview", locale)}
          </a>

          {/* Save Draft */}
          <button
            onClick={saveDraft}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FloppyDisk className="h-4 w-4" />
            {saving ? t("constructor.saving", locale) : t("constructor.save_draft", locale)}
          </button>

          {/* Publish */}
          <button
            onClick={publish}
            disabled={saving || !hasDraft}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PaperPlaneRight className="h-4 w-4" />
            {t("constructor.publish", locale)}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Tabs */}
      <ConstructorTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab content */}
      <div className="pt-6">
        {activeTab === "structure" && (
          <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
            <ConstructorAvailableBlocks blocks={availableBlocks} onAdd={addBlock} />
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
        )}

        {activeTab === "header" && (
          <ConstructorHeaderTab
            slug={slug}
            config={page?.headerConfig ?? null}
            onSaved={refresh}
            onSaving={() => {}}
            onError={(msg) => { if (msg) alert(msg); }}
          />
        )}

        {activeTab === "hero" && (
          <ConstructorHeroTab
            slug={slug}
            config={page?.heroConfig ?? null}
            onSaved={refresh}
            onSaving={() => {}}
            onError={(msg) => { if (msg) alert(msg); }}
          />
        )}

        {activeTab === "search" && (
          <ConstructorSearchTab
            slug={slug}
            config={page?.searchConfig ?? null}
            onSaved={refresh}
            onSaving={() => {}}
            onError={(msg) => { if (msg) alert(msg); }}
          />
        )}

        {activeTab === "content" && (
          <ConstructorContentTab
            sections={draft}
            onUpdateSection={updateSection}
          />
        )}

        {activeTab === "footer" && (
          <ConstructorFooterTab
            slug={slug}
            config={page?.footerConfig ?? null}
            onSaved={refresh}
            onSaving={() => {}}
            onError={(msg) => { if (msg) alert(msg); }}
          />
        )}

        {activeTab === "design" && (
          <ConstructorDesignTab
            slug={slug}
            config={page?.designConfig ?? null}
            onSaved={refresh}
            onSaving={() => {}}
            onError={(msg) => { if (msg) alert(msg); }}
          />
        )}
      </div>
    </div>
  );
}
