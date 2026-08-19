"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  workspaceApi,
  type EffectiveLayout,
  type WidgetDefinition,
  type WidgetPosition,
} from "./workspace-api";

// ─── useWorkspaceLayout ──────────────────────────────────────────────

/**
 * Hook: loads and caches effective layout for a given page.
 * Re-fetches on mount and provides refresh/save/reset methods.
 * Does NOT fan-out per-widget requests — page-level aggregation.
 */
export function useWorkspaceLayout(pageId: string) {
  const [layout, setLayout] = useState<EffectiveLayout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => {
      mountedRef.current = false;
    };
  }, [pageId]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await workspaceApi.getEffectiveLayout(pageId);
      if (mountedRef.current) setLayout(data);
    } catch (e: unknown) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : "Failed to load layout");
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  const refresh = useCallback(async () => {
    await load();
  }, [pageId]);

  const saveLayout = useCallback(
    async (widgets: WidgetPosition[]) => {
      setLoading(true);
      setError(null);
      try {
        const data = await workspaceApi.saveLayout(pageId, widgets);
        if (mountedRef.current) setLayout(data);
        return data;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to save layout";
        if (mountedRef.current) setError(msg);
        throw e;
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    },
    [pageId],
  );

  const resetLayout = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await workspaceApi.resetLayout(pageId);
      if (mountedRef.current) setLayout(data);
      return data;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to reset layout";
      if (mountedRef.current) setError(msg);
      throw e;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [pageId]);

  return {
    layout,
    loading,
    error,
    refresh,
    saveLayout,
    resetLayout,
  };
}

// ─── useWorkspaceCustomize ───────────────────────────────────────────

/**
 * Hook: manages customize mode state for a workspace page.
 * Tracks active widget positions, supports add/remove/reorder, and
 * exposes save/reset actions.
 */
export function useWorkspaceCustomize(
  layout: EffectiveLayout | null,
  userPermissions: string[],
) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<WidgetPosition[]>([]);

  /** Enter customize mode with current layout positions. */
  const enterCustomize = useCallback(() => {
    if (!layout) return;
    setDraft([...layout.widgets]);
    setEditing(true);
  }, [layout]);

  /** Exit without saving. */
  const cancelCustomize = useCallback(() => {
    setEditing(false);
    setDraft([]);
  }, []);

  /** Move a widget to a new position. */
  const moveWidget = useCallback(
    (widgetId: string, x: number, y: number) => {
      setDraft((prev) =>
        prev.map((w) => (w.widgetId === widgetId ? { ...w, x, y } : w)),
      );
    },
    [],
  );

  /** Resize a widget. */
  const resizeWidget = useCallback(
    (widgetId: string, w: number, h: number) => {
      setDraft((prev) =>
        prev.map((wp) =>
          wp.widgetId === widgetId ? { ...wp, w, h } : wp,
        ),
      );
    },
    [],
  );

  /** Toggle widget visibility. */
  const toggleVisible = useCallback((widgetId: string) => {
    setDraft((prev) =>
      prev.map((w) =>
        w.widgetId === widgetId ? { ...w, visible: !w.visible } : w,
      ),
    );
  }, []);

  /** Add an available widget to the draft. */
  const addWidget = useCallback(
    (widget: WidgetDefinition) => {
      setDraft((prev) => {
        if (prev.some((w) => w.widgetId === widget.widgetId)) return prev;
        return [
          ...prev,
          {
            widgetId: widget.widgetId,
            x: 0,
            y: 0,
            w: widget.defaultW,
            h: widget.defaultH,
            visible: true,
          },
        ];
      });
    },
    [],
  );

  /** Remove a widget from the draft (only if not required). */
  const removeWidget = useCallback(
    (widgetId: string, definitions: WidgetDefinition[]) => {
      const def = definitions.find((d) => d.widgetId === widgetId);
      if (def?.required) return;
      setDraft((prev) => prev.filter((w) => w.widgetId !== widgetId));
    },
    [],
  );

  return {
    editing,
    draft,
    enterCustomize,
    cancelCustomize,
    moveWidget,
    resizeWidget,
    toggleVisible,
    addWidget,
    removeWidget,
    setDraft,
  };
}

// ─── useWorkspaceAvailableWidgets ────────────────────────────────────

/**
 * Hook: loads available widgets for a page (filtered by RBAC).
 * Does NOT initiate per-widget data requests — just registry metadata.
 */
export function useWorkspaceAvailableWidgets(pageId: string) {
  const [widgets, setWidgets] = useState<WidgetDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    workspaceApi
      .getAvailableWidgets(pageId)
      .then((data) => {
        if (mountedRef.current) setWidgets(data);
      })
      .catch(() => {
        if (mountedRef.current) setWidgets([]);
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false);
      });
    return () => {
      mountedRef.current = false;
    };
  }, [pageId]);

  return { widgets, loading };
}
