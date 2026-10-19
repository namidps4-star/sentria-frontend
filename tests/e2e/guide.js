// ONB-GUIDE: the first-use tour. Robo walks down the sidebar, rings each item and says what it is for. It does not
// open by itself for an account that already finished setup, it opens from the "Take the tour" button in the Help dialog, it can be
// skipped, closed with Escape, stepped with the arrow keys, and it never points at a menu item that is not there.
// Light English, dark French, 390 px.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const now = new Date().toISOString();
const dayAgo = d => new Date(Date.now() - d * 86400000).toISOString();
const ALERTS = [['Doliprane', 'health.stock.critical_low', 'CRITICAL', 0], ['Amoxicilline', 'health.stock.low', 'WARNING', 1], ['Insuline', 'health.cold_chain.broken', 'CRITICAL', 1], ['Aspirine', 'health.expiry.warning', 'WARNING', 2], ['Vaccin', 'health.cold_chain.broken', 'CRITICAL', 3], ['Sirop', 'health.stock.low', 'WARNING', 5]]
  .map(([eq, key, severity, d], i) => ({ id: 'a' + i, equipment: eq, sector: 'health', business_type: 'pharmacie', severity, date: dayAgo(d), alert_key: key, message: 'MSG ' + eq, risk_score: 60, params: [] }));
const RECS = ALERTS.map(a => ({ ...a, recommended_action: 'ACT ' + a.equipment, action_category: 'stock', confidence: 0.8 }));

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async ({ lang = 'en', theme = 'light', vw = 1440, vh = 900, done = false, data = false } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, locale: lang === 'fr' ? 'fr-FR' : 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    await p.route(/onrender\.com\//, r => { const path = new URL(r.request().url()).pathname; return json(r, path === '/alerts' ? (data ? ALERTS : []) : path === '/recommendations' ? { recommendations: data ? RECS : [] } : { recommendations: [], assignments: [], contractors: [] }); });
    await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } },
      { sentria_onboarded: 'true', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', sentria_language: lang, sentria_theme: theme, ...(done ? { sentria_guide_done: '1' } : {}) });
    await signedIn(p, 'u-me', 'boss@sentria.app', { plan: 'decouverte', isAdmin: false });
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

  console.log('== an account that finished setup is not interrupted');
  { const { p, ctx } = await open();
    pass(await tour(p).count() === 0, 'no tour on load');
    await startTour(p);
    pass(await tour(p).count() === 1, '"Take the tour" opens it');
    pass(await tour(p).getAttribute('data-step') === 'hello' && await tour(p).getAttribute('data-pose') === 'wave', 'first step: hello, waving');
    pass(/Hi, I'm Robo/.test(await tour(p).innerText()) && await p.locator('[data-testid="guide-ring"]').count() === 0, 'hello says the name, rings nothing');
    await p.screenshot({ path: 'guide-hello.png' });
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== the walk');
  { const { p, ctx } = await open();
    await startTour(p);
    const seen = [];
    for (let i = 0; i < 12; i++) {
      if (!(await tour(p).count())) break; const id = await tour(p).getAttribute('data-step');
      seen.push(id);
      if (id === 'dashboard') {
        const ring = await p.locator('[data-testid="guide-ring"]').boundingBox();
        const item = await p.locator('aside [data-nav="dashboard"]').locator('visible=true').first().boundingBox();
        pass(!!ring && Math.abs(ring.y - item.y) < 6 && ring.width >= item.width, 'dashboard: lime ring sits on the menu item');
        pass(await tour(p).getAttribute('data-pose') === 'point', 'dashboard: pointing');
        const robo = await p.locator('[data-testid="guide-buddy"] svg').first().boundingBox();
        pass(robo.x > item.x + item.width - 2, 'dashboard: Robo stands to the right of the sidebar');
        await p.screenshot({ path: 'guide-point.png' });
      }
      if (id === 'report') { const card = await p.locator('[data-testid="guide-card"]').boundingBox(); pass(card.y + card.height <= 900, 'last pointing step: the card stays on screen'); }
      if (id === 'done') { pass(await tour(p).getAttribute('data-pose') === 'cheer', 'last step: cheering'); await p.screenshot({ path: 'guide-done.png' }); }
      await next(p);
    }
    pass(seen[0] === 'hello' && seen[seen.length - 1] === 'done' && seen.length === 8, 'eight steps, hello to done: ' + seen.join(','));
    pass(await tour(p).count() === 0, 'Done closes the tour');
    pass(await p.evaluate(() => localStorage.getItem('sentria_guide_done')) === '1', 'finishing is remembered');
    await startTour(p);
    pass(await tour(p).getAttribute('data-step') === 'hello', 'it can be replayed from the first step');
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== skip, Escape and the arrow keys');
  { const { p, ctx } = await open();
    await startTour(p);
    await next(p);
    await p.keyboard.press('ArrowRight'); await p.waitForTimeout(500);
    pass(await tour(p).getAttribute('data-step') === 'tracking', 'ArrowRight goes forward');
    await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(500);
    pass(await tour(p).getAttribute('data-step') === 'dashboard', 'ArrowLeft goes back');
    await p.getByTestId('guide-card').getByRole('button', { name: 'Back', exact: true }).click(); await p.waitForTimeout(500);
    pass(await tour(p).getAttribute('data-step') === 'hello' && await p.getByTestId('guide-card').getByRole('button', { name: 'Back', exact: true }).count() === 0, 'Back returns to hello, which has no Back');
    await p.getByTestId('guide-card').getByRole('button', { name: 'Skip tour' }).click(); await p.waitForTimeout(400);
    pass(await tour(p).count() === 0 && await p.evaluate(() => localStorage.getItem('sentria_guide_done')) === '1', 'Skip closes it and remembers');
    await startTour(p); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    pass(await tour(p).count() === 0, 'Escape closes it');
    await ctx.close(); }

  console.log('== an item the person does not have is skipped, not pointed at');
  { const { p, ctx } = await open();
    await p.evaluate(() => document.querySelector('aside [data-nav="contractors"]').remove());
    await startTour(p);
    const seen = [];
    for (let i = 0; i < 12; i++) { if (!(await tour(p).count())) break; const id = await tour(p).getAttribute('data-step'); seen.push(id); await next(p); }
    pass(!seen.includes('contractors') && seen.length === 7, 'no contractors step: ' + seen.join(','));
    await ctx.close(); }

  console.log('== French, dark');
  { const { p, ctx } = await open({ lang: 'fr', theme: 'dark' });
    await startTour(p); await next(p);
    const t = await tour(p).innerText();
    pass(/Vos alertes/.test(t) && /Passer la visite/.test(t) && /Suivant/.test(t) && !/Skip tour/.test(t), 'French copy');
    await p.screenshot({ path: 'guide-fr-dark.png' });
    await ctx.close(); }

  console.log('== 390 px');
  { const { p, ctx } = await open({ vw: 390, vh: 844 });
    await startTour(p);
    const seen = [];
    for (let i = 0; i < 12; i++) {
      if (!(await tour(p).count())) break; const id = await tour(p).getAttribute('data-step'); seen.push(id);
      const card = await p.locator('[data-testid="guide-card"]').boundingBox();
      if (!(card.x >= 0 && card.x + card.width <= 390 && card.y >= 0 && card.y + card.height <= 844)) pass(false, 'card off screen on ' + id);
      if (id === 'dashboard') await p.screenshot({ path: 'guide-390.png' });
      await next(p);
    }
    pass(seen.length === 8 && await p.locator('[data-testid="guide-ring"]').count() === 0, 'all eight steps, no ring, every card inside the screen');
    pass(await p.locator('aside').first().evaluate(el => el.getBoundingClientRect().right <= 1) , 'the menu drawer is closed behind the tour');
    pass(!(await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), 'no sideways scroll');
    await ctx.close(); }

  // Walks a chapter to its end; returns the step ids seen.
  const walk = async (p, shot) => {
    const seen = [];
    for (let i = 0; i < 14; i++) {
      if (!(await tour(p).count())) break;
      const id = await tour(p).getAttribute('data-step'); seen.push(id);
      if (shot && shot[id]) await p.screenshot({ path: shot[id] });
      await next(p); await p.waitForTimeout(500);
    }
    return seen;
  };
  const goDeeper = async p => {
    for (let i = 0; i < 9; i++) { if (await p.getByTestId('guide-deeper').count()) break; await next(p); }
    await p.getByTestId('guide-deeper').click(); await p.waitForTimeout(1500);
  };

  console.log('== go deeper: the dashboard and what to enter (with data)');
  { const { p, ctx } = await open({ data: true });
    await p.locator('aside [data-nav="tracking"]').locator('visible=true').first().click(); await p.waitForTimeout(800);
    await startTour(p);
    pass(await p.getByTestId('guide-deeper').count() === 0, 'the quick tour does not show "Go deeper" before its last step');
    await goDeeper(p);
    pass(await tour(p).getAttribute('data-chapter') === 'deep' && await tour(p).getAttribute('data-step') === 'deep-hello', 'Go deeper opens the second chapter at its hello');
    pass(await p.locator('[data-tour="kpis"]').count() >= 1, 'it opened the dashboard first (the page was on Tracking)');
    const seen = [];
    for (let i = 0; i < 14; i++) {
      if (!(await tour(p).count())) break;
      const id = await tour(p).getAttribute('data-step'); seen.push(id);
      const placement = await tour(p).getAttribute('data-placement');
      if (id === 'deep-kpis') {
        pass(placement === 'float' && await p.getByTestId('guide-ring').count() === 1, 'cards: the page is dimmed and the cards are ringed, Robo floats clear of them');
        const ring = await p.getByTestId('guide-ring').boundingBox(); const k = await p.locator('[data-tour="kpis"]').boundingBox();
        pass(Math.abs(ring.x - k.x) < 8 && ring.width >= k.width - 4, 'cards: the ring sits on the four cards');
        await p.screenshot({ path: 'guide-deep-kpis.png' });
      }
      if (id === 'deep-trend') pass(/7, 30 or 90 days/.test(await tour(p).innerText()), 'trend: names the 7, 30 and 90 day ranges');
      if (id === 'deep-alerts') { const card = await p.getByTestId('guide-card').boundingBox(); pass(card.y >= 0 && card.y + card.height <= 900, 'alerts table: the card stays on screen'); await p.screenshot({ path: 'guide-deep-alerts.png' }); }
      if (id === 'deep-import') {
        const chips = await p.getByTestId('guide-chips').locator('code').allInnerTexts();
        pass(chips.join(',') === 'medicine_name,stock_qty,min_stock,sales_last_30_days,unit_cost,expiry_date', 'import: the columns of the Pharmacy file are listed: ' + chips.join(','));
        pass(placement === 'left', 'import: Robo stands to the left of the button, arm out to it');
        const ring = await p.getByTestId('guide-ring').boundingBox(); const b = await p.locator('[data-tour="import"]').boundingBox();
        pass(Math.abs(ring.x - b.x) < 8 && Math.abs(ring.y - b.y) < 8, 'import: the ring sits on the import button');
        const robo = await p.locator('[data-testid="guide-buddy"] svg').first().boundingBox();
        pass(robo.x + robo.width <= b.x + 2, 'import: Robo is left of the button, not over it');
        pass(/Pharmacy/.test(await tour(p).innerText()), 'import: names the department');
        await p.screenshot({ path: 'guide-deep-import.png' });
      }
      await next(p); await p.waitForTimeout(500);
    }
    pass(seen.join(',') === 'deep-hello,deep-kpis,deep-trend,deep-breakdown,deep-alerts,deep-import,deep-after,deep-done', 'eight steps with data: ' + seen.join(','));
    pass(await tour(p).count() === 0 && await p.evaluate(() => localStorage.getItem('sentria_guide_done')) === '1', 'Done closes it and remembers');
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== go deeper with no data yet: the blocks that need data become one preview step');
  { const { p, ctx } = await open({ data: false });
    await startTour(p); await goDeeper(p);
    const seen = await walk(p, { 'deep-preview': 'guide-deep-preview.png' });
    pass(seen.join(',') === 'deep-hello,deep-preview,deep-alerts,deep-import,deep-after,deep-done', 'six steps, no pointing at cards that are not there: ' + seen.join(','));
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== go deeper, French on dark');
  { const { p, ctx } = await open({ lang: 'fr', theme: 'dark', data: true });
    await startTour(p); await goDeeper(p);
    for (let i = 0; i < 5; i++) await next(p);
    const t = await tour(p).innerText();
    pass(await tour(p).getAttribute('data-step') === 'deep-import' && /Importer vos données/.test(t) && /medicine_name/.test(t), 'French import step with the columns');
    await p.screenshot({ path: 'guide-deep-fr-dark.png' });
    await ctx.close(); }

  console.log('== go deeper at 390 px');
  { const { p, ctx } = await open({ vw: 390, vh: 844, data: true });
    await startTour(p); await goDeeper(p);
    const seen = [];
    for (let i = 0; i < 14; i++) {
      if (!(await tour(p).count())) break;
      const id = await tour(p).getAttribute('data-step'); seen.push(id);
      const card = await p.getByTestId('guide-card').boundingBox();
      if (!(card.x >= 0 && card.x + card.width <= 390 && card.y >= 0 && card.y + card.height <= 844)) pass(false, 'card off screen on ' + id);
      if (id === 'deep-import') await p.screenshot({ path: 'guide-deep-390.png' });
      await next(p); await p.waitForTimeout(500);
    }
    pass(seen.length === 8, 'all eight steps, every card inside the screen: ' + seen.join(','));
    pass(!(await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), 'no sideways scroll');
    await ctx.close(); }

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL OK');
  process.exit(fails ? 1 : 0);
})();
