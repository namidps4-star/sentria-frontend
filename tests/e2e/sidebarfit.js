const { chromium } = require('playwright'); const { signedIn } = require('./auth-mock');
const { LAUNCH, APP_URL } = require('./env');
(async () => {
  // Headless Chromium hides scrollbars by default; show the classic ones, as on Windows and Linux desktops.
  const b = await chromium.launch({ ...LAUNCH, ignoreDefaultArgs: ['--hide-scrollbars'] }); let fails = 0; let sawOverflow = false;
  // Every sidebar item stays on screen, with no scroll, from 560 px high up. Below that the list may
  // scroll (still with no scrollbar). `extra` adds one more row, as when a new page is added.
  for (const isAdmin of [false, true]) for (const extra of [0, 1]) for (const [w, h] of [[1280, 560], [1280, 600], [1280, 720], [1366, 768], [1440, 900], [1920, 1080]]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, locale: 'en-US' });
    await p.route(/onrender\.com\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: r.request().url().includes('/alerts') ? '[]' : '{"recommendations":[],"assignments":[],"contractors":[],"accounts":[]}' }));
    await p.addInitScript(() => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); Object.entries({ sentria_language: 'en', sentria_onboarded: 'true', sentria_sector: 'health' }).forEach(([k, v]) => localStorage.setItem(k, v)); } });
    await signedIn(p, 'u', 'a@b.c', { isAdmin }); await p.goto(APP_URL); await p.waitForTimeout(1500);
    if (extra) await p.evaluate(() => { const nv = document.querySelector('aside nav'); const btn = [...nv.querySelectorAll('button')].find(x => x.innerText.trim() === 'Field team'); btn.after(btn.cloneNode(true)); });
    await p.waitForTimeout(200);
    const r = await p.evaluate(() => {
      const so = [...document.querySelectorAll('aside button')].find(x => /Sign out/.test(x.innerText)); const a = document.querySelector('aside').getBoundingClientRect(); const s = so?.getBoundingClientRect(); const nv = document.querySelector('aside nav'); const nr = nv.getBoundingClientRect();
      const items = [...nv.querySelectorAll('button')].map(x => x.getBoundingClientRect());
      return { bar: nv.offsetWidth - nv.clientWidth, none: getComputedStyle(nv).scrollbarWidth, overflows: nv.scrollHeight > nv.clientHeight + 1, fits: !!s && s.bottom <= a.bottom - 2 && s.bottom <= innerHeight, admin: [...nv.querySelectorAll('button')].some(x => x.innerText.trim() === 'Admin'), n: items.length, minH: Math.round(Math.min(...items.map(i => i.height))), inside: items.every(i => i.top >= nr.top - 1 && i.bottom <= nr.bottom + 1) };
    });
    const tag = `${isAdmin ? 'admin' : 'user '}${extra ? '+1' : '  '} ${w}x${h}`;
    const ok = r.fits && r.admin === isAdmin; fails += !ok;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${tag}: sign-out visible=${r.fits}, admin entry=${r.admin}`);
    const noBar = r.bar === 0 && r.none === 'none'; fails += !noBar;
    console.log(`${noBar ? 'PASS' : 'FAIL'} ${tag}: no scrollbar on the list (width ${r.bar}px, scrollbar-width ${r.none})`);
    const all = !r.overflows && r.inside && r.minH >= 26; fails += !all;
    console.log(`${all ? 'PASS' : 'FAIL'} ${tag}: all ${r.n} items on screen, no scrolling needed (smallest row ${r.minH}px, overflow ${r.overflows})`);
    await p.close(); }
  // A very short screen: the list may scroll, but still shows no scrollbar and sign-out is reachable.
  { const p = await b.newPage({ viewport: { width: 1280, height: 440 }, locale: 'en-US' });
    await p.route(/onrender\.com\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await p.addInitScript(() => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); Object.entries({ sentria_language: 'en', sentria_onboarded: 'true', sentria_sector: 'health' }).forEach(([k, v]) => localStorage.setItem(k, v)); } });
    await signedIn(p, 'u', 'a@b.c', { isAdmin: true }); await p.goto(APP_URL); await p.waitForTimeout(1500);
    const r = await p.evaluate(() => { const nv = document.querySelector('aside nav'); const so = [...document.querySelectorAll('aside button')].find(x => /Sign out/.test(x.innerText)); return { bar: nv.offsetWidth - nv.clientWidth, none: getComputedStyle(nv).scrollbarWidth, out: !!so && so.getBoundingClientRect().bottom <= innerHeight }; });
    const ok = r.bar === 0 && r.none === 'none' && r.out; fails += !ok;
    console.log(`${ok ? 'PASS' : 'FAIL'} 1280x440: no scrollbar (${r.bar}px, ${r.none}) and sign-out visible=${r.out}`);
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
