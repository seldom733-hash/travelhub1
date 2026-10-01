"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  tourBuilderApi,
  type BuilderComponent,
  type DictionariesResponse,
  type DictionaryEntry,
} from "@/lib/tour-builder-api";

/**
 * «Мои типы номеров» — чеклист из справочника (ACTIVE + PENDING-бейджи)
 * + кнопка «+ свой тип» → модалка с live-похожими → POST PENDING.
 *
 * Связь «тип ↔ юнит»: ServiceUnit.attributes.payload.roomTypeId = RoomType.id.
 * PENDING-тип в чеклисте заблокирован до APPROVED модератором.
 */

/* Справочник показываем только на английском (en → code), без переводов. */
const entryName = (e: DictionaryEntry): string => e.names?.en || e.code;

export default function RoomTypesChecklist({
  dictionaries,
  components,
  busy,
  onToggle,
  onProposed,
  onError,
  onNotice,
}: {
  dictionaries: DictionariesResponse | null;
  components: BuilderComponent[];
  busy?: boolean;
  onToggle: (entry: DictionaryEntry, checked: boolean) => void;
  onProposed: () => Promise<void>;
  onError: (msg: string) => void;
  onNotice: (msg: string) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [similar, setSimilar] = useState<Array<{ id: string; code: string; names: Record<string, string>; score: number }>>([]);
  const [exactHit, setExactHit] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkedIds = new Set(
    components
      .map((c) => c.payload.roomTypeId)
      .filter((v): v is string => typeof v === "string"),
  );

  /* Live-похожие (debounce 300мс). */
  useEffect(() => {
    if (!modalOpen) return;
    const q = name.trim();
    if (q.length < 2) {
      setSimilar([]);
      setExactHit(null);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      tourBuilderApi
        .getSimilarDictionaryEntries("room-types", q)
        .then((r) => {
          const cands = r.candidates ?? [];
          setSimilar(cands);
          const exact = cands.find((c) => c.score >= 0.99);
          setExactHit(exact ? (exact.names?.en || exact.code) : null);
        })
        .catch(() => {});
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [name, modalOpen]);

  const submit = useCallback(async () => {
    const q = name.trim();
    if (q.length < 2 || exactHit) return;
    setSubmitting(true);
    try {
      await tourBuilderApi.proposeDictionaryEntry({ type: "room-types", name: q, lang: "en" });
      setModalOpen(false);
      setName("");
      setSimilar([]);
      onNotice(`«${q}» отправлено на модерацию — бейдж «на модерации» появится в чеклисте`);
      await onProposed();
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }, [name, exactHit, onNotice, onError, onProposed]);

  const active = dictionaries?.roomTypes ?? [];
  const pending = dictionaries?.pendingRoomTypes ?? [];

  return (
    <div className="rounded border border-neutral-800 bg-neutral-900/40">
      <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-2.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-neutral-400">
          Типы номеров (справочник)
        </h3>
        <button
          onClick={() => setModalOpen(true)}
          className="rounded border border-neutral-700 px-2.5 py-1 text-xs text-amber-300 transition-colors hover:border-amber-500/60 hover:text-amber-200"
        >
          + свой тип
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 p-3">
        {active.map((e) => {
          const checked = checkedIds.has(e.id);
          return (
            <button
              key={e.id}
              disabled={busy}
              onClick={() => onToggle(e, !checked)}
              className={`rounded-sm border px-2.5 py-1 text-xs transition-colors ${
                checked
                  ? "border-amber-500/60 bg-amber-500/10 text-amber-200"
                  : "border-neutral-700 text-neutral-300 hover:border-neutral-500"
              }`}
              title={checked ? "Тип подключён к пакету — нажмите, чтобы убрать" : "Подключить тип к пакету"}
            >
              {checked && <span className="mr-1 text-amber-400">✓</span>}
              {entryName(e)}
            </button>
          );
        })}

        {pending.map((e) => (
          <span
            key={e.id}
            className="cursor-not-allowed rounded-sm border border-dashed border-amber-700/70 px-2.5 py-1 text-xs text-amber-500"
            title="Тип на модерации — станет доступен после APPROVED"
          >
            {entryName(e)}
            <span className="ml-1.5 rounded-sm bg-amber-900/50 px-1 py-px text-[10px] uppercase">на модерации</span>
          </span>
        ))}

        {!active.length && !pending.length && (
          <span className="text-xs text-neutral-500">Справочник не загружен…</span>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => !submitting && setModalOpen(false)}>
          <div
            className="w-full max-w-md rounded border border-neutral-800 bg-neutral-950 p-4"
            onClick={(ev) => ev.stopPropagation()}
          >
            <h4 className="text-sm font-semibold text-white">Предложить новый тип номера</h4>
            <p className="mt-1 text-xs leading-relaxed text-neutral-500">
              Запись уйдёт в очередь модерации со статусом PENDING и включится в чеклист после одобрения.
            </p>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void submit()}
              placeholder="напр.: Panorama Suite"
              className="mt-3 w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-amber-500/60"
            />

            {similar.length > 0 && (
              <div className="mt-2 rounded border border-neutral-800 bg-neutral-900/60 p-2">
                <div className="mb-1 text-[11px] uppercase tracking-wide text-neutral-500">Похожие записи:</div>
                <ul className="space-y-0.5 text-xs text-neutral-300">
                  {similar.map((c) => (
                    <li key={c.id} className="flex items-center justify-between">
                      <span>{c.names?.en || c.code}</span>
                      <span className="font-mono text-[10px] text-neutral-500">{c.code} · score {c.score}</span>
                    </li>
                  ))}
                </ul>
                {exactHit && (
                  <p className="mt-1.5 text-xs text-red-300">
                    Точное совпадение уже есть: «{exactHit}» — используйте существующую запись.
                  </p>
                )}
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setModalOpen(false)}
                disabled={submitting}
                className="rounded border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:border-neutral-500"
              >
                Отмена
              </button>
              <button
                onClick={() => void submit()}
                disabled={submitting || name.trim().length < 2 || !!exactHit}
                className="rounded bg-amber-500/90 px-3 py-1.5 text-xs font-semibold text-neutral-950 transition-colors hover:bg-amber-400 disabled:opacity-40"
              >
                {submitting ? "Отправка…" : "Отправить на модерацию"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
