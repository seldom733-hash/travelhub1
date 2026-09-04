"""R2 responsive check: no horizontal overflow on detail + registry pages at mobile/tablet widths."""
import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

FRONT = "http://localhost:3000"
PAGES = {
    "requests_detail": "4e581890-7444-424e-858a-b93e0e35af67",
    "orders_detail": "d150359e-a068-4ef5-913-d56c511d9a29",
    "bookings_detail": "21591b5f-7a29-4d7d-10fa-c4a6b98e1feb",
}
REGISTRIES = ["requests", "orders", "bookings"]
WIDTHS = [390, 768, 1280]


def main():
    out = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1680, "height": 1050})
        page.goto(f"{FRONT}/login", wait_until="networkidle")
        page.wait_for_timeout(700)
        page.fill('input[placeholder="admin"]', "admin")
        page.fill('input[type="password"]', "admin123")
        page.click('button[type="submit"]')
        page.wait_for_timeout(3500)

        for name, eid in PAGES.items():
            for w in WIDTHS:
                page.set_viewport_size({"width": w, "height": 844})
                page.goto(f"{FRONT}/app/{name.split('_')[0]}/{eid}", wait_until="networkidle")
                page.wait_for_timeout(2000)
                overflow = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
                ok = overflow <= 2
                out.append({"page": name, "width": w, "overflow_px": overflow, "ok": ok})
                print(f"{'PASS' if ok else 'FAIL'}  {name} @ {w}px  overflow={overflow}px")

        for name in REGISTRIES:
            for w in WIDTHS:
                page.set_viewport_size({"width": w, "height": 844})
                page.goto(f"{FRONT}/app/{name}", wait_until="networkidle")
                page.wait_for_timeout(2000)
                overflow = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
                ok = overflow <= 2
                out.append({"page": f"{name}_registry", "width": w, "overflow_px": overflow, "ok": ok})
                print(f"{'PASS' if ok else 'FAIL'}  {name} registry @ {w}px  overflow={overflow}px")

        browser.close()

    (Path(__file__).resolve().parent.parent / "docs" / "evidence" / "r2" / "responsive.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8"
    )


if __name__ == "__main__":
    sys.exit(main())