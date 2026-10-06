// Plans: pricing page (currency, trial, full background), onboarding rules, upload rules.
const { LAUNCH, APP_URL } = require('./env');
const { chromium } = require('playwright');
const { signedIn } = require('./auth-mock');
const APP = APP_URL;
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const soon = new Date(Date.now() + 4.5 * 86400000).toISOString();
const { PLANS_ANSWER } = require('./plans-fixture');
const api = async (p, onUpload) => {
  await p.route(/onrender\.com\//, r => { const u = r.request().url();
    if (/\/plans(\?|$)/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PLANS_ANSWER) });
    if (u.includes('/upload')) return onUpload ? onUpload(r) : r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"message":"ok"}' });
    r.fulfill({ status: 200, contentType: 'application/json', body: u.includes('/alerts') ? '[]' : '{"recommendations":[],"assignments":[],"contractors":[]}' }); });
};
const text = p => p.evaluate(() => document.body.innerText);
(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async ({ ls = {}, plan = 'decouverte', trialEndsAt = null, vw = 1440, onUpload } = {}) => {
    const p = await browser.newPage({ viewport: { width: vw, height: 900 }, locale: 'en-US' });
    p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    await api(p, onUpload);
    await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } }, { sentria_language: 'en', ...ls });
    await signedIn(p, 'u-test', 'test@sentria.app', { plan, trialEndsAt });
    await p.goto(APP); await p.waitForTimeout(1800); return p;
  };
  const ONB = { sentria_onboarded: 'true', sentria_company_name: 'Pharmacie A' };
  const goPricing = async p => { await p.locator('aside nav button', { hasText: /Pricing|Plans|Subscription|Tarifs|Abonnement/ }).first().click(); await p.waitForTimeout(800); };

  console.log('== pricing page');
  { const p = await open({ ls: { ...ONB, sentria_country: 'BJ', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie' }, trialEndsAt: soon });
    await goPricing(p); const t = await text(p);
    pass(/15[\s ,.]000 F CFA/.test(t) && /45[\s ,.]000 F CFA/.test(t), 'Benin: prices in F CFA (15 000 / 45 000)');
    pass(/Business trial: 5 days left/.test(t), 'trial banner: 5 days left');
    pass(/Your trial/.test(t), 'Business card marked "Your trial"');
    pass(!/\bIoT\b|\bSSO\b|white label|webhooks/i.test(t.replace(/SOON/g, ' ')), 'no promises of unbuilt features (IoT, SSO, API, white label)');
    pass(/\bsoon\b/i.test(t), 'unbuilt ML features marked "Soon"');
    const cover = await p.evaluate(() => { const m = document.querySelector('main').getBoundingClientRect(); const v = document.querySelector('main > div').getBoundingClientRect(); const mh = document.querySelector('main').clientHeight; return { dl: Math.round(v.left - m.left), dr: Math.round(m.right - v.right), dt: Math.round(v.top - m.top), tall: v.height >= mh - 1 }; });
    pass(cover.dl === 0 && cover.dr === 0 && cover.dt === 0 && cover.tall, 'background covers the whole box, no strip around: ' + JSON.stringify(cover));
    await p.screenshot({ path: 'pricing-1440.png' });
    await p.evaluate(() => document.querySelector('main').scrollTo(0, 99999)); await p.waitForTimeout(200);
    const bottom = await p.evaluate(() => { const m = document.querySelector('main').getBoundingClientRect(); const v = document.querySelector('main > div').getBoundingClientRect(); return Math.round(m.bottom - v.bottom); });
    pass(bottom <= 0, 'scrolled to the end: still no strip at the bottom (' + bottom + 'px)');
    await p.evaluate(() => document.querySelector('main').scrollTo(0, 0));
    await p.getByRole('group', { name: 'Billing' }).getByRole('button', { name: 'Annual' }).click(); await p.waitForTimeout(200);
    pass(/150[\s ,.]000 F CFA/.test(await text(p)) && /\/ year/.test(await text(p)), 'annual: 10 months (150 000 F CFA / year)');
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await p.close(); }
  for (const [ls, re, label] of [[{ sentria_country: 'NG' }, /20,000 ₦/, 'Nigeria: naira (20,000 ₦)'], [{ sentria_country: 'GH', sentria_currency: 'USD' }, /29 \$/, 'Ghana billing in dollars: 29 $'], [{ sentria_country: 'FR' }, /29 €/, 'France: 29 €'], [{ sentria_country: 'GB' }, /25 £/, 'UK: 25 £'], [{ sentria_country: 'US' }, /29 \$/, 'US: 29 $']]) {
    const p = await open({ ls: { ...ONB, sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', ...ls } });
    await goPricing(p); pass(re.test(await text(p)), label); await p.close(); }
  { const p = await open({ ls: { ...ONB, sentria_country: 'BJ', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie' }, vw: 390 });
    await p.getByRole('button', { name: /menu/i }).first().click(); await p.waitForTimeout(300); await goPricing(p);
    pass(await p.evaluate(() => document.querySelector('main').scrollWidth <= document.querySelector('main').clientWidth + 1), 'phone: no sideways scroll');
    pass(/Your plan/.test(await text(p)), 'Découverte: "Your plan" on its card');
    await p.screenshot({ path: 'pricing-390.png', fullPage: false }); await p.close(); }

  console.log('== dashboard upload respects the plan');
  { const p = await open({ ls: { ...ONB, sentria_sector: 'health', sentria_sectors: '["health","industry"]', sentria_business_type: 'pharmacie', sentria_departments: '{"health":["pharmacie"]}' } });
    const t = await text(p);
    const sectorBtns = await p.evaluate(() => [...document.querySelectorAll('button[aria-pressed]')].map(b => b.innerText.trim()).filter(x => /^(Health|Industry|Santé|Industrie)$/.test(x)));
    pass(!sectorBtns.includes('Industry'), 'Découverte with 2 sectors stored: only Health offered (' + sectorBtns.join(',') + ')');
    const acts = await p.evaluate(() => { const g = document.querySelector('#import-panel [role=group][aria-labelledby=upload-activity-help]'); return g ? [...g.querySelectorAll('button')].map(b => (b.querySelector('.min-w-0 > span') || b).textContent.trim()) : null; });
    pass(acts === null || acts.length <= 1, 'Découverte: upload offers only its department (' + (acts || ['no department step']).join(', ') + ')');
    await p.close(); }
  { const p = await open({ ls: { ...ONB, sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', sentria_departments: '{"health":["pharmacie"]}' }, trialEndsAt: soon });
    const acts = await p.evaluate(() => { const g = document.querySelector('#import-panel [role=group][aria-labelledby=upload-activity-help]'); return g ? [...g.querySelectorAll('button')].map(b => (b.querySelector('.min-w-0 > span') || b).textContent.trim()) : null; });
    pass(acts !== null && acts.length === 3 && !acts.some(a => /wholesal/i.test(a)), 'Business trial: pharmacy + hospital + lab, not the wholesaler (' + (acts || []).join(', ') + ')');
    await p.close(); }
  { const p = await open({ ls: { ...ONB, sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie' }, onUpload: r => r.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ success: false, error_code: 'plan_departments', message: 'Your plan covers one department. Several linked departments: Business plan.' }) }) });
    await p.setInputFiles('input[type=file]', { name: 'x.csv', mimeType: 'text/csv', buffer: Buffer.from('a,b\n1,2\n') }); await p.waitForTimeout(1200);
    pass(/Your plan covers one department/.test(await text(p)), 'API plan refusal (403) shown as its message');
    await p.close(); }

  console.log('== onboarding on the Business trial');
  { const p = await open({ ls: {}, trialEndsAt: soon });
    const next = async () => { await p.getByRole('button', { name: /^Continue/ }).last().click(); await p.waitForTimeout(350); };
    const step = async () => (await p.evaluate(() => { const h = document.querySelector('[role=dialog] h2')?.innerText || document.body.innerText; const keys = [['Your country', '2'], ['Your company', '3'], ['Your sector', '4'], ['Your activity', '5'], ['Your priorities', '6'], ['What do you want to monitor', '6'], ['Your data', '7']]; return (keys.find(([k]) => h.includes(k)) || [])[1]; }));  // old step numbers, found by heading
    let sawNoMulti = false, currencyOk = false;
    for (let i = 0; i < 9; i++) {
      const s = await step();
      if (s === '2') { await p.getByText('Benin', { exact: true }).first().click(); await p.waitForTimeout(200);
        currencyOk = (await p.locator('select[aria-label="Account currency"]').inputValue()) === 'XOF';
        await p.locator('select[aria-label="Account currency"]').selectOption('USD'); }
      if (s === '3') { await p.locator('input').first().fill('Clinique Sud'); }
      if (s === '4') { await p.getByText(/^Health$/).first().click(); await p.waitForTimeout(200);
        const t = await text(p); sawNoMulti = !/My company covers more than one sector/.test(t) && /Several sectors .*: Entreprise plan/.test(t); }
      if (s === '5') {
        const card = n => p.locator('button[aria-pressed]', { hasText: n }).first();
        await card(/Pharmac/).click(); await card(/Clinic|Hospital/).click(); await card(/Lab/).click(); await p.waitForTimeout(200);
        const pressed = async n => (await card(n).getAttribute('aria-pressed')) === 'true';
        pass(await pressed(/Pharmac/) && await pressed(/Clinic|Hospital/) && await pressed(/Lab/), 'pharmacy + clinic + lab ticked together');
        const dim = await card(/Wholesal/).evaluate(e => e.className.includes('opacity-50'));
        pass(dim, 'pharma wholesaler greyed out');
        await card(/Wholesal/).click(); await p.waitForTimeout(200);
        pass(await pressed(/Wholesal/) && !(await pressed(/Pharmac/)), 'clicking the wholesaler replaces the selection');
        await card(/Pharmac/).click(); await card(/Wholesal/).click(); await card(/Lab/).click(); await p.waitForTimeout(150);
        await p.screenshot({ path: 'onb-departments.png' });
        break; }
      await next();
    }
    pass(currencyOk, 'currency defaults to the country (Benin → XOF), can be changed');
    pass(sawNoMulti, 'no "several sectors" switch on the Business trial, Entreprise note instead');
    await p.close(); }
  { const p = await open({ ls: {}, plan: 'decouverte' });
    const next = async () => { await p.getByRole('button', { name: /^Continue/ }).last().click(); await p.waitForTimeout(350); };
    const step = async () => (await p.evaluate(() => { const h = document.querySelector('[role=dialog] h2')?.innerText || document.body.innerText; const keys = [['Your country', '2'], ['Your company', '3'], ['Your sector', '4'], ['Your activity', '5'], ['Your priorities', '6'], ['What do you want to monitor', '6'], ['Your data', '7']]; return (keys.find(([k]) => h.includes(k)) || [])[1]; }));  // old step numbers, found by heading
    for (let i = 0; i < 9; i++) { const s = await step();
      if (s === '2') await p.getByText('Benin', { exact: true }).first().click();
      if (s === '3') await p.locator('input').first().fill('Terminal X');
      if (s === '4') await p.getByText(/^Logistics$/).first().click();
      if (s === '5') { const card = n => p.locator('button[aria-pressed]', { hasText: n }).first();
        await card(/Port/).click(); await card(/Cold chain/).click(); await p.waitForTimeout(150);
        const pressed = async n => (await card(n).getAttribute('aria-pressed')) === 'true';
        pass(!(await pressed(/Port/)) && await pressed(/Cold chain/), 'Découverte, logistics: one department at a time');
        pass(/Several departments that run together: Business plan/.test(await text(p)), 'Découverte: Business note shown');
        break; }
      await next(); }
    await p.close(); }

  await browser.close();
  console.log(`\n${fails ? fails + ' failure(s)' : 'ALL OK'}`); process.exit(fails ? 1 : 0);
})();
