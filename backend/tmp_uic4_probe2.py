import sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"
ORDER = "/app/orders/83eb7738-01ac-4506-9af8-3504b989bfc6"
EMPTY = "/app/requests/00775b45-a5a6-4155-a38f-7b05eea23b7c"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto(BASE + "/login", wait_until="networkidle")
    page.fill('input[placeholder="admin"]', "admin")
    page.fill('input[type="password"]', "admin123")
    page.click('button[type="submit"]')
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1200)

    page.goto(BASE + ORDER, wait_until="networkidle")
    page.wait_for_timeout(1500)
    section = page.locator("h3", has_text="История изменений").first.locator("xpath=..")
    text = section.inner_text()
    print("ORDER audit section text:")
    print(text[:800])
    print("---- has 'Принят в работу':", "Принят в работу" in text)

    page.goto(BASE + EMPTY, wait_until="networkidle")
    page.wait_for_timeout(1500)
    h3 = page.locator("h3", has_text="История изменений")
    print("\nEMPTY h3 count:", h3.count())
    if h3.count() > 0:
        section = h3.first.locator("xpath=..")
        t2 = section.inner_text()
        print("EMPTY section text (repr):", repr(t2[:200]))
        print("has title:", "История изменений" in t2, "| has empty:", "Нет записей истории" in t2)
    browser.close()