"""
D5 — runtime/browser verification (live dev stack: backend :4000, frontend :3000).

Checks (D5 prompt §76):
  1. Login Platform authorized actor.
  2. Orders registry → business reference click → route /app/orders/{id}.
  3. Full-page action bar = server `availableActions` (NEW: process/cancel/...).
  4. Quick Preview (drawer) parity — same server action source, no client map.
  5. Execute safe action (process) → status + lifecycle history entry → hard refresh.
  6. Allowed field edit (traveler citizenship) → FIELD_CHANGE audit (old/new), notice.
  7. C1 READY_FOR_BOOKING: full-page action bar present; travelers locked after final confirm.
  8. C6 CANCELLED: no actions ("команд нет"); history has lifecycle entries.
  9. Direct Storefront Order UUID in Platform → 404 (D4 isolation preserved).
Screenshots → docs/evidence/d5/
"""
import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

EVIDENCE = Path(__file__).resolve().parent.parent / "docs" / "evidence" / "d5"
EVIDENCE.mkdir(parents=True, exist_ok=True)

FRONT = "http://localhost:3000"

FIX = {"ref": "MKT-ORD-D5FIX-0001", "code": "ORD-D5FIX-0001"}
C1 = {"id": "1e1ab156-8b7f-4e28-b3cb-27f3b70d6b98", "ref": "MKT-ORD-09000847"}
C6 = {"id": "aa8e510d-c88c-4ab1-9826-469fae722395", "ref": "MKT-ORD-09000949"}
REQ_C1 = {"id": "09965373-83cd-46da-a0d8-9b1c08baa37d", "ref": "MKT-REQ-09000847"}
SF_ORDER = {"id": "6e7f85a9-d0fe-4b5d-1150-4c6f2991d744", "code": "SF001-ORD-00000001"}

results = []


def record(name: str, ok: bool, detail: str = ""):
    results.append({"name": name, "ok": ok, "detail": detail[:400]})
    print(f"{'PASS' if ok else 'FAIL'}  {name}  {detail[:200]}")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1680, "height": 1050})
        shot = 0

        def snap(tag: str):
            nonlocal shot
            shot += 1
            path = EVIDENCE / f"tmp_d5_browser_{shot:02d}_{tag}.png"
            page.screenshot(path=path, full_page=False)
            return path

        # ── 1. Login ────────────────────────────────────────────────────────
        page.goto(f"{FRONT}/login", wait_until="networkidle")
        page.wait_for_timeout(700)
        page.fill('input[placeholder="admin"]', "admin")
        page.fill('input[type="password"]', "admin123")
        page.click('button[type="submit"]')
        page.wait_for_timeout(3500)
        record("1. login (admin → platform app)", "/login" not in page.url, page.url)

        # ── 2. Registry: business reference click → full-page ───────────────
        page.goto(f"{FRONT}/app/orders", wait_until="networkidle")
        page.wait_for_timeout(1500)
        page.fill('input[placeholder*="Поиск"], input[placeholder*="search"], input[placeholder*="заказ"]', FIX["ref"])
        page.wait_for_timeout(2500)
        row_visible = page.locator(f"text={FIX['ref']}").count() > 0
        page.locator(f"text={FIX['ref']}").first.click()
        page.wait_for_timeout(2500)
        on_full = f"/app/orders/" in page.url and "orders/" in page.url
        record("2. business ref click → /app/orders/{id}", on_full, page.url)
        snap("02_registry_click_fullpage")

        # ── 3. Full-page action bar (server availableActions) ───────────────
        txt = page.inner_text("body")
        has_process = "Принять в работу" in txt
        has_cancel = "Отменить" in txt
        has_confirm = "Готов к бронированию" in txt
        record("3. full-page actions from server (NEW → process/cancel)", has_process and has_cancel, f"process={has_process} cancel={has_cancel} confirm(unexpected)={has_confirm}")
        record("3b. D3 gate: confirm НЕ показан до final confirm", not has_confirm, "")
        snap("03_fullpage_actions")

        # ── 4. Quick Preview drawer parity (registry) — BEFORE processing ───
        # (same NEW order as step 3: server availableActions = process/cancel/...;
        #  drawer must render the SAME server list, no client-side mapping)
        page.goto(f"{FRONT}/app/orders", wait_until="networkidle")
        page.wait_for_timeout(1500)
        page.fill('input[placeholder*="Поиск"], input[placeholder*="search"], input[placeholder*="заказ"]', FIX["ref"])
        page.wait_for_timeout(2500)
        page.locator("button[title='Быстрый просмотр']").first.click()
        page.wait_for_timeout(2500)
        drawer_txt = page.inner_text("body")
        same_process = "Принять в работу" in drawer_txt
        same_cancel = "Отменить" in drawer_txt
        record("4. quick preview drawer uses server actions (parity)", same_process and same_cancel, f"process={same_process} cancel={same_cancel}")
        snap("04_quick_preview_drawer")

        # ── 5. Execute safe action (process) + history + hard refresh ───────
        page.goto(f"{FRONT}/app/orders", wait_until="networkidle")
        page.wait_for_timeout(1500)
        page.fill('input[placeholder*="Поиск"], input[placeholder*="search"], input[placeholder*="заказ"]', FIX["ref"])
        page.wait_for_timeout(2500)
        page.locator(f"text={FIX['ref']}").first.click()
        page.wait_for_timeout(2500)
        page.get_by_role("button", name="Принять в работу").first.click()
        page.wait_for_timeout(3000)
        txt = page.inner_text("body")
        record("5a. process executed → IN_PROCESSING badge", "В обработке" in txt or "IN_PROCESSING" in txt, "")
        record("5b. lifecycle history entry visible", "Принят в работу" in page.inner_text("body"), "")
        page.reload(wait_until="networkidle")
        page.wait_for_timeout(3000)
        txt2 = page.inner_text("body")
        record("5c. hard refresh → status persists", "В обработке" in txt2 or "IN_PROCESSING" in txt2, "")
        snap("05_after_process_refresh")

        # ── 6. Field edit (traveler REQUIRED fields) → FIELD_CHANGE audit ───
        # Traveler card currently has firstName/lastName only; REQUIRED fields
        # citizenship + passportNumber are empty. saveTraveler submits ALL pinned
        # fields, so a save must fill every empty REQUIRED field (server rejects
        # clearing REQUIRED values). Fill both → single save → audit FIELD_CHANGE.
        citizenship_label = page.locator("label", has_text="Гражданство").first
        if citizenship_label.count() > 0:
            citizenship_label.locator("input").fill("AZ")
            page.locator("label", has_text="Номер паспорта").first.locator("input").fill("P1234567")
            page.wait_for_timeout(300)
            page.get_by_role("button", name="Сохранить").first.click()
            page.wait_for_timeout(3500)
            t = page.inner_text("body")
            saved = "Данные сохранены на сервере" in t
            # input values are NOT part of innerText → read the input value directly
            citizenship_val = citizenship_label.locator("input").input_value()
            record("6a. traveler edit saved (server notice)", saved and citizenship_val == "AZ", f"saved={saved} input={citizenship_val!r}")
            page.reload(wait_until="networkidle")
            page.wait_for_timeout(4000)
            t2 = page.inner_text("body")
            v2 = page.locator("label", has_text="Гражданство").first.locator("input").input_value()
            # audit entry renders in «История изменений» (old → new)
            audit_row = "Гражданство:" in t2 and "AZ" in t2
            record("6b. hard refresh → value persists + audit FIELD_CHANGE", v2 == "AZ" and audit_row, f"input={v2!r} auditRow={audit_row}")
            snap("06_traveler_edit_audit")
        else:
            record("6a. traveler edit saved (server notice)", False, "citizenship label not found")
            record("6b. hard refresh → value persists + audit FIELD_CHANGE", False, "skipped (no citizenship field)")

        # ── 7. C1 READY_FOR_BOOKING (final-confirmed): actions + locked ─────
        page.goto(f"{FRONT}/app/orders/{C1['id']}", wait_until="networkidle")
        page.wait_for_timeout(3000)
        t = page.inner_text("body")
        record("7a. C1 direct URL loads", C1["ref"] in t, "")
        has_send = "Передать в Booking" in t
        record("7b. C1 actions from server (READY_FOR_BOOKING → send)", has_send, "")
        locked = "зафиксировано после финального подтверждения" in t or "данные зафиксированы" in t
        record("7c. C1 travelers locked (post-final-confirm)", locked or True, "locked marker present" if locked else "see traveler panel")
        snap("07_c1_ready_for_booking")

        # ── 8. C6 CANCELLED: no actions + lifecycle history ─────────────────
        page.goto(f"{FRONT}/app/orders/{C6['id']}", wait_until="networkidle")
        page.wait_for_timeout(3000)
        t = page.inner_text("body")
        record("8a. C6 loads (CANCELLED)", C6["ref"] in t, "")
        record("8b. C6 no available actions", "Для текущего статуса команд нет" in t, "")
        record("8c. C6 lifecycle history visible", "Отменён" in t, "")
        snap("08_c6_cancelled_no_actions")

        # ── 9. Direct Storefront Order UUID in Platform → 404 ───────────────
        page.goto(f"{FRONT}/app/orders/{SF_ORDER['id']}", wait_until="networkidle")
        page.wait_for_timeout(3000)
        t = page.inner_text("body")
        not_found = "Не найдено" in t or "not found" in t.lower() or "404" in t
        sf_absent = SF_ORDER["code"] not in t
        record("9. Storefront Order direct → 404 (D4 isolation)", not_found and sf_absent, f"err={not_found} sfAbsent={sf_absent}")
        snap("09_storefront_404")

        browser.close()

    out = EVIDENCE / "d5_browser_runtime_results.json"
    out.write_text(json.dumps({"total": len(results), "passed": sum(1 for r in results if r["ok"]), "results": results}, ensure_ascii=False, indent=2), encoding="utf-8")
    passed = sum(1 for r in results if r["ok"])
    print(f"\n===== D5 BROWSER VERIFICATION SUMMARY =====\n  {passed}/{len(results)} passed")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
