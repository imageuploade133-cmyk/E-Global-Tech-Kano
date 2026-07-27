from playwright.sync_api import sync_playwright
import time
import os

def run_verification():
    print("Starting Playwright verification of SignUp Stage-by-Stage Wizard...")
    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)
    os.makedirs("/home/jules/verification/videos", exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 390, "height": 844},  # standard mobile viewport
            record_video_dir="/home/jules/verification/videos"
        )
        page = context.new_page()

        # Step 1: Open SignUp Page
        print("Navigating to http://localhost:3002/auth/signup...")
        page.goto("http://localhost:3002/auth/signup")
        page.wait_for_timeout(2000)

        # Step 2: Capture screenshot of Stage 1 (Personal Details)
        path1 = "/home/jules/verification/screenshots/signup_stage_1.png"
        print(f"Taking screenshot of SignUp Stage 1: {path1}")
        page.screenshot(path=path1)
        page.wait_for_timeout(500)

        # Step 3: Enter some mock values for Step 1
        print("Filling in Stage 1 details...")
        page.locator("#firstName").fill("Abdulkadir")
        page.locator("#lastName").fill("Shaba")
        page.locator("#dateOfBirth").fill("1995-10-15")
        page.wait_for_timeout(500)

        # Take another screenshot of filled Stage 1
        path2 = "/home/jules/verification/screenshots/signup_stage_1_filled.png"
        print(f"Taking screenshot of filled SignUp Stage 1: {path2}")
        page.screenshot(path=path2)
        page.wait_for_timeout(500)

        print("[SUCCESS] SignUp Wizard verification completed successfully!")
        context.close()
        browser.close()

if __name__ == "__main__":
    run_verification()
