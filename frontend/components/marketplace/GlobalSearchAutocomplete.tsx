"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { useLiveSearch, type SuggestResult } from "@/lib/search-engine";

export default function GlobalSearchAutocomplete() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);

  const { results, loading } = useLiveSearch(query, "all");

  const handleSelect = useCallback((result: SuggestResult) => {
    setQuery("");
    setIsOpen(false);
    router.push(result.href);
  }, [router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setIsOpen(false);
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) => Math.min(prev + 1, results.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => Math.max(prev - 1, -1));
        break;
      case "Enter":
        if (highlightedIndex >= 0 && results[highlightedIndex]) {
          e.preventDefault();
          handleSelect(results[highlightedIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  // Scroll highlighted into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listboxRef.current) {
      const item = listboxRef.current.children[highlightedIndex] as HTMLElement;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  const showDropdown = isOpen && query.length >= 2;

  return (
    <div className="relative hidden w-full max-w-lg md:block" ref={containerRef}>
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">
            <MagnifyingGlass size={16} weight="light" />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
              setHighlightedIndex(-1);
            }}
            onFocus={() => query.length >= 2 && setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Поиск отелей, туров, экскурсий и услуг..."
            autoComplete="off"
            role="combobox"
            aria-expanded={showDropdown}
            aria-controls="global-search-listbox"
            aria-activedescendant={highlightedIndex >= 0 ? `global-search-option-${highlightedIndex}` : undefined}
            className="w-full rounded-lg border border-dark-border bg-dark-card py-2 pl-9 pr-4 text-sm text-white placeholder-neutral-500 outline-none transition-colors focus:border-gold/40"
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(""); setIsOpen(false); inputRef.current?.focus(); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
              aria-label="Очистить"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </form>

      {/* Autocomplete dropdown */}
      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-xl border border-dark-border bg-dark-surface/95 shadow-xl backdrop-blur-md">
          {loading && (
            <div className="px-4 py-3 text-center text-sm text-neutral-500">
              <span className="inline-block animate-pulse">Поиск...</span>
            </div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-4 py-3 text-center text-sm text-neutral-500">
              Ничего не найдено
            </div>
          )}
          {!loading && results.length > 0 && (
            <ul ref={listboxRef} id="global-search-listbox" role="listbox">
              {results.map((result, index) => (
                <li
                  key={`${result.type}-${result.id}`}
                  id={`global-search-option-${index}`}
                  role="option"
                  aria-selected={index === highlightedIndex}
                  onClick={() => handleSelect(result)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                    index === highlightedIndex ? "bg-white/5 text-white" : "text-neutral-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <div className="flex size-8 items-center justify-center rounded-lg bg-gold/10 text-[10px] font-bold text-gold">
                    {result.type === "destination" && "🌍"}
                    {result.type === "hotel" && "🏨"}
                    {result.type === "tour" && "✈️"}
                    {result.type === "service" && "🔧"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-white">{result.name}</div>
                    {result.subtitle && (
                      <div className="truncate text-[11px] text-neutral-500">{result.subtitle}</div>
                    )}
                  </div>
                  <span className="shrink-0 rounded-full bg-dark-card px-2 py-0.5 text-[10px] text-neutral-500">
                    {result.type}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {/* Show all results link */}
          {!loading && query.trim() && (
            <button
              onClick={() => { setIsOpen(false); router.push(`/search?q=${encodeURIComponent(query.trim())}`); }}
              className="w-full border-t border-dark-border px-4 py-2.5 text-center text-[13px] text-gold transition-colors hover:bg-white/5"
            >
              Показать все результаты →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
