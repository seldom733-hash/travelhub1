"use client";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useLocale, t } from "@/lib/i18n";
import type { SectionView, BlockDefinition } from "@/lib/constructor-api";
import { BLOCK_REGISTRY } from "@/lib/constructor-registry";
import { Eye, List, X } from "@phosphor-icons/react";

interface Props {
  sections: SectionView[];
  onReorder: (fromIndex: number, toIndex: number) => void;
  onToggle: (blockInstanceId: string) => void;
  onRemove: (blockInstanceId: string) => void;
}

export default function ConstructorBlockList({ sections, onReorder, onToggle, onRemove }: Props) {
  const locale = useLocale();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sections.findIndex((s) => s.blockInstanceId === active.id);
    const newIndex = sections.findIndex((s) => s.blockInstanceId === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      onReorder(oldIndex, newIndex);
    }
  }

  if (sections.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm text-slate-400">
        {t("constructor.empty_canvas", locale)}
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sections.map((s) => s.blockInstanceId)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {sections.map((section) => (
            <SortableBlockItem
              key={section.blockInstanceId}
              section={section}
              onToggle={onToggle}
              onRemove={onRemove}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

// ─── Sortable Block Item ─────────────────────────────────────────────────────

function SortableBlockItem({
  section,
  onToggle,
  onRemove,
}: {
  section: SectionView;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const locale = useLocale();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.blockInstanceId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const def = BLOCK_REGISTRY.find((b) => b.type === section.blockType);
  const displayName = def?.displayName?.[locale] ?? section.blockType;
  const isSystem = def?.category === "system";
  const isRemovable = def?.removable !== false;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-lg border bg-white px-4 py-3 shadow-sm transition-colors ${
        isDragging ? "border-blue-300 bg-blue-50 opacity-70" : "border-slate-200"
      } ${!section.enabled ? "opacity-50" : ""}`}
    >
      {/* Drag handle */}
      <button
        className="cursor-grab text-slate-400 hover:text-slate-600 active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label={t("constructor.drag_handle", locale)}
      >
        <List className="h-5 w-5" weight="fill" />
      </button>

      {/* Block info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-900">{displayName}</span>
          {isSystem && (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
              {t("constructor.system_badge", locale)}
            </span>
          )}
          {!section.enabled && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
              {t("constructor.disabled_badge", locale)}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-slate-400">{section.blockType}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {/* Toggle visibility */}
        <button
          onClick={() => onToggle(section.blockInstanceId)}
          className={`rounded p-1.5 transition-colors ${
            section.enabled
              ? "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              : "text-amber-500 hover:bg-amber-50 hover:text-amber-600"
          }`}
          aria-label={section.enabled ? t("constructor.disable", locale) : t("constructor.enable", locale)}
        >
          {section.enabled ? <Eye className="h-4 w-4" /> : <Eye className="h-4 w-4 text-amber-500" />}
        </button>

        {/* Remove (only if not system and removable) */}
        {!isSystem && isRemovable && (
          <button
            onClick={() => onRemove(section.blockInstanceId)}
            className="rounded p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
            aria-label={t("constructor.remove", locale)}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
