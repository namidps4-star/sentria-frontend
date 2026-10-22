// Smoke test for a live deploy: does the app open, does the API answer, can a test account sign in and see data.
//
//   SMOKE_URL    the app address (default: the production Vercel address is not guessed; it must be set)
//   SMOKE_API    the API address (default: the one the app uses)
//   SMOKE_EMAIL, SMOKE_PASSWORD   a test account. Without them the sign-in steps are skipped and said so.
//
// Exits 1 on any failed step. Writes a short table to $GITHUB_STEP_SUMMARY when run in Actions.
const fs = require('fs');
const { chromium } = require('playwright');

const APP = (process.env.SMOKE_URL || '').replace(/\/+$/, '');
const API = (process.env.SMOKE_API || 'https://sentria-8btn.onrender.com').replace(/\/+$/, '');
const EMAIL = process.env.SMOKE_EMAIL || '';
const PASSWORD = process.env.SMOKE_PASSWORD || '';
const STEP_LIMIT = 15000;

if (!APP) {
  console.error('Set SMOKE_URL to the address of the deploy to check.');
  process.exit(2);
}

const results = [];

async function step(name, fn) {
  const started = Date.now();
  try {
    const note = await fn();
    results.push({ name, ok: true, ms: Date.now() - started, note: note || '' });
    console.log(`   PASS ${name} (${((Date.now() - started) / 1000).toFixed(1)} s)${note ? ': ' + note : ''}`);
  } catch (error) {
    results.push({ name, ok: false, ms: Date.now() - started, note: String(error.message || error).split('\n')[0] });
    console.log(`   FAIL ${name}: ${String(error.message || error).split('\n')[0]}`);
  }
}

const skip = (name, why) => {
  results.push({ name, ok: null, ms: 0, note: why });
  console.log(`   SKIP ${name}: ${why}`);
};

(async () => {
  console.log(`== smoke test of ${APP}`);
  const chrome = process.env.E2E_CHROME ? { executablePath: process.env.E2E_CHROME } : {};
  const browser = await chromium.launch(chrome);
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.setDefaultTimeout(STEP_LIMIT);

  await step('The app opens and shows the sign-in', async () => {
    const response = await page.goto(APP, { waitUntil: 'domcontentloaded' });
    if (!response || response.status() >= 400) throw new Error(`HTTP ${response && response.status()}`);
    await page.locator('input[autocomplete="username"], input[autocomplete="current-password"]').first().waitFor();
  });

  await step('The API answers /health', async () => {
    const response = await fetch(`${API}/health`, { signal: AbortSignal.timeout(STEP_LIMIT) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  });

  if (EMAIL && PASSWORD) {
    await step('The test account signs in', async () => {
      await page.locator('input[autocomplete="username"]').first().fill(EMAIL);
      await page.locator('input[autocomplete="current-password"]').first().fill(PASSWORD);
      await page.locator('form button[type="submit"]').first().click();
      await page.locator('aside nav').first().waitFor();
    });

    await step('The dashboard loads', async () => {
      await page.locator('aside nav button', { hasText: /Dashboard|Tableau de bord/ }).first().click();
      await page.locator('main').first().waitFor();
      const text = await page.locator('main').first().innerText();
      if (text.trim().length < 20) throw new Error('the dashboard is empty');
    });
  } else {
    skip('The test account signs in', 'no SMOKE_EMAIL and SMOKE_PASSWORD set');
    skip('The dashboard loads', 'no test account');
  }

  await browser.close();

  const failed = results.filter((r) => r.ok === false);
  console.log(failed.length ? `${failed.length} FAILED` : 'ALL PASS');

  if (process.env.GITHUB_STEP_SUMMARY) {
    const rows = results.map((r) => `| ${r.ok === null ? 'skipped' : r.ok ? 'passed' : '**FAILED**'} | ${r.name} | ${(r.ms / 1000).toFixed(1)} s | ${r.note} |`);
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Smoke test of ${APP}\n\n| Result | Step | Time | Note |\n|---|---|---|---|\n${rows.join('\n')}\n`);
  }

  process.exit(failed.length ? 1 : 0);
})();
