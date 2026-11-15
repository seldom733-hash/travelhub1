"use client";

import { useEffect } from "react";

/**
 * Chrome/Firefox render native <input type="date"> using the *browser* locale,
 * ignoring the page lang. The business UI always needs dd.mm.yy. This enhancer
 * keeps the native date picker (calendar, validation, keyboard) but paints a
 * stable dd.mm.yy label above the input's locale-dependent text.
 *
 * The label is absolutely positioned inside the input's own parent, not fixed
 * to the viewport: when a picker/panel scrolls, the label scrolls with it and
 * cannot visually escape the picker.
 */
export default function DateInputFormat() {
  useEffect(() => {
    type Entry = {
      input: HTMLInputElement;
      overlay: HTMLSpanElement;
      color: string;
      parent: HTMLElement;
      parentPositionChanged: boolean;
    };
    const entries = new Map<HTMLInputElement, Entry>();
    let timer: number | undefined;

    const fmt = (value: string) => {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
      if (!m) return "";
      return `${m[3]}.${m[2]}.${m[1].slice(-2)}`;
    };

    const place = (entry: Entry) => {
      const { input, overlay, parent } = entry;
      const width = input.offsetWidth;
      const height = input.offsetHeight;
      if (width <= 0 || height <= 0 || input.type !== "date" || !input.isConnected) {
        overlay.style.display = "none";
        return;
      }
      const cs = window.getComputedStyle(input);
      const padLeft = parseFloat(cs.paddingLeft || "0");
      const padTop = parseFloat(cs.paddingTop || "0");
      const padRight = parseFloat(cs.paddingRight || "0");
      const padBottom = parseFloat(cs.paddingBottom || "0");
      const text = fmt(input.value);
      overlay.style.display = "block";
      overlay.textContent = text || "дд.мм.гг";
      overlay.style.left = `${input.offsetLeft + padLeft}px`;
      overlay.style.top = `${input.offsetTop + padTop}px`;
      overlay.style.width = `${Math.max(0, width - padLeft - padRight - 24)}px`;
      overlay.style.height = `${Math.max(0, height - padTop - padBottom)}px`;
      overlay.style.font = cs.font;
      overlay.style.lineHeight = `${Math.max(0, height - padTop - padBottom)}px`;
      overlay.style.color = text ? entry.color : "rgb(148 163 184)";
      overlay.style.textAlign = cs.textAlign as string;
      overlay.style.direction = cs.direction;
    };

    const updateAll = () => entries.forEach(place);

    const enhance = (input: HTMLInputElement) => {
      if (input.type !== "date" || entries.has(input)) return;
      const parent = input.parentElement;
      if (!parent) return;
      const parentPositionChanged = window.getComputedStyle(parent).position === "static";
      if (parentPositionChanged) parent.style.position = "relative";

      const overlay = document.createElement("span");
      overlay.setAttribute("aria-hidden", "true");
      overlay.dataset.dateOverlay = "1";
      Object.assign(overlay.style, {
        position: "absolute",
        pointerEvents: "none",
        overflow: "hidden",
        whiteSpace: "nowrap",
        zIndex: "30",
        background: "transparent",
      });
      parent.appendChild(overlay);

      const color = window.getComputedStyle(input).color;
      input.style.setProperty("-webkit-text-fill-color", "transparent");
      input.style.caretColor = "transparent";
      const entry = { input, overlay, color, parent, parentPositionChanged };
      entries.set(input, entry);
      const onChange = () => place(entry);
      input.addEventListener("input", onChange);
      input.addEventListener("change", onChange);
      input.addEventListener("focus", onChange);
      input.addEventListener("blur", onChange);
      place(entry);
    };

    const scan = () => {
      entries.forEach(({ input, overlay, parent, parentPositionChanged }) => {
        if (!input.isConnected) {
          overlay.remove();
          if (parentPositionChanged) parent.style.position = "";
          entries.delete(input);
        }
      });
      document.querySelectorAll<HTMLInputElement>('input[type="date"]').forEach(enhance);
      updateAll();
    };

    scan();
    timer = window.setInterval(scan, 400);
    window.addEventListener("scroll", updateAll, true);
    window.addEventListener("resize", updateAll);
    return () => {
      if (timer) window.clearInterval(timer);
      window.removeEventListener("scroll", updateAll, true);
      window.removeEventListener("resize", updateAll);
      entries.forEach(({ input, overlay, parent, parentPositionChanged }) => {
        overlay.remove();
        if (parentPositionChanged) parent.style.position = "";
        input.style.removeProperty("-webkit-text-fill-color");
        input.style.caretColor = "";
      });
      entries.clear();
    };
  }, []);

  return null;
}
