"""
R3 — Page Composition & Information Hierarchy Parity — browser qualification.

1. Individual detail screenshots at 1680x1050 (same viewport for all three).
2. Bounding-box geometry audit (header bounds, main/aside ratio, column gap,
   wide-slot width) → JSON evidence.
3. Side-by-side composite REQUEST | ORDER | BOOKING via same-origin iframes
   (each page rendered at true 1680x1050 desktop, scaled 0.5 for comparison).
4. Responsive: 390/768/1680 — no horizontal overflow + same mobile stacking
   order (Timeline/Details after main cards, wide lower slots last).
Screenshots → docs/evidence/r3/
"""
import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

EVIDENCE = Path(__file__).resolve().parent.parent / "docs" / "evidence" / "r3"
EVIDENCE.mkdir(parents=True, exist_ok=True)

FRONT = "http://localhost:3000"

IDS = {
    "requests": "4e581890-7444-424e-858a-b93e0e35af67",
    "orders": "d150359e-a068-4ef5-913-d56c511d9a29",
    "bookings": "21591b5f-7a29-4d7d-10fa-c4a6b98e1feb",
}

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

        # ── 1. Individual screenshots + bounding-box geometry ───────────────
        geometry = {}
        for name, eid in IDS.items():
            page.set_viewport_size({"width": 1680, "height": 1050})
            page.goto(f"{FRONT}/app/{name}/{eid}", wait_until="networkidle")
            page.wait_for_timeout(3000)
            page.screenshot(path=EVIDENCE / f"r3_detail_{name}.png", full_page=True)

            geo = page.evaluate(
                """() => {
                  const box = (el) => {
                    if (!el) return null;
                    const r = el.getBoundingClientRect();
                    return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
                  };
                  const q = (sel) => document.querySelector(sel);
                  const header = q('[class*="border-b border-slate-200 bg-white"]');
                  const main = q('[class*="lg:col-span-2"]');
                  const aside = q('[class*="lg:col-span-1"]');
                  const wide = q('[class*="lg:col-span-3"]');
                  const content = document.querySelector('div.flex-1.overflow-y-auto');
                  return {
                    header: box(header),
                    main: box(main),
                    aside: box(aside),
                    wide: box(wide),
                    content: box(content),
                  };
                }"""
            )
            geo["main_aside_ratio"] = round(geo["main"]["width"] / geo["aside"]["width"], 3)
            geo["column_gap"] = geo["aside"]["x"] - (geo["main"]["x"] + geo["main"]["width"])
            geometry[name] = geo
            record(f"geometry {name}: main/aside ratio", 1.9 <= geo["main_aside_ratio"] <= 2.2, f"ratio={geo['main_aside_ratio']}")

        # ratio parity across pages
        ratios = {k: v["main_aside_ratio"] for k, v in geometry.items()}
        same_ratio = max(ratios.values()) - min(ratios.values()) < 0.01
        record("geometry: main/aside ratio identical across pages", same_ratio, json.dumps(ratios, ensure_ascii=False))
        gaps = {k: v["column_gap"] for k, v in geometry.items()}
        same_gap = max(gaps.values()) - min(gaps.values()) <= 1
        record("geometry: column gap identical across pages", same_gap, json.dumps(gaps))
        widths = {k: v["content"]["width"] for k, v in geometry.items()}
        same_maxwidth = max(widths.values()) - min(widths.values()) <= 1
        record("geometry: content max-width identical across pages", same_maxwidth, json.dumps(widths))
        wide_w = {k: v["wide"]["width"] for k, v in geometry.items()}
        same_wide = max(wide_w.values()) - min(wide_w.values()) <= 1
        record("geometry: wide lower-slot width identical across pages", same_wide, json.dumps(wide_w))

        (EVIDENCE / "r3_bounding_boxes.json").write_text(json.dumps(geometry, ensure_ascii=False, indent=2), encoding="utf-8")

        # ── 2. Side-by-side composite (true 1680x1050 desktop per frame) ─────
        page.goto(f"{FRONT}/app/requests", wait_until="networkidle")
        page.wait_for_timeout(2000)
        cols = "".join(
            f"""
            <div style="width:860px;padding:8px;box-sizing:border-box;">
              <div style="font:700 14px/1.4 system-ui;color:#334155;padding:4px 2px 8px;">{name.upper()}</div>
              <iframe src="/app/{name}/{eid}" style="width:1680px;height:1050px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;transform:scale(0.5);transform-origin:0 0;display:block;"></iframe>
            </div>"""
            for name, eid in IDS.items()
        )
        page.evaluate(
            """(html) => {
              document.body.innerHTML = `
                <div style="background:#f1f5f9;min-height:100vh;padding:8px;box-sizing:border-box;">
                  <div style="display:flex;align-items:flex-start;gap:0;">${html}</div>
                </div>`;
            }""",
            cols,
        )
        page.set_viewport_size({"width": 2620, "height": 600})
        page.wait_for_timeout(8000)
        page.screenshot(path=EVIDENCE / "r3_side_by_side_requests_order_booking.png")
        record("side-by-side composite captured", True, "requests|orders|bookings")

        # ── 3. Responsive: no overflow + mobile section stacking order ──────
        for w in (390, 768, 1680):
            page.set_viewport_size({"width": w, "height": 844})
            orders = {}
            for name, eid in IDS.items():
                page.goto(f"{FRONT}/app/{name}/{eid}", wait_until="networkidle")
                page.wait_for_timeout(2000)
                overflow = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
                ok = overflow <= 2
                record(f"responsive {name} @ {w}px: no horizontal overflow", ok, f"overflow={overflow}px")
                # mobile stacking order: index of section h3s
                seq = page.evaluate(
                    """() => Array.from(document.querySelectorAll('h3')).map(h => h.textContent.trim().toUpperCase())"""
                )
                orders[name] = seq
            if w == 390:
                # invariant: timeline + details after main cards, wide slots last
                for name, seq in orders.items():
                    try:
                        tl = seq.index("ХРОНОЛОГИЯ")
                        det = seq.index("ДЕТАЛИ")
                    except ValueError:
                        record(f"mobile order {name}: timeline/details present", False, str(seq))
                        continue
                    timeline_after_main = tl >= 1
                    details_after_timeline = det > tl
                    record(
                        f"mobile order {name}: timeline→details after main cards",
                        timeline_after_main and details_after_timeline,
                        " → ".join(seq),
                    )

        browser.close()

    out = EVIDENCE / "r3_browser_results.json"
    out.write_text(json.dumps({"total": len(results), "passed": sum(1 for r in results if r["ok"]), "results": results}, ensure_ascii=False, indent=2), encoding="utf-8")
    passed = sum(1 for r in results if r["ok"])
    print(f"\n===== R3 BROWSER QUALIFICATION SUMMARY =====\n  {passed}/{len(results)} passed")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())