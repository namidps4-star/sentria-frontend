// Onboarding, country step: a black rail (big light 01 with the lime line, the title, the numbered steps) beside
// one soft card (country tiles with flags, time zone as code and cities, currency and time zone as light numbers).
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { mockSupabase } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const rgb = (loc, prop) => loc.evaluate((el, prop) => { const cv = document.createElement('canvas'); cv.width = cv.height = 1; const c = cv.getContext('2d', { willReadFrequently: true }); c.fillStyle = '#000'; c.fillStyle = getComputedStyle(el)[prop]; c.fillRect(0, 0, 1, 1); return [...c.getImageData(0, 0, 1, 1).data].slice(0, 3); }, prop);

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async ({ theme = 'light', width = 1280, lang = 'en' } = {}) => {
    const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 860 }, locale: lang === 'fr' ? 'fr-FR' : 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    await p.route(/onrender\.com\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: r.request().url().includes('/alerts') ? '[]' : '{"recommendations":[],"assignments":[],"contractors":[]}' }));
    await mockSupabase(p, { users: { 'new@co.bj': { uid: 'u-new', password: 'newpass12' } }, accounts: {} });
    await p.addInitScript(([l, t]) => { localStorage.setItem('sentria_language', l); localStorage.setItem('sentria_theme', t); }, [lang, theme]);
    await p.goto(APP_URL); await p.waitForTimeout(1200);
    await p.fill('#auth-email', 'new@co.bj'); await p.fill('#auth-password', 'newpass12');
    await p.getByRole('button', { name: lang === 'fr' ? /^Se connecter$/ : /^Sign in$/ }).click(); await p.waitForTimeout(2500);
    return { p, ctx, dlg: p.getByRole('dialog') };
  };

  console.log('== desktop, light');
  let x = await open();
  let t = (await x.dlg.innerText()).replace(/\s+/g, ' ');
  pass(/Your country/.test(t) && /Where do you work\?/.test(t), 'the title and the question');
  pass(await x.dlg.locator('ol[aria-label="The steps"] li').count() === 6, 'the rail lists six numbered steps');
  pass(/01/.test(t) && /02/.test(t), 'steps are numbered 01, 02...');
  const rail = x.dlg.locator('div.rounded-\\[40px\\]').first();
  const railBg = await rgb(rail, 'backgroundColor');
  pass(railBg.every(v => v < 60), 'the rail is black: rgb(' + railBg.join(',') + ')');
  pass(await x.dlg.locator('button[aria-pressed]', { hasText: /Benin|Côte d'Ivoire|Senegal|Kenya|Uganda/ }).count() === 5, 'five country tiles');
  pass(/🇨🇮/.test(await x.dlg.innerText()) && /🇧🇯/.test(await x.dlg.innerText()), 'tiles show flags');
  const cont = x.p.getByRole('button', { name: /^Continue/ }).last();
  pass(await cont.isDisabled(), 'Continue is off until a country is picked');
  await x.p.getByText("Côte d'Ivoire", { exact: true }).first().click(); await x.p.waitForTimeout(300);
  const tile = x.dlg.locator('button[aria-pressed=true]', { hasText: "Côte d'Ivoire" });
  const tileBg = await rgb(tile, 'backgroundColor');
  pass(tileBg[0] > 180 && tileBg[2] < 120, 'the picked tile is lime: rgb(' + tileBg.join(',') + ')');
  pass(await cont.isEnabled(), 'Continue turns on');
  const zones = x.p.getByRole('group', { name: 'Time zone' });
  const gmt = zones.locator('button', { hasText: 'GMT' });
  const gmtBg = await rgb(gmt, 'backgroundColor');
  pass(await gmt.getAttribute('aria-pressed') === 'true' && gmtBg[1] > 200 && gmtBg[2] < 100, 'GMT is picked from the country, in lime: rgb(' + gmtBg.join(',') + ')');
  pass(/Dakar, Abidjan/.test(await gmt.innerText()) && /From your country/.test(await gmt.innerText()), 'it shows its cities and "From your country"');
  pass(await x.p.locator('select[aria-label="Account currency"]').inputValue() === 'XOF', 'currency: XOF');
  const nums = (await x.dlg.locator('section').last().innerText()).replace(/\s+/g, ' ');
  pass(/XOF/.test(nums) && /GMT/.test(nums), 'currency and time zone shown as the light numbers');
  await zones.locator('button', { hasText: 'CET' }).click(); await x.p.waitForTimeout(200);
  pass(await zones.locator('button', { hasText: 'CET' }).getAttribute('aria-pressed') === 'true' && await gmt.getAttribute('aria-pressed') === 'false', 'time zone can be changed');
  pass(await x.dlg.evaluate(el => [...el.querySelectorAll('*')].every(n => { const o = getComputedStyle(n).overflowY; return !(o === 'auto' || o === 'scroll') || n.scrollHeight <= n.clientHeight + 1 || n === el.querySelector('.overflow-y-auto'); })), 'no inner scroll bar in the card');
  await x.p.waitForTimeout(500); await x.p.screenshot({ path: 'onbcountry-light.png' });
  await cont.click(); await x.p.waitForTimeout(500);
  pass(/Step 2 of 6/.test(await x.dlg.innerText()), 'Continue goes to step 2');
  pass(x.p._errors.length === 0, 'no page errors ' + x.p._errors.join('|'));
  await x.ctx.close();

  console.log('== French, dark, phone');
  x = await open({ lang: 'fr' });
  t = await x.dlg.innerText();
  pass(/Votre pays/.test(t) && /Où travaillez-vous/.test(t) && /Fuseau horaire/i.test(t), 'in French');
  await x.ctx.close();
  x = await open({ theme: 'dark' });
  await x.p.getByText("Côte d'Ivoire", { exact: true }).first().click(); await x.p.waitForTimeout(400);
  await x.p.screenshot({ path: 'onbcountry-dark.png' });
  await x.ctx.close();
  x = await open({ width: 390 });
  await x.p.getByText("Côte d'Ivoire", { exact: true }).first().click(); await x.p.waitForTimeout(400);
  pass(await x.p.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth) <= 0, 'no sideways scroll at 390 px');
  await x.p.screenshot({ path: 'onbcountry-phone.png' });
  await x.ctx.close();

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
