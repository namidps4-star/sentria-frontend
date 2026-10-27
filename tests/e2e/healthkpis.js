// The four Health cards on the dashboard count what their labels say: critical stockouts are critical stock,
// low stock is stock under its minimum (not expiry, not a branch swap), medicines affected counts each medicine once
// (a branch swap is the medicine, not the pair of branches), and cold chain counts cold chain breaks at any severity.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const json = (r, body) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
const dayAgo = d => new Date(Date.now() - d * 86400000).toISOString();
const row = (id, equipment, key, severity, d, extra = {}) => ({ id, equipment, sector: 'health', business_type: 'pharmacie', severity, date: dayAgo(d), alert_key: key, message: 'MSG ' + equipment, risk_score: 60, params: [], ...extra });
const ALERTS = [
  row('1', 'Doliprane', 'health.stock.critical_low', 'CRITICAL', 0),
  row('2', 'Amoxicilline', 'health.stock.low', 'WARNING', 1),
  row('3', 'Sirop', 'health.stock.low', 'WARNING', 2),
  row('4', 'Insuline', 'health.cold_chain.broken', 'CRITICAL', 1),
  row('5', 'Vaccin', 'health.cold_chain.broken', 'CRITICAL', 3),
  row('6', 'Aspirine', 'health.expiry.warning', 'WARNING', 2),
  row('7', 'Amoxicilline · Nairobi -> Mombasa', 'health.branch.swap', 'WARNING', 0, { params: [['product', 'Amoxicilline'], ['qty', 20], ['from_site', 'Nairobi'], ['to_site', 'Mombasa'], ['days', 20], ['expiry', '2026-11-16'], ['value', 7600], ['currency', 'KES']] }),
];
const value = async (p, label) => (await p.locator('.grid').filter({ hasText: label }).first().locator('p').first().innerText().catch(() => '?')).trim();

(async () => {
  const b = await chromium.launch(LAUNCH);
  const p = await b.newPage({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
  p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
  await p.route(/onrender\.com\//, r => { const path = new URL(r.request().url()).pathname; if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    return json(r, path === '/alerts' ? ALERTS : path === '/recommendations' ? { recommendations: [] } : { recommendations: [], assignments: [], contractors: [] }); });
  await p.addInitScript(() => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); Object.entries({ sentria_onboarded: 'true', sentria_language: 'en', sentria_company_name: 'Atlantis', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', sentria_guide_done: '1', sentria_theme: 'light' }).forEach(([k, v]) => localStorage.setItem(k, v)); } });
  await signedIn(p, 'u-me', 'boss@sentria.app', { plan: 'entreprise', isAdmin: false });
  await p.goto(APP_URL); await p.waitForTimeout(2200);

  console.log('== the four Health cards');
  const kpi = async label => { const el = p.locator('[data-tour="kpis"] > div').filter({ hasText: label }).first(); return (await el.innerText()).split('\n').map(s => s.trim()).filter(Boolean); };
  const crit = await kpi('Critical stockouts');
  pass(crit.at(-1) === '1', `Critical stockouts is 1 (Doliprane), not every critical alert: got ${JSON.stringify(crit)}`);
  const low = await kpi('Low stock');
  pass(low.at(-1) === '2', `Low stock is 2 (Amoxicilline, Sirop), not the expiry or the swap: got ${JSON.stringify(low)}`);
  const meds = await kpi('Medicines affected');
  pass(meds.at(-1) === '6', `Medicines affected is 6 distinct medicines (the swap counts its product once): got ${JSON.stringify(meds)}`);
  const cold = await kpi('Cold chain alerts');
  pass(cold.at(-1) === '2', `Cold chain alerts is 2: got ${JSON.stringify(cold)}`);
  pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
  await p.screenshot({ path: '/tmp/claude-0/-home-user/2667e33c-a5f2-592c-9674-20903058f533/scratchpad/shots/healthkpis-light.png' });

  console.log('== Robo names the four cards for a pharmacy');
  await p.locator('[data-support-open]').locator('visible=true').first().click(); await p.waitForTimeout(500);
  await p.locator('[data-tour-open]').click(); await p.waitForTimeout(900);
  await p.getByTestId('guide-part').nth(1).click(); await p.waitForTimeout(900);
  let found = false;
  for (let i = 0; i < 12 && !found; i++) {
    const card = p.getByTestId('guide-card');
    const text = (await card.count()) ? await card.innerText() : '';
    if (/critical stockouts/i.test(text) && /branch swaps are not counted as stock/i.test(text)) found = true;
    if (!found) { const nb = p.getByRole('button', { name: /^(Next|Suivant|Done|Terminer)$/ }); if (!(await nb.count())) break; await nb.click(); await p.waitForTimeout(600); }
  }
  pass(found, 'the KPI step names what each card counts, and says expiry and swaps are not stock');

  await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
  process.exit(fails ? 1 : 0);
})();
