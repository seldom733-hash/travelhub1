"""Probe Request detail DOM: headings, note-related text, console errors."""
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"
REQ = "/app/requests/006e94b4-62e7-447a-9cab-84ca62d74758"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    console_errors = []
    page.on("console", lambda m: console_errors.append(f"[{m.type}] {m.text[:200]}") if m.type == "error" else None)
    page.on("pageerror", lambda e: console_errors.append(f"[pageerror] {str(e)[:300]}"))

    page.goto(BASE + "/login", wait_until="networkidle")
    page.fill('input[placeholder="admin"]', "admin")
    page.fill('input[type="password"]', "admin123")
    page.click('button[type="submit"]')
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1500)

    page.goto(BASE + REQ, wait_until="networkidle")
    page.wait_for_timeout(2500)

    print("=== HEADINGS (h1/h2/h3) ===")
    for h in page.locator("h1, h2, h3").all():
        txt = h.inner_text().strip().replace("\n", " | ")
        if txt:
            print("  ", txt[:120])

    print("\n=== TEXT CONTAINING 'римечан' (Примечания/примечан) ===")
    try:
        for el in page.get_by_text("римечан", exact=False).all()[:10]:
            print("  ", repr(el.inner_text()[:100]))
    except Exception as e:
        print("  ERR", e)

    print("\n=== TEXT CONTAINING 'История' ===")
    try:
        for el in page.get_by_text("История", exact=False).all()[:10]:
            print("  ", repr(el.inner_text()[:100]))
    except Exception as e:
        print("  ERR", e)

    print("\n=== CONSOLE ERRORS ===")
    if console_errors:
        for c in console_errors[:15]:
            print("  ", c)
    else:
        print("   none")

    browser.close()