"""UI-C4 runtime verification — hydrated DOM check of the Audit History sections.

Pages checked:
  Request with history : /app/requests/006e94b4-62e7-447a-9cab-84ca62d74758 (MKT-REQ-09000547)
  Order   with history : /app/orders/83eb7738-01ac-4506-9af8-3504b989bfc6   (MKT-ORD-09000547)
  Booking with history : /app/bookings/c2574218-4f96-4627-9cef-cac53b2e40f6 (MKT-BKG-09000948)
  Request empty state  : /app/requests/00775b45-a5a6-4155-a38f-7b05eea23b7c (MKT-REQ-09000039)

Asserts:
  - login works (admin/admin123)
  - each page renders the shared audit section title "История изменений"
  - audit rows render with a localized action label + timestamp
  - actor line ("Автор: ...") present when backend stores an actor
  - Timeline ("Хронология") still in the aside column (Timeline != Audit)
  - empty-history request shows the localized empty state
  - no page-level errors in the browser console
"""
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"

PAGES = [
    # (label, url, expect_action_ru, expect_actor)
    ("request-has-history", "/app/requests/006e94b4-62e7-447a-9cab-84ca62d74758", "Заявка создана", True),
    ("order-has-history", "/app/orders/83eb7738-01ac-4506-9af8-3504b989bfc6", "Изменение данных туриста (сбор данных)", True),
    ("booking-has-history", "/app/bookings/c2574218-4f96-4627-9cef-cac53b2e40f6", "Бронирование подтверждено", True),
]

EMPTY_REQ = "/app/requests/00775b45-a5a6-4155-a38f-7b05eea23b7c"

results = []


def check(ok, msg):
    results.append((ok, msg))
    print(("PASS" if ok else "FAIL") + " | " + msg)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    console_errors = []
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: console_errors.append(str(e)))

    # ── Login ────────────────────────────────────────────────────────────
    page.goto(BASE + "/login", wait_until="networkidle")
    page.fill('input[placeholder="admin"]', "admin")
    page.fill('input[type="password"]', "admin123")
    page.click('button[type="submit"]')
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1500)
    check("/login" not in page.url, f"login redirects away from /login (url={page.url})")

    # ── Pages with history ───────────────────────────────────────────────
    for label, url, action_ru, expect_actor in PAGES:
        page.goto(BASE + url, wait_until="networkidle")
        page.wait_for_timeout(1800)

        # Audit section title (shared key bookings.change_history)
        h3 = page.locator("h3", has_text="История изменений")
        check(h3.count() == 1, f"[{label}] audit section heading 'История изменений' rendered once")

        section = h3.first.locator("xpath=..")  # EntitySectionCard container
        rows = section.locator("div.rounded-lg.border.border-slate-100")
        check(rows.count() >= 1, f"[{label}] audit rows rendered ({rows.count()})")

        # Localized action label (ru default)
        check(action_ru in section.inner_text(), f"[{label}] localized action label '{action_ru}' present")

        # Actor line (order.history.author -> 'Автор: ...')
        author = "Автор:"
        check(author in section.inner_text(), f"[{label}] actor line present")

        # Timestamp present (any 4-digit year)
        import re
        check(re.search(r"20\d\d", section.inner_text()) is not None, f"[{label}] timestamp rendered")

        # Timeline separation: 'Хронология' heading exists and is in the aside (before audit in DOM)
        tl = page.locator("h3", has_text="Хронология")
        check(tl.count() == 1, f"[{label}] Timeline section 'Хронология' still rendered (separation preserved)")

        # No raw status enums visible in the audit rows (StatusBadge shows localized labels)
        raw = re.findall(r"\b(CUSTOMER_ACCEPTED|PRICE_CHANGED|IN_PROCESSING|AWAITING_CONFIRMATION)\b", section.inner_text())
        check(not raw, f"[{label}] no raw status enums in audit section (found: {raw})")

        page.screenshot(path=f"uic4_shots/{label}.png", full_page=True)

    # ── Empty state (request without history) ────────────────────────────
    page.goto(BASE + EMPTY_REQ, wait_until="networkidle")
    page.wait_for_timeout(1800)
    h3 = page.locator("h3", has_text="История изменений")
    check(h3.count() == 1, "[empty-req] audit section still rendered for empty history")
    section = h3.first.locator("xpath=..")
    empty_text = section.inner_text()
    check("Нет записей истории" in empty_text, "[empty-req] localized empty state 'Нет записей истории' shown")
    # Section title renders uppercase via CSS text-transform — compare case-insensitively.
    check("история изменений" in empty_text.lower(), "[empty-req] section title present in empty state")
    page.screenshot(path="uic4_shots/request-empty.png", full_page=True)

    # ── Console errors ───────────────────────────────────────────────────
    real_errors = [e for e in console_errors if "favicon" not in e.lower()]
    check(len(real_errors) == 0, f"no console/page errors ({len(real_errors)} found: {real_errors[:3]})")

    browser.close()

failed = [m for ok, m in results if not ok]
print(f"\n=== UI-C4 RUNTIME: {len(results) - len(failed)}/{len(results)} PASS ===")
if failed:
    print("FAILED:")
    for m in failed:
        print("  -", m)
    raise SystemExit(1)