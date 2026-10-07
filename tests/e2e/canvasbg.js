// The panel of the app (--canvas, the rounded frame next to the sidebar) is
// warm cream #f8f1e7 in light, and the outer background behind it is the same
// colour, so the page reads as one cream surface with white cards on it. Dark
// keeps its own colour for both. --background (inputs, pills, the sign-in and
// onboarding screens) does not change. Checked on desktop, on a phone, and with
// the theme forced and following the system, plus the pricing page and the
// pinned top bar that share the token.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };

const CREAM = 'rgb(248, 241, 231)';
const ONB = { sentria_onboarded: 'true', sentria_company_name: 'Acme', sentria_sector: 'industry', sentria_sectors: '["industry"]' };

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async ({ theme = 'light', vw = 1440, scheme = 'light' } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: 900 }, colorScheme: scheme });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    await p.route(/onrender\.com\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: r.request().url().includes('/alerts') ? '[]' : '{"recommendations":[],"assignments":[],"contractors":[]}' }));
    await p.addInitScript(v => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, val] of Object.entries(v)) localStorage.setItem(k, val); } }, { sentria_language: 'en', sentria_theme: theme, ...ONB });
    await signedIn(p, 'u-1', 'ama@acme.test', { plan: 'business' });
    await p.goto(APP_URL); await p.waitForTimeout(2000);
    return { p, ctx };
  };
  // The panel, the outer wrapper behind it and the page body.
  const read = p => p.evaluate(() => {
    const panel = document.querySelector('main').closest('[class*="bg-canvas"]');
    const outer = panel.parentElement.parentElement;
    const box = outer.getBoundingClientRect();
    return { panel: getComputedStyle(panel).backgroundColor, panelClass: panel.className, outer: getComputedStyle(outer).backgroundColor, outerClass: outer.className, covers: box.left <= 0 && box.top <= 0 && box.right >= window.innerWidth && box.bottom >= window.innerHeight, body: getComputedStyle(document.body).backgroundColor };
  });

  console.log('== light: cream panel, and the outer background is the same cream');
  { const { p, ctx } = await open({});
    const c = await read(p);
    pass(c.panel === CREAM, `panel is #f8f1e7 (${c.panel})`);
    pass(/bg-canvas/.test(c.panelClass), 'it comes from the bg-canvas token, not a hex in the component');
    pass(c.outer === CREAM && c.outer === c.panel, `the outer background is the panel's cream (${c.outer})`);
    pass(/bg-canvas/.test(c.outerClass) && !/bg-background/.test(c.outerClass), 'it comes from the same bg-canvas token');
    pass(c.covers, 'the outer wrapper covers the whole screen, so the page colour behind it never shows');
    const bgToken = await p.evaluate(() => { const d = document.createElement('div'); d.style.background = 'var(--background)'; document.body.appendChild(d); const v = getComputedStyle(d).backgroundColor; d.remove(); return v; });
    pass(bgToken !== CREAM && bgToken === c.body, `--background is untouched (${bgToken}), so inputs, pills and the sign-in screens keep their colour`);
    // What a CSS value paints, read back the way the browser reports it.
    const paint = (v) => p.evaluate(x => { const d = document.createElement('div'); d.style.background = x; document.body.appendChild(d); const r = getComputedStyle(d).backgroundColor; d.remove(); return r; }, v);
    const cardColour = await paint('var(--card)');
    pass(cardColour !== c.panel, `the card colour differs from the panel (${cardColour} on ${c.panel})`);
    pass(await p.evaluate(x => [...document.querySelectorAll('main *')].some(e => getComputedStyle(e).backgroundColor === x), cardColour), 'and a white card is on screen');
    const bar = await p.evaluate(() => getComputedStyle(document.querySelector('header')).backgroundColor);
    pass(bar === await paint('color-mix(in oklab, #f8f1e7 80%, transparent)'), `the top bar is the cream at 80% (${bar})`);
    await p.screenshot({ path: 'canvasbg-light.png' });
    pass(p._errors.length === 0, `no page errors ${p._errors.join('|')}`);
    await ctx.close(); }

  console.log('== dark (forced): not cream, outer and panel the same');
  { const { p, ctx } = await open({ theme: 'dark', scheme: 'light' });
    const c = await read(p);
    pass(c.panel !== CREAM, `panel is not cream (${c.panel})`);
    pass(c.panel === c.outer, `outer and panel are the same dark (${c.outer})`);
    await p.screenshot({ path: 'canvasbg-dark.png' });
    await ctx.close(); }

  console.log('== system theme follows the OS');
  { const { p, ctx } = await open({ theme: 'system', scheme: 'dark' });
    const c = await read(p);
    pass(c.panel !== CREAM && c.outer === c.panel, `system + OS dark: panel is not cream, outer matches (${c.panel})`);
    await ctx.close(); }
  { const { p, ctx } = await open({ theme: 'system', scheme: 'light' });
    const c = await read(p);
    pass(c.panel === CREAM && c.outer === CREAM, `system + OS light: panel and outer are cream (${c.panel})`);
    await ctx.close(); }

  console.log('== phone, 390 px');
  for (const theme of ['light', 'dark']) {
    const { p, ctx } = await open({ theme, vw: 390 });
    const c = await read(p);
    pass(theme === 'light' ? c.panel === CREAM : c.panel !== CREAM, `${theme}: panel ${theme === 'light' ? 'is cream' : 'is not cream'} (${c.panel})`);
    pass(c.outer === c.panel && c.covers, `${theme}: the outer background matches the panel and covers the screen`);
    pass(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${theme}: no sideways scroll`);
    await p.screenshot({ path: `canvasbg-390-${theme}.png` });
    await ctx.close();
  }

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
