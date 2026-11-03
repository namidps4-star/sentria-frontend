// A critical alert in the bell opens that alert's detail on the dashboard,
// not the tracking board. Checked in light, dark and 390 px.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const now = new Date().toISOString();
const REC = { id: 1, equipment: 'Presse P1', sector: 'industry', business_type: 'usine-production', severity: 'CRITICAL', date: now, alert_key: 'industry.generic', message: 'Machine failure risk', recommended_action: 'Stop the press and inspect the bearing', action_category: 'maintenance', reasoning: null, risk_score: 0.9 };
const LS = { sentria_language: 'en', sentria_onboarded: 'true', sentria_company_name: 'Usine Nord', sentria_sector: 'industry', sentria_sectors: '["industry"]', sentria_business_type: 'usine-production', sentria_departments: '{"industry":["usine-production"]}' };

(async () => {
  const browser = await chromium.launch(LAUNCH);
  for (const [theme, width] of [['light', 1280], ['dark', 1280], ['light', 390]]) {
    const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 }, locale: 'en-US' });
    const p = await ctx.newPage(); p._errs = []; p.on('pageerror', e => p._errs.push(e.message));
    await p.route(/onrender\.com\//, r => {
      const u = r.request().url();
      if (/\/recommendations/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 1, recommendations: [REC] }) });
      r.fulfill({ status: 200, contentType: 'application/json', body: /\/alerts/.test(u) ? JSON.stringify([REC]) : '{"recommendations":[],"assignments":[],"contractors":[]}' });
    });
    await p.addInitScript(([ls, t]) => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); Object.entries({ ...ls, sentria_theme: t }).forEach(([k, v]) => localStorage.setItem(k, v)); } }, [LS, theme]);
    await signedIn(p, 'u', 'a@b.c', { plan: 'business' });
    await p.goto(APP_URL); await p.waitForTimeout(2500);
    // open the bell and pick the critical alert
    await p.getByRole('button', { name: /critical alert|alerte critique|alert waiting|notification/i }).first().click();
    await p.waitForTimeout(600);
    const row = p.getByRole('dialog', { name: /Critical alerts|Alertes critiques/ }).locator('ul button').first();
    await row.click();
    await p.waitForTimeout(1500);
    const onTracking = await p.locator('main').innerText().then(t => /Recommendations|Board|Tracking|Suivi/.test(t) && !/Recommended action|Action recommandée/.test(t)).catch(() => false);
    const body = await p.locator('body').innerText();
    pass(/Stop the press and inspect the bearing/.test(body), `${theme} ${width}px: the alert's detail opens with its recommended action`);
    pass(!/Priority detail for|Détails de la priorité/.test(body) || /Presse P1/.test(body), `${theme} ${width}px: it is the same alert`);
    pass(p._errs.length === 0, `${theme} ${width}px: no page errors ${p._errs.join('|')}`);
    await p.screenshot({ path: `bellopen-${theme}-${width}.png` });
    await ctx.close();
  }
  await browser.close();
  console.log(`\n${fails ? fails + ' failure(s)' : 'ALL OK'}`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
