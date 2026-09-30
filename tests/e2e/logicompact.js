// Logistics priorities, compact: joined number strip, breaking points as rows, stage figure beside the title,
// board cards ~100px, and a Board / List switch that is remembered.
const { LAUNCH, APP_URL } = require('./env');
const { chromium } = require('playwright'); const { signedIn } = require('./auth-mock');
let fails = 0; const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const now = Date.now();
const A = (id, eq, key, sev, h) => ({ id, equipment: eq, sector: 'logistics', business_type: 'port-conteneurs', severity: sev, date: new Date(now - h * 36e5).toISOString(), alert_key: key, message: `${eq}: ${key.split('.')[1]} ${sev === 'CRITICAL' ? 'critical' : 'rising'}`, risk_score: sev === 'CRITICAL' ? 82 : 55 });
const data = [A(1, 'GRUE-02', 'logistics.cycles.critical', 'CRITICAL', 2), A(2, 'QUAI-3', 'logistics.wait.critical', 'CRITICAL', 1), A(3, 'CONT-88', 'logistics.temperature.critical', 'CRITICAL', 3), A(4, 'GRUE-05', 'logistics.cycles.warning', 'WARNING', 5), A(5, 'QUAI-1', 'logistics.wait.warning', 'WARNING', 6), A(6, 'REEFER-12', 'logistics.temperature.warning', 'WARNING', 7), A(8, 'PORTIQUE-1', 'logistics.pressure.critical', 'CRITICAL', 4), A(10, 'YARD-B', 'logistics.risk.elevated', 'WARNING', 10)];
const LS = { sentria_language: 'en', sentria_onboarded: 'true', sentria_company_name: 'Port Autonome', sentria_sector: 'logistics', sentria_sectors: '["logistics"]', sentria_business_type: 'port-conteneurs', sentria_ops_types: '["port"]', sentria_ops_type: 'port', sentria_departments: '{"logistics":["port-conteneurs"]}', sentria_equipment: '["blockages","wait","cost","anticipate","recommend"]' };

(async () => { const b = await chromium.launch(LAUNCH);
  const open = async (vw, theme) => {
    const p = await b.newPage({ viewport: { width: vw, height: vw < 500 ? 844 : 900 }, locale: 'en-US' }); p._errs = []; p.on('pageerror', e => p._errs.push(e.message));
    p._saved = [];
    await p.route(/onrender\.com\//, r => { const u = r.request().url(); if (r.request().method() !== 'GET' && /assign/.test(u)) { try { p._saved.push(JSON.parse(r.request().postData())); } catch { } }
      r.fulfill({ status: 200, contentType: 'application/json', body: /\/alerts/.test(u) ? JSON.stringify(data) : '{"recommendations":[],"assignments":[],"contractors":[]}' }); });
    await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); Object.entries(ls).forEach(([k, v]) => localStorage.setItem(k, v)); } }, { ...LS, sentria_theme: theme });
    await signedIn(p, 'u', 'a@b.c', { plan: 'business' }); await p.goto(APP_URL); await p.waitForTimeout(2000);
    const log = p.getByRole('button', { name: /^Logistics/ }).first(); if (await log.count()) { await log.click(); await p.waitForTimeout(800); }
    return p; };
  const go = async (p, name) => { await p.locator('main button', { hasText: new RegExp(name, 'i') }).first().click(); await p.waitForTimeout(1000); await p.evaluate(() => document.querySelector('main').scrollTo(0, 0)); };

  for (const theme of ['light', 'dark']) {
    console.log(`== blockages (${theme})`);
    const p = await open(1440, theme);
    await go(p, 'Avoid blockages');
    const fig = p.getByTestId('flow-figure');
    const title = p.locator('main h2').filter({ hasText: /^Berth$/ }).first();
    const fb = await fig.boundingBox(), tb = await title.boundingBox();
    pass(fb && tb && fb.y < tb.y + tb.height && fb.x > tb.x + tb.width, 'the "open for" figure sits beside the stage title, not under the track');
    pass(await fig.locator('p.font-heading').evaluate(e => parseFloat(getComputedStyle(e).fontSize)) <= 30, 'figure is headline size, not poster size');
    const strip = p.locator('main div.grid.gap-px').first();
    const cells = strip.locator(':scope > div');
    pass(await cells.count() === 4 && await cells.first().evaluate(e => getComputedStyle(e).borderTopWidth) === '0px', 'the four numbers are one joined strip (no per-tile borders)');
    const hs = await cells.evaluateAll(els => els.map(e => e.getBoundingClientRect().height));
    pass(Math.max(...hs) <= 110, 'strip cells are short: ' + hs.map(Math.round).join(','));
    const bp = p.getByTestId('breakpoints');
    const rows = bp.locator('li');
    pass(await rows.count() >= 3, 'breaking points listed: ' + await rows.count());
    pass(await bp.locator('.h-1\\.5').count() === 0, 'no filled track bars under each row');
    const rh = await rows.evaluateAll(els => els.map(e => e.getBoundingClientRect().height));
    pass(Math.max(...rh) <= 64, 'each breaking point is one compact row: ' + rh.map(Math.round).join(','));
    pass(/^1$/.test(await rows.first().locator('span').first().innerText()), 'rows are ranked');
    await p.screenshot({ path: `logi-blockages-${theme}.png`, fullPage: false });

    console.log(`== recommendations board (${theme})`);
    await p.getByRole('button', { name: /^Recommendations$/ }).first().click(); await p.waitForTimeout(1000);
    const board = p.locator('#priorities-board');
    const cards = board.locator('article');
    const n = await cards.count();
    pass(n >= 5, 'board cards: ' + n);
    const ch = await cards.evaluateAll(els => els.map(e => e.getBoundingClientRect().height));
    pass(Math.max(...ch) <= 120, 'cards are compact (max ' + Math.round(Math.max(...ch)) + 'px, was ~230)');
    const first = cards.first();
    pass(await first.getByRole('button', { name: /Assign/ }).count() === 1 && await first.getByLabel(/^Due date for/).count() === 1, 'card keeps owner and due date controls');
    pass(await first.getByRole('button', { name: /^Priority detail for/ }).count() === 1, 'card keeps the detail button');
    const boardBtn = board.getByRole('button', { name: 'Board' }), listBtn = board.getByRole('button', { name: 'List' });
    pass(await boardBtn.getAttribute('aria-pressed') === 'true', 'Board is the default layout');
    await p.screenshot({ path: `logi-board-${theme}.png` });

    await listBtn.click(); await p.waitForTimeout(400);
    const list = p.getByTestId('priority-list');
    const items = list.locator(':scope > li');
    pass(await listBtn.getAttribute('aria-pressed') === 'true' && await board.locator('article').count() === 0 && await items.count() === n, 'List: one row per priority (' + await items.count() + ')');
    const lh = await items.evaluateAll(els => els.map(e => e.getBoundingClientRect().height));
    pass(Math.max(...lh) <= 64, 'list rows are one line each (max ' + Math.round(Math.max(...lh)) + 'px)');
    const row = items.first(); const eq = (await row.locator('p').first().innerText()).split(' · ')[0];
    const sel = row.getByRole('combobox', { name: `Status of ${eq}` });
    await sel.selectOption('in_progress'); await p.waitForTimeout(500);
    const moved = list.locator(':scope > li', { hasText: eq }).getByRole('combobox');
    pass(await moved.inputValue() === 'in_progress', `status changed from the list (${eq} → In progress)`);
    await list.getByRole('button', { name: `Priority detail for ${eq}` }).click(); await p.waitForTimeout(300);
    pass(await p.locator('#priority-detail-deadline').count() === 1, 'details open from the list');
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    await p.screenshot({ path: `logi-list-${theme}.png` });
    pass(await p.evaluate(() => localStorage.getItem('sentria_board_layout')) === 'list', 'the layout choice is remembered');
    await boardBtn.click(); await p.waitForTimeout(300);
    const inProg = board.locator('section[aria-label="In progress"] article', { hasText: eq });
    pass(await inProg.count() === 1, 'back on the board, the card sits in In progress');
    pass(p._errs.length === 0, 'no page errors ' + p._errs.join('|'));
    await p.close();
  }

  console.log('== phone');
  const q = await open(390, 'light');
  await go(q, 'Avoid blockages');
  pass(await q.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'blockages: no sideways scroll');
  await q.screenshot({ path: 'logi-blockages-390.png' });
  await q.getByRole('button', { name: /^Recommendations$/ }).first().click(); await q.waitForTimeout(900);
  await q.locator('#priorities-board').getByRole('button', { name: 'List' }).click(); await q.waitForTimeout(300);
  pass(await q.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'list: no sideways scroll');
  await q.locator('#priorities-board').scrollIntoViewIfNeeded(); await q.screenshot({ path: 'logi-list-390.png' });
  pass(q._errs.length === 0, 'no page errors ' + q._errs.join('|'));

  await b.close(); console.log(`\n${fails ? fails + ' failure(s)' : 'ALL OK'}`); process.exit(fails ? 1 : 0); })();
