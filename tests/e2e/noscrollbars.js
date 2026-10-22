// No scroll bars anywhere: the page and a wide, tall scroll area read scrollbar-width none and a 0 px bar,
// with Chromium's own bars switched on (headless hides them by default), and still scroll.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
(async () => {
  const browser = await chromium.launch({ ...LAUNCH, ignoreDefaultArgs: ['--hide-scrollbars'] });
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 500 } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route(/\/alerts(\?|$)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await p.route(/\/recommendations/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"recommendations":[]}' }));
  await p.addInitScript(() => { const s = { sentria_onboarded: '1', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', sentria_language: 'en', sentria_company_name: 'Acme' }; for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); });
  await signedIn(p); await p.goto(APP_URL, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  console.log('== the page and the app\'s scroll area');
  const page = await p.evaluate(() => ({ w: getComputedStyle(document.documentElement).scrollbarWidth, bar: innerWidth - document.documentElement.clientWidth }));
  pass(page.w === 'none' && page.bar === 0, 'the page: scrollbar-width none, bar ' + page.bar + ' px');
  const main = await p.evaluate(() => { const m = document.querySelector('main'); return { w: getComputedStyle(m).scrollbarWidth, bar: m.offsetWidth - m.clientWidth, tall: m.scrollHeight > m.clientHeight }; });
  pass(main.w === 'none' && main.bar === 0, 'main: scrollbar-width none, bar ' + main.bar + ' px');
  pass(main.tall, 'main is taller than the window');
  const y0 = await p.evaluate(() => document.querySelector('main').scrollTop); await p.mouse.move(500, 250); await p.mouse.wheel(0, 400); await p.waitForTimeout(400);
  pass(await p.evaluate(() => document.querySelector('main').scrollTop) > y0, 'and it still scrolls with the wheel');
  const nav = await p.evaluate(() => { const n = document.querySelector('aside nav'); return { w: getComputedStyle(n).scrollbarWidth, bar: n.offsetWidth - n.clientWidth }; });
  pass(nav.w === 'none' && nav.bar === 0, 'the sidebar list: scrollbar-width none, bar ' + nav.bar + ' px');
  console.log('== an element that scrolls');
  await p.evaluate(() => { const d = document.createElement('div'); d.id = 'probe'; d.className = 'overflow-auto'; d.style.cssText = 'position:fixed;left:0;top:0;width:200px;height:100px;z-index:9999'; d.innerHTML = '<div style="width:900px;height:900px"></div>'; document.body.appendChild(d); });
  const el = await p.evaluate(() => { const d = document.getElementById('probe'); return { w: getComputedStyle(d).scrollbarWidth, bar: d.offsetWidth - d.clientWidth, can: d.scrollHeight > d.clientHeight && d.scrollWidth > d.clientWidth }; });
  pass(el.w === 'none' && el.bar === 0 && el.can, 'an overflow-auto box: scrollbar-width none, bar ' + el.bar + ' px, still scrollable');
  pass(errs.length === 0, 'no page errors ' + errs.join('|'));
  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
