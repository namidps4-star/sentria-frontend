// L4 trust layer: a quiet screen is only good news if the data behind it is
// recent. The backend stamps every clean upload (GET /freshness); the
// dashboard says "updated N days ago" when the data is recent, warns plainly
// when a department has gone silent, and shows a zero as "not measured"
// instead of as a healthy 0. It says nothing when it cannot know (an API
// without the log yet, a department with no stamp, a failed request).
// The decision logic in lib/freshness.ts is tested on its own first.
process.env.TZ = 'Europe/Paris';
const fs = require('fs');
const path = require('path');
const ts = require(path.join(__dirname, '..', '..', 'node_modules', 'typescript'));
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const ROOT = path.join(__dirname, '..', '..');

// lib/freshness.ts in node: the real file, with the API and React stubbed
function loadFreshness() {
  const src = fs.readFileSync(path.join(ROOT, 'lib', 'freshness.ts'), 'utf8');
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', js)(id => id === 'react' ? { useCallback: f => f, useEffect() {}, useState: v => [v, () => {}] } : id === '@/lib/api' ? { API_BASE: '', apiFetch: async () => ({ ok: false }) } : require(id), mod, mod.exports);
  return mod.exports;
}
const NOW = new Date('2026-10-01T12:00:00Z').getTime();
const ago = (days, hours = 0) => new Date(NOW - days * 86400000 - hours * 3600000).toISOString();
const stamp = (sector, scope, when) => ({ sector, scope, last_upload_at: when, age_days: 0, stale: false, rows_processed: 10, alerts_fired: 1 });

console.log('== lib/freshness.ts: what the stamps say about a view');
{
  const F = loadFreshness();
  const data = (entries, persisted = true) => ({ persisted, staleAfterDays: 7, entries });
  const a = (d, sectors, scopes, now = NOW) => F.assessFreshness(d, sectors, scopes, now);
  pass(a(data([stamp('health', 'pharmacie', ago(30))], false), ['health']).kind === 'unknown', 'not persisted (no migration, or the request failed): unknown, whatever the stamps say');
  pass(a(data([]), ['health']).kind === 'unknown', 'persisted but no stamp yet (the log starts at the migration): unknown, never stale');
  pass(a(F.UNKNOWN_FRESHNESS, ['health']).kind === 'unknown', 'the default before the first answer: unknown');
  pass(a(data([stamp('health', 'pharmacie', ago(2))]), ['health']).kind === 'fresh' && a(data([stamp('health', 'pharmacie', ago(2))]), ['health']).newest.ageDays === 2, 'a recent stamp: fresh, with its age');
  pass(a(data([stamp('health', 'p', ago(7, 1))]), ['health']).kind === 'fresh', 'exactly 7 days and a bit is not stale (the limit is "more than 7")');
  const s8 = a(data([stamp('health', 'p', ago(8, 1))]), ['health']);
  pass(s8.kind === 'stale' && s8.stale[0].ageDays === 8 && s8.stale[0].sector === 'health', 'more than 7 days: stale, naming the sector and its age');
  pass(a({ ...data([stamp('health', 'p', ago(8, 1))]), staleAfterDays: 14 }, ['health']).kind === 'fresh', 'the limit comes from the API (14 here), not from the app');
  const two = data([stamp('health', 'pharmacie', ago(20)), stamp('health', 'laboratoire', ago(1))]);
  pass(a(two, ['health']).kind === 'fresh', 'a sector is stale only when its newest department is: one fresh department keeps it fresh');
  pass(a(two, ['health'], ['pharmacie']).kind === 'stale' && a(two, ['health'], ['laboratoire']).kind === 'fresh', 'on a department tab only that department counts: a fresh sibling does not hide a silent one');
  pass(a(two, ['health'], ['grossiste']).kind === 'unknown', 'a department with no stamp says nothing (it is not "stale")');
  const mix = data([stamp('health', 'p', ago(12)), stamp('industry', '', ago(1)), stamp('energy', '', ago(30))]);
  const all = a(mix, ['health', 'industry', 'energy', 'eac']);
  pass(all.kind === 'stale' && all.stale.map(s => s.sector).join() === 'energy,health', `All: the silent sectors, the oldest first (${all.stale.map(s => s.sector)}); eac has no stamp and is not listed`);
  pass(all.newest.ageDays === 1, '…and the newest data across them is the 1-day-old one');
  pass(a(mix, ['industry']).kind === 'fresh', 'a sector pill looks only at its own sector');
  pass(a(mix, []).kind === 'unknown', 'no sectors: unknown');
  pass(a(data([stamp('health', 'p', ago(8, 1))]), ['health'], [], NOW + 10 * 86400000).stale[0].ageDays === 18, 'the age is counted from the stamp to now: a page left open for days goes on ageing');
  pass(a(data([{ sector: 'health', scope: 'p', last_upload_at: 'garbage' }]), ['health']).kind === 'unknown', 'a stamp that is not a date is ignored');
  pass(a(data([stamp('health', 'p', new Date(NOW + 5 * 86400000).toISOString())]), ['health']).newest.ageDays === 0, 'a time in the future is age 0, never negative');
  for (const [v, want] of [['0', true], ['0%', true], ['0 €', true], ['€ 0', true], ['0,0', true], ['00', true], ['10', false], ['0.5', false], ['40%', false], ['100', false], ['—', false], ['', false], ['1 0', false]])
    pass(F.isZeroFigure(v) === want, `isZeroFigure(${JSON.stringify(v)}) is ${want}`);
}

console.log('== source');
{
  const lib = fs.readFileSync(path.join(ROOT, 'lib', 'freshness.ts'), 'utf8');
  pass(!/> 7\b|>= 7\b/.test(lib), 'no 7-day comparison in the app: the limit comes from the API');
  pass(!/\bdark:/.test(fs.readFileSync(path.join(ROOT, 'components/sentria/freshness-note.tsx'), 'utf8')), 'the note has no dark: class (tokens only)');
}

// ---- the browser
const SECTORS = ['industry', 'health', 'energy'];
let id = 0;
const al = (sector, equipment, key, severity, daysAgo = 0) => ({ id: id++, equipment, sector, business_type: null, severity, date: new Date(Date.now() - daysAgo * 86400000).toISOString(), alert_key: key, message: 'm' });
const ALERTS = [
  al('health', 'Amoxicillin', 'health.stock.critical_low', 'CRITICAL'), al('health', 'Ibuprofen', 'health.stock.critical_low', 'CRITICAL', 1), al('health', 'Insulin', 'health.stock.low', 'WARNING'),
  al('industry', 'Press 1', 'industry.temperature.critical', 'CRITICAL'), al('energy', 'Gen 1', 'energy.fuel.critical', 'CRITICAL'),
];
const wall = (days, hours = 0) => new Date(Date.now() - days * 86400000 - hours * 3600000).toISOString();
const row = (sector, scope, when) => ({ sector, scope, last_upload_at: when, age_days: Math.floor((Date.now() - new Date(when).getTime()) / 86400000), stale: false, rows_processed: 10, alerts_fired: 1 });
const reply = (entries, persisted = true) => ({ freshness: entries, persisted, stale_after_days: 7 });

async function open(browser, { freshness, theme = 'light', width = 1440, scheme = 'light', lang = 'en', pill = 'Health', alerts = ALERTS, onUpload } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 1000 }, locale: lang === 'fr' ? 'fr-FR' : 'en-US', timezoneId: 'Europe/Paris', colorScheme: scheme });
  const p = await ctx.newPage(); const errs = []; let calls = 0; p.on('pageerror', e => errs.push(e.message));
  const state = { freshness };
  await p.route(/onrender\.com\//, r => {
    const u = new URL(r.request().url()); const json = (b, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(b) });
    if (u.pathname === '/freshness') { calls++; if (state.freshness === 'fail') return json({ detail: 'nope' }, 500); if (state.freshness === 'network') return r.abort(); return json(state.freshness); }
    if (u.pathname === '/alerts') return json(alerts);
    if (u.pathname === '/upload') { if (onUpload) onUpload(state); return json({ success: true, message: 'Processed 1 rows, 1 alert(s) fired.', rows_processed: 1, alerts_fired: 1 }); }
    return json({ recommendations: [], assignments: [], contractors: [] });
  });
  await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } },
    { sentria_language: lang, sentria_onboarded: 'true', sentria_sector: 'health', sentria_company_name: 'Acme', sentria_sectors: JSON.stringify(SECTORS), sentria_business_type: 'pharmacie', sentria_theme: theme });
  await signedIn(p, 'u', 'a@b.c', { plan: 'entreprise' });
  await p.goto(APP_URL); await p.waitForTimeout(2000);
  if (pill) { await p.getByRole('button', { name: new RegExp('^' + pill + '\\s*\\d*$') }).first().click(); await p.waitForTimeout(600); }
  return { ctx, p, errs, state, calls: () => calls };
}
const tile = (p, label) => p.evaluate(l => { const span = [...document.querySelectorAll('span')].find(s => s.textContent.trim() === l); const t = span && span.closest('.rounded-3xl'); return t ? { text: t.innerText.replace(/\s+/g, ' '), notMeasured: !!t.querySelector('[data-not-measured]'), spark: !!t.querySelector('svg[data-sparkline]') } : null; }, label);
const note = p => p.locator('[data-freshness]');

(async () => {
  const b = await chromium.launch(LAUNCH);

  console.log('== it cannot tell: no claim, nothing changed');
  for (const [label, freshness] of [['the log is not there yet (persisted false)', reply([row('health', 'pharmacie', wall(30))], false)], ['the table exists but has no stamp yet', reply([])], ['the request fails (HTTP 500)', 'fail'], ['the network is down', 'network'], ['an API without the route (old build)', 'fail']]) {
    const { ctx, p, errs } = await open(b, { freshness });
    const cold = await tile(p, 'Cold chain alerts');
    pass(await note(p).count() === 0 && cold && !cold.notMeasured && /\b0\b/.test(cold.text), `${label}: no note, and the zero is shown as a zero (${cold && cold.text})`);
    pass(errs.length === 0, `${label}: no page errors`);
    await ctx.close();
  }

  console.log('== recent data: a quiet line');
  {
    for (const [days, text] of [[0, /Data updated today/], [1, /Data updated yesterday/], [3, /Data updated 3 days ago/]]) {
      const { ctx, p } = await open(b, { freshness: reply([row('health', 'pharmacie', wall(days, 2))]) });
      const n = note(p);
      pass(await n.count() === 1 && await n.getAttribute('data-freshness') === 'fresh' && text.test(await n.innerText()), `${days} day(s): "${(await n.innerText().catch(() => '')).trim()}"`);
      await ctx.close();
    }
    const { ctx, p } = await open(b, { freshness: reply([row('health', 'pharmacie', wall(1, 2))]) });
    const cold = await tile(p, 'Cold chain alerts');
    pass(!cold.notMeasured && /\b0\b/.test(cold.text) && cold.spark, 'a real zero on fresh data stays a zero (with its line): it is a measurement');
    pass(await note(p).getAttribute('role') === 'status', 'the note is a status for assistive tech');
    await ctx.close();
  }

  console.log('== silent for more than 7 days: warned, and a zero is "not measured"');
  {
    const { ctx, p, errs } = await open(b, { freshness: reply([row('health', 'pharmacie', wall(12, 3))]) });
    const n = note(p);
    pass(await n.getAttribute('data-freshness') === 'stale', 'the warning is shown');
    const text = await n.innerText();
    const last = new Date(Date.now() - 12 * 86400000 - 3 * 3600000).toLocaleDateString('en-US', { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' });
    pass(/Health: no data for 12 days \(last file/.test(text), `it names the sector and the days (${text.split('\n')[0]})`);
    pass(text.includes('a zero here is not a measurement') && text.includes('Import a file to refresh'), 'it says what a zero means now, and what to do');
    pass(await n.locator('[data-stale-sector="health"]').count() === 1, 'one line per silent sector');
    const cold = await tile(p, 'Cold chain alerts');
    pass(cold.notMeasured && !/\b0\b/.test(cold.text.replace(/Cold chain alerts/, '')) && /Not measured/.test(cold.text), `the zero tile reads "—" and "Not measured: no recent data", not 0 (${cold.text})`);
    pass(!cold.spark, '…and its flat line is not drawn (it would draw a measurement that is not there)');
    const crit = await tile(p, 'Critical stockouts'); const low = await tile(p, 'Low stock');
    pass(!crit.notMeasured && /\b2\b/.test(crit.text) && crit.spark && /\b1\b/.test(low.text) && low.spark, `non-zero figures are facts that happened: kept, with their lines (${crit.text} | ${low.text})`);
    pass(await p.locator('[data-not-measured] .sr-only').first().innerText() === 'Not measured', 'a screen reader hears "Not measured", not a dash');
    await p.screenshot({ path: 'fresh-stale-light-1440.png' });
    pass(errs.length === 0, 'no page errors');
    await ctx.close();
  }

  console.log('== the limit is exact, and the department counts');
  {
    const a = await open(b, { freshness: reply([row('health', 'pharmacie', wall(7, 1))]) });
    pass(await note(a.p).getAttribute('data-freshness') === 'fresh', '7 days and an hour: still fresh');
    await a.ctx.close();
    const c = await open(b, { freshness: reply([row('health', 'pharmacie', wall(8, 1))]) });
    pass(await note(c.p).getAttribute('data-freshness') === 'stale', '8 days and an hour: stale');
    await c.ctx.close();
    const d = await open(b, { freshness: reply([row('health', 'pharmacie', wall(20)), row('health', 'laboratoire', wall(1))]) });
    pass(await note(d.p).getAttribute('data-freshness') === 'stale', 'the pharmacy view is on the pharmacy: its own silence shows even though the lab uploaded yesterday');
    await d.ctx.close();
    const e = await open(b, { freshness: reply([row('health', 'laboratoire', wall(30))]) });
    pass(await note(e.p).count() === 0, 'only another department has a stamp (and it is old): the pharmacy says nothing, it does not know');
    await e.ctx.close();
  }

  console.log('== All: the silent sectors are named, the others are not');
  {
    const { ctx, p } = await open(b, { pill: 'All', freshness: reply([row('health', 'pharmacie', wall(12)), row('industry', '', wall(1)), row('energy', '', wall(40))]) });
    const n = note(p);
    pass(await n.getAttribute('data-freshness') === 'stale' && await n.locator('[data-stale-sector]').count() === 2, 'two silent sectors, two lines');
    const lines = await n.locator('[data-stale-sector]').evaluateAll(els => els.map(e => e.getAttribute('data-stale-sector')));
    pass(lines.join() === 'energy,health', `the oldest first: ${lines}`);
    pass(!/Industry/.test(await n.innerText()), 'the sector that uploaded yesterday is not blamed');
    await ctx.close();
    const m = await open(b, { pill: 'All', freshness: reply(['health', 'industry', 'energy', 'agriculture', 'eac'].map((s, i) => row(s, '', wall(10 + i)))) });
    const t = await note(m.p).innerText();
    pass(/and 2 more|et 2 autres/.test(t) || (await note(m.p).locator('[data-stale-sector]').count()) <= 3, 'a long list stops at three');
    await m.ctx.close();
  }

  console.log('== an upload refreshes it');
  {
    const { ctx, p, errs, state, calls } = await open(b, { freshness: reply([row('health', 'pharmacie', wall(12))]), onUpload: st => { st.freshness = reply([row('health', 'pharmacie', new Date().toISOString())]); } });
    pass(await note(p).getAttribute('data-freshness') === 'stale' && (await tile(p, 'Cold chain alerts')).notMeasured, 'before: stale, the zero is "not measured"');
    const before = calls();
    await p.click('button[aria-controls=import-panel]'); await p.waitForTimeout(400);
    await p.locator('button[aria-pressed]', { hasText: 'Health' }).first().click(); await p.waitForTimeout(150);
    await p.locator('button[aria-pressed]', { hasText: 'Pharmac' }).first().click().catch(() => {});
    await p.setInputFiles('input[type=file]', { name: 'stock.csv', mimeType: 'text/csv', buffer: Buffer.from('medicine_name,stock_qty\nA,1\n') });
    await p.waitForTimeout(6500);
    pass(calls() > before, `it asks the API again after the upload (${before} -> ${calls()} calls)`);
    pass(await note(p).getAttribute('data-freshness') === 'fresh' && /today/.test(await note(p).innerText()), 'after: "Data updated today"');
    const cold = await tile(p, 'Cold chain alerts');
    pass(cold && !cold.notMeasured && /\b0\b/.test(cold.text), 'and the zero is a zero again');
    pass(errs.length === 0, 'no page errors');
    await ctx.close();
  }

  console.log('== French');
  {
    const { ctx, p } = await open(b, { lang: 'fr', pill: 'Santé', freshness: reply([row('health', 'pharmacie', wall(12, 3))]) });
    const text = await note(p).innerText();
    pass(/Santé : aucune donnée depuis 12 jours \(dernier fichier le/.test(text) && /un zéro n'est pas une mesure/.test(text) && /Importez un fichier pour actualiser/.test(text), `the warning in French (${text.split('\n')[0]})`);
    const cold = await p.evaluate(() => { const t = document.querySelector('[data-not-measured]'); return t && t.closest('.rounded-3xl').innerText.replace(/\s+/g, ' '); });
    pass(/Non mesuré : pas de données récentes/.test(cold || ''), `the tile in French (${cold})`);
    await ctx.close();
    const f = await open(b, { lang: 'fr', pill: 'Santé', freshness: reply([row('health', 'pharmacie', wall(1, 2))]) });
    pass(/Données mises à jour hier/.test(await note(f.p).innerText()), 'and the quiet line');
    await f.ctx.close();
  }

  console.log('== themes and a phone');
  {
    const tokens = async (p) => p.evaluate(() => { const e = document.createElement('i'); const out = {}; for (const [k, v] of [['bg', '--tag-warning-bg'], ['fg', '--tag-warning-fg']]) { e.style.color = `var(${v})`; document.body.appendChild(e); out[k] = getComputedStyle(e).color; } e.remove(); return out; });
    for (const [name, theme, scheme] of [['dark', 'dark', 'light'], ['system, OS dark', 'system', 'dark']]) {
      const { ctx, p } = await open(b, { theme, scheme, freshness: reply([row('health', 'pharmacie', wall(12))]) });
      const t = await tokens(p); const s = await note(p).evaluate(el => ({ color: getComputedStyle(el).color, bg: getComputedStyle(el).backgroundColor }));
      pass(s.color === t.fg, `${name}: the warning is in the warning-tag colours (text ${s.color})`);
      if (theme === 'dark') await p.screenshot({ path: 'fresh-stale-dark-1440.png' });
      await ctx.close();
    }
    for (const theme of ['light', 'dark']) {
      const { ctx, p, errs } = await open(b, { theme, width: 390, freshness: reply([row('health', 'pharmacie', wall(12))]) });
      const m = await p.evaluate(() => { const n = document.querySelector('[data-freshness]').getBoundingClientRect(); return { page: document.documentElement.scrollWidth, win: innerWidth, inside: n.left >= 0 && n.right <= innerWidth, h: n.height }; });
      pass(m.page <= m.win + 1 && m.inside, `${theme}, 390 px: no sideways scroll; the note fits (${Math.round(m.h)} px tall)`);
      await p.screenshot({ path: `fresh-stale-${theme}-390.png` });
      pass(errs.length === 0, `${theme}, 390 px: no page errors`);
      await ctx.close();
    }
  }

  await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL OK');
  process.exit(fails ? 1 : 0);
})();
