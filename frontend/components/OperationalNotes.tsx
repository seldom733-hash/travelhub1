"use client";

import { useCallback, useEffect, useState } from "react";
import {
  operationalNotesApi,
  type OperationalNote,
  type OperationalNotesPage,
} from "@/lib/api";
import { useLocale, t } from "@/lib/i18n";

interface OperationalNotesProps {
  entityType: string;
  entityId: string;
  /** Current user's permissions (from auth context) */
  permissions: string[];
  /** Current user's ID for ownership checks */
  currentUserId: string;
  /** Current user's role for ADMIN override */
  currentRole: string;
}

/**
 * Shared Operational Notes component.
 * Provides list, create, edit, delete with RBAC-aware actions,
 * pagination, loading/empty/error/forbidden states.
 *
 * Bound to: entityType + entityId (exact, never display code).
 */
export default function OperationalNotes({
  entityType,
  entityId,
  permissions,
  currentUserId,
  currentRole,
}: OperationalNotesProps) {
  const locale = useLocale();

  const canRead = permissions.includes("operational-notes.read");
  const canCreate = permissions.includes("operational-notes.create");
  const canUpdate = permissions.includes("operational-notes.update");
  const canDelete = permissions.includes("operational-notes.delete");
  const isAdmin = currentRole === "ADMIN";

  // State
  const [pageData, setPageData] = useState<OperationalNotesPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [forbidden, setForbidden] = useState(false);

  // Create state
  const [newText, setNewText] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  // ── Load notes ──
  const loadNotes = useCallback(async () => {
    if (!canRead) {
      setForbidden(true);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError("");
      setForbidden(false);
      const data = await operationalNotesApi.list(entityType, entityId, currentPage, PAGE_SIZE);
      setPageData(data);
    } catch (e: any) {
      if (e.message?.includes("403") || e.message?.includes("Missing permission")) {
        setForbidden(true);
      } else {
        setError(e.message || t("notes.load_error", locale));
      }
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, currentPage, canRead, locale]);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  // ── Create ──
  const handleCreate = async () => {
    const trimmed = newText.trim();
    if (!trimmed) {
      setCreateError(t("notes.validation_empty", locale));
      return;
    }
    if (trimmed.length > 5000) {
      setCreateError(t("notes.validation_max", locale));
      return;
    }
    try {
      setCreating(true);
      setCreateError("");
      await operationalNotesApi.create(entityType, entityId, trimmed);
      setNewText("");
      setCurrentPage(1);
      await loadNotes();
    } catch (e: any) {
      setCreateError(e.message || t("notes.create_error", locale));
    } finally {
      setCreating(false);
    }
  };

  // ── Edit ──
  const startEdit = (note: OperationalNote) => {
    setEditingId(note.id);
    setEditText(note.text);
    setEditError("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
    setEditError("");
  };

  const handleSave = async (noteId: string) => {
    const trimmed = editText.trim();
    if (!trimmed) {
      setEditError(t("notes.validation_empty", locale));
      return;
    }
    if (trimmed.length > 5000) {
      setEditError(t("notes.validation_max", locale));
      return;
    }
    try {
      setSaving(true);
      setEditError("");
      await operationalNotesApi.update(noteId, trimmed);
      setEditingId(null);
      setEditText("");
      await loadNotes();
    } catch (e: any) {
      setEditError(e.message || t("notes.edit_error", locale));
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──
  const handleDelete = async (noteId: string) => {
    try {
      setDeletingId(noteId);
      await operationalNotesApi.delete(noteId);
      setConfirmDeleteId(null);
      await loadNotes();
    } catch (e: any) {
      // Keep note visible on failure
      setConfirmDeleteId(null);
    } finally {
      setDeletingId(null);
    }
  };

  // ── Ownership check ──
  const isOwner = (note: OperationalNote) => note.authorUserId === currentUserId;
  const canEditNote = (note: OperationalNote) => canUpdate && (isOwner(note) || isAdmin);
  const canDeleteNote = (note: OperationalNote) => canDelete && (isOwner(note) || isAdmin);

  // ── Date formatting ──
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(locale === "ru" ? "ru-RU" : locale === "az" ? "az-AZ" : "en-US", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // ── Render ──

  // Forbidden state
  if (forbidden) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="text-center text-sm text-slate-400">
          <div className="mb-2 text-lg">🔒</div>
          {t("notes.forbidden", locale)}
        </div>
      </div>
    );
  }

  // Loading state
  if (loading && !pageData) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-center py-8">
          <div className="text-sm text-slate-400">{t("state.loading", locale)}</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !pageData) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="text-center">
          <div className="mb-2 text-sm text-red-500">{error}</div>
          <button
            onClick={() => void loadNotes()}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            {t("notes.retry", locale)}
          </button>
        </div>
      </div>
    );
  }

  const notes = pageData?.notes ?? [];
  const totalPages = pageData?.totalPages ?? 0;
  const total = pageData?.total ?? 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      {/* Header */}
      <div className="border-b border-slate-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-700">
          {t("notes.title", locale)}
          {total > 0 && <span className="ml-2 text-xs font-normal text-slate-400">({total})</span>}
        </h3>
      </div>

      {/* Create form */}
      {canCreate && (
        <div className="border-b border-slate-100 px-4 py-3">
          <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor={`note-create-${entityType}-${entityId}`}>
            {t("notes.add_placeholder", locale)}
          </label>
          <textarea
            id={`note-create-${entityType}-${entityId}`}
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            maxLength={5000}
            rows={3}
            className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition-colors focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            placeholder={t("notes.add_placeholder", locale)}
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {newText.length}/5000
            </span>
            <div className="flex gap-2">
              {newText.trim() && (
                <button
                  onClick={() => { setNewText(""); setCreateError(""); }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50"
                >
                  {t("notes.cancel", locale)}
                </button>
              )}
              <button
                onClick={() => void handleCreate()}
                disabled={creating || !newText.trim()}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? t("notes.creating", locale) : t("notes.add", locale)}
              </button>
            </div>
          </div>
          {createError && <div className="mt-2 text-xs text-red-500">{createError}</div>}
        </div>
      )}

      {/* Notes list */}
      <div className="divide-y divide-slate-50">
        {notes.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-400">
            {t("notes.empty", locale)}
          </div>
        ) : (
          notes.map((note) => (
            <div key={note.id} className="px-4 py-3">
              {editingId === note.id ? (
                /* Edit mode */
                <div>
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    maxLength={5000}
                    rows={3}
                    className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                  />
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-slate-400">{editText.length}/5000</span>
                    <div className="flex gap-2">
                      <button
                        onClick={cancelEdit}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50"
                      >
                        {t("notes.cancel", locale)}
                      </button>
                      <button
                        onClick={() => void handleSave(note.id)}
                        disabled={saving}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {saving ? t("notes.saving", locale) : t("notes.save", locale)}
                      </button>
                    </div>
                  </div>
                  {editError && <div className="mt-2 text-xs text-red-500">{editError}</div>}
                </div>
              ) : (
                /* Read mode */
                <div>
                  {/* Author + timestamps */}
                  <div className="mb-1 flex items-center gap-2 text-xs text-slate-400">
                    <span className="font-medium text-slate-600">
                      {note.authorName || t("notes.unknown_author", locale)}
                    </span>
                    <span>·</span>
                    <span>{t("notes.created", locale)} {formatDate(note.createdAt)}</span>
                    {note.editedAt && (
                      <>
                        <span>·</span>
                        <span className="italic">{t("notes.edited", locale)} {formatDate(note.editedAt)}</span>
                      </>
                    )}
                  </div>

                  {/* Note text — plain text, XSS-safe */}
                  <div className="whitespace-pre-wrap text-sm text-slate-700">
                    {note.text}
                  </div>

                  {/* Actions */}
                  {(canEditNote(note) || canDeleteNote(note)) && (
                    <div className="mt-2 flex gap-2">
                      {canEditNote(note) && (
                        <button
                          onClick={() => startEdit(note)}
                          className="text-xs text-slate-400 hover:text-blue-600"
                        >
                          {t("notes.edit", locale)}
                        </button>
                      )}
                      {canDeleteNote(note) && (
                        <>
                          {confirmDeleteId === note.id ? (
                            <span className="flex items-center gap-2">
                              <span className="text-xs text-red-500">{t("notes.delete_confirm", locale)}</span>
                              <button
                                onClick={() => void handleDelete(note.id)}
                                disabled={deletingId === note.id}
                                className="rounded bg-red-600 px-2 py-0.5 text-xs text-white hover:bg-red-700 disabled:opacity-50"
                              >
                                {deletingId === note.id ? "…" : t("notes.delete_yes", locale)}
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="text-xs text-slate-400 hover:text-slate-600"
                              >
                                {t("notes.cancel", locale)}
                              </button>
                            </span>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(note.id)}
                              className="text-xs text-slate-400 hover:text-red-600"
                            >
                              {t("notes.delete", locale)}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
          <span className="text-xs text-slate-400">
            {t("pagination.page", locale)} {currentPage} {t("pagination.of", locale)} {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="rounded border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              {t("pagination.prev", locale)}
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="rounded border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              {t("pagination.next", locale)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
