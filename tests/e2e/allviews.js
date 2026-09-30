// Every page: the page itself never scrolls; the box next to the sidebar never moves.
const { LAUNCH, APP_URL } = require('./env');
const { chromium } = require('playwright');
const now = new Date().toISOString();
const A = (id, eq, key, sev='CRITICAL') => ({ id, equipment: eq, sector: 'health', business_type: 'pharmacie', severity: sev, date: now, alert_key: key, message: `MSG ${eq}`, risk_score: 70 });
(async () => {
  const browser = await chromium.launch(LAUNCH);
  let fails = 0;
  for (const [vw, vh] of [[1440, 900], [390, 844]]) {
    const p = await browser.newPage({ viewport: { width: vw, height: vh } });
    const data = Array.from({ length: 12 }, (_, k) => A(k, `Med ${k}`, k % 2 ? 'health.expiry.soon' : 'health.stock.low', k % 2 ? 'WARNING' : 'CRITICAL'));
    await p.route(/\/alerts(\?|$)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) }));
    await p.route(/\/recommendations/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ recommendations: data.map(a => ({ ...a, recommended_action: `ACT ${a.equipment}`, action_category: 'stock', confidence: 0.8 })) }) }));
    await p.route(/\/(assignments|contractors)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"assignments":[],"contractors":[]}' }));
    await p.route(/\/upload/, async r => { await new Promise(x => setTimeout(x, 1500)); r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"message":"Processed."}' }); });
    await p.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', 1); localStorage.clear(); Object.entries({ sentria_onboarded: '1', sentria_language: 'en', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie' }).forEach(([k, v]) => localStorage.setItem(k, v)); } });
    await require('./auth-mock').signedIn(p); await p.goto(APP_URL, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
    const state = () => p.evaluate(() => { const d = document.scrollingElement; const box = document.querySelector('main').parentElement.getBoundingClientRect(); const root = document.querySelector('main').closest('.h-dvh'); return { doc: Math.round(d.scrollTop), extra: d.scrollHeight - d.clientHeight, root: root ? root.scrollTop : 'none', top: Math.round(box.top), h: Math.round(box.height) }; });
    const s0 = await state();
    const bad = [];
    const check = async (where) => { const s = await state(); if (s.doc || s.extra > 0 || s.root || s.top !== s0.top || s.h !== s0.h) bad.push([where, s]); };
    const scrollAll = async (where) => { await p.mouse.move(vw / 2, vh / 2); for (let i = 0; i < 15; i++) { await p.mouse.wheel(0, 500); await p.waitForTimeout(40); } await check(where + ' wheel'); await p.keyboard.press('End'); await p.waitForTimeout(200); await check(where + ' End'); for (let i = 0; i < 15; i++) { await p.mouse.wheel(0, -500); await p.waitForTimeout(40); } };
    await check('load'); await scrollAll('dashboard');
    // upload
    await p.evaluate(() => document.querySelector('input[type=file]').closest('label').scrollIntoView({ block: 'center' }));
    await p.locator('input[type=file]').focus(); await check('focus import');
    await p.setInputFiles('input[type=file]', { name: 'x.csv', mimeType: 'text/csv', buffer: Buffer.from('medicine_name,stock_qty\nA,1\n') });
    await p.waitForTimeout(3000); await check('after upload'); { const close = p.locator('[role=dialog][aria-label="Data import"] button'); if (await close.count()) await close.click(); await p.waitForTimeout(200); await check('import panel closed'); } await scrollAll('dashboard after upload');
    // every page in the sidebar
    const openMenu = async () => { if (vw < 1024 && !(await p.evaluate(() => document.querySelector('aside').getBoundingClientRect().left >= 0))) { const m = p.getByRole('button', { name: /menu/i }).first(); if (await m.count()) { await m.click({ timeout: 5000 }); await p.waitForTimeout(300); } } };
    await openMenu();
    const names = await p.evaluate(() => [...document.querySelectorAll('aside nav button')].map(b => b.innerText.trim()).filter(Boolean));
    for (const n of names) {
      await openMenu();
      const b = p.locator('aside nav button', { hasText: n }).first();
      await b.click({ force: true }).catch(() => {}); await p.waitForTimeout(700);
      await check(n); await scrollAll(n);
    }
    // Tab through the page with the keyboard
    await p.locator('aside nav button').first().click({ force: true }).catch(() => {}); await p.waitForTimeout(700);
    for (let i = 0; i < 80; i++) await p.keyboard.press('Tab');
    await check('tabbing');
    const ok = bad.length === 0; fails += !ok;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${vw}px: ${names.length} pages + upload + tabbing, page never scrolls, box never moves ${JSON.stringify(s0)}`);
    for (const b of bad.slice(0, 8)) console.log('     ', JSON.stringify(b));
    await p.close();
  }
  // onboarding (not onboarded)
  const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await require('./auth-mock').signedIn(p); await p.goto(APP_URL, { waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
  await p.mouse.wheel(0, 3000); await p.waitForTimeout(300);
  const d = await p.evaluate(() => ({ doc: document.scrollingElement.scrollTop, extra: document.scrollingElement.scrollHeight - document.scrollingElement.clientHeight }));
  const ok = d.doc === 0 && d.extra <= 0; fails += !ok;
  console.log(`${ok ? 'PASS' : 'FAIL'} onboarding: page never scrolls ${JSON.stringify(d)}`);
  await browser.close(); process.exit(fails ? 1 : 0);
})();
