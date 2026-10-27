// The sidebar's data status is read again when an upload finishes. Before, it kept the stamp it read on mount:
// a file uploaded this morning still showed "Data is 10 days old" until a reload.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const DAY = 86400000;
const tenDays = new Date(Date.now() - 10 * DAY).toISOString();
const today = new Date().toISOString();
const LS = { sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', sentria_departments: '{"health":["pharmacie"]}', sentria_company_name: 'Atlantis' };

(async () => {
  const browser = await chromium.launch(LAUNCH);
  for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    let uploaded = false;
    await p.route(/onrender\.com\//, r => {
      const req = r.request(); const path = new URL(req.url()).pathname;
      const json = b => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(b) });
      if (req.method() === 'OPTIONS') return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      if (path === '/freshness') return json({ freshness: [{ sector: 'health', scope: 'pharmacie', last_upload_at: uploaded ? today : tenDays, age_days: uploaded ? 0 : 10, stale: !uploaded, rows_processed: 3, alerts_fired: 0 }], persisted: true, stale_after_days: 7 });
      if (path === '/upload') { uploaded = true; return json({ success: true, message: 'ok', rows_processed: 3, alerts_fired: 0, saves_failed: 0 }); }
      if (path === '/alerts') return json([]);
      return json({ recommendations: [], assignments: [], contractors: [] });
    });
    await p.addInitScript((l) => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); Object.entries({ sentria_onboarded: 'true', sentria_language: 'en', sentria_theme: l.theme, ...l.ls }).forEach(([k, v]) => localStorage.setItem(k, v)); } }, { theme, ls: LS });
    await signedIn(p, 'u', 'a@b.c', { plan: 'entreprise', isAdmin: true });
    await p.goto(APP_URL); await p.waitForTimeout(2200);

    const status = () => p.locator('aside').innerText();
    console.log(`== ${theme}`);
    pass(/10 days old/.test(await status()), 'before the upload the sidebar says the data is 10 days old');

    await p.click('button[aria-controls=import-panel]'); await p.waitForTimeout(500);
    await p.locator('#import-panel input[type=file]').setInputFiles({ name: 'stock.csv', mimeType: 'text/csv', buffer: Buffer.from('medicine_name,stock_qty,min_stock,sales_last_30_days\nAmox,10,5,30\n') });
    await p.waitForTimeout(2500);
    pass(uploaded, 'the file went to /upload');

    const after = await status();
    pass(!/10 days old/.test(after) && !/Data is \d+ days old/.test(after), 'after the upload the sidebar no longer says 10 days old, with no reload');
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await p.screenshot({ path: `freshnessupload-${theme}.png` });
    await ctx.close();
  }
  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
  process.exit(fails ? 1 : 0);
})();
