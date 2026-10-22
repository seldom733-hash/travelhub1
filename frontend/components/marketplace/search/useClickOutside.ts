"use client";

import { useEffect, type RefObject } from "react";

/**
 * Close an open dropdown when the user clicks (mousedown) outside its
 * container — e.g. on another search control. Subscribes only while `open`
 * so idle forms carry no document listeners.
 */
export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onOutside: () => void,
): void {
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    };
    // Close on `click` (not `mousedown`) so a click on an outside control such
    // as the submit button is not cancelled by the dropdown unmounting during
    // the same interaction.
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [ref, open, onOutside]);
}
