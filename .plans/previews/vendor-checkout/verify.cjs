// Uses Vendor's already-installed Playwright. No server, dependencies or credentials.
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('../../../vendor/node_modules/@playwright/test');

async function verify() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    const errors = [];
    const externalRequests = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route(/^https?:/, (route) => {
      externalRequests.push(route.request().url());
      return route.abort();
    });
    const root = pathToFileURL(path.join(__dirname, 'index.html')).href;
    const screens = ['choice', 'preparing', 'qr', 'gcash', 'checking', 'received', 'expired', 'late', 'offline', 'reset', 'inuse', 'recovery', 'free'];
    async function open(screen, theme = 'light') {
      await page.goto(`${root}?theme=${theme}&screen=${screen}`);
      await page.locator('#preview h1').waitFor();
      assert.equal(await page.locator('#screen').inputValue(), screen);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${theme}/${screen}: horizontal overflow`);
      const smallControls = await page.locator('button, select').evaluateAll((elements) => elements.filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width < 44 || rect.height < 44;
      }).map((element) => element.textContent));
      assert.deepEqual(smallControls, [], `${theme}/${screen}: touch targets below 44px`);
      const croppedChrome = await page.locator('.brand-bar, .actions, .staff-footer').evaluateAll((elements) => elements.filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.top < 0 || rect.bottom > innerHeight;
      }).map((element) => element.className));
      if (await page.evaluate(() => innerWidth > 760)) assert.deepEqual(croppedChrome, [], `${theme}/${screen}: fixed kiosk chrome cropped`);
    }
    for (const theme of ['light', 'dark']) {
      for (const screen of screens) {
        await open(screen, theme);
        if (['choice', 'qr', 'gcash', 'received'].includes(screen)) {
          await page.screenshot({ path: path.join(__dirname, `${screen}-${theme}.png`), animations: 'disabled' });
        }
        if (['reset', 'inuse', 'recovery'].includes(screen)) {
          assert.doesNotMatch(await page.locator('#preview').innerText(), /₱500|DEMO-7K2P|Studio session/);
        }
      }
    }
    await open('choice');
    await page.getByRole('button', { name: /Pay with QR Ph/ }).click();
    assert.equal(await page.locator('#screen').inputValue(), 'qr');
    await page.getByRole('button', { name: 'Next customer', exact: true }).click();
    assert.equal(await page.locator('#screen').inputValue(), 'reset');
    await page.getByRole('button', { name: 'Staff recovery', exact: true }).first().click();
    assert.equal(await page.locator('#screen').inputValue(), 'recovery');
    assert.equal(await page.getByRole('button', { name: 'Verify & reset — preview only' }).isDisabled(), true);
    await open('choice');
    await page.getByRole('button', { name: /Pay with GCash/ }).click();
    await page.getByRole('button', { name: 'Continue to GCash ↗' }).click();
    assert.equal(await page.locator('#screen').inputValue(), 'checking');
    await page.locator('#theme').selectOption('dark');
    assert.equal(await page.locator('html').getAttribute('class'), 'dark');
    for (const viewport of [{ width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      for (const screen of ['choice', 'qr', 'gcash', 'received', 'reset', 'recovery']) await open(screen);
    }
    for (const viewport of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 430, height: 932 }]) {
      await page.setViewportSize(viewport);
      for (const theme of ['light', 'dark']) {
        for (const screen of screens) {
          await open(screen, theme);
          if (viewport.width === 390 && ['choice', 'qr', 'gcash', 'received', 'offline', 'reset'].includes(screen)) {
            await page.screenshot({ path: path.join(__dirname, `${screen}-mobile-${theme}.png`), fullPage: true, animations: 'disabled' });
            if (['choice', 'qr'].includes(screen)) {
              await page.screenshot({ path: path.join(__dirname, `${screen}-mobile-${theme}-viewport.png`), animations: 'disabled' });
            }
          }
        }
      }
    }
    assert.deepEqual(errors, [], 'Browser JavaScript errors');
    assert.deepEqual(externalRequests, [], 'Unexpected external requests');
    console.log('PASS: 26 desktop theme/state checks; 18 initial responsive checks; 78 phone theme/state checks (360/390/430px); 44px touch targets; kiosk chrome bounds; privacy-screen copy; mock navigation; no JS errors or external HTTP requests. Eight desktop and sixteen phone PNGs generated.');
  } finally {
    await browser.close();
  }
}
verify().catch((error) => { console.error(error); process.exitCode = 1; });
