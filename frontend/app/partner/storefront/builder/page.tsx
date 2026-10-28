"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BuilderWorkspace from "@/components/constructor/BuilderWorkspace";
import { generateBlockInstanceId, type BlockDefinition, type PageConfigView, type PageSectionInput, type SectionView } from "@/lib/constructor-api";
import { storefrontConstructorApi } from "@/lib/storefront-constructor-api";
import { storefrontApi } from "@/lib/storefront-api";
import { instantiateTemplate, STOREFRONT_TEMPLATES } from "@/lib/builder-templates";
import type { StorefrontPageSummary } from "@/lib/storefront-constructor-api";

export default function StorefrontBuilderPage() {
  const [page, setPage] = useState<PageConfigView | null>(null);
  const [pages, setPages] = useState<StorefrontPageSummary[]>([]);
  const [currentPageId, setCurrentPageId] = useState<string | undefined>(undefined);
  const [registry, setRegistry] = useState<BlockDefinition[]>([]);
  const [sections, setSections] = useState<SectionView[]>([]);
  const [galleryMedia, setGalleryMedia] = useState<Array<{ id: string; url: string; altText?: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let alive = true;
    storefrontConstructorApi.getPages()
      .then((list) => {
        if (!alive) return;
        setPages(list);
        if (!currentPageId && list[0]) setCurrentPageId(list[0].id);
      })
      .catch((e) => { if (alive) setError((e as Error).message); });
    return () => { alive = false; };
  }, [currentPageId]);

  useEffect(() => {
    if (!currentPageId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [loadedPage, loadedRegistry] = await Promise.all([
          storefrontConstructorApi.getPage(currentPageId),
          storefrontConstructorApi.getRegistry(),
        ]);
        if (!alive) return;
        setPage(loadedPage);
        setRegistry(loadedRegistry);
        setSections(loadedPage.sections);
      } catch (e) {
        if (alive) setError((e as Error).message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [currentPageId]);

  useEffect(() => {
    let alive = true;
    storefrontApi.getOwn()
      .then(async (view) => {
        const media = view.media.filter((m) => m.kind === "GALLERY");
        const withUrls = await Promise.all(media.map(async (m) => {
          try {
            const preview = await storefrontApi.previewMedia(m.id);
            return { id: m.id, url: preview.url, altText: m.altText };
          } catch {
            return { id: m.id, url: "", altText: m.altText };
          }
        }));
        if (alive) setGalleryMedia(withUrls.filter((m) => m.url));
      })
      .catch(() => undefined);
    return () => { alive = false; };
  }, []);

  const addBlock = (type: string) => {
    const def = registry.find((b) => b.type === type);
    if (!def || (def.singleton && sections.some((s) => s.blockType === type))) return;
    const blockInstanceId = generateBlockInstanceId(type, sections.map((s) => s.blockInstanceId));
    setSections((prev) => [
      ...prev,
      {
        id: `new-${blockInstanceId}`,
        blockType: type,
        blockInstanceId,
        sortOrder: prev.length,
        enabled: true,
        settings: { ...def.defaultSettings },
        style: {},
        responsive: {},
        dataSource: {},
        visibility: null,
        localeContent: {},
      },
    ]);
    setNotice("");
  };

  const updateSettings = (instanceId: string, key: string, value: string | number) => {
    setSections((prev) => prev.map((s) => (
      s.blockInstanceId === instanceId ? { ...s, settings: { ...s.settings, [key]: value } } : s
    )));
  };

  const remove = (instanceId: string) => {
    setSections((prev) => prev.filter((s) => s.blockInstanceId !== instanceId).map((s, i) => ({ ...s, sortOrder: i })));
  };

  const toggle = (instanceId: string) => {
    setSections((prev) => prev.map((s) => (s.blockInstanceId === instanceId ? { ...s, enabled: !s.enabled } : s)));
  };

  const reorder = (from: number, to: number) => {
    setSections((prev) => {
      if (from < 0 || to < 0 || from >= prev.length || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next.map((s, i) => ({ ...s, sortOrder: i }));
    });
  };

  const createPage = async () => {
    const name = window.prompt("Название страницы (например, «О нас»)");
    if (!name) return;
    const slug = window.prompt("Адрес страницы (латиницей, например about)");
    if (!slug) return;
    setBusy(true);
    setError("");
    try {
      const created = await storefrontConstructorApi.createPage({ name, slug });
      const list = await storefrontConstructorApi.getPages();
      setPages(list);
      setCurrentPageId(created.id);
      setPage(created);
      setSections(created.sections);
      setNotice("Страница создана. Наполните её и опубликуйте.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const save = async (publish = false) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const payload: PageSectionInput[] = sections.map((s, i) => ({
        blockType: s.blockType,
        blockInstanceId: s.blockInstanceId,
        sortOrder: i,
        enabled: s.enabled,
        settings: s.settings,
        style: s.style,
        responsive: s.responsive,
        dataSource: s.dataSource,
        visibility: s.visibility,
        localeContent: s.localeContent,
      }));
      let updated = await storefrontConstructorApi.saveDraft(payload, currentPageId);
      setPage(updated);
      setSections(updated.sections);
      if (publish) {
        updated = await storefrontConstructorApi.publish(currentPageId);
        setPage(updated);
        setSections(updated.sections);
        setNotice("Сайт опубликован.");
      } else {
        setNotice("Черновик сохранён.");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-sm text-slate-400">Загрузка конструктора…</div>;
  }

  if (!page) {
    return (
      <div className="mx-auto max-w-xl p-8">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          {error || "Сначала создайте витрину партнёра."}
        </div>
        <Link href="/partner/storefront" className="mt-4 inline-block text-sm text-emerald-700 hover:underline">
          ← Вернуться к витрине
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <Link href="/partner/storefront" className="text-xs text-slate-500 hover:text-emerald-700">← Управление витриной</Link>
      {notice && <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{notice}</div>}
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
        <span className="text-xs font-medium text-slate-500">Страница:</span>
        <select
          value={currentPageId ?? ""}
          onChange={(e) => { setPage(null); setCurrentPageId(e.target.value); }}
          className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
        >
          {pages.map((p) => <option key={p.id} value={p.id}>{p.name}{p.isHome ? " (главная)" : ""}{p.published ? "" : " · черновик"}</option>)}
        </select>
        <button type="button" onClick={() => void createPage()} className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50">+ Новая страница</button>
      </div>
      <BuilderWorkspace
        title="Конструктор сайта"
        description="Соберите сайт из блоков, сохраните черновик и опубликуйте. Публичная страница появится после активации витрины."
        previewHref={currentPageId ? `/preview/storefront?pageId=${encodeURIComponent(currentPageId)}` : "/preview/storefront"}
        livePreviewHref={currentPageId ? `/preview/storefront?pageId=${encodeURIComponent(currentPageId)}` : "/preview/storefront"}
        published={page.status === "PUBLISHED" && page.currentVersion != null}
        saving={busy}
        error={error}
        tabs={[{ id: "structure", label: "Структура" }]}
        activeTab="structure"
        onTabChange={() => {}}
        registry={registry}
        sections={sections}
        savingLabel="Сохранение…"
        onSave={() => void save(false)}
        onPublish={() => void save(true)}
        onAdd={addBlock}
        onRemove={remove}
        onToggle={toggle}
        onReorder={reorder}
        onUpdateSettings={updateSettings}
        onReplaceSections={setSections}
        templates={STOREFRONT_TEMPLATES}
        onApplyTemplate={(template) => setSections(instantiateTemplate(template, "sf"))}
        seo={page.seo}
        galleryMedia={galleryMedia}
        design={page.designConfig}
        onSaveDesign={async (input) => {
          const updated = await storefrontConstructorApi.saveDesign(input, currentPageId);
          setPage(updated);
          setNotice("Brand kit сохранён.");
        }}
        onSaveSeo={async (input) => {
          const updated = await storefrontConstructorApi.saveSeo(input, currentPageId);
          setPage(updated);
          setNotice("SEO сохранено.");
        }}
      />
    </div>
  );
}
