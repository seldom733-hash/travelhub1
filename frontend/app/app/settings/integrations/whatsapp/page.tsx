"use client";

import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { api } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { useLocale, t, type Locale } from "@/lib/i18n";
import { fetchWhatsAppSessions, type WhatsAppSessionAccount } from "@/lib/whatsapp";

/**
 * Настройки → Интеграции → WhatsApp (ADR M0-02 §Frontend).
 *
 * Подключение реального WhatsApp-аккаунта компании: статус сессии (polling),
 * QR-код (polling 3 c, рендер на клиенте), явный номер подключённого аккаунта.
 * Скрытая часть UI — по useCan/серверу: qr/connect/disconnect требуют
 * whatsapp.session.admin (403 отдаёт бэкенд).
 *
 * M5 multi-number: секция «Номера» — список всех номеров (GET /whatsapp/sessions),
 * добавление нового, connect/disconnect/archive per-id; QR конкретного номера
 * опрашивается только в состоянии QR_REQUIRED. Архивация подтверждается и
 * сохраняет историю диалогов (бэкенд: POST /whatsapp/sessions/:id/archive).
 */

type SessionState =
  | "INITIALIZING"
  | "CONNECTING"
  | "QR_REQUIRED"
  | "CONNECTED"
  | "RECONNECTING"
  | "DISCONNECTED"
  | "ERROR"
  | string;

interface WhatsAppStatus {
  enabled: boolean;
  provider: string;
  state: SessionState;
  phone: string | null;
  connectedAt: string | null;
  lastDisconnectedAt: string | null;
  lastError: string | null;
  instanceId: string;
  hasQr: boolean;
  autoConnect: boolean;
}

const STATE_BADGE: Record<string, string> = {
  CONNECTED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  QR_REQUIRED: "border-amber-200 bg-amber-50 text-amber-700",
  CONNECTING: "border-blue-200 bg-blue-50 text-blue-700",
  INITIALIZING: "border-blue-200 bg-blue-50 text-blue-700",
  RECONNECTING: "border-amber-200 bg-amber-50 text-amber-700",
  DISCONNECTED: "border-slate-200 bg-slate-50 text-slate-600",
  LOGGED_OUT: "border-red-200 bg-red-50 text-red-700",
  ERROR: "border-red-200 bg-red-50 text-red-700",
};

function errMessage(err: unknown, locale: Locale): string {
  if (err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  return t("wa_int.status_error", locale);
}

function fmtDateTime(iso: string | null, locale: Locale): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(locale === "az" ? "az-AZ" : locale === "en" ? "en-GB" : "ru-RU", {
      dateStyle: "medium",
      timeStyle: "medium",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function WhatsAppIntegrationPage() {
  const locale = useLocale();
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"connect" | "disconnect" | null>(null);

  // M5: список номеров + действия по конкретному номеру.
  const [sessions, setSessions] = useState<WhatsAppSessionAccount[]>([]);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [sessionBusy, setSessionBusy] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);
  const [qrSessionId, setQrSessionId] = useState<string | null>(null);
  const [sessionQr, setSessionQr] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const s = await api.get<WhatsAppStatus>("/whatsapp/status");
      setStatus(s);
      setError(null);
    } catch (err) {
      setError(errMessage(err, locale));
    }
  }, [locale]);

  const loadSessions = useCallback(async () => {
    try {
      setSessions(await fetchWhatsAppSessions());
      setSessionsError(null);
    } catch (err) {
      setSessionsError(errMessage(err, locale));
    }
  }, [locale]);

  useEffect(() => {
    void loadStatus();
    void loadSessions();
    const id = setInterval(() => {
      void loadStatus();
      void loadSessions();
    }, 2500);
    return () => clearInterval(id);
  }, [loadStatus, loadSessions]);

  // QR опрашиваем только в состоянии, где он может быть (rate-limit 10/10 c).
  const qrLive = status?.state === "QR_REQUIRED" || (status?.state === "CONNECTING" && !!status?.hasQr);
  useEffect(() => {
    if (!qrLive) {
      setQr(null);
      return;
    }
    let stopped = false;
    const loadQr = async () => {
      try {
        const r = await api.get<{ qr: string | null }>("/whatsapp/qr");
        if (!stopped && r.qr) setQr(r.qr);
      } catch {
        /* 429 rate-limit / нет QR — ждём следующий цикл */
      }
    };
    void loadQr();
    const id = setInterval(() => void loadQr(), 3000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [qrLive]);

  async function act(kind: "connect" | "disconnect") {
    setBusy(kind);
    setError(null);
    try {
      await api.post(`/whatsapp/${kind}`, { confirm: true });
      setQr(null);
      await loadStatus();
    } catch (err) {
      setError(errMessage(err, locale));
    } finally {
      setBusy(null);
    }
  }

  // ── M5: действия по конкретному номеру ────────────────────────────────────

  const qrSession = sessions.find((s) => s.id === qrSessionId) ?? null;
  const sessionQrLive =
    qrSessionId !== null &&
    (qrSession?.status.state === "QR_REQUIRED" ||
      (qrSession?.status.state === "CONNECTING" && qrSession?.status.hasQr === true));

  // QR конкретного номера: polling только в состоянии, где он может быть.
  useEffect(() => {
    if (!sessionQrLive || !qrSessionId) {
      setSessionQr(null);
      return;
    }
    let stopped = false;
    const loadQr = async () => {
      try {
        const r = await api.get<{ qr: string | null }>(`/whatsapp/sessions/${qrSessionId}/qr`);
        if (!stopped && r.qr) setSessionQr(r.qr);
      } catch {
        /* 429 rate-limit / нет QR — ждём следующий цикл */
      }
    };
    void loadQr();
    const id = setInterval(() => void loadQr(), 3000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [sessionQrLive, qrSessionId]);

  async function actSession(id: string, kind: "connect" | "disconnect") {
    setSessionBusy(`${id}:${kind}`);
    setError(null);
    try {
      await api.post(`/whatsapp/sessions/${id}/${kind}`, { confirm: true });
      if (kind === "connect") {
        setQrSessionId(id);
        setSessionQr(null);
      } else if (qrSessionId === id) {
        setQrSessionId(null);
      }
      await loadSessions();
      await loadStatus();
    } catch (err) {
      setError(errMessage(err, locale));
    } finally {
      setSessionBusy(null);
    }
  }

  async function archiveSession(id: string) {
    if (!window.confirm(t("wa_int.sessions.archive_confirm", locale))) return;
    setSessionBusy(`${id}:archive`);
    setError(null);
    try {
      await api.post(`/whatsapp/sessions/${id}/archive`, { confirm: true });
      if (qrSessionId === id) setQrSessionId(null);
      await loadSessions();
      await loadStatus();
    } catch (err) {
      setError(errMessage(err, locale));
    } finally {
      setSessionBusy(null);
    }
  }

  async function createSession() {
    setCreateBusy(true);
    setError(null);
    try {
      await api.post("/whatsapp/sessions", { label: newLabel });
      setNewLabel("");
      await loadSessions();
    } catch (err) {
      setError(errMessage(err, locale));
    } finally {
      setCreateBusy(false);
    }
  }

  const state = status?.state ?? "…";
  const badge = STATE_BADGE[state] ?? STATE_BADGE.DISCONNECTED;
  const connected = state === "CONNECTED" && !!status?.phone;

  return (
    <div className="space-y-4 px-6 py-4">
      <PageHeader
        title={t("wa_int.title", locale)}
        breadcrumbs={[
          t("wa_int.breadcrumb.settings", locale),
          t("wa_int.breadcrumb.integrations", locale),
          t("wa_int.title", locale),
        ]}
        actions={
          <a
            href="/app/whatsapp"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            {t("wa_int.inbox_link", locale)}
          </a>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="text-slate-500">
            {t("wa_int.provider", locale)}:{" "}
            <span className="font-semibold text-slate-800" data-testid="wa-provider">
              {status?.provider ?? "…"}
            </span>
          </span>
          <span className="text-slate-500">
            {t("wa_int.state", locale)}:{" "}
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${badge}`} data-testid="wa-state">
              {t(`wa_int.state.${state}`, locale) === `wa_int.state.${state}` ? state : t(`wa_int.state.${state}`, locale)}
            </span>
          </span>
          {status?.instanceId && <span className="text-xs text-slate-400">{status.instanceId}</span>}
        </div>

        {/* ── Явный номер подключённого аккаунта ───────────────────────── */}
        <div
          data-testid="connected-account"
          className={`mt-4 rounded-lg border px-4 py-3 ${
            connected ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-slate-50"
          }`}
        >
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {t("wa_int.connected_account", locale)}
          </div>
          {connected ? (
            <>
              <div className="mt-1 text-2xl font-bold text-emerald-700" dir="ltr" data-testid="connected-phone">
                {status?.phone}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {t("wa_int.connected_since", locale)}: {fmtDateTime(status?.connectedAt ?? null, locale)}
              </div>
            </>
          ) : (
            <div className="mt-1 text-sm text-slate-500">{t("wa_int.not_connected", locale)}</div>
          )}
        </div>

        {status?.lastError && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {t("wa_int.last_error", locale)}: {status.lastError}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void act("connect")}
            disabled={busy !== null || connected || state === "CONNECTING" || state === "INITIALIZING"}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            data-testid="btn-connect"
          >
            {t("wa_int.connect", locale)}
          </button>
          <button
            type="button"
            onClick={() => void act("disconnect")}
            disabled={busy !== null || (!connected && state !== "QR_REQUIRED" && state !== "CONNECTING")}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            data-testid="btn-disconnect"
          >
            {t("wa_int.disconnect", locale)}
          </button>
        </div>
      </div>

      {/* ── QR-блок ─────────────────────────────────────────────────────── */}
      {qrLive && (
        <div className="rounded-xl border border-slate-200 bg-white p-5" data-testid="qr-block">
          <div className="text-base font-bold text-slate-900">{t("wa_int.qr_title", locale)}</div>
          <p className="mt-1 text-sm text-slate-500">{t("wa_int.qr_hint", locale)}</p>
          <div className="mt-4 flex justify-center rounded-lg border border-slate-100 bg-white p-4">
            {qr ? (
              <QRCodeSVG value={qr} size={264} level="M" data-testid="qr-code" />
            ) : (
              <div className="flex h-[264px] w-[264px] items-center justify-center text-sm text-slate-400">
                {t("wa_int.connecting_wait", locale)}
              </div>
            )}
          </div>
          <div className="mt-3 text-center text-xs text-slate-400">{t("wa_int.qr_refresh", locale)}</div>
        </div>
      )}

      {/* ── M5: все номера (multi-number) ────────────────────────────────── */}
      {status?.enabled && (
        <div className="rounded-xl border border-slate-200 bg-white p-5" data-testid="sessions-block">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-base font-bold text-slate-900">{t("wa_int.sessions.title", locale)}</div>
              <p className="mt-1 max-w-xl text-sm text-slate-500">{t("wa_int.sessions.hint", locale)}</p>
              <p className="mt-1 text-xs text-slate-400">{t("wa_int.sessions.primary_hint", locale)}</p>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                maxLength={64}
                placeholder={t("wa_int.sessions.label_placeholder", locale)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-800 placeholder:text-slate-400"
                data-testid="session-label-input"
              />
              <button
                type="button"
                onClick={() => void createSession()}
                disabled={createBusy}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                data-testid="btn-add-session"
              >
                {t("wa_int.sessions.add", locale)}
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {sessions.length === 0 ? (
              <p className="py-2 text-sm text-slate-400" data-testid="sessions-empty">
                {t("wa_int.sessions.empty", locale)}
              </p>
            ) : (
              sessions.map((s) => {
                const archived = s.archivedAt !== null;
                const state = s.status.state;
                const badge = STATE_BADGE[state] ?? STATE_BADGE.DISCONNECTED;
                const busyKey = sessionBusy?.startsWith(`${s.id}:`) === true;
                const connecting = state === "CONNECTING" || state === "INITIALIZING";
                return (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
                    data-testid={`session-row-${s.id}`}
                  >
                    <div className="min-w-[180px] flex-1">
                      <div className="text-sm font-semibold text-slate-800">
                        {s.label ?? s.id.slice(0, 8)}
                        {state === "CONNECTED" && s.phone && (
                          <span className="ml-2 font-mono text-xs font-normal text-emerald-700" dir="ltr">
                            {s.phone}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">{s.id}</div>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${badge}`}
                      data-testid={`session-state-${s.id}`}
                    >
                      {t(`wa_int.state.${state}`, locale) === `wa_int.state.${state}`
                        ? state
                        : t(`wa_int.state.${state}`, locale)}
                    </span>
                    {archived && (
                      <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">
                        {t("wa_int.sessions.archived", locale)}
                      </span>
                    )}
                    {!archived && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void actSession(s.id, "connect")}
                          disabled={busyKey || state === "CONNECTED" || connecting}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                          data-testid={`btn-session-connect-${s.id}`}
                        >
                          {t("wa_int.connect", locale)}
                        </button>
                        <button
                          type="button"
                          onClick={() => void actSession(s.id, "disconnect")}
                          disabled={busyKey || (state !== "CONNECTED" && state !== "QR_REQUIRED" && !connecting)}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                          data-testid={`btn-session-disconnect-${s.id}`}
                        >
                          {t("wa_int.disconnect", locale)}
                        </button>
                        <button
                          type="button"
                          onClick={() => void archiveSession(s.id)}
                          disabled={busyKey}
                          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
                          data-testid={`btn-session-archive-${s.id}`}
                        >
                          {t("wa_int.sessions.archive", locale)}
                        </button>
                      </div>
                    )}
                    {qrSessionId === s.id && !archived && (
                      <button
                        type="button"
                        onClick={() => setQrSessionId(null)}
                        className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-50"
                      >
                        ✕ QR
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* QR конкретного номера (polling 3 c, rate-limit 10/10 c) */}
          {sessionQrLive && qrSessionId && (
            <div className="mt-4 rounded-lg border border-slate-100 bg-white p-4" data-testid="session-qr-block">
              <div className="text-sm font-bold text-slate-900">{t("wa_int.qr_title", locale)}</div>
              <p className="mt-1 text-xs text-slate-500">{t("wa_int.qr_hint", locale)}</p>
              <div className="mt-3 flex justify-center">
                {sessionQr ? (
                  <QRCodeSVG value={sessionQr} size={224} level="M" data-testid="session-qr-code" />
                ) : (
                  <div className="flex h-[224px] w-[224px] items-center justify-center text-sm text-slate-400">
                    {t("wa_int.connecting_wait", locale)}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
