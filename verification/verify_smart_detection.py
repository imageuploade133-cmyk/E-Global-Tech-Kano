from playwright.sync_api import sync_playwright
import os

def run_verification():
    print("Starting Playwright Smart Auto Bank Detection verification...")
    os.makedirs("/home/jules/verification/videos", exist_ok=True)
    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos",
            viewport={"width": 400, "height": 800} # premium mobile-like experience
        )
        page = context.new_page()
        try:
            print("Navigating to local development server in mock mode...")
            page.goto("http://localhost:3000/?mock=true")
            page.wait_for_timeout(2000)

            print("Locating and clicking 'Withdraw' button on the balance card...")
            page.get_by_role("button", name="Withdraw").first.click()
            page.wait_for_timeout(1000)

            print("Locating Account Number input field...")
            # Let's locate the input field
            account_input = page.get_by_placeholder("e.g. 0123456789")
            account_input.click()
            page.wait_for_timeout(500)

            print("Entering 10-digit account number '0690000032'...")
            # Type character-by-character to simulate user typing and debounce behavior
            for digit in "0690000032":
                account_input.press(digit)
                page.wait_for_timeout(100)

            print("Waiting for auto-detection and verification to complete...")
            page.wait_for_timeout(2000)

            print("Taking screenshot of successfully auto-detected account...")
            page.screenshot(path="/home/jules/verification/screenshots/verification.png")
            page.wait_for_timeout(2500) # hold final state for the video

            print("Verification CUJ run completed successfully.")
        except Exception as e:
            print(f"Error during verification: {e}")
        finally:
            context.close()
            browser.close()

if __name__ == "__main__":
    run_verification()
