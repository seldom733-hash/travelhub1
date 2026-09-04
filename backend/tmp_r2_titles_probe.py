"""List rendered section titles (h3) on the three detail pages."""
import json
import sys

from playwright.sync_api import sync_playwright

FRONT = "http://localhost:3000"
IDS = {
    "requests": "4e581890-7444-424e-858a-b93e0e35af67",
    "orders": "d150359e-a068-4ef5-913-d56c511d9a29",
    "bookings": "21591b5f-7a29-4d7d-10fa-c4a6b98e1feb",
}


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1680, "height": 1050})
        page.goto(f"{FRONT}/login", wait_until="networkidle")
        page.wait_for_timeout(700)
        page.fill('input[placeholder="admin"]', "admin")
        page.fill('input[type="password"]', "admin123")
        page.click('button[type="submit"]')
        page.wait_for_timeout(3500)
        for name, eid in IDS.items():
            page.goto(f"{FRONT}/app/{name}/{eid}", wait_until="networkidle")
            page.wait_for_timeout(3000)
            titles = page.locator("h3").all_inner_texts()
            print(f"--- {name} ---")
            for t in titles:
                print(f"   {t!r}")

        browser.close()


if __name__ == "__main__":
    sys.exit(main())