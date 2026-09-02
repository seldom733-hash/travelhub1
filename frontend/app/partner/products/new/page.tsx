"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n";
import { pt } from "@/lib/partner-i18n";
import { partnerApi, type PartnerSchemaContract } from "@/lib/partner-api";
import ProductEditorForm, { type ProductEditorValues } from "@/components/partner/ProductEditorForm";
import { newTariffDraft, tariffDraftsToPayload } from "@/components/partner/TariffList";
import type { PublicCategory } from "@/lib/public-api";

/** Приблизительное соответствие категории → ProductType (backend type независим от категории). */
const CATEGORY_TYPE: Record<string, string> = {
  accommodation: "HOTEL",
  sanatoriums: "SANATORIUM",
  flights: "FLIGHT",
  rail: "TRAIN",
  excursions: "EXCURSION",
  guides: "GUIDE",
  transfers: "TRANSFER",
  "car-rental": "TRANSFER",
};

const initialValues = (): ProductEditorValues => ({
  title: "",
  description: "",
  attributes: {},
  tariffs: [newTariffDraft()],
});

/**
 * PHASE 1 STEP 1.8 §7 — Create Product (/partner/products/new).
 * Dynamic Category Schema form строится ТОЛЬКО через Partner-safe contract
 * GET /api/v1/partner/categories/:slug/schema (НЕ internal /category-schemas).
 * Ownership назначает backend из actor context (frontend не отправляет partnerId).
 */
export default function NewProductPage() {
  const router = useRouter();
  const locale = useLocale();
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [schema, setSchema] = useState<PartnerSchemaContract | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [values, setValues] = useState<ProductEditorValues>(initialValues);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [initialNote, setInitialNote] = useState("");
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

  const selectCategory = (id: string) => {
    setCategoryId(id);
    setSchema(null);
    setValues((v) => ({ ...v, attributes: {} }));
    if (!id) return;
    const cat = categories.find((c) => c.id === id);
    if (!cat) return;
    setSchemaLoading(true);
    partnerApi
      .schemaForCategory(cat.slug)
      .then((s) => setSchema(s))
      .catch(() => setSchema(null))
      .finally(() => setSchemaLoading(false));
  };

  const submit = async () => {
    if (!values.title.trim() || !categoryId) return;
    setSubmitting(true);
    setError("");
    try {
      const cat = categories.find((c) => c.id === categoryId);
      const res = await partnerApi.createProduct({
        type: CATEGORY_TYPE[cat?.slug ?? ""] ?? "TOUR",
        title: values.title.trim(),
        description: values.description.trim() || undefined,
        categoryId,
        attributes: values.attributes,
        tariffs: tariffDraftsToPayload(values.tariffs),
        initialNote: initialNote.trim() || undefined,
        travelerRequirements,
      });
      router.push(`/partner/products/${res.product.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5">
        <a href="/partner/products" className="text-sm text-slate-500 hover:text-emerald-700">
          {pt("partner.product.back", locale)}
        </a>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">{pt("partner.products.new", locale)}</h1>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <ProductEditorForm
        categories={categories}
        categoryId={categoryId}
        onSelectCategory={selectCategory}
        schema={schema}
        schemaLoading={schemaLoading}
        values={values}
        onChange={setValues}
        onSubmit={submit}
        submitting={submitting}
        submitLabel={pt("partner.form.save", locale)}
        mediaCount={0}
        productType={categoryId ? (CATEGORY_TYPE[categories.find((c) => c.id === categoryId)?.slug ?? ""] ?? "TOUR") : "TOUR"}
        travelerRequirements={travelerRequirements}
        onTravelerRequirementsChange={setTravelerRequirements}
      />

      {/* Примечание */}
      <div className="mt-4">
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">{pt("notes.initial_note", locale)}</label>
        <textarea
          value={initialNote}
          onChange={(e) => setInitialNote(e.target.value)}
          rows={3}
          maxLength={5000}
          aria-label={pt("notes.initial_note", locale)}
          className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          placeholder={pt("notes.initial_note_helper", locale)}
        />
        <div className="mt-1 text-right text-xs text-slate-400">
          {initialNote.length}/5000 {pt("notes.initial_note_max", locale)}
        </div>
      </div>
    </div>
  );
}
