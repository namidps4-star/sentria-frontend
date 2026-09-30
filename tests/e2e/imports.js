// Import progress panel, per-department onboarding imports, department tabs, names.
const { LAUNCH, APP_URL } = require('./env');
const { chromium } = require('playwright');
const { signedIn } = require('./auth-mock');
const APP = APP_URL;
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const soon = new Date(Date.now() + 9 * 86400000).toISOString();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const panelText = p => p.evaluate(() => document.querySelector('[role=dialog][aria-label="Data import"]')?.innerText ?? '');
(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async ({ ls, onUpload, plan = 'entreprise', trialEndsAt = null, meta } = {}) => {
    const p = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
    p._errors = []; p.on('pageerror', e => p._errors.push(e.message)); p._uploads = [];
    await p.route(/onrender\.com\//, async r => { const u = new URL(r.request().url());
      if (u.pathname === '/upload') { p._uploads.push({ bt: u.searchParams.get('business_type'), auth: r.request().headers()['authorization'] }); return onUpload(r, u); }
      r.fulfill({ status: 200, contentType: 'application/json', body: u.pathname === '/alerts' ? '[]' : '{"recommendations":[],"assignments":[],"contractors":[]}' }); });
    await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } }, { sentria_language: 'en', ...(ls || {}) });
    await signedIn(p, 'u-1', 'ama@pharma.bj', { plan, trialEndsAt, meta });
    await p.goto(APP); await p.waitForTimeout(1800); return p;
  };
  const ok = (rows, alerts, delay = 0) => async r => { await sleep(delay); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, rows_processed: rows, alerts_fired: alerts, saves_failed: 0 }) }); };
  const ONB = { sentria_onboarded: 'true', sentria_company_name: 'Pharmacie A', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie' };

  console.log('== dashboard import panel');
  { const p = await open({ ls: ONB, onUpload: ok(8, 3, 2500), meta: { full_name: 'Ama Mensah' } });
    const side = await p.evaluate(() => document.querySelector('aside').innerText);
    pass(/Ama Mensah/.test(side) && /ama@pharma\.bj/.test(side), 'sidebar shows the name, email underneath');
    await p.setInputFiles('input[type=file]', { name: 'stock.csv', mimeType: 'text/csv', buffer: Buffer.from('medicine_name,stock_qty\nA,1\n') });
    await p.waitForTimeout(1500);
    let t = await panelText(p);
    pass(/stock\.csv/.test(t) && /Sending the file/.test(t) && /Checking the columns and analysing/.test(t), 'while it works: file name and both stages');
    pass(/Working · [1-9]\d* s/.test(t) && !/0 %/.test(t), 'no progress reported by the browser: a live seconds counter, not a stuck "0 %"');
    pass(await p.locator('[role=dialog][aria-label="Data import"] button').count() === 0, 'no close button while busy');
    await p.screenshot({ path: 'import-panel-working.png' });
    await p.waitForTimeout(1800);
    t = await panelText(p);
    pass(/Import complete/.test(t) && /8 rows analysed · 3 alerts/.test(t), 'result: real counts (8 rows, 3 alerts)');
    await p.screenshot({ path: 'import-panel-done.png' });
    await p.locator('[role=dialog][aria-label="Data import"]').getByRole('button', { name: 'See the alerts' }).click(); await p.waitForTimeout(300);
    pass(await p.locator('[role=dialog][aria-label="Data import"]').count() === 0, '"See the alerts" closes the panel');
    pass(p._uploads[0]?.auth?.startsWith('Bearer '), 'upload carries the sign-in token');
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await p.close(); }
  { const p = await open({ ls: ONB, onUpload: r => r.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ error_code: 'upload_columns_missing', message: 'This file is missing: medicine_name.' }) }) });
    await p.click('button[aria-controls=import-panel]'); await p.waitForTimeout(150); 
    await p.setInputFiles('input[type=file]', { name: 'wrong.csv', mimeType: 'text/csv', buffer: Buffer.from('a,b\n1,2\n') }); await p.waitForTimeout(1200);
    const t = await panelText(p);
    pass(/File refused, nothing was saved/.test(t) && /missing: medicine_name/.test(t), 'refusal: says nothing was saved, and why');
    await p.locator('[role=dialog][aria-label="Data import"]').getByRole('button', { name: 'Close' }).click(); await p.waitForTimeout(200);
    if (await p.locator('#import-panel').isHidden()) { await p.click('button[aria-controls=import-panel]'); await p.waitForTimeout(150);  }
    pass(/missing: medicine_name/.test(await p.locator('#import-panel').innerText()), 'message also stays in the import panel');
    await p.close(); }
  { const p = await open({ ls: { ...ONB, sentria_sector: 'all', sentria_sectors: '["industry","health"]', sentria_business_type: 'usine-production' }, onUpload: ok(4, 2, 800) });
    await p.click('button[aria-controls=import-panel]'); await p.waitForTimeout(150); 
    await p.getByRole('button', { name: 'Industry', exact: true }).first().click(); await p.waitForTimeout(200);
    await p.setInputFiles('input[type=file]', { name: 'machines.csv', mimeType: 'text/csv', buffer: Buffer.from('Product ID,rpm\nM1,1\n') }); await p.waitForTimeout(4500);
    pass(/Import complete/.test(await panelText(p)), 'panel stays up when the dashboard switches to the industry layout');
    await p.close(); }

  console.log('== onboarding: one file per department, then good to go');
  { const p = await open({ ls: {}, plan: 'decouverte', trialEndsAt: soon, onUpload: async (r, u) => {
      const bt = u.searchParams.get('business_type'); p._n = (p._n || 0) + 1;
      if (bt === 'laboratoire' && !p._labFixed) { p._labFixed = true; return r.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ error_code: 'upload_columns_missing', message: 'This file is missing: test_name.' }) }); }
      return ok(bt === 'pharmacie' ? 40 : 12, bt === 'pharmacie' ? 5 : 2, 600)(r); } });
    const next = async () => { await p.getByRole('button', { name: /^Continue/ }).last().click(); await p.waitForTimeout(400); };
    const step = async () => (await p.evaluate(() => { const h = document.querySelector('[role=dialog] h2')?.innerText || document.body.innerText; const keys = [['Your country', '2'], ['Your company', '3'], ['Your sector', '4'], ['Your activity', '5'], ['Your priorities', '6'], ['What do you want to monitor', '6'], ['Your data', '7']]; return (keys.find(([k]) => h.includes(k)) || [])[1]; }));  // old step numbers, found by heading
    for (let i = 0; i < 10; i++) { const s = await step();
      if (s === '2') await p.getByText('Benin', { exact: true }).first().click();
      if (s === '3') await p.locator('input').first().fill('Clinique Sud');
      if (s === '4') await p.getByText(/^Health$/).first().click();
      if (s === '5') { await p.locator('button[aria-pressed]', { hasText: /Pharmac/ }).first().click(); await p.locator('button[aria-pressed]', { hasText: /Lab/ }).first().click(); }
      if (s === '6') await p.locator('[role=dialog] button', { hasText: /Stock|Expir|Rupture/ }).first().click();
      if (s === '7') break;
      await next(); }
    await p.locator('[role=dialog] button', { hasText: /CSV/ }).first().click(); await p.waitForTimeout(300);
    let t = await p.evaluate(() => document.querySelector('[role=dialog]').innerText);
    pass(/Import one file per department/.test(t) && /0 \/ 2 ready/.test(t), 'two departments: one file each, "0 / 2 ready"');
    pass((t.match(/To import/g) || []).length === 2, 'a slot for Pharmacy and one for Laboratory');
    await p.getByLabel(/CSV file: Pharmac/).setInputFiles({ name: 'pharma.csv', mimeType: 'text/csv', buffer: Buffer.from('medicine_name,stock_qty\nA,1\n') });
    await p.waitForTimeout(300);
    t = await p.evaluate(() => document.querySelector('[role=dialog]').innerText);
    pass(/Checking…/.test(t), 'pharmacy: checking while the server works');
    await p.waitForTimeout(1200);
    t = await p.evaluate(() => document.querySelector('[role=dialog]').innerText);
    pass(/1 \/ 2 ready/.test(t) && /40 rows analysed · 5 alerts/.test(t), 'pharmacy ready: "1 / 2 ready", 40 rows, 5 alerts');
    await p.getByLabel(/CSV file: Lab/).setInputFiles({ name: 'bad.csv', mimeType: 'text/csv', buffer: Buffer.from('a,b\n1,2\n') }); await p.waitForTimeout(1200);
    t = await p.evaluate(() => document.querySelector('[role=dialog]').innerText);
    pass(/Needs a fix/.test(t) && /missing: test_name/.test(t) && /1 \/ 2 ready/.test(t), 'lab file refused: "Needs a fix" with the reason, still 1 / 2');
    await p.getByLabel(/CSV file: Lab/).setInputFiles({ name: 'lab.csv', mimeType: 'text/csv', buffer: Buffer.from('test_name,tests_remaining\nG,5\n') }); await p.waitForTimeout(1800);
    t = await p.evaluate(() => document.querySelector('[role=dialog]').innerText);
    pass(/2 \/ 2 ready/.test(t) && /You're good to go/.test(t) && /Each one gets its own view/.test(t), 'both ready: "2 / 2", "You\'re good to go"');
    pass(/Pharmacy · 40 rows, 5 alerts/.test(t) && /Laboratory · 12 rows, 2 alerts/.test(t), 'summary per department');
    pass(p._uploads.map(u => u.bt).join(',') === 'pharmacie,laboratoire,laboratoire', 'each file sent for its own department');
    await p.screenshot({ path: 'onb-imports.png', fullPage: true });
    await p.getByRole('button', { name: /Open my dashboard/ }).click(); await p.waitForTimeout(1500);
    const tabs = p.getByRole('tablist', { name: 'Your departments' });
    pass(await tabs.count() === 1 && await tabs.getByRole('tab').count() === 2, 'dashboard: a tab per department');
    await tabs.getByRole('tab', { name: 'Laboratory' }).click(); await p.waitForTimeout(400);
    pass(await tabs.getByRole('tab', { name: 'Laboratory' }).getAttribute('aria-selected') === 'true' && await p.evaluate(() => localStorage.getItem('sentria_business_type')) === 'laboratoire', 'Laboratory tab switches the dashboard to the lab view');
    await p.screenshot({ path: 'dash-tabs.png' });
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await p.close(); }
  { const p = await open({ ls: ONB, onUpload: ok(1, 1) });
    pass(await p.getByRole('tablist', { name: 'Your departments' }).count() === 0, 'one department: no tabs');
    await p.close(); }

  await browser.close();
  console.log(`\n${fails ? fails + ' failure(s)' : 'ALL OK'}`); process.exit(fails ? 1 : 0);
})();
