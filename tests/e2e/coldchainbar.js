// A cold-chain operator is not offered the port tab in the department bar.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');

let fails = 0;
const pass = (ok, label) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${label}`); };

const MIN = 60e3;
const now = Date.now();
const row = (id, equipment, severity, alertKey, msAgo, message, risk) => ({
  id, equipment, sector: 'logistics', business_type: 'chaine-froid', severity, alert_key: alertKey,
  risk_score: risk, message, date: new Date(now - msAgo).toISOString(),
});
const ROWS = [
  row('f1', 'Reefer-7', 'CRITICAL', 'logistics.temp.high', 5 * MIN, 'Reefer at 9 C : check the unit', 80),
  row('f2', 'Reefer-3', 'WARNING', 'logistics.temp.high', 30 * MIN, 'Reefer at 6 C : watch the unit', 40),
];
const LS = {
  sentria_language: 'en', sentria_onboarded: 'true', sentria_company_name: 'Froid Express',
  sentria_sector: 'logistics', sentria_sectors: '["logistics"]',
  sentria_business_type: 'chaine-froid', sentria_ops_types: '["froid"]', sentria_ops_type: 'froid',
};

(async () => {
  const b = await chromium.launch(LAUNCH);
  const open = async ({ vw = 1440, theme = 'light' } = {}) => {
    const p = await b.newPage({ viewport: { width: vw, height: 900 }, locale: 'en-US' });
    p._errs = [];
    p.on('pageerror', e => p._errs.push(e.message));
    await p.route(/onrender\.com\//, r => {
      const u = new URL(r.request().url());
      const body = u.pathname === '/alerts' ? ROWS : { recommendations: [], assignments: [], contractors: [] };
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); Object.entries(ls).forEach(([k, v]) => localStorage.setItem(k, v)); } }, { ...LS, sentria_theme: theme });
    await signedIn(p, 'u', 'a@b.c', { plan: 'business' });
    await p.goto(APP_URL);
    await p.waitForTimeout(2000);
    return p;
  };

  console.log('== cold-chain operator: the department bar');
  let p = await open();
  pass(await p.locator('button:visible', { hasText: 'Port & containers' }).count() === 0, 'no port tab is offered');
  pass(await p.locator('button:visible', { hasText: 'Transport & distribution' }).count() > 0, 'the other chains are still offered');
  pass(p._errs.length === 0, 'no page errors ' + p._errs.join('|'));
  await p.screenshot({ path: 'coldchainbar-light.png' });
  await p.close();

  console.log('== dark, and 390 px');
  p = await open({ theme: 'dark' });
  await p.screenshot({ path: 'coldchainbar-dark.png' });
  await p.close();
  p = await open({ vw: 390 });
  pass(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no sideways scroll at 390 px');
  await p.screenshot({ path: 'coldchainbar-390.png' });
  await p.close();

  await b.close();
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
