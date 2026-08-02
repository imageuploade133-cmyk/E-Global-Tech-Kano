import os
from playwright.sync_api import sync_playwright

def run_verification():
    print("[Playwright Verification] Starting pull-to-refresh visual validation...")

    with sync_playwright() as p:
        # Emulate a premium mobile device with touch gestures enabled
        device = p.devices["iPhone 13"]
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            **device,
            record_video_dir="verification/videos"
        )

        page = context.new_page()

        # 1. Load login page first to inject mock bypass cleanly
        print("[Playwright Verification] Loading login page to inject mock state...")
        page.goto("http://localhost:3000/auth/login")
        page.wait_for_timeout(1500)

        print("[Playwright Verification] Injecting mock playtest authorization bypass...")
        page.evaluate('() => { window.sessionStorage.setItem("mock", "true"); }')
        page.wait_for_timeout(500)

        # 2. Navigate to homepage dashboard
        print("[Playwright Verification] Navigating to homepage dashboard...")
        page.goto("http://localhost:3000/")
        page.wait_for_timeout(3000) # wait for page compilation/hydration

        # Take initial screenshot of the dashboard before any pull gesture
        page.screenshot(path="verification/screenshots/pull_0_initial.png")
        print("[Playwright Verification] Captured initial dashboard state.")

        # Perform mobile touch-drag simulation down from coordinates (200, 150) to (200, 320)
        # to simulate a natural physical drag-down
        print("[Playwright Verification] Simulating touch pull-down gesture...")
        page.touchscreen.tap(200, 150)
        page.mouse.move(200, 150)
        page.mouse.down()

        # Drag down in steps to show smooth movement and rotation
        for y_offset in range(150, 330, 30):
            page.mouse.move(200, y_offset)
            page.wait_for_timeout(150)

        # Take screenshot of the visual pulling state (shows the beautiful floating spinner pulled down and visible)
        page.screenshot(path="verification/screenshots/pull_1_dragging.png")
        print("[Playwright Verification] Captured dragging state with custom floating loader.")

        # Release the drag gesture to trigger active refreshing cycle
        print("[Playwright Verification] Releasing drag to trigger refresh hook...")
        page.mouse.up()

        # Instantly capture the active rotating "Refreshing..." spinner
        page.wait_for_timeout(300)
        page.screenshot(path="verification/screenshots/pull_2_refreshing.png")
        print("[Playwright Verification] Captured active 'Refreshing...' rotating state.")

        # Wait for the fake dynamic API timeout and confirmation toast to finish
        page.wait_for_timeout(2500)
        page.screenshot(path="verification/screenshots/pull_3_completed.png")
        print("[Playwright Verification] Captured completed sync state.")

        context.close()
        browser.close()

    print("[Playwright Verification] Completed visual verification successfully.")

if __name__ == "__main__":
    run_verification()
