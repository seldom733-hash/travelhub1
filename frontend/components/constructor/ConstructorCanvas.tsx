"use client";

import { useState } from "react";
import { useLocale, t } from "@/lib/i18n";
import { useGlobalBranding } from "@/lib/use-global-branding";
import { useConstructor } from "@/lib/use-constructor";
import BuilderWorkspace from "./BuilderWorkspace";
import ConstructorHeaderTab from "./ConstructorHeaderTab";
import ConstructorHeroTab from "./ConstructorHeroTab";
import ConstructorSearchTab from "./ConstructorSearchTab";
import ConstructorFooterTab from "./ConstructorFooterTab";
import ConstructorDesignTab from "./ConstructorDesignTab";
import ConstructorContentTab from "./ConstructorContentTab";
import { instantiateTemplate, MARKETPLACE_TEMPLATES } from "@/lib/builder-templates";

interface Props {
  slug: string;
}

/**
 * Marketplace site builder adapter. Rendering/structure/settings controls live
 * in the shared BuilderWorkspace; this component only wires marketplace API and
 * marketplace-specific tabs (Header/Hero/Search/Footer/Design/Content).
 */
export default function ConstructorCanvas({ slug }: Props) {
  const locale = useLocale();
  const { brandName } = useGlobalBranding();
  const [activeTab, setActiveTab] = useState("structure");
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
    addBlock,
    removeBlock,
    toggleEnabled,
    reorder,
    updateSection,
    replaceSections,
  } = useConstructor(slug);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 animate-pulse rounded bg-slate-100" />
        <div className="h-10 animate-pulse rounded bg-slate-100" />
        <div className="h-64 animate-pulse rounded border border-slate-200 bg-white" />
      </div>
    );
  }

  if (error && !page) {
    return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>;
  }

  const isPublished = page?.status === "PUBLISHED" && page?.currentVersion != null;
  const hasDraft = page?.draftVersion != null && (page?.currentVersion == null || page.draftVersion > page.currentVersion);
  const tabs = [
    { id: "structure", label: t("constructor.tab_structure", locale) },
    { id: "header", label: t("constructor.tab_header", locale) },
    { id: "hero", label: t("constructor.tab_hero", locale) },
    { id: "search", label: t("constructor.tab_search", locale) },
    { id: "content", label: t("constructor.tab_content", locale) },
    { id: "footer", label: t("constructor.tab_footer", locale) },
    { id: "design", label: t("constructor.tab_design", locale) },
  ];

  const updateSettings = (instanceId: string, key: string, value: string | number) => {
    const section = draft.find((s) => s.blockInstanceId === instanceId);
    if (!section) return;
    updateSection(instanceId, { settings: { ...section.settings, [key]: value } });
  };

  return (
    <BuilderWorkspace
      title={t("constructor.home_title", locale)}
      description={`${t("constructor.home_description", locale)} ${brandName}`}
      previewHref="/"
      livePreviewHref="/app/page-builder/preview"
      published={isPublished}
      saving={saving}
      error={error}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      registry={availableBlocks}
      sections={draft}
      savingLabel={t("constructor.saving", locale)}
      publishDisabled={!hasDraft}
      onSave={saveDraft}
      onPublish={publish}
      onAdd={addBlock}
      onRemove={removeBlock}
      onToggle={toggleEnabled}
      onReorder={reorder}
      onUpdateSettings={updateSettings}
      onReplaceSections={replaceSections}
      templates={MARKETPLACE_TEMPLATES}
      onApplyTemplate={(template) => replaceSections(instantiateTemplate(template, "mp"))}
    >
      {activeTab === "header" && (
        <ConstructorHeaderTab slug={slug} config={page?.headerConfig ?? null} onSaved={refresh} onSaving={() => {}} onError={(msg) => { if (msg) alert(msg); }} />
      )}
      {activeTab === "hero" && (
        <ConstructorHeroTab slug={slug} config={page?.heroConfig ?? null} onSaved={refresh} onSaving={() => {}} onError={(msg) => { if (msg) alert(msg); }} />
      )}
      {activeTab === "search" && (
        <ConstructorSearchTab slug={slug} config={page?.searchConfig ?? null} onSaved={refresh} onSaving={() => {}} onError={(msg) => { if (msg) alert(msg); }} />
      )}
      {activeTab === "content" && <ConstructorContentTab sections={draft} onUpdateSection={updateSection} />}
      {activeTab === "footer" && (
        <ConstructorFooterTab slug={slug} config={page?.footerConfig ?? null} headerConfig={page?.headerConfig ?? null} onSaved={refresh} onSaving={() => {}} onError={(msg) => { if (msg) alert(msg); }} />
      )}
      {activeTab === "design" && (
        <ConstructorDesignTab slug={slug} config={page?.designConfig ?? null} onSaved={refresh} onSaving={() => {}} onError={(msg) => { if (msg) alert(msg); }} />
      )}
    </BuilderWorkspace>
  );
}
