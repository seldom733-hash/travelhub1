"""
R2 — Detail Visual System Parity — rendered DOM token audit.

For each detail page collect exact class tokens used by the shared primitives
(section card, section title, field label/value, empty value, link, row,
finance cell, timeline) to prove one visual contract across the three pages.
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

PROBES = {
    "section_card": "div.rounded-xl.border.border-slate-200.bg-white.p-4",
    "section_title": "h3.text-xs.font-semibold.uppercase.tracking-wide.text-slate-500",
    "field_label": "span.text-xs.font-medium.uppercase.text-slate-400",
    "field_value": "span.text-sm.font-medium.text-slate-700",
    "field_value_mono": "span.font-mono.text-xs.font-medium.text-blue-600",
    "empty_value": "span.text-slate-400",
    "link": "a.font-medium.text-blue-600.hover\\:underline",
    "row": "div.rounded-lg.border.border-slate-100.bg-white.px-4.py-2\\.5",
    "finance_cell": "div.rounded-lg.px-4.py-3",
    "timeline_dot": "div.h-2.w-2.rounded-full.bg-blue-500",
    "badge": "span.inline-flex.items-center.gap-1.rounded-full.border.px-2\\.5.py-0\\.5.text-xs.font-medium",
}


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
            counts = {}
            for probe, selector in PROBES.items():
                try:
                    counts[probe] = page.locator(selector).count()
                except Exception as exc:  # pragma: no cover
                    counts[probe] = f"ERR {exc}"
            # sample the exact className of one section card + one field
            sample = {}
            card = page.locator(PROBES["section_card"]).first
            if card.count() > 0:
                sample["section_card_class"] = card.get_attribute("class")
            title = page.locator(PROBES["section_title"]).first
            if title.count() > 0:
                sample["section_title_class"] = title.get_attribute("class")
            label = page.locator(PROBES["field_label"]).first
            if label.count() > 0:
                sample["field_label_class"] = label.get_attribute("class")
            val = page.locator(PROBES["field_value"]).first
            if val.count() > 0:
                sample["field_value_class"] = val.get_attribute("class")
            link = page.locator(PROBES["link"]).first
            if link.count() > 0:
                sample["link_class"] = link.get_attribute("class")
            out[name] = {"counts": counts, "samples": sample}
            print(f"--- {name} ---")
            for k, v in counts.items():
                print(f"  {k}: {v}")
            for k, v in sample.items():
                print(f"  {k}: {v}")

        browser.close()

    (Path(__file__).resolve().parent.parent / "docs" / "evidence" / "r2" / "dom_tokens.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8"
    )


if __name__ == "__main__":
    sys.exit(main())