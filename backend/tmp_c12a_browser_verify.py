"""
UI-C1.2A — Operations Center Shared Shell — browser qualification.

1. All four Operations Center tabs (requests/orders/bookings/payments) render
   the shared shell: h1 «Центр операций», breadcrumb, tab bar, active tab,
   content tabpanel.
2. Canonical sidebar: ФИНАНСЫ group with the Платежи item pointing at
   /app/payments.
3. Legacy /app/finance/payments redirects to canonical /app/payments.
4. Side-by-side composite REQUEST | ORDER | BOOKING | PAYMENT via same-origin
   iframes (true 1680x1050 desktop per frame, scaled for comparison).
5. Responsive 1680/768/390 — no horizontal overflow on any tab.

Screenshots/JSON → docs/evidence/c12a/
"""
import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

EVIDENCE = Path(__file__).resolve().parent.parent / "docs" / "evidence" / "c12a"
EVIDENCE.mkdir(parents=True, exist_ok=True)

FRONT = "http://localhost:3000"

TABS = [
    ("requests", "/app/requests", "Заявки"),
    ("orders", "/app/orders", "Заказы"),
    ("bookings", "/app/bookings", "Бронирования"),
    ("payments", "/app/payments", "Платежи"),
]

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

        # ── 1. Shared shell on every Operations Center tab ──────────────────
        shell_evidence = {}
        for name, path, ru_label in TABS:
            page.set_viewport_size({"width": 1680, "height": 1050})
            page.goto(f"{FRONT}{path}", wait_until="networkidle")
            page.wait_for_timeout(3000)
            page.screenshot(path=EVIDENCE / f"c12a_tab_{name}.png", full_page=True)

            ev = page.evaluate(
                """(label) => {
                  const q = (sel) => document.querySelector(sel);
                  const h1 = q('h1');
                  const tabs = Array.from(document.querySelectorAll('[role="tab"]'))
                    .map((t) => ({ text: t.textContent.trim(), selected: t.getAttribute('aria-selected') }));
                  const panel = q('[role="tabpanel"]');
                  const activeTab = tabs.find((t) => t.selected === 'true');
                  // sidebar group headings
                  const groups = Array.from(document.querySelectorAll('aside div'))
                    .map((d) => d.textContent.trim())
                    .filter((s) => s.length > 0 && s === s.toUpperCase() && s.length <= 24);
                  return {
                    h1: h1 ? h1.textContent.trim() : null,
                    tabs,
                    active: activeTab ? activeTab.text : null,
                    panelHasTable: !!(panel && panel.querySelector('table')),
                    panelChars: panel ? panel.textContent.trim().length : 0,
                    groups: Array.from(new Set(groups)),
                    paymentsSidebarHref: Array.from(document.querySelectorAll('aside a'))
                      .find((a) => a.textContent.includes('Платежи'))?.getAttribute('href') ?? null,
                  };
                }""",
                ru_label,
            )
            shell_evidence[name] = ev
            record(f"shell {name}: h1 «Центр операций»", ev["h1"] == "Центр операций", str(ev["h1"]))
            record(f"shell {name}: 4 tabs rendered", len(ev["tabs"]) == 4, json.dumps(ev["tabs"], ensure_ascii=False))
            record(f"shell {name}: correct active tab", ev["active"] == ru_label, f"active={ev['active']}")
            record(f"shell {name}: tabpanel has content table", ev["panelHasTable"], f"chars={ev['panelChars']}")
            record(f"shell {name}: ФИНАНСЫ sidebar group", "ФИНАНСЫ" in ev["groups"], json.dumps(ev["groups"], ensure_ascii=False))
            record(f"shell {name}: Платежи sidebar → /app/payments", ev["paymentsSidebarHref"] == "/app/payments", str(ev["paymentsSidebarHref"]))

        # ── 2. Legacy /app/finance/payments → /app/payments ─────────────────
        page.goto(f"{FRONT}/app/finance/payments", wait_until="networkidle")
        page.wait_for_timeout(3000)
        record("legacy /app/finance/payments → /app/payments", page.url.startswith(f"{FRONT}/app/payments"), page.url)
        # analytics drill-down compat: query preserved
        page.goto(f"{FRONT}/app/finance/payments?status=CAPTURED&currency=USD", wait_until="networkidle")
        page.wait_for_timeout(3000)
        record(
            "drill-down query params preserved through redirect",
            page.url.startswith(f"{FRONT}/app/payments?") and "status=CAPTURED" in page.url and "currency=USD" in page.url,
            page.url,
        )

        # ── 3. Side-by-side composite (true 1680x1050 desktop per frame) ────
        page.goto(f"{FRONT}/app/requests", wait_until="networkidle")
        page.wait_for_timeout(2000)
        cols = "".join(
            f"""
            <div style="width:860px;padding:8px;box-sizing:border-box;">
              <div style="font:700 14px/1.4 system-ui;color:#334155;padding:4px 2px 8px;">{name.upper()}</div>
              <iframe src="{path}" style="width:1680px;height:1050px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;transform:scale(0.5);transform-origin:0 0;display:block;"></iframe>
            </div>"""
            for name, path, _ in TABS
        )
        page.evaluate(
            """(html) => {
              document.body.innerHTML = `
                <div style="background:#f1f5f9;min-height:100vh;padding:8px;box-sizing:border-box;">
                  <div style="display:flex;align-items:flex-start;gap:0;">${html}</div>
                </div>`;
            }""",
            cols,
        )
        page.set_viewport_size({"width": 3480, "height": 620})
        page.wait_for_timeout(9000)
        page.screenshot(path=EVIDENCE / "c12a_side_by_side_ops_center.png")
        record("side-by-side composite captured", True, "requests|orders|bookings|payments")

        # ── 4. Responsive: no horizontal overflow on any tab ────────────────
        for w in (390, 768, 1680):
            page.set_viewport_size({"width": w, "height": 844})
            for name, path, _ in TABS:
                page.goto(f"{FRONT}{path}", wait_until="networkidle")
                page.wait_for_timeout(2000)
                overflow = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
                record(f"responsive {name} @ {w}px: no horizontal overflow", overflow <= 2, f"overflow={overflow}px")

        browser.close()

    out = EVIDENCE / "c12a_browser_results.json"
    out.write_text(
        json.dumps(
            {"total": len(results), "passed": sum(1 for r in results if r["ok"]), "results": results, "shell_evidence": shell_evidence},
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    passed = sum(1 for r in results if r["ok"])
    print(f"\n===== UI-C1.2A BROWSER QUALIFICATION SUMMARY =====\n  {passed}/{len(results)} passed")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
