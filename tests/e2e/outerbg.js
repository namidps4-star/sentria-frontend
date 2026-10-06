// The outer background of the app (the strip around the rounded panel and
// behind the sidebar) is warm cream #f8f1e7 in light. Dark keeps its own
// colour. The panel inside (--canvas) and the inputs (--background) do not
// change. Checked on desktop, on a phone, and with the theme forced and
// following the system.
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
  // The colours of the outer wrapper, the rounded panel and the page body.
  const read = p => p.evaluate(() => {
    const panel = document.querySelector('main').closest('[class*="bg-canvas"]');
    const outer = panel.parentElement.parentElement;
    return { outer: getComputedStyle(outer).backgroundColor, outerClass: outer.className, panel: getComputedStyle(panel).backgroundColor, body: getComputedStyle(document.body).backgroundColor };
  });

  console.log('== light: cream outside, panel unchanged');
  { const { p, ctx } = await open({});
    const c = await read(p);
    pass(c.outer === CREAM, `outer background is #f8f1e7 (${c.outer})`);
    pass(/bg-outer/.test(c.outerClass) && !/bg-background/.test(c.outerClass), 'it comes from the bg-outer token, not a hex in the component');
    pass(c.panel !== CREAM && c.panel !== c.outer, `the panel keeps its own colour (${c.panel})`);
    const bgToken = await p.evaluate(() => { const d = document.createElement('div'); d.style.background = 'var(--background)'; document.body.appendChild(d); const v = getComputedStyle(d).backgroundColor; d.remove(); return v; });
    pass(bgToken !== CREAM && bgToken === c.body, `--background is untouched (${bgToken}), so inputs and pills keep their colour`);
    await p.screenshot({ path: 'outerbg-light.png' });
    pass(p._errors.length === 0, `no page errors ${p._errors.join('|')}`);
    await ctx.close(); }

  console.log('== dark (forced): not cream');
  { const { p, ctx } = await open({ theme: 'dark', scheme: 'light' });
    const c = await read(p);
    pass(c.outer !== CREAM, `outer is not cream (${c.outer})`);
    pass(c.outer === c.body, `outer matches the page background in dark (${c.outer})`);
    await p.screenshot({ path: 'outerbg-dark.png' });
    await ctx.close(); }

  console.log('== system theme follows the OS');
  { const { p, ctx } = await open({ theme: 'system', scheme: 'dark' });
    const c = await read(p);
    pass(c.outer !== CREAM && c.outer === c.body, `system + OS dark: not cream (${c.outer})`);
    await ctx.close(); }
  { const { p, ctx } = await open({ theme: 'system', scheme: 'light' });
    const c = await read(p);
    pass(c.outer === CREAM, `system + OS light: cream (${c.outer})`);
    await ctx.close(); }

  console.log('== phone, 390 px');
  for (const theme of ['light', 'dark']) {
    const { p, ctx } = await open({ theme, vw: 390 });
    const c = await read(p);
    pass(theme === 'light' ? c.outer === CREAM : c.outer !== CREAM, `${theme}: outer ${theme === 'light' ? 'is cream' : 'is not cream'} (${c.outer})`);
    pass(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${theme}: no sideways scroll`);
    await p.screenshot({ path: `outerbg-390-${theme}.png` });
    await ctx.close();
  }

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
