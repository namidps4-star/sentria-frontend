// The trend chart opens on the shortest range that has alerts. Alerts older than a week no longer
// read "No alerts in this period": the chart widens to 30 days, says so, and the menu still wins.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const ago = d => new Date(Date.now() - d * 86400000).toISOString();
const al = (eq, d) => ({ id: eq, equipment: eq, sector: 'health', business_type: 'pharmacie', severity: 'CRITICAL', date: ago(d), alert_key: 'health.stock.critical_low', message: `MSG ${eq}`, risk_score: 70, params: [['stock', 5], ['stock_days_left', 2]] });

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const run = async (days, vw = 1440) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: 1000 }, locale: 'en-US', timezoneId: 'UTC' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    await p.route(/\/alerts(\?|$)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(days.map((d, i) => al('Item' + i, d))) }));
    await p.route(/\/recommendations/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"recommendations":[]}' }));
    await p.route(/\/(contractors|assignments)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"contractors":[],"assignments":[]}' }));
    const store = { sentria_onboarded: '1', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', sentria_language: 'en', sentria_company_name: 'Acme', sentria_theme: 'light', sentria_timezone: 'gmt' };
    await p.addInitScript(s => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); } }, store);
    await signedIn(p); await p.goto(APP_URL, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
    return { p, ctx };
  };
  const card = p => p.locator('h3', { hasText: /alerts · \d+ days/ }).locator('xpath=ancestor::div[contains(@class,"rounded-3xl")][1]');

  console.log('== alerts from this week');
  { const { p, ctx } = await run([0, 1, 3]);
    pass(await p.locator('h3', { hasText: 'alerts · 7 days' }).count() === 1, 'stays on 7 days');
    pass(!(await card(p).innerText()).includes('No alerts in this period'), 'and draws the line');
    await ctx.close(); }

  console.log('== alerts from 20 days ago');
  { const { p, ctx } = await run([20, 22]);
    pass(await p.locator('h3', { hasText: 'alerts · 30 days' }).count() === 1, 'the title says 30 days');
    const t = await card(p).innerText();
    pass(t.includes('Last 30 days') && !t.includes('No alerts in this period'), 'the chart shows them: ' + t.replace(/\s+/g, ' ').slice(0, 60));
    const flat = async i => { const d = await p.locator('[data-sparkline] path').nth(i).getAttribute('d'); const n = d.match(/-?\d+(\.\d+)?/g).map(Number); return new Set(n.filter((_, k) => k % 2 === 1).map(v => v.toFixed(1))).size <= 1; };
    pass(await p.locator('[data-sparkline]').count() > 0 && !(await flat(0)), 'and the tile lines are not flat either');
    await p.screenshot({ path: 'chartrange-light.png' });
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== alerts from 60 days ago, and a phone');
  { const { p, ctx } = await run([60], 390);
    pass(await p.locator('h3', { hasText: 'alerts · 90 days' }).count() === 1, 'widens to 90 days');
    await ctx.close(); }

  await browser.close();
  console.log(fails ? `\n${fails} failed` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
