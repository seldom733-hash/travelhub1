"use client";

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
  let px = text.length * 8; // graceful fallback when canvas is unavailable
  if (ctx) {
    ctx.font = font;
    px = ctx.measureText(text).width;
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
