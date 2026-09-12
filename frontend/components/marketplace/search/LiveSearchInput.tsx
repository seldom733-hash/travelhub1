"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MagnifyingGlass, CaretDown, X } from "@phosphor-icons/react";
import { useLiveSearch, type SuggestResult } from "@/lib/search-engine";

interface LiveSearchInputProps {
  id: string;
  label: string;
  placeholder: string;
  icon?: React.ReactNode;
  onSelect: (result: SuggestResult) => void;
  onClear?: () => void;
  value?: string;
  className?: string;
  filterType?: string;
  disabled?: boolean;
  required?: boolean;
  "aria-describedby"?: string;
}

export default function LiveSearchInput({
  id,
  label,
  placeholder,
  icon,
  onSelect,
  onClear,
  value: controlledValue,
  className = "",
  filterType,
  disabled = false,
  required = false,
  "aria-describedby": ariaDescribedBy,
}: LiveSearchInputProps) {
  const [query, setQuery] = useState(controlledValue || "");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (controlledValue !== undefined) setQuery(controlledValue);
  }, [controlledValue]);

  const { results, loading } = useLiveSearch(query, filterType);

  const handleSelect = useCallback((result: SuggestResult) => {
    setQuery(result.name);
    setIsOpen(false);
    setHighlightedIndex(-1);
    onSelect(result);
  }, [onSelect]);

  const handleClear = useCallback(() => {
    setQuery("");
    setIsOpen(false);
    onClear?.();
    inputRef.current?.focus();
  }, [onClear]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex(prev => Math.min(prev + 1, results.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex(prev => Math.max(prev - 1, -1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && results[highlightedIndex]) {
          handleSelect(results[highlightedIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  useEffect(() => {
    if (highlightedIndex >= 0 && listboxRef.current) {
      const item = listboxRef.current.children[highlightedIndex] as HTMLElement;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  const showDropdown = isOpen && query.length >= 2;

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <label htmlFor={id} className="mb-0.5 block text-[11px] font-medium text-neutral-400">
        {label}
        {required && <span className="ml-0.5 text-gold">*</span>}
      </label>
      <div className="relative">
        {icon && (
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">
            {icon}
          </div>
        )}
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(-1);
          }}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={`${id}-listbox`}
          aria-activedescendant={highlightedIndex >= 0 ? `${id}-option-${highlightedIndex}` : undefined}
          aria-describedby={ariaDescribedBy}
          className="w-full rounded-xl border border-dark-border bg-dark-card py-2 pl-9 pr-8 text-[13px] text-white placeholder-neutral-500 outline-none transition-colors focus:border-gold/50"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
            aria-label="Clear"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {showDropdown && (
        <ul
          ref={listboxRef}
          id={`${id}-listbox`}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-dark-border bg-dark-surface/95 shadow-xl backdrop-blur-md"
        >
          {loading && (
            <li className="px-4 py-3 text-center text-sm text-neutral-500">
              <span className="inline-block animate-pulse">Поиск...</span>
            </li>
          )}
          {!loading && results.length === 0 && query.length >= 2 && (
            <li className="px-4 py-3 text-center text-sm text-neutral-500">
              Ничего не найдено
            </li>
          )}
          {!loading && results.map((result, index) => (
            <li
              key={`${result.type}-${result.id}`}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={index === highlightedIndex}
              onClick={() => handleSelect(result)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                index === highlightedIndex ? "bg-white/5 text-white" : "text-neutral-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              {result.imageUrl && (
                <img src={result.imageUrl} alt="" className="size-8 rounded-lg object-cover" />
              )}
              {!result.imageUrl && (
                <div className="flex size-8 items-center justify-center rounded-lg bg-gold/10 text-xs text-gold">
                  {result.type === "destination" && "📍"}
                  {result.type === "hotel" && "🏨"}
                  {result.type === "tour" && "✈️"}
                  {result.type === "service" && "🔧"}
                </div>
              )}
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
    </div>
  );
}
