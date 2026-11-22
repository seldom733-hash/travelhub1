"use client";

import { useState, useEffect, useRef } from "react";
import { constructorApi, type PageConfigView } from "./constructor-api";

/**
 * Fetch published (live) constructor configuration for a given slug.
 * Returns null if no published version exists.
 */
export function useConstructorPublished(slug: string) {
  const [page, setPage] = useState<PageConfigView | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    let retryTimer: number | undefined;
    const fallbackTimer = window.setTimeout(() => {
      if (!cancelled && mountedRef.current) setLoading(false);
    }, 4000);

    async function load(attempt = 0) {
      try {
        const published = await constructorApi.getPublished(slug);
        if (!cancelled && mountedRef.current) {
          setPage(published);
        }
      } catch {
        // Backend may be restarting. Do not render the legacy default layout;
        // retry silently while the neutral shell is visible.
        if (!cancelled && attempt < 5) {
          retryTimer = window.setTimeout(() => void load(attempt + 1), 1500);
        }
      } finally {
        if (attempt === 0) window.clearTimeout(fallbackTimer);
        if (!cancelled && mountedRef.current && attempt === 0) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => { cancelled = true; mountedRef.current = false; window.clearTimeout(fallbackTimer); if (retryTimer) window.clearTimeout(retryTimer); };
  }, [slug]);

  return { page, loading };
}
