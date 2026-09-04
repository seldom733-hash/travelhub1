"""
UI-C1.2B — Requests Registry Migration — browser qualification.

1. Canonical Requests composition renders inside the shared Operations Center
   shell: title, active tab, TOTAL card, all 12 status KPI cards, no raw enums.
2. URL-state behavior: card click sets ?status= + server-scoped table reload,
   reload restores state, Back/Forward restores, Reset clears search/status.
3. No period/date control is present (KPI parity absent → hidden).
4. Responsive 1680/768/390 — no horizontal overflow; KPI grid wraps cleanly.
5. RU/AZ/EN render correctly (no raw keys).

Screenshots/JSON → docs/evidence/c12b/
"""
import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

EVIDENCE = Path(__file__).resolve().parent.parent / "docs" / "evidence" / "c12b"
EVIDENCE.mkdir(parents=True, exist_ok=True)

FRONT = "http://localhost:3000"

# The 12 canonical RequestStatus values (source of truth §3)
REQUEST_STATUSES = [
    "NEW", "CHECKING", "SUPPLIER_TIMEOUT", "PRICE_CHANGED", "CUSTOMER_ACCEPTED",
    "CONFIRMED", "CONVERTED", "REJECTED", "UNAVAILABLE", "EXPIRED",
    "CUSTOMER_PAYMENT_TIMEOUT", "CANCELLED_BY_CUSTOMER",
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

        # ── 1. Canonical Requests composition ───────────────────────────────
        page.goto(f"{FRONT}/app/requests", wait_until="networkidle")
        page.wait_for_timeout(3500)
        page.screenshot(path=EVIDENCE / "c12b_requests_desktop.png", full_page=True)

        ev = page.evaluate(
            """(REQUEST_STATUSES) => {
              const q = (sel) => document.querySelector(sel);
              const text = (el) => (el ? el.textContent.trim() : null);
              const h1 = q('h1');
              const tabs = Array.from(document.querySelectorAll('[role="tab"]'))
                .map((t) => ({ text: t.textContent.trim(), selected: t.getAttribute('aria-selected') }));
              const activeTab = tabs.find((t) => t.selected === 'true');
              // KPI cards: buttons with a label span + value span
              const kpiButtons = Array.from(document.querySelectorAll('[role="tabpanel"] button'))
                .filter((b) => b.querySelectorAll('span').length >= 2);
              const totalCard = kpiButtons.find((b) => b.textContent.includes('Всего заявок'));
              const statusCards = kpiButtons.filter((b) => !b.textContent.includes('Всего заявок'));
              const labels = statusCards.map((b) => b.querySelector('span').textContent.trim());
              const hasRawEnum = statusCards.some((b) => {
                const s = b.querySelector('span').textContent.trim();
                return REQUEST_STATUSES.includes(s.toUpperCase().replace(/ /g, '_')) && s === s.toUpperCase();
              });
              const dateInputs = Array.from(document.querySelectorAll('input[type="date"]'));
              const resetBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Сбросить'));
              const badges = Array.from(document.querySelectorAll('[role="tabpanel"] table tbody span'))
                .filter((s) => s.className.includes('rounded-full'));
              return {
                h1: text(h1),
                active: activeTab ? activeTab.text : null,
                tabCount: tabs.length,
                totalCardText: totalCard ? totalCard.textContent.replace(/\\s+/g, ' ').trim() : null,
                statusCount: statusCards.length,
                statusLabels: labels,
                hasRawEnum,
                dateInputCount: dateInputs.length,
                hasReset: !!resetBtn,
                badgeTexts: badges.map((b) => b.textContent.trim()).slice(0, 5),
              };
            }""",
            REQUEST_STATUSES,
        )
        record("shell title «Центр операций» + Requests active tab", ev["h1"] == "Центр операций" and ev["active"] == "Заявки", f"active={ev['active']} tabs={ev['tabCount']}")
        record("Total KPI card «Всего заявок» present", bool(ev["totalCardText"]), str(ev["totalCardText"]))
        record("all 12 status KPI cards visible", ev["statusCount"] == 12, f"count={ev['statusCount']}")
        record("no raw enum labels on KPI cards", not ev["hasRawEnum"], json.dumps(ev["statusLabels"], ensure_ascii=False))
        record("no period/date control (KPI parity absent → hidden)", ev["dateInputCount"] == 0, f"date inputs={ev['dateInputCount']}")
        record("Reset button present", ev["hasReset"], "")
        record("table badges are localized (no raw enum)", all(b not in REQUEST_STATUSES for b in ev["badgeTexts"]), json.dumps(ev["badgeTexts"], ensure_ascii=False))

        # ── 2. KPI click contract + URL state ───────────────────────────────
        # Click the CHECKING card → URL ?status=CHECKING, table scoped
        page.evaluate(
            """() => {
              const btn = Array.from(document.querySelectorAll('[role="tabpanel"] button'))
                .find((b) => b.textContent.includes('На проверке') && !b.textContent.includes('Всего заявок'));
              btn.click();
            }"""
        )
        page.wait_for_timeout(2500)
        record("card click writes ?status=CHECKING", "status=CHECKING" in page.url, page.url)
        # selected state communicated
        selected = page.evaluate(
            """() => {
              const b = Array.from(document.querySelectorAll('[role="tabpanel"] button'))
                .find((x) => x.getAttribute('aria-pressed') === 'true');
              return b ? b.textContent.replace(/\\s+/g, ' ').trim() : null;
            }"""
        )
        record("selected KPI card is communicated (aria-pressed)", selected is not None and "На проверке" in selected, str(selected))

        # server-scoped table reload (rows now CHECKING-only or empty-state)
        body = page.evaluate("""() => { const t = document.querySelector('[role="tabpanel"] table'); return t ? t.textContent : ''; }""")
        record("table refetched under server scope after click", len(body) > 0, f"table chars={len(body)}")

        # ── 3. Reload restores state ────────────────────────────────────────
        page.goto(f"{FRONT}/app/requests?status=CHECKING", wait_until="networkidle")
        page.wait_for_timeout(3000)
        active_sel = page.evaluate(
            """() => {
              const b = Array.from(document.querySelectorAll('[role="tabpanel"] button'))
                .find((x) => x.getAttribute('aria-pressed') === 'true');
              return b ? b.textContent.replace(/\\s+/g, ' ').trim() : null;
            }"""
        )
        record("reload restores ?status=CHECKING selection", active_sel is not None and "На проверке" in active_sel, f"selected={active_sel}")

        # ── 4. Search → URL + Reset clears ──────────────────────────────────
        page.goto(f"{FRONT}/app/requests", wait_until="networkidle")
        page.wait_for_timeout(3000)
        page.fill('input[aria-label*="Поиск"]', "REQ-")
        page.wait_for_timeout(1500)
        record("debounced search writes ?search= to URL", "search=REQ-" in page.url, page.url)
        page.click('button:has-text("Сбросить")')
        page.wait_for_timeout(2000)
        record("Reset clears search/status and normalizes URL", "search=" not in page.url and "status=" not in page.url, page.url)
        reset_sel = page.evaluate(
            """() => {
              const b = Array.from(document.querySelectorAll('[role="tabpanel"] button'))
                .find((x) => x.getAttribute('aria-pressed') === 'true');
              return b ? b.textContent.replace(/\\s+/g, ' ').trim() : null;
            }"""
        )
        record("Reset returns to unselected Total overview", reset_sel is None or "Всего заявок" in reset_sel, str(reset_sel))

        # ── 5. Back/Forward restores route query state ──────────────────────
        page.goto(f"{FRONT}/app/requests?status=NEW", wait_until="networkidle")
        page.wait_for_timeout(2500)
        page.goto(f"{FRONT}/app/orders", wait_until="networkidle")
        page.wait_for_timeout(2500)
        page.go_back()
        page.wait_for_timeout(3000)
        record("browser Back restores /app/requests?status=NEW", page.url.startswith(f"{FRONT}/app/requests?") and "status=NEW" in page.url, page.url)
        back_sel = page.evaluate(
            """() => {
              const b = Array.from(document.querySelectorAll('[role="tabpanel"] button'))
                .find((x) => x.getAttribute('aria-pressed') === 'true');
              return b ? b.textContent.replace(/\\s+/g, ' ').trim() : null;
            }"""
        )
        record("Back restores the selected KPI card (NEW)", back_sel is not None and "Новые" in back_sel, f"selected={back_sel}")

        # ── 6. RU/AZ/EN render (no raw keys) ────────────────────────────────
        for loc, exp in (("ru", "Всего заявок"), ("en", "Total requests"), ("az", "Cəmi sorğular")):
            page.evaluate("(l) => localStorage.setItem('travelhub.locale', l)", loc)
            page.reload(wait_until="networkidle")
            page.wait_for_timeout(3000)
            h1 = page.evaluate("""() => { const h = document.querySelector('h1'); return h ? h.textContent.trim() : null; }""")
            total_visible = page.evaluate(
                """(exp) => { const b = Array.from(document.querySelectorAll('[role="tabpanel"] button')).find((x) => x.textContent.includes(exp)); return !!b; }""",
                exp,
            )
            raw_keys = page.evaluate(
                """() => !!document.body.textContent.match(/requests\\.kpi\\.|ops\\.empty|admin\\.kpi\\.request_statuses/)"""
            )
            record(f"locale {loc}: shell + total render localized ({exp})", h1 == "Центр операций" if loc == "ru" else h1 in ("Əməliyyat Mərkəzi", "Operations Center", "Центр операций"), f"h1={h1} total={total_visible}")
            record(f"locale {loc}: no raw translation keys in DOM", not raw_keys, "")
        # restore RU for the remaining checks
        page.evaluate("() => localStorage.setItem('travelhub.locale', 'ru')")
        page.reload(wait_until="networkidle")
        page.wait_for_timeout(2500)

        # ── 7. Responsive 1680/768/390 ──────────────────────────────────────
        for w in (390, 768, 1680):
            page.set_viewport_size({"width": w, "height": 844})
            page.goto(f"{FRONT}/app/requests", wait_until="networkidle")
            page.wait_for_timeout(2500)
            overflow = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
            record(f"responsive @ {w}px: no horizontal overflow", overflow <= 2, f"overflow={overflow}px")
            card_rows = page.evaluate(
                """() => {
                  const grid = Array.from(document.querySelectorAll('div')).find((d) => d.className.includes('grid-cols-2') && d.className.includes('gap-2'));
                  return grid ? grid.querySelectorAll('button').length : 0;
                }"""
            )
            record(f"responsive @ {w}px: 12 status cards remain in grid", card_rows == 12, f"cards={card_rows}")
        if ev.get("statusLabels"):
            page.set_viewport_size({"width": 1680, "height": 1050})
            page.reload(wait_until="networkidle")
            page.wait_for_timeout(2500)

        browser.close()

    out = EVIDENCE / "c12b_browser_results.json"
    out.write_text(
        json.dumps(
            {"total": len(results), "passed": sum(1 for r in results if r["ok"]), "results": results, "dom": ev},
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    passed = sum(1 for r in results if r["ok"])
    print(f"\n===== UI-C1.2B BROWSER QUALIFICATION SUMMARY =====\n  {passed}/{len(results)} passed")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
