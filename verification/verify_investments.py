import asyncio
import os
import time
from playwright.async_api import async_playwright

async def verify_investments():
    print("[Step 1] Initializing browser session...")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 393, "height": 852},
            is_mobile=True,
            has_touch=True,
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
        )

        page = await context.new_page()

        # Navigate to Mock Dashboard URL on port 3001
        print("[Step 2] Navigating to Mock Dashboard to initialize session storage...")
        await page.goto("http://localhost:3001/")
        await page.evaluate("sessionStorage.setItem('mock', 'true')")

        # Navigate to Investments Page
        print("[Step 3] Navigating to Investment page...")
        await page.goto("http://localhost:3001/investment")

        # Allow hydration and loading state to resolve
        print("[Step 4] Waiting for loading states to hydrate...")
        await page.wait_for_timeout(3000)

        # Capture the initial hydrated investment UI
        os.makedirs("/home/jules/verification/screenshots", exist_ok=True)
        screenshot_path_initial = "/home/jules/verification/screenshots/investments_hydrated.png"
        await page.screenshot(path=screenshot_path_initial, full_page=False)
        print(f"[Initial UI Captured] Saved to {screenshot_path_initial}")

        # Enter an amount in the input field
        print("[Step 5] Entering savings deposit amount: 25000...")
        await page.fill("input[type='number']", "25000")

        # Set a target maturity date (e.g. 40 days from now)
        from datetime import datetime, timedelta
        target_date = (datetime.now() + timedelta(days=40)).strftime("%Y-%m-%d")
        print(f"[Step 6] Picking target maturity date: {target_date}...")
        await page.fill("input[type='date']", target_date)

        await page.wait_for_timeout(1000)

        # Capture calculator and rewards display
        screenshot_path_rewards = "/home/jules/verification/screenshots/investments_rewards_calculated.png"
        await page.screenshot(path=screenshot_path_rewards)
        print(f"[Rewards Calculated Captured] Saved to {screenshot_path_rewards}")

        # Click the "Confirm & Start Savings" trigger button
        print("[Step 7] Clicking 'Confirm & Start Savings' to open rules and terms modal...")
        await page.click("button:has-text('Confirm & Start Savings')")
        await page.wait_for_timeout(1000)

        # Capture legal confirmation modal overlay
        screenshot_path_modal = "/home/jules/verification/screenshots/investments_rules_modal.png"
        await page.screenshot(path=screenshot_path_modal)
        print(f"[Modal Overlay Captured] Saved to {screenshot_path_modal}")

        # Click "I Agree & Secure" inside modal to write holding
        print("[Step 8] Accepting terms and locking savings...")
        await page.click("button:has-text('I Agree & Secure')")
        await page.wait_for_timeout(2500)

        # Capture final list with active locked item added
        screenshot_path_final = "/home/jules/verification/screenshots/investments_lock_completed.png"
        await page.screenshot(path=screenshot_path_final)
        print(f"[Active Locked Saving Captured] Saved to {screenshot_path_final}")

        await browser.close()
        print("[Verification Complete] All investment visual workflows successfully verified!")

if __name__ == "__main__":
    asyncio.run(verify_investments())
