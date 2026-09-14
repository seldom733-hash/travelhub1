"use client";

import { useEffect, useState, useCallback } from "react";
import { useLocale } from "@/lib/i18n";
import { pt } from "@/lib/partner-i18n";
import { partnerApi, type ActiveCategory } from "@/lib/partner-api";
import { publicApi, type PublicCategory } from "@/lib/public-api";

/**
 * Partner Cabinet — Категории услуг (Active Service Categories).
 *
 * Партнёр видит активные категории и может:
 * - добавить (из Master Catalog);
 * - убрать (soft delete, продукты сохраняются);
 * - сохранить (автоматически при каждом действии).
 *
 * Backend enforcement: createProduct проверяет isActiveCategory(partnerId, categoryId).
 */
export default function PartnerCategoriesPage() {
  const locale = useLocale();
  const [activeCategories, setActiveCategories] = useState<ActiveCategory[]>([]);
  const [allCategories, setAllCategories] = useState<PublicCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{ id: string; title: string; hasProducts: boolean } | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [active, all] = await Promise.all([
        partnerApi.listActiveCategories(),
        publicApi.listCategories(),
      ]);
      setActiveCategories(active);
      setAllCategories(all);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeIds = new Set(activeCategories.map((ac) => ac.categoryId));
  const availableCategories = allCategories.filter((c) => !activeIds.has(c.id));

  const handleAdd = async (categoryId: string) => {
    setAdding(true);
    setError("");
    setSuccess("");
    try {
      await partnerApi.addActiveCategory(categoryId);
      setSuccess(pt("partner.categories.add", locale));
      await loadData();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async () => {
    if (!confirmRemove) return;
    setRemovingId(confirmRemove.id);
    setError("");
    setSuccess("");
    try {
      await partnerApi.removeActiveCategory(confirmRemove.id);
      setSuccess(pt("partner.categories.remove", locale));
      await loadData();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRemovingId(null);
      setConfirmRemove(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5">
        <a href="/partner" className="text-sm text-slate-500 hover:text-emerald-700">
          {pt("partner.product.back", locale)}
        </a>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">{pt("partner.categories.title", locale)}</h1>
        <p className="mt-1 text-sm text-slate-500">{pt("partner.categories.description", locale)}</p>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

      {loading ? (
        <div className="py-12 text-center text-sm text-slate-400">…</div>
      ) : (
        <>
          {/* Active Categories */}
          <div className="mb-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              {pt("partner.categories.title", locale)}
              <span className="ml-2 text-emerald-600">
                ({activeCategories.length})
              </span>
            </h2>

            {activeCategories.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                {pt("partner.categories.empty", locale)}
              </div>
            ) : (
              <div className="space-y-2">
                {activeCategories.map((ac) => (
                  <div
                    key={ac.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3"
                  >
                    <div>
                      <div className="font-medium text-slate-900">{ac.category.title}</div>
                      <div className="text-xs text-slate-400">/{ac.category.slug}</div>
                    </div>
                    <button
                      onClick={() =>
                        setConfirmRemove({
                          id: ac.categoryId,
                          title: ac.category.title,
                          hasProducts: false,
                        })
                      }
                      disabled={removingId === ac.categoryId}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                    >
                      {pt("partner.categories.remove", locale)}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Available Categories to Add */}
          {availableCategories.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                {pt("partner.categories.all_categories", locale)}
              </h2>
              <div className="space-y-2">
                {availableCategories.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3"
                  >
                    <div>
                      <div className="font-medium text-slate-900">{cat.title}</div>
                      <div className="text-xs text-slate-400">/{cat.slug}</div>
                    </div>
                    <button
                      onClick={() => handleAdd(cat.id)}
                      disabled={adding}
                      className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-50 disabled:opacity-50"
                    >
                      {pt("partner.categories.add", locale)}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Confirmation Dialog */}
      {confirmRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">{pt("partner.categories.remove", locale)}</h3>
            <p className="mt-2 text-sm text-slate-600">{pt("partner.categories.remove_warning", locale)}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setConfirmRemove(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                {pt("partner.categories.remove_cancel", locale)}
              </button>
              <button
                onClick={handleRemove}
                disabled={removingId !== null}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {pt("partner.categories.remove_confirm", locale)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
