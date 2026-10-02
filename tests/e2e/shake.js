// F-FORMSHAKE: a field that refuses its input says so. A red border, a line
// that says why, focus on the field and one short shake (app/transitions.css
// .t-shake, replayed by lib/use-shake.ts). Checked on the Add site form, the
// company name in Settings and the sign-in form; in French; with "reduce
// motion"; in dark; and on a phone.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn, mockSupabase } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };

const toMs = v => (/ms$/.test(v) ? parseFloat(v) : parseFloat(v) * 1000);
const shaking = p => p.evaluate(() => document.querySelectorAll('.t-shake').length);
const destructive = p => p.evaluate(() => { const e = document.createElement('i'); e.style.color = 'var(--destructive)'; document.body.appendChild(e); const c = getComputedStyle(e).color; e.remove(); return c; });
const ONB = { sentria_onboarded: 'true', sentria_company_name: 'Acme', sentria_sector: 'industry', sentria_sectors: '["industry"]' };

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async ({ page, lang = 'en', theme = 'light', vw = 1440, reduce = false, plan = 'business' } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: 900 }, locale: lang === 'fr' ? 'fr-FR' : 'en-US', reducedMotion: reduce ? 'reduce' : 'no-preference' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    await p.route(/onrender\.com\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: r.request().url().includes('/alerts') ? '[]' : '{"recommendations":[],"assignments":[],"contractors":[]}' }));
    await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } }, { ...ONB, sentria_language: lang, sentria_theme: theme });
    await signedIn(p, 'u-1', 'ama@acme.test', { plan });
    await p.goto(APP_URL); await p.waitForTimeout(2000);
    if (vw < 768) { await p.getByRole('button', { name: /open.*(menu|navigation)|ouvrir.*(menu|navigation)/i }).first().click().catch(() => {}); await p.waitForTimeout(300); }
    await p.locator('aside nav button').locator('visible=true').nth(page).click(); await p.waitForTimeout(900);
    return { p, ctx };
  };
  const SITES = 3, SETTINGS = 9;
  const openAddSite = async p => { await p.getByRole('button', { name: /Create my first site|Créer mon premier site/ }).first().click(); await p.waitForTimeout(500); };
  const createBtn = p => p.getByRole('button', { name: /^(Create the site|Créer le site)$/ });
  const nameBox = p => p.locator('input[placeholder="e.g. Lyon plant"], input[placeholder="Ex. Usine Lyon"]');

  console.log('== Add site: an empty name is refused out loud');
  { const { p, ctx } = await open({ page: SITES });
    await openAddSite(p);
    pass(await createBtn(p).isEnabled(), 'the button is not greyed out: a click gets an answer');
    await createBtn(p).click();
    pass(await shaking(p) === 1, 'the field shakes (one element carries .t-shake)');
    const wrap = p.locator('.t-shake');
    const anim = await wrap.evaluate(el => { const c = getComputedStyle(el); return { name: c.animationName, dur: c.animationDuration, fill: c.animationFillMode }; });
    pass(anim.name === 't-shake' && toMs(anim.dur) <= 250 && anim.fill === 'none', `it is the short shake (${anim.name}, ${anim.dur}, fill ${anim.fill}): within the 250 ms budget, nothing left on the field`);
    pass(await nameBox(p).getAttribute('aria-invalid') === 'true', 'aria-invalid on the field');
    await p.waitForTimeout(250); // the border fades to red (transition-colors)
    { const got = await nameBox(p).evaluate(el => getComputedStyle(el).borderTopColor), want = await destructive(p);
      pass(got === want, `red border (the destructive token): got ${got}, want ${want}`); }
    pass(await p.getByRole('alert').filter({ hasText: 'Give the site a name.' }).isVisible(), 'a line says why: "Give the site a name."');
    pass(await nameBox(p).evaluate(el => document.activeElement === el), 'focus is on the field');
    await p.screenshot({ path: 'shake-addsite-light.png' });
    await p.waitForTimeout(450);
    pass(await shaking(p) === 0, 'the shake class is gone once it has played');
    pass(await p.evaluate(() => getComputedStyle(document.querySelector('input[aria-invalid="true"]').parentElement).transform) === 'none', 'and no transform is left behind');
    await createBtn(p).click(); await p.waitForTimeout(30);
    pass(await shaking(p) === 1, 'a second refusal shakes again');
    await p.waitForTimeout(450);
    await nameBox(p).fill('Lyon plant');
    pass(await nameBox(p).getAttribute('aria-invalid') === 'false' && await p.getByRole('alert').filter({ hasText: 'Give the site a name.' }).count() === 0, 'typing a name clears the red');
    await createBtn(p).click(); await p.waitForTimeout(500);
    pass(await shaking(p) === 0 && /Lyon plant/.test(await p.evaluate(() => document.body.innerText)), 'a name creates the site, no shake');
    pass(p._errors.length === 0, `no page errors ${p._errors.join('|')}`);
    await ctx.close(); }

  console.log('== Add site: closing the form forgets the red');
  { const { p, ctx } = await open({ page: SITES });
    await openAddSite(p); await createBtn(p).click(); await p.waitForTimeout(100);
    await p.getByRole('button', { name: /^(Cancel|Annuler)$/ }).click(); await p.waitForTimeout(500);
    await openAddSite(p);
    pass(await nameBox(p).getAttribute('aria-invalid') === 'false', 'reopened clean');
    await ctx.close(); }

  console.log('== French');
  { const { p, ctx } = await open({ page: SITES, lang: 'fr' });
    await openAddSite(p); await createBtn(p).click();
    pass(await p.getByRole('alert').filter({ hasText: 'Donnez un nom au site.' }).isVisible(), 'the line in French');
    await ctx.close(); }

  console.log('== reduce motion: the refusal shows, nothing moves');
  { const { p, ctx } = await open({ page: SITES, reduce: true });
    await openAddSite(p); await createBtn(p).click(); await p.waitForTimeout(60);
    pass(await nameBox(p).getAttribute('aria-invalid') === 'true' && await p.getByRole('alert').filter({ hasText: 'Give the site a name.' }).isVisible(), 'red border and line are there');
    pass(await p.locator('.t-shake').evaluate(el => getComputedStyle(el).animationName).catch(() => 'none') === 'none', 'the animation is off');
    await ctx.close(); }

  console.log('== Settings: the company name');
  { const { p, ctx } = await open({ page: SETTINGS });
    const box = p.locator('input[autocomplete="organization"]');
    pass(await box.inputValue() === 'Acme', 'starts with the onboarding name');
    await box.fill('');
    await p.getByRole('button', { name: /^Save$/ }).click();
    pass(await shaking(p) === 1, 'an empty name shakes');
    pass(await box.getAttribute('aria-invalid') === 'true' && await p.getByRole('alert').filter({ hasText: 'Enter your company name.' }).isVisible(), 'red and a line: "Enter your company name."');
    pass(await box.evaluate(el => document.activeElement === el), 'focus is on the field');
    pass(await p.evaluate(() => localStorage.getItem('sentria_company_name')) === 'Acme', 'nothing was saved');
    pass(!(await p.evaluate(() => document.body.innerText)).match(/Saved|Enregistré/), 'and it does not say "Saved"');
    await p.screenshot({ path: 'shake-settings-light.png' });
    await p.waitForTimeout(450);
    await box.fill('New Co');
    pass(await box.getAttribute('aria-invalid') === 'false', 'typing clears the red');
    await p.getByRole('button', { name: /^Save$/ }).click(); await p.waitForTimeout(300);
    pass(await p.evaluate(() => localStorage.getItem('sentria_company_name')) === 'New Co' && await shaking(p) === 0, 'a name saves, no shake');
    pass(p._errors.length === 0, `no page errors ${p._errors.join('|')}`);
    await ctx.close(); }
  { const { p, ctx } = await open({ page: SETTINGS, lang: 'fr' });
    const box = p.locator('input[autocomplete="organization"]');
    await box.fill(''); await p.getByRole('button', { name: /^Enregistrer$/ }).click();
    pass(await p.getByRole('alert').filter({ hasText: 'Entrez le nom de votre entreprise.' }).isVisible(), 'French line');
    await ctx.close(); }

  console.log('== Sign-in: a refused sign-in shakes the form, and does not say which field');
  { const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    await mockSupabase(p, { users: { 'ama@pharma.bj': { uid: 'u-ama', password: 'goodpass1', meta: {} } }, accounts: {} });
    await p.goto(APP_URL); await p.waitForTimeout(1000);
    await p.fill('#auth-email', 'ama@pharma.bj'); await p.fill('#auth-password', 'nope');
    await p.getByRole('button', { name: /^(Sign in|Se connecter)$/ }).click();
    const started = await p.waitForFunction(() => document.querySelector('form.t-shake'), null, { timeout: 3000 }).then(() => true).catch(() => false);
    pass(started, 'the form shakes when the error shows');
    pass(await p.getByRole('alert').filter({ hasText: /Wrong email or password/ }).isVisible(), 'the error line is the same as before');
    pass(await p.locator('#auth-email').getAttribute('aria-invalid') !== 'true' && await p.locator('#auth-password').getAttribute('aria-invalid') !== 'true', 'neither field is marked: the error does not say which one was wrong');
    await p.screenshot({ path: 'shake-signin-light.png' });
    await p.waitForTimeout(450);
    pass(await p.evaluate(() => document.querySelectorAll('.t-shake').length) === 0, 'it settles');
    await p.fill('#auth-password', 'nope2'); await p.getByRole('button', { name: /^(Sign in|Se connecter)$/ }).click();
    pass(await p.waitForFunction(() => document.querySelector('form.t-shake'), null, { timeout: 3000 }).then(() => true).catch(() => false), 'a second refusal shakes again');
    pass(p._errors.length === 0, `no page errors ${p._errors.join('|')}`);
    await ctx.close(); }

  console.log('== dark and a phone');
  { const { p, ctx } = await open({ page: SITES, theme: 'dark' });
    await openAddSite(p); await createBtn(p).click(); await p.waitForTimeout(60);
    await p.waitForTimeout(250);
    { const got = await nameBox(p).evaluate(el => getComputedStyle(el).borderTopColor), want = await destructive(p);
      pass(got === want, `dark: red border: got ${got}, want ${want}`); }
    await p.screenshot({ path: 'shake-addsite-dark.png' }); await ctx.close(); }
  { const { p, ctx } = await open({ page: SETTINGS, vw: 390 });
    const box = p.locator('input[autocomplete="organization"]');
    await box.fill(''); await p.getByRole('button', { name: /^Save$/ }).click(); await p.waitForTimeout(60);
    pass(await p.getByRole('alert').filter({ hasText: 'Enter your company name.' }).isVisible(), '390 px: the line shows');
    pass(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), '390 px: no sideways scroll, even mid-shake');
    await p.screenshot({ path: 'shake-settings-390.png' }); await ctx.close(); }

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL OK'); process.exit(fails ? 1 : 0);
})();
