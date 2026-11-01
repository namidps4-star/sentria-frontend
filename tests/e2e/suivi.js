// Tracking (Suivi): a read that never answers ends in the "Not measured" notice
// with a retry, not an endless "Loading tracking" spinner. Retry then loads the board.
// Checked in light, dark and 390 px.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const now = new Date().toISOString();
const REC = { equipment: 'Presse P1', sector: 'industry', business_type: 'usine-production', severity: 'CRITICAL', date: now, alert_key: 'industry.generic', message: 'Machine failure risk', recommended_action: 'Stop the press and inspect the bearing', action_category: 'maintenance', reasoning: null, risk_score: 0.9 };
const LS = { sentria_language: 'en', sentria_onboarded: 'true', sentria_company_name: 'Usine Nord', sentria_sector: 'industry', sentria_sectors: '["industry"]', sentria_business_type: 'usine-production', sentria_departments: '{"industry":["usine-production"]}' };

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const run = async (theme, width, shot) => {
    const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 }, locale: 'en-US' });
    const p = await ctx.newPage(); p._errs = []; p.on('pageerror', e => p._errs.push(e.message));
    let hang = true; // the first read never answers; the retry answers
    await p.route(/onrender\.com\//, r => {
      const u = r.request().url();
      if (/\/recommendations/.test(u)) {
        if (hang) return; // never answer
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 1, recommendations: [REC] }) });
      }
      r.fulfill({ status: 200, contentType: 'application/json', body: /\/alerts/.test(u) ? JSON.stringify([REC]) : '{"recommendations":[],"assignments":[],"contractors":[]}' });
    });
    await p.addInitScript(([ls, t]) => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); Object.entries({ ...ls, sentria_theme: t }).forEach(([k, v]) => localStorage.setItem(k, v)); } }, [LS, theme]);
    await signedIn(p, 'u', 'a@b.c', { plan: 'business' });
    await p.goto(APP_URL); await p.waitForTimeout(2000);
    await p.evaluate(() => document.querySelector('[data-nav="tracking"]').click());

    // Still loading at 5 s is fine; it must not be loading forever.
    await p.waitForTimeout(5000);
    const early = await p.locator('main').innerText();
    pass(/Loading tracking/.test(early), `${theme} ${width}px: shows the loading state first`);

    // After the timeout the retry notice appears.
    const retry = p.getByRole('button', { name: /Try again|Réessayer|Retry/i }).first();
    await retry.waitFor({ state: 'visible', timeout: 25000 }).catch(() => {});
    pass(await retry.count() > 0, `${theme} ${width}px: retry button shows after the timeout`);
    pass(!/Loading tracking/.test(await p.locator('main').innerText()), `${theme} ${width}px: the spinner is gone`);
    await p.screenshot({ path: shot.replace('.png', '-notice.png') });

    // Retry loads the board.
    hang = false;
    await retry.click();
    await p.waitForTimeout(2500);
    const after = await p.locator('main').innerText();
    pass(/Presse P1/.test(after), `${theme} ${width}px: retry loads the board with the task`);
    pass(p._errs.length === 0, `${theme} ${width}px: no page errors ${p._errs.join('|')}`);
    await p.screenshot({ path: shot });
    await ctx.close();
  };

  console.log('== light');
  await run('light', 1280, 'suivi-light.png');
  console.log('== dark');
  await run('dark', 1280, 'suivi-dark.png');
  console.log('== 390');
  await run('light', 390, 'suivi-390.png');

  await browser.close();
  console.log(`\n${fails ? fails + ' failure(s)' : 'ALL OK'}`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
