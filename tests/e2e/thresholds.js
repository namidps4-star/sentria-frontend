// P-ADMIN: the Admin page lists the alert thresholds the backend serves
// (GET /admin/thresholds), saves one (PATCH, a number), puts one back to its
// default (PATCH, null), refuses a value that can't be valid before asking the
// API, shows the API's refusal, and says when the table isn't there yet.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const pair = (fr, en) => ({ fr, en });
const ITEM = (o) => ({ help: null, unit: null, integer: false, overridden: false, updated_at: null, updated_by: null, ...o, value: o.default });
const ITEMS = [
  ITEM({ key: 'WHOLESALER_SLOW_SELL_THROUGH', group: 'wholesaler', group_label: pair('Grossiste-répartiteur : stock chez les clients', 'Wholesaler: stock held by customers'),
    label: pair('Écoulement « lent » : part vendue au plus', '"Slow" sell-through: share sold at most'), help: pair('Part des unités expédiées déjà vendues.', 'Share of shipped units already sold.'), min: 0.05, max: 0.95, default: 0.3 }),
  ITEM({ key: 'CHAIN_RECEIVER_COVER_DAYS', group: 'chain', group_label: pair('Chaîne de magasins : transferts de stock', 'Store chain: stock transfers'),
    label: pair('Magasin receveur : jours de vente à retrouver', 'Receiving store: days of sales to get back to'), unit: pair('jours', 'days'), integer: true, min: 1, max: 365, default: 14 }),
  ITEM({ key: 'ENERGY_SURPLUS_MIN_FUEL_PCT', group: 'energy', group_label: pair('Énergie : carburant et charge des groupes', 'Energy: generator fuel and load'),
    label: pair('Surplus : carburant au-dessus de', 'Surplus: fuel above'), unit: pair('%', '%'), integer: true, min: 0, max: 100, default: 60 }),
];
const ACCOUNTS = [{ user_id: 'u-1', email: 'ama@pharma.bj', name: 'Ama Mensah', company_id: 'c1', company_name: 'Pharmacie A', sector: 'health', department: 'pharmacie', country: 'BJ', onboarded: true, plan: 'decouverte', effective_plan: 'decouverte', trial_ends_at: null, is_admin: false, created_at: '2026-09-20T10:00:00Z', alerts: 12 }];

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async ({ persisted = true, getFails = false, refuse = null, lang = 'en', theme = 'light', vw = 1440 } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: 900 }, locale: lang === 'fr' ? 'fr-FR' : 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message)); p._patches = [];
    const items = ITEMS.map(i => ({ ...i }));
    await p.route(/onrender\.com\//, r => {
      const u = new URL(r.request().url()); const req = r.request();
      if (u.pathname === '/admin/accounts') return json(r, { accounts: ACCOUNTS });
      if (u.pathname === '/admin/thresholds') return getFails ? json(r, { detail: { error_code: 'x', message: 'Database unreachable' } }, 503) : json(r, { thresholds: items, persisted });
      if (u.pathname.startsWith('/admin/thresholds/')) {
        const key = decodeURIComponent(u.pathname.split('/').pop()); const body = JSON.parse(req.postData());
        p._patches.push({ key, body, auth: req.headers()['authorization'], method: req.method() });
        if (refuse) return json(r, { detail: { error_code: 'threshold_conflict', message: refuse } }, 400);
        const t = items.find(i => i.key === key);
        t.overridden = body.value !== null; t.value = body.value === null ? t.default : body.value; t.updated_at = '2026-10-01T10:00:00Z';
        return json(r, { threshold: t });
      }
      return json(r, u.pathname === '/alerts' ? [] : { recommendations: [], assignments: [], contractors: [] });
    });
    await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } },
      { sentria_onboarded: 'true', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', sentria_language: lang, sentria_theme: theme });
    await signedIn(p, 'u-me', 'boss@sentria.app', { plan: 'decouverte', isAdmin: true });
    await p.goto(APP_URL); await p.waitForTimeout(1800);
    if (vw < 768) { await p.getByRole('button', { name: /open.*(menu|navigation)/i }).first().click(); await p.waitForTimeout(400); }
    await p.locator('aside nav button', { hasText: /^Admin$/ }).locator('visible=true').first().click(); await p.waitForTimeout(1200);
    return { p, ctx };
  };
  const panel = p => p.locator('[data-testid="admin-thresholds"]');
  const field = (p, key) => p.locator(`#threshold-${key}`);
  const row = (p, key) => p.locator('li').filter({ has: p.locator(`#threshold-${key}`) });
  const save = (p, key) => row(p, key).getByRole('button', { name: /^(Save|Enregistrer)$/ });

  console.log('== the list');
  { const { p, ctx } = await open();
    const t = await panel(p).innerText();
    pass(/Alert thresholds/.test(t), 'a "Alert thresholds" card is on the Admin page');
    pass(/Wholesaler: stock held by customers/i.test(t) && /Store chain: stock transfers/i.test(t) && /Energy: generator fuel and load/i.test(t), 'one section per group (headings are upper-cased by CSS)');
    pass(await field(p, 'ENERGY_SURPLUS_MIN_FUEL_PCT').inputValue() === '60' && await field(p, 'WHOLESALER_SLOW_SELL_THROUGH').inputValue() === '0.3', 'each input shows its current value (the default)');
    pass(/Default: 60 % · 0–100/.test(t) && /Default: 14 days · 1–365/.test(t) && /Share of shipped units already sold/.test(t), 'default, range, unit and help are shown');
    pass(!/Modified/.test(t), 'nothing is marked Modified');
    pass(await save(p, 'ENERGY_SURPLUS_MIN_FUEL_PCT').isDisabled(), 'Save is off until something changes');
    pass(/Pharmacie A/.test(await p.locator('main').innerText()), 'the accounts table is still there');
    await p.screenshot({ path: 'thresholds-light.png', fullPage: true });

    console.log('== save one');
    await field(p, 'ENERGY_SURPLUS_MIN_FUEL_PCT').fill('40'); await p.waitForTimeout(150);
    pass(await save(p, 'ENERGY_SURPLUS_MIN_FUEL_PCT').isEnabled(), 'Save turns on');
    await save(p, 'ENERGY_SURPLUS_MIN_FUEL_PCT').click(); await p.waitForTimeout(500);
    const sent = p._patches.at(-1);
    pass(sent && sent.method === 'PATCH' && sent.key === 'ENERGY_SURPLUS_MIN_FUEL_PCT' && sent.body.value === 40 && typeof sent.body.value === 'number', 'PATCH /admin/thresholds/ENERGY_SURPLUS_MIN_FUEL_PCT with {value: 40} (a number)');
    pass(/^Bearer /.test(sent?.auth || ''), 'sent with the user\'s token');
    pass(/Modified/.test(await row(p, 'ENERGY_SURPLUS_MIN_FUEL_PCT').innerText()) && await row(p, 'ENERGY_SURPLUS_MIN_FUEL_PCT').getByRole('button', { name: 'Reset' }).count() === 1, 'the row is marked Modified and offers Reset');
    pass(/saved, applied from the next upload/.test(await panel(p).innerText()), 'it says it applies from the next upload');
    pass(await save(p, 'ENERGY_SURPLUS_MIN_FUEL_PCT').isDisabled() && await field(p, 'ENERGY_SURPLUS_MIN_FUEL_PCT').inputValue() === '40', 'Save is off again, 40 kept');
    const others = (await panel(p).innerText()).match(/Modified/g) || [];
    pass(others.length === 1, 'only that row is Modified');

    console.log('== a decimal one');
    await field(p, 'WHOLESALER_SLOW_SELL_THROUGH').fill('0.45'); await save(p, 'WHOLESALER_SLOW_SELL_THROUGH').click(); await p.waitForTimeout(400);
    pass(p._patches.at(-1).body.value === 0.45, 'a decimal is sent as 0.45');

    console.log('== reset to the default');
    await row(p, 'ENERGY_SURPLUS_MIN_FUEL_PCT').getByRole('button', { name: 'Reset' }).click(); await p.waitForTimeout(500);
    pass(p._patches.at(-1).key === 'ENERGY_SURPLUS_MIN_FUEL_PCT' && p._patches.at(-1).body.value === null, 'Reset sends {value: null}');
    pass(await field(p, 'ENERGY_SURPLUS_MIN_FUEL_PCT').inputValue() === '60' && !/Modified/.test(await row(p, 'ENERGY_SURPLUS_MIN_FUEL_PCT').innerText()), 'back to 60, no longer Modified');

    console.log('== values that can\'t be valid never leave the page');
    const before = p._patches.length;
    for (const [key, bad, why] of [['ENERGY_SURPLUS_MIN_FUEL_PCT', '150', 'above the range'], ['ENERGY_SURPLUS_MIN_FUEL_PCT', '-5', 'below the range'], ['ENERGY_SURPLUS_MIN_FUEL_PCT', '40.5', 'not whole'], ['ENERGY_SURPLUS_MIN_FUEL_PCT', '', 'empty'], ['WHOLESALER_SLOW_SELL_THROUGH', '0', 'under the minimum']]) {
      await field(p, key).fill(bad); await p.waitForTimeout(100);
      pass(await save(p, key).isDisabled(), `"${bad}" (${why}): Save stays off`);
    }
    await field(p, 'ENERGY_SURPLUS_MIN_FUEL_PCT').fill('150'); await p.waitForTimeout(100);
    pass(await field(p, 'ENERGY_SURPLUS_MIN_FUEL_PCT').getAttribute('aria-invalid') === 'true', 'the field is marked invalid');
    pass(p._patches.length === before, 'no request was sent');
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== the API refuses (two related thresholds would overlap)');
  { const { p, ctx } = await open({ refuse: 'ENERGY_SURPLUS_MIN_FUEL_PCT must stay above ENERGY_SHORTAGE_MAX_FUEL_PCT.' });
    await field(p, 'ENERGY_SURPLUS_MIN_FUEL_PCT').fill('20'); await save(p, 'ENERGY_SURPLUS_MIN_FUEL_PCT').click(); await p.waitForTimeout(500);
    const t = await panel(p).innerText();
    pass(/Failed: ENERGY_SURPLUS_MIN_FUEL_PCT must stay above ENERGY_SHORTAGE_MAX_FUEL_PCT/.test(t), 'the API\'s message is shown');
    pass(!/Modified/.test(t), 'the row is not marked Modified');
    pass(await field(p, 'ENERGY_SURPLUS_MIN_FUEL_PCT').inputValue() === '20', 'what was typed is kept, to correct it');
    await ctx.close(); }

  console.log('== migration 011 not run yet');
  { const { p, ctx } = await open({ persisted: false });
    pass(/migration 011/.test(await panel(p).innerText()), 'a notice names migration 011');
    pass(await field(p, 'ENERGY_SURPLUS_MIN_FUEL_PCT').isDisabled() && await field(p, 'ENERGY_SURPLUS_MIN_FUEL_PCT').inputValue() === '60', 'the defaults are shown, and can\'t be edited');
    await ctx.close(); }

  console.log('== the thresholds can\'t load');
  { const { p, ctx } = await open({ getFails: true });
    pass(/Database unreachable/.test(await panel(p).innerText()), 'the error is shown in the card');
    pass(/Pharmacie A/.test(await p.locator('main').innerText()), 'the rest of the Admin page still works');
    await ctx.close(); }

  console.log('== French');
  { const { p, ctx } = await open({ lang: 'fr' });
    const t = await panel(p).innerText();
    pass(/Seuils d'alerte/.test(t) && /Énergie : carburant et charge des groupes/i.test(t) && /Par défaut : 60 %/.test(t), 'title, group and default line in French');
    await field(p, 'ENERGY_SURPLUS_MIN_FUEL_PCT').fill('40');
    pass(await save(p, 'ENERGY_SURPLUS_MIN_FUEL_PCT').count() === 1, 'the button reads Enregistrer');
    await save(p, 'ENERGY_SURPLUS_MIN_FUEL_PCT').click(); await p.waitForTimeout(500);
    pass(/Modifié/.test(await panel(p).innerText()) && /appliqué dès le prochain upload/.test(await panel(p).innerText()), 'Modifié, and the notice in French');
    await ctx.close(); }

  console.log('== dark and phone');
  { const { p, ctx } = await open({ theme: 'dark' });
    await field(p, 'ENERGY_SURPLUS_MIN_FUEL_PCT').fill('40'); await save(p, 'ENERGY_SURPLUS_MIN_FUEL_PCT').click(); await p.waitForTimeout(400);
    pass(/Modified/.test(await panel(p).innerText()), 'dark: works'); await p.screenshot({ path: 'thresholds-dark.png', fullPage: true }); await ctx.close(); }
  { const { p, ctx } = await open({ vw: 390 });
    await panel(p).scrollIntoViewIfNeeded();
    pass(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), '390 px: no sideways page scroll');
    const fits = await p.evaluate(() => [...document.querySelectorAll('[data-testid="admin-thresholds"] input, [data-testid="admin-thresholds"] button')].every(e => { const b = e.getBoundingClientRect(); return b.width === 0 || (b.left >= 0 && b.right <= innerWidth + 1); }));
    pass(fits, '390 px: every input and button is inside the screen');
    await field(p, 'ENERGY_SURPLUS_MIN_FUEL_PCT').fill('40'); await save(p, 'ENERGY_SURPLUS_MIN_FUEL_PCT').click(); await p.waitForTimeout(400);
    pass(/Modified/.test(await panel(p).innerText()), '390 px: saving works');
    await p.screenshot({ path: 'thresholds-390.png', fullPage: true }); await ctx.close(); }

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL OK'); process.exit(fails ? 1 : 0);
})();
