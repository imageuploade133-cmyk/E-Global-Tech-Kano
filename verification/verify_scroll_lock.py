import os
import time
from playwright.sync_api import sync_playwright

def run_verification():
    with sync_playwright() as p:
        # Launch headless browser
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 375, "height": 812},  # Standard mobile viewport (iPhone X/11)
            record_video_dir="verification/videos"
        )

        page = context.new_page()

        # We must go to the page and then set sessionStorage
        print("Navigating to dashboard to initialize origin...")
        page.goto("http://localhost:3003")
        page.wait_for_timeout(1000)

        # Enable mock authentication mode via sessionStorage
        print("Setting mock=true in sessionStorage...")
        page.evaluate("() => sessionStorage.setItem('mock', 'true')")
        page.wait_for_timeout(500)

        # ----------------------------------------------------
        # TEST 1: CARDS PAGE REQUEST SHEET
        # ----------------------------------------------------
        print("Testing Cards Page Request Sheet...")
        page.goto("http://localhost:3003/cards")
        page.wait_for_timeout(2000)  # Wait for page hydration

        # Verify initial overflow is empty/unset
        initial_overflow = page.evaluate("() => document.body.style.overflow")
        print(f"Initial body overflow: '{initial_overflow}'")

        # Click on 'Request Card' button based on the found text
        request_button = page.get_by_text("Request Card")
        if request_button.count() > 0:
            print("Clicking 'Request Card' button...")
            request_button.first.click()
            page.wait_for_timeout(1000)

            # Check overflow state
            overflow_active = page.evaluate("() => document.body.style.overflow")
            print(f"Body overflow after opening Cards request drawer: '{overflow_active}'")

            # Take screenshot
            page.screenshot(path="verification/screenshots/cards_drawer_scroll_lock.png")

            # Close drawer
            close_button = page.get_by_text("close")
            if close_button.count() > 0:
                print("Clicking close button...")
                close_button.first.click()
                page.wait_for_timeout(500)
                overflow_after_close = page.evaluate("() => document.body.style.overflow")
                print(f"Body overflow after closing Cards drawer: '{overflow_after_close}'")
        else:
            print("Could not find 'Request Card' button")

        # ----------------------------------------------------
        # TEST 2: SERVICES INFO MODAL (ServiceGrid.tsx)
        # ----------------------------------------------------
        print("\nTesting Service Grid Info Modals...")
        page.goto("http://localhost:3003")
        page.wait_for_timeout(2000)

        # Find the 'Loan' or 'Wealth' button in ServiceGrid
        loan_button = page.get_by_text("Loan")
        if loan_button.count() > 0:
            print("Clicking 'Loan' service button...")
            loan_button.first.click()
            page.wait_for_timeout(1000)

            # Check overflow state
            overflow_active = page.evaluate("() => document.body.style.overflow")
            print(f"Body overflow after opening Loan info modal: '{overflow_active}'")

            # Take screenshot
            page.screenshot(path="verification/screenshots/service_info_modal_scroll_lock.png")
        else:
            print("Could not find 'Loan' button")

        print("\nVerification complete!")
        context.close()
        browser.close()

if __name__ == "__main__":
    run_verification()
