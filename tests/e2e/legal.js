// F-LEGAL (chantier LEG-1, dashboard part): privacy and terms inside the app. Checks: sign-up needs the
// terms box ticked and sends which version was accepted; the links on the sign-in and sign-up screens and in
// Settings open the dialog; it says it is a draft, names the providers, never claims compliance, takes the
// contact address from the environment (none in code) and falls back to Help & feedback; French; Escape;
// phone width; light and dark.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { mockSupabase, signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const ROOT = path.join(__dirname, '..', '..');

(async () => {
  console.log('== no address in code');
  { const src = ['lib/legal.ts', 'components/sentria/legal-dialog.tsx', 'components/sentria/auth-screen.tsx', 'components/sentria/settings-view.tsx'].map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
    pass(!/[\w.+-]+@(gmail|outlook|hotmail|yahoo)\.[a-z]+/i.test(src), 'no personal email address in the legal files');
    pass(/NEXT_PUBLIC_LEGAL_EMAIL/.test(src), 'the contact address is read from NEXT_PUBLIC_LEGAL_EMAIL'); }

  const browser = await chromium.launch(LAUNCH);
  const out = async ({ lang = 'en', theme = 'light', vw = 1440 } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: 900 }, locale: lang === 'fr' ? 'fr-FR' : 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    await p.route(/onrender\.com\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"recommendations":[],"assignments":[],"contractors":[]}' }));
    await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } }, { sentria_language: lang, sentria_theme: theme });
    const log = await mockSupabase(p, { users: {}, accounts: {}, taken: [] });
    await p.goto(APP_URL); await p.waitForTimeout(900);
    return { p, ctx, log };
  };
  const fill = async p => { await p.fill('#auth-name', 'Afi'); await p.fill('#auth-username', 'afi_sud'); await p.fill('#auth-company', 'Clinique Sud'); await p.fill('#auth-email', 'afi@clinique.bj'); await p.fill('#auth-password', 'longenough1'); await p.waitForTimeout(900); };

  console.log('== sign-up needs the box');
  { const { p, ctx, log } = await out();
    await p.getByRole('button', { name: 'Create one' }).click(); await p.waitForTimeout(300);
    await fill(p);
    pass(await p.getByTestId('auth-terms').isVisible() && !(await p.getByTestId('auth-terms').isChecked()), 'the box is there and starts unticked');
    await p.getByRole('button', { name: /Create my account/ }).click(); await p.waitForTimeout(500);
    pass(/Accept the terms and the privacy policy/.test(await p.evaluate(() => document.body.innerText)) && !log.some(l => l.path === '/auth/v1/signup'), 'unticked: refused, nothing sent');
    await p.getByTestId('auth-terms').check();
    await p.getByRole('button', { name: /Create my account/ }).click(); await p.waitForTimeout(900);
    const su = log.find(l => l.path === '/auth/v1/signup');
    pass(su && su.body.data.terms_version === '2026-10-18' && !Number.isNaN(Date.parse(su.body.data.terms_accepted_at)), 'ticked: sent with the version and the time: ' + (su && su.body.data.terms_version));
    await ctx.close(); }

  console.log('== the dialog');
  { const { p, ctx } = await out();
    await p.getByRole('button', { name: 'Create one' }).click(); await p.waitForTimeout(300);
    await p.getByTestId('auth-terms-link').click(); await p.waitForTimeout(500);
    const d = p.getByTestId('legal-dialog');
    pass(await d.isVisible() && /Terms of use/.test(await d.locator('h2').innerText()), 'the terms link opens the terms');
    pass(/Draft not reviewed by a lawyer/.test(await p.getByTestId('legal-draft').innerText()), 'it says it is a draft');
    const toc = p.getByTestId('legal-toc').locator('button');
    pass(await toc.count() === await d.locator('section[data-legal-section]').count(), 'the contents list has one entry for each card (' + await toc.count() + ')');
    pass(await d.locator('section[data-legal-section] > span').first().innerText() === '01', 'the first card carries the number 01');
    pass(!/[\u{1F300}-\u{1FAFF}]/u.test(await d.innerText()), 'and no emoji anywhere');
    pass(await d.locator('section[data-legal-section] > span').first().evaluate(el => { const c = getComputedStyle(el); return c.backgroundColor === 'rgba(0, 0, 0, 0)' && parseFloat(c.fontSize) >= 40 && Number(c.fontWeight) <= 300; }), 'the number is big, light and has no colour block');
    await toc.nth(5).click(); await p.waitForTimeout(900);
    pass(await toc.nth(5).getAttribute('aria-current') === 'true', 'a click on a contents entry marks it');
    pass(await d.locator('section[data-legal-section="5"]').evaluate(el => { const r = el.getBoundingClientRect(), b = el.parentElement.parentElement.getBoundingClientRect(); return r.top - b.top < 80; }), 'and brings its card to the top');
    await toc.last().click(); await p.waitForTimeout(900);
    pass(await toc.last().getAttribute('aria-current') === 'true', 'Contact is the last entry and can be reached');
    await toc.first().click(); await p.waitForTimeout(900);
    await p.screenshot({ path: 'legal-terms-1440.png' });
    await p.getByTestId('legal-tab-privacy').click(); await p.waitForTimeout(200);
    const txt = await d.innerText();
    pass(await d.locator('[data-legal-providers] li').count() === 7, 'the providers sentence becomes 7 chips (' + await d.locator('[data-legal-providers] li').count() + ')');
    pass(['Supabase', 'Vercel', 'Render', 'Twilio', 'Resend', 'Google'].every(n => txt.includes(n)), 'the privacy tab names every provider');
    pass((await d.locator('section b').allInnerTexts()).includes('Your account:'), 'lead-ins such as "Your account:" are set in bold');
    pass(!/complian|conforme|GDPR|RGPD/i.test(await d.innerText()), 'and never claims compliance');
    pass(/Help & feedback/.test(txt) && !/@/.test(txt), 'no address configured: it points to Help & feedback and shows no address');
    await p.keyboard.press('Escape'); await p.waitForTimeout(400);
    pass(await d.count() === 0, 'Escape closes it');
    await p.getByRole('button', { name: 'Sign in', exact: true }).click(); await p.waitForTimeout(300);
    await p.getByTestId('auth-footer-privacy').click(); await p.waitForTimeout(400);
    pass(/Privacy/.test(await p.getByTestId('legal-dialog').locator('h2').innerText()), 'the footer on the sign-in screen opens the privacy page');
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== French');
  { const { p, ctx } = await out({ lang: 'fr' });
    await p.getByTestId('auth-footer-terms').click(); await p.waitForTimeout(500);
    const t = await p.getByTestId('legal-dialog').innerText();
    pass(/Conditions d'utilisation/.test(t) && /Brouillon non relu par un juriste/.test(t), 'terms in French with the draft notice');
    await ctx.close(); }

  console.log('== dark and a phone');
  { const { p, ctx } = await out({ theme: 'dark' });
    await p.getByTestId('auth-footer-privacy').click(); await p.waitForTimeout(500);
    await p.screenshot({ path: 'legal-dark-1440.png' }); await ctx.close(); }
  { const { p, ctx } = await out({ vw: 390 });
    await p.getByRole('button', { name: 'Create one' }).click(); await p.waitForTimeout(300);
    await p.getByTestId('auth-privacy-link').click(); await p.waitForTimeout(500);
    const box = await p.getByTestId('legal-dialog').boundingBox();
    pass(box && box.x >= 0 && box.x + box.width <= 390 && box.y >= 0 && box.y + box.height <= 900, 'at 390 px the dialog fits the screen: ' + JSON.stringify(box && { x: Math.round(box.x), w: Math.round(box.width), h: Math.round(box.height) }));
    pass((await p.getByTestId('legal-toc').boundingBox()).width <= 390 && await p.getByTestId('legal-toc').evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'on a phone the contents are number chips that wrap');
    pass(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'no sideways scroll');
    await p.screenshot({ path: 'legal-390.png' }); await ctx.close(); }

  console.log('== Settings');
  { const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    await p.route(/onrender\.com\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"recommendations":[],"assignments":[],"contractors":[]}' }));
    await p.route(/\/alerts(\?|$)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } },
      { sentria_onboarded: 'true', sentria_company_name: 'Acme', sentria_sector: 'industry', sentria_sectors: '["industry"]', sentria_language: 'en' });
    await signedIn(p, 'u-1', 'a@b.c', { plan: 'pro' });
    await p.goto(APP_URL); await p.waitForTimeout(2000);
    await p.getByRole('button', { name: /^Settings$/ }).first().click(); await p.waitForTimeout(700);
    await p.getByTestId('settings-terms').click(); await p.waitForTimeout(500);
    pass(/Terms of use/.test(await p.getByTestId('legal-dialog').locator('h2').innerText()), 'Settings has a link to the terms');
    await p.screenshot({ path: 'legal-settings-1440.png' });
    await p.keyboard.press('Escape'); await p.waitForTimeout(400);
    await p.getByTestId('settings-privacy').click(); await p.waitForTimeout(500);
    pass(/Privacy/.test(await p.getByTestId('legal-dialog').locator('h2').innerText()), 'and one to the privacy page');
    pass(/Export my data/.test(await p.getByTestId('legal-dialog').innerText()) && /Delete my account/.test(await p.getByTestId('legal-dialog').innerText()), 'the rights section says where to export and delete');
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  await browser.close();
  console.log(fails ? `\n${fails} failed` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
