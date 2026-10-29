// Step 3 (sector): the recommended sector spans the top row, the other tiles pair up in white cards
// (black art) in light mode and dark cards (white art) in dark mode. No icon square, the art sits in the corner.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { mockSupabase } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const light = c => parseFloat(c.match(/[\d.]+/)[0]); // lab() lightness, 0 to 100

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async ({ theme = 'light', width = 1280 } = {}) => {
    const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 }, locale: 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    await p.route(/onrender\.com\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: r.request().url().includes('/alerts') ? '[]' : '{"recommendations":[],"assignments":[],"contractors":[]}' }));
    await mockSupabase(p, { users: { 'new@co.bj': { uid: 'u-new', password: 'newpass12' } }, accounts: {} });
    await p.addInitScript(t => { localStorage.setItem('sentria_language', 'en'); localStorage.setItem('sentria_theme', t); }, theme);
    await p.goto(APP_URL); await p.waitForTimeout(1200);
    await p.fill('#auth-email', 'new@co.bj'); await p.fill('#auth-password', 'newpass12');
    await p.getByRole('button', { name: /^Sign in$/ }).click(); await p.waitForTimeout(2500);
    const dlg = p.getByRole('dialog');
    const next = async () => { await p.getByRole('button', { name: /^(Continue|Continuer)/ }).last().click(); await p.waitForTimeout(500); };
    await p.getByText("Côte d'Ivoire", { exact: true }).first().click(); await p.waitForTimeout(200); await next();
    await p.locator('#company-name').fill('Atlantic Terminal Ltd'); await next();
    await p.waitForTimeout(300);
    return { p, ctx, dlg };
  };
  const tiles = x => x.dlg.locator('button[aria-pressed]:has(img)');

  console.log('== light, desktop');
  let x = await open();
  pass(await tiles(x).count() === 7, 'seven sector tiles');
  const [lw, gw] = await Promise.all([tiles(x).nth(0).evaluate(el => el.getBoundingClientRect().width), tiles(x).nth(1).evaluate(el => el.getBoundingClientRect().width)]);
  pass(lw > gw * 1.8, 'the recommended sector spans the full row: ' + Math.round(lw) + ' vs ' + Math.round(gw));
  const bg = await tiles(x).nth(1).evaluate(el => getComputedStyle(el).backgroundColor);
  pass(light(bg) > 95, 'unselected tiles are white in light mode: ' + bg);
  pass(await tiles(x).nth(1).locator('img').count() === 1, 'each tile has its illustration');
  pass(await tiles(x).nth(1).locator('span.rounded-\\[22px\\]').count() === 0, 'no small icon square');
  await x.p.waitForTimeout(400); await x.p.screenshot({ path: 'sectortiles-light.png' });
  pass(x.p._errors.length === 0, 'no page errors ' + x.p._errors.join('|'));
  await x.ctx.close();

  console.log('== dark, desktop');
  x = await open({ theme: 'dark' });
  const dbg = await tiles(x).nth(1).evaluate(el => getComputedStyle(el).backgroundColor);
  pass(light(dbg) < 30, 'unselected tiles are dark in dark mode: ' + dbg);
  const art = await tiles(x).nth(1).locator('img').evaluate(el => getComputedStyle(el).filter);
  pass(art !== 'none', 'the art is inverted to light in dark mode: ' + art);
  await x.p.waitForTimeout(400); await x.p.screenshot({ path: 'sectortiles-dark.png' });
  await x.ctx.close();

  console.log('== phone');
  x = await open({ theme: 'light', width: 390 });
  pass(!(await x.p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'no sideways scroll at 390 px');
  pass(await tiles(x).count() === 7, 'all seven tiles on a phone');
  await x.p.waitForTimeout(400); await x.p.screenshot({ path: 'sectortiles-390.png' });
  await x.ctx.close();

  await browser.close();
  console.log(fails ? `\n${fails} failed` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
