// F-PHONE: a phone number the app can text. The contractor form formats it as
// you type, reads a number typed without a country code against the account's
// country, refuses what Twilio would bounce (in French and English, before it
// reaches the server) and sends E.164. A stored number that cannot be texted
// is flagged in the list. The checks in lib/phone.ts are tested on their own
// first (the same cases as the backend's tests/check_phone.py), then the build.
const fs = require('fs');
const path = require('path');
const ts = require(path.join(__dirname, '..', '..', 'node_modules', 'typescript'));
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const ROOT = path.join(__dirname, '..', '..');

// ---- lib/phone.ts in node: the real file and the real libphonenumber-js, with the country read stubbed
let country = '';
const stubLocale = { COUNTRIES: ['BJ', 'CI', 'SN', 'TG', 'GH', 'NG', 'FR'].map(code => ({ code })), readCountryCode: () => country };
function loadPhone() {
  const src = fs.readFileSync(path.join(ROOT, 'lib', 'phone.ts'), 'utf8');
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', js)(id => id === '@/lib/locale' ? stubLocale : require(path.join(ROOT, 'node_modules', id.replace(/^libphonenumber-js/, 'libphonenumber-js'))), mod, mod.exports);
  return mod.exports;
}

console.log('== lib/phone.ts: what is a number the app can text');
{
  const P = loadPhone();
  const v = (raw, c) => P.checkPhone(raw, c);
  const e = (raw, c) => { const r = v(raw, c); return r.kind === 'valid' ? r.e164 : r.kind; };
  pass(e('+221 70 123 45 67') === '+221701234567', 'spaces are removed: +221 70 123 45 67 -> +221701234567');
  pass(e('+33 (6) 12-34.56 78') === '+33612345678', 'dots, dashes and brackets too');
  pass(e('0033 6 12 34 56 78') === '+33612345678', '00 is read as +');
  pass(e('  +14155552671 ') === '+14155552671', 'surrounding blanks are ignored');
  pass(e('+229 01 97 12 34 56') === '+2290197123456', 'Benin, in the 10-digit format it has used since 2024');
  pass(e('01 97 12 34 56', 'BJ') === '+2290197123456', 'no country code: read against the account\'s country (BJ)');
  pass(e('06 12 34 56 78', 'FR') === '+33612345678', '…and FR');
  for (const [label, raw, c] of [['nothing', ''], ['blanks', '   ']]) pass(e(raw, c) === 'empty', `${label}: empty (a phone is optional)`);
  for (const [label, raw, c] of [
    ['letters', 'call me'], ['a vanity number', '+1 800 FLOWERS'], ['no country code and no account country', '97 12 34 56'],
    ['the old 8-digit Benin format', '+229 97 12 34 56'], ['the placeholder the form used to show', '+229 90 00 00 00'],
    ['too short', '+2290'], ['a country code that does not exist', '+999 12345678'], ['an unallocated number', '+1 000 000 0000'],
    ['an 8-digit local number with the wrong country', '97 12 34 56', 'BJ'],
  ]) pass(e(raw, c) === 'invalid', `${label}: invalid (${JSON.stringify(raw)})`);
  for (const code of ['BJ', 'CI', 'SN', 'TG', 'GH', 'NG', 'FR']) {
    const ex = P.phoneExample(code);
    pass(e(ex) !== 'invalid' && e(ex) !== 'empty', `${code}: the example in the placeholder is itself a valid number (${ex})`);
  }
  pass(P.phoneExample(undefined) === P.phoneExample('BJ') && e(P.phoneExample()) !== 'invalid', 'no account country: a Benin example (the first market), valid too');
  country = 'SN'; pass(P.defaultPhoneCountry() === 'SN', 'the default country is the account\'s'); country = 'ZZ'; pass(P.defaultPhoneCountry() === undefined, '…and nothing for a country the app does not list'); country = '';
  pass(P.formatPhoneInput('+2290197123456') === '+229 01 97 12 34 56', 'as you type: +2290197123456 -> +229 01 97 12 34 56');
  pass(P.formatPhoneInput('00229 0197', undefined).startsWith('+229'), 'as you type: 00 becomes +');
  pass(P.formatPhoneInput('') === '', 'as you type: nothing stays nothing');
  pass(P.formatPhoneInput('0197123456', 'BJ') === '01 97 12 34 56', 'as you type with a country: the national format');
}

console.log('== source');
{
  const src = fs.readFileSync(path.join(ROOT, 'lib', 'phone.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  pass(!/new RegExp|\.test\(|\/\^\\\+/.test(src.replace(/\/\[a-z\]\/i\.test\(text\)/, '')), 'no hand-written phone regex (only the letters guard)');
  const form = fs.readFileSync(path.join(ROOT, 'components/sentria/contractors-view.tsx'), 'utf8');
  pass(!/placeholder="\+229 90 00 00 00"/.test(form) && /<PhoneField/.test(form), 'the form uses the phone field, not a placeholder-only input');
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  pass(!!pkg.dependencies['libphonenumber-js'], 'libphonenumber-js is a dependency (both lockfiles carry it)');
  pass(/libphonenumber-js@/.test(fs.readFileSync(path.join(ROOT, 'pnpm-lock.yaml'), 'utf8')) && /node_modules\/libphonenumber-js/.test(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8')), 'pnpm-lock.yaml and package-lock.json both list it');
}

// ---- the browser
const STORED = [
  { id: 'c1', name: 'Kofi Mensah', role: 'Crane operator', phone: '+2290197123456', email: null, availability: 'available', note: null, active: true, open_assignments: 0, sms_ready: true },
  { id: 'c2', name: 'Placeholder Paul', role: null, phone: '+229 90 00 00 00', email: null, availability: 'available', note: null, active: true, open_assignments: 0, sms_ready: false },
  { id: 'c3', name: 'Words Wendy', role: null, phone: 'ask reception', email: null, availability: 'busy', note: null, active: true, open_assignments: 1, sms_ready: false },
  { id: 'c4', name: 'Spaced Sam', role: null, phone: '+221 70 123 45 67', email: null, availability: 'available', note: null, active: true, open_assignments: 0, sms_ready: true },
  { id: 'c5', name: 'No Number Nia', role: null, phone: null, email: 'nia@example.com', availability: 'off', note: null, active: true, open_assignments: 0, sms_ready: null },
  { id: 'c6', name: 'Old Api Ola', role: null, phone: '+229 90 00 00 01', email: null, availability: 'available', note: null, active: true, open_assignments: 0 },
];
async function open(browser, { theme = 'light', width = 1440, scheme = 'light', lang = 'en', countryCode = 'BJ', reject = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 1100 }, locale: lang === 'fr' ? 'fr-FR' : 'en-US', colorScheme: scheme });
  const p = await ctx.newPage(); const errs = []; const posts = []; p.on('pageerror', e => errs.push(e.message));
  await p.route(/onrender\.com\//, r => {
    const u = new URL(r.request().url()); const m = r.request().method();
    const json = body => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (u.pathname === '/alerts') return json([]);
    if (u.pathname === '/contractors' && m === 'POST') { posts.push(JSON.parse(r.request().postData())); return reject ? json({ error_code: 'phone_invalid', error_detail: reject }) : json({ contractor: { id: 'new', ...posts.at(-1), active: true, open_assignments: 0 } }); }
    if (u.pathname === '/contractors') return json({ contractors: STORED });
    return json({ recommendations: [], assignments: [] });
  });
  await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } },
    { sentria_language: lang, sentria_onboarded: 'true', sentria_sector: 'logistics', sentria_sectors: '["logistics"]', sentria_company_name: 'Acme', sentria_theme: theme, ...(countryCode ? { sentria_country: countryCode } : {}) });
  await signedIn(p, 'u', 'a@b.c', { plan: 'entreprise' });
  await p.goto(APP_URL); await p.waitForTimeout(1600);
  if (width < 768) { await p.getByRole('button', { name: /open.*(menu|navigation)/i }).first().click().catch(() => {}); await p.waitForTimeout(300); }
  await p.locator('aside nav button').filter({ hasText: new RegExp('^' + (lang === 'fr' ? 'Intervenants' : 'Field team') + '$') }).locator('visible=true').first().click(); await p.waitForTimeout(900);
  await p.getByRole('button', { name: lang === 'fr' ? 'Ajouter un intervenant' : 'Add a contractor' }).first().click(); await p.waitForTimeout(300);
  return { ctx, p, errs, posts };
}
const phoneIn = p => p.locator('[data-phone-input]');
const nameIn = p => p.locator('form input[required]').first();
const save = (p, lang = 'en') => p.getByRole('button', { name: lang === 'fr' ? 'Enregistrer' : 'Save', exact: true });
const rgb = (p, token) => p.evaluate(t => { const e = document.createElement('i'); e.style.color = `var(${t})`; document.body.appendChild(e); const c = getComputedStyle(e).color; e.remove(); return c; }, token);

(async () => {
  const b = await chromium.launch(LAUNCH);

  console.log('== typing: formatted as you go, deleting still works');
  {
    const { ctx, p, errs } = await open(b);
    const ph = await phoneIn(p).getAttribute('placeholder');
    pass(/^\+229 01 \d\d \d\d \d\d \d\d$/.test(ph) && ph !== '+229 90 00 00 00', `the placeholder is a valid Benin example for the account's country (${ph})`);
    await phoneIn(p).click(); await p.keyboard.type('+2290197123456', { delay: 15 });
    pass(await phoneIn(p).inputValue() === '+229 01 97 12 34 56', `typed +2290197123456, shown +229 01 97 12 34 56 (${await phoneIn(p).inputValue()})`);
    let lengths = [];
    for (let i = 0; i < 8; i++) { await p.keyboard.press('Backspace'); lengths.push((await phoneIn(p).inputValue()).length); }
    pass(lengths.every((n, i) => i === 0 || n < lengths[i - 1]) && lengths.at(-1) < 12, `Backspace always removes something, even over a space (${lengths})`);
    await phoneIn(p).fill(''); await phoneIn(p).click(); await p.keyboard.type('0197123456', { delay: 15 });
    pass(await phoneIn(p).inputValue() === '01 97 12 34 56', `a national number is formatted the national way (${await phoneIn(p).inputValue()})`);
    await phoneIn(p).fill('00229 01 97 12 34 56'); await p.locator('body').click({ position: { x: 5, y: 5 } }); await p.waitForTimeout(100);
    pass(await phoneIn(p).inputValue() === '+229 01 97 12 34 56', 'pasted with 00: written as +229 … when you leave the field');
    pass(await p.locator('[data-phone-error]').count() === 0, 'no error for a valid number');
    pass(errs.length === 0, 'no page errors');
    await ctx.close();
  }

  console.log('== saving: E.164 goes to the server');
  {
    const { ctx, p, posts } = await open(b);
    await nameIn(p).fill('Ama Koffi'); await phoneIn(p).click(); await p.keyboard.type('+229 01 97 12 34 56', { delay: 10 });
    await save(p).click(); await p.waitForTimeout(500);
    pass(posts.length === 1 && posts[0].phone === '+2290197123456' && posts[0].name === 'Ama Koffi', `a spaced number is sent as +2290197123456 (${JSON.stringify(posts[0])})`);
    await ctx.close();
    const n = await open(b);
    await nameIn(n.p).fill('Local Lou'); await phoneIn(n.p).fill('01 97 12 34 56'); await save(n.p).click(); await n.p.waitForTimeout(500);
    pass(n.posts.length === 1 && n.posts[0].phone === '+2290197123456', 'a number typed without the country code is sent with it (account country BJ)');
    await n.ctx.close();
    const e = await open(b);
    await nameIn(e.p).fill('No Phone Pat'); await save(e.p).click(); await e.p.waitForTimeout(500);
    pass(e.posts.length === 1 && !('phone' in e.posts[0]), 'no number: none is sent (it is optional)');
    await e.ctx.close();
    const x = await open(b, { countryCode: '' });
    await nameIn(x.p).fill('Abroad Abe'); await phoneIn(x.p).fill('01 97 12 34 56'); await save(x.p).click(); await x.p.waitForTimeout(400);
    pass(x.posts.length === 0 && await x.p.locator('[data-phone-error]').isVisible(), 'no account country: a number without a country code cannot be guessed, so it is refused');
    pass(/\+229/.test(await phoneIn(x.p).getAttribute('placeholder')), '…and the placeholder still shows a valid example');
    await x.ctx.close();
  }

  console.log('== refusing: nothing reaches the server, and it says why');
  {
    const { ctx, p, posts } = await open(b);
    await nameIn(p).fill('Bad Bob'); await phoneIn(p).fill('97 12 34 56');
    pass(await p.locator('[data-phone-error]').count() === 0, 'no error while you are still typing');
    await p.locator('body').click({ position: { x: 5, y: 5 } }); await p.waitForTimeout(150);
    const err = p.locator('[data-phone-error]');
    pass(await err.isVisible(), 'leaving the field with a bad number shows the error');
    const text = await err.innerText();
    pass(/Invalid number/.test(text) && /international format/.test(text) && /\+229 01 \d\d \d\d \d\d \d\d/.test(text), `English, naming the format, with a real example (${text})`);
    pass(await phoneIn(p).getAttribute('aria-invalid') === 'true' && (await phoneIn(p).getAttribute('aria-describedby')) === await err.getAttribute('id') && await err.getAttribute('role') === 'alert', 'aria-invalid, aria-describedby and role=alert are set');
    pass(await phoneIn(p).evaluate(el => getComputedStyle(el).borderColor) === await rgb(p, '--destructive'), 'the field border is the destructive token');
    await save(p).click(); await p.waitForTimeout(400);
    pass(posts.length === 0, 'Save does not send it');
    await phoneIn(p).fill('+229 01 97 12 34 56'); await p.waitForTimeout(100);
    pass(await p.locator('[data-phone-error]').count() === 0, 'fixing it clears the error');
    await save(p).click(); await p.waitForTimeout(400);
    pass(posts.length === 1 && posts[0].phone === '+2290197123456', 'and then it saves');
    await ctx.close();

    for (const bad of ['+229 97 12 34 56', '+229 90 00 00 00', '+2290', '+1 800 FLOWERS']) {
      const r = await open(b); await nameIn(r.p).fill('X'); await phoneIn(r.p).fill(bad); await save(r.p).click(); await r.p.waitForTimeout(300);
      pass(r.posts.length === 0 && await r.p.locator('[data-phone-error]').isVisible(), `${JSON.stringify(bad)}: refused, nothing sent`);
      await r.ctx.close();
    }

    // Letters cannot be typed into the field (it keeps digits): "call me" is not a number, it is nothing.
    const l = await open(b); await nameIn(l.p).fill('Letters Lea'); await phoneIn(l.p).click(); await l.p.keyboard.type('call me', { delay: 10 });
    pass(await phoneIn(l.p).inputValue() === '', 'letters typed into the field do not stay in it');
    await save(l.p).click(); await l.p.waitForTimeout(400);
    pass(l.posts.length === 1 && !('phone' in l.posts[0]), '…so nothing is saved as a "number": the contractor is saved without one');
    await l.ctx.close();
    const m = await open(b); await nameIn(m.p).fill('Pasted Pete'); await phoneIn(m.p).fill('tel: 01 97 12 34 56 (office)'); await m.p.locator('body').click({ position: { x: 5, y: 5 } }); await m.p.waitForTimeout(150);
    const pasted = await phoneIn(m.p).inputValue(); pass(pasted === '+229 01 97 12 34 56' && await m.p.locator('[data-phone-error]').count() === 0, `a pasted number with words around it keeps its digits and is written in full when you leave the field (${JSON.stringify(pasted)})`);
    await m.ctx.close();

    const f = await open(b, { lang: 'fr' });
    await nameIn(f.p).fill('Mauvais Moussa'); await phoneIn(f.p).fill('12'); await save(f.p, 'fr').click(); await f.p.waitForTimeout(300);
    const ft = await f.p.locator('[data-phone-error]').innerText();
    pass(/Numéro invalide/.test(ft) && /format international/i.test(ft) && /\+229 01/.test(ft), `French: ${ft}`);
    pass(/Téléphone/i.test(await f.p.locator('form').innerText()), 'the label is French too');
    await f.ctx.close();
  }

  console.log('== the server has the last word');
  {
    const detail = 'Phone number must be international: + country code + number, e.g. +229 90 00 00 00. / Le numéro doit être au format international : + indicatif pays + numéro, ex. +229 90 00 00 00.';
    const { ctx, p, posts } = await open(b, { reject: detail });
    await nameIn(p).fill('Server Sam'); await phoneIn(p).fill('+229 01 97 12 34 56'); await save(p).click(); await p.waitForTimeout(500);
    pass(posts.length === 1 && await p.getByText('format international', { exact: false }).first().isVisible(), 'a number the server refuses is said out loud (its bilingual message), not swallowed');
    pass(await p.locator('form').count() === 1, '…and the form stays open for a correction');
    await ctx.close();
  }

  console.log('== a number stored before this, and the API not redeployed yet');
  {
    const { ctx, p } = await open(b);
    await p.getByRole('button', { name: 'Cancel' }).click(); await p.waitForTimeout(200);
    // the person's card: climb from their name to the first ancestor that also holds a workload bar
    const flagFor = name => p.evaluate(n => { let el = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && e.textContent.trim() === n); while (el && !/Workload|Charge/.test(el.textContent)) el = el.parentElement; return el ? el.querySelectorAll('[data-sms-flag]').length : -1; }, name);
    pass(await flagFor('Placeholder Paul') === 1 && await flagFor('Words Wendy') === 1, 'a stored number that cannot be texted is flagged (the old placeholder, free text)');
    pass(await flagFor('Kofi Mensah') === 0 && await flagFor('Spaced Sam') === 0, 'a good one, or one that normalises, is not');
    pass(await flagFor('No Number Nia') === 0 && await flagFor('Old Api Ola') === 0, 'no number, or an API that says nothing about it: no flag');
    const flag = await p.locator('[data-sms-flag]').first().innerText();
    pass(/Can't SMS this number: fix it/.test(flag), `the flag says what to do (${flag})`);
    pass(await p.locator('[data-sms-flag]').count() === 2, 'exactly the two bad ones');
    const page = await p.locator('body').innerText(); pass(page.includes('+229 90 00 00 00') && page.includes('ask reception') && page.includes('+221 70 123 45 67'), 'the stored text is shown as it was: nothing is rewritten silently');
    await p.screenshot({ path: 'phone-list-light-1440.png' });
    await ctx.close();
    const f = await open(b, { lang: 'fr' }); await f.p.getByRole('button', { name: 'Annuler' }).click(); await f.p.waitForTimeout(200);
    pass(/SMS impossible : corrigez ce numéro/.test(await f.p.locator('[data-sms-flag]').first().innerText()), 'the flag in French');
    await f.ctx.close();
  }

  console.log('== themes and a phone');
  {
    for (const [name, theme, scheme] of [['dark', 'dark', 'light'], ['system, OS dark', 'system', 'dark']]) {
      const { ctx, p } = await open(b, { theme, scheme });
      await nameIn(p).fill('Dark Dan'); await phoneIn(p).fill('+229 97 12 34 56'); await save(p).click(); await p.waitForTimeout(250);
      pass(await p.locator('[data-phone-error]').evaluate(el => getComputedStyle(el).color) === await rgb(p, '--destructive'), `${name}: the error uses the destructive token`);
      if (theme === 'dark') await p.screenshot({ path: 'phone-error-dark-1440.png' });
      await ctx.close();
    }
    for (const theme of ['light', 'dark']) {
      const { ctx, p, errs } = await open(b, { theme, width: 390 });
      await nameIn(p).fill('Phone Pia'); await phoneIn(p).fill('+229 97'); await save(p).click(); await p.waitForTimeout(250);
      const m = await p.evaluate(() => { const i = document.querySelector('[data-phone-input]').getBoundingClientRect(); const e = document.querySelector('[data-phone-error]').getBoundingClientRect(); return { page: document.documentElement.scrollWidth, win: innerWidth, inside: i.left >= 0 && i.right <= innerWidth && e.left >= 0 && e.right <= innerWidth }; });
      pass(m.page <= m.win + 1 && m.inside, `${theme}, 390 px: no sideways scroll; field and error fit the screen`);
      await p.screenshot({ path: `phone-error-${theme}-390.png` });
      pass(errs.length === 0, `${theme}, 390 px: no page errors`);
      await ctx.close();
    }
  }

  await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL OK');
  process.exit(fails ? 1 : 0);
})();
