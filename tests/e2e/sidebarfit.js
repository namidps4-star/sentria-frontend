const { chromium } = require('playwright'); const { signedIn } = require('./auth-mock');
const { LAUNCH, APP_URL } = require('./env');
(async () => {
  // Headless Chromium hides scrollbars by default; show the classic ones, as on Windows and Linux desktops.
  const b = await chromium.launch({ ...LAUNCH, ignoreDefaultArgs: ['--hide-scrollbars'] }); let fails = 0; let sawOverflow = false;
  for (const isAdmin of [false, true]) for (const [w, h] of [[1280, 600], [1280, 720], [1366, 768], [1440, 900], [1920, 1080]]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, locale: 'en-US' });
    await p.route(/onrender\.com\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: r.request().url().includes('/alerts') ? '[]' : '{"recommendations":[],"assignments":[],"contractors":[],"accounts":[]}' }));
    await p.addInitScript(() => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); Object.entries({ sentria_language: 'en', sentria_onboarded: 'true', sentria_sector: 'health' }).forEach(([k, v]) => localStorage.setItem(k, v)); } });
    await signedIn(p, 'u', 'a@b.c', { isAdmin }); await p.goto(APP_URL); await p.waitForTimeout(1500);
    const r = await p.evaluate(() => { const so = [...document.querySelectorAll('aside button')].find(x => /Sign out/.test(x.innerText)); const a = document.querySelector('aside').getBoundingClientRect(); const s = so?.getBoundingClientRect(); const nv = document.querySelector('aside nav'); return { bar: nv.offsetWidth - nv.clientWidth, none: getComputedStyle(nv).scrollbarWidth, overflows: nv.scrollHeight > nv.clientHeight + 1, fits: !!s && s.bottom <= a.bottom - 2 && s.bottom <= innerHeight, admin: [...document.querySelectorAll('aside nav button')].some(x => x.innerText.trim() === 'Admin') }; });
    const ok = r.fits && r.admin === isAdmin; fails += !ok;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${isAdmin ? 'admin' : 'user '} ${w}x${h}: sign-out visible=${r.fits}, admin entry=${r.admin}`);
    // The list scrolls on a short screen, and shows no scrollbar while it does.
    const noBar = r.bar === 0 && r.none === 'none'; fails += !noBar;
    console.log(`${noBar ? 'PASS' : 'FAIL'} ${isAdmin ? 'admin' : 'user '} ${w}x${h}: no scrollbar on the list (width ${r.bar}px, scrollbar-width ${r.none})`);
    if (r.overflows) {
      sawOverflow = true;
      await p.mouse.move(120, 300); await p.mouse.wheel(0, 120); await p.waitForTimeout(250);
      const top = await p.evaluate(() => document.querySelector('aside nav').scrollTop);
      fails += !(top > 0); console.log(`${top > 0 ? 'PASS' : 'FAIL'} ${isAdmin ? 'admin' : 'user '} ${w}x${h}: the list still scrolls with the wheel (scrollTop ${top})`);
    }
    await p.close(); }
  fails += !sawOverflow; console.log(`${sawOverflow ? 'PASS' : 'FAIL'} the list overflows on at least one screen, so the checks above test something`);
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
