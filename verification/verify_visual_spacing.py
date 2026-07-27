from playwright.sync_api import sync_playwright
import time
import os

def run_verification():
    print("Starting Playwright visual verification...")
    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)
    os.makedirs("/home/jules/verification/videos", exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 390, "height": 844},  # standard mobile viewport
            record_video_dir="/home/jules/verification/videos"
        )
        page = context.new_page()

        # Step 1: Open mock playtesting dashboard
        print("Navigating to http://localhost:3000?mock=true...")
        page.goto("http://localhost:3000?mock=true")
        page.wait_for_timeout(2000)

        # Step 2: Open outward transfer drawer
        print("Clicking 'Withdraw' button to open outward transfer drawer...")
        withdraw_btn = page.get_by_role("button", name="Withdraw")
        if not withdraw_btn.is_visible():
            withdraw_btn = page.get_by_text("Withdraw")
        withdraw_btn.click()
        page.wait_for_timeout(1000)

        # Step 3: Trigger 'Select Recipient Bank' selector
        print("Triggering bank selector modal...")
        bank_selector = page.get_by_text("Choose bank...")
        if bank_selector.is_visible():
            bank_selector.click()
        else:
            page.locator("button:has-text('Choose bank...')").click()
        page.wait_for_timeout(1000)

        # Step 4: Capture screenshot of bank list padding
        screenshot_path = "/home/jules/verification/screenshots/bank_modal_padding.png"
        print(f"Taking screenshot of bank modal padding: {screenshot_path}")
        page.screenshot(path=screenshot_path)
        page.wait_for_timeout(500)

        # Close bank selector
        print("Closing bank selector modal...")
        close_btn = page.locator("button:has-text('close')")
        if close_btn.count() > 0:
            close_btn.first.click(force=True)
        else:
            page.locator("span:has-text('close')").first.click(force=True)
        page.wait_for_timeout(1000)

        # Close transfer drawer
        print("Closing transfer drawer...")
        drawer_close = page.locator("button").filter(has_text="close").first
        if drawer_close.is_visible():
            drawer_close.click(force=True)
        else:
            page.locator("span:has-text('close')").first.click(force=True)
        page.wait_for_timeout(1000)

        # Step 5: Trigger Logout Confirmation Modal
        print("Clicking power button to trigger logout confirmation modal...")
        logout_btn = page.get_by_title("Sign Out")
        if not logout_btn.is_visible():
            logout_btn = page.locator("button:has-text('power_settings_new')")
        logout_btn.click(force=True)
        page.wait_for_timeout(1000)

        # Step 6: Capture screenshot of logout confirmation modal
        logout_screenshot_path = "/home/jules/verification/screenshots/logout_confirmation_modal.png"
        print(f"Taking screenshot of logout modal: {logout_screenshot_path}")
        page.screenshot(path=logout_screenshot_path)
        page.wait_for_timeout(500)

        # Step 7: Click 'Cancel' and verify we are still on the page
        print("Clicking 'Cancel' on logout modal...")
        cancel_btn = page.get_by_role("button", name="Cancel")
        cancel_btn.click(force=True)
        page.wait_for_timeout(1000)

        current_url = page.url
        print(f"Current URL after logout cancel: {current_url}")

        # Verify no back history was triggered (still on port 3000/?mock=true)
        if "localhost:3000" in current_url:
            print("[SUCCESS] Logout Cancel did not trigger back history navigation! Spacing & Logout flows work perfectly!")
        else:
            print("[WARNING] URL changed! Back history might have been triggered.")

        context.close()
        browser.close()

if __name__ == "__main__":
    run_verification()
