// LEG-1: sign-up offers three countries for now (Benin, Côte d'Ivoire,
// Senegal). This checks the onboarding picker and the Settings picker in
// English and French, that an account that already chose another country
// keeps it, and that nothing overflows in dark or on a phone.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };

const OTHERS = ['Togo', 'Ghana', 'Nigeria', 'Cameroon', 'DR Congo', 'Kenya', 'Tanzania', 'Morocco', 'France', 'United Kingdom', 'United States', 'Brazil', 'Another country',
  'Cameroun', 'RD Congo', 'Maroc', 'Royaume-Uni', 'États-Unis', 'Brésil', 'Autre pays'];
const SETTINGS = 9;
const ONB = { sentria_onboarded: 'true', sentria_company_name: 'Acme', sentria_sector: 'industry', sentria_sectors: '["industry"]' };

(async () => {
  const browser = await chromium.launch(LAUNCH);
  // ls: what is already in the browser. With no sentria_onboarded the wizard opens.
  const open = async ({ ls = {}, lang = 'en', theme = 'light', vw = 1440, settings = false } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: 900 }, locale: lang === 'fr' ? 'fr-FR' : 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    await p.route(/onrender\.com\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: r.request().url().includes('/alerts') ? '[]' : '{"recommendations":[],"assignments":[],"contractors":[]}' }));
    await p.addInitScript(v => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, val] of Object.entries(v)) localStorage.setItem(k, val); } }, { sentria_language: lang, sentria_theme: theme, ...ls });
    await signedIn(p, 'u-1', 'ama@acme.test', { plan: 'business' });
    await p.goto(APP_URL); await p.waitForTimeout(2000);
    if (settings) {
      if (vw < 768) { await p.getByRole('button', { name: /open.*(menu|navigation)|ouvrir.*(menu|navigation)/i }).first().click().catch(() => {}); await p.waitForTimeout(300); }
      await p.locator('aside nav button').locator('visible=true').nth(SETTINGS).click(); await p.waitForTimeout(900);
    }
    return { p, ctx };
  };
  const dialogText = p => p.locator('[role=dialog]').first().innerText();
  const countrySelect = p => p.locator('select').filter({ has: p.locator('option', { hasText: /Benin|Bénin/ }) });
  const optionTexts = async p => (await countrySelect(p).locator('option').allInnerTexts()).map(t => t.trim()).filter(Boolean);
  const hasWord = (text, w) => new RegExp(`(^|[^\\p{L}])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}]|$)`, 'u').test(text);

  console.log('== onboarding, English: three countries');
  { const { p, ctx } = await open({});
    const t = await dialogText(p);
    pass(/Your country/.test(t), 'the wizard is on step 1, "Your country"');
    for (const n of ['Benin', "Côte d'Ivoire", 'Senegal']) pass(hasWord(t, n), `offered: ${n}`);
    const left = OTHERS.filter(n => hasWord(t, n));
    pass(left.length === 0, `no other country, no "Another country" (${left.join(', ') || 'none found'})`);
    await p.getByText('Senegal', { exact: true }).first().click(); await p.waitForTimeout(200);
    pass(await p.getByRole('button', { name: /Senegal/ }).getAttribute('aria-pressed') === 'true', 'a country can still be picked');
    pass(await p.locator('select[aria-label="Account currency"]').inputValue() === 'XOF', 'and it fills the currency in (XOF)');
    await p.screenshot({ path: 'launchcountries-onboarding-light.png' });
    pass(p._errors.length === 0, `no page errors ${p._errors.join('|')}`);
    await ctx.close(); }

  console.log('== onboarding, French');
  { const { p, ctx } = await open({ lang: 'fr' });
    const t = await dialogText(p);
    for (const n of ['Bénin', "Côte d'Ivoire", 'Sénégal']) pass(hasWord(t, n), `offered: ${n}`);
    const left = OTHERS.filter(n => hasWord(t, n));
    pass(left.length === 0, `no other country (${left.join(', ') || 'none found'})`);
    await ctx.close(); }

  console.log('== dark and a phone');
  { const { p, ctx } = await open({ theme: 'dark' });
    pass(hasWord(await dialogText(p), 'Benin'), 'dark: the picker is there');
    await p.screenshot({ path: 'launchcountries-onboarding-dark.png' }); await ctx.close(); }
  { const { p, ctx } = await open({ vw: 390 });
    pass(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), '390 px: no sideways scroll');
    pass(hasWord(await dialogText(p), "Côte d'Ivoire"), '390 px: the picker is there');
    await p.screenshot({ path: 'launchcountries-onboarding-390.png' }); await ctx.close(); }

  console.log('== Settings: a new account sees three');
  { const { p, ctx } = await open({ ls: ONB, settings: true });
    const o = await optionTexts(p);
    pass(o.length === 4, `the list is "no country" plus three (${o.length} options)`);
    const names = o.slice(1).map(t => t.split('·')[0].trim());
    pass(JSON.stringify(names) === JSON.stringify(['Benin', "Côte d'Ivoire", 'Senegal']), `Benin, Côte d'Ivoire, Senegal (${names.join(', ')})`);
    await countrySelect(p).selectOption('SN'); await p.waitForTimeout(150);
    pass(await countrySelect(p).inputValue() === 'SN', 'Senegal can be chosen');
    await p.screenshot({ path: 'launchcountries-settings-light.png' });
    await ctx.close(); }

  console.log('== Settings: an account that already chose another country keeps it');
  for (const [code, name, symbol] of [['TG', 'Togo', 'F CFA'], ['NG', 'Nigeria', '₦']]) {
    const { p, ctx } = await open({ ls: { ...ONB, sentria_country: code }, settings: true });
    const o = await optionTexts(p);
    pass(o.some(t => t.startsWith(name)), `${name} is still in the list`);
    pass(await countrySelect(p).inputValue() === code, `and it is the one selected (${code})`);
    pass(o.some(t => t.startsWith(name) && t.includes(symbol)), `with its currency (${symbol})`);
    pass(o.length === 5, `the three launch countries are there too (${o.length - 1} countries)`);
    await ctx.close();
  }

  console.log('== Settings: French, dark, phone');
  { const { p, ctx } = await open({ ls: ONB, lang: 'fr', settings: true });
    const names = (await optionTexts(p)).slice(1).map(t => t.split('·')[0].trim());
    pass(JSON.stringify(names) === JSON.stringify(['Bénin', "Côte d'Ivoire", 'Sénégal']), `French names (${names.join(', ')})`);
    await ctx.close(); }
  { const { p, ctx } = await open({ ls: ONB, theme: 'dark', vw: 390, settings: true });
    pass(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'dark, 390 px: no sideways scroll');
    await p.screenshot({ path: 'launchcountries-settings-dark-390.png' }); await ctx.close(); }

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL OK'); process.exit(fails ? 1 : 0);
})();
