import os
import time
from playwright.sync_api import sync_playwright

def run_verification():
    print("Starting Playwright verification of WhatsApp OTP Flow...")
    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)
    os.makedirs("/home/jules/verification/videos", exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 390, "height": 844},  # mobile viewport
            record_video_dir="/home/jules/verification/videos"
        )
        page = context.new_page()

        # Step 1: Open SignUp Page
        print("Navigating to http://localhost:3002/auth/signup...")
        page.goto("http://localhost:3002/auth/signup")
        page.wait_for_timeout(1000)

        # Step 2: Fill in Stage 1 details
        print("Filling in Stage 1 details...")
        page.locator("#firstName").fill("Abdulkadir")
        page.wait_for_timeout(300)
        page.locator("#lastName").fill("Shaba")
        page.wait_for_timeout(300)

        # Enter a unique 11-digit BVN/NIN so it doesn't conflict
        unique_bvn = str(int(time.time()))[:11]
        if len(unique_bvn) < 11:
            unique_bvn = unique_bvn + "0" * (11 - len(unique_bvn))
        print(f"Entering unique BVN: {unique_bvn}")
        page.locator("#bvnNinInput").fill(unique_bvn)
        page.wait_for_timeout(500)

        # Take screenshot of Stage 1
        page.screenshot(path="/home/jules/verification/screenshots/whatsapp_stage_1.png")

        # Click Next Step
        print("Clicking Next Step...")
        page.locator("button:has-text('Next Step')").click()
        page.wait_for_timeout(2000)

        # Step 3: Now we are on Stage 2 (Contact and Verification)
        print("On Stage 2! Filling in phone number...")
        page.locator("#phoneNumber").fill("8123456789")
        page.wait_for_timeout(500)

        # Take screenshot showing the WhatsApp note and Send OTP button
        print("Taking screenshot of WhatsApp Note & Send OTP button...")
        page.screenshot(path="/home/jules/verification/screenshots/whatsapp_stage_2_initial.png")

        # Click Send OTP
        print("Clicking 'Send OTP' button...")
        page.locator("button:has-text('Send OTP')").click()
        page.wait_for_timeout(2500)

        # Take screenshot of OTP input and countdown timer
        print("Taking screenshot of OTP Input and Cooldown active...")
        page.screenshot(path="/home/jules/verification/screenshots/whatsapp_otp_sent.png")

        # Enter a fake OTP
        print("Entering fake 6-digit OTP code...")
        page.locator("input[placeholder='••••••']").fill("999999")
        page.wait_for_timeout(500)

        # Click Verify
        print("Clicking Verify...")
        page.locator("button:has-text('Verify')").click()
        page.wait_for_timeout(2000)

        # Take screenshot showing error message
        print("Taking screenshot of invalid OTP error message...")
        page.screenshot(path="/home/jules/verification/screenshots/whatsapp_otp_error.png")

        # Wait a bit for final video frame holding
        page.wait_for_timeout(1000)

        print("[SUCCESS] WhatsApp Flow verification completed successfully!")
        context.close()
        browser.close()

if __name__ == "__main__":
    run_verification()
