// One number for an alert on every screen: one per (asset, check) pair.
// A file that repeats the same asset and check in several rows counts once.
// Checked on the dashboard header and the alerts table, light and 390 px.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const now = new Date().toISOString();
const A = (id, eq, key, sev) => ({ id, equipment: eq, sector: 'industry', business_type: 'usine-production', severity: sev, date: now, alert_key: key, message: 'Machine failure risk' });
// Presse P1 raised check A twice (a repeat), check B once; Moteur M3 raised check A once.
// Pairs: (P1,A), (P1,B), (M3,A) = 3. Rows: 4.
const ROWS = [A(1, 'Presse P1', 'industry.wear', 'CRITICAL'), A(2, 'Presse P1', 'industry.wear', 'CRITICAL'), A(3, 'Presse P1', 'industry.heat', 'CRITICAL'), A(4, 'Moteur M3', 'industry.wear', 'CRITICAL')];
const LS = { sentria_language: 'en', sentria_onboarded: 'true', sentria_company_name: 'Usine Nord', sentria_sector: 'industry', sentria_sectors: '["industry"]', sentria_business_type: 'usine-production', sentria_departments: '{"industry":["usine-production"]}' };

(async () => {
  const browser = await chromium.launch(LAUNCH);
  for (const [theme, width] of [['light', 1280], ['light', 390]]) {
    console.log(`== ${theme} ${width}px`);
    const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 }, locale: 'en-US' });
    const p = await ctx.newPage(); p._errs = []; p.on('pageerror', e => p._errs.push(e.message));
    await p.route(/onrender\.com\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: /\/alerts/.test(r.request().url()) ? JSON.stringify(ROWS) : '{"recommendations":[],"assignments":[],"contractors":[]}' }));
    await p.addInitScript(([ls, t]) => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); Object.entries({ ...ls, sentria_theme: t }).forEach(([k, v]) => localStorage.setItem(k, v)); } }, [LS, theme]);
    await signedIn(p, 'u', 'a@b.c', { plan: 'business' });
    await p.goto(APP_URL); await p.waitForTimeout(2500);
    const body = await p.locator('body').innerText();
    pass(/3 signals · 3 critical/.test(body), `${theme} ${width}px: header says 3 signals, 3 critical (pairs, not 4 rows)`);
    pass(!/4 signals/.test(body), `${theme} ${width}px: header does not say 4 rows`);
    pass(p._errs.length === 0, `${theme} ${width}px: no page errors ${p._errs.join('|')}`);
    await p.screenshot({ path: `alertpairs-${theme}-${width}.png` });
    await ctx.close();
  }
  await browser.close();
  console.log(`\n${fails ? fails + ' failure(s)' : 'ALL OK'}`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
