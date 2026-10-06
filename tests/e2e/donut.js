// The dashboard's donut, modelled on the founder's reference: a black card, a
// thick ring cut into rounded segments with a gap between them, the total in
// the hole, a small chip top right, the legend below. This checks the shape
// (segments, gaps, rounded corners, the hole), the card (black in every
// theme), the text on it, and that the donut's colours are the tokens the
// palette check validates. Data, hover and the legend's numbers are in charts.js.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const ROOT = path.join(__dirname, '..', '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

let id = 0;
const al = (family, severity = 'WARNING', n = 1) => Array.from({ length: n }, () => ({ id: id++, equipment: `E${id}`, sector: 'health', business_type: 'pharmacie', severity, date: new Date(Date.now() - 36e5).toISOString(), alert_key: family ? `health.${family}.x` : null, message: 'm' }));
const FAMILIES = (spec) => Object.entries(spec).flatMap(([f, n]) => al(f, 'WARNING', n));
const SEVEN = FAMILIES({ temperature: 40, fuel: 25, load: 15, leak: 9, pressure: 5, vibration: 3, wear: 1 });
const THREE = FAMILIES({ temperature: 50, fuel: 30, load: 20 });
const ONE = FAMILIES({ temperature: 12 });
const SEVERITY = [...al(null, 'CRITICAL', 3), ...al(null, 'WARNING', 9)];

async function open(browser, alerts, { theme = 'light', width = 1440, lang = 'en', scheme = 'light' } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 1000 }, locale: lang === 'fr' ? 'fr-FR' : 'en-US', colorScheme: scheme });
  const p = await ctx.newPage(); p._errs = []; p.on('pageerror', e => p._errs.push(e.message));
  await p.route(/onrender\.com\//, r => {
    const u = new URL(r.request().url()); const json = b => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
    return u.pathname === '/alerts' ? json(alerts) : json({ recommendations: [], assignments: [], contractors: [] });
  });
  await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } },
    { sentria_language: lang, sentria_onboarded: 'true', sentria_theme: theme, sentria_sector: 'health', sentria_sectors: '["industry","health","energy"]', sentria_business_type: 'pharmacie', sentria_company_name: 'Acme' });
  await signedIn(p, 'u', 'a@b.c', { plan: 'entreprise' });
  await p.goto(APP_URL); await p.waitForTimeout(2000);
  const pill = p.getByRole('button', { name: /^Health\s*\d*$|^Santé\s*\d*$/ }).first();
  if (await pill.count()) { await pill.click(); await p.waitForTimeout(600); }
  return { ctx, p };
}
const card = p => p.locator('[data-breakdown-card]');
const segs = p => p.locator('[data-chart="donut"] svg path[data-slice]');
// The colour the page really paints for a CSS colour, as [r, g, b] over black.
const paint = (p, css) => p.evaluate(c => { const k = document.createElement('canvas'); k.width = k.height = 1; const x = k.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 1, 1); x.fillStyle = c; x.fillRect(0, 0, 1, 1); return [...x.getImageData(0, 0, 1, 1).data].slice(0, 3); }, css);
const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

(async () => {
  const b = await chromium.launch(LAUNCH);

  console.log('== the card: black in every theme, a chip, the title');
  for (const [label, o] of [['light', { theme: 'light' }], ['dark', { theme: 'dark' }], ['system + OS dark', { theme: 'system', scheme: 'dark' }], ['system + OS light', { theme: 'system', scheme: 'light' }]]) {
    const { ctx, p } = await open(b, SEVEN, o);
    const black = await paint(p, await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sidebar').trim()));
    const bg = await paint(p, await card(p).evaluate(e => getComputedStyle(e).backgroundColor));
    pass(Math.max(...bg) < 45 && JSON.stringify(bg) === JSON.stringify(black), `${label}: the card is the sidebar's black (${bg})`);
    pass(await card(p).locator('h3').innerText() === 'Breakdown', `${label}: titled Breakdown`);
    if (label === 'light') pass(/By type/.test(await card(p).locator('[data-breakdown-kind="family"]').innerText()), 'a chip says what it breaks down: By type');
    if (label === 'light') await p.screenshot({ path: 'donut-light.png', clip: await card(p).boundingBox() });
    if (label === 'dark') await p.screenshot({ path: 'donut-dark.png', clip: await card(p).boundingBox() });
    await ctx.close();
  }

  console.log('== the ring: rounded segments with a gap, a hole for the total');
  {
    const { ctx, p } = await open(b, SEVEN);
    const n = await segs(p).count();
    pass(n === 6, `seven families: five slices and Other (${n})`);
    const ds = await segs(p).evaluateAll(els => els.map(e => e.getAttribute('d')));
    pass(ds.every(d => !/NaN|undefined|Infinity/.test(d)), 'every path is finite');
    const arcs = d => (d.match(/ A /g) || []).length;
    pass(ds.slice(0, 3).every(d => arcs(d) === 6), 'a big slice is a ring segment with four rounded corners (six arcs: two edges of the ring, four corners)');
    pass(ds.every(d => arcs(d) >= 2), 'every slice, even the thin ones, is a closed shape');
    // geometry in the browser: the gaps are empty, each slice's middle belongs to it alone
    const geo = await p.evaluate(() => {
      const svg = document.querySelector('[data-chart="donut"] svg'); const paths = [...svg.querySelectorAll('path[data-slice]')];
      const C = 106, R = 77; const at = deg => { const a = (deg - 90) * Math.PI / 180; const pt = svg.createSVGPoint(); pt.x = C + R * Math.cos(a); pt.y = C + R * Math.sin(a); return pt; };
      const inside = (deg) => paths.map(p => p.isPointInFill(at(deg)));
      // slice shares from the legend, to find where each starts
      const vals = [...document.querySelectorAll('[data-chart="donut"] ul li')].map(li => +[...li.querySelectorAll('span')][2].textContent);
      const total = vals.reduce((a, c) => a + c, 0); let from = 0; const out = [];
      vals.forEach((v, i) => { const sweep = v / total * 360; out.push({ mid: inside(from + sweep / 2), edge: inside(from) }); from += sweep; });
      return { out, n: paths.length };
    });
    pass(geo.out.every((o, i) => o.mid.filter(Boolean).length === 1 && o.mid[i]), 'the middle of each slice is inside that slice only');
    pass(geo.out.every(o => o.edge.every(x => !x)), 'the boundary between two slices is empty: a gap, not a touching edge');
    const hole = await p.evaluate(() => { const svg = document.querySelector('[data-chart="donut"] svg'); const paths = [...svg.querySelectorAll('path[data-slice]')]; const pt = svg.createSVGPoint(); pt.x = 106; pt.y = 106; return paths.some(p => p.isPointInFill(pt)); });
    pass(!hole, 'the middle of the ring is a hole');
    const box = await p.locator('[data-chart="donut"] svg').boundingBox();
    pass(Math.abs(box.width - 212) < 1 && Math.abs(box.height - 212) < 1, `the donut is 212 px across (${Math.round(box.width)})`);
    pass(!(await p.evaluate(() => document.querySelector('[data-chart="donut"] svg path[data-slice]').getAttribute('stroke'))), 'segments are filled shapes, not stroked lines');
    // the number in the hole
    const centre = await p.locator('[data-donut-center] span').first().evaluate(e => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return { size: parseFloat(s.fontSize), w: r.width }; });
    pass(centre.size >= 30 && centre.w < 96, `the total is large (${centre.size}px) and fits the hole (${Math.round(centre.w)} of 108 px)`);
    pass(await p.locator('[data-donut-center] span').first().innerText() === '98' && /alerts/.test(await p.locator('[data-donut-center]').innerText()), 'it reads the total, with what it counts underneath');
    pass(p._errs.length === 0, `no page errors ${p._errs.join('|')}`);
    await ctx.close();
  }

  console.log('== few slices, one slice, severity');
  {
    const { ctx, p } = await open(b, THREE);
    const ds = await segs(p).evaluateAll(els => els.map(e => e.getAttribute('d')));
    pass(ds.length === 3 && ds.every(d => (d.match(/ A /g) || []).length === 6), 'three families: three big rounded segments');
    await p.screenshot({ path: 'donut-three.png', clip: await card(p).boundingBox() });
    await ctx.close();
  }
  {
    const { ctx, p } = await open(b, ONE);
    const ds = await segs(p).evaluateAll(els => els.map(e => e.getAttribute('d')));
    pass(ds.length === 1 && !/NaN/.test(ds[0]) && await segs(p).first().getAttribute('fill-rule') === 'evenodd', 'one family: one whole ring (a ring, with its hole)');
    const hole = await p.evaluate(() => { const svg = document.querySelector('[data-chart="donut"] svg'); const pa = svg.querySelector('path[data-slice]'); const pt = svg.createSVGPoint(); pt.x = 106; pt.y = 106; const on = svg.createSVGPoint(); on.x = 106 + 77; on.y = 106; return [pa.isPointInFill(pt), pa.isPointInFill(on)]; });
    pass(hole[0] === false && hole[1] === true, 'the hole is empty and the ring is filled');
    await ctx.close();
  }
  {
    const { ctx, p } = await open(b, SEVERITY);
    pass(/By severity/.test(await card(p).locator('[data-breakdown-kind="severity"]').innerText()), 'with no families the chip says By severity');
    const fills = await segs(p).evaluateAll(els => els.map(e => e.getAttribute('fill')));
    pass(fills.join() === 'var(--slice-warning),var(--slice-critical)', `warning and critical use the donut's status tones (${fills})`);
    await ctx.close();
  }

  console.log('== the text on the black card is readable');
  {
    const { ctx, p } = await open(b, SEVEN, { theme: 'light' });
    const black = [1, 1, 1];
    const sel = { title: '[data-breakdown-card] h3', chip: '[data-breakdown-kind]', total: '[data-donut-center] span:first-child', under: '[data-donut-center] span:last-child', label: '[data-legend] li span:nth-child(2)', value: '[data-legend] li span:nth-child(3)', pct: '[data-legend] li span:nth-child(4)' };
    for (const [name, q] of Object.entries(sel)) {
      const css = await p.locator(q).first().evaluate(e => getComputedStyle(e).color);
      const rgb = await paint(p, css);
      const r = ratio(rgb, black);
      pass(r >= 4.5, `${name}: ${r.toFixed(1)}:1 on the card (needs 4.5)`);
    }
    // the slices themselves against the black card (3:1 for graphics)
    const fills = await p.evaluate(() => [...document.querySelectorAll('[data-chart="donut"] path[data-slice]')].map(e => getComputedStyle(e).fill));
    const worst = Math.min(...(await Promise.all(fills.map(async f => ratio(await paint(p, f), black)))));
    pass(worst >= 3, `every slice reaches 3:1 on the card (worst ${worst.toFixed(1)}:1)`);
    await ctx.close();
  }

  console.log('== French, dark, 390 px');
  {
    const { ctx, p } = await open(b, SEVEN, { lang: 'fr', theme: 'dark' });
    pass(/Répartition/.test(await card(p).locator('h3').innerText()) && /Par type/.test(await card(p).locator('[data-breakdown-kind]').innerText()), 'title and chip in French');
    await ctx.close();
  }
  for (const [label, o] of [['390', { width: 390 }], ['390 dark', { width: 390, theme: 'dark' }]]) {
    const { ctx, p } = await open(b, SEVEN, o);
    const m = await p.evaluate(() => { const c = document.querySelector('[data-breakdown-card]'); const l = c.querySelector('[data-legend]'); return { page: document.documentElement.scrollWidth, win: innerWidth, card: c.getBoundingClientRect().width, legendOver: l.scrollWidth > l.clientWidth + 1, ring: c.querySelector('[data-chart="donut"] svg').getBoundingClientRect().width }; });
    pass(m.page <= m.win + 1 && !m.legendOver && m.ring <= m.card, `${label}: no sideways scroll, the legend wraps, the ring fits the card (${Math.round(m.ring)} of ${Math.round(m.card)} px)`);
    await card(p).scrollIntoViewIfNeeded(); await p.waitForTimeout(200);
    await p.screenshot({ path: `donut-${label.replace(' ', '-')}.png`, clip: await card(p).boundingBox() });
    await ctx.close();
  }

  console.log('== source');
  {
    const files = ['components/sentria/charts.tsx', 'components/sentria/dashboard-view.tsx'];
    const donut = read('components/sentria/charts.tsx');
    const block = donut.slice(donut.indexOf('const SIZE = 212'), donut.indexOf('Gauge: a reading'));
    pass(!/\bdark:/.test(block) && !/#[0-9a-fA-F]{3,8}\b/.test(block.replace(/\/\*[\s\S]*?\*\//g, '')), 'the donut has no dark: class and no colour written in it (tokens only)');
    pass(files.every(f => !/slice-(1|2|3|4|5|6|other|critical|warning)\s*:\s*#/.test(read(f))), 'no slice colour is written outside globals.css');
    pass(/--slice-critical/.test(read('components/sentria/dashboard-view.tsx')) && !/tag-danger-fg\)"\s*\n\s*:\s*"var\(--tag-warning-fg/.test(read('components/sentria/dashboard-view.tsx')), 'the severity slices use the donut\'s own status tones');
  }

  await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
