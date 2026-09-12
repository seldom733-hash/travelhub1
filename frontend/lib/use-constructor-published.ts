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

    async function load() {
      try {
        const published = await constructorApi.getPublished(slug);
        if (!cancelled && mountedRef.current) {
          setPage(published);
        }
      } catch {
        // Published config may not exist yet — that's fine
        // Fall back to default layout
      } finally {
        if (!cancelled && mountedRef.current) {
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; mountedRef.current = false; };
  }, [slug]);

  return { page, loading };
}
