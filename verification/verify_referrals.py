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

        # 2. Inject mock session storage bypass
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

        # 4. Navigate back to Home and open Fund Wallet Checkout Drawer
        print("[Playwright Verification] Navigating to homepage dashboard...")
        page.goto("http://localhost:3000/")
        page.wait_for_timeout(2000)

        # Find the Fund/Add button or click Balance Card funding area
        print("[Playwright Verification] Locating Fund button...")
        # Search for buttons or text "Fund"
        fund_button = page.get_by_role("button", name="Fund")
        if fund_button.is_visible():
            print("[Playwright Verification] Clicking Fund button...")
            fund_button.click()
            page.wait_for_timeout(1000)
            print("[Playwright Verification] Taking Fund drawer screenshot...")
            page.screenshot(path="verification/screenshots/fund_drawer.png")
            page.wait_for_timeout(1000)
        else:
            # Try clicking elements with text containing "Fund"
            fund_el = page.locator("text=Fund").first
            if fund_el.is_visible():
                print("[Playwright Verification] Clicking Fund text locator...")
                fund_el.click()
                page.wait_for_timeout(1000)
                print("[Playwright Verification] Taking Fund drawer screenshot...")
                page.screenshot(path="verification/screenshots/fund_drawer.png")
                page.wait_for_timeout(1000)

        print("[Playwright Verification] Closing browser context...")
        context.close()
        browser.close()
        print("[Playwright Verification] Completed successfully.")

if __name__ == "__main__":
    run_verification()
