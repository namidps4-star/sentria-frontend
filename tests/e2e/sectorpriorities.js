// The priorities of every sector as the capsule widget: the all-sectors view shows one labelled widget per
// sector (energy, agriculture, ...) next to logistics and industry; each pill counts the sector's own alerts;
// pressing one opens that sector; an account with no alert of a sector shows no figure for it.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const now = new Date().toISOString();
const A = (id, sector, eq, key, sev, message) => ({ id, equipment: eq, sector, business_type: null, severity: sev, date: now, alert_key: key, message, risk_score: 60 });
const ROWS = [
  A(1, 'energy', 'Generator 1', 'energy.fuel.critical', 'CRITICAL', 'Fuel level critical'),
  A(2, 'energy', 'Generator 2', 'energy.coolant.overheat', 'WARNING', 'Coolant temperature high'),
  A(3, 'agriculture', 'Cold room 1', 'agri.storage.humidity', 'WARNING', 'Storage humidity high'),
];
const LS = { sentria_language: 'en', sentria_onboarded: 'true', sentria_company_name: 'Acme', sentria_theme: 'light', sentria_sector: 'energy', sentria_sectors: '["energy","agriculture"]', sentria_equipment: '["generators","fuel","temperature","storage"]' };

(async () => {
  const b = await chromium.launch(LAUNCH);
  const open = async (rows, vw = 1440, theme = 'light') => {
    const ctx = await b.newContext({ viewport: { width: vw, height: 900 }, locale: 'en-US' });
    const p = await ctx.newPage(); p._errs = []; p.on('pageerror', e => p._errs.push(e.message));
    await p.route(/\/alerts(\?|$)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) }));
    await p.route(/\/(recommendations|assignments|contractors)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"recommendations":[],"assignments":[],"contractors":[]}' }));
    await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); Object.entries(ls).forEach(([k, v]) => localStorage.setItem(k, v)); } }, { ...LS, sentria_theme: theme });
    await signedIn(p); await p.goto(APP_URL, { waitUntil: 'networkidle' }); await p.waitForTimeout(2200);
    return { p, ctx };
  };
  const allView = async p => { const b = p.getByRole('button', { name: /^All/ }).first(); if (await b.count()) { await b.click(); await p.waitForTimeout(900); } };
  const labels = async loc => loc.locator('button').evaluateAll(els => els.map(e => e.getAttribute('aria-label') || ''));

  console.log('== the all-sectors view');
  { const { p, ctx } = await open(ROWS);
    await allView(p);
    const tracks = p.getByTestId('priority-track');
    pass(await tracks.count() === 2, 'one capsule per sector with priorities (energy, agriculture): ' + await tracks.count());
    const main = await p.locator('main').innerText();
    pass(/Energy\s*·\s*priorities/i.test(main) && /Agriculture\s*·\s*priorities/i.test(main), 'each is labelled with its sector');
    const energy = await labels(tracks.nth(0));
    pass(energy.length === 3 && /^Fuel, 1, 1 critical/.test(energy[0]) && energy.some(l => /Temperature, 1, to watch/.test(l)), 'energy pills count their own alerts: ' + energy.join(' | ').slice(0, 120));
    await p.screenshot({ path: 'sectorprio-all-light.png' });
    await tracks.nth(1).locator('button').first().click(); await p.waitForTimeout(900);
    pass(await p.evaluate(() => localStorage.getItem('sentria_sector')) === 'agriculture', 'pressing a pill opens that sector');
    pass(p._errs.length === 0, 'no page errors ' + p._errs.join('|'));
    await ctx.close(); }

  console.log('== no alert of a sector: no figures');
  { const { p, ctx } = await open(ROWS.filter(r => r.sector === 'energy'));
    await allView(p);
    const tracks = p.getByTestId('priority-track');
    const agri = (await labels(tracks.nth(1))).join(' | ');
    pass(!/all clear|critical|to watch/.test(agri), 'agriculture has no alert yet: no "all clear", no number: ' + agri.slice(0, 80));
    await ctx.close(); }

  console.log('== dark and a phone');
  { const { p, ctx } = await open(ROWS, 1440, 'dark'); await allView(p); await p.screenshot({ path: 'sectorprio-all-dark.png' }); await ctx.close(); }
  { const { p, ctx } = await open(ROWS, 390); await allView(p);
    pass(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'no sideways scroll at 390 px');
    await p.screenshot({ path: 'sectorprio-all-390.png' }); await ctx.close(); }

  await b.close();
  console.log(fails ? `\n${fails} failed` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
