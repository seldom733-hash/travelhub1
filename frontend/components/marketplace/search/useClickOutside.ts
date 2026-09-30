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
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, open, onOutside]);
}
