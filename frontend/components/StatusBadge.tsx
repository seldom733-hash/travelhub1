"use client";

const STATUS_META: Record<string, { label: string; cls: string }> = {
  // Product
  DRAFT: { label: "Черновик", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  COMPLETE: { label: "Заполнен", cls: "bg-sky-50 text-sky-700 border-sky-200" },
  REVIEWED: { label: "Проверен", cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  PUBLISHED: { label: "Опубликован", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  CHANGED: { label: "Изменён", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  ARCHIVED: { label: "Архивирован", cls: "bg-slate-100 text-slate-500 border-slate-200" },
  SUSPENDED: { label: "Приостановлен", cls: "bg-orange-50 text-orange-700 border-orange-200" },
  // Order
  NEW: { label: "Новый", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  IN_PROCESSING: { label: "В работе", cls: "bg-sky-50 text-sky-700 border-sky-200" },
  WAITING_FOR_DATA: { label: "Ожидает данных", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  READY_FOR_BOOKING: { label: "Готов к бронированию", cls: "bg-violet-50 text-violet-700 border-violet-200" },
  SENT_TO_BOOKING: { label: "Передан в Booking", cls: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  PARTIALLY_FULFILLED: { label: "Частично исполнен", cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  FULFILLED: { label: "Исполнен", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  READY_TO_CLOSE: { label: "Готов к закрытию", cls: "bg-teal-50 text-teal-700 border-teal-200" },
  CLOSED: { label: "Закрыт", cls: "bg-slate-100 text-slate-500 border-slate-200" },
  CANCELLED: { label: "Отменён", cls: "bg-red-50 text-red-600 border-red-200" },
  PROBLEM: { label: "Проблемный", cls: "bg-red-100 text-red-700 border-red-300" },
  // Booking
  PREPARING_REQUEST: { label: "Готовится запрос", cls: "bg-sky-50 text-sky-700 border-sky-200" },
  SENT_TO_SUPPLIER: { label: "Отправлен поставщику", cls: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  AWAITING_CONFIRMATION: { label: "Ждёт подтверждения", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  CONFIRMED: { label: "Подтверждено", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  IN_SERVICE: { label: "Исполняется", cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  COMPLETED: { label: "Завершено", cls: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  SUPPLIER_REJECTED: { label: "Отклонено", cls: "bg-red-50 text-red-600 border-red-200" },
  NEEDS_CLARIFICATION: { label: "Требует уточнения", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  CHANGE_REQUESTED: { label: "Изменение запрошено", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  CANCELLATION_REQUESTED: { label: "Отмена запрошена", cls: "bg-orange-50 text-orange-700 border-orange-200" },
  // Payment
  UNPAID: { label: "Не оплачено", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  PARTIALLY_PAID: { label: "Частично оплачено", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  PAID: { label: "Оплачено", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  REFUNDED: { label: "Возвращено", cls: "bg-slate-100 text-slate-500 border-slate-200" },
  // Common
  ACTIVE: { label: "Активен", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  INACTIVE: { label: "Неактивен", cls: "bg-slate-100 text-slate-500 border-slate-200" },
};

export default function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, cls: "bg-slate-100 text-slate-600 border-slate-200" };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${meta.cls}`}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {meta.label}
    </span>
  );
}
