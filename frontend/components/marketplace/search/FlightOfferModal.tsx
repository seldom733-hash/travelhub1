"use client";

import { useEffect, useMemo, useState } from "react";
import { createFlightRequest, type FlightFare, type FlightOffer, type FlightSegment } from "@/lib/flight-api";
import { useCurrentUser } from "@/lib/use-user";

function fareAmount(fare: any): number {
  return Number(fare?.total?.amount ?? fare?.price?.total?.amount ?? fare?.price?.amount ?? 0);
}
function fareCurrency(fare: any): string {
  return String(fare?.total?.currency ?? fare?.price?.total?.currency ?? fare?.price?.currency ?? "AZN");
}
function fareName(fare: any): string {
  return String(fare?.fareFamily ?? fare?.family ?? fare?.cabin ?? "Tariff");
}
function time(value?: string): string {
  if (!value) return "--:--";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "--:--" : d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}
function dateTime(value?: string): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("ru-RU");
}

export default function FlightOfferModal({
  flight,
  onClose,
  onCreated,
}: {
  flight: FlightOffer;
  onClose: () => void;
  onCreated?: (referenceNumber: string) => void;
}) {
  const user = useCurrentUser();
  const fares = (flight.fares ?? []) as FlightFare[];
  const [selectedFare, setSelectedFare] = useState(0);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [sameAsClient, setSameAsClient] = useState(true);
  const [travelerFirstName, setTravelerFirstName] = useState("");
  const [travelerLastName, setTravelerLastName] = useState("");
  const [travelerBirthDate, setTravelerBirthDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState("");

  useEffect(() => {
    if (!user) return;
    const parts = (user.fullName ?? "").trim().split(/\s+/).filter(Boolean);
    setFirstName((v) => v || parts[0] || "");
    setLastName((v) => v || parts.slice(1).join(" ") || "");
    setPhone((v) => v || user.phone || "");
    setEmail((v) => v || user.email || "");
  }, [user]);

  useEffect(() => {
    if (!sameAsClient) return;
    setTravelerFirstName(firstName);
    setTravelerLastName(lastName);
  }, [sameAsClient, firstName, lastName]);

  const segments = (flight.segments ?? []) as FlightSegment[];
  const first = segments[0];
  const last = segments[segments.length - 1];
  const fare = fares[selectedFare] as any;
  const normalizedPhone = phone.replace(/[\s()\-]/g, "").replace(/^00/, "+");
  const valid =
    firstName.trim() !== "" &&
    lastName.trim() !== "" &&
    /^\+[1-9]\d{7,14}$/.test(normalizedPhone) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    travelerFirstName.trim() !== "" &&
    travelerLastName.trim() !== "" &&
    /^\d{4}-\d{2}-\d{2}$/.test(travelerBirthDate);

  const from = first?.departure?.airport ?? flight.requested?.from ?? "";
  const to = last?.arrival?.airport ?? flight.requested?.to ?? "";
  const departureDate = first?.departure?.date ?? flight.requested?.departureDate ?? "";
  const returnDate = segments[1]?.departure?.date ?? flight.requested?.returnDate;
  const route = useMemo(() => `${from || "—"} → ${to || "—"}`, [from, to]);

  const submit = async () => {
    if (!valid || busy || !fare) return;
    setBusy(true);
    setError("");
    try {
      const result = await createFlightRequest({
        from,
        to,
        departureDate,
        returnDate,
        tripType: segments.length > 1 ? "RT" : "OW",
        passengers: flight.requested?.passengers ?? { adults: 1, children: 0, infants: 0 },
        fareFamily: fareName(fare),
        price: fareAmount(fare),
        currency: fareCurrency(fare),
        supplierCode: flight.source,
        segments,
        customer: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: normalizedPhone,
          email: email.trim(),
        },
        travelers: [{
          firstName: travelerFirstName.trim(),
          lastName: travelerLastName.trim(),
          birthDate: travelerBirthDate,
        }],
      });
      setCreated(result.referenceNumber ?? result.code ?? "создана");
      onCreated?.(result.referenceNumber ?? result.code ?? "");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose} role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Подать заявку</h3>
            <div className="mt-0.5 text-sm font-semibold text-slate-700">{route}</div>
            <div className="mt-1 text-xs text-slate-500">{dateTime(departureDate)} · {flight.source ?? "поставщик"} · {segments.length || 1} сегмент(ов)</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600">✕</button>
        </div>

        <div className="space-y-5 p-6">
          <section>
            <h4 className="mb-2 text-sm font-semibold text-slate-800">Варианты тарифа</h4>
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {fares.length === 0 && <p className="p-4 text-sm text-slate-500">Тарифы недоступны.</p>}
              {fares.map((f: any, index) => (
                <label key={f.id ?? index} className={`flex cursor-pointer items-center justify-between gap-3 p-3 text-sm ${selectedFare === index ? "bg-emerald-50" : ""}`}>
                  <span className="flex items-center gap-2">
                    <input type="radio" name="flight-fare" checked={selectedFare === index} onChange={() => setSelectedFare(index)} />
                    <span><b>{fareName(f)}</b><span className="ml-2 text-slate-500">{f.cabin ?? ""}{f.baggage ? ` · ${f.baggage}` : ""}</span></span>
                  </span>
                  <span className="font-semibold">{fareAmount(f).toLocaleString()} {fareCurrency(f)}</span>
                </label>
              ))}
            </div>
          </section>

          <section>
            <h4 className="mb-1 text-sm font-semibold text-slate-800">Данные клиента</h4>
            <p className="mb-2 text-xs text-slate-500">Клиент — тот, кто оформляет и оплачивает заявку. Турист может быть другим человеком.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Имя *" value={firstName} onChange={setFirstName} autoComplete="given-name" />
              <Field label="Фамилия *" value={lastName} onChange={setLastName} autoComplete="family-name" />
              <Field label="Телефон *" value={phone} onChange={setPhone} autoComplete="tel" placeholder="+994501234567" />
              <Field label="Email *" value={email} onChange={setEmail} autoComplete="email" placeholder="name@example.com" />
            </div>
          </section>

          <section>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-slate-800">Турист 1</h4>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" checked={sameAsClient} onChange={(e) => setSameAsClient(e.target.checked)} />
                Клиент является туристом
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Имя туриста *" value={travelerFirstName} onChange={setTravelerFirstName} autoComplete="off" disabled={sameAsClient} />
              <Field label="Фамилия туриста *" value={travelerLastName} onChange={setTravelerLastName} autoComplete="off" disabled={sameAsClient} />
              <Field label="Дата рождения *" value={travelerBirthDate} onChange={setTravelerBirthDate} autoComplete="bday" type="date" />
            </div>
            {sameAsClient && <p className="mt-2 text-xs text-emerald-700">Имя и фамилия подставлены из данных клиента. Дату рождения укажите вручную.</p>}
          </section>

          {created && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">Заявка создана: {created}</div>}
          {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          <div className="flex flex-col items-stretch justify-end gap-2 sm:flex-row sm:items-center">
            {!valid && <span className="text-xs text-amber-600 sm:mr-auto">Заполните данные клиента и туриста, чтобы подать заявку.</span>}
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600">Закрыть</button>
            <button type="button" onClick={() => void submit()} disabled={!valid || busy || !fare || !!created} className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
              {busy ? "Отправляем…" : "Подать заявку"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, autoComplete, placeholder, disabled, type }: { label: string; value: string; onChange: (v: string) => void; autoComplete: string; placeholder?: string; disabled?: boolean; type?: string }) {
  return (
    <label className="block text-xs text-slate-600">
      <span>{label}</span>
      <input type={type ?? "text"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} placeholder={placeholder} disabled={disabled} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 disabled:bg-slate-50 disabled:text-slate-500" />
    </label>
  );
}
