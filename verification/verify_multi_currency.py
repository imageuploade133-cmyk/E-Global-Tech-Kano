import os
import time
from playwright.sync_api import sync_playwright

def run_verification():
    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)
    os.makedirs("/home/jules/verification/videos", exist_ok=True)

    with sync_playwright() as p:
        print("[Verification] Launching Chromium...")
        browser = p.chromium.launch(headless=True)

        # Set up a clean mobile-like context for responsive visualization
        context = browser.new_context(
            viewport={"width": 390, "height": 844},
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
            record_video_dir="/home/jules/verification/videos"
        )

        page = context.new_page()

        print("[Verification] Navigating to E-Tech Wallet home with mock flag...")
        page.goto("http://localhost:3055/?mock=true")
        page.wait_for_timeout(2000) # Let page fully load and hydrate

        # Take a screenshot of the initial dashboard with NGN wallet active
        print("[Verification] Capturing active NGN Wallet screen...")
        page.screenshot(path="/home/jules/verification/screenshots/1_dashboard_ngn.png")
        page.wait_for_timeout(1000)

        # Switch to USD Wallet
        print("[Verification] Switching to USD Wallet...")
        page.click("text=USD")
        page.wait_for_timeout(1500)

        # Take a screenshot of the USD wallet active
        print("[Verification] Capturing active USD Wallet screen...")
        page.screenshot(path="/home/jules/verification/screenshots/2_dashboard_usd.png")
        page.wait_for_timeout(1000)

        # Switch to XOF Wallet
        print("[Verification] Switching to XOF Wallet...")
        page.click("text=XOF")
        page.wait_for_timeout(1500)

        # Take a screenshot of the XOF wallet active
        print("[Verification] Capturing active XOF Wallet screen...")
        page.screenshot(path="/home/jules/verification/screenshots/2b_dashboard_xof.png")
        page.wait_for_timeout(1000)

        # Open Swap Modal from XOF
        print("[Verification] Opening Swap converter from XOF...")
        page.click("text=Swap")
        page.wait_for_timeout(1500)

        print("[Verification] Capturing Swap Modal with XOF selected...")
        page.screenshot(path="/home/jules/verification/screenshots/3_swap_modal_xof.png")
        page.wait_for_timeout(1000)

        # Choose to swap XOF to NGN by clicking the NGN pill selector in the form
        print("[Verification] Selecting Swap-To currency as NGN in the modal form...")
        page.click("form button:has-text('NGN')")
        page.wait_for_timeout(1000)

        # Enter swap amount
        print("[Verification] Entering XOF swap amount...")
        page.fill("input[placeholder*='amount']", "1000")
        page.wait_for_timeout(1500)

        print("[Verification] Capturing swap conversion calculation XOF -> NGN...")
        page.screenshot(path="/home/jules/verification/screenshots/4_swap_calculated_xof_to_ngn.png")
        page.wait_for_timeout(1000)

        # Complete Swap
        print("[Verification] Clicking Authorize Swap...")
        page.click("text=Authorize Swap")
        page.wait_for_timeout(3000) # Wait for swap transaction response

        # Capturing dashboard post-swap
        print("[Verification] Capturing dashboard after exchange conversion...")
        page.screenshot(path="/home/jules/verification/screenshots/5_post_swap_xof.png")
        page.wait_for_timeout(1000)

        # Close browser to trigger video export
        print("[Verification] Finalizing and closing Playwright...")
        context.close()
        browser.close()
        print("[Verification] Done! All media files generated successfully.")

if __name__ == "__main__":
    run_verification()
