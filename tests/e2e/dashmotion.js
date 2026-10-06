// The dashboard comes alive, after the founder's reference video ("Dashboard
// Animations"): the blocks of the page rise in one after another, top to
// bottom and left to right; the numbers count up; the lines grow from their
// baseline, the ring sweeps round, the bars fill; a dialog blurs what is
// behind it. This checks the choreography (order, timing, the data motion
// starting with its block and never before it), that nothing is left behind
// once it has played, that it replays when you come back to the page and not
// when the numbers just change, that "reduce motion" turns it all off, and
// that a click still lands while it plays. app/transitions.css holds the
// keyframes, lib/motion.ts the order and the wait, count-number.tsx the counter.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ts = require(path.join(__dirname, '..', '..', 'node_modules', 'typescript'));
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const ROOT = path.join(__dirname, '..', '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const ms = v => parseFloat(v) * (/ms$/.test(v) ? 1 : 1000);
const sha = b => crypto.createHash('sha1').update(b).digest('hex');

const load = file => { const js = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} }; new Function('require', 'module', 'exports', js)(() => ({}), mod, mod.exports); return mod.exports; };

// ---- the data: a pharmacy with stock lines and limits, plus an industrial site and a generator
const at = (daysAgo, hour = 12) => { const d = new Date(); d.setHours(hour, 0, 0, 0); d.setDate(d.getDate() - daysAgo); return d.toISOString(); };
let id = 0;
const al = (sector, equipment, key, severity, params, daysAgo = 0) => ({ id: id++, equipment, sector, business_type: null, severity, date: at(daysAgo, 8 + (id % 9)), alert_key: key, message: `${equipment}: ${key.split('.').slice(1).join(' ')}`, params });
const stock = (eq, s, m, daysAgo = 0) => al('health', eq, s < m ? 'health.stock.critical_low' : 'health.stock.low', s < m ? 'CRITICAL' : 'WARNING', [['stock', s], ['min_stock', m]], daysAgo);
const lim = (v, l, side, unit, name = 'value') => [[name, v], ['limit', l], ['limit_side', side], ...(unit ? [['limit_unit', unit]] : [])];
const ROWS = [];
for (const [f, n] of Object.entries({ stock: 14, expiry: 9, cold_chain: 7, reorder: 5, slow_mover: 3, deadstock: 2 }))
  for (let k = 0; k < n; k++) ROWS.push(al('health', `${f}-${k}`, `health.${f}.low`, k % 3 === 0 ? 'CRITICAL' : 'WARNING', [], (k * 2 + f.length) % 9));
ROWS.push(stock('Amoxicillin', 20, 100), stock('Ibuprofen', 60, 100), stock('Insulin', 112, 100), stock('Paracetamol', 5, 50), stock('Saline', 30, 40));
ROWS.push(al('industry', 'Press 1', 'industry.temperature.critical', 'CRITICAL', lim(330, 315, 'max', '°C')), al('energy', 'Gen 1', 'energy.fuel.critical', 'CRITICAL', lim(8, 10, 'min', '%', 'level')), al('energy', 'Gen 2', 'energy.coolant.overheat', 'CRITICAL', lim(120, 95, 'max', '°C', 'temp')));
const FEWER = ROWS.slice(0, 40);
const LS = { sentria_language: 'en', sentria_onboarded: 'true', sentria_sector: 'health', sentria_company_name: 'Acme', sentria_sectors: JSON.stringify(['industry', 'health', 'energy']), sentria_business_type: 'pharmacie' };

// ---- in the page: every animation of ours that starts, and the moment each counter leaves 0
function sampler() {
  const epoch = () => performance.timeOrigin + performance.now();
  window.__ev = []; window.__starts = new WeakMap(); window.__count = new Map();
  document.addEventListener('animationstart', e => {
    if (!/^t-/.test(e.animationName)) return;
    window.__ev.push({ n: e.animationName, t: epoch(), el: e.target });
    if (e.animationName === 't-enter') window.__starts.set(e.target, (window.__starts.get(e.target) || 0) + 1);
  }, true);
  setInterval(() => { for (const el of document.querySelectorAll('.t-count-live')) if (!window.__count.has(el) && +getComputedStyle(el).getPropertyValue('--t-n') > 0) window.__count.set(el, epoch()); }, 8);
}
// What the sampler saw, in plain numbers (ms after the first block began to rise).
function summarise() {
  const first = new Map(); for (const e of window.__ev) if (e.n === 't-enter' && !first.has(e.el)) first.set(e.el, e.t);
  const t0 = Math.min(...first.values()); const r = x => Math.round(x - t0);
  const sweepOf = el => el.hasAttribute('data-sweep') ? 'sweep' : el.hasAttribute('data-grow') ? 'grow' : el.hasAttribute('data-stock-bar') ? 'bar' : el.hasAttribute('data-gauge-fill') ? 'gauge' : el.closest('[data-sparkline]') ? 'spark' : 'pop';
  return {
    t0,
    blocks: [...document.querySelectorAll('.t-enter')].map(b => ({ at: +getComputedStyle(b).getPropertyValue('--i'), start: first.has(b) ? r(first.get(b)) : null, dur: getComputedStyle(b).animationDuration, fill: getComputedStyle(b).animationFillMode, name: getComputedStyle(b).animationName, starts: window.__starts.get(b) || 0 })),
    marks: window.__ev.filter(e => e.n !== 't-enter').map(e => { const b = e.el.closest('.t-enter'); return { n: e.n, what: sweepOf(e.el), start: r(e.t), block: b && first.has(b) ? r(first.get(b)) : null }; }),
    counts: [...window.__count].filter(([el]) => el.isConnected).map(([el, t]) => { const b = el.closest('.t-enter'); return { start: r(t), block: b && first.has(b) ? r(first.get(b)) : null }; }),
    firstEpoch: t0,
  };
}

// ---- a tiny fake DOM to run the real motion.ts (entranceWait, waitForEntrance)
const animation = (name, delay, time, extra = {}) => { const a = { animationName: name, currentTime: time, effect: { delay, getTiming() { return { delay: this.delay }; }, updateTiming(t) { this.delay = t.delay; } }, ...extra }; return a; };
const node = (animations, parent = null, sub = []) => ({ parentElement: parent, getAnimations: (o) => o && o.subtree ? [...animations, ...sub] : animations });

(async () => {
  console.log('== the order, and the wait (lib/motion.ts, run for real)');
  {
    const M = load('lib/motion.ts');
    const i = n => M.enterAt(n)['--i'];
    pass(M.MAX_ENTER === 9 && i(0) === 0 && i(3.6) === 3.6 && i(9) === 9 && i(40) === 9 && i(-2) === 0, `enterAt keeps a place between 0 and ${M.MAX_ENTER} (fractions allowed): ${[0, 3.6, 9, 40, -2].map(i)}`);
    const none = node([]);
    pass(M.entranceWait(null) === 0 && M.entranceWait(none) === 0, 'no block above: no wait');
    const card = node([animation('t-enter', 300, 50)]); const mark = node([], card);
    pass(M.entranceWait(mark) === 250, 'a block that has run 50 ms of a 300 ms delay: 250 ms left');
    pass(M.entranceWait(node([], node([animation('t-enter', 300, 300)]))) === 0 && M.entranceWait(node([], node([animation('t-enter', 300, 900)]))) === 0, 'a block that has started, or finished: no wait');
    pass(M.entranceWait(node([], node([animation('pulse', 300, 0)]))) === 0 && M.entranceWait(node([], node([animation('t-grow-y', 300, 0)]))) === 0, 'other animations around it do not count');
    const outer = node([animation('t-enter', 120, 0)]); const inner = node([animation('t-enter', 330, 30)], outer);
    pass(M.entranceWait(node([], inner)) === 300, 'blocks inside blocks: the longest wait (300 ms)');
    pass(M.entranceWait({ parentElement: null }) === 0, 'an element without getAnimations (an old browser) does not throw');

    const grow = animation('t-grow-y', 0, 0), draw = animation('t-draw', 150, 0), enter = animation('t-enter', 0, 0), pulse = animation('animate-pulse', 0, 0);
    const el = node([grow], card, [draw, enter, pulse]);
    M.waitForEntrance(el);
    pass(grow.effect.delay === 250 && draw.effect.delay === 400, `its own animations, and those below it, are pushed back by the wait (${grow.effect.delay}, ${draw.effect.delay} ms)`);
    pass(enter.effect.delay === 0 && pulse.effect.delay === 0, 'a rise of its own, or an animation that is not ours, is left alone');
    M.waitForEntrance(el);
    pass(grow.effect.delay === 250, 'called again (a second render pass), it does not push twice');
    const late = animation('t-grow-y', 0, 0); M.waitForEntrance(node([late], node([animation('t-enter', 300, 400)])));
    pass(late.effect.delay === 0, 'data that arrives after its block has risen starts at once');
    pass(M.waitForEntrance(null) === undefined, 'null (an element going away) is fine');
  }

  console.log('== the stylesheet and the code');
  {
    const css = read('app/transitions.css'); const mine = css.slice(css.indexOf("The dashboard's entrance and data motion (ours)"));
    pass(mine.length > 500, 'transitions.css has its own section for this');
    const vars = k => parseFloat((mine.match(new RegExp(`--${k}:\\s*([\\d.]+)ms`)) || [])[1]);
    const MAX = 9; const endOfEntrance = MAX * vars('enter-step') + vars('enter-dur');
    pass(vars('enter-dur') <= 500 && vars('enter-step') <= 80 && endOfEntrance <= 1000, `the page's own rise ends within a second (${vars('enter-step')} ms steps, ${vars('enter-dur')} ms each, last one done at ${endOfEntrance} ms)`);
    pass(vars('count-dur') <= 1000 && vars('grow-dur') <= 1000, `a count or a chart takes under a second (${vars('count-dur')}, ${vars('grow-dur')} ms)`);
    pass(!/\b(forwards|both)\b/.test(mine.replace(/\/\*[\s\S]*?\*\//g, '')), 'no animation holds its end state (fill mode "backwards" only): nothing stays transformed, so nothing becomes a containing block');
    pass(/@property --t-n\s*\{\s*syntax:\s*"<integer>";\s*inherits:\s*false;\s*initial-value:\s*0;/.test(mine), 'the counter is a registered integer');
    const reduce = mine.slice(mine.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
    for (const c of ['.t-enter', '.t-grow-y', '.t-draw', '.t-sweep', '.t-reveal-x', '.t-pop']) pass(reduce.includes(c), `"reduce motion" switches off ${c}`);
    pass(/\.t-count-live\s*\{\s*display:\s*none/.test(reduce) && /\.t-count-final\s*\{\s*color:\s*inherit/.test(reduce), '…and shows the plain number');
    pass(/\.t-modal-backdrop\.is-open\s*\{[^}]*backdrop-filter:\s*blur\(6px\)/.test(css), 'a dialog blurs what is behind it');
    const files = ['components/sentria/count-number.tsx', 'lib/motion.ts', 'components/sentria/charts.tsx', 'components/sentria/priority-nav.tsx', 'components/sentria/dashboard-view.tsx'];
    pass(files.every(f => !/\bdark:/.test(read(f))), 'theme tokens, never dark:');
    pass(['components/sentria/count-number.tsx', 'lib/motion.ts'].every(f => !/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test(read(f))), 'no colour literal in the new files');
    const charts = read('components/sentria/charts.tsx');
    pass((charts.match(/ref=\{waitForEntrance\}/g) || []).length === 6, 'the six animated marks (plot, end dots, ring, gauge, bars, sparkline) wait for their block');
    pass(/const sweepKey = slices\.map\(\(s\) => s\.key\)/.test(charts), 'the ring sweeps again for other parts, not for the same parts in another language');
    pass(/entranceWait\(root\.current\)/.test(read('components/sentria/count-number.tsx')), 'a counter waits for its block too');
    const view = read('components/sentria/dashboard-view.tsx');
    pass((view.match(/key=\{k\.id\}/g) || []).length === 3 && !/key=\{k\.label\}/.test(view), 'a KPI tile is keyed by its French name: a language switch changes its text, not the tile');
  }

  const browser = await chromium.launch(LAUNCH);
  const open = async ({ rows = ROWS, delay = 0, theme = 'light', width = 1440, reduced = false, lang = 'en' } = {}) => {
    const ctx = await browser.newContext({ viewport: { width, height: 1000 }, locale: 'en-US', reducedMotion: reduced ? 'reduce' : 'no-preference' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    p._rows = rows; p._arrived = 0;
    await p.route(/onrender\.com\//, async r => { const u = new URL(r.request().url());
      if (u.pathname === '/alerts') { if (delay) await new Promise(res => setTimeout(res, delay)); p._arrived = Date.now(); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(p._rows) }); }
      return r.fulfill({ status: 200, contentType: 'application/json', body: '{"recommendations":[],"assignments":[],"contractors":[]}' }); });
    await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } }, { ...LS, sentria_theme: theme, sentria_language: lang });
    await p.addInitScript({ content: `(${sampler.toString()})()` });
    await signedIn(p, 'u', 'a@b.c', { plan: 'entreprise' });
    await p.goto(APP_URL);
    return { ctx, p };
  };
  const nav = (p, name) => p.locator('aside nav button').filter({ hasText: new RegExp('^' + name + '$') }).locator('visible=true').first().click();

  console.log('== it arrives: blocks rise in order, data motion starts with its block');
  { const { ctx, p } = await open(); await p.waitForTimeout(3200);
    const s = await p.evaluate(summarise);
    const started = s.blocks.filter(b => b.start !== null);
    pass(started.length >= 10 && started.length === s.blocks.length, `every block of the page rises (${started.length} of ${s.blocks.length})`);
    pass(started.every(b => b.name === 't-enter' && b.fill === 'backwards' && ms(b.dur) <= 420), `each takes ${[...new Set(started.map(b => b.dur))].join('/')} and holds nothing afterwards`);
    pass(started.every((b, i) => i === 0 || b.at >= started[i - 1].at), `top to bottom, left to right: their places never go back (${started.map(b => b.at).join(', ')})`);
    pass(started.every(b => Math.abs(b.start - b.at * 60) <= 110), `each starts when its place says (place x 60 ms, within 110 ms for a busy frame): ${started.map(b => `${+b.at.toFixed(1)}->${b.start}`).join(' ')}`);
    pass(started.every((b, i) => started.slice(i + 1).every(c => c.at - b.at < 1.5 || c.start >= b.start - 40)), 'blocks a place or two apart start in order');
    pass(Math.max(...started.map(b => b.start)) >= 300 && Math.max(...started.map(b => b.start)) <= 650, `the last block starts at ${Math.max(...started.map(b => b.start))} ms: a stagger you can see, still brisk`);
    pass(started.every(b => b.starts === 1), 'each block rises once');
    const kinds = k => s.marks.filter(m => m.what === k);
    for (const [k, min] of [['grow', 1], ['sweep', 1], ['spark', 4], ['bar', 4], ['pop', 1]]) pass(kinds(k).length >= min, `${k}: ${kinds(k).length} animation(s) (at least ${min})`);
    pass(s.marks.every(m => m.block === null || m.start >= m.block - 40), `no data motion starts before its block does (worst: ${Math.min(...s.marks.filter(m => m.block !== null).map(m => m.start - m.block))} ms)`);
    pass(kinds('grow').concat(kinds('sweep')).every(m => m.block !== null && m.start - m.block <= 150), `the line plot and the ring start with their card (${kinds('grow').concat(kinds('sweep')).map(m => `${m.what} +${m.start - m.block}`).join(', ')} ms)`);
    pass(kinds('bar').every((m, i) => i === 0 || m.start >= kinds('bar')[i - 1].start - 5), 'the stock bars fill one after another');
    pass(s.counts.length === 5 && s.counts.every(c => c.block !== null && c.start >= c.block - 40 && c.start - c.block <= 500), `every counter (the four tiles and the ring's total) leaves 0 with its block, not before and not late (${s.counts.map(c => c.start - c.block).join(', ')} ms)`);
    const end = Math.max(...s.marks.map(m => m.start)) + 750;
    pass(end <= 1900, `all of it is done about ${end} ms after the first block`);

    const after = await p.evaluate(() => ({
      running: document.getAnimations().filter(a => /^t-/.test(a.animationName || '')).length,
      leftover: [...document.querySelectorAll('.t-enter')].filter(b => { const c = getComputedStyle(b); return c.transform !== 'none' || c.opacity !== '1' || c.filter !== 'none'; }).length,
      counters: [...document.querySelectorAll('.t-count')].map(c => [c.querySelector('.t-count-final').textContent.trim(), getComputedStyle(c.querySelector('.t-count-live')).getPropertyValue('--t-n')]),
      drawn: [...document.querySelectorAll('.t-count')].map(c => [c.querySelector('.t-count-final').getBoundingClientRect().width, c.querySelector('.t-count-live').getBoundingClientRect().width]),
      sweep: getComputedStyle(document.querySelector('[data-sweep]')).strokeDashoffset,
      spark: getComputedStyle(document.querySelector('svg[data-sparkline] path')).strokeDashoffset,
      barClip: getComputedStyle(document.querySelector('[data-stock-bar]')).clipPath,
      growT: getComputedStyle(document.querySelector('[data-grow]')).transform,
    }));
    pass(after.running === 0, `nothing of ours is still animating once it has played (${after.running})`);
    pass(after.leftover === 0, 'no block keeps a transform, a fade or a filter (none can trap a dropdown or a fixed layer)');
    pass(after.counters.length === 5 && after.counters.every(([text, n]) => text === n), `every counter ends on its real number (${after.counters.map(c => c.join('=')).join(' ')})`);
    pass(after.drawn.length === 5 && after.drawn.every(([real, live]) => live > 0 && Math.abs(real - live) <= 1.5), `the counter draws its number (a counter that drew nothing would leave the figure see-through): widths ${after.drawn.map(([r, l]) => `${r.toFixed(0)}/${l.toFixed(0)}`).join(' ')}`);
    pass(parseFloat(after.sweep) === 0 && parseFloat(after.spark) === 0 && after.barClip === 'none' && after.growT === 'none', 'the ring, the lines, the bars and the plot are whole again');
    await p.screenshot({ path: 'dashmotion-light.png', fullPage: true });
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== the ring: drawn by a sweep, and whole when it has played');
  { const { ctx, p } = await open();
    await p.evaluate(() => { window.__off = []; const i = setInterval(() => { const c = document.querySelector('[data-sweep]'); if (c) window.__off.push(+parseFloat(getComputedStyle(c).strokeDashoffset).toFixed(3)); }, 16); setTimeout(() => clearInterval(i), 2500); });
    await p.waitForTimeout(3000);
    const off = await p.evaluate(() => window.__off); const run = off.filter(v => v > 0);
    pass(run.length >= 8 && run[0] > 0.4 && run.every((v, i) => i === 0 || v <= run[i - 1] + 1e-3), `the dash offset runs from ${run[0]} down to 0 in ${run.length} steps, never back`);
    pass(off.at(-1) === 0, 'and rests at 0');
    const g = await p.evaluate(() => { const c = document.querySelector('[data-sweep]'); const m = c.closest('mask'); const grp = document.querySelector(`g[mask="url(#${m.id})"]`); return { mask: !!m, group: !!grp, slices: grp ? grp.querySelectorAll('path[data-slice]').length : 0, all: document.querySelectorAll('path[data-slice]').length, stroke: c.getAttribute('stroke'), len: c.getAttribute('pathLength'), dash: getComputedStyle(c).strokeDasharray }; });
    pass(g.mask && g.group && g.slices >= 3 && g.slices === g.all, `the ring is cut by a mask whose stroke draws: every one of the ${g.slices} slices is inside it`);
    pass(g.len === '1' && g.stroke === 'white' && /^1(px)?[ ,]+1\.5/.test(g.dash), `the stroke is measured as 1 and has a gap longer than itself, so a round cap leaves no dot (${g.dash})`);
    const shot = await p.locator('[data-chart="donut"] svg').screenshot();
    await ctx.close();
    const calm = await open({ reduced: true }); await calm.p.waitForTimeout(2000);
    const still = await calm.p.locator('[data-chart="donut"] svg').screenshot();
    pass(sha(shot) === sha(still), 'after the sweep the ring looks exactly like the one that never animated (the mask hides nothing)');
    await calm.ctx.close(); }

  console.log('== hovering the ring does not replay anything');
  { const { ctx, p } = await open(); await p.waitForTimeout(2800);
    const before = await p.evaluate(() => { window.__mark = [document.querySelector('[data-sweep]'), document.querySelector('[data-donut-center] .t-count')]; window.__n = window.__ev.length; return document.querySelector('[data-donut-center]').innerText.split('\n')[0]; });
    await p.locator('[data-chart="donut"] ul li').nth(1).hover(); await p.waitForTimeout(400);
    const during = await p.evaluate(() => ({ text: document.querySelector('[data-donut-center]').innerText.split('\n')[0], hidden: getComputedStyle(document.querySelector('[data-donut-center] .t-count')).visibility }));
    pass(during.text !== before && during.hidden === 'hidden', `a slice's number replaces the total (${before} then ${during.text}), the total waits underneath`);
    await p.mouse.move(5, 5); await p.waitForTimeout(1200);
    const back = await p.evaluate(() => ({ text: document.querySelector('[data-donut-center]').innerText.split('\n')[0], same: window.__mark[0] === document.querySelector('[data-sweep]') && window.__mark[1] === document.querySelector('[data-donut-center] .t-count'), n: window.__ev.length - window.__n, live: getComputedStyle(document.querySelector('[data-donut-center] .t-count-live')).getPropertyValue('--t-n') }));
    pass(back.text === before && back.same && back.n === 0 && back.live === before, `the pointer leaves: the total is back (${back.text}), the same counter and ring, nothing animates again (${back.n} starts)`);
    await ctx.close(); }

  console.log('== data that arrives late is not held back by the page');
  { const { ctx, p } = await open({ delay: 700 });
    await p.waitForTimeout(450);
    const early = await p.evaluate(() => { const tiles = [...document.querySelectorAll('[data-kpi-skeleton]')]; window.__tiles = tiles; return { n: tiles.length, labels: tiles.map(t => t.querySelector('span').textContent.trim()), pulsing: document.querySelectorAll('[data-skeleton]').length, chart: !!document.querySelector('[data-chart-skeleton]') }; });
    pass(early.n === 4 && early.labels.every(Boolean) && early.pulsing >= 8 && early.chart, `while the alerts load the blocks have risen with placeholders in them (${early.n} tiles: ${early.labels.join(' / ')})`);
    await p.waitForTimeout(3000);
    const s = await p.evaluate(summarise); const arrived = p._arrived - s.firstEpoch;
    const tiles = await p.evaluate(() => window.__tiles.map(t => ({ connected: t.isConnected, skeleton: t.hasAttribute('data-kpi-skeleton'), starts: window.__starts.get(t) || 0, number: !!t.querySelector('.t-count') })));
    pass(tiles.every(t => t.connected && !t.skeleton && t.number && t.starts === 1), 'the same four tiles take the numbers: no new tile, no second rise');
    const m = k => s.marks.filter(x => x.what === k);
    pass(m('grow').length === 1 && m('grow')[0].start - arrived >= -30 && m('grow')[0].start - arrived <= 300, `the plot grows as the data lands (${m('grow')[0].start - arrived} ms after it)`);
    pass(m('sweep').length === 1 && m('sweep')[0].start - arrived >= -30 && m('sweep')[0].start - arrived <= 300, `the ring sweeps as the data lands (${m('sweep')[0].start - arrived} ms after it)`);
    pass(s.counts.length === 5 && s.counts.every(c => c.start - arrived >= -30 && c.start - arrived <= 450), `the counters start at once (${s.counts.map(c => c.start - arrived).join(', ')} ms after it)`);
    pass(s.blocks.every(b => b.starts <= 1), 'no block rose twice');
    await ctx.close(); }

  console.log('== it plays again when you come back to the page, and not when numbers change');
  { const { ctx, p } = await open(); await p.waitForTimeout(3000);
    await nav(p, 'Tracking'); await p.waitForTimeout(1200);
    await p.evaluate(() => { window.__ev.length = 0; window.__count.clear(); });
    await nav(p, 'Dashboard'); await p.waitForTimeout(3000);
    const s = await p.evaluate(summarise); const started = s.blocks.filter(b => b.start !== null);
    pass(started.length >= 10 && started.every(b => Math.abs(b.start - b.at * 60) <= 110), `coming back: the page rises again, in order (${started.length} blocks)`);
    pass(s.marks.length >= 12 && s.marks.every(m => m.block === null || m.start >= m.block - 40), `…and the data motion goes with its block, though the data was already there (${s.marks.length} animations)`);
    pass(s.counts.length === 5 && s.counts.every(c => c.block !== null && c.start >= c.block - 40), `…and so do the counters (${s.counts.length})`);

    await p.evaluate(() => { window.__plot = document.querySelector('[data-grow]'); window.__ring = document.querySelector('[data-sweep]'); window.__ev.length = 0; });
    p._rows = FEWER;
    await p.evaluate(() => { localStorage.setItem('sentria_language', 'fr'); window.dispatchEvent(new Event('sentria_locale_updated')); }); await p.waitForTimeout(1500);
    const kept = await p.evaluate(() => ({ plot: window.__plot.isConnected, ring: window.__ring.isConnected, starts: window.__ev.filter(e => /grow|draw|reveal/.test(e.n)).length, text: document.querySelector('[data-donut-center]').innerText.split('\n')[0] }));
    pass(kept.plot && kept.ring && kept.starts === 0, `new numbers (and another language) for the same lines and parts: the plot and the ring stay, nothing replays (${kept.starts} starts, centre ${kept.text})`);

    await p.getByRole('button', { name: 'Options du graphique' }).click(); await p.waitForTimeout(300);
    await p.getByRole('dialog').locator('label:has(input[data-range="30"])').click(); await p.waitForTimeout(1200);
    const grown = await p.evaluate(() => ({ plot: !window.__plot.isConnected, again: window.__ev.filter(e => e.n === 't-grow-y').length, dots: window.__ev.filter(e => e.n === 't-pop').length }));
    pass(grown.plot && grown.again === 1 && grown.dots === 1, `another span of days: the plot is drawn again, once, from its baseline (${grown.again} grow, ${grown.dots} end dots)`);
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== a click lands while the page is still rising');
  { const { ctx, p } = await open();
    await p.waitForFunction(() => window.__ev && window.__ev.some(e => e.n === 't-enter'));
    await p.waitForTimeout(160);
    const before = await p.evaluate(() => [...document.querySelectorAll('.t-enter')].filter(b => getComputedStyle(b).opacity !== '1').length);
    const labels0 = await p.evaluate(() => [...document.querySelectorAll('main span.text-sm.text-muted-foreground')].map(s => s.textContent.trim()).join('|'));
    const box = await p.getByRole('button', { name: /^All\s*\d*$/ }).first().boundingBox();
    await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await p.waitForTimeout(1500);
    const labels1 = await p.evaluate(() => [...document.querySelectorAll('main span.text-sm.text-muted-foreground')].map(s => s.textContent.trim()).join('|'));
    const wide = await p.evaluate(summarise); const gauges = wide.marks.filter(m => m.what === 'gauge');
    pass(before >= 3, `the click comes while ${before} blocks are still rising`);
    pass(gauges.length >= 2 && gauges.every(m => m.block !== null && m.start >= m.block - 40), `the page widens to All and its gauges draw with their block (${gauges.length}: ${gauges.map(m => m.start - m.block).join(', ')} ms after it)`);
    pass(labels0 !== labels1 && /Total alerts|Critical alerts/.test(labels1), `…and it lands: the All pill widens the page (${labels0.slice(0, 40)} then ${labels1.slice(0, 50)})`);
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== other sectors: the overview pages rise too');
  for (const [name, ls, rows, pill] of [
    ['industry', { sentria_sector: 'industry', sentria_sectors: '["industry"]', sentria_business_type: 'usine-production', sentria_departments: '{"industry":["usine-production"]}', sentria_equipment: '["machines","motors","production","maintenance-production-link"]', sentria_company_name: 'Usine Nord' },
      [al('industry', 'Presse P1', 'industry.generic', 'CRITICAL'), al('industry', 'Moteur M2', 'industry.generic', 'WARNING')].map(a => ({ ...a, business_type: 'usine-production' })), /^Industry/],
  ]) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    await p.route(/onrender\.com\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: new URL(r.request().url()).pathname === '/alerts' ? JSON.stringify(rows) : '{"recommendations":[],"assignments":[],"contractors":[]}' }));
    await p.addInitScript(l => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(l)) localStorage.setItem(k, v); } }, { sentria_language: 'en', sentria_onboarded: 'true', sentria_theme: 'light', ...ls });
    await p.addInitScript({ content: `(${sampler.toString()})()` });
    await signedIn(p, 'u', 'a@b.c', { plan: 'entreprise' }); await p.goto(APP_URL); await p.waitForTimeout(1800);
    const b = p.getByRole('button', { name: pill }).first();
    if (await p.getByTestId('priority-bento').count() === 0 && await b.count()) { await b.click().catch(() => {}); await p.waitForTimeout(800); }
    await nav(p, 'Tracking'); await p.waitForTimeout(900);
    await p.evaluate(() => { window.__ev.length = 0; window.__count.clear(); });
    await nav(p, 'Dashboard'); await p.waitForTimeout(2500);
    const s = await p.evaluate(summarise); const started = s.blocks.filter(x => x.start !== null);
    pass(started.length >= 6 && started.every(x => x.starts === 1), `${name}: ${started.length} blocks rise, each once (places ${started.map(x => x.at).join(', ')})`);
    pass(started.every((x, i) => i === 0 || x.at >= started[i - 1].at), `${name}: top to bottom`);
    pass(s.counts.length >= 4 && s.counts.every(c => c.block !== null && c.start >= c.block - 40), `${name}: the numbers (${s.counts.length}) count with their block`);
    pass(s.marks.filter(m => m.what === 'spark').length >= 4, `${name}: the tight strip's four lines draw`);
    const strip = await p.evaluate(() => { const g = document.querySelector('main .grid.gap-px'); return g ? { own: g.classList.contains('t-enter'), kids: [...g.children].filter(c => c.classList.contains('t-enter')).length } : null; });
    pass(strip && strip.own && strip.kids === 0, `${name}: the tight KPI strip rises as one block`);
    pass(p._errors.length === 0, `${name}: no page errors ${p._errors.join('|')}`);
    await ctx.close();
  }

  console.log('== reduce motion: nothing plays, everything is there at once');
  { const { ctx, p } = await open({ reduced: true }); await p.waitForTimeout(1500);
    const r = await p.evaluate(() => ({
      started: window.__ev.length,
      hidden: [...document.querySelectorAll('.t-enter')].filter(b => getComputedStyle(b).opacity !== '1' || getComputedStyle(b).transform !== 'none').length,
      blocks: document.querySelectorAll('.t-enter').length,
      names: [...new Set([...document.querySelectorAll('.t-enter, [data-sweep], [data-grow], [data-stock-bar], svg[data-sparkline] path')].map(e => getComputedStyle(e).animationName))],
      live: [...document.querySelectorAll('.t-count-live')].map(e => getComputedStyle(e).display),
      final: [...document.querySelectorAll('.t-count-final')].map(e => getComputedStyle(e).color),
      counters: [...document.querySelectorAll('.t-count-final')].map(e => e.textContent.trim()),
    }));
    pass(r.started === 0 && r.blocks >= 10 && r.hidden === 0, `no animation starts; the ${r.blocks} blocks are fully shown from the first frame`);
    pass(r.names.length === 1 && r.names[0] === 'none', `nothing has an animation name (${r.names})`);
    pass(r.live.length === 5 && r.live.every(d => d === 'none') && r.final.every(c => !/rgba\(0, 0, 0, 0\)/.test(c)) && r.counters.every(t => /^\d+$/.test(t)), 'the numbers are plain text, no counter drawn over them');
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== a dialog blurs the page behind it');
  for (const reduced of [false, true]) {
    const { ctx, p } = await open({ reduced }); await p.waitForTimeout(2500);
    await p.locator('aside').getByRole('button', { name: /^Sign out$/ }).click(); await p.waitForTimeout(700);
    const d = await p.evaluate(() => { const back = document.querySelector('[role="alertdialog"]').parentElement; const c = getComputedStyle(back); return { cls: back.className, blur: c.backdropFilter || c.webkitBackdropFilter, op: c.opacity }; });
    pass(/t-modal-backdrop/.test(d.cls) && /blur\(6px\)/.test(d.blur) && d.op === '1', `${reduced ? 'reduce motion' : 'normal'}: the backdrop is ${d.blur}`);
    await p.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click(); await p.waitForTimeout(500);
    pass(await p.locator('[role="alertdialog"]').count() === 0, `${reduced ? 'reduce motion' : 'normal'}: and goes away again`);
    await ctx.close();
  }

  console.log('== light, dark, 390 px');
  for (const [label, o] of [['dark', { theme: 'dark' }], ['390 px', { width: 390 }], ['390 px dark', { width: 390, theme: 'dark' }]]) {
    const { ctx, p } = await open(o);
    const widths = [];
    for (const t of [120, 300, 600, 1000]) { await p.waitForTimeout(t - (widths.length ? widths[widths.length - 1].t : 0)); widths.push({ t, over: await p.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth) }); }
    pass(widths.every(w => w.over <= 0), `${label}: no sideways scroll while it plays (${widths.map(w => `${w.t} ms: ${w.over}`).join(', ')})`);
    await p.waitForTimeout(2200);
    const s = await p.evaluate(summarise); const started = s.blocks.filter(b => b.start !== null);
    pass(started.length >= 10 && started.every(b => b.starts === 1), `${label}: ${started.length} blocks rise, each once`);
    pass(s.marks.every(m => m.block === null || m.start >= m.block - 40) && s.counts.every(c => c.block !== null && c.start >= c.block - 40), `${label}: data motion never before its block`);
    const left = await p.evaluate(() => ({ running: document.getAnimations().filter(a => /^t-/.test(a.animationName || '')).length, leftover: [...document.querySelectorAll('.t-enter')].filter(b => getComputedStyle(b).transform !== 'none' || getComputedStyle(b).opacity !== '1').length }));
    pass(left.running === 0 && left.leftover === 0, `${label}: it ends clean`);
    await p.screenshot({ path: `dashmotion-${label.replace(/ /g, '-')}.png`, fullPage: true });
    pass(p._errors.length === 0, `${label}: no page errors ${p._errors.join('|')}`);
    await ctx.close();
  }

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL OK'); process.exit(fails ? 1 : 0);
})();
