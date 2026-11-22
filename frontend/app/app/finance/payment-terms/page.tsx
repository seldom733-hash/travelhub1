"use client";

/**
 * Finance Center — условия оплаты поставщикам.
 *
 * Two tabs:
 *  - «Правила»: supplier-level default rule (IMMEDIATE / NET_DAYS), applied
 *    only when a new SupplierObligation is created;
 *  - «График по бронированиям»: finance enters concrete supplier payment dates
 *    and amounts (FULL or FIRST + LAST) per booking.
 *
 * Access is restricted to FINANCE / ADMIN / DIRECTOR (view) and FINANCE /
 * ADMIN (write), both in the sidebar and on the backend.
 */
import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import NotificationStrip from "@/components/NotificationStrip";
import { t, useLocale } from "@/lib/i18n";
import { useCan } from "@/lib/use-can";
import { api } from "@/lib/api";
import { useCurrentUserStatus } from "@/lib/use-user";
import { financeCenterApi, type SupplierPaymentPlanRow, type SupplierPaymentTerms } from "@/lib/finance-center-api";
import DateTextInput from "@/components/forms/DateTextInput";

const ALLOWED_VIEW = new Set(["FINANCE", "ADMIN", "DIRECTOR"]);
const ALLOWED_WRITE = new Set(["FINANCE", "ADMIN"]);

type Draft = {
  mode: "FULL" | "PARTIAL";
  fullDate: string;
  fullAmount: string;
  firstDate: string;
  firstAmount: string;
  lastDate: string;
  lastAmount: string;
};

const money = (locale: string, value: number) =>
  new Intl.NumberFormat(locale === "az" ? "az-AZ" : locale === "en" ? "en-GB" : "ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const date = (value: string | null | undefined) => {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-");
  return d && m && y ? `${d}.${m}.${y.slice(-2)}` : value;
};

export default function SupplierPaymentTermsPage() {
  const locale = useLocale();
  const { user, ready } = useCurrentUserStatus();
  const canManage = useCan("finance.obligation.manage");
  const canWrite = Boolean(user?.role && ALLOWED_WRITE.has(user.role)) && canManage;
  const canView = Boolean(user?.role && ALLOWED_VIEW.has(user.role));

  const L = (ru: string, az: string, en: string) => (locale === "az" ? az : locale === "en" ? en : ru);

  const [tab, setTab] = useState<"rules" | "plans">("rules");
  const [items, setItems] = useState<SupplierPaymentTerms[] | null>(null);
  const [supplierCode, setSupplierCode] = useState("");
  const [partners, setPartners] = useState<Array<{ code: string; name: string }>>([]);
  const [rule, setRule] = useState<"IMMEDIATE" | "NET_DAYS">("NET_DAYS");
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const [plans, setPlans] = useState<SupplierPaymentPlanRow[] | null>(null);
  const [editing, setEditing] = useState<SupplierPaymentPlanRow | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [planBusy, setPlanBusy] = useState(false);
  const [planError, setPlanError] = useState("");

  const load = useCallback(async () => {
    if (!canView) return;
    try {
      setItems(await financeCenterApi.listSupplierPaymentTerms());
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [canView]);

  const loadPlans = useCallback(async () => {
    if (!canView) return;
    try {
      setPlans(await financeCenterApi.listSupplierPaymentPlans());
      setPlanError("");
    } catch (e) {
      setPlanError((e as Error).message);
    }
  }, [canView]);

  useEffect(() => {
    void load();
    void loadPlans();
    api.get<{ items?: Array<{ code: string; name: string }> }>("/partners?pageSize=300")
      .then((data) => setPartners(data.items ?? [])).catch(() => setPartners([]));
  }, [load, loadPlans]);

  const save = async () => {
    if (!canWrite || !supplierCode.trim()) {
      setError(L("Укажите код поставщика", "Təchizatçı kodunu daxil edin", "Supplier code is required"));
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await financeCenterApi.upsertSupplierPaymentTerms({
        supplierCode: supplierCode.trim().toUpperCase(),
        rule,
        days: rule === "IMMEDIATE" ? 0 : days,
      });
      setNotice(L("Правило сохранено", "Qayda saxlanıldı", "Rule saved"));
      setSupplierCode("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const openPlan = (row: SupplierPaymentPlanRow) => {
    const plan = row.plan;
    const full = plan?.installments.find((i) => i.kind === "FULL");
    const first = plan?.installments.find((i) => i.kind === "FIRST");
    const last = plan?.installments.find((i) => i.kind === "LAST");
    const remaining = row.remainingAmount || row.amount;
    setEditing(row);
    setPlanError("");
    setDraft({
      mode: plan?.mode ?? "FULL",
      fullDate: full?.dueDate ?? row.dueDate ?? "",
      fullAmount: String(full?.amount ?? remaining),
      firstDate: first?.dueDate ?? "",
      firstAmount: String(first?.amount ?? ""),
      lastDate: last?.dueDate ?? row.dueDate ?? "",
      lastAmount: String(last?.amount ?? ""),
    });
  };

  const savePlan = async () => {
    if (!editing || !draft || !canWrite) return;
    const remaining = editing.remainingAmount || editing.amount;
    setPlanBusy(true);
    setPlanError("");
    try {
      if (draft.mode === "FULL") {
        const amount = Number(draft.fullAmount);
        if (!draft.fullDate || !Number.isFinite(amount) || amount <= 0) {
          throw new Error(L("Укажите дату и сумму полной оплаты", "Tam ödənişin tarixini və məbləğini daxil edin", "Enter the full payment date and amount"));
        }
        if (Math.abs(amount - remaining) > 0.01) {
          throw new Error(L(`Сумма должна быть ${money(locale, remaining)} AZN`, `Məbləğ ${money(locale, remaining)} AZN olmalıdır`, `Amount must be ${money(locale, remaining)} AZN`));
        }
        await financeCenterApi.upsertSupplierPaymentPlan(editing.obligationId, {
          mode: "FULL",
          installments: [{ kind: "FULL", dueDate: draft.fullDate, amount }],
        });
      } else {
        const firstAmount = Number(draft.firstAmount);
        const lastAmount = Number(draft.lastAmount);
        if (!draft.firstDate || !draft.lastDate || !Number.isFinite(firstAmount) || !Number.isFinite(lastAmount) || firstAmount <= 0 || lastAmount <= 0) {
          throw new Error(L("Заполните обе даты и обе суммы", "Hər iki tarixi və məbləği doldurun", "Enter both dates and amounts"));
        }
        if (draft.firstDate >= draft.lastDate) {
          throw new Error(L("Первая дата должна быть раньше последней", "Birinci tarix sonuncudan əvvəl olmalıdır", "First date must be before the last date"));
        }
        if (Math.abs(firstAmount + lastAmount - remaining) > 0.01) {
          throw new Error(L(`Сумма частей должна быть ${money(locale, remaining)} AZN`, `Hissələrin cəmi ${money(locale, remaining)} AZN olmalıdır`, `Installments must total ${money(locale, remaining)} AZN`));
        }
        await financeCenterApi.upsertSupplierPaymentPlan(editing.obligationId, {
          mode: "PARTIAL",
          installments: [
            { kind: "FIRST", dueDate: draft.firstDate, amount: firstAmount },
            { kind: "LAST", dueDate: draft.lastDate, amount: lastAmount },
          ],
        });
      }
      setEditing(null);
      setDraft(null);
      setNotice(L("График сохранён", "Cədvəl saxlanıldı", "Payment plan saved"));
      await loadPlans();
    } catch (e) {
      setPlanError((e as Error).message);
    } finally {
      setPlanBusy(false);
    }
  };

  if (!ready) {
    return <div className="p-8 text-sm text-ink/60">{L("Загрузка…", "Yüklənir…", "Loading…")}</div>;
  }
  if (!canView) {
    return (
      <div className="p-8">
        <h1 className="text-lg font-semibold text-ink">{L("Доступ ограничен", "Giriş məhduddur", "Access restricted")}</h1>
        <p className="mt-2 text-sm text-ink/60">
          {L("Раздел доступен только FINANCE, ADMIN и DIRECTOR.", "Bölmə yalnız FINANCE, ADMIN və DIRECTOR üçündür.", "This section is available to FINANCE, ADMIN and DIRECTOR only.")}
        </p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t("finance.payment_terms.title", locale)}
        breadcrumbs={["Navitravel", t("nav.group.finance", locale), t("finance.payment_terms.title", locale)]}
      />
      <div className="space-y-4 p-6">
        <NotificationStrip scope="finance" />

        <div className="flex gap-1 rounded-xl border border-line bg-white p-1">
          <button
            type="button"
            onClick={() => setTab("rules")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === "rules" ? "bg-brand text-white" : "text-ink/60 hover:bg-panel"}`}
          >
            {L("Правила по поставщикам", "Təchizatçı qaydaları", "Supplier rules")}
          </button>
          <button
            type="button"
            onClick={() => setTab("plans")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === "plans" ? "bg-brand text-white" : "text-ink/60 hover:bg-panel"}`}
          >
            {L("График по бронированиям", "Bronlar üzrə cədvəl", "Payment plan by booking")}
          </button>
        </div>

        {error && (
          <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}
        {notice && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{notice}</div>
        )}

        {tab === "rules" && (
          <>
            <p className="rounded-lg border border-line bg-panel px-4 py-2 text-xs text-ink/60">
              {t("finance.payment_terms.hint", locale)}
            </p>

            {canWrite && (
              <section className="rounded-xl border border-line bg-white p-4">
                <h2 className="text-sm font-semibold text-ink">{t("finance.payment_terms.set", locale)}</h2>
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <label className="text-sm">
                    <span className="mb-1 block text-ink/60">{t("finance.payment_terms.supplier", locale)}</span>
                    <select
                      value={supplierCode}
                      onChange={(e) => setSupplierCode(e.target.value)}
                      className="min-w-56 rounded-lg border border-line bg-white px-3 py-2 text-sm"
                    >
                      <option value="">{t("finance.payment_terms.supplier_placeholder", locale)}</option>
                      {partners.map((partner) => <option key={partner.code} value={partner.code}>{partner.name}</option>)}
                    </select>
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-ink/60">{t("finance.payment_terms.rule", locale)}</span>
                    <select
                      value={rule}
                      onChange={(e) => setRule(e.target.value as "IMMEDIATE" | "NET_DAYS")}
                      className="rounded-lg border border-line px-3 py-2 text-sm"
                    >
                      <option value="IMMEDIATE">{t("finance.payment_terms.rule.immediate", locale)}</option>
                      <option value="NET_DAYS">{t("finance.payment_terms.rule.net_days", locale)}</option>
                    </select>
                  </label>
                  {rule === "NET_DAYS" && (
                    <label className="text-sm">
                      <span className="mb-1 block text-ink/60">{t("finance.payment_terms.days", locale)}</span>
                      <input
                        type="number"
                        min={0}
                        max={365}
                        value={days}
                        onChange={(e) => setDays(Number(e.target.value))}
                        className="w-24 rounded-lg border border-line px-3 py-2 text-sm"
                      />
                    </label>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void save()}
                    className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
                  >
                    {t("common.save", locale)}
                  </button>
                </div>
              </section>
            )}

            <section className="overflow-hidden rounded-xl border border-line bg-white">
              {items && items.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm text-ink">
                    <thead>
                      <tr className="border-b border-line bg-panel text-left text-xs uppercase tracking-wide text-ink/60">
                        <th className="px-3 py-2">{t("finance.payment_terms.supplier", locale)}</th>
                        <th className="px-3 py-2">{t("finance.payment_terms.rule", locale)}</th>
                        <th className="px-3 py-2">{t("finance.payment_terms.days", locale)}</th>
                        <th className="px-3 py-2">{t("finance.payment_terms.active", locale)}</th>
                        <th className="px-3 py-2">{t("finance.payment_terms.updated", locale)}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((row) => (
                        <tr key={row.supplierCode} className="border-b border-line/60">
                          <td className="px-3 py-2 font-mono text-xs font-semibold">{row.supplierCode}</td>
                          <td className="px-3 py-2">{t(`finance.payment_terms.rule.${row.rule.toLowerCase()}`, locale)}</td>
                          <td className="px-3 py-2">{row.rule === "IMMEDIATE" ? "0" : row.days}</td>
                          <td className="px-3 py-2">{row.active ? "✓" : "—"}</td>
                          <td className="px-3 py-2 text-xs text-ink/60">{row.updatedAt.slice(0, 19).replace("T", " ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="py-10 text-center text-sm text-ink/60">{t("finance.payment_terms.empty", locale)}</p>
              )}
            </section>
          </>
        )}

        {tab === "plans" && (
          <>
            <p className="rounded-lg border border-line bg-panel px-4 py-2 text-xs text-ink/60">
              {L(
                "Для каждой брони финанс вводит суммы и даты вручную: полная оплата одной датой или первая и последняя оплаты. Напоминания приходят за 3 дня и далее ежедневно до оплаты.",
                "Hər bron üçün maliyyə məbləğləri və tarixləri əl ilə daxil edir: tam ödəniş bir tarixlə və ya ilk və son ödəniş. Xatırlatmalar 3 gün əvvəl və ödənişə qədər hər gün gəlir.",
                "For each booking finance enters amounts and dates manually: one full payment or first + last payment. Reminders arrive 3 days before and daily until paid.",
              )}
            </p>

            <section className="overflow-hidden rounded-xl border border-line bg-white">
              {plans && plans.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm text-ink">
                    <thead>
                      <tr className="border-b border-line bg-panel text-left text-xs uppercase tracking-wide text-ink/60">
                        <th className="px-3 py-2">{L("Бронь", "Bron", "Booking")}</th>
                        <th className="px-3 py-2">{L("Поставщик", "Təchizatçı", "Supplier")}</th>
                        <th className="px-3 py-2 text-right">{L("К оплате", "Ödəniləcək", "Remaining")}</th>
                        <th className="px-3 py-2">{L("График", "Cədvəl", "Plan")}</th>
                        <th className="px-3 py-2">{L("Действие", "Əməliyyat", "Action")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plans.map((row) => (
                        <tr key={row.obligationId} className="border-b border-line/60 align-top">
                          <td className="px-3 py-2">
                            <div className="font-mono text-xs font-semibold">{row.bookingCode ?? row.obligationCode}</div>
                            <div className="text-[10px] text-ink/60">{row.orderCode ?? "—"}</div>
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">{row.supplierCode ?? "—"}</td>
                          <td className="px-3 py-2 text-right font-semibold">{money(locale, row.remainingAmount || row.amount)} AZN</td>
                          <td className="px-3 py-2 text-xs text-ink/60">
                            {row.plan ? (
                              <div className="space-y-0.5">
                                {row.plan.installments.map((i) => (
                                  <div key={i.id}>
                                    {i.kind === "FULL" ? L("Полная", "Tam", "Full") : i.kind === "FIRST" ? L("Первая", "İlk", "First") : L("Последняя", "Son", "Last")}
                                    {": "}
                                    {date(i.dueDate)} · {money(locale, i.amount)} AZN
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-ink/60">{L("не задан", "təyin edilməyib", "not set")}</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {canWrite ? (
                              <button type="button" onClick={() => openPlan(row)} className="rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-ink hover:bg-panel">
                                {row.plan ? L("Изменить", "Dəyişdir", "Edit") : L("Настроить", "Təyin et", "Set plan")}
                              </button>
                            ) : (
                              <span className="text-xs text-ink/60">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="py-10 text-center text-sm text-ink/60">
                  {L("Открытых броней для оплаты поставщикам нет.", "Təchizatçılara ödəniş üçün açıq bron yoxdur.", "No open bookings for supplier payment.")}
                </p>
              )}
            </section>

            {editing && draft && (
              <section className="rounded-xl border border-line bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-ink">
                      {L("График оплаты", "Ödəniş cədvəli", "Payment plan")}: {editing.bookingCode ?? editing.obligationCode}
                    </h2>
                    <p className="mt-0.5 text-xs text-ink/60">
                      {editing.supplierCode ?? "—"} · {L("к оплате", "ödəniləcək", "remaining")}{" "}
                      {money(locale, editing.remainingAmount || editing.amount)} AZN
                    </p>
                  </div>
                  <button type="button" onClick={() => { setEditing(null); setDraft(null); }} className="text-xs text-ink/60 hover:text-ink">
                    {L("Закрыть", "Bağla", "Close")}
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, mode: "FULL" })}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${draft.mode === "FULL" ? "border-brand bg-brand text-white" : "border-line text-ink/60"}`}
                  >
                    {L("Полная оплата", "Tam ödəniş", "Full payment")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, mode: "PARTIAL" })}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${draft.mode === "PARTIAL" ? "border-brand bg-brand text-white" : "border-line text-ink/60"}`}
                  >
                    {L("Частичная оплата", "Hissəli ödəniş", "Partial payment")}
                  </button>
                </div>

                {draft.mode === "FULL" ? (
                  <div className="mt-3 flex flex-wrap items-end gap-3">
                    <label className="text-sm">
                      <span className="mb-1 block text-ink/60">{L("Дата оплаты", "Ödəniş tarixi", "Payment date")}</span>
                      <DateTextInput value={draft.fullDate} onChange={(v) => setDraft({ ...draft, fullDate: v })} className="rounded-lg border border-line px-3 py-2 text-sm" />
                    </label>
                    <label className="text-sm">
                      <span className="mb-1 block text-ink/60">{L("Сумма, AZN", "Məbləğ, AZN", "Amount, AZN")}</span>
                      <input type="number" min={0.01} step={0.01} value={draft.fullAmount} onChange={(e) => setDraft({ ...draft, fullAmount: e.target.value })} className="w-40 rounded-lg border border-line px-3 py-2 text-sm" />
                    </label>
                  </div>
                ) : (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-line/70 p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/60">{L("Первая оплата", "İlk ödəniş", "First payment")}</p>
                      <label className="text-sm">
                        <span className="mb-1 block text-ink/60">{L("Дата", "Tarix", "Date")}</span>
                        <DateTextInput value={draft.firstDate} onChange={(v) => setDraft({ ...draft, firstDate: v })} className="w-full rounded-lg border border-line px-3 py-2 text-sm" />
                      </label>
                      <label className="mt-2 block text-sm">
                        <span className="mb-1 block text-ink/60">{L("Сумма, AZN", "Məbləğ, AZN", "Amount, AZN")}</span>
                        <input type="number" min={0.01} step={0.01} value={draft.firstAmount} onChange={(e) => setDraft({ ...draft, firstAmount: e.target.value })} className="w-full rounded-lg border border-line px-3 py-2 text-sm" />
                      </label>
                    </div>
                    <div className="rounded-lg border border-line/70 p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/60">{L("Последняя оплата", "Son ödəniş", "Last payment")}</p>
                      <label className="text-sm">
                        <span className="mb-1 block text-ink/60">{L("Дата", "Tarix", "Date")}</span>
                        <DateTextInput value={draft.lastDate} onChange={(v) => setDraft({ ...draft, lastDate: v })} className="w-full rounded-lg border border-line px-3 py-2 text-sm" />
                      </label>
                      <label className="mt-2 block text-sm">
                        <span className="mb-1 block text-ink/60">{L("Сумма, AZN", "Məbləğ, AZN", "Amount, AZN")}</span>
                        <input type="number" min={0.01} step={0.01} value={draft.lastAmount} onChange={(e) => setDraft({ ...draft, lastAmount: e.target.value })} className="w-full rounded-lg border border-line px-3 py-2 text-sm" />
                      </label>
                    </div>
                  </div>
                )}

                {planError && <p className="mt-3 text-xs text-rose-600">{planError}</p>}
                <div className="mt-3 flex gap-2">
                  <button type="button" disabled={planBusy} onClick={() => void savePlan()} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
                    {planBusy ? L("Сохраняем…", "Saxlanılır…", "Saving…") : t("common.save", locale)}
                  </button>
                  <button type="button" onClick={() => { setEditing(null); setDraft(null); }} className="rounded-lg border border-line px-4 py-2 text-sm text-ink/60">
                    {L("Отмена", "Ləğv et", "Cancel")}
                  </button>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}