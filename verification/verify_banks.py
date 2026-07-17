import os
from playwright.sync_api import sync_playwright

def run_cuj(page):
    # Go to localhost
    page.goto("http://localhost:3000")
    page.wait_for_timeout(1000)

    # Set mock mode in sessionStorage and reload to bypass logins or complex checks
    page.evaluate("() => sessionStorage.setItem('mock', 'true')")
    page.goto("http://localhost:3000")
    page.wait_for_timeout(1000)

    # Take a screenshot of the main dashboard
    page.screenshot(path="verification/screenshots/dashboard.png")
    print("Dashboard screenshot saved.")

if __name__ == "__main__":
    os.makedirs("verification/screenshots", exist_ok=True)
    os.makedirs("verification/videos", exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="verification/videos"
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
