// F-SUPPRESS: a demoted alert says so, a card can be dismissed and restored,
// and what people do is reported to the backend (POST /alerts/feedback).
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const now = new Date().toISOString();
const json = (r, body) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

const ALERTS = [
  { equipment: 'Rice', severity: 'WARNING', sector: 'health', business_type: 'pharmacie', date: now, alert_key: 'health.stock.critical_low',
    message: 'Stock-out imminent: 4 units left', params: [['stock', 4], ['demo_dismissed', 5], ['demo_of', 6], ['demo_from', 'CRITICAL']] },
  { equipment: 'Beans', severity: 'CRITICAL', sector: 'health', business_type: 'pharmacie', date: now, alert_key: 'health.stock.critical_low',
    message: 'Stock-out imminent: 2 units left', params: [['stock', 2]] },
];
const R = (eq, sector, bt, key) => ({ equipment: eq, sector, business_type: bt, severity: 'CRITICAL', date: now, message: `MSG ${eq}`, alert_key: key, recommended_action: `ACT ${eq}`, action_category: 'stock', confidence: 0.8, risk_score: null });
const RECS = [R('Doliprane', 'health', 'pharmacie', 'health.stock.low'), R('Riz', 'retail', 'supermarche-hypermarche', 'retail.stock.low')];

(async () => {
  const b = await chromium.launch(LAUNCH);
  const p = await b.newPage({ viewport: { width: +(process.env.E2E_VW || 1440), height: 1500 } });
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  const saved = [], feedback = [];
  await p.route(/\/alerts(\?|$)/, r => json(r, ALERTS));
  await p.route(/\/recommendations/, r => json(r, { recommendations: RECS }));
  await p.route(/\/contractors/, r => json(r, { contractors: [] }));
  await p.route(/\/assignments/, r => {
    if (r.request().method() === 'PUT') { const body = JSON.parse(r.request().postData()); saved.push(body); return json(r, { assignment: body }); }
    // Riz was dismissed in an earlier session.
    json(r, { assignments: [{ task_key: 'Riz-retail.stock.low', status: 'dismissed', priority: 'medium', deadline: null, contractor_ids: [] }] });
  });
  await p.route(/\/alerts\/feedback/, r => { feedback.push(JSON.parse(r.request().postData())); json(r, { success: true }); });
  await p.addInitScript(theme => { const s = { sentria_onboarded: '1', sentria_sector: 'health', sentria_sectors: '["health","commerce"]', sentria_business_type: 'pharmacie', sentria_language: 'en', sentria_company_name: 'Acme', sentria_theme: theme }; for (const k in s) localStorage.setItem(k, s[k]); }, process.env.E2E_THEME || 'light');
  await require('./auth-mock').signedIn(p); await p.goto(APP_URL, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);

  console.log('== a lowered alert says so');
  const row = n => p.locator('tbody tr', { hasText: n }).first();
  const rice = (await row('Rice').locator('td').nth(3).innerText()).replace(/\s+/g, ' ');
  const beans = (await row('Beans').locator('td').nth(3).innerText()).replace(/\s+/g, ' ');
  pass(/Lowered/.test(rice), 'Rice (dismissed 5 of 6) carries a "Lowered" tag: ' + rice);
  pass(!/Lowered/.test(beans), 'Beans has none: ' + beans);
  pass(await row('Rice').getByText('Lowered from Critical to Warning: dismissed 5 of its last 6 times', { exact: false }).count() === 1, 'screen readers hear the reason');
  await row('Rice').click(); await p.waitForTimeout(500);
  const detail = await p.evaluate(() => document.body.innerText);
  pass(/Lowered from Critical to Warning: dismissed 5 of its last 6 times\. Mark it handled once/.test(detail), 'detail panel explains it and how to reset');
  await p.screenshot({ path: `suppress-dashboard${process.env.E2E_TAG || ''}.png` });

  // The sidebar is collapsed on a phone: the board is covered at desktop width.
  if (+(process.env.E2E_VW || 1440) < 768) { pass(errors.length === 0, 'no page errors ' + errors.join('|')); await b.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL OK'); process.exit(fails ? 1 : 0); }

  console.log('== tracking: dismiss, restore');
  await p.getByRole('button', { name: /^Tracking$/ }).first().click(); await p.waitForTimeout(1200);
  let t = await p.evaluate(() => document.body.innerText);
  pass(t.includes('Doliprane') && !/\bMSG Riz\b/.test(t), 'Riz was dismissed earlier: not on the board; Doliprane is');
  pass(/Dismissed: 1/.test(t), 'a "Dismissed: 1" line is shown');
  await p.getByRole('button', { name: 'Priority detail for Doliprane' }).click(); await p.waitForTimeout(300);
  await p.getByRole('button', { name: /Dismiss: not useful/ }).click(); await p.waitForTimeout(700);
  t = await p.evaluate(() => document.body.innerText);
  pass(await p.locator('article', { hasText: 'Doliprane' }).count() === 0, 'Dismiss removes the card from the board');
  pass(saved.some(s => s.task_key === 'Doliprane-health.stock.low' && s.status === 'dismissed'), 'saved as status dismissed');
  pass(feedback.some(f => f.alert_key === 'health.stock.low' && f.equipment === 'Doliprane' && f.action === 'dismissed'), 'feedback "dismissed" reported with alert_key and equipment');
  pass(/Dismissed: 2/.test(t), 'the dismissed line now says 2');
  await p.getByRole('button', { name: /Dismissed: 2/ }).click(); await p.waitForTimeout(300);
  await p.getByRole('listitem').filter({ hasText: 'Doliprane' }).getByRole('button', { name: 'Restore' }).click(); await p.waitForTimeout(700);
  pass(await p.locator('article', { hasText: 'Doliprane' }).count() === 1, 'Restore brings the card back');
  pass(saved.some(s => s.task_key === 'Doliprane-health.stock.low' && s.status === 'todo'), 'restored as todo');
  pass(!feedback.some(f => f.action === 'acted'), 'restoring is not reported as acting');

  console.log('== acting is reported');
  await p.getByRole('button', { name: 'Priority detail for Doliprane' }).click(); await p.waitForTimeout(300);
  await p.getByRole('button', { name: 'In progress' }).click(); await p.waitForTimeout(700);
  pass(feedback.some(f => f.alert_key === 'health.stock.low' && f.equipment === 'Doliprane' && f.action === 'acted'), 'moving to In progress reports "acted"');
  await p.screenshot({ path: `suppress-board${process.env.E2E_TAG || ''}.png` });
  pass(errors.length === 0, 'no page errors ' + errors.join('|'));
  await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL OK'); process.exit(fails ? 1 : 0);
})();
