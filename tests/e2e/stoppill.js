// The "Stop now" pill is gone from the industry and logistics KPI tiles.
// Checked in light, dark and 390 px, with alerts on the screen.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const now = new Date().toISOString();
const crit = (id, eq, sector, bt) => ({ id, equipment: eq, sector, business_type: bt, severity: 'CRITICAL', date: now, alert_key: `${sector}.generic`, message: 'Equipment failure risk' });
const SETS = {
  industry: { sector: 'industry', bt: 'usine-production', rows: [crit(1, 'Presse P1', 'industry', 'usine-production'), crit(2, 'Moteur M3', 'industry', 'usine-production')] },
  logistics: { sector: 'logistics', bt: 'entrepot', rows: [crit(1, 'Chariot C1', 'logistics', 'entrepot'), crit(2, 'Quai Q2', 'logistics', 'entrepot')] },
};

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const run = async (sector, theme, width, shot) => {
    const cfg = SETS[sector];
    const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 }, locale: 'en-US' });
    const p = await ctx.newPage(); p._errs = []; p.on('pageerror', e => p._errs.push(e.message));
    await p.route(/onrender\.com\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: /\/alerts/.test(r.request().url()) ? JSON.stringify(cfg.rows) : '{"recommendations":[],"assignments":[],"contractors":[]}' }));
    const LS = { sentria_language: 'en', sentria_theme: theme, sentria_onboarded: 'true', sentria_company_name: 'Test Co', sentria_sector: cfg.sector, sentria_sectors: JSON.stringify([cfg.sector]), sentria_business_type: cfg.bt, sentria_departments: JSON.stringify({ [cfg.sector]: [cfg.bt] }) };
    await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); Object.entries(ls).forEach(([k, v]) => localStorage.setItem(k, v)); } }, LS);
    await signedIn(p, 'u', 'a@b.c', { plan: 'business' });
    await p.goto(APP_URL); await p.waitForTimeout(2500);
    const text = await p.locator('main').innerText();
    pass(/Your operations|Your priorities|Live|Critical|Act now/.test(text), `${sector} ${theme} ${width}px: the dashboard is on screen, not sign-in`);
    pass(!/Stop now|Arrêt immédiat/.test(text), `${sector} ${theme} ${width}px: no "Stop now" pill`);
    pass(p._errs.length === 0, `${sector} ${theme} ${width}px: no page errors ${p._errs.join('|')}`);
    await p.screenshot({ path: shot, fullPage: false });
    await ctx.close();
  };

  console.log('== industry');
  await run('industry', 'light', 1280, 'stoppill-industry-light.png');
  await run('industry', 'dark', 1280, 'stoppill-industry-dark.png');
  await run('industry', 'light', 390, 'stoppill-industry-390.png');
  console.log('== logistics');
  await run('logistics', 'light', 1280, 'stoppill-logistics-light.png');
  await run('logistics', 'dark', 1280, 'stoppill-logistics-dark.png');
  await run('logistics', 'light', 390, 'stoppill-logistics-390.png');

  await browser.close();
  console.log(`\n${fails ? fails + ' failure(s)' : 'ALL OK'}`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
