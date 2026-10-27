// Robo's data status talks about the department on screen only. A clinic's old data must not make the pharmacy
// dashboard say "data is 10 days old", and the status follows when the person switches department.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const DAY = 86400000;
const today = new Date().toISOString();
const tenDays = new Date(Date.now() - 10 * DAY).toISOString();
const LS = { sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', sentria_departments: '{"health":["pharmacie","clinique-hopital"]}', sentria_company_name: 'Atlantis' };

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
  const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
  await p.route(/onrender\.com\//, r => {
    const path = new URL(r.request().url()).pathname;
    const json = b => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(b) });
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (path === '/freshness') return json({ freshness: [
      { sector: 'health', scope: 'pharmacie', last_upload_at: today, age_days: 0, stale: false, rows_processed: 3, alerts_fired: 0 },
      { sector: 'health', scope: 'clinique-hopital', last_upload_at: tenDays, age_days: 10, stale: true, rows_processed: 3, alerts_fired: 0 },
    ], persisted: true, stale_after_days: 7 });
    if (path === '/alerts') return json([]);
    return json({ recommendations: [], assignments: [], contractors: [] });
  });
  await p.addInitScript((ls) => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); Object.entries({ sentria_onboarded: 'true', sentria_language: 'en', sentria_theme: 'light', ...ls }).forEach(([k, v]) => localStorage.setItem(k, v)); } }, LS);
  await signedIn(p, 'u', 'a@b.c', { plan: 'entreprise', isAdmin: true });
  await p.goto(APP_URL); await p.waitForTimeout(2200);

  const status = async () => (await p.locator('aside').innerText()).replace(/\s+/g, ' ');
  console.log('== the pharmacy dashboard');
  pass(!/10 days old/.test(await status()), 'the clinic\'s 10-day-old data is not mentioned on the pharmacy dashboard');
  pass(/updated/i.test(await status()) || /watching/i.test(await status()), 'the pharmacy\'s own stamp (today) is what the status reads');

  console.log('== switching to the clinic');
  const tab = p.locator('button', { hasText: 'Clinic / Hospital' }).locator('visible=true').first();
  await tab.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  pass(await tab.count() > 0, 'the clinic tab is there');
  await tab.click(); await p.waitForTimeout(1500);
  pass(/10 days old/.test(await status()), 'on the clinic it says its data is 10 days old');

  pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
  process.exit(fails ? 1 : 0);
})();
