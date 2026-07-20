import asyncio
from playwright.async_api import async_playwright
import os

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        # Create context recording video
        context = await browser.new_context(
            viewport={"width": 375, "height": 812},
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1",
            record_video_dir="verification/videos"
        )
        page = await context.new_page()

        os.makedirs("verification/screenshots", exist_ok=True)
        os.makedirs("verification/videos", exist_ok=True)

        # 1. AIRTIME BILLING SCREEN VERIFICATION
        print("1. Navigating to Buy Airtime page...")
        await page.goto("http://localhost:3055/bills?type=airtime&mock=true")
        await page.wait_for_timeout(2000)

        print("Selecting MTN Airtime provider...")
        await page.locator("button:has-text('MTN')").first.click()
        await page.wait_for_timeout(1500)

        print("Selecting MTN Airtime Topup package...")
        await page.locator("button:has-text('MTN Airtime Topup')").first.click()
        await page.wait_for_timeout(1000)

        # Verify presets exist and click one
        print("Clicking ₦500 airtime preset...")
        await page.locator("button:has-text('₦500')").first.click()
        await page.wait_for_timeout(1000)

        # Fill in phone number
        print("Entering phone number...")
        await page.fill("input[placeholder*='phone']", "08012345678")
        await page.wait_for_timeout(1000)

        print("Taking screenshot of Airtime billing presets...")
        await page.screenshot(path="verification/screenshots/airtime_billing.png")

        # 2. MOBILE DATA BILLING SCREEN VERIFICATION
        print("2. Navigating to Buy Mobile Data page...")
        await page.goto("http://localhost:3055/bills?type=data&mock=true")
        await page.wait_for_timeout(2000)

        print("Selecting MTN Mobile Data...")
        await page.locator("button:has-text('MTN')").first.click()
        await page.wait_for_timeout(1500)

        # Click on MTN 1GB Data Plan (30 Days)
        print("Selecting MTN 1GB Data Plan...")
        await page.locator("button:has-text('1GB')").first.click()
        await page.wait_for_timeout(1000)

        # Scroll down to make pricing mode toggles visible
        await page.evaluate("window.scrollTo(0, 300);")
        await page.wait_for_timeout(500)

        # Select custom price override option
        print("Selecting Custom Price mode...")
        await page.locator("button:has-text('Enter Custom Price')").first.click()
        await page.wait_for_timeout(1000)

        # Type custom price
        print("Typing custom price of ₦300...")
        await page.fill("input[placeholder*='500']", "300")
        await page.wait_for_timeout(1000)

        # Enter phone number
        print("Entering data recipient phone number...")
        await page.fill("input[placeholder*='phone']", "08012345678")
        await page.wait_for_timeout(1000)

        print("Taking screenshot of Mobile Data billing with GB plans and Custom Price override...")
        await page.screenshot(path="verification/screenshots/data_billing.png")

        # 3. TRANSFER MODAL HEIGHT VERIFICATION
        print("3. Navigating to Dashboard...")
        await page.goto("http://localhost:3055/?mock=true")
        await page.wait_for_timeout(2500)

        print("Opening Transfer Drawer...")
        await page.locator("button:has-text('Transfer')").first.click()
        await page.wait_for_timeout(1500)

        print("Taking screenshot of 90% Height Transfer Drawer...")
        await page.screenshot(path="verification/screenshots/transfer_modal.png")

        await context.close()
        await browser.close()
        print("Visual verification screenshots and videos generated successfully!")

if __name__ == "__main__":
    asyncio.run(run())
