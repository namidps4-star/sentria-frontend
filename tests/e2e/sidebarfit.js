const { chromium } = require('playwright'); const { signedIn } = require('./auth-mock');
const { LAUNCH, APP_URL } = require('./env');
(async () => { const b = await chromium.launch(LAUNCH); let fails = 0;
  for (const isAdmin of [false, true]) for (const [w, h] of [[1280, 720], [1366, 768], [1440, 900], [1920, 1080]]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, locale: 'en-US' });
    await p.route(/onrender\.com\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: r.request().url().includes('/alerts') ? '[]' : '{"recommendations":[],"assignments":[],"contractors":[],"accounts":[]}' }));
    await p.addInitScript(() => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); Object.entries({ sentria_language: 'en', sentria_onboarded: 'true', sentria_sector: 'health' }).forEach(([k, v]) => localStorage.setItem(k, v)); } });
    await signedIn(p, 'u', 'a@b.c', { isAdmin }); await p.goto(APP_URL); await p.waitForTimeout(1500);
    const r = await p.evaluate(() => { const so = [...document.querySelectorAll('aside button')].find(x => /Sign out/.test(x.innerText)); const a = document.querySelector('aside').getBoundingClientRect(); const s = so?.getBoundingClientRect(); return { fits: !!s && s.bottom <= a.bottom - 2 && s.bottom <= innerHeight, admin: [...document.querySelectorAll('aside nav button')].some(x => x.innerText.trim() === 'Admin') }; });
    const ok = r.fits && r.admin === isAdmin; fails += !ok;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${isAdmin ? 'admin' : 'user '} ${w}x${h}: sign-out visible=${r.fits}, admin entry=${r.admin}`);
    await p.close(); }
  // collapsed at 720: sign-out still reachable
  { const p = await b.newPage({ viewport: { width: 1280, height: 720 }, locale: 'en-US' });
    await p.route(/onrender\.com\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await p.addInitScript(() => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); Object.entries({ sentria_language: 'en', sentria_onboarded: 'true', sentria_sector: 'health' }).forEach(([k, v]) => localStorage.setItem(k, v)); } });
    await signedIn(p, 'u', 'a@b.c', { isAdmin: true }); await p.goto(APP_URL); await p.waitForTimeout(1500);
    await p.getByRole('button', { name: /Collapse/ }).click(); await p.waitForTimeout(500);
    const r = await p.evaluate(() => { const so = document.querySelector('aside button[aria-label="Sign out"]'); const s = so?.getBoundingClientRect(); return !!s && s.bottom <= innerHeight; });
    fails += !r; console.log(`${r ? 'PASS' : 'FAIL'} collapsed 1280x720: sign-out visible=${r}`);
    await p.mouse.move(40, 250); await p.waitForTimeout(300);
    await p.close(); }
  await b.close(); process.exit(fails ? 1 : 0); })();
