// F-REPORT: the Report page shows this week in the numbers the Monday email sends (GET /reports/weekly),
// and one saved switch (Report card or Settings) turns the email on for the account.
const { LAUNCH, APP_URL } = require('./env');
const { chromium } = require('playwright');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const now = Date.now();
const alerts = [0, 1, 2].map(i => ({ id: i, equipment: i < 2 ? 'CRANE-02' : 'QUAI-1', sector: 'logistics', business_type: 'port-conteneurs', severity: i === 0 ? 'CRITICAL' : 'WARNING', date: new Date(now - i * 36e5).toISOString(), alert_key: 'logistics.cycles.critical', message: 'm' }));
const WEEK = { alerts: 3, critical: 1, warning: 2, previous_alerts: 1, delta: 2, trend: 'up', resolved: 2, top_offender: { equipment: 'CRANE-02', count: 2 }, critical_assets: ['CRANE-02'] };
const LS = { sentria_language: 'en', sentria_onboarded: 'true', sentria_company_name: 'Port A', sentria_sector: 'logistics', sentria_sectors: '["logistics"]', sentria_business_type: 'port-conteneurs', sentria_ops_types: '["port"]', sentria_ops_type: 'port' };

(async () => {
  const b = await chromium.launch(LAUNCH);
  const go = async (p, label) => { if ((p.viewportSize() || {}).width < 1024) { await p.getByRole('button', { name: /menu/i }).first().click(); await p.waitForTimeout(300); } await p.locator('aside nav button', { hasText: label }).click(); await p.waitForTimeout(1300); };
  const open = async ({ week, vw = 1440, ls = {} } = {}) => {
    const p = await b.newPage({ viewport: { width: vw, height: 900 }, locale: 'en-US' }); p._errs = []; p.on('pageerror', e => p._errs.push(e.message));
    p._weekCalls = 0;
    await p.route(/onrender\.com\//, r => { const u = new URL(r.request().url());
      if (u.pathname === '/reports/weekly') { p._weekCalls++; return week === 'down' ? r.fulfill({ status: 500, body: 'x' }) : r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(week) }); }
      r.fulfill({ status: 200, contentType: 'application/json', body: u.pathname === '/alerts' ? JSON.stringify(alerts) : '{"recommendations":[],"assignments":[],"contractors":[]}' }); });
    await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); Object.entries(ls).forEach(([k, v]) => localStorage.setItem(k, v)); } }, { ...LS, ...ls });
    await signedIn(p, 'u', 'a@b.c', { plan: 'business' }); await p.goto(APP_URL); await p.waitForTimeout(1800);
    return p; };
  const stored = p => p.evaluate(() => localStorage.getItem('sentria_weekly_report'));

  console.log('== the card on the Report page');
  let p = await open({ week: { ...WEEK, email: { enabled: false, configured: false } } });
  await go(p, 'Report');
  const card = p.getByTestId('week-card');
  pass(await card.isVisible() && p._weekCalls === 1, 'a "This week" card, from GET /reports/weekly');
  const t = (await card.innerText()).replace(/\s+/g, ' ');
  pass(/New critical 1 /.test(t) && /Priorities handled 2 /.test(t) && /Alerts this week 3 \+2 vs the week before/.test(t) && /Keep an eye on CRANE-02 2 alerts this week/.test(t), 'the four numbers the email sends: ' + t.slice(0, 160));
  const sw = card.getByRole('switch', { name: 'Monday email' });
  pass(await sw.getAttribute('aria-checked') === 'false' && /Get this summary by email every Monday/.test(t), 'email off by default, says how to get it');
  const box = await card.boundingBox(), body = await p.locator('main h2', { hasText: /This week/ }).boundingBox();
  pass(box.y < 400, 'the card sits at the top of the report');
  await sw.click(); await p.waitForTimeout(300);
  pass(await sw.getAttribute('aria-checked') === 'true' && await stored(p) === 'on', 'turning it on saves "on" with the account');
  pass(/On\. Sending starts as soon as email is set up/.test(await card.innerText()), 'honest while email is not set up on the server');
  pass(p._errs.length === 0, 'no page errors ' + p._errs.join('|'));
  await p.screenshot({ path: 'weekrep-report.png' });

  console.log('== Settings shows the same switch');
  await go(p, 'Settings');
  const set = p.getByRole('switch', { name: 'Weekly report' });
  pass(await set.getAttribute('aria-checked') === 'true', 'Settings > Weekly report is on (same saved value)');
  await set.click(); await p.waitForTimeout(300);
  pass(await stored(p) === 'off', 'turning it off in Settings saves "off"');
  await go(p, 'Report');
  pass(await p.getByTestId('week-card').getByRole('switch').getAttribute('aria-checked') === 'false', 'and the Report card follows');
  await p.waitForTimeout(2500);
  const saved = await p.evaluate(() => Object.keys(localStorage));
  pass(saved.includes('sentria_weekly_report'), 'kept in localStorage for the account sync');
  await p.close();

  console.log('== email set up on the server');
  p = await open({ week: { ...WEEK, email: { enabled: true, configured: true } }, ls: { sentria_weekly_report: 'on' } });
  await go(p, 'Report');
  pass(/Emailed to you every Monday/.test(await p.getByTestId('week-card').innerText()), 'on + configured: "Emailed to you every Monday"');
  await p.close();

  console.log('== quiet week, and an API that fails');
  p = await open({ week: { ...WEEK, alerts: 0, critical: 0, warning: 0, previous_alerts: 0, delta: 0, trend: 'flat', resolved: 0, top_offender: null, email: { enabled: false, configured: false } } });
  await go(p, 'Report');
  const q = (await p.getByTestId('week-card').innerText()).replace(/\s+/g, ' ');
  pass(/New critical 0 /.test(q) && /same as the week before/.test(q) && /Keep an eye on — no repeat asset/.test(q), 'zeros read as zeros: ' + q.slice(0, 140));
  await p.close();
  p = await open({ week: 'down' });
  await go(p, 'Report');
  pass(await p.getByTestId('week-card').count() === 0 && /Alerts|alert/i.test(await p.locator('main').innerText()), 'API error: no card, the report still shows');
  pass(p._errs.length === 0, 'no page errors ' + p._errs.join('|'));
  await p.close();

  console.log('== phone');
  p = await open({ week: { ...WEEK, email: { enabled: false, configured: false } }, vw: 390 });
  await go(p, 'Report');
  pass(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll at 390 px');
  await p.getByTestId('week-card').screenshot({ path: 'weekrep-390.png' });
  await p.close();

  await b.close(); console.log(`\n${fails ? fails + ' failure(s)' : 'ALL OK'}`); process.exit(fails ? 1 : 0);
})();
