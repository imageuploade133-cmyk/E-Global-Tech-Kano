const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:3000/cpanel...');
  await page.goto('http://localhost:3000/cpanel', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  const screenshotPath = path.join(__dirname, 'cpanel_verified.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log('Screenshot saved to:', screenshotPath);

  await browser.close();
})();
