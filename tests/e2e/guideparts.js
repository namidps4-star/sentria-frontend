// ONB-GUIDE parts: someone who finished the tour once gets a list of parts instead of the full tour.
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
const day = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const DISPOSALS = [{ id: 'd1', product: 'Rabies vaccine', batch: 'B7', qty: 20, value: 100, currency: 'EUR', method: 'pit', disposed_on: day(2), note: '' }, { id: 'd2', product: 'Dewormer', batch: '', qty: 5, value: 50, currency: 'EUR', method: 'burn', disposed_on: day(5), note: '' }];
const LA = (id, eq, key, sev, h) => ({ id: 'l' + id, equipment: eq, sector: 'logistics', business_type: 'port-conteneurs', severity: sev, date: new Date(Date.now() - h * 36e5).toISOString(), alert_key: key, message: 'MSG ' + eq, risk_score: 60, params: [] });
const LOGI = [LA(1, 'GRUE-02', 'logistics.cycles.critical', 'CRITICAL', 2), LA(2, 'QUAI-3', 'logistics.wait.critical', 'CRITICAL', 1), LA(3, 'CONT-88', 'logistics.temperature.critical', 'CRITICAL', 3), LA(4, 'GRUE-05', 'logistics.cycles.warning', 'WARNING', 5), LA(5, 'QUAI-1', 'logistics.wait.warning', 'WARNING', 6)];
const PROFILES = {
  pharmacy: { sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie' },
  vet: { sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'veterinaire' },
  logistics: { sentria_sector: 'logistics', sentria_sectors: '["logistics"]', sentria_business_type: 'port-conteneurs', sentria_ops_types: '["port"]', sentria_ops_type: 'port', sentria_departments: '{"logistics":["port-conteneurs"]}', sentria_equipment: '["blockages","wait","cost","anticipate","recommend"]' },
};
const RECS = ALERTS.map(a => ({ ...a, recommended_action: 'ACT ' + a.equipment, action_category: 'stock', confidence: 0.8 }));

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async ({ lang = 'en', theme = 'light', vw = 1440, vh = 900, done = false, data = false, profile = 'pharmacy' } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, locale: lang === 'fr' ? 'fr-FR' : 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    await p.route(/onrender\.com\//, r => { const path = new URL(r.request().url()).pathname; const mine = profile === 'logistics' ? LOGI : ALERTS;
      if (path === '/disposals') return json(r, { disposals: DISPOSALS, summary: { count: 2, total_value: 150, last_30_days_value: 150, pit_share: 66.7, by_method: {} }, methods: ['pit', 'burn', 'return', 'donation', 'other'], persisted: true });
      return json(r, path === '/alerts' ? (data ? mine : []) : path === '/recommendations' ? { recommendations: data && profile !== 'logistics' ? RECS : [] } : { recommendations: [], assignments: [], contractors: [] }); });
    await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } },
      { sentria_onboarded: 'true', ...PROFILES[profile], sentria_language: lang, sentria_theme: theme, ...(done ? { sentria_guide_done: '1' } : {}) });
    await signedIn(p, 'u-me', 'boss@sentria.app', { plan: 'decouverte', isAdmin: false });
    await p.goto(APP_URL); await p.waitForTimeout(1800);
    if (profile === 'logistics') { const log = p.getByRole('button', { name: /^Logistics/ }).first(); if (await log.count()) { await log.click(); await p.waitForTimeout(800); } }
    return { p, ctx };
  };
  const tour = p => p.locator('[data-testid="guide-buddy"]');
  const startTour = async p => {
    if (p.viewportSize().width < 768) { await p.getByRole('button', { name: /open.*(menu|navigation)/i }).first().click(); await p.waitForTimeout(400); }
    await p.locator('[data-support-open]').locator('visible=true').first().click(); await p.waitForTimeout(500);
    await p.locator('[data-tour-open]').click(); await p.waitForTimeout(900);
  };
  const next = async p => { await p.getByRole('button', { name: /^(Next|Suivant|Done|Terminer)$/ }).click(); await p.waitForTimeout(650); };

  const tourStep = p => tour(p).getAttribute('data-step');
  const parts = p => p.getByTestId('guide-part');
  const seenOf = p => p.evaluate(() => JSON.parse(localStorage.getItem('sentria_guide_parts') || '[]'));
  const isDone = (p, id) => parts(p).filter({ has: p.locator('xpath=.') }).evaluateAll((els, i) => els.find(e => e.dataset.part === i)?.dataset.seen, id);

  console.log('== a first visit still gets the whole tour');
  { const { p, ctx } = await open();
    await startTour(p);
    pass(await tourStep(p) === 'hello', 'no finished tour yet: it starts at hello, no list');
    await ctx.close(); }

  console.log('== a finished tour opens on the list');
  { const { p, ctx } = await open({ done: true });
    await startTour(p);
    pass(await tourStep(p) === 'parts' && await p.getByTestId('guide-card').getAttribute('data-parts') !== null, 'the list opens');
    pass(await parts(p).count() === 5, 'five parts');
    pass((await parts(p).evaluateAll(els => els.map(e => e.dataset.part))).join() === 'menu,dashboard,import,tracking,sites', 'in order: menu, dashboard, import, tracking, sites');
    pass(/Welcome back/.test(await tour(p).innerText()) && /Play all parts/.test(await tour(p).innerText()) && /Skip tour/.test(await tour(p).innerText()), 'welcome, Play all parts, Skip tour');
    pass((await parts(p).evaluateAll(els => els.map(e => e.dataset.seen))).every(v => v === 'false') && (await parts(p).first().innerText()).includes('Start'), 'nothing seen yet: every part says Start');
    await p.screenshot({ path: 'guideparts-light.png' });
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== pick one part and stop');
  { const { p, ctx } = await open({ done: true, data: true });
    await startTour(p);
    await parts(p).nth(3).click(); await p.waitForTimeout(900);
    pass(await tourStep(p) === 'part-tracking-board' && await tour(p).getAttribute('data-chapter') === 'tracking', 'Tracking and tasks starts on its first step');
    pass(/To do, In progress, Resolved/.test(await tour(p).innerText()), 'it names the three columns the board shows');
    await p.screenshot({ path: 'guideparts-tracking.png' });
    await next(p); pass(await tourStep(p) === 'part-tracking-owner', 'second step: an owner on every task');
    await next(p); pass(await tourStep(p) === 'part-tracking-outcome' && /What happened\?/.test(await tour(p).innerText()), 'third step: What happened?');
    await next(p); pass(await tourStep(p) === 'part-tracking-swaps' && /A swap is a task like the others/.test(await tour(p).innerText()), 'a pharmacy gets a fourth step: branch swaps (tests/e2e/guideswaps.js)');
    await p.getByRole('button', { name: 'Done', exact: true }).click(); await p.waitForTimeout(500);
    pass(await tour(p).count() === 0, 'Done on the last step closes the tour: one part, then back to work');
    pass((await seenOf(p)).join() === 'tracking', 'and the part is remembered as seen');
    await startTour(p);
    const flags = await parts(p).evaluateAll(els => els.map(e => e.dataset.part + ':' + e.dataset.seen));
    pass(flags.join() === 'menu:false,dashboard:false,import:false,tracking:true,sites:false', 'next time it is checked and says Replay: ' + flags.join());
    pass((await parts(p).nth(3).innerText()).includes('Replay'), 'its button says Replay');
    await ctx.close(); }

  console.log('== Back returns to the list');
  { const { p, ctx } = await open({ done: true });
    await startTour(p);
    await parts(p).nth(4).click(); await p.waitForTimeout(900);
    pass(await tourStep(p) === 'part-sites-list', 'Sites and team: first step');
    await p.getByRole('button', { name: 'Back', exact: true }).click(); await p.waitForTimeout(400);
    pass(await tourStep(p) === 'parts', 'Back on the first step returns to the list');
    await parts(p).nth(0).click(); await p.waitForTimeout(900);
    pass(await tourStep(p) === 'hello', 'the menu part starts at hello');
    await ctx.close(); }

  console.log('== What to import is its own part');
  { const { p, ctx } = await open({ done: true, data: true });
    await startTour(p);
    await parts(p).nth(2).click(); await p.waitForTimeout(1500);
    const seen = [];
    for (let i = 0; i < 6; i++) { if (!(await tour(p).count())) break; seen.push(await tourStep(p)); if (await p.getByRole('button', { name: 'Done', exact: true }).count()) break; await next(p); }
    pass(seen[0] === 'deep-import' && seen.join() === 'deep-import,deep-after,deep-done', 'import, after the import, your turn: ' + seen.join());
    await ctx.close(); }

  console.log('== Play all runs every part in order');
  { const { p, ctx } = await open({ done: true, data: true });
    await startTour(p);
    await p.getByTestId('guide-play-all').click(); await p.waitForTimeout(900);
    const seen = [];
    for (let i = 0; i < 60; i++) {
      if (!(await tour(p).count())) break;
      seen.push(await tourStep(p));
      if (await p.getByRole('button', { name: 'Done', exact: true }).count()) { await p.getByRole('button', { name: 'Done', exact: true }).click(); await p.waitForTimeout(600); break; }
      await next(p);
    }
    const ids = ['hello', 'dashboard', 'deep-hello', 'deep-import', 'part-tracking-board', 'part-sites-list', 'part-sites-team'];
    pass(ids.every(id => seen.includes(id)), 'it reaches every part: ' + seen.length + ' steps');
    pass(seen.indexOf('hello') < seen.indexOf('deep-hello') && seen.indexOf('deep-import') < seen.indexOf('part-tracking-board') && seen.indexOf('part-tracking-board') < seen.indexOf('part-sites-list'), 'in order');
    pass(!seen.includes('done') && !seen.includes('deep-done'), 'no goodbye until the very last part');
    pass(await tour(p).count() === 0, 'and Done on the last step closes it');
    pass((await seenOf(p)).join() === 'menu,dashboard,import,tracking,sites', 'every part is remembered: ' + (await seenOf(p)).join());
    await ctx.close(); }

  console.log('== the old path still works: Go deeper');
  { const { p, ctx } = await open({ data: true });
    await startTour(p);
    for (let i = 0; i < 9; i++) { if (await p.getByTestId('guide-deeper').count()) break; await next(p); }
    await p.getByTestId('guide-deeper').click(); await p.waitForTimeout(1500);
    pass(await tourStep(p) === 'deep-hello', 'Go deeper opens the dashboard half');
    for (let i = 0; i < 14; i++) { if (await tourStep(p) === 'deep-done') break; await next(p); }
    pass(await tourStep(p) === 'deep-done', 'and runs on into the import half without a stop');
    await p.getByRole('button', { name: 'Done', exact: true }).click(); await p.waitForTimeout(400);
    pass((await seenOf(p)).join() === 'dashboard,import', 'the two parts are marked: ' + (await seenOf(p)).join());
    await ctx.close(); }

  console.log('== French on dark');
  { const { p, ctx } = await open({ done: true, lang: 'fr', theme: 'dark' });
    await startTour(p);
    const t = await tour(p).innerText();
    pass(/Content de vous revoir/.test(t) && /Tout lire/.test(t) && /Passer la visite/.test(t) && /Commencer/.test(t) && /Suivi et tâches/.test(t), 'French copy');
    await p.screenshot({ path: 'guideparts-dark-fr.png' });
    await ctx.close(); }

  console.log('== 390 px');
  { const { p, ctx } = await open({ done: true, vw: 390, vh: 844 });
    await startTour(p);
    const box = await p.getByTestId('guide-card').boundingBox();
    pass(box.x >= 0 && box.x + box.width <= 390 && box.y >= 0 && box.y + box.height <= 844, 'the list sits inside the screen: ' + JSON.stringify(box));
    pass(!(await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), 'no sideways scroll');
    await p.screenshot({ path: 'guideparts-phone.png' });
    await parts(p).nth(4).click(); await p.waitForTimeout(900);
    const b2 = await p.getByTestId('guide-card').boundingBox();
    pass(b2.y >= 0 && b2.y + b2.height <= 844, 'a part\'s card stays inside the screen too');
    await ctx.close(); }

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL OK');
  process.exit(fails ? 1 : 0);
})();
