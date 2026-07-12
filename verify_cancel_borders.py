import asyncio
from playwright.async_api import async_playwright
import os

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(
            viewport={"width": 320, "height": 568},
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1"
        )
        page = await context.new_page()

        print("Navigating to profile with mock session...")
        await page.goto("http://localhost:3001/profile?mock=true")
        await page.wait_for_timeout(2000)

        # Trigger biometric scan drawer to see the Cancel button
        print("Opening Biometric Face Scan Drawer...")
        await page.click("text=Take Selfie")
        await page.wait_for_timeout(1000)

        os.makedirs("verification", exist_ok=True)
        print("Capturing premium simulated scanner Cancel button...")
        await page.screenshot(path="verification/cancel_button_gradient_scan.png", full_page=False)

        # Close and trigger Sign Out to see the logout cancel button
        await page.click("text=Cancel")
        await page.wait_for_timeout(1000)

        print("Opening Sign Out Confirmation Drawer...")
        await page.click("text=Sign Out from Device")
        await page.wait_for_timeout(1000)

        print("Capturing sign out cancel button...")
        await page.screenshot(path="verification/cancel_button_gradient_logout.png", full_page=False)

        await browser.close()
        print("All visual verification screenshots generated successfully!")

if __name__ == "__main__":
    asyncio.run(run())
