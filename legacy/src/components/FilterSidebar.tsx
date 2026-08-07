"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { filterConfigs, type ServiceCategory, type FilterDefinition } from "@/lib/filterConfig";
import CountryFilter from "@/components/CountryFilter";
import CityFilter from "@/components/CityFilter";

export interface FilterState {
  [key: string]: string[] | [number, number] | number | string;
}

interface FilterSidebarProps {
  category: ServiceCategory;
  onFilterChange?: (filters: FilterState) => void;
  onSortChange?: (sort: string) => void;
  filterState?: FilterState;
  noSticky?: boolean;
}

/** Group header labels for tour filters */
const TOUR_GROUP_HEADERS: Record<string, string> = {
  hotel: "Фильтры отеля",
  flight: "Фильтры авиарейса",
};

/** Filter types that render as expandable accordion (not combobox) */
const ACCORDION_TYPES = new Set(["range", "rating", "date"]);

export default function FilterSidebar({
  category,
  onFilterChange,
  onSortChange,
  filterState,
  noSticky,
}: FilterSidebarProps) {
  const allFilters = useMemo(() => filterConfigs[category] || [], [category]);
  const priceFilter = useMemo(() => allFilters.find((f) => f.type === "range"), [allFilters]);

  const coreFilterIds = ["country", "city", "stars", "meal", "price", "rating"];
  const [expandedFilters, setExpandedFilters] = useState<string[]>(
    allFilters.filter((f) => coreFilterIds.includes(f.id)).map((f) => f.id)
  );
  const [selectedValues, setSelectedValues] = useState<Record<string, string[]>>({});
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<[number, number]>([
    priceFilter?.min || 0,
    priceFilter?.max || 5000,
  ]);
  const [selectedRating, setSelectedRating] = useState<number>(0);
  const [sortBy, setSortBy] = useState("popular");
  const [showAllFilters, setShowAllFilters] = useState<Record<string, boolean>>({});
  const [filterSearch, setFilterSearch] = useState<Record<string, string>>({});
  const [openCombobox, setOpenCombobox] = useState<string | null>(null);
  const SHOW_MORE_THRESHOLD = 6;
  const SEARCH_THRESHOLD = 8;

  useEffect(() => {
    if (!openCombobox) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (target instanceof HTMLElement && target.closest("[data-cb]")) return;
      setOpenCombobox(null);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openCombobox]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    Object.values(selectedValues).forEach((arr) => {
      if (arr.length > 0) count += arr.length;
    });
    if (selectedRating > 0) count++;
    count += selectedCountries.length;
    count += selectedCities.length;
    const pf = allFilters.find((f) => f.type === "range");
    if (pf && (priceRange[0] > (pf.min || 0) || priceRange[1] < (pf.max || 5000))) count++;
    return count;
  }, [selectedValues, selectedRating, priceRange, selectedCountries, selectedCities, allFilters]);

  const sortOptions = [
    { value: "popular", label: "Популярные" },
    { value: "price_asc", label: "Сначала дешёвые" },
    { value: "price_desc", label: "Сначала дорогие" },
    { value: "rating", label: "По рейтингу" },
    { value: "newest", label: "Новейшие" },
  ];

  const toggleFilter = (id: string) => {
    setExpandedFilters((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  const toggleArrayItem = useCallback((filterId: string, item: string) => {
    setSelectedValues((prev) => {
      const arr = prev[filterId] || [];
      return {
        ...prev,
        [filterId]: arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item],
      };
    });
  }, []);

  const resetAll = useCallback(() => {
    setPriceRange([priceFilter?.min || 0, priceFilter?.max || 5000]);
    setSelectedRating(0);
    setSelectedValues({});
    setSelectedCountries([]);
    setSelectedCities([]);
    setShowAllFilters({});
    setFilterSearch({});
    onFilterChange?.({});
  }, [priceFilter, onFilterChange]);

  const handleSortChange = useCallback(
    (value: string) => {
      setSortBy(value);
      onSortChange?.(value);
    },
    [onSortChange]
  );

  // Синхронизация при сбросе фильтров родителем: канонический паттерн React
  // «adjust state during render» — сравнение через state вместо ref, чтобы не
  // нарушать правила react-hooks (запрещён доступ к ref.current в рендере).
  const [prevFilterKey, setPrevFilterKey] = useState<string>(() => JSON.stringify(filterState));
  const serializedFilter = JSON.stringify(filterState);
  if (serializedFilter !== prevFilterKey) {
    setPrevFilterKey(serializedFilter);
    if (filterState && Object.keys(filterState).length === 0) {
      setSelectedValues({});
      setSelectedRating(0);
      setSelectedCountries([]);
      setSelectedCities([]);
      const pf = allFilters.find((f) => f.type === "range");
      setPriceRange([pf?.min || 0, pf?.max || 5000]);
    }
  }

  const getComboboxLabel = (filter: FilterDefinition): string => {
    const selected = selectedValues[filter.id] || [];
    if (selected.length === 0) return "Выбрать...";
    if (selected.length === 1) {
      const opt = filter.options?.find((o) => o.value === selected[0]);
      if (opt) return opt.label;
    }
    return `${filter.i18nKey} (${selected.length})`;
  };

  const clearFilter = (filterId: string) => {
    setSelectedValues((prev) => {
      const next = { ...prev };
      delete next[filterId];
      return next;
    });
  };

  const getSelectedCount = (filter: FilterDefinition): number => {
    if (filter.type === "country") return selectedCountries.length;
    if (filter.type === "city") return selectedCities.length;
    return selectedValues[filter.id]?.length || 0;
  };

  const clearSelected = (filter: FilterDefinition) => {
    if (filter.type === "country") {
      setSelectedCountries([]);
      setSelectedCities([]);
      return;
    }
    if (filter.type === "city") {
      setSelectedCities([]);
      return;
    }
    clearFilter(filter.id);
  };

  const renderFilterOption = (
    filter: FilterDefinition,
    option: { label: string; value: string }
  ) => {
    const label = option.label;
    const checked = (selectedValues[filter.id] || []).includes(option.value);

    if (filter.type === "checkbox") {
      return (
        <label
          key={option.value}
          className="flex items-center gap-2.5 cursor-pointer group py-1 px-1 rounded hover:bg-gray-50 transition-colors"
        >
          <input
            type="checkbox"
            checked={checked}
            onChange={() => toggleArrayItem(filter.id, option.value)}
            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <span className="text-sm text-gray-600 group-hover:text-secondary transition-colors">
            {label}
          </span>
        </label>
      );
    }

    if (filter.type === "radio") {
      return (
        <label
          key={option.value}
          className="flex items-center gap-2.5 cursor-pointer group py-1 px-1 rounded hover:bg-gray-50 transition-colors"
        >
          <input
            type="radio"
            name={filter.id}
            checked={checked}
            onChange={() => toggleArrayItem(filter.id, option.value)}
            className="w-4 h-4 border-gray-300 text-primary focus:ring-primary"
          />
          <span className="text-sm text-gray-600 group-hover:text-secondary transition-colors">
            {label}
          </span>
        </label>
      );
    }

    return null;
  };

  const renderCombobox = (filter: FilterDefinition) => {
    if (!filter.options) return null;
    const isOpen = openCombobox === filter.id;
    const isExpanded = showAllFilters[filter.id] || false;
    const hasMore = filter.options.length > SHOW_MORE_THRESHOLD;
    const hasSearch = filter.options.length >= SEARCH_THRESHOLD;
    const searchQuery = (filterSearch[filter.id] || "").toLowerCase();
    const filteredOptions = searchQuery
      ? filter.options.filter((opt) => opt.label.toLowerCase().includes(searchQuery))
      : filter.options;
    const visibleOptions =
      hasMore && !isExpanded && !searchQuery
        ? filteredOptions.slice(0, SHOW_MORE_THRESHOLD)
        : filteredOptions;
    const selected = selectedValues[filter.id] || [];

    return (
      <div data-cb={filter.id} className="relative">
        <button
          onClick={() => setOpenCombobox(isOpen ? null : filter.id)}
          className={`w-full h-10 px-3 rounded-lg border text-sm text-left flex items-center justify-between transition-colors ${
            isOpen
              ? "border-primary ring-1 ring-primary/20"
              : selected.length > 0
                ? "border-primary/40 bg-primary/5"
                : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <span
            className={`truncate ${selected.length > 0 ? "text-secondary font-medium" : "text-gray-500"}`}
          >
            {getComboboxLabel(filter)}
          </span>
          <span className="flex items-center gap-1 ml-2 shrink-0">
            {selected.length > 0 && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  clearFilter(filter.id);
                }}
                className="text-gray-400 hover:text-red-500 transition-colors text-xs px-0.5"
              >
                ✕
              </span>
            )}
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </span>
        </button>

        {isOpen && (
          <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-[320px] overflow-hidden flex flex-col">
            {hasSearch && (
              <div className="p-2 border-b border-gray-100 shrink-0">
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setFilterSearch((prev) => ({ ...prev, [filter.id]: e.target.value }))}
                    placeholder="Поиск..."
                    className="w-full h-8 pl-7 pr-7 rounded-lg border border-gray-200 text-xs focus:border-primary outline-none bg-white text-gray-900 placeholder:text-gray-400"
                    autoFocus
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setFilterSearch((prev) => ({ ...prev, [filter.id]: "" }))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            )}
            <div className="overflow-y-auto flex-1 p-2">
              {visibleOptions.length === 0 && searchQuery ? (
                <p className="text-xs text-gray-400 py-3 text-center">Ничего не найдено</p>
              ) : (
                visibleOptions.map((opt) => renderFilterOption(filter, opt))
              )}
            </div>
            {hasMore && !searchQuery && (
              <div className="p-2 border-t border-gray-100 shrink-0">
                <button
                  onClick={() => setShowAllFilters((prev) => ({ ...prev, [filter.id]: !prev[filter.id] }))}
                  className="w-full text-xs font-medium text-primary hover:text-primary-dark transition-colors py-1"
                >
                  {isExpanded
                    ? "Свернуть"
                    : `Показать ещё (${Math.max(0, filteredOptions.length - SHOW_MORE_THRESHOLD)})`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderInlineFilterContent = (filter: FilterDefinition) => {
    switch (filter.type) {
      case "date":
        return (
          <div>
            <input
              type="date"
              value={(selectedValues[filter.id] as unknown as string) || ""}
              min={new Date().toISOString().split("T")[0]}
              onChange={(e) => {
                setSelectedValues((prev) => ({
                  ...prev,
                  [filter.id]: e.target.value ? [e.target.value] : [],
                }));
              }}
              className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:border-primary outline-none bg-white text-gray-900"
            />
          </div>
        );
      case "range":
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={priceRange[0]}
                onChange={(e) => setPriceRange([Number(e.target.value), priceRange[1]])}
                className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:border-primary outline-none bg-white text-gray-900 placeholder:text-gray-400"
                placeholder="От"
              />
              <span className="text-gray-400">—</span>
              <input
                type="number"
                value={priceRange[1]}
                onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
                className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:border-primary outline-none bg-white text-gray-900 placeholder:text-gray-400"
                placeholder="До"
              />
            </div>
            <input
              type="range"
              min={filter.min || 0}
              max={filter.max || 5000}
              value={priceRange[1]}
              onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
              className="w-full accent-primary"
            />
          </div>
        );
      case "rating":
        return (
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setSelectedRating(star === selectedRating ? 0 : star)}
                className={`text-xl transition-all hover:scale-110 ${
                  star <= selectedRating ? "text-yellow-400" : "text-gray-300"
                }`}
              >
                ★
              </button>
            ))}
            <span className="text-sm text-gray-500 ml-2">и выше</span>
          </div>
        );
      default:
        return null;
    }
  };

  const groupedFilters = useMemo(() => {
    const groups: { key: string | null; label: string | null; filters: FilterDefinition[] }[] = [];
    const SENTINEL = Symbol("no-group");
    let lastGroup: symbol | string | null = SENTINEL;

    for (const f of allFilters) {
      const grp = f.group || null;
      if (lastGroup === SENTINEL || grp !== lastGroup) {
        groups.push({
          key: grp,
          label: grp ? TOUR_GROUP_HEADERS[grp] || null : null,
          filters: [] as FilterDefinition[],
        });
        lastGroup = grp;
      }
      groups[groups.length - 1].filters.push(f);
    }
    return groups;
  }, [allFilters]);

  const handleApply = useCallback(() => {
    onFilterChange?.({
      ...selectedValues,
      _price: priceRange,
      _rating: selectedRating,
      _countries: selectedCountries,
      _cities: selectedCities,
    });
  }, [selectedValues, priceRange, selectedRating, selectedCountries, selectedCities, onFilterChange]);

  return (
    <div className={`bg-white rounded-2xl border border-gray-100 p-5 ${noSticky ? "" : "sticky top-24"}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-secondary text-lg">Фильтры</h3>
          {activeFilterCount > 0 && (
            <span className="w-6 h-6 bg-primary text-white text-xs font-bold rounded-full flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </div>
        <button onClick={resetAll} className="text-sm text-primary font-medium hover:text-primary-dark transition-colors">
          Сбросить все
        </button>
      </div>

      <div className="mb-6 pb-4 border-b border-gray-100">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Сортировка</label>
        <select
          value={sortBy}
          onChange={(e) => handleSortChange(e.target.value)}
          className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:border-primary outline-none bg-white text-gray-900 appearance-none cursor-pointer"
        >
          {sortOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        {groupedFilters.map((group) => (
          <React.Fragment key={group.key || "__ungrouped__"}>
            {group.label && (
              <div className="pt-3 pb-1.5 px-1">
                <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full shrink-0" />
                  {group.label}
                </h4>
              </div>
            )}
            {group.filters.map((filter) => {
              const isAccordion = ACCORDION_TYPES.has(filter.type);
              const isCombobox =
                filter.type === "country" ||
                filter.type === "city" ||
                ((filter.type === "checkbox" || filter.type === "radio") &&
                  filter.options &&
                  filter.options.length > 0);

              return (
                <div key={filter.id} className="border-b border-gray-50 last:border-0">
                  {isAccordion ? (
                    <div>
                      <button
                        onClick={() => toggleFilter(filter.id)}
                        className="w-full flex items-center justify-between py-3 text-sm font-semibold text-secondary hover:text-primary transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          {filter.i18nKey}
                          {filter.type === "date" && selectedValues[filter.id]?.length > 0 && (
                            <span className="text-xs font-normal text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                              · {new Date(selectedValues[filter.id][0] as string).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                            </span>
                          )}
                        </span>
                        <span className={`transition-transform duration-200 ${expandedFilters.includes(filter.id) ? "rotate-180" : ""}`}>▼</span>
                      </button>
                      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expandedFilters.includes(filter.id) ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"}`}>
                        <div className="pb-4">{renderInlineFilterContent(filter)}</div>
                      </div>
                    </div>
                  ) : isCombobox ? (
                    <div className="py-2.5 px-1">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
                          {filter.i18nKey}
                          {getSelectedCount(filter) > 0 && (
                            <span className="w-4 h-4 bg-primary text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                              {getSelectedCount(filter)}
                            </span>
                          )}
                        </span>
                        {getSelectedCount(filter) > 0 && (
                          <button onClick={() => clearSelected(filter)} className="text-[10px] text-gray-400 hover:text-red-500 transition-colors">Сбросить</button>
                        )}
                      </div>
                      {filter.type === "country" ? (
                        <CountryFilter
                          serviceType={category.toUpperCase()}
                          selectedCountries={selectedCountries}
                          onCountriesChange={setSelectedCountries}
                        />
                      ) : filter.type === "city" ? (
                        <CityFilter
                          serviceType={category.toUpperCase()}
                          selectedCountries={selectedCountries}
                          selectedCities={selectedCities}
                          onCitiesChange={setSelectedCities}
                        />
                      ) : (
                        renderCombobox(filter)
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      <button
        onClick={handleApply}
        className="w-full h-12 mt-6 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold transition-all hover:shadow-lg hover:shadow-primary/30 active:scale-[0.98]"
      >
        Применить фильтры
      </button>
    </div>
  );
}
