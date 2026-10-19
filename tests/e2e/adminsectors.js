// Admin accounts: an account that runs several sectors shows all of them under Activity, each with its own
// activities; an account from before the sector list (no `sectors` from the API) still shows its one sector;
// one that has not finished setup says so. French, dark and 390 px.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const json = (r, body) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

const base = { name: null, onboarded: true, plan: 'entreprise', effective_plan: 'entreprise', trial_ends_at: null, is_admin: false, created_at: '2026-09-20T10:00:00Z', alerts: 4, country: 'BJ' };
const ACCOUNTS = [
  { ...base, user_id: 'u-1', email: 'atlas@group.bj', company_id: 'c1', company_name: 'Groupe Atlas', sector: 'health', department: 'pharmacie',
    sectors: [{ sector: 'health', departments: ['pharmacie', 'veterinaire'] }, { sector: 'agriculture', departments: ['cooperative-agricole'] }, { sector: 'energy', departments: [] }] },
  { ...base, user_id: 'u-2', email: 'old@pharma.bj', company_id: 'c2', company_name: 'Pharmacie Ancienne', plan: 'decouverte', effective_plan: 'decouverte', sector: 'health', department: 'pharmacie' },
  { ...base, user_id: 'u-me', email: 'boss@sentria.app', company_id: 'c0', company_name: 'SentrIA', onboarded: false, sector: null, department: null, sectors: [], is_admin: true },
];

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async ({ lang = 'en', theme = 'light', vw = 1440 } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: 1000 }, locale: lang === 'fr' ? 'fr-FR' : 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    await p.route(/onrender\.com\//, r => { const u = new URL(r.request().url());
      if (u.pathname === '/admin/accounts') return json(r, { accounts: ACCOUNTS });
      if (u.pathname === '/admin/guard') return json(r, { enabled: true, forced_off: false, persisted: true, log: [] });
      return json(r, u.pathname === '/alerts' ? [] : { recommendations: [], assignments: [], contractors: [] }); });
    await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } },
      { sentria_onboarded: 'true', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', sentria_language: lang, sentria_theme: theme });
    await signedIn(p, 'u-me', 'boss@sentria.app', { plan: 'decouverte', isAdmin: true });
    await p.goto(APP_URL); await p.waitForTimeout(1800);
    if (vw < 768) { await p.getByRole('button', { name: /open.*(menu|navigation)/i }).first().click(); await p.waitForTimeout(400); }
    await p.locator('aside nav button', { hasText: /^Admin$/ }).locator('visible=true').first().click(); await p.waitForTimeout(1200);
    return { p, ctx };
  };
  const row = (p, name) => p.locator('tbody tr', { hasText: name });

  console.log('== several sectors under one account');
  { const { p, ctx } = await open();
    const atlas = row(p, 'Groupe Atlas');
    pass(await atlas.getByTestId('account-sector').count() === 3, 'Groupe Atlas: three sectors listed under it');
    const t = (await atlas.innerText()).replace(/\s+/g, ' ');
    pass(/Health/.test(t) && /Agriculture/.test(t) && /Energy/.test(t), 'each sector is named: ' + t.slice(0, 160));
    pass(/Pharmacy, Veterinary/.test(t), 'a sector with two activities lists both');
    pass(await atlas.getByTestId('account-sector').nth(2).innerText().then(x => /—/.test(x)), 'a sector with no activity yet shows a dash');
    pass(await row(p, 'Pharmacie Ancienne').getByTestId('account-sector').count() === 1, 'an account with one sector shows one');
    pass(/Pharmacy/.test(await row(p, 'Pharmacie Ancienne').innerText()), 'an older account (no list from the API) still shows its sector and activity');
    pass(/Not onboarded/.test(await row(p, 'SentrIA').innerText()) && await row(p, 'SentrIA').getByTestId('account-sector').count() === 0, 'an account that has not finished setup says so');
    await p.locator('main input[type=search]').fill('agriculture'); await p.waitForTimeout(250);
    pass(await p.locator('tbody tr').count() === 1 && /Groupe Atlas/.test(await p.locator('tbody').innerText()), 'searching a second sector finds the account');
    await p.locator('main input[type=search]').fill('veterinaire'); await p.waitForTimeout(250);
    pass(await p.locator('tbody tr').count() === 1, 'searching an activity of a second sector finds the account');
    await p.locator('main input[type=search]').fill(''); await p.waitForTimeout(250);
    await atlas.scrollIntoViewIfNeeded(); await p.screenshot({ path: 'adminsectors-light.png' });
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== French, dark');
  { const { p, ctx } = await open({ lang: 'fr', theme: 'dark' });
    const t = (await row(p, 'Groupe Atlas').innerText()).replace(/\s+/g, ' ');
    pass(/Santé/.test(t) && /Agriculture/.test(t) && /Énergie/.test(t), 'French sector names: ' + t.slice(0, 120));
    await p.screenshot({ path: 'adminsectors-fr-dark.png' });
    await ctx.close(); }

  console.log('== 390 px');
  { const { p, ctx } = await open({ vw: 390 });
    pass(await p.getByTestId('account-sector').count() >= 3, 'the sectors are still there');
    pass(!(await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), 'no sideways page scroll');
    await p.screenshot({ path: 'adminsectors-390.png' });
    await ctx.close(); }

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL OK');
  process.exit(fails ? 1 : 0);
})();
