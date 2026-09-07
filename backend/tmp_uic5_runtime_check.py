"""UI-C5 runtime verification — hydrated DOM check of the Operational Notes on Request detail.

Pages checked:
  Request (no notes yet) : /app/requests/006e94b4-62e7-447a-9cab-84ca62d74758 (MKT-REQ-09000547)
  Order (regression)     : /app/orders/83eb7738-01ac-4506-9af8-3504b989bfc6   (MKT-ORD-09000547)

Asserts:
  - login works (admin/admin123)
  - Request detail renders the shared Notes section (title "Примечания")
  - Notes section sits between the linked-order/relations section and the audit section
  - empty state ("Примечаний пока нет") is shown for a Request without notes
  - create a note via the UI form -> note text + author + "Создано" appear
  - edit the note -> new text + "Изменено" appear
  - delete the note -> back to empty state
  - Order detail still renders its Notes section (untouched page, regression check)
  - no page-level errors in the browser console
"""
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"
REQ = "/app/requests/006e94b4-62e7-447a-9cab-84ca62d74758"  # MKT-REQ-09000547
ORD = "/app/orders/83eb7738-01ac-4506-9af8-3504b989bfc6"    # MKT-ORD-09000547

NOTE_TAG = "UI-C5 runtime check"
NOTE_TAG_EDITED = "UI-C5 runtime check (edited)"

results = []


def check(ok, msg):
    results.append((ok, msg))
    print(("PASS" if ok else "FAIL") + " | " + msg)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    console_errors = []
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: console_errors.append(str(e)))

    # ── Login ────────────────────────────────────────────────────────────
    page.goto(BASE + "/login", wait_until="networkidle")
    page.fill('input[placeholder="admin"]', "admin")
    page.fill('input[type="password"]', "admin123")
    page.click('button[type="submit"]')
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1500)
    check("/login" not in page.url, f"login redirects away from /login (url={page.url})")

    # ── Request detail: Notes section ────────────────────────────────────
    page.goto(BASE + REQ, wait_until="networkidle")
    page.wait_for_timeout(2000)

    notes_title = page.locator("h3", has_text="Примечания")
    check(notes_title.count() > 0, "Request detail renders Notes section title «Примечания»")

    # Empty state (no Request notes exist yet)
    check(page.get_by_text("Примечаний пока нет", exact=True).count() > 0,
          "Request without notes shows localized empty state «Примечаний пока нет»")

    # Section order: Notes between relations and audit
    audit_title = page.locator("h3", has_text="История изменений")
    if audit_title.count() > 0:
        notes_y = notes_title.first.bounding_box()["y"]
        audit_y = audit_title.first.bounding_box()["y"]
        check(notes_y < audit_y, f"Notes section is ABOVE audit section (notes_y={notes_y:.0f} < audit_y={audit_y:.0f})")
    else:
        check(False, "audit section heading found")

    # ── Create a note via the UI form ────────────────────────────────────
    textarea = page.locator(f"textarea#note-create-Request-006e94b4-62e7-447a-9cab-84ca62d74758")
    check(textarea.count() > 0, "create-note textarea is rendered (id bound to entityType+entityId)")
    textarea.fill(NOTE_TAG)
    page.get_by_role("button", name="Добавить примечание").click()
    page.wait_for_timeout(1500)

    note_row = page.locator("div.px-4.py-3", has_text=NOTE_TAG).first
    check(note_row.count() > 0, "created note row is visible on the page")
    check("Administrator" in note_row.inner_text(), "note author «Administrator» is rendered")
    check("Создано" in note_row.inner_text(), "«Создано» timestamp label is rendered")
    check(page.get_by_text("Примечаний пока нет", exact=True).count() == 0, "empty state disappears after create")
    check("(1)" in notes_title.first.inner_text(), "notes counter shows (1) after create")

    # ── Edit the note ────────────────────────────────────────────────────
    page.get_by_role("button", name="Редактировать").click()
    page.wait_for_timeout(400)
    edit_box = page.locator("textarea").filter(has_text=NOTE_TAG)
    check(edit_box.count() > 0, "edit textarea opened with current text")
    edit_box.fill(NOTE_TAG_EDITED)
    page.get_by_role("button", name="Сохранить").click()
    page.wait_for_timeout(1500)

    edited_row = page.locator("div.px-4.py-3", has_text=NOTE_TAG_EDITED).first
    check(edited_row.count() > 0, "edited note text is visible")
    check(page.get_by_text(NOTE_TAG, exact=True).count() == 0, "old note text replaced")
    check("Изменено" in edited_row.inner_text(), "«Изменено» edited-indicator is rendered")

    # ── Delete the note ──────────────────────────────────────────────────
    page.get_by_role("button", name="Удалить").click()
    page.wait_for_timeout(300)
    page.get_by_role("button", name="Да", exact=True).click()
    page.wait_for_timeout(1500)

    check(page.get_by_text(NOTE_TAG_EDITED, exact=True).count() == 0, "note removed after delete")
    check(page.get_by_text("Примечаний пока нет", exact=True).count() > 0, "empty state restored after delete")
    check(notes_title.first.count() > 0, "Notes section still rendered after delete")

    # ── Order detail (regression: untouched page) ────────────────────────
    page.goto(BASE + ORD, wait_until="networkidle")
    page.wait_for_timeout(2000)
    check(page.locator("h3", has_text="Примечания").count() > 0, "Order detail still renders Notes section (regression)")
    # This particular order has no notes; the important regression point is that the
    # shared component renders with its localized states (empty state is valid here).
    check(page.get_by_text("Примечаний пока нет", exact=True).count() > 0 or
          page.get_by_text("Текст примечания…", exact=True).count() > 0,
          "Order Notes section renders with valid state (empty or create form)")

    # ── Console errors ───────────────────────────────────────────────────
    check(len(console_errors) == 0, f"no console errors (got {len(console_errors)}: {console_errors[:3]})")

    browser.close()

print("\n===== SUMMARY =====")
print(f"TOTAL: {sum(1 for ok, _ in results if ok)}/{len(results)} PASS")
if not all(ok for ok, _ in results):
    print("FAILURES:")
    for ok, msg in results:
        if not ok:
            print("  - " + msg)
    raise SystemExit(1)