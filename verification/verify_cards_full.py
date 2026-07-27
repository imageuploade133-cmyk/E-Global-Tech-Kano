import os
from playwright.sync_api import sync_playwright

def run_cuj(page):
    # Go to cards page
    page.goto("http://localhost:3000/cards")
    page.evaluate("() => sessionStorage.setItem('mock', 'true')")
    page.goto("http://localhost:3000/cards")
    page.wait_for_timeout(2000)

    # 1. Click Show Details to unmask CVV and Full PAN
    print("Clicking Show Details...")
    page.get_by_role("button", name="Show Details").click()
    page.wait_for_timeout(2000)
    page.screenshot(path="verification/screenshots/cards_details_revealed.png")

    # 2. Click Fund button
    print("Clicking Fund...")
    page.get_by_role("button", name="Fund").click()
    page.wait_for_timeout(1000)

    # Fill amount to fund
    page.get_by_placeholder("Enter amount to fund").fill("25")
    page.wait_for_timeout(1000)

    # Confirm Funding
    page.get_by_role("button", name="Confirm Funding").click()
    page.wait_for_timeout(3000)
    page.screenshot(path="verification/screenshots/cards_funded_success.png")

    # 3. Enter search term in the new Search filter input
    print("Searching transactions...")
    page.get_by_placeholder("Search Netflix, Spotify...").fill("Spotify")
    page.wait_for_timeout(2000)
    page.screenshot(path="verification/screenshots/cards_filtered_transactions.png")

    # 4. Click Clear Filters
    print("Clearing filters...")
    page.get_by_role("button", name="Clear Filters").click()
    page.wait_for_timeout(1500)

    # 5. Click Freeze to freeze card
    print("Freezing card...")
    page.get_by_role("button", name="Freeze").click()
    page.wait_for_timeout(2500)

    # Take screenshot of the frozen state
    page.screenshot(path="verification/screenshots/cards_frozen_verify.png")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    os.makedirs("verification/videos", exist_ok=True)
    os.makedirs("verification/screenshots", exist_ok=True)
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
