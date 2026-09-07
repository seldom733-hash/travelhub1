import sys
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    resp = page.goto("http://localhost:3000/login", wait_until="networkidle")
    page.wait_for_timeout(2500)
    print("STATUS:", resp.status if resp else None)
    print("URL:", page.url)
    print("INPUTS:", page.locator("input").count())
    html = page.content()
    with open("uic4_shots/login_probe.html", "w", encoding="utf-8") as f:
        f.write(html)
    print("HTML length:", len(html))
    print("has login form:", "username" in html, "| has placeholder admin:", 'placeholder="admin"' in html)
    browser.close()