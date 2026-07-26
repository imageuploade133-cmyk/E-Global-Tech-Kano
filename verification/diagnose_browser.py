import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(
            viewport={"width": 375, "height": 812},
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1"
        )
        page = await context.new_page()
        await page.goto("http://localhost:3000/bills?type=waec&mock=true")
        await page.wait_for_timeout(5000)

        content = await page.content()
        print(f"HTML Content length: {len(content)}")
        print("Frames:")
        for frame in page.frames:
            print(f"  Frame name: {frame.name}, url: {frame.url}")

        await context.close()
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
