// G-CONF: the confidence the backend computes from real inputs (checks that
// agree, what the team did with this kind of alert) reaches the screen, with
// the sentence that says why.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const json = (r, body) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
const now = new Date().toISOString();
const ALERTS = [
  { equipment: 'Pump A', severity: 'CRITICAL', sector: 'health', business_type: 'pharmacie', date: now, alert_key: 'health.stock.critical_low', message: 'Stock-out imminent', params: [['stock', 2]] },
  { equipment: 'Pump B', severity: 'CRITICAL', sector: 'health', business_type: 'pharmacie', date: now, alert_key: 'health.stock.critical_low', message: 'Stock-out imminent', params: [['stock', 2]] },
];
const rec = (eq, confidence, reasoning, extra = {}) => ({ alert_id: eq, equipment: eq, sector: 'health', business_type: 'pharmacie', severity: 'CRITICAL', date: now, message: 'Stock-out imminent', risk_score: 60, alert_key: 'health.stock.critical_low', recommended_action: 'Order now', action_category: 'stock', confidence, reasoning, ...extra });
const RECS = [
  rec('Pump A', 91, 'Rated critical because the signal is past the safety threshold expected for this asset. 3 different checks agree on this asset. Your team acted on this kind of alert 4 of 5 times.', { signals: 3, track_record: { done: 4, dismissed: 1 } }),
  rec('Pump B', 58, 'Rated critical because the signal is past the safety threshold expected for this asset. Your team acted on this kind of alert 0 of 5 times.', { signals: 1, track_record: { done: 0, dismissed: 5 } }),
];

(async () => {
  const b = await chromium.launch(LAUNCH);
  const open = async (theme, vw) => {
    const ctx = await b.newContext({ viewport: { width: vw, height: 1000 }, locale: 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    await p.route(/\/alerts(\?|$)/, r => json(r, ALERTS));
    await p.route(/\/recommendations/, r => json(r, { recommendations: RECS }));
    await p.route(/\/(contractors|assignments)/, r => json(r, { contractors: [], assignments: [] }));
    await p.addInitScript(t => { const s = { sentria_onboarded: '1', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', sentria_language: 'en', sentria_company_name: 'Acme', sentria_theme: t }; for (const k in s) localStorage.setItem(k, s[k]); }, theme);
    await signedIn(p); await p.goto(APP_URL); await p.waitForTimeout(2000);
    return { p, ctx };
  };
  console.log('== two identical alerts, different real history, different confidence');
  { const { p, ctx } = await open('light', 1440);
    await p.locator('tbody tr', { hasText: 'Pump A' }).first().click(); await p.waitForTimeout(600);
    let t = await p.evaluate(() => document.body.innerText);
    pass(/91\s*%/.test(t), 'Pump A shows its backend confidence: 91%');
    pass(/3 different checks agree on this asset/.test(t) && /acted on this kind of alert 4 of 5 times/.test(t), 'and says why: checks agree + team acted 4 of 5');
    await p.screenshot({ path: 'conf-a.png' });
    await p.locator('tbody tr', { hasText: 'Pump B' }).first().click(); await p.waitForTimeout(600);
    t = await p.evaluate(() => document.body.innerText);
    pass(/58\s*%/.test(t) && !/91\s*%/.test(t.split('Pump B').pop() || ''), 'Pump B shows a lower confidence: 58%');
    pass(/acted on this kind of alert 0 of 5 times/.test(t), 'and says the team never acted on this kind');
    await p.screenshot({ path: 'conf-b.png' });
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|')); await ctx.close(); }
  console.log('== dark and phone');
  { const { p, ctx } = await open('dark', 1440);
    await p.locator('tbody tr', { hasText: 'Pump A' }).first().click(); await p.waitForTimeout(600);
    pass(/91\s*%/.test(await p.evaluate(() => document.body.innerText)), 'dark: confidence shown'); await p.screenshot({ path: 'conf-dark.png' }); await ctx.close(); }
  { const { p, ctx } = await open('light', 390);
    pass(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), '390 px: no sideways page scroll'); await ctx.close(); }
  await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL OK'); process.exit(fails ? 1 : 0);
})();
