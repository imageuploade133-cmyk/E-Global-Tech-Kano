import asyncio
import os
from playwright.async_api import async_playwright

async def run_cuj():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1280, "height": 800},
            record_video_dir="verification/videos"
        )
        page = await context.new_page()

        os.makedirs("verification/screenshots", exist_ok=True)
        os.makedirs("verification/videos", exist_ok=True)

        print("1. Preparing mock session state...")
        await page.goto("http://localhost:3055/cpanel")
        await page.wait_for_timeout(1000)

        await page.evaluate("""() => {
            sessionStorage.setItem("mock", "true");
            sessionStorage.setItem("cpanel_theme", "light");
        }""")

        print("2. Navigating to Cpanel Gatekeeper (Locked)...")
        await page.goto("http://localhost:3055/cpanel?mock=true")
        await page.wait_for_timeout(3000)

        # 1. Take a screenshot of the login gatekeeper to verify there is NO top margin space
        print("Taking gatekeeper screenshot...")
        await page.screenshot(path="verification/screenshots/cpanel_login_gatekeeper.png")

        print("3. Entering gatekeeper credentials and unlocking...")
        # Unlock the gatekeeper using mock info
        await page.fill("input[placeholder*='admin@example.com']", "admin@e-tech-hub.com")
        await page.wait_for_timeout(500)
        await page.fill("input[placeholder*='Access PIN']", "1234")
        await page.wait_for_timeout(500)
        await page.click("button:has-text('Verify Authority')")
        await page.wait_for_timeout(3000)

        # Take screenshot of the unlocked cpanel layout
        print("Taking unlocked layout screenshot...")
        await page.screenshot(path="verification/screenshots/cpanel_unlocked_layout.png")

        # 4. Click Lock Console to open the new gorgeous confirmation modal
        print("4. Triggering Console Lock Confirmation Modal...")
        await page.locator("button:has-text('Lock Console')").first.click()
        await page.wait_for_timeout(1500)

        # Take screenshot of the gorgeous glassmorphic lock confirmation modal
        print("Taking modal confirmation screenshot...")
        await page.screenshot(path="verification/screenshots/cpanel_lock_modal.png")

        await context.close()
        await browser.close()
        print("Visual verification screenshots and videos generated successfully!")

if __name__ == "__main__":
    asyncio.run(run_cuj())
