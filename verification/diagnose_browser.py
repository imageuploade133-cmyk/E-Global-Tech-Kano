import os
import time
from playwright.sync_api import sync_playwright

def inspect_console_logs():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 390, "height": 844})
        page = context.new_page()

        # Listen to console events
        page.on("console", lambda msg: print(f"[CONSOLE {msg.type}] {msg.text}"))
        page.on("pageerror", lambda err: print(f"[PAGE ERROR] {err}"))

        page.goto("http://localhost:3055/?mock=true")
        page.wait_for_timeout(3000)
        browser.close()

if __name__ == "__main__":
    inspect_console_logs()
