"use client";

/**
 * Оперативные панели BI Center (Гл. 2): единый модуль контроля в реальном времени.
 * Вкладки: Коммерческий радар (2.10.9) · Очередь заказов (2.11.11) ·
 * Бронирования (2.12.12) · Финансы (2.13.12) · Партнёры (2.15.12) · Маркетинг (2.17.12).
 * Каждая панель содержит контроль-центр и соответствующий интегральный индекс.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { describeApiError } from "@/lib/api-error";
import type { OperationsData } from "@/lib/analytics/operations";
import type { Customer360Data } from "@/lib/analytics/customer360";
import type { Partner360Data } from "@/lib/analytics/partner360";

const TABS = [
  { key: "radar", title: "Радар", icon: "📡" },
  { key: "queue", title: "Очередь заказов", icon: "🗂️" },
  { key: "bookings", title: "Бронирования", icon: "📑" },
  { key: "finance", title: "Финансы", icon: "💰" },
  { key: "partners", title: "Партнёры", icon: "🤝" },
  { key: "marketing", title: "Маркетинг", icon: "📣" },
  { key: "profile", title: "Профили 360°", icon: "🛰️" },
] as const;

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.round(n)) + " $";

function Panel({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
      <h3 className="font-semibold text-sm mb-3">
        {icon} {title}
      </h3>
      {children}
    </div>
  );
}

function KpiMini({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "positive" | "negative" | "neutral" | "warn" }) {
  const color =
    tone === "positive" ? "text-success" : tone === "negative" ? "text-danger" : tone === "warn" ? "text-amber-500" : "text-[var(--admin-text)]";
  return (
    <div className="bg-[var(--admin-bg)] rounded-xl p-3">
      <div className="text-[10px] text-[var(--admin-muted)]">{label}</div>
      <div className={`text-lg font-bold mt-0.5 ${color}`}>{value}</div>
    </div>
  );
}

function IndexGauge({ value, label }: { value: number; label: string }) {
  const color = value >= 80 ? "#22c55e" : value >= 60 ? "#06b6d4" : value >= 40 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex items-center gap-4 bg-[var(--admin-bg)] rounded-2xl p-4">
      <div className="relative w-20 h-20 shrink-0">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="42" fill="none" stroke="var(--admin-border)" strokeWidth="10" />
          <circle
            cx="50" cy="50" r="42" fill="none"
            stroke={color} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={`${(value / 100) * 264} 264`}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-xl font-bold" style={{ color }}>{value}</div>
      </div>
      <div>
        <div className="text-xs font-semibold">{label}</div>
        <div className="text-[10px] text-[var(--admin-muted)] mt-0.5">из 100</div>
      </div>
    </div>
  );
}

export default function OperationsCenter() {
  const [tab, setTab] = useState<string>("radar");
  const [data, setData] = useState<OperationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Профили 360° (2.14.13 Customer 360°, 2.15.13 Partner 360°)
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [partnersList, setPartnersList] = useState<{ id: string; name: string }[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [customer360, setCustomer360] = useState<Customer360Data | null>(null);
  const [partner360, setPartner360] = useState<Partner360Data | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Списки клиентов и партнёров для выбора (2.14.13 / 2.15.13)
  useEffect(() => {
    const timer = setTimeout(() => {
      void fetch("/api/admin/search?q=&scope=partners")
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { partners?: { id: string; name: string }[] } | null) => {
          if (d?.partners?.length) setPartnersList(d.partners);
        })
        .catch(() => {});
      void fetch("/api/admin/search?q=&scope=clients")
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { clients?: { id: string; name: string }[] } | null) => {
          if (d?.clients?.length) setCustomers(d.clients);
        })
        .catch(() => {});
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Загрузка Customer 360° (2.14.13)
  useEffect(() => {
    if (!customerId) return;
    const timer = setTimeout(() => {
      setProfileLoading(true);
      setCustomer360(null);
      fetch(`/api/admin/analytics/customer360?userId=${encodeURIComponent(customerId)}`)
        .then(async (r) => {
          if (!r.ok) throw new Error("Не удалось загрузить профиль");
          return r.json();
        })
        .then((d: Customer360Data) => setCustomer360(d))
        .catch(() => setCustomer360(null))
        .finally(() => setProfileLoading(false));
    }, 0);
    return () => clearTimeout(timer);
  }, [customerId]);

  // Загрузка Partner 360° (2.15.13)
  useEffect(() => {
    if (!partnerId) return;
    const timer = setTimeout(() => {
      setProfileLoading(true);
      setPartner360(null);
      fetch(`/api/admin/analytics/partner360?partnerId=${encodeURIComponent(partnerId)}`)
        .then(async (r) => {
          if (!r.ok) throw new Error("Не удалось загрузить профиль");
          return r.json();
        })
        .then((d: Partner360Data) => setPartner360(d))
        .catch(() => setPartner360(null))
        .finally(() => setProfileLoading(false));
    }, 0);
    return () => clearTimeout(timer);
  }, [partnerId]);

  // Загрузка оперативных панелей + автообновление каждые 60 с («режим
  // реального времени», Гл. 2.12.12/2.13.12/2.17.12).
  const loadOps = useCallback(() => {
    fetch("/api/admin/analytics/operations")
      .then(async (r) => {
        if (!r.ok) throw new Error(await describeApiError(r, "Ошибка загрузки оперативных панелей"));
        return r.json();
      })
      .then((d: OperationsData) => setData(d))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Неизвестная ошибка"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void loadOps(), 0);
    return () => clearTimeout(timer);
  }, [loadOps]);

  useEffect(() => {
    const id = setInterval(() => void loadOps(), 60_000);
    return () => clearInterval(id);
  }, [loadOps]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Оперативные панели</h1>
        <div className="text-xs text-[var(--admin-muted)] mt-1">
          Контроль-центры в режиме реального времени (Гл. 2.10.9, 2.11.11, 2.12.12, 2.13.12, 2.15.12, 2.17.12)
          {data && (
            <span className="text-success">
              {" "}· обновлено {new Date(data.generatedAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      </div>

      <div className="no-print ac-tabs overflow-x-auto no-scrollbar max-w-full">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`ac-tab shrink-0 ${tab === t.key ? "ac-tab-active" : ""}`}>
            {t.icon} {t.title}
          </button>
        ))}
      </div>

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 bg-[var(--admin-border)]/40 rounded-2xl animate-pulse" />
          ))}
        </div>
      )}
      {error && (
        <div className="bg-[var(--admin-card)] border border-red-200 rounded-2xl p-8 text-center text-sm text-danger">{error}</div>
      )}

      {!loading && !error && data && (
        <>
          {/* ── 2.10.9 Коммерческий радар ── */}
          {tab === "radar" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                <KpiMini label="Заказы за 60 мин" value={String(data.radar.last60min)} />
                <KpiMini label="Неотвеченные сообщения" value={String(data.radar.unansweredMessages)} tone={data.radar.unansweredMessages > 0 ? "warn" : "positive"} />
                <KpiMini label="Риск SLA" value={String(data.radar.slaRiskOrders)} tone={data.radar.slaRiskOrders > 0 ? "negative" : "positive"} />
                <KpiMini label="VIP ожидают" value={String(data.radar.vipWaiting)} />
                <KpiMini label="Критические эскалации" value={String(data.radar.urgentExceptions)} tone={data.radar.urgentExceptions > 0 ? "negative" : "positive"} />
                <KpiMini label="Менеджеров онлайн" value={String(data.radar.managerLoad.filter((m) => m.active > 0).length)} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Panel title="Загрузка менеджеров" icon="🏆">
                  <div className="space-y-2.5">
                    {data.radar.managerLoad.map((m) => {
                      const max = Math.max(...data.radar.managerLoad.map((x) => x.active), 1);
                      return (
                        <div key={m.name}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-[var(--admin-muted)]">{m.name}</span>
                            <span className="font-semibold">{m.active} заказов</span>
                          </div>
                          <div className="h-2 bg-[var(--admin-bg)] rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-primary to-amber-500" style={{ width: `${(m.active / max) * 100}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Panel>
                <Panel title="AI-оценка ситуации" icon="🤖">
                  <div className="text-xs text-[var(--admin-muted)] leading-relaxed">{data.radar.aiNote}</div>
                </Panel>
              </div>
            </div>
          )}

          {/* ── 2.11.11 Очередь заказов (Kanban) ── */}
          {tab === "queue" && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
              {data.queue.map((col) => (
                <div key={col.key} className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-3">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold">{col.icon} {col.title}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${col.color}1a`, color: col.color }}>
                      {col.orders.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {col.orders.slice(0, 6).map((o) => (
                      <Link
                        key={o.id}
                        href={`/admin/sales-execution?open=${o.id}&tab=overview`}
                        className="block p-2.5 rounded-xl bg-[var(--admin-bg)] hover:border-primary border border-transparent transition-colors"
                      >
                        <div className="flex justify-between text-xs">
                          <span className="font-semibold">{o.orderNumber}</span>
                          <span className="text-[var(--admin-muted)]">{o.ageHours} ч</span>
                        </div>
                        <div className="text-[10px] text-[var(--admin-muted)] truncate mt-0.5">{o.client}</div>
                        <div className="flex justify-between text-[10px] mt-1">
                          <span className="text-[var(--admin-muted)]">{o.manager}</span>
                          <span className="font-bold">{fmtMoney(o.amount)}</span>
                        </div>
                      </Link>
                    ))}
                    {!col.orders.length && <div className="text-[11px] text-[var(--admin-muted)] text-center py-3">Пусто</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── 2.12.12 Центр контроля бронирований + Supplier Reliability Index ── */}
          {tab === "bookings" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                <KpiMini label="Ждут ответа поставщика" value={String(data.bookingCenter.awaitingSupplier)} tone={data.bookingCenter.awaitingSupplier > 0 ? "warn" : "positive"} />
                <KpiMini label="Риск SLA" value={String(data.bookingCenter.slaRisk)} tone={data.bookingCenter.slaRisk > 0 ? "negative" : "positive"} />
                <KpiMini label="Изменения цен (24ч)" value={String(data.bookingCenter.priceChanges)} />
                <KpiMini label="Готовы к оплате" value={String(data.bookingCenter.readyToPay)} />
                <KpiMini label="Ждут документы" value={String(data.bookingCenter.awaitingDocs)} />
                <KpiMini label="VIP-бронирования" value={String(data.bookingCenter.vipBookings)} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Panel title="Ожидают ответа поставщика" icon="⏳">
                  <div className="space-y-2">
                    {data.bookingCenter.top.map((b) => (
                      <Link key={b.id} href={`/admin/bookings?open=${b.id}`} className="flex items-center justify-between p-2 rounded-xl bg-[var(--admin-bg)] hover:border-primary border border-transparent transition-colors text-xs">
                        <span className="truncate">{b.service}</span>
                        <span className="shrink-0 font-semibold">{fmtMoney(b.amount)} · {b.ageHours} ч</span>
                      </Link>
                    ))}
                    {!data.bookingCenter.top.length && <div className="text-[11px] text-[var(--admin-muted)] text-center py-3">Все бронирования обработаны</div>}
                  </div>
                </Panel>
                <Panel title="Индекс надёжности поставщика" icon="🛡️">
                  <div className="space-y-2.5">
                    {data.supplierReliability.map((p) => {
                      const max = Math.max(...data.supplierReliability.map((x) => x.score), 1);
                      return (
                        <div key={p.name}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-[var(--admin-muted)] truncate">{p.name}</span>
                            <span className="font-semibold shrink-0">{p.score}/100</span>
                          </div>
                          <div className="h-2 bg-[var(--admin-bg)] rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-teal-400 to-emerald-500" style={{ width: `${(p.score / max) * 100}%` }} />
                          </div>
                          <div className="text-[10px] text-[var(--admin-muted)] mt-0.5">{p.sub}</div>
                        </div>
                      );
                    })}
                  </div>
                </Panel>
              </div>
            </div>
          )}

          {/* ── 2.13.12 Центр финансового контроля + Financial Stability Index ── */}
          {tab === "finance" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                <KpiMini label="Поступления сегодня" value={fmtMoney(data.finance.todayInflow)} tone="positive" />
                <KpiMini label="Выплаты партнёрам" value={fmtMoney(data.finance.payoutsDue)} />
                <KpiMini label="Возвраты (24ч)" value={String(data.finance.refundsAwaiting)} tone={data.finance.refundsAwaiting > 0 ? "warn" : "positive"} />
                <KpiMini label="Просроченные счета" value={String(data.finance.overdueInvoices)} tone={data.finance.overdueInvoices > 0 ? "negative" : "positive"} />
                <KpiMini label="Крупные сделки (24ч)" value={String(data.finance.highValueDeals)} />
                <KpiMini label="Аномальные операции" value={String(data.finance.anomalies)} tone={data.finance.anomalies > 0 ? "warn" : "positive"} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Panel title="Прогноз остатка средств" icon="🔮">
                  <div className="flex items-end gap-3 h-32">
                    {data.finance.balanceForecast.map((f) => (
                      <div key={f.label} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[10px] font-semibold">{fmtMoney(f.value)}</span>
                        <div
                          className="w-full rounded-t-lg bg-gradient-to-t from-primary to-amber-400"
                          style={{ height: `${Math.max(8, (f.value / Math.max(...data.finance.balanceForecast.map((x) => x.value), 1)) * 80)}px` }}
                        />
                        <span className="text-[10px] text-[var(--admin-muted)]">{f.label}</span>
                      </div>
                    ))}
                  </div>
                </Panel>
                <Panel title="Индекс финансовой устойчивости" icon="💚">
                  <div className="space-y-3">
                    <IndexGauge value={data.financialStability.value} label={data.financialStability.label} />
                    <div className="space-y-1.5">
                      {data.financialStability.factors.map((f) => (
                        <div key={f.label} className="flex items-center gap-2 text-[11px]">
                          <span className={f.effect === "up" ? "text-success" : "text-danger"}>{f.effect === "up" ? "▲" : "▼"}</span>
                          <span className="flex-1 text-[var(--admin-muted)] truncate">{f.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Panel>
              </div>
            </div>
          )}

          {/* ── 2.15.12 Центр управления партнёрской сетью + Partner Value Index ── */}
          {tab === "partners" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                <KpiMini label="Новые партнёры (24ч)" value={String(data.partnerCenter.newPartners)} tone="positive" />
                <KpiMini label="Ждут модерации" value={String(data.partnerCenter.awaitingModeration)} tone={data.partnerCenter.awaitingModeration > 0 ? "warn" : "positive"} />
                <KpiMini label="Нарушения SLA" value={String(data.partnerCenter.slaViolations)} tone={data.partnerCenter.slaViolations > 0 ? "negative" : "positive"} />
                <KpiMini label="Рост отмен (24ч)" value={String(data.partnerCenter.risingCancellations)} tone={data.partnerCenter.risingCancellations > 0 ? "warn" : "positive"} />
                <KpiMini label="Изменения цен" value={String(data.partnerCenter.priceChanges)} />
                <KpiMini label="Быстрорастущие" value={String(data.partnerCenter.highGrowth)} tone="positive" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Panel title="Индекс стратегической ценности партнёра" icon="💎">
                  <div className="space-y-2.5">
                    {data.partnerValue.map((p) => {
                      const max = Math.max(...data.partnerValue.map((x) => x.score), 1);
                      return (
                        <div key={p.name}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-[var(--admin-muted)] truncate">{p.name}</span>
                            <span className="font-semibold shrink-0">{p.score}/100</span>
                          </div>
                          <div className="h-2 bg-[var(--admin-bg)] rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-500" style={{ width: `${(p.score / max) * 100}%` }} />
                          </div>
                          <div className="text-[10px] text-[var(--admin-muted)] mt-0.5">{p.sub}</div>
                        </div>
                      );
                    })}
                  </div>
                </Panel>
              </div>
            </div>
          )}

          {/* ── 2.17.12 Центр управления маркетингом + Marketing Efficiency Index ── */}
          {tab === "marketing" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
                <KpiMini label="Растущие кампании" value={String(data.marketing.risingCampaigns)} tone="positive" />
                <KpiMini label="Падающие кампании" value={String(data.marketing.fallingCampaigns)} tone={data.marketing.fallingCampaigns > 0 ? "warn" : "positive"} />
                <KpiMini label="Страницы с отказом" value={String(data.marketing.highBouncePages)} />
                <KpiMini label="Растущие категории" value={String(data.marketing.growingCategories)} tone="positive" />
                <KpiMini label="Прогноз плана" value={`${data.marketing.planForecastPct}%`} tone={data.marketing.planForecastPct >= 100 ? "positive" : "warn"} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Panel title="Текущие расходы по каналам" icon="💸">
                  <div className="space-y-2.5">
                    {data.marketing.spendByChannel.map((c) => {
                      const max = Math.max(...data.marketing.spendByChannel.map((x) => x.value), 1);
                      return (
                        <div key={c.label}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-[var(--admin-muted)]">{c.label}</span>
                            <span className="font-semibold">{fmtMoney(c.value)}</span>
                          </div>
                          <div className="h-2 bg-[var(--admin-bg)] rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-500" style={{ width: `${(c.value / max) * 100}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Panel>
                <Panel title="Индекс эффективности маркетинга" icon="🎯">
                  <div className="space-y-3">
                    <IndexGauge value={data.marketingEfficiency.value} label={data.marketingEfficiency.label} />
                    <div className="space-y-1.5">
                      {data.marketingEfficiency.factors.map((f) => (
                        <div key={f.label} className="flex items-center gap-2 text-[11px]">
                          <span className={f.effect === "up" ? "text-success" : "text-danger"}>{f.effect === "up" ? "▲" : "▼"}</span>
                          <span className="flex-1 text-[var(--admin-muted)] truncate">{f.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Panel>
              </div>
            </div>
          )}

          {/* ── 2.14.13 Customer 360° / 2.15.13 Partner 360° ── */}
          {tab === "profile" && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Customer 360° */}
                <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
                  <h3 className="font-semibold text-sm mb-3">👤 Customer 360° <span className="text-[10px] text-[var(--admin-muted)] font-normal">(Гл. 2.14.13)</span></h3>
                  <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="ac-select w-full mb-3">
                    <option value="">Выберите клиента…</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  {profileLoading && customerId && !customer360 && <div className="h-20 bg-[var(--admin-border)]/40 rounded-xl animate-pulse" />}
                  {customer360 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold">{customer360.name}</div>
                          <div className="text-[10px] text-[var(--admin-muted)]">{customer360.email} · рег. {customer360.registeredAt}</div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-primary/10 text-primary">
                          Покупка: {customer360.aiNextPurchase}%
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <KpiMini label="Заказов" value={String(customer360.totalOrders)} />
                        <KpiMini label="Потрачено" value={fmtMoney(customer360.totalSpent)} />
                        <KpiMini label="Средний чек" value={fmtMoney(customer360.avgCheck)} />
                        <KpiMini label="Возвраты" value={String(customer360.refunds)} tone={customer360.refunds > 0 ? "warn" : "positive"} />
                        <KpiMini label="Отзывы" value={String(customer360.reviewsCount)} />
                        <KpiMini label="Непрочитано" value={String(customer360.unreadMessages)} />
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold text-[var(--admin-muted)] mb-1">Любимые направления</div>
                        <div className="flex flex-wrap gap-1.5">
                          {customer360.favorites.map((f) => (
                            <span key={f.label} className="text-[10px] px-2 py-1 rounded-full bg-[var(--admin-bg)] text-[var(--admin-muted)]">
                              {f.label} · {f.value}
                            </span>
                          ))}
                          {!customer360.favorites.length && <span className="text-[10px] text-[var(--admin-muted)]">—</span>}
                        </div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[var(--admin-bg)] text-[11px] text-[var(--admin-muted)]">
                        🤖 <span className="font-medium text-[var(--admin-text)]">AI-профиль:</span> {customer360.aiNote}
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold text-[var(--admin-muted)] mb-1">История заказов</div>
                        <div className="space-y-1 max-h-40 overflow-y-auto no-scrollbar pr-1">
                          {customer360.orders.map((o) => (
                            <Link key={o.id} href={`/admin/sales-execution?open=${o.id}&tab=overview`} className="flex items-center justify-between p-2 rounded-lg bg-[var(--admin-bg)] hover:border-primary border border-transparent transition-colors text-[11px]">
                              <span className="font-medium">{o.number}</span>
                              <span className="text-[var(--admin-muted)]">{o.at} · {o.status}</span>
                              <span className="font-bold">{fmtMoney(o.amount)}</span>
                            </Link>
                          ))}
                          {!customer360.orders.length && <div className="text-[11px] text-[var(--admin-muted)]">Нет заказов</div>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Partner 360° */}
                <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
                  <h3 className="font-semibold text-sm mb-3">🤝 Partner 360° <span className="text-[10px] text-[var(--admin-muted)] font-normal">(Гл. 2.15.13)</span></h3>
                  <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)} className="ac-select w-full mb-3">
                    <option value="">Выберите партнёра…</option>
                    {partnersList.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  {profileLoading && partnerId && !partner360 && <div className="h-20 bg-[var(--admin-border)]/40 rounded-xl animate-pulse" />}
                  {partner360 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold">{partner360.name}</div>
                          <div className="text-[10px] text-[var(--admin-muted)]">{partner360.contact} · {partner360.country}{partner360.city && partner360.city !== "—" ? `, ${partner360.city}` : ""}</div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-teal-500/10 text-teal-500">{partner360.status}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <KpiMini label="Оборот" value={fmtMoney(partner360.turnover)} />
                        <KpiMini label="Прибыль" value={fmtMoney(partner360.profit)} tone="positive" />
                        <KpiMini label="Заказов" value={String(partner360.orders)} />
                        <KpiMini label="Подтверждений" value={`${partner360.confirmPct}%`} tone={partner360.confirmPct >= 80 ? "positive" : "warn"} />
                        <KpiMini label="Отмены" value={`${partner360.cancelPct}%`} tone={partner360.cancelPct <= 10 ? "positive" : "negative"} />
                        <KpiMini label="SLA" value={`${partner360.sla}%`} tone={partner360.sla >= 80 ? "positive" : "warn"} />
                        <KpiMini label="Рейтинг" value={String(partner360.rating)} />
                        <KpiMini label="Скорость ответа" value={`${partner360.responseScore}/100`} />
                        <KpiMini label="Средний чек" value={fmtMoney(partner360.avgCheck)} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-2.5 rounded-xl bg-[var(--admin-bg)]">
                          <div className="text-[10px] text-[var(--admin-muted)] mb-1">Прогноз надёжности</div>
                          <div className="text-lg font-bold text-success">{partner360.reliabilityForecast}%</div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-[var(--admin-bg)]">
                          <div className="text-[10px] text-[var(--admin-muted)] mb-1">Прогноз роста</div>
                          <div className="text-lg font-bold text-primary">{partner360.growthForecast}%</div>
                        </div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[var(--admin-bg)] text-[11px] text-[var(--admin-muted)]">
                        🤖 <span className="font-medium text-[var(--admin-text)]">AI-профиль:</span> {partner360.aiNote}
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold text-[var(--admin-muted)] mb-1">История взаимодействия</div>
                        <div className="space-y-1 max-h-40 overflow-y-auto no-scrollbar pr-1">
                          {partner360.historyEvents.map((h, i) => (
                            <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-[var(--admin-bg)] text-[11px]">
                              <span className="text-[10px] text-[var(--admin-muted)] shrink-0">{h.at}</span>
                              <span className="font-medium">{h.action}</span>
                              <span className="text-[var(--admin-muted)] truncate">· {h.detail}</span>
                            </div>
                          ))}
                          {!partner360.historyEvents.length && <div className="text-[11px] text-[var(--admin-muted)]">Нет событий</div>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
