import os
import sys
import time
from playwright.sync_api import sync_playwright

def run_cuj(page):
    print("[Playwright] Loading wallet home with mock mode active...")
    page.goto("http://localhost:3000/?mock=true")
    page.wait_for_timeout(3000)

    # Click the transfer button to open the outward transfer bottom drawer
    print("[Playwright] Opening Outward Transfer drawer...")
    page.get_by_role("button", name="send Transfer").click()
    page.wait_for_timeout(1000)

    # Open bank selector
    print("[Playwright] Clicking Bank Selection...")
    page.get_by_text("Choose bank...").click()
    page.wait_for_timeout(1000)

    # Search for Access Bank or similar
    print("[Playwright] Searching and selecting bank...")
    page.get_by_placeholder("Search bank name (e.g. GTBank, Opay)...").fill("Access Bank")
    page.wait_for_timeout(800)
    page.get_by_text("Access Bank").first.click()
    page.wait_for_timeout(1000)

    # Input account number
    print("[Playwright] Inputting account number...")
    page.get_by_placeholder("e.g. 0123456789").fill("8073281034")
    page.wait_for_timeout(3000)

    # Input amount
    print("[Playwright] Inputting transfer amount...")
    page.get_by_placeholder("0.00").fill("15000")
    page.wait_for_timeout(1000)

    # Input narration
    print("[Playwright] Inputting narration note...")
    page.get_by_placeholder("e.g. Rent, Payment for items, Food").fill("Project settlement for E-Tech")
    page.wait_for_timeout(1000)

    # Click Continue
    print("[Playwright] Clicking Continue to open Confirmation Modal...")
    page.get_by_role("button", name="Continue").click()
    page.wait_for_timeout(2000)

    # Click Confirm & Proceed in modal
    print("[Playwright] Clicking Confirm & Proceed in modal...")
    page.get_by_role("button", name="Confirm & Proceed").click()
    page.wait_for_timeout(2000)

    # Now enter PIN "1234" by clicking keypad numbers
    print("[Playwright] Inputting Secure PIN: 1234...")
    for digit in ["1", "2", "3", "4"]:
        page.get_by_role("button", name=digit, exact=True).click()
        page.wait_for_timeout(600)

    print("[Playwright] Transfer request sent. Waiting for success...")
    page.wait_for_timeout(4000)

    # Take screenshot of the Receipt screen
    screenshot_path = "/home/jules/verification/screenshots/verification.png"
    print(f"[Playwright] Taking screenshot at: {screenshot_path}")
    page.screenshot(path=screenshot_path)
    page.wait_for_timeout(1000)

    # Click Close & Finish to close the success screen
    print("[Playwright] Clicking Close & Finish to close...")
    page.get_by_role("button", name="Close & Finish").click()
    page.wait_for_timeout(1000)
    print("[Playwright] CUJ complete!")

if __name__ == "__main__":
    with sync_playwright() as p:
        print("[Playwright] Launching Chromium browser...")
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 430, "height": 932},
            record_video_dir="/home/jules/verification/videos"
        )
        page = context.new_page()
        try:
            run_cuj(page)
        except Exception as e:
            print(f"[Playwright Error] CUJ failed: {e}")
            page.screenshot(path="/home/jules/verification/screenshots/error.png")
        finally:
            context.close()
            browser.close()
            print("[Playwright] Browser context and resources released.")
