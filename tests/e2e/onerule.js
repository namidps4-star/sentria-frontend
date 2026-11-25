// One alert = one asset + one check, on every screen. Each scenario uploads a
// file on the dashboard. The backend saves one row per fire, so a file with
// repeated fires arrives as repeated rows. The dashboard, the Report and the
// Profile must still show the same count.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');

let fails = 0;
const pass = (ok, label) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${label}`); };

const MIN = 60e3;
const DAY = 24 * 60 * MIN;
const now = Date.now();
const alertRow = (id, equipment, severity, alertKey, msAgo, message) => ({
  id, equipment, sector: 'health', business_type: 'pharmacie', severity, alert_key: alertKey,
  risk_score: severity === 'CRITICAL' ? 90 : 40, message, date: new Date(now - msAgo).toISOString(),
});
const doli = (id, msAgo) => alertRow(id, 'Doliprane', 'CRITICAL', 'health.stock.critical_low', msAgo, 'Stock at 3 units : order now');
const amox = (id, msAgo) => alertRow(id, 'Amoxicillin', 'WARNING', 'health.stock.low', msAgo, 'Stock at 40 units : reorder soon');

const YESTERDAY = [doli('y1', DAY + 60 * MIN), amox('y2', DAY + 60 * MIN)];
const FIRST = [doli('a1', 3 * MIN), doli('a2', 1 * MIN), amox('a3', 2 * MIN)];
const AGAIN = [...FIRST, doli('a4', 30e3), amox('a5', 20e3)];
const TODAY = [doli('t1', 1 * MIN), amox('t2', 1 * MIN)];

const LS = {
  sentria_language: 'en', sentria_onboarded: 'true', sentria_company_name: 'Clinique A',
  sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie',
};

const SAME_NUMBERS = ({ donut, report, profile }) => {
  pass(donut === '2', `dashboard total is 2 alerts, not 3 rows (it reads "${donut}")`);
  pass(/2 alerts in the period: 1 critical, 1 to watch/.test(report), 'Report: 2 alerts, 1 critical, 1 to watch');
  pass(/2 assets monitored, 1 critical signal, 2 over the last 7 days/.test(profile), 'Profile: 2 assets, 1 critical signal, 2 over 7 days');
};

async function upload(name, before, after, checks) {
  const b = await chromium.launch(LAUNCH);
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 }, locale: 'en-US' });
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));

  let uploaded = false;
  await p.route(/onrender\.com\//, r => {
    const u = new URL(r.request().url());
    let body = { recommendations: [], assignments: [], contractors: [] };
    if (u.pathname === '/alerts') body = uploaded ? after : before;
    if (u.pathname === '/upload') { uploaded = true; body = { success: true, message: 'Processed rows, alerts fired.' }; }
    if (u.pathname === '/reports/weekly') body = { alerts: 0, critical: 0, warning: 0, previous_alerts: 0, delta: 0, trend: 'flat', resolved: 0, top_offender: null };
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); Object.entries(ls).forEach(([k, v]) => localStorage.setItem(k, v)); } }, LS);
  await signedIn(p, 'u', 'a@b.c', { plan: 'business' });
  await p.goto(APP_URL);
  await p.waitForTimeout(1800);

  await p.click('button[aria-controls=import-panel]');
  await p.waitForTimeout(150);
  await p.locator('button[aria-pressed]', { hasText: 'Health' }).first().click();
  await p.locator('button[aria-pressed]', { hasText: 'Pharmacy' }).first().click();
  await p.setInputFiles('input[type=file]', { name: 'stock.csv', mimeType: 'text/csv', buffer: Buffer.from('medicine_name,stock_qty\nDoliprane,3\n') });
  await p.waitForTimeout(3000);
  await p.getByRole('dialog', { name: 'Data import' }).getByRole('button', { name: /See the alerts|Close/ }).first().click();
  await p.waitForTimeout(600);

  const donut = (await p.locator('[data-donut-center] span').first().innerText()).trim();
  await p.locator('aside nav button', { hasText: 'Report' }).click();
  await p.waitForTimeout(1500);
  const report = (await p.getByTestId('briefing').innerText()).replace(/\s+/g, ' ');
  await p.locator('aside nav button', { hasText: 'Profile' }).click();
  await p.waitForTimeout(1200);
  const profile = (await p.locator('body').innerText()).replace(/\s+/g, ' ');

  console.log(`== ${name}`);
  checks({ donut, report, profile });
  pass(errors.length === 0, 'no page errors ' + errors.join('|'));
  await p.screenshot({ path: `onerule-${name.replace(/\W+/g, '-')}.png` });
  await b.close();
}

(async () => {
  await upload('one upload, repeated rows', [], FIRST, r => {
    SAME_NUMBERS(r);
    pass(/Doliprane needs you now/.test(r.report), 'Report: one critical asset, so the singular headline');
    pass(!/What keeps coming back/.test(r.report), 'Report: both alerts fired on one day, so nothing keeps coming back');
  });

  await upload('same file again, same day', FIRST, AGAIN, r => {
    SAME_NUMBERS(r);
    pass(!/What keeps coming back/.test(r.report), 'Report: still one day, so nothing keeps coming back');
  });

  await upload('same file next day', YESTERDAY, [...YESTERDAY, ...TODAY], r => {
    SAME_NUMBERS(r);
    pass(/Doliprane \(2 days\) · Amoxicillin \(2 days\)/.test(r.report), 'Report: both keep coming back, on 2 days each');
  });

  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
