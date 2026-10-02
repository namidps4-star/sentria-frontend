// F-SECTORTAG: the "Live" / "En direct" badges are gone. Where each one sat
// there is now a lime tag with the account's real sector. This checks every
// page that had one, French and English, one sector and two, a change of
// sector with no reload, an account with no sector, dark mode and a phone.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };

// Sidebar position, so the French labels do not matter.
const PAGES = [['Dashboard', 0], ['Tracking', 1], ['Calendar', 2], ['Field team', 4], ['Ask SentrIA', 5], ['Profile', 8]];
const REC = { equipment: 'Doliprane', sector: 'health', business_type: 'pharmacie', severity: 'CRITICAL', date: new Date().toISOString(), message: 'MSG Doliprane', alert_key: 'health.stock.low', recommended_action: 'ACT Doliprane', action_category: 'stock', confidence: 0.8, risk_score: null };
const tag = p => p.locator('[data-testid="sector-tag"]').locator('visible=true');
const oldBadges = p => p.evaluate(() => [...document.querySelectorAll('span.rounded-full')]
  .filter(e => e.offsetParent && /^(Live|En direct|Temps réel)$/.test(e.innerText.trim())).length);

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async ({ sectors = ['health'], lang = 'en', theme = 'light', vw = 1440, page = 'Dashboard', plan = 'business' } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: 900 }, locale: lang === 'fr' ? 'fr-FR' : 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    // One recommendation and one contractor, so the board and the team page draw their stats card.
    const json = body => r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    await p.route(/\/alerts(\?|$)/, json([]));
    await p.route(/\/recommendations/, json({ recommendations: [REC] }));
    await p.route(/\/contractors/, json({ contractors: [{ id: 'c1', name: 'Awa Diop', availability: 'available', open_assignments: 0, active: true, role: null, phone: null, note: null }] }));
    await p.route(/\/assignments/, json({ assignments: [] }));
    await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } },
      { sentria_onboarded: 'true', sentria_company_name: 'Acme', sentria_sector: sectors[0] || '', sentria_sectors: JSON.stringify(sectors), sentria_language: lang, sentria_theme: theme });
    await signedIn(p, 'u-1', 'ama@acme.test', { plan });
    await p.goto(APP_URL); await p.waitForTimeout(2000);
    await go(p, page, vw);
    return { p, ctx };
  };
  const go = async (p, name, vw = 1440) => {
    const index = PAGES.find(x => x[0] === name)[1];
    if (vw < 768) { await p.getByRole('button', { name: /open.*(menu|navigation)|ouvrir.*(menu|navigation)/i }).first().click().catch(() => {}); await p.waitForTimeout(300); }
    await p.locator('aside nav button').locator('visible=true').nth(index).click();
    await p.waitForTimeout(900);
  };
  const accent = p => p.evaluate(() => { const e = document.createElement('i'); e.style.background = 'var(--accent)'; document.body.appendChild(e); const c = getComputedStyle(e).backgroundColor; e.remove(); return c; });
  const bg = el => el.evaluate(e => getComputedStyle(e).backgroundColor);

  console.log('== every page that had a Live badge shows the sector instead');
  for (const [name] of PAGES) {
    const { p, ctx } = await open({ page: name });
    const n = await tag(p).count();
    pass(n >= 1 && (await tag(p).first().innerText()).trim() === 'Health', `${name}: a tag reads "Health" (${n} found)`);
    pass(await bg(tag(p).first()) === await accent(p), `${name}: it is the lime accent`);
    pass(await oldBadges(p) === 0, `${name}: no "Live" / "En direct" / "Temps réel" badge left`);
    pass(p._errors.length === 0, `${name}: no page errors ${p._errors.join('|')}`);
    if (name === 'Dashboard') {
      const hero = (await p.locator('div.rounded-3xl').filter({ has: p.locator('[data-testid="sector-tag"]') }).first().innerText()).replace(/\s+/g, ' ');
      pass(!/Health.*Health/.test(hero.slice(0, 40)), `Dashboard: the sector is not said twice in the banner ("${hero.slice(0, 24)}")`);
      await p.screenshot({ path: 'sectortag-dashboard-light.png' });
    }
    if (name === 'Ask SentrIA') await p.screenshot({ path: 'sectortag-ask-light.png' });
    await ctx.close();
  }

  console.log('== French, and two sectors');
  { const { p, ctx } = await open({ lang: 'fr', page: 'Profile' });
    pass((await tag(p).first().innerText()).trim() === 'Santé', 'French: "Santé"'); await ctx.close(); }
  { const { p, ctx } = await open({ sectors: ['health', 'industry'], page: 'Profile', plan: 'entreprise' }); // Business holds one sector
    { const t = (await tag(p).first().innerText()).trim(); pass(t === "Health + Industry", `two sectors: "Health + Industry" (got ${JSON.stringify(t)})`); }
    pass(await p.evaluate(() => { const t = document.querySelector('[data-testid="sector-tag"]').getBoundingClientRect(); return t.right <= window.innerWidth; }), 'and it fits');
    await ctx.close(); }

  console.log('== it follows a change of sector, no reload');
  { const { p, ctx } = await open({ page: 'Profile' });
    pass(await tag(p).first().locator('> span').evaluate(el => !el.classList.contains('t-rise-in')), 'showing the tag for the first time does not animate it');
    await p.evaluate(() => { localStorage.setItem('sentria_sectors', '["industry"]'); localStorage.setItem('sentria_sector', 'industry'); window.dispatchEvent(new Event('sentria_sectors_updated')); });
    await p.waitForTimeout(60);
    const swap = await tag(p).first().locator('> span').evaluate(el => ({ cls: el.classList.contains('t-rise-in'), anim: getComputedStyle(el).animationName, dur: getComputedStyle(el).animationDuration }));
    pass(swap.cls && swap.anim === 't-rise-in' && parseFloat(swap.dur) * (/ms$/.test(swap.dur) ? 1 : 1000) <= 250, `a new sector rises in (${swap.anim}, ${swap.dur}), inside the 250 ms budget`);
    await p.waitForTimeout(400);
    pass((await tag(p).first().innerText()).trim() === 'Industry', 'health -> industry');
    await ctx.close(); }

  console.log('== an account with no sector yet shows no tag, and no broken badge');
  { const { p, ctx } = await open({ sectors: [], page: 'Profile' });
    pass(await tag(p).count() === 0, 'no tag');
    pass(await oldBadges(p) === 0 && p._errors.length === 0, `no old badge, no page errors ${p._errors.join('|')}`);
    await ctx.close(); }

  console.log('== dark and a phone');
  { const { p, ctx } = await open({ theme: 'dark', page: 'Ask SentrIA' });
    pass(await bg(tag(p).first()) === await accent(p), 'dark: still the lime accent');
    await p.screenshot({ path: 'sectortag-ask-dark.png' }); await ctx.close(); }
  for (const [name] of [['Dashboard'], ['Profile'], ['Tracking']]) {
    const { p, ctx } = await open({ vw: 390, page: name });
    const n = await tag(p).count();
    pass(n >= 1, `390 px, ${name}: the tag is shown`);
    pass(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `390 px, ${name}: no sideways scroll`);
    pass(await p.evaluate(() => { const t = document.querySelector('[data-testid="sector-tag"]'); if (!t) return false; const r = t.getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth; }), `390 px, ${name}: inside the screen`);
    if (name === 'Dashboard') await p.screenshot({ path: 'sectortag-dashboard-390.png' });
    await ctx.close();
  }

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL OK'); process.exit(fails ? 1 : 0);
})();
