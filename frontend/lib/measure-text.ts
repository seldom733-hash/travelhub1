"use client";

import { useEffect, useState } from "react";

/**
 * Text measurement for content-width form controls (extended search form).
 *
 * Every combobox is sized to the longest text it can display: «Откуда/Куда» —
 * the longest geo name in its list, «Ночей от/до» — a 2-digit number, dates —
 * «00.00.0000», etc. Measurement uses the canvas 2D API against the app body
 * font stack (mirrors --th-font-body in globals.css) and is cached per
 * font/text pair, so repeated renders are cheap.
 */

const BODY_FONT_STACK =
  '15px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

let ctx: CanvasRenderingContext2D | null | undefined;
const cache = new Map<string, number>();

function measure(text: string, font: string): number {
  const key = `${font}::${text}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  if (ctx === undefined) {
    ctx = typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
  }
  let px: number;
  if (ctx) {
    ctx.font = font;
    px = ctx.measureText(text).width;
  } else {
    // Graceful fallback when canvas is unavailable (SSR). MUST be
    // deterministic across server and client: React hydration compares the
    // server-rendered HTML against the first client render, and a fallback
    // that differs between the two sides (e.g. one that depends on
    // `document` availability) triggers a hydration mismatch on every
    // content-width control («Ночей от/до», «Куда», даты). A pure function
    // of the text keeps both passes identical; the width is corrected on the
    // client's post-hydration re-render, which is a normal update, not a
    // mismatch.
    px = text.length * 8;
  }
  cache.set(key, px);
  return px;
}

/**
 * Widest of the given strings, measured with the body font at `fontSize` px.
 * Returns 0 for an empty list — callers then fall back to min/max constraints.
 */
export function widestText(texts: string[], fontSize = 15): number {
  if (texts.length === 0) return 0;
  const font = BODY_FONT_STACK.replace("15px", `${fontSize}px`);
  return Math.max(...texts.map((t) => measure(t, font)));
}

/**
 * SSR-safe content width: returns the widest measured width, but 0 on the
 * server AND during React's first (hydration) client render, so the markup
 * matches exactly and no hydration-mismatch warning fires. The real width is
 * applied in a post-mount update — a normal React re-render, not a patch-up.
 *
 * Prefer this over calling `widestText` directly inside `useMemo` for any
 * inline `style` width: canvas measures only in the browser, so a direct call
 * yields the `text.length*8` fallback on the server but a precise value on the
 * client → mismatch. `useMemo` does NOT help, because it re-runs on the client.
 */
export function useWidestText(texts: string[], fontSize = 15): number {
  const key = `${fontSize}|${texts.join("\u0000")}`;
  const [px, setPx] = useState(0);
  useEffect(() => {
    setPx(widestText(texts, fontSize));
    // `key` captures texts+fontSize; re-measure whenever either changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return px;
}
