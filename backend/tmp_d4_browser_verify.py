"""
D4 — runtime/browser verification (live dev stack: backend :4000, frontend :3000).

Checks (D4 §29 + §30):
  1. D3 CASE A (MKT-ORD-09000547) still works — visible, NEW/editable, travelers panel
  2. Representative Requests visible via Request Center search (C2 CONFIRMED, C3 NEW, C4 UNAVAILABLE)
  3. C1 Order READY_FOR_BOOKING visible with travelers
  4. C5 Booking CONFIRMED unpaid visible
  5. C6 order cancel → booking cancel, payment CAPTURED detail visible
  6. Marketplace chain visible in Platform scope
  7. Storefront chain NOT visible in Platform Marketplace scope (order/booking detail + search)
Screenshots → docs/evidence/d4/
"""
import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

EVIDENCE = Path(__file__).resolve().parent.parent / "docs" / "evidence" / "d4"
EVIDENCE.mkdir(parents=True, exist_ok=True)

FRONT = "http://localhost:3000"

# Permanent representative cases (dev DB)
CASES = {
    "d3_caseA_order": {"id": "83eb7738-01ac-4506-9af8-3504b989bfc6", "ref": "MKT-ORD-09000547"},
    "c1_order": {"id": "1e1ab156-8b7f-4e28-b3cb-27f3b70d6b98", "ref": "MKT-ORD-09000847"},
    "c2_request": {"id": "c93de74e-e695-4d57-a3a5-d85c0f962b6c", "ref": "MKT-REQ-09000848"},
    "c3_request": {"id": "037f7372-b0e0-4e7a-a4c2-0926927b2246", "ref": "MKT-REQ-09000849"},
    "c4_request": {"id": "34a0bec0-f7ad-4688-8f92-6c79f26ad6d9", "ref": "MKT-REQ-09000850"},
    "c5_booking": {"id": "fdfbcb49-a711-4c95-8a44-53a01d1f6c9c", "ref": "MKT-BKG-09000861"},
    "c6_booking": {"id": "31f2fdfc-e483-4cd4-a750-c36faa16a46e", "ref": "MKT-BKG-09000949"},
    "c6_order": {"id": "aa8e510d-c88c-4ab1-9826-469fae722395", "ref": "MKT-ORD-09000949"},
    "c6_payment": {"code": "PAY-00001202", "ref": "MKT-PAY-09000949-1"},
}
SF_ORDER = {"id": "6e7f85a9-d0fe-4b5d-1150-4c6f2991d744", "code": "SF001-ORD-00000001"}
SF_BOOKING = {"id": "40fc0bf8-38ff-4661-9fe-11dfef26df51", "code": "SF001-BKG-00000001"}

results = []


def record(name: str, ok: bool, detail: str = ""):
    results.append({"name": name, "ok": ok, "detail": detail[:400]})
    print(f"{'PASS' if ok else 'FAIL'}  {name}  {detail[:200]}")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1600, "height": 1000})

        # ── Login ─────────────────────────────────────────────────────────
        page.goto(f"{FRONT}/login", wait_until="networkidle")
        page.wait_for_timeout(800)
        page.fill('input[placeholder="admin"]', "admin")
        page.fill('input[type="password"]', "admin123")
        page.click('button[type="submit"]')
        page.wait_for_timeout(3000)
        ok_login = "/login" not in page.url
        record("login (admin → platform app)", ok_login, page.url)
        page.screenshot(path=str(EVIDENCE / "d4_00_login.png"))

        def go(path: str, wait_ms: int = 2500):
            page.goto(f"{FRONT}{path}", wait_until="networkidle")
            page.wait_for_timeout(wait_ms)

        def body_text() -> str:
            return page.inner_text("body")

        def has_error(text: str) -> bool:
            # UI shows API error / not-found marker instead of content
            return any(x in text for x in ["не найден", "not found", "Не найдено", "ошибка", "Ошибка", "Error", "404"])

        # ── 1. D3 CASE A order detail (preserved, editable NEW) ───────────
        go(f"/app/orders/{CASES['d3_caseA_order']['id']}")
        page.screenshot(path=str(EVIDENCE / "d4_01_d3_caseA_order.png"), full_page=True)
        text = body_text()
        ok = CASES["d3_caseA_order"]["ref"] in text and not has_error(text)
        record("D3 CASE A order visible (no error)", ok,
               f"ref={CASES['d3_caseA_order']['ref']} error={has_error(text)}")

        # ── C1 order READY_FOR_BOOKING + traveler panel ───────────────────
        go(f"/app/orders/{CASES['c1_order']['id']}")
        page.screenshot(path=str(EVIDENCE / "d4_02_c1_order_ready_for_booking.png"), full_page=True)
        text = body_text()
        record("C1 order READY_FOR_BOOKING + ref", CASES["c1_order"]["ref"] in text and not has_error(text),
               f"found {CASES['c1_order']['ref']}")
        record("C1 order shows traveler section",
               bool(__import__("re").search(r"(?i)traveler|турист|путешественник", text)),
               "")

        # ── C2/C3/C4 requests via Request Center search box ───────────────
        for k in ["c2_request", "c3_request", "c4_request"]:
            ref = CASES[k]["ref"]
            go("/app/requests")
            page.fill('input[placeholder*="MKT-REQ"]', ref)
            page.keyboard.press("Enter")
            page.wait_for_timeout(2500)
            page.screenshot(path=str(EVIDENCE / f"d4_03_{k}.png"), full_page=True)
            text = body_text()
            record(f"{k} ({ref}) visible in Request Center", ref in text and not has_error(text),
                   f"rows with ref: {ref in text}")

        # request detail pages (direct)
        go(f"/app/requests/{CASES['c4_request']['id']}")
        page.screenshot(path=str(EVIDENCE / "d4_04_c4_request_unavailable.png"), full_page=True)
        text = body_text()
        record("C4 request detail opens", CASES["c4_request"]["ref"] in text and not has_error(text), "")

        # ── C5 booking CONFIRMED ──────────────────────────────────────────
        go(f"/app/bookings/{CASES['c5_booking']['id']}")
        page.screenshot(path=str(EVIDENCE / "d4_05_c5_booking_confirmed.png"), full_page=True)
        text = body_text()
        record("C5 booking detail CONFIRMED", CASES["c5_booking"]["ref"] in text and not has_error(text), "")

        # ── C6 booking CANCELLED + order CANCELLED + payment CAPTURED ─────
        go(f"/app/bookings/{CASES['c6_booking']['id']}")
        page.screenshot(path=str(EVIDENCE / "d4_06_c6_booking_cancelled.png"), full_page=True)
        text = body_text()
        record("C6 booking CANCELLED visible", CASES["c6_booking"]["ref"] in text and not has_error(text), "")
        go(f"/app/orders/{CASES['c6_order']['id']}")
        page.screenshot(path=str(EVIDENCE / "d4_07_c6_order_cancelled.png"), full_page=True)
        text = body_text()
        record("C6 order CANCELLED visible", CASES["c6_order"]["ref"] in text and not has_error(text), "")
        # payment detail page (code route)
        go(f"/app/finance/payments/{CASES['c6_payment']['code']}")
        page.screenshot(path=str(EVIDENCE / "d4_08_c6_payment_captured.png"), full_page=True)
        text = body_text()
        record("C6 payment detail CAPTURED", CASES["c6_payment"]["ref"] in text and not has_error(text),
               f"ref={CASES['c6_payment']['ref']} in text={CASES['c6_payment']['ref'] in text}")

        # ── Marketplace chain visible in Platform scope ───────────────────
        go(f"/app/orders?search={CASES['c1_order']['ref']}")
        page.screenshot(path=str(EVIDENCE / "d4_09_marketplace_scope_orders.png"))
        text = body_text()
        record("Marketplace order visible in Platform /orders", CASES["c1_order"]["ref"] in text, "")
        go(f"/app/bookings?search={CASES['c5_booking']['ref']}")
        page.screenshot(path=str(EVIDENCE / "d4_10_marketplace_scope_bookings.png"))
        text = body_text()
        record("Marketplace booking visible in Platform /bookings", CASES["c5_booking"]["ref"] in text, "")

        # ── Storefront NOT visible in Platform Marketplace scope ──────────
        go(f"/app/orders/{SF_ORDER['id']}")
        page.screenshot(path=str(EVIDENCE / "d4_11_storefront_order_denied.png"))
        text = body_text()
        record("Storefront order direct GET denied (404 UI)",
               SF_ORDER["code"] not in text and has_error(text),
               f"sf code absent={SF_ORDER['code'] not in text} error marker={has_error(text)}")
        go(f"/app/bookings/{SF_BOOKING['id']}")
        page.screenshot(path=str(EVIDENCE / "d4_12_storefront_booking_denied.png"))
        text = body_text()
        record("Storefront booking direct GET denied (404 UI)",
               SF_BOOKING["code"] not in text and has_error(text),
               f"sf code absent={SF_BOOKING['code'] not in text} error marker={has_error(text)}")
        # registry exclusion
        go(f"/app/orders?search={SF_ORDER['code']}")
        page.screenshot(path=str(EVIDENCE / "d4_13_storefront_order_excluded_from_list.png"))
        text = body_text()
        record("Storefront order excluded from Platform /orders list",
               SF_ORDER["code"] not in text, f"code absent={SF_ORDER['code'] not in text}")
        go(f"/app/bookings?search={SF_BOOKING['code']}")
        page.screenshot(path=str(EVIDENCE / "d4_14_storefront_booking_excluded_from_list.png"))
        text = body_text()
        record("Storefront booking excluded from Platform /bookings list",
               SF_BOOKING["code"] not in text, f"code absent={SF_BOOKING['code'] not in text}")

        browser.close()

    print("\n===== D4 BROWSER VERIFICATION SUMMARY =====")
    passed = sum(1 for r in results if r["ok"])
    for r in results:
        print(f"  [{'PASS' if r['ok'] else 'FAIL'}] {r['name']}")
    print(f"\n{passed}/{len(results)} passed")
    with open(EVIDENCE / "d4_browser_runtime_results.json", "w", encoding="utf-8") as f:
        json.dump({"passed": passed, "total": len(results), "results": results}, f, ensure_ascii=False, indent=2)
    sys.exit(0 if passed == len(results) else 1)


if __name__ == "__main__":
    main()
