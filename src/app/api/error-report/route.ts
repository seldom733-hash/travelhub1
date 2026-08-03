import { NextRequest, NextResponse } from "next/server";
import { appendFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

/**
 * POST /api/error-report
 * Принимает отчёт об ошибке со страницы 500 (digest + описание) и сохраняет
 * его в лог-файл error-reports.log на сервере (JSONL). Лог добавляется в .gitignore.
 */
export async function POST(request: NextRequest) {
  try {
    let body: { digest?: unknown; description?: unknown; url?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }

    const digest = typeof body.digest === "string" ? body.digest.slice(0, 200) : "";
    const description =
      typeof body.description === "string" ? body.description.trim().slice(0, 4000) : "";
    const url = typeof body.url === "string" ? body.url.slice(0, 2000) : "";

    const userAgent = request.headers.get("user-agent") || "";
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";

    const entry = {
      ts: new Date().toISOString(),
      digest,
      description,
      url,
      userAgent,
      ip,
    };

    // Пишем в лог-файл на сервере (JSONL). Файл в .gitignore — не попадёт в репозиторий.
    const logPath = path.join(process.cwd(), "error-reports.log");
    try {
      await appendFile(logPath, JSON.stringify(entry) + "\n", "utf8");
    } catch (e) {
      // Если файл недоступен (например, read-only ФС) — просто логируем в консоль
      console.error("[error-report] cannot write log:", e);
    }

    console.error("[error-report]", JSON.stringify(entry));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[error-report] unexpected:", error);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
