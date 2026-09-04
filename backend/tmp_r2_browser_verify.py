"""
R2 — Detail Visual System Parity — browser qualification (live dev stack :4000/:3000).

Captures comparable screenshots of:
  /app/requests  /app/orders  /app/bookings   (registries — TOTAL KPI + toolbars)
  /app/requests/{id}  /app/orders/{id}  /app/bookings/{id}  (detail pages)
Screenshots → docs/evidence/r2/
"""
import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

EVIDENCE = Path(__file__).resolve().parent.parent / "docs" / "evidence" / "r2"
EVIDENCE.mkdir(parents=True, exist_ok=True)

FRONT = "http://localhost:3000"

results = []


def record(name: str, ok: bool, detail: str = ""):
    results.append({"name": name, "ok": ok, "detail": detail[:400]})
    print(f"{'PASS' if ok else 'FAIL'}  {name}  {detail[:200]}")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1680, "height": 1050})

        # ── Login ───────────────────────────────────────────────────────────
        page.goto(f"{FRONT}/login", wait_until="networkidle")
        page.wait_for_timeout(700)
        page.fill('input[placeholder="admin"]', "admin")
        page.fill('input[type="password"]', "admin123")
        page.click('button[type="submit"]')
        page.wait_for_timeout(3500)
        record("login (admin → platform app)", "/login" not in page.url, page.url)

        detail_ids = {}

        # ── Registries ──────────────────────────────────────────────────────
        for name, path in [
            ("requests", "/app/requests"),
            ("orders", "/app/orders"),
            ("bookings", "/app/bookings"),
        ]:
            page.goto(f"{FRONT}{path}", wait_until="networkidle")
            page.wait_for_timeout(2500)
            body = page.inner_text("body")
            has_total = ("Всего заявок" in body) if name == "requests" else (("Всего заказов" in body) if name == "orders" else ("Всего бронирований" in body))
            record(f"registry {name}: TOTAL label present", has_total, "")
            page.screenshot(path=EVIDENCE / f"r2_registry_{name}.png", full_page=False)
            # grab first data row link to build a detail URL
            link = page.locator("a[href^='/app/%s/']" % name).first
            if link.count() > 0:
                href = link.get_attribute("href")
                detail_ids[name] = href
                record(f"registry {name}: first detail link found", True, href)
            else:
                record(f"registry {name}: first detail link found", False, "no link")

        # ── Detail pages ────────────────────────────────────────────────────
        for name in ["requests", "orders", "bookings"]:
            href = detail_ids.get(name)
            if not href:
                record(f"detail {name}: skipped (no id)", False, "")
                continue
            page.goto(f"{FRONT}{href}", wait_until="networkidle")
            page.wait_for_timeout(3000)
            page.screenshot(path=EVIDENCE / f"r2_detail_{name}.png", full_page=False)
            # long page: capture full scroll too
            page.screenshot(path=EVIDENCE / f"r2_detail_{name}_full.png", full_page=True)
            body = page.inner_text("body")
            record(f"detail {name}: loaded ({href})", len(body) > 200, f"chars={len(body)}")

        browser.close()

    out = EVIDENCE / "r2_browser_results.json"
    out.write_text(json.dumps({"total": len(results), "passed": sum(1 for r in results if r["ok"]), "results": results}, ensure_ascii=False, indent=2), encoding="utf-8")
    passed = sum(1 for r in results if r["ok"])
    print(f"\n===== R2 BROWSER QUALIFICATION SUMMARY =====\n  {passed}/{len(results)} passed")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())