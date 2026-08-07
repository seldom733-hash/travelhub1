"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { countriesDatabase, getCountryName, getCitiesForCountries } from "@/lib/countries-data";

interface CityFilterProps {
  serviceType: string;
  selectedCountries: string[];
  selectedCities: string[];
  onCitiesChange: (cities: string[]) => void;
}

export default function CityFilter({ serviceType, selectedCountries, selectedCities, onCitiesChange }: CityFilterProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [dbCounts, setDbCounts] = useState<Record<string, number>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch DB counts for service type + selected countries
  useEffect(() => {
    if (selectedCountries.length === 0) return;
    let ignore = false;
    async function fetchCounts() {
      try {
        const params = new URLSearchParams({ type: serviceType });
        params.set("countries", selectedCountries.join(","));
        const res = await fetch(`/api/cities?${params}`);
        const data = await res.json();
        if (ignore) return;
        const counts: Record<string, number> = {};
        (data.cities || []).forEach((c: { countryCode: string; name: string; count: number }) => {
          counts[`${c.countryCode}|${c.name}`] = c.count;
        });
        setDbCounts(counts);
      } catch { /* ignore */ }
    }
    fetchCounts();
    return () => { ignore = true; };
  }, [serviceType, selectedCountries]);

  // Get cities from selected countries
  const availableCities = useMemo(() => {
    if (selectedCountries.length === 0) {
      // Show cities from all countries (limited)
      const allCities: { name: string; countryCode: string; country: string }[] = [];
      countriesDatabase.forEach(country => {
        const countryName = getCountryName(country);
        country.cities.forEach(city => {
          allCities.push({ name: city.name.ru, countryCode: country.code, country: countryName });
        });
      });
      return allCities;
    }
    return getCitiesForCountries(selectedCountries);
  }, [selectedCountries]);

  // Filter cities by query
  const filteredCities = useMemo(() => {
    if (query.length < 1) return availableCities.slice(0, 30);
    const q = query.toLowerCase();
    return availableCities.filter(c => c.name.toLowerCase().includes(q)).slice(0, 30);
  }, [availableCities, query]);

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

  const toggleCity = useCallback((cityName: string) => {
    const exists = selectedCities.includes(cityName);
    if (exists) {
      onCitiesChange(selectedCities.filter(c => c !== cityName));
    } else {
      onCitiesChange([...selectedCities, cityName]);
    }
  }, [selectedCities, onCitiesChange]);

  const removeCity = useCallback((name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onCitiesChange(selectedCities.filter(c => c !== name));
  }, [selectedCities, onCitiesChange]);

  const clearAll = useCallback(() => {
    onCitiesChange([]);
    setQuery("");
  }, [onCitiesChange]);

  // Group cities by country code
  const groupedCities = useMemo(() => {
    const groups: Record<string, typeof filteredCities> = {};
    filteredCities.forEach(city => {
      const key = city.countryCode;
      if (!groups[key]) groups[key] = [];
      groups[key].push(city);
    });
    return groups;
  }, [filteredCities]);

  return (
    <div className="relative" ref={containerRef}>
      {/* Selected tags */}
      {selectedCities.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedCities.map(name => (
            <span key={name} className="inline-flex items-center gap-1 px-2.5 py-1 bg-accent/10 text-accent text-xs font-medium rounded-full">
              📍 {name}
              <button onClick={(e) => removeCity(name, e)} className="w-4 h-4 rounded-full bg-accent/20 hover:bg-accent/30 flex items-center justify-center text-accent text-[10px] leading-none transition-colors">✕</button>
            </span>
          ))}
          {selectedCities.length > 1 && (
            <button onClick={clearAll} className="inline-flex items-center px-2 py-1 text-xs text-gray-500 hover:text-red-500 transition-colors">
              Сбросить все
            </button>
          )}
        </div>
      )}

      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🏙</span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          placeholder={selectedCities.length > 0 ? `${selectedCities.length} выбрано` : "Поиск города..."}
          disabled={selectedCountries.length === 0}
          className={`w-full h-10 pl-9 pr-8 rounded-lg border text-sm focus:border-accent focus:ring-0 outline-none bg-white text-gray-900 placeholder:text-gray-400 ${
            selectedCountries.length === 0 ? "border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed" : "border-gray-200"
          }`}
        />
        {query && (
          <button
            onClick={() => { setQuery(""); inputRef.current?.focus(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-500 text-xs transition-colors"
          >✕</button>
        )}
      </div>

      {selectedCountries.length === 0 && (
        <p className="text-xs text-gray-400 mt-1.5">Сначала выберите страну</p>
      )}

      {isOpen && selectedCountries.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-72 overflow-y-auto">
          {filteredCities.length > 0 ? (
            <div className="py-1">
              {Object.entries(groupedCities).map(([code, cities]) => (
                <div key={code}>
                  {selectedCountries.length > 1 && (
                    <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50">{cities[0]?.country || code}</div>
                  )}
                  {cities.map(city => {
                    const checked = selectedCities.includes(city.name);
                    const count = dbCounts[`${city.countryCode}|${city.name}`] || 0;
                    return (
                      <button
                        key={`${city.countryCode}-${city.name}`}
                        onClick={() => toggleCity(city.name)}
                        className={`w-full px-3 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-accent/5 transition-colors ${
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
                        <span className={`flex-1 ${checked ? "font-medium text-primary" : "text-gray-700"}`}>📍 {city.name}</span>
                        {count > 0 && (
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{count}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center">
              <p className="text-gray-500 text-sm font-medium">😔 Города не найдены</p>
              <p className="text-gray-400 text-xs mt-1">Попробуйте другой запрос</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
