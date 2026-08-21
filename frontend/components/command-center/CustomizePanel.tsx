"use client";

import { useState, useCallback } from "react";
import { type WidgetDefinition, type WidgetPosition } from "@/lib/workspace-api";
import type { WidgetType } from "@/lib/workspace-api";
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Props {
  draft: WidgetPosition[];
  availableWidgets: WidgetDefinition[];
  allWidgets: WidgetPosition[];
  onAdd: (widget: WidgetDefinition) => void;
  onRemove: (widgetId: string) => void;
  onReorder: (from: number, to: number) => void;
  onSave: () => void;
  onReset: () => void;
  onToggleVisible: (widgetId: string) => void;
}

function SortableItem({
  widgetId,
  title,
  required,
  visible,
  onToggle,
  onRemove,
}: {
  widgetId: string;
  title: string;
  required: boolean;
  visible: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: widgetId });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
        isDragging ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white"
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-slate-400 hover:text-slate-600"
        aria-label="Перетащить"
      >
        ⠿
      </button>
      <span className={`flex-1 ${visible ? "text-slate-900" : "text-slate-400 line-through"}`}>
        {title}
        {required && <span className="ml-1 text-xs text-slate-400">(обязательный)</span>}
      </span>
      <button
        onClick={onToggle}
        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        aria-label={visible ? "Скрыть виджет" : "Показать виджет"}
      >
        {visible ? "👁" : "👁‍🗨"}
      </button>
      {!required && (
        <button
          onClick={onRemove}
          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
          aria-label="Удалить виджет"
        >
          ✕
        </button>
      )}
    </div>
  );
}

export function CustomizePanel({
  draft,
  availableWidgets,
  onAdd,
  onRemove,
  onReorder,
  onSave,
  onReset,
  onToggleVisible,
}: Props) {
  const [showAdd, setShowAdd] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const from = draft.findIndex((w) => w.widgetId === active.id);
      const to = draft.findIndex((w) => w.widgetId === over.id);
      if (from >= 0 && to >= 0) onReorder(from, to);
    },
    [draft, onReorder],
  );

  return (
    <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4" role="region" aria-label="Настройка макета">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-blue-900">Настройка макета</h3>
        <div className="flex gap-2">
          <button
            onClick={onReset}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
          >
            Сбросить
          </button>
          <button
            onClick={onSave}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          >
            Сохранить
          </button>
        </div>
      </div>

      {/* Current widgets */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={draft.map((w) => w.widgetId)} strategy={verticalListSortingStrategy}>
          <div className="mt-3 space-y-1.5">
            {draft.map((wp) => {
              // Find title from allWidgets or availableWidgets
              const title = wp.widgetId; // Fallback
              const isRequired = wp.widgetId === "reconciliation"; // Known required widget
              return (
                <SortableItem
                  key={wp.widgetId}
                  widgetId={wp.widgetId}
                  title={title}
                  required={isRequired}
                  visible={wp.visible}
                  onToggle={() => onToggleVisible(wp.widgetId)}
                  onRemove={() => onRemove(wp.widgetId)}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add widget section */}
      <div className="mt-4">
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="text-xs font-medium text-blue-600 hover:text-blue-800"
        >
          {showAdd ? "Скрыть доступные" : "+ Добавить виджет"}
        </button>
        {showAdd && availableWidgets.length > 0 && (
          <div className="mt-2 space-y-1">
            {availableWidgets.map((w) => (
              <button
                key={w.widgetId}
                onClick={() => onAdd(w)}
                className="flex w-full items-center gap-2 rounded-lg border border-dashed border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-600 hover:border-blue-300 hover:bg-blue-50"
              >
                <span>+</span>
                <span>{w.title}</span>
                <span className="ml-auto text-xs text-slate-400">{(w as WidgetDefinition).sectionPermission?.split(".")[1] ?? w.category}</span>
              </button>
            ))}
          </div>
        )}
        {showAdd && availableWidgets.length === 0 && (
          <p className="mt-2 text-xs text-slate-400">Все доступные виджеты уже добавлены</p>
        )}
      </div>

      {/* Keyboard hint */}
      <p className="mt-3 text-[10px] text-slate-400">
        Перетаскивайте для изменения порядка. Клавиша Enter для переупорядочивания.
      </p>
    </div>
  );
}
