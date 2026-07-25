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

        # Navigating to Buy Utility Cable TV page with mock active
        print("1. Navigating to Buy Cable TV page...")
        await page.goto("http://localhost:3000/bills?type=cable&mock=true")

        # Wait until the preloader goes away (which takes 1200ms + next compiling time)
        print("Waiting for page hydration and compilation...")
        await page.wait_for_timeout(5000)

        # Take intermediate screenshot to see what's on the page
        await page.screenshot(path="verification/screenshots/click_cable_debug.png")
        print("Debug screenshot 'click_cable_debug.png' taken.")

        print("Clicking DStv provider button...")
        provider_button = page.locator("button:has-text('DStv')").first
        await provider_button.wait_for(state="visible", timeout=15000)
        await provider_button.click()
        await page.wait_for_timeout(2000)

        print("Selecting DStv Yanga package...")
        await page.locator("button:has-text('Yanga')").first.click()
        await page.wait_for_timeout(1000)

        # Fill in smartcard number
        print("Entering smartcard/IUC number...")
        await page.fill("input[placeholder*='smartcard']", "1029384756")
        await page.wait_for_timeout(1000)

        print("Taking screenshot of Cable TV subscription selection...")
        await page.screenshot(path="verification/screenshots/cable_billing.png")

        await context.close()
        await browser.close()
        print("Visual verification screenshots and videos generated successfully!")

if __name__ == "__main__":
    asyncio.run(run())
