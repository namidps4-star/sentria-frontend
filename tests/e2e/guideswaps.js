// Robo explains the newer features like the older ones: the Branch swaps menu row (only where a swap exists, on a phone too),
// the pharmacy chapters of Tracking and Sites, and the Report as a story with a second tab. English, French, 390 px.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const now = Date.now();
const iso = d => new Date(now - d * 86400000).toISOString();
const dayAhead = n => new Date(now + n * 864e5).toISOString().slice(0, 10);
const STOCK = { id: 'a1', equipment: 'Doliprane', sector: 'health', business_type: 'pharmacie', severity: 'CRITICAL', date: iso(0), alert_key: 'health.stock.critical_low', message: 'MSG', risk_score: 60, params: [] };
const SWAP = { id: 's1', equipment: 'Amoxicillin 250mg · Nairobi -> Mombasa', sector: 'health', business_type: 'pharmacie', severity: 'WARNING', date: iso(0), alert_key: 'health.branch.swap', message: 'MSG', risk_score: null,
  params: [['product', 'Amoxicillin 250mg'], ['qty', 20], ['from_site', 'Nairobi'], ['to_site', 'Mombasa'], ['days', 20], ['expiry', dayAhead(20)], ['value', 7600], ['currency', 'KES']] };
const PROFILES = {
  pharmacy: { sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie' },
  logistics: { sentria_sector: 'logistics', sentria_sectors: '["logistics"]', sentria_business_type: 'port-conteneurs', sentria_ops_types: '["port"]', sentria_ops_type: 'port', sentria_departments: '{"logistics":["port-conteneurs"]}', sentria_equipment: '["blockages","wait","cost","anticipate","recommend"]' },
};

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async ({ lang = 'en', vw = 1440, vh = 900, done = false, swap = true, profile = 'pharmacy' } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, locale: lang === 'fr' ? 'fr-FR' : 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    await p.route(/onrender\.com\//, r => { const path = new URL(r.request().url()).pathname;
      return json(r, path === '/alerts' ? (swap ? [STOCK, SWAP] : [STOCK]) : path === '/recommendations' ? { recommendations: [] } : path === '/reports/weekly' ? { alerts: 2, critical: 1, warning: 1, previous_alerts: 0, delta: 2, trend: 'up', resolved: 0, top_offender: null } : { recommendations: [], assignments: [], contractors: [] }); });
    await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } },
      { sentria_onboarded: 'true', ...PROFILES[profile], sentria_language: lang, sentria_theme: 'light', ...(done ? { sentria_guide_done: '1' } : {}) });
    await signedIn(p, 'u-me', 'boss@sentria.app', { plan: 'business', isAdmin: false });
    await p.goto(APP_URL); await p.waitForTimeout(1800);
    return { p, ctx };
  };
  const tour = p => p.locator('[data-testid="guide-buddy"]');
  const startTour = async p => {
    if (p.viewportSize().width < 768) { await p.getByRole('button', { name: /open.*(menu|navigation)/i }).first().click(); await p.waitForTimeout(400); }
    await p.locator('[data-support-open]').locator('visible=true').first().click(); await p.waitForTimeout(500);
    await p.locator('[data-tour-open]').click(); await p.waitForTimeout(900);
  };
  const next = async p => { await p.getByRole('button', { name: /^(Next|Suivant|Done|Terminer)$/ }).click(); await p.waitForTimeout(650); };
  const walk = async (p, onStep) => { const seen = []; for (let i = 0; i < 14; i++) { if (!(await tour(p).count())) break; const id = await tour(p).getAttribute('data-step'); seen.push(id); if (onStep) await onStep(id); await next(p); } return seen; };
  const parts = p => p.getByTestId('guide-part');

  console.log('== the menu tour names Branch swaps when the row is there');
  { const { p, ctx } = await open();
    await startTour(p);
    const seen = await walk(p, async id => {
      if (id === 'swaps') {
        const text = (await tour(p).innerText()).replace(/\s+/g, ' ');
        pass(/Branch swaps/.test(text) && /still wait for someone/.test(text) && /Amoxicillin/.test(text) && /Got it, on my way/.test(text), 'it says what it is, what the number means, and gives an example: ' + text.slice(0, 120));
        const ring = await p.locator('[data-testid="guide-ring"]').boundingBox();
        const row = await p.locator('aside [data-nav="swaps"]').locator('visible=true').first().boundingBox();
        pass(!!ring && Math.abs(ring.y - row.y) < 6 && ring.width >= row.width, 'the ring sits on the Branch swaps row');
        await p.screenshot({ path: 'guideswaps-light.png' });
      }
      if (id === 'report') pass(/second tab/.test(await tour(p).innerText()) && /told on one page/.test(await tour(p).innerText()), 'the Report step says it is a story with the figures on a second tab');
    });
    pass(seen.indexOf('tracking') < seen.indexOf('swaps') && seen.indexOf('swaps') < seen.indexOf('sites'), 'the swaps step comes after Tracking and before Sites: ' + seen.join(','));
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== no swap, no step');
  { const { p, ctx } = await open({ swap: false });
    await startTour(p);
    const seen = await walk(p);
    pass(!seen.includes('swaps') && seen.length === 8, 'the tour never points at a row that is not there: ' + seen.join(','));
    await ctx.close(); }

  console.log('== on a phone too');
  { const { p, ctx } = await open({ vw: 390, vh: 800, swap: false });
    await startTour(p);
    const seen = await walk(p);
    pass(!seen.includes('swaps'), 'a phone with no swap does not hear about a row it does not have: ' + seen.join(','));
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }
  { const { p, ctx } = await open({ vw: 390, vh: 800 });
    await startTour(p);
    const seen = await walk(p);
    pass(seen.includes('swaps'), 'and with a swap it does: ' + seen.join(','));
    await ctx.close(); }

  console.log('== the pharmacy chapters of Tracking and Sites');
  { const { p, ctx } = await open({ done: true });
    await startTour(p);
    await parts(p).nth(3).click(); await p.waitForTimeout(900);
    const track = await walk(p);
    pass(track.join() === 'part-tracking-board,part-tracking-owner,part-tracking-outcome,part-tracking-swaps', 'Tracking has a fourth step for a pharmacy: ' + track.join());
    await startTour(p);
    await parts(p).nth(4).click(); await p.waitForTimeout(900);
    const sites = []; let swapsText = '';
    for (let i = 0; i < 6; i++) { if (!(await tour(p).count())) break; const id = await tour(p).getAttribute('data-step'); sites.push(id); if (id === 'part-sites-swaps') swapsText = (await tour(p).innerText()).replace(/\s+/g, ' '); await next(p); }
    pass(sites.includes('part-sites-swaps') && /each pharmacy's stock file on its own site/.test(swapsText) && /at least two sites/.test(swapsText), 'Sites says to import each pharmacy on its own site, and that it needs two: ' + swapsText.slice(0, 110));
    await ctx.close(); }
  { const { p, ctx } = await open({ done: true, profile: 'logistics', swap: false });
    await startTour(p);
    await parts(p).nth(3).click(); await p.waitForTimeout(900);
    const track = await walk(p);
    pass(!track.includes('part-tracking-swaps'), 'a logistics account hears nothing about pharmacies: ' + track.join(','));
    await ctx.close(); }

  console.log('== French');
  { const { p, ctx } = await open({ lang: 'fr' });
    await startTour(p);
    await walk(p, async id => {
      if (id === 'swaps') {
        const text = (await tour(p).innerText()).replace(/\s+/g, ' ');
        pass(/Échanges entre pharmacies/.test(text) && /attendent encore quelqu'un/.test(text) && /Reçu, j'y vais/.test(text) && !/Branch swaps|still wait/.test(text), 'the swaps step is in French, with the field page\'s own words');
      }
    });
    await ctx.close(); }

  await browser.close();
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
