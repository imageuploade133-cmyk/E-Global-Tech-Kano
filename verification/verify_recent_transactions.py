import os
from playwright.sync_api import sync_playwright

def run_cuj(page):
    # Listen to console
    page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))
    page.on("pageerror", lambda err: print(f"PAGE ERROR: {err.message}"))

    page.goto("http://localhost:3012/?mock=true")
    print("Navigated, sleeping 8 seconds...")
    page.wait_for_timeout(8000)

    screenshot_path = "verification/screenshots/verification_recent_transactions.png"
    page.screenshot(path=screenshot_path)
    print(f"Screenshot captured at: {screenshot_path}")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="verification/videos",
            viewport={"width": 375, "height": 812},
            is_mobile=True
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
