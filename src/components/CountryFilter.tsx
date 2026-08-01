"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { countriesDatabase, searchCountries, getCountryName, type CountryData } from "@/lib/countries-data";

interface CountryFilterProps {
  serviceType: string;
  selectedCountries: string[];
  onCountriesChange: (countries: string[]) => void;
}

export default function CountryFilter({ serviceType, selectedCountries, onCountriesChange }: CountryFilterProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [dbCounts, setDbCounts] = useState<Record<string, number>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch DB counts for service type
  useEffect(() => {
    async function fetchCounts() {
      try {
        const params = new URLSearchParams({ type: serviceType });
        const res = await fetch(`/api/countries?${params}`);
        const data = await res.json();
        const counts: Record<string, number> = {};
        (data.countries || []).forEach((c: { code: string; name: string; count: number }) => {
          counts[c.code] = c.count;
        });
        setDbCounts(counts);
      } catch { /* ignore */ }
    }
    fetchCounts();
  }, [serviceType]);

  // Search countries from static data
  const filteredCountries = useMemo(() => {
    if (query.length < 1) {
      // Show popular countries when no query
      const popular = ["TR", "AZ", "AE", "EG", "GE", "TH", "IT", "ES", "GR", "RU"];
      return countriesDatabase.filter(c => popular.includes(c.code));
    }
    return searchCountries(query);
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleCountry = useCallback((country: CountryData) => {
    const exists = selectedCountries.includes(country.code);
    if (exists) {
      onCountriesChange(selectedCountries.filter(c => c !== country.code));
    } else {
      onCountriesChange([...selectedCountries, country.code]);
    }
  }, [selectedCountries, onCountriesChange]);

  const removeCountry = useCallback((code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onCountriesChange(selectedCountries.filter(c => c !== code));
  }, [selectedCountries, onCountriesChange]);

  const clearAll = useCallback(() => {
    onCountriesChange([]);
    setQuery("");
  }, [onCountriesChange]);

  return (
    <div className="relative" ref={containerRef}>
      {/* Selected tags */}
      {selectedCountries.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedCountries.map(code => {
            const country = countriesDatabase.find(c => c.code === code);
            const displayName = country ? getCountryName(country) : code;
            return (
              <span key={code} className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">
                {displayName}
                <button onClick={(e) => removeCountry(code, e)} className="w-4 h-4 rounded-full bg-primary/20 hover:bg-primary/30 flex items-center justify-center text-primary text-[10px] leading-none transition-colors">✕</button>
              </span>
            );
          })}
          {selectedCountries.length > 1 && (
            <button onClick={clearAll} className="inline-flex items-center px-2 py-1 text-xs text-gray-500 hover:text-red-500 transition-colors">
              Сбросить все
            </button>
          )}
        </div>
      )}

      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🌍</span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          placeholder={selectedCountries.length > 0 ? `${selectedCountries.length} выбрано` : "Поиск страны..."}
          className="w-full h-10 pl-9 pr-8 rounded-lg border border-gray-200 text-sm focus:border-primary focus:ring-0 outline-none bg-white text-gray-900 placeholder:text-gray-400"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); inputRef.current?.focus(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-500 text-xs transition-colors"
          >✕</button>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-72 overflow-y-auto">
          {filteredCountries.length > 0 ? (
            <div className="py-1">
              {filteredCountries.slice(0, 30).map((country) => {
                const displayName = getCountryName(country);
                const checked = selectedCountries.includes(country.code);
                const count = dbCounts[country.code] || 0;
                return (
                  <button
                    key={country.code}
                    onClick={() => toggleCountry(country)}
                    className={`w-full px-3 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-primary/5 transition-colors ${
                      checked ? "bg-primary/10" : ""
                    }`}
                  >
                    <span className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      checked ? "bg-primary border-primary" : "border-gray-300"
                    }`}>
                      {checked && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span className="flex items-center gap-2 flex-1">
                      <span className="text-base">🏳️</span>
                      <span className={checked ? "font-medium text-primary" : "text-gray-700"}>{displayName}</span>
                    </span>
                    {count > 0 && (
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-4 text-center">
              <p className="text-gray-500 text-sm font-medium">Страна не найдена</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
