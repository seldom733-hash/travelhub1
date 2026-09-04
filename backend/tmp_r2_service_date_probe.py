"""Case-insensitive: «Дата услуги» in Service card, NOT Finance card, on Booking detail."""
import json
import sys

from playwright.sync_api import sync_playwright

FRONT = "http://localhost:3000"
BID = "21591b5f-7a29-4d7d-10fa-c4a6b98e1feb"


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
        page.goto(f"{FRONT}/app/bookings/{BID}", wait_until="networkidle")
        page.wait_for_timeout(3000)
        cards = page.locator("div.rounded-xl.border.border-slate-200.bg-white.p-4")
        res = {}
        for i in range(cards.count()):
            txt = cards.nth(i).inner_text().upper()
            title = txt.splitlines()[0] if txt else ""
            res[title] = {
                "has_service_date": "ДАТА УСЛУГИ" in txt,
                "has_money_labels": any(k in txt for k in ("СУММА", "ОПЛАЧЕНО", "ВОЗВРАЩЕНО", "К ОПЛАТЕ", "К ВОЗВРАТУ")),
            }
        print(json.dumps(res, ensure_ascii=False, indent=2))
        browser.close()


if __name__ == "__main__":
    sys.exit(main())