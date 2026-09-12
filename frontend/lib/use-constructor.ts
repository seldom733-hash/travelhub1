"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  constructorApi,
  type PageConfigView,
  type SectionView,
  type BlockDefinition,
  type PageSectionInput,
  generateBlockInstanceId,
} from "./constructor-api";

// ─── useConstructor Hook ─────────────────────────────────────────────────────

export function useConstructor(slug: string) {
  const [page, setPage] = useState<PageConfigView | null>(null);
  const [registry, setRegistry] = useState<BlockDefinition[]>([]);
  const [draft, setDraft] = useState<SectionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  // Load page + registry
  const refresh = useCallback(async () => {
    if (!mountedRef.current) return;
    setLoading(true);
    setError(null);
    try {
      const [pageData, registryData] = await Promise.all([
        constructorApi.getPage(slug),
        constructorApi.getRegistry("marketplace"),
      ]);
      if (!mountedRef.current) return;
      setPage(pageData);
      setRegistry(registryData);
      setDraft(pageData.sections);
    } catch (e: unknown) {
      if (!mountedRef.current) return;
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [slug]);

  useEffect(() => { refresh(); }, [refresh]);

  // Save draft
  const saveDraft = useCallback(async () => {
    if (!mountedRef.current) return;
    setSaving(true);
    setError(null);
    try {
      const sections: PageSectionInput[] = draft.map((s, i) => ({
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
      const updated = await constructorApi.saveDraft(slug, sections);
      if (!mountedRef.current) return;
      setPage(updated);
      setDraft(updated.sections);
    } catch (e: unknown) {
      if (!mountedRef.current) return;
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }, [slug, draft]);

  // Add block
  const addBlock = useCallback((blockType: string) => {
    const def = registry.find((r) => r.type === blockType);
    if (!def) return;

    // Check singleton
    if (def.singleton && draft.some((s) => s.blockType === blockType)) return;

    const existingIds = draft.map((s) => s.blockInstanceId);
    const blockInstanceId = generateBlockInstanceId(blockType, existingIds);

    const newSection: SectionView = {
      id: crypto.randomUUID(),
      blockType,
      blockInstanceId,
      sortOrder: draft.length,
      enabled: true,
      settings: def.defaultSettings,
      style: {},
      responsive: {},
      dataSource: { type: def.dataSourceType, params: {}, cacheTtl: 60 },
      visibility: null,
      localeContent: {},
    };

    setDraft((prev) => [...prev, newSection]);
  }, [registry, draft]);

  // Remove block
  const removeBlock = useCallback((blockInstanceId: string) => {
    setDraft((prev) => prev.filter((s) => s.blockInstanceId !== blockInstanceId));
  }, []);

  // Toggle enabled
  const toggleEnabled = useCallback((blockInstanceId: string) => {
    setDraft((prev) =>
      prev.map((s) =>
        s.blockInstanceId === blockInstanceId ? { ...s, enabled: !s.enabled } : s
      )
    );
  }, []);

  // Reorder (drag & drop result)
  const reorder = useCallback((fromIndex: number, toIndex: number) => {
    setDraft((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next.map((s, i) => ({ ...s, sortOrder: i }));
    });
  }, []);

  // Available blocks (not in draft or not singleton)
  const availableBlocks = registry.filter((def) => {
    if (def.singleton && draft.some((s) => s.blockType === def.type)) return false;
    return true;
  });

  return {
    page,
    registry,
    draft,
    loading,
    saving,
    error,
    availableBlocks,
    refresh,
    saveDraft,
    addBlock,
    removeBlock,
    toggleEnabled,
    reorder,
  };
}
