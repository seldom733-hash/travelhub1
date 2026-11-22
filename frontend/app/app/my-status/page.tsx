"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/i18n";
import { sx } from "@/lib/supplier-labels";

export default function MyStatusPage() {
  const locale = useLocale();
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const tr = (ru: string, az: string, en: string) => sx(locale, ru, az, en);
  const OPTIONS = [
    { value: "FREE", label: tr("Свободен", "Boş", "Free"), hint: tr("Можно автоматически назначать заявки", "Sorğular avtomatik təyin edilə bilər", "Requests can be assigned automatically") },
    { value: "BUSY", label: tr("Занят", "Məşğul", "Busy"), hint: tr("Автоназначение не выполняется, вручную назначить можно", "Avtomatik təyinetmə aparılmır, əl ilə təyin etmək olar", "Auto-assignment is paused; manual assignment is allowed") },
    { value: "ABSENT", label: tr("Отсутствую", "Yoxdur", "Away"), hint: tr("Не назначается ни автоматически, ни вручную", "Nə avtomatik, nə də əl ilə təyin edilmir", "Not assigned automatically or manually") },
  ];

  useEffect(() => {
    void api.get<{ availability: string }>("/sales/assignment/me/status")
      .then((res) => setStatus(res.availability))
      .catch(() => undefined);
  }, []);

  async function set(next: string) {
    setBusy(true);
    try {
      await api.post("/sales/assignment/me/status", { status: next });
      setStatus(next);
    } finally {
      setBusy(false);
    }
  }

  return <div><PageHeader title={tr("Мой статус", "Mənim statusum", "My status")} breadcrumbs={["Navitravel", tr("Продажи", "Satış", "Sales"), tr("Мой статус", "Mənim statusum", "My status")]} />
    <div className="max-w-xl space-y-3 p-6">
      <p className="text-sm text-ink/60">{tr("Статус влияет на автоматическое и ручное распределение заявок.", "Status sorğuların avtomatik və əl ilə bölgüsünə təsir edir.", "Your status affects automatic and manual request assignment.")}</p>
      {OPTIONS.map((o) => (
        <label key={o.value} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${status === o.value ? "border-brand bg-brand/10" : "border-line bg-white"}`}>
          <input
            type="radio"
            name="availability"
            value={o.value}
            checked={status === o.value}
            disabled={busy}
            onChange={() => void set(o.value)}
            className="mt-1 size-4 accent-brand"
          />
          <span>
            <span className="block font-semibold">{o.label}</span>
            <span className="block text-xs text-ink/60">{o.hint}</span>
          </span>
        </label>
      ))}
    </div>
  </div>;
}
