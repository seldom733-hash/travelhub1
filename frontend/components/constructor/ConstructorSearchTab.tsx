"use client";

import { useState } from "react";
import { useLocale, t } from "@/lib/i18n";
import { constructorApi } from "@/lib/constructor-api";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { List } from "@phosphor-icons/react";

interface SearchService {
  id: string;
  labelKey: string;
  enabled: boolean;
}

interface SearchConfig {
  services: SearchService[];
  defaultService: string;
}

interface Props {
  slug: string;
  config: Record<string, unknown> | null;
  onSaved: () => void;
  onSaving: (v: boolean) => void;
  onError: (msg: string | null) => void;
}

const ALL_SERVICES: SearchService[] = [
  { id: "tours", labelKey: "constructor.search_tours", enabled: true },
  { id: "hotels", labelKey: "constructor.search_hotels", enabled: true },
  { id: "flights", labelKey: "constructor.search_flights", enabled: true },
  { id: "sanatoriums", labelKey: "constructor.search_sanatoriums", enabled: false },
];

export default function ConstructorSearchTab({ slug, config, onSaved, onSaving, onError }: Props) {
  const locale = useLocale();
  const [cfg, setCfg] = useState<SearchConfig>(() => {
    const savedServices = config?.services as SearchService[] | undefined;
    const services = savedServices?.length
      ? ALL_SERVICES.map((s) => {
          const saved = savedServices.find((x) => x.id === s.id);
          return saved ? { ...s, enabled: saved.enabled } : s;
        })
      : ALL_SERVICES;
    return {
      services,
      defaultService: (config?.defaultService as string) ?? "hotels",
    };
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = cfg.services.findIndex((s) => s.id === active.id);
    const newIndex = cfg.services.findIndex((s) => s.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      const services = [...cfg.services];
      const [moved] = services.splice(oldIndex, 1);
      services.splice(newIndex, 0, moved);
      setCfg((prev) => ({ ...prev, services }));
    }
  }

  function toggleService(id: string) {
    setCfg((prev) => ({
      ...prev,
      services: prev.services.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
    }));
  }

  async function handleSave() {
    onSaving(true);
    onError(null);
    try {
      await constructorApi.saveSearchConfig(slug, cfg as unknown as Record<string, unknown>);
      onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Save failed");
    } finally {
      onSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">{t("constructor.search_service_order", locale)}</h3>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={cfg.services.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {cfg.services.map((svc, idx) => (
                <SortableServiceItem key={svc.id} service={svc} index={idx} onToggle={toggleService} locale={locale} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Default service */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">{t("constructor.search_default_service", locale)}</h3>
        <select
          value={cfg.defaultService}
          onChange={(e) => setCfg((prev) => ({ ...prev, defaultService: e.target.value }))}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
        >
          {cfg.services.filter((s) => s.enabled).map((svc) => (
            <option key={svc.id} value={svc.id}>{t(svc.labelKey, locale)}</option>
          ))}
        </select>
      </div>

      <button onClick={handleSave} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700">
        {t("constructor.search_save", locale)}
      </button>
    </div>
  );
}

function SortableServiceItem({ service, index, onToggle, locale }: { service: SearchService; index: number; onToggle: (id: string) => void; locale: "ru" | "az" | "en" }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: service.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-lg border bg-white px-4 py-3 shadow-sm transition-colors ${isDragging ? "border-blue-300 bg-blue-50 opacity-70" : "border-slate-200"} ${!service.enabled ? "opacity-50" : ""}`}
    >
      <button className="cursor-grab text-slate-400 hover:text-slate-600 active:cursor-grabbing" {...attributes} {...listeners}>
        <List className="h-5 w-5" weight="fill" />
      </button>
      <span className="text-xs font-medium text-slate-400">{index + 1}.</span>
      <span className="flex-1 text-sm font-medium text-slate-900">{t(service.labelKey, locale)}</span>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={service.enabled} onChange={() => onToggle(service.id)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
        <span className="text-xs text-slate-500">{service.enabled ? "✓" : "—"}</span>
      </label>
    </div>
  );
}
