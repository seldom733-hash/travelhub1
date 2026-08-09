"use client";

import { useLocale } from "@/lib/i18n";
import { pt } from "@/lib/partner-i18n";
import DynamicSchemaForm from "./DynamicSchemaForm";
import TariffList, { type TariffDraft } from "./TariffList";
import type { PartnerAvailabilityRow, PartnerMediaRequirements, PartnerSchemaContract } from "@/lib/partner-api";
import type { PublicCategory } from "@/lib/public-api";
import { formatDate } from "@/lib/i18n";

export interface ProductEditorValues {
  title: string;
  description: string;
  attributes: Record<string, unknown>;
  tariffs: TariffDraft[];
}

export interface ProductEditorFormProps {
  categories: PublicCategory[];
  categoryId: string | null;
  /** create: выбор категории; edit: undefined (категория фиксирована). */
  onSelectCategory?: (id: string) => void;
  schema: PartnerSchemaContract | null;
  schemaLoading: boolean;
  values: ProductEditorValues;
  onChange: (next: ProductEditorValues) => void;
  /** SUBMITTED/IN_REVIEW — форма read-only. */
  readOnly?: boolean;
  lockBanner?: string | null;
  /** PUBLISHED: правки уходят в N+1 (live N не меняется). */
  proposalBanner?: boolean;
  availabilityRows?: PartnerAvailabilityRow[];
  mediaRequirements?: PartnerMediaRequirements | null;
  mediaCount?: number;
  onSubmit?: () => void;
  submitting?: boolean;
  submitLabel?: string;
  mediaHref?: string;
}

function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {hint && <p className="mb-4 mt-0.5 text-xs text-slate-400">{hint}</p>}
      {children}
    </section>
  );
}

/**
 * Общий редактор Product (Step 1.8 §7/§10): Basic Information + Category
 * Attributes (dynamic schema form) + Tariffs + Availability (read-only для
 * PARTNER: нет права записи availability — RBAC, §14) + Media hint.
 */
export default function ProductEditorForm(props: ProductEditorFormProps) {
  const locale = useLocale();
  const {
    categories,
    categoryId,
    onSelectCategory,
    schema,
    schemaLoading,
    values,
    onChange,
    readOnly,
    lockBanner,
    proposalBanner,
    availabilityRows = [],
    mediaRequirements,
    mediaCount = 0,
    onSubmit,
    submitting,
    submitLabel,
    mediaHref,
  } = props;

  const set = (patch: Partial<ProductEditorValues>) => onChange({ ...values, ...patch });

  return (
    <div className="space-y-5">
      {lockBanner && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{lockBanner}</div>
      )}
      {proposalBanner && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {pt("partner.form.live_locked", locale)}
          <div className="mt-1 text-xs text-emerald-600">{pt("partner.form.publish_note", locale)}</div>
        </div>
      )}

      <Panel title={pt("partner.form.basic", locale)} hint={pt("partner.form.basic_hint", locale)}>
        <div className="space-y-4">
          <div>
            <label htmlFor="pef-title" className="mb-1 block text-sm font-medium text-slate-700">
              {pt("partner.form.title", locale)}
              <span className="ml-1 text-rose-500" aria-hidden>
                *
              </span>
            </label>
            <input
              id="pef-title"
              value={values.title}
              onChange={(e) => set({ title: e.target.value })}
              disabled={readOnly}
              placeholder={pt("partner.form.title_ph", locale)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50"
            />
          </div>

          <div>
            <label htmlFor="pef-category" className="mb-1 block text-sm font-medium text-slate-700">
              {pt("partner.form.category", locale)}
              {onSelectCategory && (
                <span className="ml-1 text-rose-500" aria-hidden>
                  *
                </span>
              )}
            </label>
            {onSelectCategory ? (
              <select
                id="pef-category"
                value={categoryId ?? ""}
                onChange={(e) => onSelectCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-400"
              >
                <option value="">{pt("partner.form.category_ph", locale)}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                {categories.find((c) => c.id === categoryId)?.title ?? pt("partner.product.no_category", locale)}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="pef-description" className="mb-1 block text-sm font-medium text-slate-700">
              {pt("partner.form.description", locale)}
            </label>
            <textarea
              id="pef-description"
              value={values.description}
              onChange={(e) => set({ description: e.target.value })}
              disabled={readOnly}
              rows={5}
              placeholder={pt("partner.form.description_ph", locale)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50"
            />
          </div>
        </div>
      </Panel>

      <Panel title={pt("partner.form.attributes", locale)} hint={pt("partner.form.attributes_hint", locale)}>
        {!categoryId ? (
          <p className="text-sm text-slate-400">{pt("partner.form.choose_category_first", locale)}</p>
        ) : schemaLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-9 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : schema ? (
          <DynamicSchemaForm
            attributes={schema.schema.attributes}
            value={values.attributes}
            onChange={(attributes) => set({ attributes })}
            disabled={readOnly}
          />
        ) : (
          <p className="text-sm text-rose-500">{pt("partner.error.load", locale)}</p>
        )}
      </Panel>

      <Panel title={pt("partner.form.tariffs", locale)} hint={pt("partner.form.tariffs_hint", locale)}>
        <TariffList value={values.tariffs} onChange={(tariffs) => set({ tariffs })} disabled={readOnly} />
      </Panel>

      <Panel title={pt("partner.form.availability", locale)}>
        {availabilityRows.length === 0 ? (
          <p className="text-sm text-slate-400">{pt("partner.form.no_availability", locale)}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-72 text-left text-xs">
              <thead className="border-b border-slate-100 text-[10px] uppercase text-slate-400">
                <tr>
                  <th className="py-2 pr-3 font-medium">{pt("partner.form.category", locale)}</th>
                  <th className="py-2 pr-3 font-medium">{pt("partner.moderation.version", locale)}</th>
                  <th className="py-2 font-medium">slots</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {availabilityRows.map((a) => (
                  <tr key={a.id}>
                    <td className="py-2 pr-3 text-slate-700">{formatDate(a.date, locale)}</td>
                    <td className="py-2 pr-3 text-slate-500">
                      {a.slotsTotal} ({a.slotsBooked + a.slotsReserved} / {a.slotsTotal})
                    </td>
                    <td className="py-2 text-slate-400">{a.tariffId ? "tariff" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
          {pt("partner.form.availability_readonly", locale)}
        </p>
      </Panel>

      <Panel title={pt("partner.form.media", locale)} hint={pt("partner.form.media_hint", locale)}>
        {mediaRequirements && (
          <div className="mb-3 flex flex-wrap gap-2 text-[11px]">
            {mediaRequirements.minImages !== undefined && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                {pt("partner.media.min_images", locale)}: {mediaRequirements.minImages}
              </span>
            )}
            {mediaRequirements.maxImages !== undefined && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                {pt("partner.media.max_images", locale)}: {mediaRequirements.maxImages}
              </span>
            )}
            {mediaRequirements.primaryImageRequired && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">{pt("partner.media.primary_required", locale)}</span>
            )}
            {mediaRequirements.allowedMediaTypes && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                {pt("partner.media.allowed_types", locale)}: {mediaRequirements.allowedMediaTypes.join(", ")}
              </span>
            )}
          </div>
        )}
        <p className="text-sm text-slate-500">
          {mediaCount} {pt("partner.products.count", locale)}
        </p>
        {mediaHref && (
          <LinkButton href={mediaHref}>{pt("partner.form.media_go", locale)}</LinkButton>
        )}
      </Panel>

      {onSubmit && (
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting || readOnly || !values.title.trim()}
            className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? pt("partner.form.saving", locale) : (submitLabel ?? pt("partner.form.save", locale))}
          </button>
        </div>
      )}
    </div>
  );
}

function LinkButton({ href, children }: { href: string; children: React.ReactNode }) {
  // eslint-disable-next-line @next/next/no-html-link-for-pages
  return <a href={href} className="mt-2 inline-block rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50">{children}</a>;
}
