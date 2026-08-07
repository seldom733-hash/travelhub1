"use client";

import { useState } from "react";

interface ErrorReportFormProps {
  digest?: string;
  dark?: boolean;
}

type SendStatus = "idle" | "sending" | "sent" | "error";

/**
 * Форма «Сообщить об ошибке» для страницы 500.
 * Показывает digest ошибки (readonly) и поле описания, отправляет на POST /api/error-report.
 * Тёмный вариант для админки — через CSS-переменные --admin-*, inline-стили для global-error.
 */
export default function ErrorReportForm({ digest, dark = false }: ErrorReportFormProps) {
  const [status, setStatus] = useState<SendStatus>("idle");
  const [description, setDescription] = useState("");

  const muted = dark ? "var(--admin-muted)" : "#6b7280";
  const text = dark ? "var(--admin-text)" : "#0f172a";
  const border = dark ? "1px solid var(--admin-border)" : "1px solid #e5e7eb";
  const success = dark ? "var(--admin-text)" : "#16a34a";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    try {
      const res = await fetch("/api/error-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          digest: digest ?? "",
          description: description.trim().slice(0, 4000),
          url: typeof window !== "undefined" ? window.location.href : "",
        }),
      });
      setStatus(res.ok ? "sent" : "error");
      if (res.ok) setDescription("");
    } catch {
      setStatus("error");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6 text-left" style={{ borderTop: border, paddingTop: "1.25rem" }}>
      <p className="text-xs font-semibold mb-1" style={{ color: text }}>
        Сообщить об ошибке
      </p>
      <p className="text-[11px] mb-2.5" style={{ color: muted }}>
        Помогите нам исправить проблему — опишите, что пошло не так.
      </p>

      {digest && (
        <div className="flex items-center gap-2 mb-2.5">
          <span className="text-[11px]" style={{ color: muted }}>
            Код ошибки:
          </span>
          <code
            className="text-[11px] font-mono px-1.5 py-0.5 rounded"
            style={{
              background: dark ? "rgba(148,163,184,0.15)" : "#f1f5f9",
              color: muted,
            }}
          >
            {digest}
          </code>
        </div>
      )}

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        maxLength={4000}
        placeholder="Например: «Нажал кнопку „Забронировать“, страница зависла…»"
        className="w-full resize-none text-sm"
        style={{
          width: "100%",
          resize: "none",
          borderRadius: "0.75rem",
          padding: "0.5rem 0.75rem",
          fontSize: "0.875rem",
          fontFamily: "inherit",
          border,
          background: dark ? "var(--admin-card)" : "#fff",
          color: text,
        }}
      />

      <div className="flex items-center gap-3 mt-3">
        <button
          type="submit"
          disabled={status === "sending" || description.trim().length === 0}
          className="text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
          style={{
            height: "2.5rem",
            padding: "0 1.25rem",
            borderRadius: "0.75rem",
            border: "none",
            background: "#f97316",
            color: "#fff",
            fontSize: "0.875rem",
            fontWeight: 600,
            cursor: status === "sending" || description.trim().length === 0 ? "not-allowed" : "pointer",
          }}
        >
          {status === "sending" ? "Отправка…" : "Отправить"}
        </button>

        {status === "sent" && (
          <span className="text-xs font-medium" style={{ color: success }}>
            ✓ Спасибо! Отчёт отправлен.
          </span>
        )}
        {status === "error" && (
          <span className="text-xs font-medium" style={{ color: "#dc2626" }}>
            ✕ Не удалось отправить. Попробуйте ещё раз.
          </span>
        )}
      </div>
    </form>
  );
}
