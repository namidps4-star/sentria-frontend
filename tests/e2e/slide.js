// B-13 realistic: slow API like Render. Track the upload button's screen position.
const { LAUNCH, APP_URL } = require('./env');
const { chromium } = require('playwright');
const now = new Date().toISOString();
const A = (id, eq, key, sev='CRITICAL') => ({ id, equipment: eq, sector: 'health', business_type: 'pharmacie', severity: sev, date: now, alert_key: key, message: `MSG ${eq}`, risk_score: 70 });
(async () => {
  const browser = await chromium.launch(LAUNCH);
  let fails = 0;
  for (const [label, start, status, vw] of [['empty account', [], 200, 1440], ['with data', [A(1,'Doliprane','health.stock.low')], 200, 1440], ['wrong file 422', [A(1,'Doliprane','health.stock.low')], 422, 1440], ['phone', [A(1,'Doliprane','health.stock.low')], 200, 390]]) {
    const p = await browser.newPage({ viewport: { width: vw, height: 844 } });
    let current = start;
    const delay = ms => new Promise(r => setTimeout(r, ms));
    await p.route(/\/alerts(\?|$)/, async r => { await delay(700); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(current) }); });
    await p.route(/\/recommendations/, async r => { await delay(1800); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ recommendations: current.map(a => ({ ...a, recommended_action: `ACT ${a.equipment}`, action_category: 'stock', confidence: 0.8 })) }) }); });
    await p.route(/\/(assignments|contractors)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"assignments":[],"contractors":[]}' }));
    await p.route(/\/upload/, async r => { await delay(2500); r.fulfill(status === 422 ? { status: 422, contentType: 'application/json', body: JSON.stringify({ error_code: 'upload_columns_missing', message: 'This file is missing columns for a pharmacy: medicine_name.', looks_like: [{ sector: 'health', business_type: 'clinique-hopital' }] }) } : { status: 200, contentType: 'application/json', body: '{"success":true,"message":"Processed 8 rows, 8 alert(s) fired."}' }); });
    await p.addInitScript(() => { localStorage.clear(); Object.entries({ sentria_onboarded: '1', sentria_language: 'en', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie' }).forEach(([k, v]) => localStorage.setItem(k, v)); });
    await require('./auth-mock').signedIn(p); await p.goto(APP_URL, { waitUntil: 'networkidle' }); await p.waitForTimeout(2500);
    await p.click('button[aria-controls=import-panel]'); await p.waitForTimeout(150); 
    await p.evaluate(() => document.querySelector('input[type=file]').closest('label').scrollIntoView({ block: 'center' }));
    await p.waitForTimeout(300);
    const pos = () => p.evaluate(() => Math.round(document.querySelector('input[type=file]').closest('label').getBoundingClientRect().top));
    const before = await pos();
    current = [...start, ...Array.from({ length: 8 }, (_, k) => A(100 + k, `Med ${k}`, k % 2 ? 'health.expiry.soon' : 'health.stock.low', k % 2 ? 'WARNING' : 'CRITICAL'))];
    await p.setInputFiles('input[type=file]', { name: 'x.csv', mimeType: 'text/csv', buffer: Buffer.from('medicine_name,stock_qty\nA,1\n') });
    const track = [];
    for (let t = 0; t < 30; t++) { await p.waitForTimeout(250); track.push((await pos()) - before); }
    const moved = track.filter(d => Math.abs(d) > 2);
    const ok = moved.length === 0; fails += !ok;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: upload button offset over 7.5s: ${[...new Set(track)].join(', ')}`);
    await p.close();
  }
  await browser.close(); process.exit(fails ? 1 : 0);
})();
