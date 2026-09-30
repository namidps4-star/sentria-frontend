const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const now = new Date().toISOString();
const A = (id, sector, bt, eq, msg) => ({ id, equipment: eq, sector, business_type: bt, severity: 'CRITICAL', date: now, message: msg, alert_key: null });
const pharma = A('1', 'health', 'pharmacie', 'Doliprane', 'PHARMA ALERT stock low');
const shop = A('2', 'retail', 'supermarche-hypermarche', 'Yaourt', 'SHOP ALERT expiry');
const hosp = A('3', 'health', 'clinique-hopital', 'Gants', 'HOSPITAL ALERT fridge');
async function run(name, uploadSectorLabel, activityLabel, uploadStatus, after, expect) {
  const b = await chromium.launch(LAUNCH);
  const p = await b.newPage({ viewport: { width: 1440, height: 1400 } });
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  let uploaded = false, uploadUrl = '';
  await p.route(/\/alerts(\?|$)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(uploaded ? [pharma, ...after] : [pharma]) }));
  await p.route(/\/recommendations/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await p.route(/\/upload/, r => { uploadUrl = r.request().url(); uploaded = uploadStatus === 200;
    r.fulfill(uploadStatus === 200
      ? { status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, message: 'Processed 1 rows, 1 alert(s) fired.' }) }
      : { status: 422, contentType: 'application/json', body: JSON.stringify({ success: false, error_code: 'upload_columns_missing', message: "This file doesn't match the chosen activity. Missing columns: medicine_name. Expected columns: medicine_name, stock_qty.", looks_like: [{ sector: 'health', business_type: 'clinique-hopital' }] }) }); });
  await p.addInitScript(() => { localStorage.setItem('sentria_onboarded','1'); localStorage.setItem('sentria_sector','health');
    localStorage.setItem('sentria_sectors', JSON.stringify(['health','commerce'])); localStorage.setItem('sentria_business_type','pharmacie'); localStorage.setItem('sentria_language','en'); });
  await require('./auth-mock').signedIn(p); await p.goto(APP_URL, { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
  await p.click('button[aria-controls=import-panel]'); await p.waitForTimeout(150); 
  await p.locator('button[aria-pressed]', { hasText: uploadSectorLabel }).first().click();
  if (activityLabel) await p.locator('button[aria-pressed]', { hasText: activityLabel }).first().click();
  await p.setInputFiles('input[type=file]', { name: 'x.csv', mimeType: 'text/csv', buffer: Buffer.from('a,b\n1,2\n') });
  await p.waitForTimeout(3000);
  const t = await p.evaluate(() => document.body.innerText);
  const q = new URL(uploadUrl).searchParams;
  console.log(`\n== ${name}\n   sent sector=${q.get('sector')} business_type=${q.get('business_type')} | errors:${errors.length}`);
  for (const [label, text, want] of expect) console.log(`   ${t.includes(text) === want ? 'PASS' : 'FAIL'} ${label}`);
  await p.screenshot({ path: `b25-${name}.png`, fullPage: false });
  await b.close();
}
(async () => {
  await run('second-sector', 'Retail', 'Supermarket', 200, [shop], [['retail alert visible after upload', 'SHOP ALERT', true]]);
  await run('other-activity', 'Health', 'Clinic', 200, [hosp], [['hospital alert visible after upload', 'HOSPITAL ALERT', true], ['pharmacy alert hidden (view now scoped to hospital)', 'PHARMA ALERT', false]]);
  await run('mismatch-422', 'Health', 'Pharmacy', 422, [], [['error names missing column', 'Missing columns: medicine_name', true], ['error suggests hospital', 'This file looks like data for: Health · ', true]]);
})();
