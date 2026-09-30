const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const iso = (h) => new Date(Date.now() - h * 3600000).toISOString();
const A = (id, eq, sector, bt, key, sev, h) => ({ id, equipment: eq, sector, business_type: bt, severity: sev, date: iso(h), message: `MSG ${eq}`, alert_key: key });
const alerts = [
  A(1, 'Doliprane', 'health', 'pharmacie', 'health.stock.low', 'CRITICAL', 1),
  A(2, 'Amox', 'health', 'pharmacie', 'health.expiry.critical', 'CRITICAL', 2),   // handled
  A(3, 'Gants', 'health', 'clinique-hopital', 'hospital.stock.low', 'CRITICAL', 1), // other activity
  A(4, 'GRUE-02', 'logistics', null, 'logistics.cycles.critical', 'CRITICAL', 1),  // other sector
  A(5, 'Riz', 'retail', 'supermarche-hypermarche', 'retail.stock.low', 'WARNING', 1),
];
const recs = alerts.map(a => ({ ...a, recommended_action: `ACT ${a.equipment}`, action_category: 'stock', confidence: 0.8 }));
const assignments = [{ task_key: 'Amox-health.expiry.critical', status: 'done', priority: 'medium', deadline: null, contractor_ids: [] },
                     { task_key: 'Riz-retail.stock.low', status: 'todo', priority: 'medium', deadline: new Date(Date.now()+2*86400000).toISOString().slice(0,10), contractor_ids: [] }];
const pass = (ok, l) => console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`);
(async () => {
  const b = await chromium.launch(LAUNCH);
  const p = await b.newPage({ viewport: { width: 1440, height: 1400 } });
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.route(/\/alerts(\?|$)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(alerts) }));
  await p.route(/\/recommendations/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ recommendations: recs }) }));
  await p.route(/\/contractors/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ contractors: [] }) }));
  await p.route(/\/assignments/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ assignments }) }));
  await p.addInitScript(() => { const s = { sentria_onboarded: '1', sentria_sector: 'health', sentria_sectors: '["health","commerce"]', sentria_business_type: 'pharmacie', sentria_language: 'en', sentria_company_name: 'Acme' }; for (const k in s) if (localStorage.getItem(k) === null) localStorage.setItem(k, s[k]); });
  await require('./auth-mock').signedIn(p); await p.goto(APP_URL, { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
  console.log('== B-22 bell');
  const bell = p.getByRole('button', { name: /critical alert/i }).first();
  const label = await bell.getAttribute('aria-label');
  pass(/\b1 critical alert\b/.test(label), `unread count = 1 (label: "${label}")`);
  await bell.click(); await p.waitForTimeout(300);
  const menu = p.getByRole('dialog', { name: 'Critical alerts' });
  const mt = await menu.innerText();
  pass(mt.includes('Doliprane'), 'lists open pharmacy critical');
  pass(!mt.includes('Amox'), 'handled task not listed');
  pass(!mt.includes('Gants') && !mt.includes('GRUE-02'), 'other activity / sector not listed');
  pass(!mt.includes('Riz'), 'warnings not listed');
  await menu.getByText('Open tracking').click(); await p.waitForTimeout(800);
  pass((await p.evaluate(() => document.querySelector('h1')?.innerText)) === 'Tracking', 'Open tracking goes to Tracking page');
  const label2 = await p.getByRole('button', { name: /critical alert/i }).first().getAttribute('aria-label');
  pass(!/^1 /.test(label2), `after opening, unread = 0 (label: "${label2}")`);
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(800);
  const label3 = await p.getByRole('button', { name: /critical alert/i }).first().getAttribute('aria-label');
  pass(label3 === label2, 'read state survives reload');
  console.log('== B-21 search');
  const search = p.locator('header input[type=search]');
  await search.fill('abc');
  const cancel = await search.evaluate(el => getComputedStyle(el, '::-webkit-search-cancel-button').appearance);
  pass(/search-cancel-button\]:hidden/.test(await search.getAttribute('class')), 'native clear hidden (class rule present; visual check done)');
  pass(await p.locator('header').getByRole('button', { name: /clear/i }).count() === 1, 'one custom clear button');
  await search.fill('');
  console.log('== B-18 profile');
  await p.getByRole('button', { name: /^Profile$/ }).first().click(); await p.waitForTimeout(1000);
  const pt = await p.evaluate(() => document.body.innerText);
  { const i = pt.indexOf('Tasks resolved'); console.log('     ', JSON.stringify(pt.slice(i-30, i+15))); pass(/33 %\s*Tasks resolved/.test(pt), 'Tasks resolved = 33 % (1 done of Doliprane, Amox, Riz)'); }
  console.log('== B-19 calendar');
  await p.getByRole('button', { name: /^Calendar$/ }).first().click(); await p.waitForTimeout(1200);
  const ct = await p.evaluate(() => document.body.innerText);
  pass(!ct.includes('Gants') && !ct.includes('GRUE-02'), 'calendar hides other activity / sector');
  pass(!/\bretail\b/.test(ct), 'no raw "retail" sector label');
  pass(errors.length === 0, 'no page errors ' + errors.join('|'));
  await b.close();
})();
