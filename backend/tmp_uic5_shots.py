"""UI-C5 evidence screenshots: Request notes section (with note) + after delete."""
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"
REQ = "/app/requests/006e94b4-62e7-447a-9cab-84ca62d74758"
NOTE_TAG = "UI-C5 runtime evidence"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.goto(BASE + "/login", wait_until="networkidle")
    page.fill('input[placeholder="admin"]', "admin")
    page.fill('input[type="password"]', "admin123")
    page.click('button[type="submit"]')
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1500)

    page.goto(BASE + REQ, wait_until="networkidle")
    page.wait_for_timeout(2000)

    # create a note
    page.locator("textarea#note-create-Request-006e94b4-62e7-447a-9cab-84ca62d74758").fill(NOTE_TAG)
    page.get_by_role("button", name="Добавить примечание").click()
    page.wait_for_timeout(1500)

    # scroll to notes section and screenshot
    notes = page.locator("h3", has_text="Примечания").first
    notes.scroll_into_view_if_needed()
    page.wait_for_timeout(500)
    page.screenshot(path="uic5_shots/request_notes_with_note.png", full_page=False)

    # delete the note (cleanup)
    page.get_by_role("button", name="Удалить").click()
    page.wait_for_timeout(300)
    page.get_by_role("button", name="Да", exact=True).click()
    page.wait_for_timeout(1500)

    page.locator("h3", has_text="Примечания").first.scroll_into_view_if_needed()
    page.wait_for_timeout(500)
    page.screenshot(path="uic5_shots/request_notes_empty.png", full_page=False)

    browser.close()
    print("screenshots saved")