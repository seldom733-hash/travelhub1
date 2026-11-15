"use client";

import { useEffect } from "react";

/**
 * Chrome/Firefox render native <input type="date"> using the *browser* locale,
 * ignoring the page lang. The business UI always needs dd.mm.yy. This enhancer
 * keeps the native date picker (calendar, validation, keyboard) but paints a
 * stable dd.mm.yy label above the input's locale-dependent text.
 */
export default function DateInputFormat() {
  useEffect(() => {
    type Entry = { input: HTMLInputElement; overlay: HTMLSpanElement; color: string };
    const entries = new Map<HTMLInputElement, Entry>();
    let timer: number | undefined;

    const fmt = (value: string) => {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
      if (!m) return "";
      return `${m[3]}.${m[2]}.${m[1].slice(-2)}`;
    };

    const place = (entry: Entry) => {
      const { input, overlay } = entry;
      const rect = input.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0 || input.type !== "date") {
        overlay.style.display = "none";
        return;
      }
      const cs = window.getComputedStyle(input);
      const padLeft = parseFloat(cs.paddingLeft || "0");
      const padTop = parseFloat(cs.paddingTop || "0");
      const text = fmt(input.value);
      overlay.style.display = "block";
      overlay.textContent = text || "дд.мм.гг";
      overlay.style.left = `${rect.left + padLeft}px`;
      overlay.style.top = `${rect.top + padTop}px`;
      overlay.style.width = `${Math.max(0, rect.width - padLeft - parseFloat(cs.paddingRight || "0") - 24)}px`;
      overlay.style.height = `${Math.max(0, rect.height - padTop - parseFloat(cs.paddingBottom || "0"))}px`;
      overlay.style.font = cs.font;
      overlay.style.lineHeight = `${Math.max(0, rect.height - padTop - parseFloat(cs.paddingBottom || "0"))}px`;
      overlay.style.color = text ? entry.color : "rgb(148 163 184)";
      overlay.style.textAlign = cs.textAlign as string;
      overlay.style.direction = cs.direction;
    };

    const updateAll = () => entries.forEach(place);

    const enhance = (input: HTMLInputElement) => {
      if (input.type !== "date" || entries.has(input)) return;
      const overlay = document.createElement("span");
      overlay.setAttribute("aria-hidden", "true");
      overlay.dataset.dateOverlay = "1";
      Object.assign(overlay.style, {
        position: "fixed",
        pointerEvents: "none",
        overflow: "hidden",
        whiteSpace: "nowrap",
        zIndex: "2147483000",
        background: "transparent",
      });
      document.body.appendChild(overlay);
      const color = window.getComputedStyle(input).color;
      input.style.setProperty("-webkit-text-fill-color", "transparent");
      input.style.caretColor = "transparent";
      const entry = { input, overlay, color };
      entries.set(input, entry);
      const onChange = () => place(entry);
      input.addEventListener("input", onChange);
      input.addEventListener("change", onChange);
      input.addEventListener("focus", onChange);
      input.addEventListener("blur", onChange);
      place(entry);
    };

    const scan = () => {
      entries.forEach(({ input, overlay }) => {
        if (!input.isConnected) { overlay.remove(); entries.delete(input); }
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
      entries.forEach(({ input, overlay }) => {
        overlay.remove();
        input.style.removeProperty("-webkit-text-fill-color");
        input.style.caretColor = "";
      });
      entries.clear();
    };
  }, []);

  return null;
}
