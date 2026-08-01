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

        # 1. Load the login page first
        print("[Playwright Verification] Loading login page...")
        page.goto("http://localhost:3000/auth/login")
        page.wait_for_timeout(1000)

        # 2. Inject mock playtest authorization bypass
        print("[Playwright Verification] Injecting mock playtest authorization bypass...")
        page.evaluate('() => { window.sessionStorage.setItem("mock", "true"); }')
        page.wait_for_timeout(1000)

        # 3. Navigate to referrals page
        print("[Playwright Verification] Navigating to referrals dashboard...")
        page.goto("http://localhost:3000/referrals")
        page.wait_for_timeout(2000)

        # Take screenshot of referrals page
        print("[Playwright Verification] Taking referrals page screenshot...")
        page.screenshot(path="verification/screenshots/referrals_page.png")
        page.wait_for_timeout(1000)

        # 4. Navigate back to Home and check ServiceGrid with Referral icon
        print("[Playwright Verification] Navigating to homepage dashboard...")
        page.goto("http://localhost:3000/")
        page.evaluate('() => { window.sessionStorage.setItem("mock", "true"); }')
        page.goto("http://localhost:3000/")
        page.wait_for_timeout(2500)

        # Take screenshot of homepage showing the Referral icon!
        print("[Playwright Verification] Taking homepage dashboard screenshot...")
        page.screenshot(path="verification/screenshots/dashboard.png")
        page.wait_for_timeout(1000)

        # 5. Navigate to profile page
        print("[Playwright Verification] Navigating to profile page...")
        page.goto("http://localhost:3000/profile")
        page.evaluate('() => { window.sessionStorage.setItem("mock", "true"); }')
        page.goto("http://localhost:3000/profile")
        page.wait_for_timeout(2500)

        # Take screenshot of profile page showing the Referral Program card!
        print("[Playwright Verification] Taking profile page screenshot...")
        page.screenshot(path="verification/screenshots/profile_page.png")
        page.wait_for_timeout(1000)

        print("[Playwright Verification] Closing browser context...")
        context.close()
        browser.close()
        print("[Playwright Verification] Completed successfully.")

if __name__ == "__main__":
    run_verification()
