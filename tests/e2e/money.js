// F-MONEY: an alert that carries a value at risk shows the amount beside its severity.
// The /alerts rows below are shaped like the backend's (params = ordered [name, value] pairs,
// as Sentria pipeline/alerts.py save_alert stores them).
const { LAUNCH, APP_URL } = require('./env');
const { chromium } = require('playwright');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const now = new Date().toISOString();
const ALERTS = [
  { equipment: 'Amoxicillin', severity: 'WARNING', sector: 'health', business_type: 'pharmacie', date: now, alert_key: 'health.stock.critical_low',
    message: 'Stock-out imminent: 50 units left (minimum: 100), 600 $ of stock : order now',
    params: [['risk_score', 21], ['stock', 50], ['min_stock', 100], ['category', 'Unknown'], ['value', 600], ['currency', '$']] },
  { equipment: 'Insulin', severity: 'CRITICAL', sector: 'health', business_type: 'pharmacie', date: now, alert_key: 'health.cold_chain.broken',
    message: 'Cold chain broken: 12°C : 1250000 F CFA of stock exposed, check product integrity immediately',
    params: [['risk_score', 40], ['temp', 12], ['value', 1250000], ['currency', 'F CFA']] },
  { equipment: 'Ibuprofen', severity: 'WARNING', sector: 'health', business_type: 'pharmacie', date: now, alert_key: 'health.stock.low',
    message: 'Low stock: 20 units remaining, 400 of stock : anticipate reorder',
    params: [['stock', 20], ['value', 400], ['currency', '']] },
  { equipment: 'Store A', severity: 'CRITICAL', sector: 'health', business_type: 'pharmacie', date: now, alert_key: 'retail.shrinkage.critical',
    message: 'Critical shrinkage: 5%', params: [['risk_score', 25], ['value', 5]] },
  { equipment: 'Paracetamol', severity: 'WARNING', sector: 'health', business_type: 'pharmacie', date: now, alert_key: 'health.stock.low',
    message: 'Low stock: 12 units remaining : anticipate reorder' },
];
const ONB = { sentria_onboarded: 'true', sentria_company_name: 'Pharmacie A', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie' };

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async ({ lang = 'en', theme = 'light', vw = 1440 } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: 900 }, locale: 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    await p.route(/onrender\.com\//, r => { const u = new URL(r.request().url());
      r.fulfill({ status: 200, contentType: 'application/json', body: u.pathname === '/alerts' ? JSON.stringify(ALERTS) : '{"recommendations":[],"assignments":[],"contractors":[]}' }); });
    await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } }, { ...ONB, sentria_language: lang, sentria_theme: theme });
    await signedIn(p, 'u-1', 'a@b.c', { plan: 'business' });
    await p.goto(APP_URL); await p.waitForTimeout(2200);
    return { p, ctx };
  };
  const row = (p, name) => p.locator('tbody tr', { hasText: name }).first();

  console.log('== English, light');
  { const { p, ctx } = await open();
    const amox = (await row(p, 'Amoxicillin').locator('td').nth(3).innerText()).replace(/\s+/g, ' ');
    pass(/Warning .*600 \$/.test(amox), 'stock-out row shows "600 $" beside severity: ' + amox);
    pass(/1,250,000 F CFA/.test(await row(p, 'Insulin').locator('td').nth(3).innerText()), 'large amount grouped the English way: 1,250,000 F CFA');
    const ibu = await row(p, 'Ibuprofen').locator('td').nth(3).innerText();
    pass(/^\s*Warning\s*(Value at risk:\s*)?400\s*$/.test(ibu.replace(/\n/g, ' ')), 'unknown currency: the amount alone, no guessed symbol: ' + JSON.stringify(ibu));
    const shrink = await row(p, 'Store A').locator('td').nth(3).innerText();
    pass(!/\d/.test(shrink), 'a rate (shrinkage 5%) is not shown as money: ' + JSON.stringify(shrink));
    const para = await row(p, 'Paracetamol').locator('td').nth(3).innerText();
    pass(!/\d/.test(para), 'no value in the alert: severity alone, as before');
    pass(await row(p, 'Amoxicillin').getByText('Value at risk:', { exact: false }).count() === 1, 'screen readers hear "Value at risk"');
    await row(p, 'Amoxicillin').scrollIntoViewIfNeeded(); await p.evaluate(() => window.scrollBy(0, 200));
    await p.screenshot({ path: 'money-en.png' });
    await row(p, 'Insulin').click(); await p.waitForTimeout(500);
    const close = p.getByRole('button', { name: 'Close the detail' }).first();
    const header = close.locator('xpath=..');
    pass(/Critical/.test(await header.innerText()) && /1,250,000 F CFA/.test(await header.innerText()), 'detail panel: amount beside the severity');
    await p.screenshot({ path: 'money-detail-en.png' });
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== French, dark');
  { const { p, ctx } = await open({ lang: 'fr', theme: 'dark' });
    const t = (await row(p, 'Insulin').locator('td').nth(3).innerText()).replace(/\s/g, ' ');
    pass(/1 250 000 F CFA/.test(t), 'French grouping: 1 250 000 F CFA');
    await row(p, 'Insulin').click(); await p.waitForTimeout(500);
    await row(p, 'Amoxicillin').scrollIntoViewIfNeeded(); await p.evaluate(() => window.scrollBy(0, 200));
    await p.screenshot({ path: 'money-fr-dark.png' });
    await ctx.close(); }

  console.log('== phone');
  { const { p, ctx } = await open({ vw: 390 });
    pass(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no sideways page scroll (the table scrolls inside its box)');
    await row(p, 'Amoxicillin').scrollIntoViewIfNeeded();
    await p.screenshot({ path: 'money-390.png' });
    await ctx.close(); }

  await browser.close();
  console.log(`\n${fails ? fails + ' failure(s)' : 'ALL OK'}`); process.exit(fails ? 1 : 0);
})();
