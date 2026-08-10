import os
from playwright.sync_api import sync_playwright

def run_verification():
    print("[Playwright Verification] Starting browser...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Enable video recording
        context = browser.new_context(
            viewport={"width": 412, "height": 915}, # premium mobile size
            record_video_dir="verification/videos"
        )
        page = context.new_page()

        # Listen to page console logs for debugging
        page.on("console", lambda msg: print(f"[Browser Console] {msg.type}: {msg.text}"))
        page.on("pageerror", lambda err: print(f"[Browser PageError] {err}"))

        # 1. Load login page
        print("[Playwright Verification] Loading login page...")
        page.goto("http://localhost:3000/auth/login")
        page.wait_for_timeout(1500)

        # 2. Inject mock playtest authorization bypass
        print("[Playwright Verification] Injecting mock playtest authorization bypass...")
        page.evaluate('() => { window.sessionStorage.setItem("mock", "true"); }')
        page.wait_for_timeout(1500)

        # 3. Navigate to profile page
        print("[Playwright Verification] Navigating to profile page...")
        page.goto("http://localhost:3000/profile")
        page.wait_for_timeout(1500)

        # Ensure sessionStorage is kept active and reload
        page.evaluate('() => { window.sessionStorage.setItem("mock", "true"); }')
        page.goto("http://localhost:3000/profile")

        print("[Playwright Verification] Waiting 15 seconds for Next.js dev compilation...")
        page.wait_for_timeout(15000)

        # Take screenshot of profile page showing the button
        print("[Playwright Verification] Taking profile page screenshot...")
        os.makedirs("verification/screenshots", exist_ok=True)
        page.screenshot(path="verification/screenshots/profile_page_with_verify_btn.png")
        page.wait_for_timeout(1000)

        # 4. Click the "Verify My Identity" button
        print("[Playwright Verification] Clicking 'Verify My Identity' button...")
        page.get_by_role("button", name="Verify My Identity").click()
        page.wait_for_timeout(1500)

        # Take screenshot of open drawer
        print("[Playwright Verification] Taking screenshot of the active KYC Verification Drawer...")
        page.screenshot(path="verification/screenshots/kyc_drawer_active.png")
        page.wait_for_timeout(1000)

        # 5. Fill in some data
        print("[Playwright Verification] Entering mock BVN/NIN number...")
        page.get_by_placeholder("Enter 11-digit BVN...").fill("12345678901")
        page.wait_for_timeout(1000)

        # Take screenshot with filled input
        print("[Playwright Verification] Taking screenshot with filled input...")
        page.screenshot(path="verification/screenshots/kyc_drawer_filled.png")
        page.wait_for_timeout(1000)

        print("[Playwright Verification] Closing browser context...")
        context.close()
        browser.close()
        print("[Playwright Verification] Completed successfully.")

if __name__ == "__main__":
    run_verification()
