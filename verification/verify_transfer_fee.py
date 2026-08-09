import asyncio
import os
from playwright.async_api import async_playwright

async def run_cuj():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # Record video
        context = await browser.new_context(
            viewport={"width": 375, "height": 812},
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1",
            record_video_dir="verification/videos"
        )
        page = await context.new_page()

        os.makedirs("verification/screenshots", exist_ok=True)
        os.makedirs("verification/videos", exist_ok=True)

        page.on("console", lambda msg: print(f"BROWSER CONSOLE: {msg.type}: {msg.text}"))

        print("1. Preparing mock session state...")
        await page.goto("http://localhost:3055")
        await page.wait_for_timeout(1000)

        await page.evaluate("""() => {
            sessionStorage.setItem("mock", "true");
            sessionStorage.setItem("balance_visible", "true");
            sessionStorage.setItem("mock_user_data", JSON.stringify({
                "name": "JULES VERNE",
                "email": "jules@example.com",
                "pin": "1234",
                "balance": 750000,
                "kycStatus": "VERIFIED"
            }));
        }""")

        print("2. Navigating to Home Dashboard with Mock User...")
        await page.goto("http://localhost:3055/?mock=true")
        await page.wait_for_timeout(3000)

        print("3. Opening Transfer Drawer...")
        await page.locator("button:has-text('Transfer')").first.click()
        await page.wait_for_timeout(2000)

        print("4. Selecting Destination Bank...")
        # Click Choose Bank dropdown
        await page.locator("button:has-text('Choose bank...')").first.click()
        await page.wait_for_timeout(1500)

        # Select Wema Bank from list
        await page.locator("button:has-text('Wema Bank')").first.click()
        await page.wait_for_timeout(1500)

        print("5. Entering recipient account number...")
        # Focus and fill the account number input field
        await page.fill("input[placeholder*='0123456789']", "0123456789")
        await page.wait_for_timeout(2000)

        print("6. Entering transfer amount...")
        # Fill transfer amount field
        await page.fill("input[placeholder*='0.00']", "5000")
        await page.wait_for_timeout(2000)

        # Focus something else or trigger dynamic fee calculation
        await page.click("label:has-text('Amount to Send')")
        await page.wait_for_timeout(2000)

        # Verify "Transfer Fee" text is visible on the screen
        print("7. Taking verification screenshot...")
        screenshot_path = "verification/screenshots/transfer_fee_verification.png"
        await page.screenshot(path=screenshot_path)
        print(f"Screenshot taken at {screenshot_path}")

        await page.wait_for_timeout(2000)

        await context.close()
        await browser.close()
        print("Playwright run finished successfully!")

if __name__ == "__main__":
    asyncio.run(run_cuj())
