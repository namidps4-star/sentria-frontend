// The goods-receiving check (PH-RECEIVE): upload, the board, ticking, a typed date, the grid and
// one-by-one views, the CSV, what is kept after a refresh, the refusals, French, dark and 390 px.
const { LAUNCH, APP_URL } = require('./env');
const { chromium } = require('playwright');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };

const item = (row, flag, product, batch, expiry, extra = {}) => ({
  id: `${row - 2}:health.receiving.${flag}`, row, flag, key: `health.receiving.${flag}`, product, batch, expiry, dates: null, days_expired: null,
  value: null, currency: null, message: `${product}: message`, action: `Action for ${product}.`, ...extra,
});
const ITEMS = [
  item(44, 'expired', 'Metformin 500mg', 'M771', '2026-09-30', { days_expired: 37, value: 3150, currency: 'KES' }),
  item(45, 'expired', 'ORS sachets', 'C903', '2026-09-30', { days_expired: 37, value: 3120, currency: 'KES' }),
  item(41, 'conflict', 'Amoxicillin 250mg', 'A114', '2027-05-31', { dates: ['2027-05-31', '2027-06-30'], value: 7600, currency: 'KES' }),
  item(42, 'conflict', 'Amoxicillin 250mg', 'A114', '2027-06-30', { dates: ['2027-05-31', '2027-06-30'], value: 7600, currency: 'KES' }),
  item(46, 'unclear', 'Omeprazole 20mg', 'O412', '06/07/2027', { value: 2700, currency: 'KES' }),
  item(47, 'unclear', 'Cetirizine 10mg', 'A55', '03/04/2027', { value: 900, currency: 'KES' }),
  item(48, 'nodate', 'Paracetamol 500mg', '?', '2027-03', { value: 1260, currency: 'KES' }),
  item(49, 'nodate', 'Ibuprofen 400mg', 'B2207', '', { value: 2040, currency: 'KES' }),
  item(50, 'nodate', 'Salbutamol inhaler', '?', '', { value: 4800, currency: 'KES' }),
  item(51, 'nodate', 'Zinc 20mg', 'Z310', ''),
];
const tr = (row, product, batch, expiry, flag, bad, item) => ({ row, product, batch, expiry, quantity: '10', unit_cost: '2', flag, item, bad });
const CLEAN = [tr(2, 'Aspirin 100mg', 'AS201', '2027-10-31', null, [], null), tr(3, 'Diclofenac 50mg', 'DC118', '2028-01-31', null, [], null), tr(52, 'Loratadine 10mg', 'LR044', '2027-12-15', null, [], null), tr(53, 'Zinc plus', 'ZP9', '2028-02-29', null, [], null)];
const TABLE = [...CLEAN.slice(0, 2), ...ITEMS.map(i => tr(i.row, i.product, i.batch === '?' ? '' : i.batch, i.expiry, i.flag, i.flag === 'nodate' ? [...(i.batch === '?' ? ['batch'] : []), ...(i.expiry ? [] : ['expiry'])] : ['expiry'], i.id)), ...CLEAN.slice(2)].sort((a, b) => a.row - b.row);
const GOOD = { success: true, rows: 100, flagged: 10, clean: 90, items: ITEMS, table: TABLE, table_truncated: true };
const BIG = { ...GOOD, rows: 120, clean: 110, table: Array.from({ length: 120 }, (_, i) => tr(i + 2, `Product ${i + 1}`, `L${i + 1}`, '2028-01-01', null, [], null)).map((r, i) => i === 7 ? { ...r, flag: 'nodate', item: ITEMS[6].id, bad: ['batch'] } : r) };
const FILE = { name: 'receiving-2026-11-06.csv', mimeType: 'text/csv', buffer: Buffer.from('product_name,batch_number,expiry_date\nAspirin,A1,2027-01-01\n') };
const LS = { sentria_language: 'en', sentria_onboarded: 'true', sentria_company_name: 'Atlantis', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie' };

(async () => {
  const b = await chromium.launch(LAUNCH);
  const open = async ({ answer = { status: 200, body: GOOD }, raise = { status: 200, body: { success: true, alerts_fired: 3, rows_processed: 100, saves_failed: 0 } }, vw = 1440, vh = 900, theme = 'light', lang = 'en', plan = 'business', upload = true } = {}) => {
    const ctx = await b.newContext({ viewport: { width: vw, height: vh }, locale: 'en-US', acceptDownloads: true });
    const p = await ctx.newPage();
    p._errs = []; p._calls = [];
    p.on('pageerror', e => p._errs.push(e.message));
    await p.route(/onrender\.com\//, r => {
      const req = r.request(); const u = new URL(req.url()); p._calls.push(`${req.method()} ${u.pathname}${u.search}`);
      const send = (body, status = 200) => r.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
      if (req.method() === 'OPTIONS') return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      if (u.pathname === '/receiving/check') return send(answer.body, answer.status);
      if (u.pathname === '/upload') return send(raise.body, raise.status);
      if (u.pathname === '/alerts') return send([]);
      if (u.pathname === '/sites') return send({ sites: [{ id: 's1', name: 'Nairobi', location: 'Nairobi, Kenya' }], persisted: true, max_sites: 50 });
      return send({ recommendations: [], assignments: [], contractors: [] });
    });
    await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); Object.entries(ls).forEach(([k, v]) => localStorage.setItem(k, v)); } }, { ...LS, sentria_theme: theme, sentria_language: lang });
    await signedIn(p, 'u', 'a@b.c', { plan }); await p.goto(APP_URL); await p.waitForTimeout(1800);
    if (vw < 1024) { await p.getByRole('button', { name: /menu/i }).first().click(); await p.waitForTimeout(300); }
    await p.locator('aside nav button', { hasText: lang === 'fr' ? 'Réception' : 'Receiving check' }).click(); await p.waitForTimeout(900);
    if (upload) { await p.getByTestId('receiving-file').setInputFiles(FILE); await p.waitForTimeout(900); }
    return p;
  };
  const overflow = p => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  const progress = async p => (await p.getByTestId('receiving-progress').innerText()).replace(/\s+/g, ' ');

  console.log('== the row in the sidebar, and the empty screen');
  let p = await open({ upload: false });
  pass(await p.getByTestId('receiving-empty').isVisible(), 'a health account opens the Receiving check from the sidebar and sees the upload prompt');
  pass((await p.locator('main').innerText()).includes('Choose a CSV file'), 'the prompt names the action');
  pass(!p._calls.some(c => c.includes('/receiving/check')), 'nothing is sent before a file is chosen');
  await p.screenshot({ path: 'receiving-empty.png' });
  await p.context().close();

  console.log('== the board');
  p = await open();
  pass(p._calls.filter(c => c.startsWith('POST /receiving/check')).length === 1 && p._calls.some(c => c.includes('lang=en')), 'the file is sent once, with the language');
  pass(await p.getByTestId('receiving-card').count() === 10, 'ten cards');
  const colCount = async k => await p.getByTestId(`receiving-col-${k}`).getByTestId('receiving-card').count();
  pass((await colCount('nodate')) === 4 && (await colCount('unclear')) === 2 && (await colCount('conflict')) === 2 && (await colCount('expired')) === 2 && (await colCount('checked')) === 0, 'four missing, two unclear, two with two dates, two expired, none checked');
  pass(/0 of 10 checked/.test(await progress(p)), 'the progress starts at 0 of 10');
  pass((await p.locator('main').innerText()).includes('Expired 37 days ago (2026-09-30)'), 'a card says how long ago it expired');
  pass((await p.locator('main').innerText()).includes('3,150 KES'), 'the money is shown (Business plan)');
  await p.screenshot({ path: 'receiving-board.png' });

  console.log('== the sidebar count');
  const count = () => p.getByTestId('receiving-count').innerText().then(t => t.trim()).catch(() => null);
  pass(await count() === '10', 'the Receiving check row counts the ten rows still to look at');

  console.log('== turning the list into alerts');
  pass(await p.getByTestId('receiving-raise').isVisible(), 'the offer shows right after the file is checked, and says expired rows may text');
  pass((await p.getByTestId('receiving-raise').innerText()).includes('may text your phone'), 'the SMS is said in plain words before anything is created');
  await p.getByTestId('receiving-raise-button').click(); await p.waitForTimeout(500);
  const up = p._calls.filter(c => c.startsWith('POST /upload'));
  pass(up.length === 1 && up[0].includes('kind=receiving') && up[0].includes('sector=health') && up[0].includes('lang=en'), 'the same file goes to /upload named as a receiving file: ' + (up[0] || 'no call'));
  pass((await p.getByTestId('receiving-raised').innerText()).includes('3 alerts created') && await p.getByTestId('receiving-raise').count() === 0, 'it says how many were created, and the offer goes away');

  console.log('== ticking');
  const expiredCard = p.getByTestId('receiving-col-expired').getByTestId('receiving-card').first();
  await expiredCard.getByTestId('receiving-done').click(); await p.waitForTimeout(300);
  pass((await colCount('checked')) === 1 && (await colCount('expired')) === 1 && /1 of 10 checked/.test(await progress(p)), 'Set aside, done moves a card to Checked and the count follows');
  pass(await count() === '9', 'and so does the count in the sidebar');
  const unclearCard = p.getByTestId('receiving-col-unclear').getByTestId('receiving-card').first();
  const bad = unclearCard.getByTestId('receiving-date'); await bad.fill('7 July'); 
  pass(await unclearCard.getByTestId('receiving-done').isDisabled(), 'a date that is not YYYY-MM-DD cannot be saved');
  await bad.fill('2027-07-06'); await unclearCard.getByTestId('receiving-done').click(); await p.waitForTimeout(300);
  pass((await p.locator('main').innerText()).includes('Date noted: 2027-07-06'), 'a date typed from the box is kept with the tick');
  const toDrag = p.getByTestId('receiving-col-conflict').getByTestId('receiving-card').first();
  await toDrag.dragTo(p.getByTestId('receiving-col-checked'), { targetPosition: { x: 90, y: 40 } }); await p.waitForTimeout(300);
  pass((await colCount('checked')) === 3, 'dragging a card onto Checked ticks it');
  await p.getByTestId('receiving-col-checked').getByTestId('receiving-undo').first().click(); await p.waitForTimeout(300);
  pass((await colCount('checked')) === 2, 'Undo puts a card back');
  const noScroll = await p.evaluate(() => [...document.querySelectorAll('[data-testid^="receiving-col-"]')].every(c => c.scrollHeight <= c.clientHeight + 1 && getComputedStyle(c).overflowY !== 'auto' && getComputedStyle(c).overflowY !== 'scroll'));
  pass(noScroll, 'no column scrolls inside itself');

  console.log('== what is kept');
  await p.reload(); await p.waitForTimeout(1800);
  await p.locator('aside nav button', { hasText: 'Receiving check' }).click(); await p.waitForTimeout(900);
  pass(await p.getByTestId('receiving-card').count() === 10 && /2 of 10 checked/.test(await progress(p)), 'after a refresh the list and the ticks are still there');
  pass(p._calls.filter(c => c.startsWith('POST /receiving/check')).length === 1, 'and nothing is sent again');
  pass(await count() === '8' && (await p.getByTestId('receiving-raised').innerText()).includes('3 alerts created') && await p.getByTestId('receiving-raise').count() === 0, 'the sidebar count, and that the alerts were created, are remembered; the offer does not come back');

  console.log('== the grid: the whole file');
  await p.getByTestId('receiving-mode-grid').click(); await p.waitForTimeout(400);
  pass(await p.locator('[data-testid="receiving-grid"] thead.table-head').count() === 1, 'the table wears the table-head class');
  pass(await p.getByTestId('receiving-row').count() === 14, 'it opens on all rows: the file lines, flagged and clean');
  pass(await p.locator('[data-testid="receiving-row"][data-flag="clean"]').count() === 4, 'four clean rows sit between the problems');
  pass(await p.locator('td[data-bad="true"]').count() === 11, 'eleven bad cells are coloured (a lot cell, a date cell, or both)');
  const cellBg = await p.locator('td[data-bad="true"]').first().evaluate(e => getComputedStyle(e).backgroundColor);
  const okBg = await p.locator('[data-flag="clean"] td').nth(3).evaluate(e => getComputedStyle(e).backgroundColor);
  pass(cellBg !== okBg && cellBg !== 'rgba(0, 0, 0, 0)', 'a bad cell is tinted and a clean one is not');
  pass((await p.getByTestId('receiving-truncated').innerText()).includes('first 4 clean rows of 90'), 'it says clean rows were left out of a big file');
  pass(await p.locator('[data-testid="receiving-row"][data-flag="clean"] input[type=checkbox]').count() === 0, 'a clean row has nothing to tick');
  await p.screenshot({ path: 'receiving-grid.png' });
  await p.getByTestId('receiving-grid-flagged').click(); await p.waitForTimeout(300);
  pass(await p.getByTestId('receiving-row').count() === 10, 'Flagged only shows the ten');
  pass(await p.locator('[data-testid="receiving-row"][data-checked="true"]').count() === 2, 'two rows are ticked');
  await p.locator('[data-testid="receiving-row"][data-checked="false"] input[type=checkbox]').first().check(); await p.waitForTimeout(250);
  pass(/3 of 10 checked/.test(await progress(p)), 'a checkbox ticks a row');
  await p.screenshot({ path: 'receiving-grid-flagged.png' });

  console.log('== one by one');
  await p.getByTestId('receiving-mode-focus').click(); await p.waitForTimeout(400);
  const first = await p.getByTestId('receiving-focus').innerText();
  pass(/Expired/.test(first), 'the worst problem comes first');
  await p.screenshot({ path: 'receiving-focus.png' });
  await p.keyboard.press('s'); await p.waitForTimeout(200);
  pass((await p.getByTestId('receiving-focus').innerText()) !== first, 'S skips to the next one');
  await p.keyboard.press('e'); await p.waitForTimeout(250);
  pass(/4 of 10 checked/.test(await progress(p)), 'E ticks the one on screen');
  for (let i = 0; i < 12 && await p.getByTestId('receiving-focus').count(); i++) { await p.getByTestId('receiving-focus-done').click(); await p.waitForTimeout(120); }
  pass(await p.getByTestId('receiving-all-done').isVisible() && /10 of 10 checked/.test(await progress(p)), 'when the last is ticked it says everything is checked');

  console.log('== the CSV');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.getByTestId('receiving-export').click()]);
  const csv = require('fs').readFileSync(await dl.path(), 'utf8');
  const lines = csv.trim().split(/\r?\n/);
  pass(/^receiving-check-\d{4}-\d{2}-\d{2}\.csv$/.test(dl.suggestedFilename()), 'the file is named with the date');
  pass(lines.length === 11 && lines[0].startsWith('row,problem,product,lot'), 'a header and ten rows');
  pass(lines.some(l => l.includes('2027-07-06') && l.includes(',yes,')), 'the date typed from the box and the tick are in it');
  await p.context().close();

  console.log('== a long file is paged');
  p = await open({ answer: { status: 200, body: BIG } });
  await p.getByTestId('receiving-mode-grid').click(); await p.waitForTimeout(400);
  pass(await p.getByTestId('receiving-row').count() === 50 && (await p.getByTestId('receiving-page-info').innerText()).includes('Rows 1 to 50 of 120'), 'fifty rows a page, and where you are');
  await p.getByTestId('receiving-next').click(); await p.waitForTimeout(250);
  pass((await p.getByTestId('receiving-page-info').innerText()).includes('Rows 51 to 100 of 120'), 'Next moves to the second page');
  await p.getByTestId('receiving-next').click(); await p.waitForTimeout(250);
  pass(await p.getByTestId('receiving-row').count() === 20 && await p.getByTestId('receiving-next').isDisabled(), 'the last page has twenty and no Next');
  await p.getByTestId('receiving-grid-flagged').click(); await p.waitForTimeout(250);
  pass(await p.getByTestId('receiving-row').count() === 1 && (await p.getByTestId('receiving-page-info').innerText()).includes('Rows 1 to 1 of 1'), 'Flagged only goes back to the first page');
  const tall = await p.evaluate(() => { const t = document.querySelector('[data-testid="receiving-grid"]').parentElement; return t.scrollHeight <= t.clientHeight + 1 && getComputedStyle(t).overflowY === 'hidden'; });
  pass(tall, 'the table does not scroll inside itself');
  await p.context().close();

  console.log('== an older kept list still opens');
  p = await open({ upload: false });
  await p.evaluate(({ items }) => { localStorage.setItem('sentria_receiving', JSON.stringify({ name: 'old.csv', at: 1, ticks: {}, list: { rows: 100, flagged: items.length, clean: 90, items } })); }, { items: ITEMS.map(i => ({ id: i.id, row: i.row, flag: i.flag, product: i.product, batch: i.batch, expiry: i.expiry, dates: i.dates, daysExpired: i.days_expired, value: i.value, currency: i.currency, message: i.message, action: i.action })) });
  await p.reload(); await p.waitForTimeout(1500);
  await p.locator('aside nav button', { hasText: 'Receiving check' }).click(); await p.waitForTimeout(700);
  await p.getByTestId('receiving-mode-grid').click(); await p.waitForTimeout(300);
  pass(await p.getByTestId('receiving-row').count() === 10 && await p.getByTestId('receiving-grid-all').count() === 0, 'without a table the grid shows the flagged rows and no All switch');
  await p.context().close();

  console.log('== refusals');
  p = await open({ answer: { status: 403, body: { success: false, error_code: 'plan_required', message: 'The receiving check is included from the Pro plan.' } } });
  pass((await p.getByTestId('receiving-error').innerText()).includes('included from the Pro plan') && await p.getByTestId('receiving-empty').isVisible(), 'a plan refusal shows the API sentence and keeps the prompt');
  await p.context().close();
  p = await open({ answer: { status: 422, body: { detail: { success: false, error_code: 'receiving_no_columns', message: 'The file has no lot column and no expiry date column.' } } } });
  pass((await p.getByTestId('receiving-error').innerText()).includes('no lot column'), 'a file with no lot and no date column gets the API message (also when wrapped in detail)');
  await p.context().close();
  p = await open({ answer: { status: 200, body: { success: true, rows: 40, flagged: 0, clean: 40, items: [] } } });
  pass(await p.getByTestId('receiving-clean').isVisible() && (await p.locator('main').innerText()).includes('All 40 rows'), 'a clean file says so');
  await p.context().close();
  p = await open({ answer: { status: 200, body: { success: true, items: [{ flag: 'nope' }] } } });
  pass((await p.getByTestId('receiving-error').innerText()).includes('did not go through'), 'an answer that is not a worklist shows a plain failure');
  await p.context().close();

  console.log('== a refused or failed raise');
  p = await open({ raise: { status: 403, body: { success: false, error_code: 'plan_required', message: 'The receiving check is included from the Pro plan.' } } });
  await p.getByTestId('receiving-raise-button').click(); await p.waitForTimeout(500);
  pass((await p.getByTestId('receiving-error').innerText()).includes('included from the Pro plan') && await p.getByTestId('receiving-raise').isVisible() && await p.getByTestId('receiving-raised').count() === 0, 'a refusal shows the API sentence and keeps the offer');
  await p.context().close();

  console.log('== a clean sidebar');
  p = await open({ upload: false });
  pass(await p.getByTestId('receiving-count').count() === 0, 'no count before any file');
  await p.context().close();

  console.log('== French');
  p = await open({ lang: 'fr' });
  const frText = await p.locator('main').innerText();
  pass(/0 sur 10 vérifiés/.test(await progress(p)) && frText.includes('Colonnes') && frText.includes('Mis de côté, fait'), 'French labels');
  pass(!/Set aside|checked|Board/.test(frText.replace(/Action for [^.]*\./g, '')), 'no English left on the screen except the API text');
  pass((await p.getByTestId('receiving-raise').innerText()).includes('une alerte par ligne') && (await p.getByTestId('receiving-count').getAttribute('aria-label')) === '10 à vérifier', 'the offer and the sidebar count are in French');
  await p.getByTestId('receiving-mode-grid').click(); await p.waitForTimeout(300);
  await p.screenshot({ path: 'receiving-fr-grid.png' });
  await p.getByTestId('receiving-mode-board').click(); await p.waitForTimeout(300);
  await p.screenshot({ path: 'receiving-fr.png' });
  await p.context().close();

  console.log('== dark');
  p = await open({ theme: 'dark' });
  await p.screenshot({ path: 'receiving-dark.png' });
  await p.getByTestId('receiving-mode-grid').click(); await p.waitForTimeout(300);
  await p.screenshot({ path: 'receiving-dark-grid.png' });
  await p.getByTestId('receiving-mode-board').click(); await p.waitForTimeout(300);
  pass(await p.getByTestId('receiving-card').count() === 10 && await overflow(p) <= 0, 'dark: all cards, no horizontal overflow');
  await p.context().close();

  console.log('== 390 px');
  p = await open({ vw: 390, vh: 844 });
  await p.screenshot({ path: 'receiving-390-board.png', fullPage: true });
  pass(await overflow(p) <= 0, 'board: no horizontal overflow');
  await p.getByTestId('receiving-mode-grid').click(); await p.waitForTimeout(300);
  await p.screenshot({ path: 'receiving-390-grid.png', fullPage: true });
  pass(await overflow(p) <= 0, 'grid: no horizontal overflow');
  pass(await p.getByTestId('receiving-row').count() === 14 && await p.getByTestId('receiving-grid-all').isVisible(), 'grid on a phone: every row and the switch');
  await p.getByTestId('receiving-mode-focus').click(); await p.waitForTimeout(300);
  await p.screenshot({ path: 'receiving-390-focus.png', fullPage: true });
  pass(await overflow(p) <= 0, 'one by one: no horizontal overflow');
  pass(p._errs.length === 0, 'no page errors' + (p._errs.length ? ': ' + p._errs[0] : ''));
  await p.context().close();

  await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
