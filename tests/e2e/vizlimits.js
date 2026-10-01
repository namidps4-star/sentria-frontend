// F-VIZPREMIUM, the rest of the charts: readings against the limit they
// crossed (gauges), stock against its minimum (bars with one threshold line),
// and the smooth line on the KPI tiles' sparklines (the "Critical stockouts"
// one included). The limits come from the alert's params, written by the
// backend (tests/check_alert_limits.py there); alerts without them show
// neither chart. The data layer is tested on its own first, then the build.
process.env.TZ = 'Europe/Paris';
const fs = require('fs');
const path = require('path');
const ts = require(path.join(__dirname, '..', '..', 'node_modules', 'typescript'));
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const near = (a, b, tol = 0.06) => Math.abs(a - b) <= tol;
const ROOT = path.join(__dirname, '..', '..');

const cache = {};
function load(file) {
  if (cache[file]) return cache[file].exports;
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = cache[file] = { exports: {} };
  new Function('require', 'module', 'exports', js)(id => load(id.replace(/^@\//, '') + '.ts'), mod, mod.exports);
  return mod.exports;
}
const at = (daysAgo, hour = 12) => { const d = new Date(); d.setHours(hour, 0, 0, 0); d.setDate(d.getDate() - daysAgo); return d.toISOString(); };
const P = (pairs) => pairs; // alert params are ordered [name, value] pairs

// ---- a curve, sampled: parse "M x y C c1x c1y, c2x c2y, x y ..." into Béziers
function beziers(d) {
  const nums = d.match(/-?\d+(\.\d+)?/g).map(Number); const out = []; let [x, y] = nums;
  for (let i = 2; i + 5 < nums.length + 1; i += 6) { out.push([[x, y], [nums[i], nums[i + 1]], [nums[i + 2], nums[i + 3]], [nums[i + 4], nums[i + 5]]]); x = nums[i + 4]; y = nums[i + 5]; }
  return out;
}
const at3 = (b, t) => { const u = 1 - t; const f = k => u ** 3 * b[0][k] + 3 * u * u * t * b[1][k] + 3 * u * t * t * b[2][k] + t ** 3 * b[3][k]; return [f(0), f(1)]; };

console.log('== a smooth line: lib/chart-series.ts smoothPath');
{
  const C = load('lib/chart-series.ts');
  const pts = ys => ys.map((y, i) => [i * 20, y]);
  const d = C.smoothPath(pts([30, 4, 4, 18, 2, 30, 12]));
  pass(/^M 0 30 C /.test(d) && !/ L /.test(d) && (d.match(/ C /g) || []).length === 6, `a curve through 7 points: 6 cubic segments, no straight ones (${d.slice(0, 50)}…)`);
  const segs = beziers(d);
  pass(segs.length === 6 && segs.every((b, i) => b[0][0] === i * 20 && b[3][0] === (i + 1) * 20), 'the curve passes through every point, in order');
  const ys = [30, 4, 4, 18, 2, 30, 12];
  let inside = true, flatKept = true, worst = 0;
  segs.forEach((b, i) => { const lo = Math.min(ys[i], ys[i + 1]) - 1e-6, hi = Math.max(ys[i], ys[i + 1]) + 1e-6;
    for (let k = 0; k <= 50; k++) { const [, y] = at3(b, k / 50); if (y < lo || y > hi) { inside = false; worst = Math.max(worst, lo - y, y - hi); } if (i === 1 && Math.abs(y - 4) > 1e-6) flatKept = false; } });
  pass(inside, `it never overshoots: between two points it stays between their heights (worst ${worst.toFixed(3)})`);
  pass(flatKept, 'a flat stretch (4, 4) stays flat, not a bump');
  const zero = C.smoothPath(pts([5, 0, 5])); const zs = beziers(zero);
  pass(zs.every(b => { for (let k = 0; k <= 50; k++) if (at3(b, k / 50)[1] < -1e-6) return false; return true; }), 'a dip to zero does not swing below zero');
  pass(C.smoothPath(pts([7, 7, 7, 7])).split(' C ').slice(1).every(seg => new Set(seg.match(/-?\d+(\.\d+)?/g).filter((_, i) => i % 2 === 1)).size === 1), 'all-equal data is a flat line');
  pass(C.smoothPath([]) === '' && C.smoothPath([[3, 4]]) === 'M 3 4' && /^M 0 1 C /.test(C.smoothPath([[0, 1], [10, 5]])), 'no points, one point and two points are all fine');
  const two = beziers(C.smoothPath([[0, 1], [9, 4]]))[0]; pass(near(at3(two, 0.5)[1], 2.5, 1e-9), 'two points make a straight line');
  pass(!/NaN|Infinity/.test(C.smoothPath([[0, 1], [0, 1], [5, 2]])), 'two points at the same x do not break it');
}

console.log('== data layer: readings against their limit');
{
  const C = load('lib/chart-series.ts');
  const A = (equipment, key, severity, params, daysAgo = 0) => ({ equipment, alert_key: key, severity, date: at(daysAgo), sector: 'industry', params });
  const list = [
    A('Press 1', 'industry.temperature.critical', 'CRITICAL', P([['value', 330], ['limit', 315], ['limit_side', 'max'], ['limit_unit', '°C']])),
    A('Press 1', 'industry.temperature.critical', 'CRITICAL', P([['value', 320], ['limit', 315], ['limit_side', 'max'], ['limit_unit', '°C']]), 4),
    A('Truck 7', 'transport.fuel_low', 'WARNING', P([['level', '12'], ['limit', 20], ['limit_side', 'min'], ['limit_unit', '%']])),
    A('Truck 8', 'transport.oil.critical_low', 'CRITICAL', P([['level', 0.2], ['limit', 0.3], ['limit_side', 'min']])),
    A('Gen 2', 'energy.coolant.overheat', 'CRITICAL', { temp: 120, limit: 95, limit_side: 'max', limit_unit: '°C' }),
    A('Shelf 1', 'retail.stock.low', 'WARNING', P([['stock', 120], ['value', 500], ['currency', '€'], ['limit', 5], ['limit_side', 'max']])),   // money: never a reading
    A('Old 1', 'industry.pressure.critical', 'CRITICAL', P([['value', 12], ['limit', 10]])),                                                      // no side
    A('Old 2', 'industry.pressure.critical', 'CRITICAL', P([['value', 12]])),                                                                      // no limit
    A('Old 3', 'industry.pressure.critical', 'CRITICAL', P([['value', 12], ['limit', 'x'], ['limit_side', 'max']])),                               // not a number
    A('Old 4', 'industry.pressure.critical', 'CRITICAL', null),
  ];
  const g = C.gaugeReadings(list, 4);
  pass(g.total === 4 && g.shown.length === 4, `four alerts carry a usable limit (${g.total}); money, no side, no limit, text and no params are left out`);
  pass(g.shown.filter(r => r.equipment === 'Press 1').length === 1 && g.shown.find(r => r.equipment === 'Press 1').reading === 330, 'two alerts for one machine and family: the newest');
  pass(eq(g.shown.map(r => r.equipment), ['Truck 8', 'Gen 2', 'Press 1', 'Truck 7']), `critical first, then furthest past its limit (${g.shown.map(r => r.equipment)})`);
  pass(g.shown.find(r => r.equipment === 'Truck 7').reading === 12, 'a number sent as text is read');
  pass(g.shown[0].unit === '' && g.shown[1].unit === '°C' && g.shown[3].unit === '%' && g.shown[1].side === 'max' && g.shown[0].side === 'min', 'unit and side come from the params, "" when the alert states no unit');
  pass(eq(g.shown.map(r => r.family), ['oil', 'coolant', 'temperature', 'fuel_low']), 'the family is the alert key\'s second part');
  const cut = C.gaugeReadings(list, 2); pass(cut.shown.length === 2 && cut.total === 4, 'a cap shows the first ones and still says how many there are');
  pass(eq(C.gaugeReadings([], 4), { shown: [], total: 0 }), 'no alerts, no gauges');

  const sc = C.gaugeScale;
  const s1 = sc({ reading: 12, limit: 20, side: 'min', unit: '%' }); pass(s1.max === 100 && near(s1.fill, 0.12) && near(s1.mark, 0.2), 'a percentage runs 0-100 (12% against 20%)');
  const s2 = sc({ reading: 330, limit: 315, side: 'max', unit: '°C' }); pass(near(s2.max, 393.75, 0.01) && near(s2.mark, 0.8) && s2.fill > s2.mark, 'a "max" limit sits at 80% of the scale and a reading past it fills beyond the mark');
  const s3 = sc({ reading: 0.2, limit: 0.3, side: 'min', unit: '' }); pass(near(s3.max, 0.6) && near(s3.mark, 0.5) && s3.fill < s3.mark, 'a "min" limit sits mid-scale and a reading under it fills short of the mark');
  const s4 = sc({ reading: 900, limit: 315, side: 'max', unit: '' }); pass(near(s4.max, 945) && s4.fill < 1 && s4.fill > 0.9, 'a reading far past the limit still fits');
  const s5 = sc({ reading: -5, limit: 0, side: 'max', unit: '' }); pass(s5.max === 1 && s5.fill === 0 && s5.mark === 0, 'zero and negative values do not break the scale');
  pass(sc({ reading: 150, limit: 20, side: 'min', unit: '%' }).fill === 1, 'a percentage above 100 is clamped');
}

console.log('== data layer: stock against its minimum');
{
  const C = load('lib/chart-series.ts');
  const S = (equipment, stock, min, daysAgo = 0, extra = []) => ({ equipment, alert_key: 'health.stock.low', severity: 'WARNING', date: at(daysAgo), params: P([['stock', stock], ['min_stock', min], ...extra]) });
  const r = C.stockRows([S('A', 80, 100, 3), S('A', 20, 100), S('B', 120, 100), S('C', 5, 50), S('D', 10, 0), S('E', '40', '50'), { equipment: 'F', date: at(0), params: P([['stock', 5]]) }, S('G', -1, 10)], 6);
  pass(eq(r.shown.map(x => x.equipment), ['C', 'A', 'E', 'B']) && r.total === 4, `newest per item, lowest first; no minimum, a zero minimum or a negative stock are left out (${r.shown.map(x => x.equipment)})`);
  pass(r.shown[1].stock === 20 && near(r.shown[0].ratio, 0.1, 1e-9) && r.shown.find(x => x.equipment === 'E').stock === 40, 'the newest reading wins and text numbers are read');
  const many = C.stockRows(Array.from({ length: 9 }, (_, i) => S('I' + i, 10 + i, 20)), 6); pass(many.shown.length === 6 && many.total === 9 && many.shown[0].equipment === 'I0', 'only the lowest six, and the total is kept');
}

console.log('== source: tokens only');
{
  for (const f of ['components/sentria/charts.tsx', 'lib/chart-series.ts']) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    pass(!/#[0-9a-fA-F]{3,8}\b/.test(src) && !/\bdark:/.test(src), `${f}: no colour literal, no dark: class`);
  }
}

// ---- the browser
const SECTORS = ['industry', 'health', 'agriculture', 'transportation', 'logistics', 'energy', 'commerce', 'eac'];
const LS = { sentria_language: 'en', sentria_onboarded: 'true', sentria_sector: 'health', sentria_company_name: 'Acme', sentria_sectors: JSON.stringify(SECTORS), sentria_business_type: 'pharmacie' };
let id = 0;
const al = (sector, equipment, key, severity, params, daysAgo = 0) => ({ id: id++, equipment, sector, business_type: null, severity, date: at(daysAgo), alert_key: key, message: 'm', params });
const stock = (eq, s, m, daysAgo = 0, crit = s < m) => al('health', eq, crit ? 'health.stock.critical_low' : 'health.stock.low', crit ? 'CRITICAL' : 'WARNING', P([['stock', s], ['min_stock', m]]), daysAgo);
const lim = (v, l, side, unit, name = 'value') => P([[name, v], ['limit', l], ['limit_side', side], ...(unit ? [['limit_unit', unit]] : [])]);
const WITH = [
  stock('Amoxicillin', 80, 100, 3), stock('Amoxicillin', 20, 100), stock('Ibuprofen', 60, 100), stock('Insulin', 112, 100),
  stock('Gauze', 140, 100), stock('Paracetamol', 5, 50), stock('Saline', 30, 40), stock('Bandages', 55, 50),
  al('industry', 'Press 1', 'industry.temperature.critical', 'CRITICAL', lim(330, 315, 'max', '°C')),
  al('industry', 'Press 1', 'industry.temperature.critical', 'CRITICAL', lim(320, 315, 'max', '°C'), 4),
  al('industry', 'Press 2', 'industry.pressure.warning', 'WARNING', lim(1, 2, 'min', 'bar')),
  al('transportation', 'Truck 7', 'transport.fuel_low', 'WARNING', lim(12, 20, 'min', '%', 'level')),
  al('transportation', 'Truck 8', 'transport.oil.critical_low', 'CRITICAL', lim(0.2, 0.3, 'min', null, 'level')),
  al('energy', 'Gen 1', 'energy.fuel.critical', 'CRITICAL', lim(8, 10, 'min', '%', 'level')),
  al('energy', 'Gen 2', 'energy.coolant.overheat', 'CRITICAL', lim(120, 95, 'max', '°C', 'temp')),
  ...Array.from({ length: 6 }, (_, d) => al('health', 'Fridge ' + d, 'health.cold_chain.breach', 'CRITICAL', P([['temp', 9]]), d)),
];
const WITHOUT = WITH.map(a => ({ ...a, params: (a.params || []).filter(([n]) => !['limit', 'limit_side', 'limit_unit', 'min_stock'].includes(n)) }));

async function open(browser, { alerts, theme = 'light', width = 1440, scheme = 'light', lang = 'en', pill = 'All' } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 1000 }, locale: lang === 'fr' ? 'fr-FR' : 'en-US', timezoneId: 'Europe/Paris', colorScheme: scheme });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route(/onrender\.com\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: new URL(r.request().url()).pathname === '/alerts' ? JSON.stringify(alerts) : '{"recommendations":[],"assignments":[],"contractors":[]}' }));
  await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } }, { ...LS, sentria_theme: theme, sentria_language: lang });
  await signedIn(p, 'u', 'a@b.c', { plan: 'entreprise' });
  await p.goto(APP_URL); await p.waitForTimeout(1800);
  if (pill) { await p.getByRole('button', { name: new RegExp('^' + pill + '\\s*\\d*$') }).first().click(); await p.waitForTimeout(500); }
  return { ctx, p, errs };
}
const rgbOf = (p, token) => p.evaluate(t => { const e = document.createElement('i'); e.style.background = `var(${t})`; document.body.appendChild(e); const c = getComputedStyle(e).backgroundColor; e.remove(); return c; }, token);
const card = (p, name) => p.locator(`[data-card="${name}"]`);
const scroll = (p, name) => card(p, name).evaluate(el => el.scrollIntoView({ block: 'center' }));

(async () => {
  const b = await chromium.launch(LAUNCH);
  const C = load('lib/chart-series.ts');

  console.log('== the smooth line, on the KPI tiles (health: "Critical stockouts")');
  {
    const { ctx, p, errs } = await open(b, { alerts: WITH, pill: 'Health' });
    const tile = await p.evaluate(() => { const label = [...document.querySelectorAll('span')].find(s => s.textContent.trim() === 'Critical stockouts'); const t = label && label.closest('.rounded-3xl'); const path = t && t.querySelector('svg[data-sparkline] path'); return path ? { d: path.getAttribute('d'), box: t.querySelector('svg[data-sparkline]').getAttribute('viewBox'), color: getComputedStyle(path).stroke, join: path.getAttribute('stroke-linejoin') } : null; });
    pass(!!tile, 'the "Critical stockouts" tile has its line');
    pass(tile && /^M 0 /.test(tile.d) && /\sC\s/.test(tile.d) && !/\sL\s/.test(tile.d), `…and it is a curve, not straight segments (${tile && tile.d.slice(0, 60)}…)`);
    const ys = tile ? tile.d.match(/-?\d+(\.\d+)?/g).map(Number).filter((_, i) => i % 2 === 1) : [];
    pass(ys.length > 0 && Math.min(...ys) >= 1.99 && Math.max(...ys) <= 34.01, `…inside its box, with room for the stroke (y ${Math.min(...ys)}-${Math.max(...ys)} of 36)`);
    const segs = tile ? beziers(tile.d) : [];
    pass(segs.length === 6 && segs[5][3][0] === 120, '…seven days, edge to edge');
    const danger = await p.evaluate(() => { const label = [...document.querySelectorAll('span')].find(s => s.textContent.trim() === 'Critical stockouts'); return getComputedStyle(label.closest('.rounded-3xl').querySelector('svg[data-sparkline]')).color; });
    pass(await rgbOf(p, '--destructive') === danger, 'it keeps its red (destructive) colour');
    const allTiles = await p.locator('svg[data-sparkline] path').evaluateAll(els => els.map(e => e.getAttribute('d')));
    pass(allTiles.length >= 4 && allTiles.every(d => /\sC\s/.test(d)), `every KPI tile's line is smooth, so none looks out of place (${allTiles.length} tiles)`);
    pass(errs.length === 0, 'no page errors');
    await ctx.close();
  }

  console.log('== stock against its minimum');
  {
    const { ctx, p, errs } = await open(b, { alerts: WITH });
    await scroll(p, 'stock');
    const rows = await p.locator('[data-stock-row]').evaluateAll(els => els.map(e => ({ name: e.querySelector('span.truncate').innerText.trim(), text: e.querySelector('.tabular-nums').innerText.replace(/\s+/g, ' ').trim(), below: e.dataset.below, width: e.querySelector('[data-stock-bar]').style.width, color: getComputedStyle(e.querySelector('[data-stock-bar]')).backgroundColor, minLeft: getComputedStyle(e.querySelector('[data-stock-min]')).left, trackW: e.querySelector('[data-stock-min]').parentElement.getBoundingClientRect().width, leftPx: e.querySelector('[data-stock-min]').getBoundingClientRect().left + 1 - e.querySelector('[data-stock-min]').parentElement.getBoundingClientRect().left })));
    pass(eq(rows.map(r => r.name), ['Paracetamol', 'Amoxicillin', 'Ibuprofen', 'Saline', 'Bandages', 'Insulin']), `the six lowest against their own minimum, lowest first (${rows.map(r => r.name)})`);
    pass(rows.every(r => r.name !== 'Gauze'), '…the seventh (Gauze, 140 / 100) is the one left out');
    pass(/the 6 lowest of 7/.test(await card(p, 'stock').innerText()), '…and the card says so: "the 6 lowest of 7"');
    pass(rows.find(r => r.name === 'Amoxicillin').text.startsWith('20 / 100'), 'Amoxicillin shows its newest stock (20), not the older 80');
    const want = { Paracetamol: 5 / 50, Amoxicillin: 20 / 100, Ibuprofen: 60 / 100, Saline: 30 / 40, Bandages: 55 / 50, Insulin: 112 / 100 };
    pass(rows.every(r => near(parseFloat(r.width), Math.min(1, want[r.name] / 2) * 100, 0.05)), 'each bar is its stock over twice its minimum, so the minimum is always the middle');
    pass(rows.every(r => near(r.leftPx, r.trackW / 2, 1.2)), 'one threshold line, at the middle of every track');
    pass(eq(rows.map(r => r.below), ['true', 'true', 'true', 'true', 'false', 'false']), 'below / above the minimum is known per row');
    const [dng, wrn] = [await rgbOf(p, '--tag-danger-fg'), await rgbOf(p, '--tag-warning-fg')];
    pass(rows.filter(r => r.below === 'true').every(r => r.color === dng) && rows.filter(r => r.below === 'false').every(r => r.color === wrn), 'below the line is the danger colour, above it the warning colour (tokens)');
    pass(rows.slice(0, 4).every((r, i) => parseFloat(r.width) < 50) && rows.slice(4).every(r => parseFloat(r.width) > 50), 'the bars below their minimum stop short of the line, the others pass it');
    pass(await p.locator('[data-stock-row] .sr-only').evaluateAll(els => els.map(e => e.textContent.trim())).then(t => t[0] === 'below the minimum' && t[5] === 'above the minimum'), 'a screen reader hears below / above, not just a colour');
    pass((await card(p, 'stock').innerText()).includes('Last stock that raised an alert'), 'the card says what it shows: the last stock that raised an alert');
    await p.screenshot({ path: 'viz2-all-light-1440.png' });
    pass(errs.length === 0, 'no page errors');
    await ctx.close();
  }

  console.log('== readings against their limit');
  {
    const { ctx, p, errs } = await open(b, { alerts: WITH });
    await scroll(p, 'gauges');
    const g = await p.locator('[data-gauge]').evaluateAll(els => els.map(e => { const m = e.querySelector('[role=meter]'); const fill = e.querySelector('[data-gauge-fill]'); const tick = e.querySelector('[data-gauge-limit]'); return { label: m.getAttribute('aria-label'), now: +m.getAttribute('aria-valuenow'), max: +m.getAttribute('aria-valuemax'), text: m.getAttribute('aria-valuetext'), shown: e.querySelector('p.font-heading').innerText.trim(), name: e.querySelector('p.font-semibold').innerText.trim(), limit: [...e.querySelectorAll('p')].at(-1).innerText.replace(/\s+/g, ' ').trim(), fillD: fill && fill.getAttribute('d'), stroke: fill && getComputedStyle(fill).stroke, tick: [tick.getAttribute('x1'), tick.getAttribute('y1'), tick.getAttribute('x2'), tick.getAttribute('y2')].map(Number), tickStroke: getComputedStyle(tick).stroke }; }));
    pass(g.length === 4, `four gauges (the most severe of six): ${g.map(x => x.name)}`);
    pass(eq(g.map(x => x.name), ['Truck 8', 'Gen 2', 'Gen 1', 'Press 1']), 'critical ones, furthest past their limit first');
    pass(/the 4 most severe of 6/.test(await card(p, 'gauges').innerText()), '…and the card says so');
    pass(g.every(x => x.label.includes(x.name)) && (await p.getByRole('meter').count()) === 4, 'each is a labelled meter for assistive tech');
    const byName = Object.fromEntries(g.map(x => [x.name, x]));
    pass(byName['Press 1'].now === 330 && byName['Press 1'].shown === '330 °C' && /limit\s*315 °C/.test(byName['Press 1'].limit), 'Press 1: 330 °C against 315 °C (the newest, not the older 320)');
    pass(byName['Gen 1'].shown === '8%' && /limit\s*10%/.test(byName['Gen 1'].limit), 'a percentage reads "8%"');
    pass(byName['Truck 8'].shown === '0.2' && /limit\s*0.3$/.test(byName['Truck 8'].limit), 'no unit is invented where the alert gave none (oil: 0.2 against 0.3)');
    pass(/above/.test(byName['Press 1'].text) && /below/.test(byName['Gen 1'].text) && /limit 315 °C, above/.test(byName['Press 1'].text), `the spoken value says which side: "${byName['Press 1'].text}"`);
    // geometry: the arc ends where the reading says, the mark sits where the limit says
    const cx = 60, cy = 60, R = 46;
    const geo = Object.entries(byName).map(([n, x]) => { const sc = C.gaugeScale({ reading: x.now, limit: n === 'Press 1' ? 315 : n === 'Gen 2' ? 95 : n === 'Gen 1' ? 10 : 0.3, side: n === 'Press 1' || n === 'Gen 2' ? 'max' : 'min', unit: n === 'Gen 1' ? '%' : n === 'Press 1' || n === 'Gen 2' ? '°C' : '' });
      const end = x.fillD.match(/A [\d.]+ [\d.]+ 0 0 1 (-?[\d.]+) (-?[\d.]+)/); const ex = +end[1], ey = +end[2];
      const fracEnd = 1 - Math.atan2(cy - ey, ex - cx) / Math.PI; const [x1, y1, x2, y2] = x.tick; const mx = (x1 + x2) / 2, my = (y1 + y2) / 2; const fracMark = 1 - Math.atan2(cy - my, mx - cx) / Math.PI;
      return { n, fillOk: near(fracEnd, sc.fill, 0.01) && near(Math.hypot(ex - cx, ey - cy), R, 0.05), markOk: near(fracMark, sc.mark, 0.01) && near(Math.hypot(mx - cx, my - cy), R, 0.05), max: near(x.max, sc.max, 0.01) }; });
    pass(geo.every(x => x.fillOk), `the arc ends at the reading on the scale (${geo.map(x => x.n + ':' + x.fillOk)})`);
    pass(geo.every(x => x.markOk), 'the limit mark sits where the limit is on that scale');
    pass(geo.every(x => x.max), 'aria-valuemax is the scale\'s top');
    pass(g.every(x => x.stroke === g[0].stroke) && g[0].stroke === await rgbOf(p, '--tag-danger-fg'), 'critical gauges are drawn in the danger token');
    const fg = await p.evaluate(() => { const e = document.createElement('i'); e.style.color = 'var(--foreground)'; document.body.appendChild(e); const c = getComputedStyle(e).color; e.remove(); return c; });
    pass(g.every(x => x.tickStroke === fg), 'the limit mark is the foreground colour');
    await p.screenshot({ path: 'viz2-gauges-light-1440.png' });
    pass(errs.length === 0, 'no page errors');
    await ctx.close();
  }

  console.log('== a warning gauge, a sector pill and a card on its own');
  {
    const { ctx, p } = await open(b, { alerts: WITH, pill: 'Energy' });
    await scroll(p, 'gauges');
    pass(await card(p, 'stock').count() === 0 && await p.locator('[data-gauge]').count() === 2, 'Energy: two gauges (Gen 1, Gen 2) and no stock card');
    pass(await card(p, 'gauges').evaluate(el => el.classList.contains('lg:col-span-3')), '…the gauge card then takes the full width');
    await ctx.close();
    const h = await open(b, { alerts: WITH, pill: 'Health' });
    pass(await card(h.p, 'gauges').count() === 0 && await card(h.p, 'stock').count() === 1, 'Health: the stock card only (no gauge for a sector with no readings)');
    pass(await card(h.p, 'stock').evaluate(el => el.classList.contains('lg:col-span-3')), '…full width');
    await h.ctx.close();
    const fuel = WITH.filter(a => a.alert_key === 'transport.fuel_low');
    const w = await open(b, { alerts: [...fuel, ...WITH.filter(a => a.sector === 'health')], pill: 'All' });
    await scroll(w.p, 'gauges');
    const warn = await w.p.locator('[data-gauge] [data-gauge-fill]').evaluate(el => getComputedStyle(el).stroke);
    pass(warn === await rgbOf(w.p, '--tag-warning-fg'), 'a warning reading (Truck 7, fuel 12% of 20%) is drawn in the warning token');
    pass(await w.p.locator('[data-gauge]').count() === 1 && await card(w.p, 'stock').evaluate(el => el.classList.contains('lg:col-span-2')) && await card(w.p, 'gauges').evaluate(el => el.classList.contains('lg:col-span-1')), 'both cards: the stock one two thirds wide, the gauges one third');
    await w.ctx.close();
  }

  console.log('== alerts saved before the limits existed');
  {
    const { ctx, p, errs } = await open(b, { alerts: WITHOUT });
    pass(await p.locator('[data-card]').count() === 0 && await p.locator('[data-gauge], [data-stock-row]').count() === 0, 'no limit in the params: neither card, nothing broken');
    pass(await p.locator('[data-chart="line"]').count() === 1 && await p.locator('[data-chart="donut"]').count() === 1, 'the trend chart and the donut are still there');
    pass(errs.length === 0, 'no page errors');
    await ctx.close();
  }

  console.log('== French');
  {
    const { ctx, p } = await open(b, { alerts: WITH, lang: 'fr', pill: 'Tous' });
    await scroll(p, 'gauges');
    const a = await card(p, 'stock').innerText(), g = await card(p, 'gauges').innerText();
    pass(/Stock face au minimum/.test(a) && /Dernier stock ayant déclenché une alerte/.test(a) && /les 6 plus bas sur 7/.test(a) && /Minimum de chaque article/.test(a), 'the stock card is in French');
    pass(/Mesures face à leur limite/.test(g) && /les 4 plus sévères sur 6/.test(g) && /limite/.test(g), 'the gauge card is in French');
    pass(/limite/.test(await p.locator('[role=meter]').first().getAttribute('aria-valuetext')), 'and the spoken value too');
    await ctx.close();
  }

  console.log('== themes and a phone');
  {
    for (const [name, theme, scheme] of [['dark', 'dark', 'light'], ['system, OS dark', 'system', 'dark']]) {
      const { ctx, p } = await open(b, { alerts: WITH, theme, scheme });
      await scroll(p, 'gauges');
      const stroke = await p.locator('[data-gauge] [data-gauge-fill]').first().evaluate(el => getComputedStyle(el).stroke);
      pass(stroke === await rgbOf(p, '--tag-danger-fg') && stroke !== 'rgb(179, 32, 46)', `${name}: the danger colour is the dark one (${stroke})`);
      const barOk = await p.locator('[data-stock-bar]').first().evaluate(el => getComputedStyle(el).backgroundColor);
      pass(barOk === stroke, `${name}: stock bars and gauges share the token`);
      if (theme === 'dark') { await p.screenshot({ path: 'viz2-gauges-dark-1440.png' }); await scroll(p, 'stock'); await p.screenshot({ path: 'viz2-stock-dark-1440.png' }); }
      await ctx.close();
    }
    for (const theme of ['light', 'dark']) {
      const { ctx, p, errs } = await open(b, { alerts: WITH, theme, width: 390 });
      await scroll(p, 'gauges');
      const m = await p.evaluate(() => { const c = document.querySelector('[data-card="gauges"]').getBoundingClientRect(); const gs = [...document.querySelectorAll('[data-gauge]')].map(g => g.getBoundingClientRect()); const names = [...document.querySelectorAll('[data-gauge] p.font-semibold')].map(n => n.scrollWidth <= n.clientWidth + 1 || getComputedStyle(n).textOverflow === 'ellipsis'); return { page: document.documentElement.scrollWidth, win: innerWidth, inside: gs.every(r => r.left >= c.left - 1 && r.right <= c.right + 1), cols: new Set(gs.map(r => Math.round(r.left))).size, names: names.every(Boolean), w: gs.map(r => Math.round(r.width)) }; });
      pass(m.page <= m.win + 1 && m.inside, `${theme}, 390 px: no sideways scroll; every gauge inside its card`);
      pass(m.cols === 2 && m.names, `${theme}, 390 px: two gauges a row, long names cut with an ellipsis (${m.w})`);
      const s = await p.evaluate(() => { const c = document.querySelector('[data-card="stock"]'); const r = c.getBoundingClientRect(); return [...c.querySelectorAll('[data-stock-row]')].every(x => { const q = x.getBoundingClientRect(); return q.left >= r.left - 1 && q.right <= r.right + 1; }); });
      pass(s, `${theme}, 390 px: stock rows fit their card`);
      await p.screenshot({ path: `viz2-gauges-${theme}-390.png` }); await scroll(p, 'stock'); await p.screenshot({ path: `viz2-stock-${theme}-390.png` });
      pass(errs.length === 0, `${theme}, 390 px: no page errors`);
      await ctx.close();
    }
  }

  await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL OK');
  process.exit(fails ? 1 : 0);
})();
