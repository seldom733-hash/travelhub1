"use client";

import { useLocale, t } from "@/lib/i18n";

export type ConstructorTab = "structure" | "header" | "hero" | "search" | "content" | "footer" | "design";

interface Props {
  activeTab: ConstructorTab;
  onTabChange: (tab: ConstructorTab) => void;
}

const TABS: { id: ConstructorTab; key: string }[] = [
  { id: "structure", key: "constructor.tab_structure" },
  { id: "header", key: "constructor.tab_header" },
  { id: "hero", key: "constructor.tab_hero" },
  { id: "search", key: "constructor.tab_search" },
  { id: "content", key: "constructor.tab_content" },
  { id: "footer", key: "constructor.tab_footer" },
  { id: "design", key: "constructor.tab_design" },
];

export default function ConstructorTabs({ activeTab, onTabChange }: Props) {
  const locale = useLocale();

  return (
    <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === tab.id
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {t(tab.key, locale)}
        </button>
      ))}
    </div>
  );
}
