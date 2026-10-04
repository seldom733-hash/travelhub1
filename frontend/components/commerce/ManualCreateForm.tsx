"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, type Page, type Product, type Customer } from "@/lib/api";

/**
 * Ручное создание commerce-сущностей (заявка / заказ / бронирование).
 *
 * Backend-эндпоинты canonical (без fabricated-путей):
 *   POST /requests                        — создать заявку (productId ОПЦИОНАЛЕН)
 *   POST /requests/:id/confirm-price      — supplier confirm (NEW → CONFIRMED)
 *   POST /requests/:id/customer-accept    — acceptance boundary (→ CUSTOMER_ACCEPTED)
 *   POST /requests/:id/convert            — конверсия в Order (→ MKT-ORD-*, тот же commerce root)
 *   PATCH /orders/:id { action }          — process / confirm / send
 *   PATCH /orders/:id/travelers           — данные туристов (bulk, по позициям)
 *   POST /orders/:id/final-confirm        — D3 финальное подтверждение
 *   GET  /bookings?orderId=               — бронь создаётся consumer-ом BookingRequested (action "send")
 *
 * productId НЕ обязателен: заявка/заказ/бронь без услуги создаются
 * с пустым продуктовым снимком (ограничение снято).
 */

export type ManualCreateMode = "request" | "order" | "booking";

interface TravelerInput {
  firstName: string;
  lastName: string;
  passportNumber: string;
}

const MODE_TITLE: Record<ManualCreateMode, string> = {
  request: "Новая заявка",
  order: "Новый заказ",
  booking: "Новое бронирование",
};

const MODE_HINT: Record<ManualCreateMode, string> = {
  request: "Создаёт заявку (MKT-REQ-*). Услуга (productId) не обязательна.",
  order: "Полная цепочка: заявка → подтверждение → конверсия в заказ (MKT-ORD-*). Услуга не обязательна.",
  booking: "Полная цепочка: заявка → заказ → бронирование (MKT-BKG-*). Услуга не обязательна.",
};

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500";

export default function ManualCreateForm({ mode }: { mode: ManualCreateMode }) {
  const needsTravelers = mode !== "request";
  const needsMoney = mode !== "request";

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [productId, setProductId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [serviceDate, setServiceDate] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [travelerCount, setTravelerCount] = useState(1);
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [travelers, setTravelers] = useState<TravelerInput[]>([{ firstName: "", lastName: "", passportNumber: "" }]);

  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ requestRef: string; requestId: string; orderRef?: string; orderId?: string; bookingRef?: string; bookingId?: string } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [prod, cust] = await Promise.all([
          api.get<Page<Product>>("/products?pageSize=500").catch(() => null),
          api.get<Page<Customer>>("/customers?pageSize=500").catch(() => null),
        ]);
        if (!alive) return;
        setProducts(prod?.items ?? []);
        setCustomers(cust?.items ?? []);
      } catch (e) {
        if (alive) setLoadError((e as Error).message);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    setTravelers((prev) => {
      const n = needsTravelers ? Math.max(1, travelerCount) : 0;
      const next = Array.from({ length: n }, (_, i) => prev[i] ?? { firstName: "", lastName: "", passportNumber: "" });
      return next;
    });
  }, [travelerCount, needsTravelers]);

  const money = useMemo(() => (price.trim() === "" ? null : Number(price)), [price]);

  function validate(): string | null {
    if (needsMoney && (money === null || !Number.isFinite(money) || money <= 0)) {
      return "Укажите цену услуги (больше 0) — без коммерческих условий заказ не создаётся.";
    }
    if (needsTravelers) {
      if (!Number.isInteger(travelerCount) || travelerCount < 1) return "Количество туристов — целое ≥ 1.";
      for (let i = 0; i < travelers.length; i++) {
        if (!travelers[i].firstName.trim() || !travelers[i].lastName.trim()) {
          return `Турист ${i + 1}: укажите имя и фамилию.`;
        }
      }
    }
    if (quantity < 1) return "Количество — целое ≥ 1.";
    return null;
  }

  async function findBooking(orderId: string): Promise<{ id: string; referenceNumber: string } | null> {
    for (let attempt = 0; attempt < 10; attempt++) {
      await new Promise((r) => setTimeout(r, 700));
      try {
        const page = await api.get<Page<{ id: string; referenceNumber: string }>>(`/bookings?orderId=${orderId}&pageSize=1`);
        if (page.items && page.items.length > 0) return page.items[0];
      } catch {
        /* retry */
      }
    }
    return null;
  }

  async function submit() {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      // 1. Заявка (productId опционален — ограничение снято)
      setStep("Создание заявки…");
      const request = await api.post<{ id: string; referenceNumber: string }>("/requests", {
        ...(productId ? { productId } : {}),
        ...(customerId ? { customerId } : {}),
        ...(serviceDate ? { requestedServiceDate: serviceDate } : {}),
        quantity,
        ...(needsTravelers ? { travelerCount } : {}),
        ...(money !== null ? { displayedPrice: money, displayedCurrency: currency } : {}),
      });

      let orderRef: string | undefined;
      let orderId: string | undefined;
      let bookingRef: string | undefined;
      let bookingId: string | undefined;

      if (mode !== "request") {
        // 2. Supplier confirm → CONFIRMED
        setStep("Подтверждение цены поставщиком…");
        await api.post(`/requests/${request.id}/confirm-price`, {});
        // 3. Customer accept → CUSTOMER_ACCEPTED (acceptance boundary)
        setStep("Принятие условий клиентом…");
        await api.post(`/requests/${request.id}/customer-accept`, {});
        // 4. Конверсия в Order (тот же commerce root)
        setStep("Создание заказа…");
        const converted = await api.post<{ convertedOrder?: { id: string; referenceNumber: string } }>(`/requests/${request.id}/convert`, {});
        orderId = converted.convertedOrder?.id;
        orderRef = converted.convertedOrder?.referenceNumber;
        if (!orderId) throw new Error("Конверсия не вернула заказ");

        // 5. Заказ в работу
        setStep("Заказ в работу…");
        await api.patch(`/orders/${orderId}`, { action: "process" });
        // 6. Данные туристов
        setStep("Сохранение данных туристов…");
        await api.patch(`/orders/${orderId}/travelers`, {
          travelers: travelers.map((tr) => ({
            firstName: tr.firstName.trim(),
            lastName: tr.lastName.trim(),
            ...(tr.passportNumber.trim() ? { passportNumber: tr.passportNumber.trim() } : {}),
          })),
        });
        // 7. D3 финальное подтверждение (гейт: до confirm/send)
        setStep("Финальное подтверждение…");
        await api.post(`/orders/${orderId}/final-confirm`, {});
        // 8. Готов к бронированию
        setStep("Подтверждение заказа…");
        await api.patch(`/orders/${orderId}`, { action: "confirm" });

        if (mode === "booking") {
          // 9. send → BookingRequested → consumer создаёт Booking
          setStep("Передача в бронирование…");
          await api.patch(`/orders/${orderId}`, { action: "send" });
          setStep("Ожидание создания брони…");
          const booking = await findBooking(orderId);
          bookingId = booking?.id;
          bookingRef = booking?.referenceNumber;
          if (!bookingRef) {
            setError("Бронирование создаётся consumer-ом; не найдено за отведённое время — откройте заказ и обновите позже.");
          }
          setResult({ requestRef: request.referenceNumber, requestId: request.id, orderRef, orderId, bookingRef, bookingId });
        } else {
          setResult({ requestRef: request.referenceNumber, requestId: request.id, orderRef, orderId });
        }
      } else {
        setResult({ requestRef: request.referenceNumber, requestId: request.id });
      }
      setStep(null);
    } catch (e) {
      setError((e as Error).message || "Ошибка создания");
      setStep(null);
    } finally {
      setBusy(false);
    }
  }

  const customerLabel = (c: Customer) =>
    [c.firstName, c.lastName].filter(Boolean).join(" ") || c.companyName || c.code;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{MODE_TITLE[mode]}</h1>
        <p className="mt-1 text-sm text-slate-500">{MODE_HINT[mode]}</p>
      </div>

      {loadError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Не удалось загрузить справочники: {loadError}
        </div>
      )}

      {result ? (
        <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50 p-6">
          <div className="text-lg font-semibold text-emerald-900">✅ Создано успешно</div>
          <ul className="space-y-1 text-sm text-emerald-900">
            <li>Заявка: <span className="font-mono font-semibold">{result.requestRef}</span></li>
            {result.orderRef && <li>Заказ: <span className="font-mono font-semibold">{result.orderRef}</span></li>}
            {result.bookingRef && <li>Бронирование: <span className="font-mono font-semibold">{result.bookingRef}</span></li>}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Link href={`/app/requests/${result.requestId}`} className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100">
              Открыть заявку
            </Link>
            {result.orderId && (
              <Link href={`/app/orders/${result.orderId}`} className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100">
                Открыть заказ
              </Link>
            )}
            {result.bookingId && (
              <Link href={`/app/bookings/${result.bookingId}`} className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100">
                Открыть бронирование
              </Link>
            )}
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setPrice("");
                setTravelers([{ firstName: "", lastName: "", passportNumber: "" }]);
              }}
              className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
            >
              Создать ещё
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Услуга (необязательно)</label>
              <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inputCls}>
                <option value="">— без услуги —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} · {p.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Клиент (необязательно)</label>
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={inputCls}>
                <option value="">— без клиента —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {customerLabel(c)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Дата услуги</label>
              <input type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Количество</label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className={inputCls}
              />
            </div>
            {needsMoney && (
              <>
                <div>
                  <label className={labelCls}>Цена *</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0.00"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Валюта</label>
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputCls}>
                    {["USD", "EUR", "AZN", "RUB", "TRY", "GEL"].map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
            {needsTravelers && (
              <div>
                <label className={labelCls}>Туристов *</label>
                <input
                  type="number"
                  min={1}
                  value={travelerCount}
                  onChange={(e) => setTravelerCount(Number(e.target.value))}
                  className={inputCls}
                />
              </div>
            )}
          </div>

          {needsTravelers && (
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Туристы</div>
              {travelers.map((tr, i) => (
                <div key={i} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 sm:grid-cols-3">
                  <input
                    value={tr.firstName}
                    onChange={(e) => setTravelers((prev) => prev.map((x, j) => (j === i ? { ...x, firstName: e.target.value } : x)))}
                    placeholder={`Имя (турист ${i + 1})`}
                    className={inputCls}
                  />
                  <input
                    value={tr.lastName}
                    onChange={(e) => setTravelers((prev) => prev.map((x, j) => (j === i ? { ...x, lastName: e.target.value } : x)))}
                    placeholder="Фамилия"
                    className={inputCls}
                  />
                  <input
                    value={tr.passportNumber}
                    onChange={(e) => setTravelers((prev) => prev.map((x, j) => (j === i ? { ...x, passportNumber: e.target.value } : x)))}
                    placeholder="Паспорт (необязательно)"
                    className={inputCls}
                  />
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={busy}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Создание…" : `Создать ${mode === "request" ? "заявку" : mode === "order" ? "заказ" : "бронирование"}`}
            </button>
            {busy && step && <span className="text-sm text-slate-500">{step}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
