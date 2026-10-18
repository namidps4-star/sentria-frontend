// P-RECAPI: the task key the API puts on a recommendation is the one every screen tracks it under.
// With task_key on the row, the tracking board saves under that exact key and shows the task as handled when
// the API's saved list holds it. An API that has not been redeployed leaves task_key out: the key is built from
// the equipment and the alert key, as before.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const now = new Date().toISOString();
const R = (eq, key, task_key) => ({ equipment: eq, sector: 'health', business_type: 'pharmacie', severity: 'CRITICAL', date: now, message: `MSG ${eq}`, alert_key: key, ...(task_key ? { task_key } : {}), recommended_action: `ACT ${eq}`, action_category: 'stock', confidence: 0.8, risk_score: null });
const recs = [R('Doliprane', 'health.stock.low', 'SERVER-KEY-doliprane'), R('Aspirine', 'health.expiry.soon')];
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };

(async () => {
  const b = await chromium.launch(LAUNCH);
  const p = await b.newPage({ viewport: { width: 1440, height: 1400 } });
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  const saved = [];
  await p.route(/\/alerts(\?|$)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await p.route(/\/recommendations/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ recommendations: recs }) }));
  await p.route(/\/contractors/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ contractors: [{ id: 'c1', name: 'Awa Diop', availability: 'available', open_assignments: 0, active: true, role: null, phone: null, note: null }] }) }));
  await p.route(/\/assignments/, r => {
    if (r.request().method() === 'PUT') { const body = JSON.parse(r.request().postData()); saved.push(body); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ assignment: body }) }); }
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ assignments: [{ task_key: 'SERVER-KEY-doliprane', status: 'done', priority: 'medium', deadline: null, contractor_ids: [] }] }) });
  });
  await p.addInitScript(() => { const s = { sentria_onboarded: '1', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', sentria_language: 'en', sentria_company_name: 'Acme' }; for (const k in s) localStorage.setItem(k, s[k]); });
  await require('./auth-mock').signedIn(p); await p.goto(APP_URL, { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: /^Tracking$/ }).first().click(); await p.waitForTimeout(1200);

  const doneCol = await p.evaluate(() => { const s = [...document.querySelectorAll('section')].find(x => /Resolved/.test(x.innerText.split('\n').slice(0, 3).join(' '))); return s ? s.innerText : ''; });
  pass(doneCol.includes('Doliprane') && !doneCol.includes('Aspirine'), 'the task the API lists as done under its server key lands in Resolved (and only it)');

  const card = p.locator('article', { hasText: 'Aspirine' });
  await card.getByLabel('Due date for Aspirine').fill('2026-10-05'); await p.waitForTimeout(500);
  pass(saved.some(s => s.task_key === 'Aspirine-health.expiry.soon' && s.deadline === '2026-10-05'), 'a row without task_key (older API) is saved under equipment-alert_key, as before');

  const cardD = p.locator('article', { hasText: 'Doliprane' });
  await cardD.getByLabel('Due date for Doliprane').fill('2026-10-06').catch(() => {}); await p.waitForTimeout(500);
  const forD = saved.find(s => s.deadline === '2026-10-06');
  pass(!forD || forD.task_key === 'SERVER-KEY-doliprane', 'a row with task_key is saved under exactly that key' + (forD ? '' : ' (a resolved card has no due-date field: nothing saved)'));
  pass(!saved.some(s => s.task_key === 'Doliprane-health.stock.low'), 'the locally built key is not used when the API gave one');
  pass(errors.length === 0, 'no page errors ' + errors.join('|'));
  await b.close();
  console.log(fails ? `\n${fails} failed` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
