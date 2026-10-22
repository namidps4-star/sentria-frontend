// The same few screens on Chromium, Firefox and WebKit. An engine that is not installed is skipped and said so
// (the cloud container has Chromium only; CI installs all three).
const { APP_URL } = require('./env');
const pw = require('playwright');
const { LAUNCH } = require('./env');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };

(async () => {
  for (const name of ['chromium', 'firefox', 'webkit']) {
    console.log(`== ${name}`);
    let browser;
    try { browser = await pw[name].launch(name === 'chromium' ? LAUNCH : {}); }
    catch (error) { console.log(`   SKIP ${name} is not installed here`); continue; }

    for (const [label, size] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 800 }]]) {
      const page = await browser.newPage({ viewport: size });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(APP_URL, { waitUntil: 'load' });
      await page.waitForTimeout(1500);
      pass(await page.locator('input[autocomplete="username"], input[autocomplete="current-password"]').first().isVisible(), `${name} ${label}: the sign-in shows`);
      pass(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${name} ${label}: no sideways scroll`);
      await page.goto(APP_URL + '/no-such-page');
      await page.waitForTimeout(800);
      pass(await page.getByRole('link', { name: /Back to the dashboard|Retour au tableau de bord/ }).isVisible(), `${name} ${label}: the 404 page shows`);
      pass(errors.length === 0, `${name} ${label}: no page errors ${errors.join('|')}`);
      await page.screenshot({ path: `cross-${name}-${label}.png` });
      await page.close();
    }
    await browser.close();
  }
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
