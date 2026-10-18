// A stock alert can name who to order from (columns supplier, supplier_phone, supplier_email).
// Checks: Call, Text and Email links in the opened alert and the recommendation popup; only the
// contacts that exist; nothing without a supplier; unsafe phone or email never become links; the
// import hint for health and retail and not industry; French, dark and a phone.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn, mockSupabase, session, STORAGE_KEY } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };

const now = new Date().toISOString();
const P = (name, phone, email) => [['stock', 50], ['order_from', name], ...(phone ? [['order_phone', phone]] : []), ...(email ? [['order_email', email]] : [])];
const rec = (eq, key, supplier) => ({ equipment: eq, sector: 'health', business_type: 'pharmacie', severity: 'CRITICAL', date: now, message: `MSG ${eq}`, alert_key: key, recommended_action: `ACT ${eq}`, action_category: 'stock', confidence: 0.8, ...(supplier ? { supplier } : {}) });
const alertOf = (eq, params) => ({ id: eq, equipment: eq, sector: 'health', business_type: 'pharmacie', severity: 'CRITICAL', date: now, alert_key: 'health.stock.critical_low', message: `MSG ${eq}`, risk_score: 70, params });

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async ({ params, supplier, lang = 'en', theme = 'light', vw = 1440, popup = false } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vw < 500 ? 844 : 1000 }, locale: lang === 'fr' ? 'fr-FR' : 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    await p.route(/\/alerts(\?|$)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([alertOf('Amoxicillin', params)]) }));
    await p.route(/\/recommendations/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ recommendations: [rec('Amoxicillin', 'health.stock.critical_low', supplier)] }) }));
    await p.route(/\/(contractors|assignments)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"contractors":[],"assignments":[]}' }));
    const store = { sentria_onboarded: '1', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', sentria_language: lang, sentria_company_name: 'Acme', sentria_theme: theme };
    await p.addInitScript(s => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); } }, store);
    await signedIn(p); await p.goto(APP_URL, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
    await p.locator('tbody tr').first().click(); await p.waitForTimeout(500);
    if (popup) { await p.getByRole('button', { name: lang === 'fr' ? /Voir la recommandation/ : /See the recommendation/ }).first().click(); await p.waitForTimeout(700); }
    return { p, ctx };
  };
  const hrefs = async p => ({
    call: await p.getByTestId('supplier-call').last().getAttribute('href').catch(() => null),
    text: await p.getByTestId('supplier-text').last().getAttribute('href').catch(() => null),
    email: await p.getByTestId('supplier-email').last().getAttribute('href').catch(() => null),
  });

  console.log('== opened alert, full contact');
  { const { p, ctx } = await open({ params: P('Pharma Plus', '+22997123456', 'order@pharma.test') });
    const h = await hrefs(p);
    pass(h.call === 'tel:+22997123456' && h.text === 'sms:+22997123456' && h.email === 'mailto:order@pharma.test', 'Call, Text and Email links ' + JSON.stringify(h));
    pass((await p.getByTestId('supplier-name').last().innerText()).includes('Pharma Plus'), 'the supplier name shows');
    await p.getByTestId('supplier-actions').last().scrollIntoViewIfNeeded(); await p.screenshot({ path: 'supplier-detail-light.png' });
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== only the contacts that exist');
  { const { p, ctx } = await open({ params: P('Pharma Plus', '+22997123456', null) });
    const h = await hrefs(p);
    pass(h.call && h.text && !h.email, 'phone only: Call and Text, no Email');
    await ctx.close(); }
  { const { p, ctx } = await open({ params: P('Pharma Plus', null, 'order@pharma.test') });
    const h = await hrefs(p);
    pass(!h.call && !h.text && h.email, 'email only: Email, no Call or Text');
    await ctx.close(); }

  console.log('== no supplier, nothing');
  { const { p, ctx } = await open({ params: [['stock', 50]] });
    pass(await p.getByTestId('supplier-actions').count() === 0, 'no supplier means no block');
    await ctx.close(); }

  console.log('== unsafe contacts never become links');
  { const { p, ctx } = await open({ params: P('Pharma Plus', 'javascript:alert(1)', 'x@y') });
    pass(await p.getByTestId('supplier-actions').count() > 0 && await p.getByTestId('supplier-call').count() === 0 && await p.getByTestId('supplier-email').count() === 0, 'bad phone and email are dropped, the name stays');
    await ctx.close(); }

  console.log('== recommendation popup');
  { const { p, ctx } = await open({ params: [['stock', 50]], supplier: { name: 'Pharma Plus', phone: '+22997123456', email: null }, popup: true });
    const d = p.locator('[aria-labelledby=recommendation-dialog-title]');
    pass(await d.getByTestId('supplier-call').count() === 1 && await d.getByTestId('supplier-email').count() === 0, 'the popup shows the API supplier');
    await p.screenshot({ path: 'supplier-popup-light.png' });
    await ctx.close(); }

  console.log('== French, dark, phone');
  { const { p, ctx } = await open({ params: P('Pharma Plus', '+22997123456', 'order@pharma.test'), lang: 'fr', theme: 'dark', vw: 390 });
    const t = await p.getByTestId('supplier-actions').last().innerText();
    pass(/Fournisseur/.test(t) && /Appeler/.test(t) && /SMS/.test(t) && /E-mail/.test(t), 'French labels: ' + t.replace(/\s+/g, ' '));
    pass(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll at 390 px');
    await p.getByTestId('supplier-actions').last().scrollIntoViewIfNeeded(); await p.screenshot({ path: 'supplier-390-dark-fr.png' });
    await ctx.close(); }

  console.log('== import hint');
  const UID = 'u-sup', EMAIL = 'a@b.c';
  for (const [sector, business, want] of [['health', 'pharmacie', true], ['commerce', 'boutique', true], ['industry', 'usine', false]]) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    await p.route(/onrender\.com\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    const profile = { sentria_onboarded: '1', sentria_sector: sector, sentria_sectors: JSON.stringify([sector]), sentria_business_type: business, sentria_company_name: 'Acme', sentria_language: 'en' };
    await mockSupabase(p, { users: { [EMAIL]: { uid: UID, password: 'x' } }, accounts: { [UID]: { profile, plan: 'entreprise' } } }, { plan: 'entreprise' });
    await p.addInitScript(({ key, s }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(s)); }, { key: STORAGE_KEY, s: session(UID, EMAIL, {}) });
    await p.goto(APP_URL); await p.waitForTimeout(3000);
    await p.getByRole('button', { name: 'Import data' }).click(); await p.waitForTimeout(500);
    const shown = await p.locator('[data-supplier-columns]').count() > 0;
    pass(shown === want, `${sector}: supplier columns hint ${want ? 'shown' : 'hidden'}`);
    if (want && sector === 'health') await p.screenshot({ path: 'supplier-import-light.png' });
    await ctx.close();
  }

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exit(fails ? 1 : 0);
})();
