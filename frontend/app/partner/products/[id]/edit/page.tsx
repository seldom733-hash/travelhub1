"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useLocale } from "@/lib/i18n";
import { pt } from "@/lib/partner-i18n";
import { partnerApi, type PartnerProductDetail, type PartnerSchemaContract } from "@/lib/partner-api";
import ProductEditorForm, { type ProductEditorValues } from "@/components/partner/ProductEditorForm";
import { newTariffDraft, tariffDraftsFrom, tariffDraftsToPayload } from "@/components/partner/TariffList";
import type { PublicCategory } from "@/lib/public-api";

/**
 * PHASE 1 STEP 1.8 §9/§19 — Edit Product (lifecycle-aware):
 *  - DRAFT: direct edit;
 *  - CHANGES_REQUESTED: edit + re-submit (продукт выпущен в DRAFT);
 *  - PUBLISHED: правки идут в ProductDraft N+1 (live approved N не меняется);
 *  - SUBMITTED/IN_REVIEW: read-only (решение ещё не принято);
 *  - ARCHIVED/COMPLETE/REVIEWED/CHANGED: read-only (PARTNER edit ограничен).
 * Dynamic schema form — через Partner-safe contract (не internal /category-schemas).
 * Backend остаётся authoritative; конфликт версии показывается без blind retry.
 */
export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const locale = useLocale();

  const [product, setProduct] = useState<PartnerProductDetail | null>(null);
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [schema, setSchema] = useState<PartnerSchemaContract | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [values, setValues] = useState<ProductEditorValues | null>(null);
  const [error, setError] = useState("");
  const [savedMsg, setSavedMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [travelerRequirements, setTravelerRequirements] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    let alive = true;
    void partnerApi
      .listCategories()
      .then((c) => {
        if (alive) setCategories(c);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  // Загрузка продукта + schema (по категории продукта) + инициализация формы.
  useEffect(() => {
    if (!id) return;
    let alive = true;
    setError("");
    partnerApi
      .getProduct(id)
      .then(async (p) => {
        if (!alive) return;
        setProduct(p);
        // Правки PUBLISHED-версии редактируются через draft N+1 (если есть — продолжаем его).
        const draft = p.draft;
        const content = draft ?? p;
        const attrs = (draft?.attributes ?? p.attributes ?? {}) as Record<string, unknown>;
        const tariffs =
          draft?.tariffs && draft.tariffs.length > 0
            ? draft.tariffs
            : (p.tariffs ?? []).map((t) => ({ name: t.name, price: t.price, currency: t.currency }));
        setValues({
          title: content.title ?? "",
          description: content.description ?? "",
          attributes: attrs,
          tariffs: tariffs.length > 0 ? tariffDraftsFrom(tariffs) : [newTariffDraft()],
        });
        setTravelerRequirements(p.travelerRequirements ?? null);

        if (p.category?.slug) {
          setSchemaLoading(true);
          try {
            const s = await partnerApi.schemaForCategory(p.category.slug);
            if (alive) setSchema(s);
          } catch {
            if (alive) setSchema(null);
          } finally {
            if (alive) setSchemaLoading(false);
          }
        }
      })
      .catch((err) => {
        if (alive) setError((err as Error).message);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  const lifecycle = useMemo(() => {
    if (!product) return "loading";
    if (product.status === "SUBMITTED" || product.status === "IN_REVIEW") return "locked";
    if (product.status === "PUBLISHED") return "proposal";
    if (product.status === "DRAFT") return "editable";
    return "readonly";
  }, [product]);

  const readOnly = lifecycle === "locked" || lifecycle === "readonly";

  const submit = async () => {
    if (!values || !product || !values.title.trim()) return;
    setSubmitting(true);
    setError("");
    setSavedMsg("");
    try {
      await partnerApi.updateProduct(product.id, {
        title: values.title.trim(),
        description: values.description.trim() || undefined,
        categoryId: product.categoryId ?? undefined,
        ...(product.categoryId ? { attributes: values.attributes } : {}),
        tariffs: tariffDraftsToPayload(values.tariffs),
        travelerRequirements,
      });
      setSavedMsg(pt("partner.form.saved_ok", locale));
      // Перезагружаем продукт (draft N+1 / обновлённые данные).
      const p = await partnerApi.getProduct(product.id);
      setProduct(p);
      const draft = p.draft;
      const content = draft ?? p;
      const attrs = (draft?.attributes ?? p.attributes ?? {}) as Record<string, unknown>;
      const tariffs =
        draft?.tariffs && draft.tariffs.length > 0
          ? draft.tariffs
          : (p.tariffs ?? []).map((t) => ({ name: t.name, price: t.price, currency: t.currency }));
      setValues({
        title: content.title ?? "",
        description: content.description ?? "",
        attributes: attrs,
        tariffs: tariffs.length > 0 ? tariffDraftsFrom(tariffs) : [newTariffDraft()],
      });
      setTravelerRequirements(p.travelerRequirements ?? null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (error && !product) {
    return <div className="py-16 text-center text-sm text-rose-600">{pt("partner.error.not_found", locale)}</div>;
  }
  if (!product || !values) {
    return <div className="py-16 text-center text-sm text-slate-400">{pt("partner.state.loading", locale)}</div>;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5">
        <Link href={`/partner/products/${product.id}`} className="text-sm text-slate-500 hover:text-emerald-700">
          {pt("partner.product.back", locale)}
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">{pt("partner.product.edit", locale)}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span className="font-mono">{product.code}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{pt(`partner.status.${product.status}`, locale)}</span>
          {product.draft && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">
              {pt("partner.product.proposal_n", locale)} (v{product.draft.version})
            </span>
          )}
        </div>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {savedMsg && <div className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{savedMsg}</div>}

      {lifecycle === "locked" && (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {pt("partner.form.locked_submitted", locale)}
        </div>
      )}

      <ProductEditorForm
        categories={categories}
        categoryId={product.categoryId}
        schema={schema}
        schemaLoading={schemaLoading}
        values={values}
        onChange={setValues}
        readOnly={readOnly}
        proposalBanner={lifecycle === "proposal"}
        availabilityRows={product.availability}
        mediaRequirements={schema?.schema.mediaRequirements ?? null}
        mediaCount={product.media.length}
        mediaHref={`/partner/products/${product.id}/media`}
        onSubmit={submit}
        submitting={submitting}
        submitLabel={pt("partner.form.save", locale)}
        productType={product.type}
        travelerRequirements={travelerRequirements}
        onTravelerRequirementsChange={readOnly ? undefined : setTravelerRequirements}
      />
    </div>
  );
}
