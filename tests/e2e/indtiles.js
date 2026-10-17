// Industry overview: a header line, and the priorities as the dark capsule widget (the same one Health has). Each pill counts what its screen shows. No numbers before any data.
const { LAUNCH, APP_URL } = require('./env');
const { chromium } = require('playwright'); const { signedIn } = require('./auth-mock');
let fails = 0; const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const now = new Date().toISOString();
const A = (id, eq, sev, message) => ({ id, equipment: eq, sector: 'industry', business_type: 'usine-production', severity: sev, date: now, alert_key: 'industry.generic', message });
const data = [A(1, 'Presse P1', 'CRITICAL', 'Machine failure risk'), A(2, 'Moteur M2', 'WARNING', 'Motor vibration high'), A(3, 'Moteur M3', 'CRITICAL', 'Motor overheat'), A(4, 'Ligne L4', 'WARNING', 'Pressure drop on line')];
const LS = { sentria_language: 'en', sentria_onboarded: 'true', sentria_company_name: 'Usine Nord', sentria_sector: 'industry', sentria_sectors: '["industry"]', sentria_business_type: 'usine-production', sentria_departments: '{"industry":["usine-production"]}', sentria_equipment: '["machines","motors","production","maintenance-production-link"]' };

(async () => { const b = await chromium.launch(LAUNCH);
  const open = async (rows, vw = 1440) => {
    const p = await b.newPage({ viewport: { width: vw, height: 900 }, locale: 'en-US' }); p._errs = []; p.on('pageerror', e => p._errs.push(e.message));
    await p.route(/onrender\.com\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: /\/alerts/.test(r.request().url()) ? JSON.stringify(rows) : '{"recommendations":[],"assignments":[],"contractors":[]}' }));
    await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); Object.entries(ls).forEach(([k, v]) => localStorage.setItem(k, v)); } }, LS);
    await signedIn(p, 'u', 'a@b.c', { plan: 'business' }); await p.goto(APP_URL); await p.waitForTimeout(2000);
    const ind = p.getByRole('button', { name: /^Industry/ }).first(); if (await p.getByTestId('priority-track').count() === 0 && await ind.count()) { await ind.click(); await p.waitForTimeout(800); }
    return p; };

  console.log('== with data');
  let p = await open(data);
  const track = p.getByTestId('priority-track'); const tiles = track.locator('button');
  pass(await track.count() === 1 && await tiles.count() === 4, 'the capsule widget with four pills (a factory\'s priorities)');
  pass(await p.getByTestId('priority-bento').count() === 0, 'the old tiles are gone');
  const lab = async n => (await tiles.nth(n).getAttribute('aria-label')) || '';
  const want = [/, 1, 1 critical/, /, 2, 1 critical/, /, 0, all clear/, /, 0, all clear/];
  for (let i = 0; i < 4; i++) pass(want[i].test(await lab(i)), `pill ${i + 1}: ${(await lab(i)).slice(0, 70)}`);
  pass(/4 signals · 2 critical/.test(await p.locator('main').innerText()), 'header chip: 4 signals · 2 critical');
  pass(await p.locator('main .bg-sidebar h2', { hasText: 'overview of your production' }).count() === 0, 'no big black banner');
  // The tile and its screen count the same alerts.
  await tiles.nth(1).click(); await p.waitForTimeout(800);
  const t = await p.locator('main').innerText();
  pass(t.includes('Moteur M2') && t.includes('Moteur M3') && !t.includes('Presse P1'), 'Motors screen lists the same 2 alerts the tile counted');
  pass(p._errs.length === 0, 'no page errors ' + p._errs.join('|'));
  await p.goBack().catch(() => {}); await p.close();
  p = await open(data); await p.screenshot({ path: 'ind-tiles.png' }); await p.close();

  console.log('== no data yet');
  p = await open([]);
  const t0 = (await p.getByTestId('priority-track').locator('button').evaluateAll(els => els.map(e => e.getAttribute('aria-label')))).join(' | ');
  pass(!/all clear|critical|to watch/.test(t0), 'no numbers before any data (an empty account is not "all clear"): ' + t0.slice(0, 90));
  pass((await p.getByTestId('priority-track').locator('button').count()) === 4, 'the four pills are still there');
  pass(p._errs.length === 0, 'no page errors ' + p._errs.join('|'));
  await p.close();

  await b.close(); console.log(`\n${fails ? fails + ' failure(s)' : 'ALL OK'}`); process.exit(fails ? 1 : 0); })();
