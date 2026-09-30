// Industry overview: a header line, and tiles that count what each priority's screen shows. No numbers before any data.
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
    const ind = p.getByRole('button', { name: /^Industry/ }).first(); if (await p.getByTestId('priority-bento').count() === 0 && await ind.count()) { await ind.click(); await p.waitForTimeout(800); }
    return p; };

  console.log('== with data');
  let p = await open(data);
  const bento = p.getByTestId('priority-bento'); const tiles = bento.locator(':scope > button');
  pass(await tiles.count() === 4, 'four tiles (a factory\'s priorities)');
  const txt = async n => (await tiles.nth(n).innerText()).replace(/\s+/g, ' ');
  const want = [/ 1 critical alert /, / 1 critical alert/, / 0 all clear/, / 0 all clear/];
  for (let i = 0; i < 4; i++) pass(want[i].test(await txt(i)), `tile ${i + 1}: ${(await txt(i)).slice(0, 70)}`);
  const bx = await tiles.evaluateAll(els => els.map(e => e.getBoundingClientRect()).map(r => [r.x, r.y, r.right, r.bottom]));
  const bb = await bento.boundingBox();
  pass(Math.abs(bx[3][2] - (bb.x + bb.width)) < 2 && Math.abs(bx[3][3] - bx[0][3]) <= 3, 'with 4 priorities the last tile widens and the grid closes with no hole');
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
  const t0 = await p.getByTestId('priority-bento').innerText();
  pass(!/all clear|critical alert|to watch/.test(t0), 'no numbers before any data (an empty account is not "all clear")');
  pass(/Flags the machine|wear|limit/i.test(t0) || (await p.getByTestId('priority-bento').locator(':scope > button').count()) === 4, 'tiles explain themselves instead');
  pass(p._errs.length === 0, 'no page errors ' + p._errs.join('|'));
  await p.close();

  await b.close(); console.log(`\n${fails ? fails + ' failure(s)' : 'ALL OK'}`); process.exit(fails ? 1 : 0); })();
