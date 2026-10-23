// The login page: the pitch (headline with the lime marker, the example alert, 01 02 03) beside a soft form card
// with a Sign in / Create account switch. Light, dark, French, 390 px, and a 700 px high laptop.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { mockSupabase } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const rgb = (loc, prop) => loc.evaluate((el, prop) => { const cv = document.createElement('canvas'); cv.width = cv.height = 1; const c = cv.getContext('2d', { willReadFrequently: true }); c.fillStyle = '#000'; c.fillStyle = getComputedStyle(el)[prop]; c.fillRect(0, 0, 1, 1); return [...c.getImageData(0, 0, 1, 1).data].slice(0, 3); }, prop);

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async ({ theme = 'light', width = 1280, height = 800, lang = 'en' } = {}) => {
    const ctx = await browser.newContext({ viewport: { width, height }, locale: lang === 'fr' ? 'fr-FR' : 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    await mockSupabase(p, { users: {}, accounts: {} });
    await p.addInitScript(([l, t]) => { localStorage.setItem('sentria_language', l); localStorage.setItem('sentria_theme', t); }, [lang, theme]);
    await p.goto(APP_URL); await p.waitForTimeout(1500);
    return { p, ctx };
  };

  console.log('== desktop, light');
  let { p, ctx } = await open();
  let t = (await p.locator('body').innerText()).replace(/\s+/g, ' ');
  pass(/See problems before they cost you\./.test(t) && /SentrIA reads your operating data/.test(t), 'the headline and the line under it');
  pass(/Welcome back/.test(t) && /Use your email or your @username\./.test(t), 'Welcome back and the line under it');
  pass(!/Secure sign-in/.test(t) && !/Hello\. Sign in/.test(t), 'the chat bubble and the "Secure sign-in" tag are gone');
  pass(await p.getByRole('tab', { name: 'Sign in' }).getAttribute('aria-selected') === 'true' && await p.getByRole('tab', { name: 'Create account' }).getAttribute('aria-selected') === 'false', 'the Sign in / Create account switch, Sign in selected');
  pass(await p.getByRole('button', { name: /^Sign in$/ }).count() === 1, 'one Sign in button (the tab is not a button)');
  pass(await p.locator('section[aria-roledescription]').count() === 1 && /EXAMPLE ALERT/i.test(t), 'the example-alert panel is there');
  pass(/01/.test(t) && /Real-time alerts/.test(t) && /Your data stays yours/.test(t) && /Actions, not just numbers/.test(t), '01 02 03 and the three promises');
  const mark = await p.locator('h2 span').first().evaluate(el => getComputedStyle(el).backgroundImage);
  pass(/linear-gradient/.test(mark), 'the lime marker is under "cost you."');
  const btn = await rgb(p.locator('form button[type=submit]'), 'backgroundColor');
  pass(btn[1] > 200 && btn[2] < 100, 'the Sign in button is lime: rgb(' + btn.join(',') + ')');
  const input = await p.locator('#auth-email').evaluate(el => ({ r: getComputedStyle(el).borderRadius, h: el.getBoundingClientRect().height }));
  pass(parseFloat(input.r) >= 27 && Math.round(input.h) === 54, 'fields are soft pills: ' + input.r + ', ' + Math.round(input.h) + ' px high');
  pass(await p.locator('form svg').count() >= 3, 'icons in the fields');
  pass(await p.getByRole('group', { name: 'Language' }).count() === 1, 'one language switch is shown');
  await p.screenshot({ path: 'loginui-light.png' });

  console.log('== Create account');
  await p.getByRole('tab', { name: 'Create account' }).click(); await p.waitForTimeout(300);
  t = (await p.locator('body').innerText()).replace(/\s+/g, ' ');
  pass(/Let's protect your operations together/.test(t) && await p.locator('#auth-name').count() === 1 && await p.locator('#auth-username').count() === 1 && await p.locator('#auth-company').count() === 1, 'the sign-up form with its fields');
  pass(await p.getByRole('tab', { name: 'Create account' }).getAttribute('aria-selected') === 'true', 'the switch follows');
  pass(await p.getByTestId('auth-terms').count() === 1, 'the terms box is there');
  await p.screenshot({ path: 'loginui-signup.png' });
  await p.getByRole('tab', { name: 'Sign in' }).click(); await p.waitForTimeout(200);
  console.log('== Forgot password');
  await p.getByRole('button', { name: /Forgot your password/ }).click(); await p.waitForTimeout(300);
  pass(await p.getByRole('tablist', { name: /Sign in or create/ }).count() === 0 && await p.getByRole('button', { name: 'Back to sign in' }).count() === 1, 'the switch hides, a Back to sign in link shows');
  await p.getByRole('button', { name: 'Back to sign in' }).click(); await p.waitForTimeout(200);
  pass(await p.getByRole('tab', { name: 'Sign in' }).count() === 1, 'and goes back');
  pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
  await ctx.close();

  console.log('== French, dark, 700 px high, phone');
  ({ p, ctx } = await open({ lang: 'fr' }));
  t = (await p.locator('body').innerText()).replace(/\s+/g, ' ');
  pass(/Content de vous revoir/.test(t) && /Voyez les problèmes avant qu'ils ne coûtent\./.test(t) && await p.getByRole('tab', { name: 'Créer un compte' }).count() === 1, 'in French');
  await ctx.close();
  ({ p, ctx } = await open({ theme: 'dark' })); await p.screenshot({ path: 'loginui-dark.png' }); await ctx.close();
  ({ p, ctx } = await open({ height: 700 }));
  const over = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  pass(over <= 80, 'at 700 px high the page is at most 80 px taller than the screen: ' + over);
  await p.screenshot({ path: 'loginui-700.png' }); await ctx.close();
  ({ p, ctx } = await open({ width: 390, height: 844 }));
  pass(await p.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth) <= 0, 'no sideways scroll at 390 px');
  const order = await p.evaluate(() => { const f = document.querySelector('form').getBoundingClientRect().top; const a = document.querySelector('section[aria-roledescription]').getBoundingClientRect().top; return f < a; });
  pass(order, 'on a phone the form comes before the example alert');
  await p.screenshot({ path: 'loginui-phone.png', fullPage: true }); await ctx.close();

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
