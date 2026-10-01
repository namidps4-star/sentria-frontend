// F-VIZPREMIUM, charts part: the dashboard's trend chart overlays sectors (one
// line each, one axis, a legend, hover and keyboard readout), its "…" menu
// really works (sectors, measure, period), and the breakdown is a donut of at
// most six slices. The data layer (lib/chart-series.ts) is tested on its own
// first, then the real build is driven in light, dark and 390 px.
process.env.TZ = 'Europe/Paris'; // before any Date: day boundaries must match the browser's
const fs = require('fs');
const path = require('path');
const ts = require(path.join(__dirname, '..', '..', 'node_modules', 'typescript'));
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const ROOT = path.join(__dirname, '..', '..');

// ---- run the real TypeScript files in node (the "@/…" imports resolve to the repo)
const cache = {};
function load(file) {
  if (cache[file]) return cache[file].exports;
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = cache[file] = { exports: {} };
  new Function('require', 'module', 'exports', js)(id => load(id.replace(/^@\//, '') + '.ts'), mod, mod.exports);
  return mod.exports;
}

const SECTORS = ['industry', 'health', 'agriculture', 'transportation', 'logistics', 'energy', 'commerce', 'eac'];
const NAMES = { industry: 'Industry', health: 'Health', agriculture: 'Agriculture', transportation: 'Transport', logistics: 'Logistics', energy: 'Energy', commerce: 'Retail', eac: 'EAC' };
const FAMILIES = ['stock', 'temperature', 'pressure', 'fuel', 'wait', 'load', 'soil', 'leak'];
const at = (daysAgo, hour = 12) => { const d = new Date(); d.setHours(hour, 0, 0, 0); d.setDate(d.getDate() - daysAgo); return d; };

// ---- the fixture: sector `si` raises (si + d) % 4 alerts, d days ago, worth 100 * (si + 1) each
const perDay = (si, d) => (si + d) % 4;
function fixture(days = 30, currencyOf = () => '€') {
  const out = []; let id = 0;
  SECTORS.forEach((sector, si) => {
    for (let d = 0; d < days; d++) for (let k = 0; k < perDay(si, d); k++) {
      out.push({ id: id++, equipment: `${sector} ${d}-${k}`, sector, business_type: null, severity: (d + k) % 3 ? 'WARNING' : 'CRITICAL', date: at(d, 8 + k).toISOString(),
        alert_key: `${sector}.${FAMILIES[(si * 3 + d) % 8]}.x`, message: 'm', params: [['value', 100 * (si + 1)], ['currency', currencyOf(sector)]] });
    }
  });
  return out;
}
const expectedAt = (si, d) => perDay(si, d);

console.log('== data layer: lib/chart-series.ts');
{
  const C = load('lib/chart-series.ts');
  pass(eq(C.SERIES_ORDER, SECTORS), 'the sector order is fixed: ' + C.SERIES_ORDER.join(', '));
  pass(C.seriesKeyOf({ sector: 'health' }) === 'health' && C.seriesKeyOf({ sector: 'mystery' }) === 'other' && C.seriesKeyOf({ sector: null }) === 'other' && C.seriesKeyOf({}) === 'other', 'a sector keeps its key; an unknown or missing one goes to "other"');
  pass(SECTORS.every((s, i) => C.seriesColor(s) === `var(--series-${i + 1})`) && C.seriesColor('other') === 'var(--series-other)', 'each sector has its own theme token (position in the order), "other" the neutral');
  pass(eq(C.availableSeries([{ date: '', sector: 'commerce' }, { date: '', sector: 'mystery' }, { date: '', sector: 'industry' }]), ['industry', 'commerce', 'other']), 'available series come back in the fixed order, "other" last');

  const now = new Date(2026, 2, 30, 15, 0); // the day after Europe's clock change (29 March 2026)
  const days = C.dayStarts(30, now);
  pass(days.length === 30 && days[29].getDate() === 30 && days[0].getDate() === 1 && days[0].getMonth() === 2, '30 days end today (30 Mar) and start on 1 Mar');
  pass(days.every((d, i) => i === 0 || (d.getDate() - days[i - 1].getDate() === 1 || d.getDate() === 1)) && days.every(d => d.getHours() === 0), 'one calendar day at a time, all at local midnight, across the daylight-saving change');
  const dst = [new Date(2026, 2, 28, 23, 59), new Date(2026, 2, 29, 0, 0), new Date(2026, 2, 29, 23, 30), new Date(2026, 2, 30, 0, 5)].map(d => ({ date: d.toISOString(), sector: 'health' }));
  const b = C.bucketAlerts(dst, { keys: ['health'], days: 3, metric: 'count', now });
  pass(eq(b.series[0].values, [1, 2, 1]), `alerts either side of midnight land on the right day, on the 23-hour day too (${b.series[0].values})`);
  const edge = C.bucketAlerts([{ date: at(0).toISOString(), sector: 'health' }, { date: at(7).toISOString(), sector: 'health' }, { date: at(-1).toISOString(), sector: 'health' }, { date: 'not a date', sector: 'health' }, { date: at(1).toISOString(), sector: 'industry' }], { keys: ['health'], days: 7, metric: 'count' });
  pass(eq(edge.series[0].values, [0, 0, 0, 0, 0, 0, 1]) && edge.series[0].total === 1, 'older than the window, in the future, unreadable, or another sector: not counted');

  const money = [
    { date: at(0).toISOString(), sector: 'health', params: [['value', 100], ['currency', '€']] },
    { date: at(0).toISOString(), sector: 'health', params: [['value', 50.5], ['currency', '€'], ['basis', 'sales']] },
    { date: at(0).toISOString(), sector: 'health', params: [['value', 7]] }, // a bare value is a rate, never money
    { date: at(0).toISOString(), sector: 'health' },
  ];
  const v = C.bucketAlerts(money, { keys: ['health'], days: 7, metric: 'value' });
  pass(v.series[0].values[6] === 150.5 && v.series[0].approx === true, 'value at risk sums only alerts with a currency, and flags estimates');
  pass(C.bucketAlerts(money, { keys: ['health'], days: 7, metric: 'count' }).series[0].values[6] === 4, 'the count metric counts every alert');
  pass(C.valueMetric(money).available === true && C.valueMetric(money).symbol === '€', 'one currency: the value metric is available');
  pass(C.valueMetric([...money, { date: '', sector: 'x', params: [['value', 1], ['currency', '$']] }]).reason === 'mixed', 'two currencies: not on one axis');
  pass(C.valueMetric([{ date: '', params: [['value', 5]] }]).reason === 'none', 'no money anywhere: unavailable');

  const s0 = C.niceScale(0), s3 = C.niceScale(3, { integer: true }), s7 = C.niceScale(7, { integer: true }), s10 = C.niceScale(10, { integer: true }), sm = C.niceScale(12400);
  pass(eq(s0, { max: 1, ticks: [0, 1] }), 'an empty axis still has a scale');
  pass(eq(s3.ticks, [0, 1, 2, 3]) && eq(s7.ticks, [0, 5, 10]) && eq(s10.ticks, [0, 5, 10]), `count axes land on whole round numbers (${s3.ticks} | ${s7.ticks} | ${s10.ticks})`);
  pass(sm.ticks.length <= 4 && sm.max >= 12400 && sm.ticks[0] === 0 && sm.ticks.every(t => t % 2500 === 0), `a money axis too (${sm.ticks})`);
  pass([1, 2, 5, 9, 14, 37, 120, 999, 5000].every(h => { const s = C.niceScale(h, { integer: true }); return s.ticks.length <= 4 && s.max >= h && s.ticks.every(Number.isInteger); }), 'never more than four ticks, never below the data, whole numbers for counts');

  const parts = n => Array.from({ length: n }, (_, i) => ({ label: 'L' + i, value: n - i }));
  const six = C.foldSlices(parts(6), 'Other'), nine = C.foldSlices(parts(9), 'Other');
  pass(six.length === 6 && !six.some(s => s.key === 'other') && eq(six.map(s => s.key), ['slice-1', 'slice-2', 'slice-3', 'slice-4', 'slice-5', 'slice-6']), 'six parts or fewer are shown as they are');
  pass(nine.length === 6 && nine[5].key === 'other' && nine[5].label === 'Other' && nine[5].value === 4 + 3 + 2 + 1, 'more than six: the five biggest, the rest folded into "Other"');
  pass(Math.abs(nine.reduce((a, s) => a + s.share, 0) - 1) < 1e-9 && eq(C.foldSlices([{ label: 'a', value: 0 }], 'Other'), []), 'shares add up to 1; nothing to show is nothing');
  pass(C.foldSlices(parts(40), 'Other').length === 6, 'forty families still make six slices');
  pass(C.sliceColor('slice-3') === 'var(--slice-3)' && C.sliceColor('other') === 'var(--slice-other)', 'slice colours are the ramp tokens');
}

console.log('== source: tokens only, nothing left over');
{
  for (const f of ['components/sentria/charts.tsx', 'components/sentria/chart-menu.tsx', 'lib/chart-series.ts']) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    pass(!/#[0-9a-fA-F]{3,8}\b/.test(src.replace(/\/\*[\s\S]*?\*\//g, '')), `${f}: no colour literal`);
    pass(!/\bdark:/.test(src), `${f}: no dark: class`);
  }
  const charts = fs.readFileSync(path.join(ROOT, 'components/sentria/charts.tsx'), 'utf8');
  pass(!/export function (AreaChart|BarChart)/.test(charts), 'the old single-line AreaChart and the bar chart are gone');
  const dash = fs.readFileSync(path.join(ROOT, 'components/sentria/dashboard-view.tsx'), 'utf8');
  pass(!/aria-label=\{tx\("Options", "Options"\)\}/.test(dash), 'the dead "…" button is gone from the dashboard');
}

// ---- browser helpers
const LS = { sentria_language: 'en', sentria_onboarded: 'true', sentria_sector: 'health', sentria_company_name: 'Acme', sentria_sectors: JSON.stringify(SECTORS), sentria_business_type: 'pharmacie' };
async function open(browser, { alerts, theme = 'light', width = 1440, scheme = 'light', lang = 'en', pill = 'All' } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 1000 }, locale: lang === 'fr' ? 'fr-FR' : 'en-US', timezoneId: 'Europe/Paris', colorScheme: scheme });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route(/onrender\.com\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: new URL(r.request().url()).pathname === '/alerts' ? JSON.stringify(alerts) : '{"recommendations":[],"assignments":[],"contractors":[]}' }));
  await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } }, { ...LS, sentria_theme: theme, sentria_language: lang });
  await signedIn(p, 'u', 'a@b.c', { plan: 'entreprise' });
  await p.goto(APP_URL); await p.waitForTimeout(1800);
  if (pill) { await p.getByRole('button', { name: new RegExp('^' + pill + '\\s*\\d*$') }).first().click(); await p.waitForTimeout(500); }
  await p.locator('[data-chart="line"]').first().evaluate(el => el.closest('.rounded-3xl').scrollIntoView({ block: 'center' })); await p.waitForTimeout(300);
  return { ctx, p, errs };
}
const lines = p => p.locator('[data-chart="line"] path[data-series]');
const seriesKeys = p => lines(p).evaluateAll(els => els.map(e => e.getAttribute('data-series')));
const legendOf = p => p.locator('[data-chart="line"] ~ ul[data-legend] li');
// The anchors of a series' path ("M x y C c1 c2 x y C …"): every sixth number after the start.
const anchorsOf = d => { const n = d.match(/-?\d+(\.\d+)?/g).map(Number); const out = [[n[0], n[1]]]; for (let i = 2; i + 5 < n.length + 1; i += 6) out.push([n[i + 4], n[i + 5]]); return out; };
async function plotXs(p) { // the x of the first and last point, in page coordinates
  return p.evaluate(() => { const box = document.querySelector('[data-chart="line"]').getBoundingClientRect(); const d = document.querySelector('[data-chart="line"] path[data-series]').getAttribute('d'); const n = d.match(/-?\d+(\.\d+)?/g).map(Number); const xs = [n[0]]; for (let i = 2; i + 5 < n.length + 1; i += 6) xs.push(n[i + 4]); return { left: box.left, top: box.top, first: xs[0], last: xs[xs.length - 1], n: xs.length, h: box.height }; });
}
async function hoverDay(p, i, n) { const g = await plotXs(p); await p.mouse.move(g.left + g.first + ((g.last - g.first) * i) / (n - 1), g.top + g.h / 2); await p.waitForTimeout(120); }
const tipRows = p => p.locator('[data-tooltip] li').evaluateAll(els => els.map(e => e.innerText.replace(/\s+/g, ' ').trim()));
const rgbOf = (p, token) => p.evaluate(t => { const e = document.createElement('i'); e.style.background = `var(${t})`; document.body.appendChild(e); const c = getComputedStyle(e).backgroundColor; e.remove(); return c; }, token);
const menuBtn = p => p.getByRole('button', { name: 'Chart options' });
const menu = p => p.getByRole('dialog', { name: 'Chart options' });

(async () => {
  const b = await chromium.launch(LAUNCH);
  const all = fixture();

  console.log('== overlay: every sector on one chart, one axis');
  {
    const { ctx, p, errs } = await open(b, { alerts: all });
    const keys = await seriesKeys(p);
    pass(eq(keys, SECTORS), `All pill: one line per sector, in the fixed order (${keys.length})`);
    const strokes = await lines(p).evaluateAll(els => els.map(e => e.getAttribute('stroke')));
    pass(eq(strokes, SECTORS.map((_, i) => `var(--series-${i + 1})`)), 'each line is drawn with its sector\'s own token');
    const names = await legendOf(p).evaluateAll(els => els.map(e => e.innerText.replace(/\s+/g, ' ').trim()));
    const totals = SECTORS.map((s, si) => Array.from({ length: 7 }, (_, d) => expectedAt(si, d)).reduce((a, c) => a + c, 0));
    pass(eq(names, SECTORS.map((s, i) => `${NAMES[s]} ${totals[i]}`)), `a legend names every line, with its total for the period (${names.slice(0, 3).join(' | ')} …)`);
    const swatches = await legendOf(p).evaluateAll(els => els.map(e => e.querySelector('span').style.background));
    pass(swatches.every((s, i) => s.includes(`--series-${i + 1}`)), 'legend swatches use the same tokens as the lines');
    const ticks = await p.evaluate(() => [...document.querySelectorAll('[data-chart="line"] svg text')].filter(t => /^[\d.,KkM\s]+$/.test(t.textContent) && t.getAttribute('text-anchor') === 'end').map(t => t.getAttribute('x')));
    pass(ticks.length >= 2 && new Set(ticks).size === 1, `one value axis: every tick label shares one x (${ticks.length} labels)`);
    pass(await p.locator('[data-chart="line"] svg text').evaluateAll(els => els.every(e => !/%$/.test(e.textContent))), 'no second axis in another unit');
    pass(errs.length === 0, 'no page errors');
    await ctx.close();
  }

  console.log('== the trend lines are smooth curves');
  {
    const { ctx, p } = await open(b, { alerts: all });
    const ds = await p.locator('[data-chart="line"] path[data-series]').evaluateAll(els => els.map(e => e.getAttribute('d')));
    pass(ds.length === 8 && ds.every(d => /^M [\d.]+ [\d.]+ C /.test(d) && !/ L /.test(d)), `all ${ds.length} lines are curves (cubic segments), not straight ones`);
    pass(ds.every(d => anchorsOf(d).length === 7), '…through seven points, one per day');
    const plot = await p.evaluate(() => { const svg = document.querySelector('[data-chart="line"] svg'); const ys = [...svg.querySelectorAll('line')].map(l => +l.getAttribute('y1')); return { top: Math.min(...ys), bottom: Math.max(...ys) }; });
    const allY = ds.flatMap(d => d.match(/-?\d+(\.\d+)?/g).map(Number).filter((_, i) => i % 2 === 1));
    pass(Math.min(...allY) >= plot.top - 0.5 && Math.max(...allY) <= plot.bottom + 0.5, `…and no curve leaves the plot, so none dips below zero or past the top (y ${Math.min(...allY).toFixed(1)}–${Math.max(...allY).toFixed(1)} inside ${plot.top.toFixed(1)}–${plot.bottom.toFixed(1)})`);
    await hoverDay(p, 3, 7);
    const dot = await p.locator('[data-crosshair] circle').first().evaluate(el => [+el.getAttribute('cx'), +el.getAttribute('cy')]);
    const first = anchorsOf(ds[0]).find(a => Math.abs(a[0] - dot[0]) < 0.6);
    pass(first && Math.abs(first[1] - dot[1]) < 0.6, 'the hover marker sits on the curve (it passes through each day\'s value)');
    await p.getByRole('button', { name: 'Chart options' }).click(); await p.waitForTimeout(250);
    for (const s of SECTORS.filter(s => s !== 'health')) await p.getByRole('dialog', { name: 'Chart options' }).locator(`input[data-sector="${s}"]`).uncheck();
    await p.waitForTimeout(200);
    const one = await p.locator('[data-chart="line"] svg path').evaluateAll(els => els.map(e => e.getAttribute('d')));
    const area = one.find(d => /Z$/.test(d || ''));
    pass(!!area && /^M [\d.]+ [\d.]+ C /.test(area) && / L [\d.]+ [\d.]+ L [\d.]+ [\d.]+ Z$/.test(area), 'a single sector\'s soft area follows the same curve, closed along the bottom');
    await ctx.close();
  }

  console.log('== readout: hover, keyboard');
  {
    const { ctx, p } = await open(b, { alerts: all });
    pass(await p.locator('[data-tooltip]').count() === 0, 'no tooltip until you point at the chart');
    await hoverDay(p, 3, 7); // the 4th day: 3 days ago
    pass(await p.locator('[data-crosshair]').count() === 1 && await p.locator('[data-tooltip]').count() === 1, 'pointing shows a crosshair and a tooltip');
    const rows = await tipRows(p);
    const want = SECTORS.map((s, si) => `${NAMES[s]} ${expectedAt(si, 3)}`);
    pass(eq(rows, want), `the tooltip lists every sector's count for that day: ${rows.slice(0, 4).join(' | ')} …`);
    const day = await p.locator('[data-tooltip] p').innerText();
    pass(day.includes(String(at(3).getDate())), `…headed with the day (${day})`);
    pass(await p.locator('[data-crosshair] circle').count() === 8, 'one marker per line on the crosshair');
    await p.mouse.move(5, 5); await p.waitForTimeout(150);
    pass(await p.locator('[data-tooltip]').count() === 0, 'moving away hides it');
    await p.screenshot({ path: 'charts-readout-light.png' });

    await p.locator('[data-chart="line"]').focus();
    await p.keyboard.press('End'); await p.waitForTimeout(80);
    pass(eq(await tipRows(p), SECTORS.map((s, si) => `${NAMES[s]} ${expectedAt(si, 0)}`)), 'keyboard: End reads today');
    await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(80);
    pass(eq(await tipRows(p), SECTORS.map((s, si) => `${NAMES[s]} ${expectedAt(si, 2)}`)), 'keyboard: ArrowLeft twice reads two days ago');
    await p.keyboard.press('Home'); await p.waitForTimeout(80);
    pass(eq(await tipRows(p), SECTORS.map((s, si) => `${NAMES[s]} ${expectedAt(si, 6)}`)), 'keyboard: Home reads the first day');
    pass((await p.locator('[data-chart="line"] .sr-only').innerText()).includes('Industry'), 'a screen reader is told the readout (aria-live)');
    await p.keyboard.press('Escape'); await p.waitForTimeout(80);
    pass(await p.locator('[data-tooltip]').count() === 0, 'Escape clears it');
    pass((await p.locator('[data-chart="line"]').getAttribute('aria-label')).includes('7'), 'the chart is a labelled group for assistive tech');
    await ctx.close();
  }

  console.log('== the "…" menu: sectors, measure, period');
  {
    const { ctx, p } = await open(b, { alerts: all });
    pass(await menu(p).isHidden(), 'closed to begin with');
    await menuBtn(p).click(); await p.waitForTimeout(300);
    pass(await menu(p).isVisible() && await menuBtn(p).getAttribute('aria-expanded') === 'true', 'the button opens a real panel');
    const boxes = await menu(p).locator('input[data-sector]').evaluateAll(els => els.map(e => [e.getAttribute('data-sector'), e.checked]));
    pass(eq(boxes, SECTORS.map(s => [s, true])), 'one checkbox per sector, in the colour order, all on');
    const swatchTokens = await menu(p).locator('input[data-sector] ~ span').evaluateAll(els => els.filter(e => e.style.background).map(e => e.style.background));
    pass(swatchTokens.length === 8 && swatchTokens.every((s, i) => s.includes(`--series-${i + 1}`)), 'each checkbox shows its sector\'s colour');

    await menu(p).locator('input[data-sector="industry"]').uncheck(); await menu(p).locator('input[data-sector="logistics"]').uncheck(); await p.waitForTimeout(150);
    pass(eq(await seriesKeys(p), SECTORS.filter(s => s !== 'industry' && s !== 'logistics')), 'unchecking two sectors removes their lines');
    pass((await legendOf(p).count()) === 6, '…and their legend entries');
    pass(eq(await lines(p).evaluateAll(els => els.map(e => e.getAttribute('stroke'))), [2, 3, 4, 6, 7, 8].map(n => `var(--series-${n})`)), 'the colours of the others do not move');
    for (const s of SECTORS.filter(s => !['health'].includes(s) && s !== 'industry' && s !== 'logistics')) await menu(p).locator(`input[data-sector="${s}"]`).uncheck();
    await p.waitForTimeout(150);
    pass(eq(await seriesKeys(p), ['health']) && await menu(p).locator('input[data-sector="health"]').isDisabled(), 'the last sector cannot be unchecked');
    pass(await p.locator('[data-chart="line"] ~ ul[data-legend]').count() === 0, 'a single line has no legend');
    pass(await p.locator('[data-chart="line"] svg linearGradient').count() === 1, '…and keeps the soft area under it');

    await menu(p).getByRole('button', { name: 'Reset' }).click(); await p.waitForTimeout(150);
    pass(eq(await seriesKeys(p), SECTORS), 'Reset puts every sector back');
    pass(await menu(p).getByRole('button', { name: 'Reset' }).isDisabled(), 'Reset is off when nothing is changed');

    await menu(p).locator('label', { hasText: '30 d' }).click(); await p.waitForTimeout(200);
    pass((await p.locator('[data-chart="line"]').evaluate(el => el.closest('.rounded-3xl').innerText)).includes('Last 30 days'), 'period 30 d: the subtitle says so');
    const g = await plotXs(p);
    pass(g.n === 30, `…and the lines have 30 points (${g.n})`);
    const labels = await p.evaluate(() => [...document.querySelectorAll('[data-chart="line"] svg text')].filter(t => t.getAttribute('y') && !t.getAttribute('dy')).map(t => ({ x: +t.getAttribute('x'), t: t.textContent })));
    const gaps = labels.slice(1).map((l, i) => Math.round(l.x - labels[i].x));
    pass(labels.length >= 3 && Math.max(...gaps.slice(0, -1)) - Math.min(...gaps.slice(0, -1)) <= 2, `date labels are evenly spaced (gaps ${gaps})`);
    const today = await p.evaluate(() => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));
    pass(labels.at(-1).t === today, `…and the last one is today (${labels.at(-1).t})`);
    await menu(p).locator('label', { hasText: '90 d' }).click(); await p.waitForTimeout(200);
    pass((await plotXs(p)).n === 90, 'period 90 d: 90 points');
    pass(await p.locator('[data-chart="line"] ~ ul[data-legend] li').count() === 8, '…same legend');

    await menu(p).locator('label', { hasText: '7 d' }).click();
    await menu(p).locator('input[data-metric="value"]').check(); await p.waitForTimeout(200);
    const sub = await p.locator('[data-chart="line"]').evaluate(el => el.closest('.rounded-3xl').innerText);
    pass(/value at risk/i.test(sub) && sub.includes('€'), 'measure: value at risk: the subtitle says what is plotted, with its currency');
    await hoverDay(p, 2, 7); // left of the open panel, which covers the right of the chart
    const money = await tipRows(p);
    const wantMoney = SECTORS.map((s, si) => `${NAMES[s]} ${(expectedAt(si, 4) * 100 * (si + 1)).toLocaleString('en-GB')} €`);
    pass(eq(money.map(r => r.replace(/\u202f|\u00a0/g, ' ')), wantMoney), `the tooltip shows amounts with the currency: ${money.slice(0, 3).join(' | ')} …`);
    await p.screenshot({ path: 'charts-value-light.png' });

    await menuBtn(p).focus(); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    pass(await menu(p).isHidden(), 'Escape closes the panel');
    await menuBtn(p).click(); await p.waitForTimeout(250); await p.locator('[data-chart="line"]').click({ position: { x: 40, y: 12 } }); await p.waitForTimeout(300);
    pass(await menu(p).isHidden(), 'a click outside closes it');
    await ctx.close();
  }

  console.log('== pills: a pick belongs to the pill it was made on');
  {
    const { ctx, p } = await open(b, { alerts: all });
    await menuBtn(p).click(); await p.waitForTimeout(250);
    await menu(p).locator('input[data-sector="industry"]').uncheck(); await menu(p).locator('input[data-sector="logistics"]').uncheck();
    await p.locator('[data-chart="line"]').click({ position: { x: 40, y: 12 } }); await p.waitForTimeout(300);
    await p.getByRole('button', { name: /^Health\s*\d+$/ }).click(); await p.waitForTimeout(400);
    pass(eq(await seriesKeys(p), ['health']), 'the Health pill shows Health only');
    pass(eq(await lines(p).evaluateAll(els => els.map(e => e.getAttribute('stroke'))), ['var(--series-2)']), '…in Health\'s colour, the same as on the overlay');
    await p.getByRole('button', { name: /^All\s*\d+$/ }).click(); await p.waitForTimeout(400);
    pass(eq(await seriesKeys(p), SECTORS.filter(s => s !== 'industry' && s !== 'logistics')), 'back on All: the pick made there is still there');
    await menuBtn(p).click(); await p.waitForTimeout(250); await menu(p).locator('input[data-sector="industry"]').check(); await p.waitForTimeout(100);
    pass((await seriesKeys(p)).includes('industry') && eq((await seriesKeys(p)).slice(0, 2), ['industry', 'health']), 'a sector added again takes its place in the fixed order');
    await p.getByRole('button', { name: /^Health\s*\d+$/ }).click(); await p.waitForTimeout(400);
    await menuBtn(p).click(); await p.waitForTimeout(250);
    pass(await menu(p).locator('input[data-sector]').count() === 8, 'on a sector pill the menu still offers every sector to overlay');
    await menu(p).locator('input[data-sector="energy"]').check(); await p.waitForTimeout(100);
    pass(eq(await seriesKeys(p), ['health', 'energy']), 'adding Energy to Health overlays the two');
    await ctx.close();
  }

  console.log('== the breakdown: a donut of at most six slices');
  {
    const { ctx, p } = await open(b, { alerts: all });
    const counts = {}; all.forEach(a => { const f = a.alert_key.split('.')[1]; counts[f] = (counts[f] || 0) + 1; });
    const sorted = Object.values(counts).sort((a, b) => b - a);
    const wantVals = [...sorted.slice(0, 5), sorted.slice(5).reduce((a, c) => a + c, 0)];
    const rows = await p.locator('[data-chart="donut"] ul li').evaluateAll(els => els.map(e => [...e.querySelectorAll('span')].map(s => s.innerText.trim()).filter(Boolean)));
    pass(rows.length === 6 && rows[5][0] === 'Other', `${Object.keys(counts).length} alert families: five slices and "Other" (${rows.map(r => r[0]).join(', ')})`);
    pass(eq(rows.map(r => +r[1]), wantVals), `the values are the five biggest and the sum of the rest (${wantVals})`);
    const total = all.length;
    pass(rows.reduce((a, r) => a + +r[1], 0) === total && (await p.locator('[data-donut-center] span').first().innerText()) === String(total), `nothing is dropped: the legend adds up to the centre (${total})`);
    pass(await p.locator('[data-chart="donut"] path[data-slice], [data-chart="donut"] circle[data-slice]').count() === 6, 'six slices drawn');
    const colors = await p.locator('[data-chart="donut"] ul li > span:first-child').evaluateAll(els => els.map(e => e.style.background));
    pass(colors.slice(0, 5).every((c, i) => c.includes(`--slice-${i + 1}`)) && colors[5].includes('--slice-other'), 'ranked colours, "Other" in the neutral');
    pass(eq(await p.locator('[data-chart="donut"] [data-slice]').evaluateAll(els => els.map(e => e.getAttribute('stroke'))), ['var(--slice-1)', 'var(--slice-2)', 'var(--slice-3)', 'var(--slice-4)', 'var(--slice-5)', 'var(--slice-other)']), 'the slices carry the same tokens as their legend rows');
    await p.locator('[data-chart="donut"] ul li').nth(1).hover(); await p.waitForTimeout(150);
    const centre = await p.locator('[data-donut-center]').innerText();
    pass(centre.includes(String(wantVals[1])) && centre.includes('%'), `pointing at a legend row reads that slice in the centre (${centre.replace(/\n/g, ' · ')})`);
    await p.locator('[data-chart="donut"] ul li').nth(1).evaluate(el => el.dispatchEvent(new PointerEvent('pointerleave')));
    await p.screenshot({ path: 'charts-donut-light.png' });
    await ctx.close();
  }

  console.log('== alerts that carry no family: critical and warning, in their status colours');
  {
    const bare = Array.from({ length: 12 }, (_, k) => ({ id: k, equipment: 'E' + k, sector: 'health', business_type: null, severity: k < 3 ? 'CRITICAL' : 'WARNING', date: at(k % 5).toISOString(), alert_key: null, message: 'm' }));
    const { ctx, p } = await open(b, { alerts: bare });
    const rows = await p.locator('[data-chart="donut"] ul li').evaluateAll(els => els.map(e => ({ t: e.innerText.replace(/\s+/g, ' '), bg: e.querySelector('span').style.background })));
    pass(rows.length === 2 && rows[0].t.startsWith('Warnings 9') && rows[1].t.startsWith('Critical 3'), `two slices, biggest first (${rows.map(r => r.t).join(' | ')})`);
    pass(rows[1].bg.includes('--tag-danger-fg') && rows[0].bg.includes('--tag-warning-fg'), 'Critical uses the danger colour, Warnings the warning colour, whatever their order');
    await ctx.close();
  }

  console.log('== nothing in the period, and money in two currencies');
  {
    const old = fixture(60, s => (s === 'energy' ? '$' : '€')).filter(a => new Date(a.date) < at(40));
    const { ctx, p, errs } = await open(b, { alerts: old });
    pass(await p.locator('[data-chart="line"]').getByText('No alerts in this period.').isVisible() && await lines(p).count() === 0, 'only old alerts, 7 days: an honest empty note, not a flat line');
    await menuBtn(p).click(); await p.waitForTimeout(250);
    const value = menu(p).locator('input[data-metric="value"]');
    pass(await value.isDisabled() && await menu(p).getByText('Mixed currencies', { exact: false }).isVisible(), 'two currencies: value at risk is off, and says why');
    await menu(p).locator('label', { hasText: '90 d' }).click(); await p.waitForTimeout(200);
    pass(await lines(p).count() > 0 && await p.locator('[data-chart="line"]').getByText('No alerts in this period.').count() === 0, '90 d reaches them');
    pass(errs.length === 0, 'no page errors');
    await ctx.close();
  }

  console.log('== French');
  {
    const { ctx, p } = await open(b, { alerts: all, lang: 'fr', pill: 'Tous' });
    await p.getByRole('button', { name: 'Options du graphique' }).click(); await p.waitForTimeout(250);
    const t = await p.getByRole('dialog', { name: 'Options du graphique' }).innerText();
    pass(/Secteurs superposés/i.test(t) && /Mesure/i.test(t) && /Période/i.test(t) && /Valeur à risque/.test(t) && /Réinitialiser/.test(t) && /30 j/.test(t), `the menu is in French (${t.replace(/\n+/g, ' | ').slice(0, 200)})`);
    pass((await p.locator('[data-chart="line"]').evaluate(el => el.closest('.rounded-3xl').innerText)).includes('7 derniers jours'), 'the subtitle too');
    pass(/Légende/.test(await p.locator('[data-chart="line"] ~ ul[data-legend]').getAttribute('aria-label')), 'and the legend\'s name');
    await ctx.close();
  }

  console.log('== themes and a phone');
  {
    const want = fs.readFileSync(path.join(ROOT, 'app/globals.css'), 'utf8');
    const val = (block, n) => new RegExp(`/\\* palette:${block} \\*/[\\s\\S]*?--${n}:\\s*(#[0-9a-f]{6})`).exec(want)[1];
    for (const [name, theme, scheme, block, w] of [['light', 'light', 'light', 'light', 1440], ['dark', 'dark', 'light', 'dark', 1440], ['system, OS dark', 'system', 'dark', 'dark', 1440], ['system, OS light', 'system', 'light', 'light', 1440]]) {
      const { ctx, p } = await open(b, { alerts: all, theme, scheme, width: w });
      const got = await p.evaluate(() => [1, 2, 8].map(n => getComputedStyle(document.documentElement).getPropertyValue('--series-' + n).trim()).concat(getComputedStyle(document.documentElement).getPropertyValue('--slice-1').trim()));
      pass(eq(got, [val(block, 'series-1'), val(block, 'series-2'), val(block, 'series-8'), val(block, 'slice-1')]), `${name}: the chart tokens resolve to the ${block} palette`);
      const stroke = await p.locator('[data-chart="line"] path[data-series="health"]').evaluate(el => getComputedStyle(el).stroke);
      pass(stroke === await rgbOf(p, '--series-2'), `${name}: a line is really painted in its token (${stroke})`);
      if (theme !== 'system') await p.screenshot({ path: `charts-${name}-1440.png` });
      await ctx.close();
    }
    for (const theme of ['light', 'dark']) {
      const { ctx, p, errs } = await open(b, { alerts: all, theme, width: 390 });
      const m = await p.evaluate(() => ({ page: document.documentElement.scrollWidth, win: innerWidth, svg: document.querySelector('[data-chart="line"] svg').getBoundingClientRect().width, box: document.querySelector('[data-chart="line"]').getBoundingClientRect().width, donut: document.querySelector('[data-chart="donut"]').getBoundingClientRect().width }));
      pass(m.page <= m.win + 1 && m.svg <= m.box + 1 && m.donut <= m.win, `${theme}, 390 px: no sideways scroll; the chart fits its card (${m.svg}/${m.box}px)`);
      await hoverDay(p, 6, 7);
      pass(await p.locator('[data-tooltip]').count() === 1 && await p.evaluate(() => { const t = document.querySelector('[data-tooltip]').getBoundingClientRect(); return t.left >= 0 && t.right <= innerWidth; }), `${theme}, 390 px: the tooltip stays on screen at the last day`);
      await menuBtn(p).click(); await p.waitForTimeout(250);
      pass(await p.evaluate(() => { const r = document.querySelector('[role=dialog][aria-label="Chart options"]').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }), `${theme}, 390 px: the menu stays on screen`);
      await p.screenshot({ path: `charts-${theme}-390.png` });
      pass(errs.length === 0, `${theme}, 390 px: no page errors`);
      await ctx.close();
    }
  }

  await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL OK');
  process.exit(fails ? 1 : 0);
})();
