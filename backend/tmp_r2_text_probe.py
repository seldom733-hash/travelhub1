"""
R2 — detail pages text probes:
  - Booking: «Дата услуги» lives in Service card, NOT Finance card.
  - Order/Request/Booking: timeline (Хронология) section present.
  - No visible raw status enums on the three detail pages.
"""
import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

FRONT = "http://localhost:3000"
IDS = {
    "requests": "4e581890-7444-424e-858a-b93e0e35af67",
    "orders": "d150359e-a068-4ef5-913-d56c511d9a29",
    "bookings": "21591b5f-7a29-4d7d-10fa-c4a6b98e1feb",
}

RAW_ENUMS = ["CONVERTED", "CANCELLED", "READY_FOR_BOOKING", "CONFIRMED", "ACCEPTED", "WAITING_FOR_DATA", "SENT_TO_SUPPLIER", "CUSTOMER_ACCEPTED"]


def main():
    out = {}
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
            body = page.inner_text("body")
            entry = {"timeline_section": "Хронология" in body or "Timeline" in body}
            # raw enum leakage: any raw canonical enum token visible as text?
            leaked = [e for e in RAW_ENUMS if e in body]
            entry["raw_enum_leak"] = leaked
            if name == "bookings":
                # locate section cards and their text
                cards = page.locator("div.rounded-xl.border.border-slate-200.bg-white.p-4")
                finance_text = ""
                service_text = ""
                for i in range(cards.count()):
                    txt = cards.nth(i).inner_text()
                    if "Финансы" in txt and "Дата услуги" in txt:
                        finance_text = txt
                    if "Услуга" in txt and "Дата услуги" in txt:
                        service_text = txt
                entry["service_date_in_finance"] = bool(finance_text)
                entry["service_date_in_service"] = bool(service_text)
            out[name] = entry
            print(name, json.dumps(entry, ensure_ascii=False))

        browser.close()

    (Path(__file__).resolve().parent.parent / "docs" / "evidence" / "r2" / "text_probes.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8"
    )


if __name__ == "__main__":
    sys.exit(main())