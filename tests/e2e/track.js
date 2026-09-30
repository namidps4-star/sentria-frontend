const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const now = new Date().toISOString(), old = new Date(Date.now() - 86400000).toISOString();
const R = (eq, sector, bt, key, date = now) => ({ equipment: eq, sector, business_type: bt, severity: 'CRITICAL', date, message: `MSG ${eq}`, alert_key: key, recommended_action: `ACT ${eq}`, action_category: 'stock', confidence: 0.8, risk_score: null });
const recs = [
  R('Doliprane', 'health', 'pharmacie', 'health.stock.low'),
  R('Doliprane', 'health', 'pharmacie', 'health.stock.low', old),     // repeat: same task
  R('Gants', 'health', 'clinique-hopital', 'hospital.stock.low'),     // other activity
  R('Riz', 'retail', 'supermarche-hypermarche', 'retail.stock.low'),
  R('GRUE-02', 'logistics', null, 'logistics.cycles.warning'),        // sector not selected
];
const pass = (ok, l) => console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`);
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
    // "Mark handled" from the dashboard saved Doliprane under the shared key.
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ assignments: [{ task_key: 'Doliprane-health.stock.low', status: 'done', priority: 'medium', deadline: null, contractor_ids: [] }] }) });
  });
  await p.addInitScript(() => { const s = { sentria_onboarded: '1', sentria_sector: 'health', sentria_sectors: '["health","commerce"]', sentria_business_type: 'pharmacie', sentria_language: 'en', sentria_company_name: 'Acme' }; for (const k in s) localStorage.setItem(k, s[k]); });
  await require('./auth-mock').signedIn(p); await p.goto(APP_URL, { waitUntil: 'networkidle' });
  console.log('== B-15 tracking board');
  const nav = p.getByRole('button', { name: /^Tracking$/ }).first();
  pass(await nav.count() > 0, 'sidebar has Tracking');
  await nav.click(); await p.waitForTimeout(1200);
  const t = await p.evaluate(() => document.body.innerText);
  pass(t.includes('Doliprane') && t.includes('Riz'), 'pharmacy + retail cards shown');
  pass(!t.includes('Gants'), 'other activity (hospital) hidden');
  pass(!t.includes('GRUE-02'), 'unselected sector (logistics) hidden');
  pass((t.match(/ACT Doliprane|MSG Doliprane/g) || []).length <= 2 && (await p.locator('article', { hasText: 'Doliprane' }).count()) === 1, 'repeat alert = one card');
  const doneCol = await p.evaluate(() => { const secs = [...document.querySelectorAll('section')]; const s = secs.find(x => /Resolved/.test(x.innerText.split('\n').slice(0,3).join(' '))); return s ? s.innerText : ''; });
  pass(doneCol.includes('Doliprane'), 'task handled on dashboard shows in Resolved');
  pass(/all priorities/i.test(t), 'header says All priorities');
  console.log('== B-16 assignee / due date');
  const card = p.locator('article', { hasText: 'Riz' });
  await card.getByRole('button', { name: /Assign/ }).first().click(); await p.waitForTimeout(300);
  pass(await p.getByRole('dialog', { name: 'Assign the task' }).count() === 1, 'owner button opens assignee picker');
  pass(await p.locator('#priority-detail-deadline').count() === 0, 'detail dialog not opened');
  await p.getByRole('dialog', { name: 'Assign the task' }).getByText('Awa Diop').click(); await p.waitForTimeout(500);
  pass(saved.some(s => s.task_key === 'Riz-retail.stock.low' && s.contractor_ids.includes('c1')), 'ticking a person saves under the shared key');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  pass(await p.getByRole('dialog', { name: 'Assign the task' }).count() === 0, 'Escape closes picker');
  await card.getByLabel('Due date for Riz').fill('2026-10-05'); await p.waitForTimeout(500);
  pass(saved.some(s => s.task_key === 'Riz-retail.stock.low' && s.deadline === '2026-10-05'), 'due date set in place and saved');
  pass(await p.locator('#priority-detail-deadline').count() === 0, 'due date does not open detail');
  await card.getByRole('button', { name: 'Priority detail for Riz' }).click(); await p.waitForTimeout(300);
  pass(await p.locator('#priority-detail-deadline').count() === 1, '"…" still opens detail');
  pass(errors.length === 0, 'no page errors ' + errors.join('|'));
  await p.screenshot({ path: 'track.png' });
  await b.close();
})();
