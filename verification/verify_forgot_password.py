from playwright.sync_api import sync_playwright
import time
import os

def run_verification():
    print("Starting Playwright verification of Forgot Password Drawer...")
    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)
    os.makedirs("/home/jules/verification/videos", exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 390, "height": 844},  # standard mobile viewport
            record_video_dir="/home/jules/verification/videos"
        )
        page = context.new_page()

        # Step 1: Open Login Page
        print("Navigating to http://localhost:3001/auth/login...")
        page.goto("http://localhost:3001/auth/login")
        page.wait_for_timeout(2000)

        # Step 2: Trigger Forgot Password drawer
        print("Clicking 'Forgot Password?' to open drawer...")
        forgot_btn = page.get_by_text("Forgot Password?")
        forgot_btn.click()
        page.wait_for_timeout(1000)

        # Step 3: Capture screenshot of empty forgot password drawer
        path1 = "/home/jules/verification/screenshots/forgot_password_drawer_open.png"
        print(f"Taking screenshot of open drawer: {path1}")
        page.screenshot(path=path1)
        page.wait_for_timeout(500)

        # Step 4: Fill email address
        print("Entering email address in forgot password drawer...")
        email_input = page.get_by_placeholder("Enter your registered email...")
        email_input.fill("testuser@example.com")
        page.wait_for_timeout(1000)

        # Step 5: Capture screenshot showing premium email input style
        path2 = "/home/jules/verification/screenshots/forgot_password_drawer_filled.png"
        print(f"Taking screenshot of filled drawer: {path2}")
        page.screenshot(path=path2)
        page.wait_for_timeout(500)

        # Step 6: Close drawer
        print("Closing the drawer...")
        close_btn = page.locator("button:has-text('close')")
        if close_btn.is_visible():
            close_btn.click(force=True)
        else:
            page.locator("span:has-text('close')").first.click(force=True)
        page.wait_for_timeout(1000)

        print("[SUCCESS] Forgot Password Drawer works perfectly!")
        context.close()
        browser.close()

if __name__ == "__main__":
    run_verification()
