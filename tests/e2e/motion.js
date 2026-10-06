// F-VIZPREMIUM, motion part: a short, subtle layer so the dashboard feels
// alive, built from transitions.dev (app/transitions.css holds its snippets).
//   menus and popovers  -> menu dropdown      dialogs -> modal
//   KPI numbers         -> count up (ours)    the attention banner -> texts reveal
// Menus, dialogs and anything the user triggers stay within 250 ms; the page's
// own arrival (tests/e2e/dashmotion.js) is allowed a second. Nothing blocks a
// click, and "reduce motion" turns it all off.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ts = require(path.join(__dirname, '..', '..', 'node_modules', 'typescript'));
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const ROOT = path.join(__dirname, '..', '..');
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---- a tiny hook runtime, to run the real hook files without React or a browser
function makeRuntime() {
  let slots = [], idx = 0, pending = [], dirty = false;
  const React = {
    useRef: init => { const i = idx++; if (!slots[i]) slots[i] = { ref: { current: init } }; return slots[i].ref; },
    useState: init => { const i = idx++; if (!slots[i]) slots[i] = { value: typeof init === 'function' ? init() : init }; const slot = slots[i];
      return [slot.value, v => { const next = typeof v === 'function' ? v(slot.value) : v; if (!Object.is(next, slot.value)) { slot.value = next; dirty = true; } }]; },
    useEffect: (cb, deps) => { pending.push({ i: idx++, cb, deps }); },
  };
  const render = fn => { let out;
    for (let n = 0; n < 30; n++) { idx = 0; pending = []; dirty = false; out = fn();
      for (const e of pending) { const s = slots[e.i] || (slots[e.i] = {}); const changed = !s.deps || !e.deps || e.deps.some((d, k) => !Object.is(d, s.deps[k]));
        if (changed) { if (s.cleanup) s.cleanup(); s.deps = e.deps; const c = e.cb(); s.cleanup = typeof c === 'function' ? c : undefined; } }
      if (!dirty) break; }
    return out; };
  return { React, render };
}
const load = (file, React) => { const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} }; new Function('require', 'module', 'exports', js)(() => React, mod, mod.exports); return mod.exports; };

console.log('== new cards on the board: the arrivals hook');
{
  const { React, render } = makeRuntime(); const { useArrivals } = load('lib/use-arrivals.ts', React);
  const run = ids => [...render(() => useArrivals(ids))].sort();
  pass(eq(run(['a', 'b']), []), 'the first list is the baseline: nothing arrives');
  pass(eq(run(['a', 'b']), []), 'the same list again: nothing arrives');
  pass(eq(run(['a', 'b', 'c']), ['c']), 'a new id arrives');
  pass(eq(run(['a', 'b', 'c', 'd']), ['c', 'd']), 'another one: both are arrivals');
  pass(eq(run(['a', 'd']), ['c', 'd']), 'a card that leaves does not undo the arrival');
  pass(eq(run(['a', 'b', 'd']), ['c', 'd']), 'a card that comes back is not new again');
  const second = makeRuntime(); const again = load('lib/use-arrivals.ts', second.React);
  const run2 = ids => [...second.render(() => again.useArrivals(ids))].sort();
  pass(eq(run2([]), []) && eq(run2([]), []), 'an empty list first: nothing');
  pass(eq(run2(['a', 'b']), []), 'the first non-empty list after an empty one is the baseline (no page-load pop-in)');
  pass(eq(run2(['a', 'b', 'z']), ['z']), 'and a later card arrives');
  pass(eq(run2(['a', 'b', 'z'].slice()), ['z']), 'a fresh array with the same ids changes nothing');
}

console.log('== menus and dialogs: the presence hook (open, close, reopen, reduce motion)');
{
  const clock = { t: 0, timers: [], raf: [], n: 0 };
  let reduced = false, closeVar = '150ms';
  global.requestAnimationFrame = cb => { clock.raf.push(cb); return clock.raf.length; };
  global.cancelAnimationFrame = id => { clock.raf[id - 1] = null; };
  global.document = { documentElement: {} };
  global.getComputedStyle = () => ({ getPropertyValue: () => closeVar });
  global.window = { matchMedia: () => ({ matches: reduced }),
    setTimeout: (cb, ms) => { const id = ++clock.n; clock.timers.push({ id, at: clock.t + ms, cb }); return id; },
    clearTimeout: id => { clock.timers = clock.timers.filter(x => x.id !== id); } };
  const frame = () => { const q = clock.raf.splice(0); q.forEach(cb => cb && cb()); };
  const advance = ms => { clock.t += ms; for (const t of clock.timers.filter(x => x.at <= clock.t).sort((a, b) => a.at - b.at)) { clock.timers = clock.timers.filter(x => x !== t); t.cb(); } };
  const { React, render } = makeRuntime(); const { usePresence, useEnter } = load('lib/use-presence.ts', React);
  const show = open => { const r = render(() => usePresence(open, '--dropdown-close-dur')); return `${r.present}|${r.className}`; };

  pass(show(false) === 'false|', 'closed: not rendered');
  pass(show(true) === 'true|', 'opening: rendered in its resting (closed) look first');
  frame(); frame(); pass(show(true) === 'true|is-open', 'two frames later it is .is-open (so the transition has something to start from)');
  pass(show(false) === 'true|is-closing', 'closing: still rendered, with .is-closing');
  advance(149); pass(show(false) === 'true|is-closing', 'still there just before the close duration (149 ms)');
  advance(2); pass(show(false) === 'false|', 'gone once the close duration has passed (read from the CSS variable: 150 ms)');

  show(true); frame(); frame(); show(true); show(false); advance(80);
  pass(show(true) === 'true|is-closing', 'reopened mid-close: it stays rendered');
  frame(); frame(); pass(show(true) === 'true|is-open', 'and goes back to .is-open');
  advance(500); pass(show(true) === 'true|is-open', 'the old close timer was cancelled: it does not disappear');

  show(false); advance(500); pass(show(false) === 'false|', 'back to closed');
  show(true); pass(show(false) === 'true|', 'opened and closed within a frame: no .is-closing flash for something that never showed');
  advance(500); pass(show(false) === 'false|', 'and it unmounts');

  closeVar = '250ms'; show(true); frame(); frame(); show(true); show(false); advance(200);
  pass(show(false) === 'true|is-closing', 'the duration follows the CSS variable (250 ms here)');
  advance(60); pass(show(false) === 'false|', 'gone after 250 ms');

  // The production build minifies 150ms to .15s: both must read as 150 ms.
  closeVar = '.15s'; show(true); frame(); frame(); show(true); show(false); advance(100);
  pass(show(false) === 'true|is-closing', 'the minified spelling ".15s" is read as 150 ms, not 0.15 ms (the bug a real build showed)');
  advance(60); pass(show(false) === 'false|', 'and it is gone after 150 ms');
  closeVar = ''; show(true); frame(); frame(); show(true); show(false); advance(100);
  pass(show(false) === 'true|is-closing', 'an unreadable value falls back to 150 ms');
  advance(60); pass(show(false) === 'false|', 'then it is gone');

  reduced = true; show(true); frame(); frame(); show(true); show(false); advance(1);
  pass(show(false) === 'false|', 'reduce motion: it unmounts at once, no waiting for an animation that is off');
  reduced = false; closeVar = '150ms';

  const enterRuntime = makeRuntime(); const enter = load('lib/use-presence.ts', enterRuntime.React).useEnter;
  pass(enterRuntime.render(() => enter()) === '', 'useEnter: nothing on the first render');
  frame(); frame(); pass(enterRuntime.render(() => enter()) === 'is-open', 'useEnter: .is-open two frames later');
  const shownRuntime = makeRuntime(); const shownEnter = load('lib/use-presence.ts', shownRuntime.React).useEnter;
  shownRuntime.render(() => shownEnter('is-shown')); frame(); frame();
  pass(shownRuntime.render(() => shownEnter('is-shown')) === 'is-shown', 'useEnter("is-shown") for the text reveal');
  delete global.window; delete global.document; delete global.getComputedStyle; delete global.requestAnimationFrame; delete global.cancelAnimationFrame;
}

console.log('== the source: the skill\'s CSS in, its files out, the old hand-written version gone');
{
  const css = fs.readFileSync(path.join(ROOT, 'app', 'transitions.css'), 'utf8');
  for (const hook of ['.t-dropdown', '.t-modal', '.t-digit-group', '.t-digit', '.t-stagger-line']) pass(css.includes(hook), `transitions.css has ${hook}`);
  pass((css.match(/@media \(prefers-reduced-motion: reduce\)/g) || []).length >= 6, 'every snippet keeps its prefers-reduced-motion block');
  pass(/github\.com\/Jakubantalik\/transitions\.dev/.test(css), 'transitions.css says where the snippets come from');
  pass(fs.readFileSync(path.join(ROOT, 'app', 'layout.tsx'), 'utf8').includes("transitions.css"), 'the stylesheet is imported by the layout');
  const tracked = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' }).split('\n');
  pass(!tracked.some(f => /transitions-(dev|polish)|skills-lock\.json/.test(f)), 'the skill\'s own files are not in the repo (gotcha.md: not redistributable)');
  const touched = ['dashboard-view', 'sheet-tabs', 'topbar', 'sidebar', 'sites-view', 'upload-panel-host', 'recommendations-board-view'];
  const left = touched.filter(f => /\banimate-in\b/.test(fs.readFileSync(path.join(ROOT, 'components', 'sentria', f + '.tsx'), 'utf8')));
  pass(left.length === 0, 'no hand-written animate-in left in the files that now use the skill ' + left.join(','));
  pass(!fs.existsSync(path.join(ROOT, 'components', 'sentria', 'count-up.tsx')), 'the old hand-written count-up is gone');
  const board = fs.readFileSync(path.join(ROOT, 'components', 'sentria', 'recommendations-board-view.tsx'), 'utf8');
  pass(/arrivals\.has\(id\) && "t-rise-in"/.test(board), 'arriving board cards use t-rise-in');
  for (const [f, cls] of [['upload-panel-host', 't-modal'], ['recommendations-board-view', 't-dropdown'], ['recommendations-board-view', 't-modal']])
    pass(fs.readFileSync(path.join(ROOT, 'components', 'sentria', f + '.tsx'), 'utf8').includes(cls), `${f}.tsx uses ${cls} (entrance only: its parent mounts it)`);
}

const NOW = new Date().toISOString();
const ALERTS = Array.from({ length: 14 }, (_, k) => ({ id: k, equipment: `Med ${k}`, sector: 'health', business_type: 'pharmacie', severity: k % 2 ? 'WARNING' : 'CRITICAL', date: NOW, alert_key: 'health.stock.low', message: `MSG ${k}` }));
(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async ({ reduced = false, theme = 'light', vw = 1440, sample = false } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: 900 }, locale: 'en-US', reducedMotion: reduced ? 'reduce' : 'no-preference' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    // The page asks for its alerts again when the language changes (and once more at start-up, when it learns the stored
    // language), so a test changes what the next answer holds with p._rows(...) and then switches language.
    let rows = ALERTS; p._rows = r => { rows = r; };
    await p.route(/onrender\.com\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: /\/alerts/.test(r.request().url()) ? JSON.stringify(rows) : '{"recommendations":[],"assignments":[],"contractors":[]}' }));
    await p.addInitScript(({ ls, sample }) => {
      if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); }
      if (sample) { window.__nodes = new Set(); window.__counts = []; window.__texts = []; window.__live = false;
        setInterval(() => { const g = [...document.querySelectorAll('.t-count')].find(x => /Medicines affected|Médicaments concernés/i.test(x.parentElement.parentElement ? x.parentElement.parentElement.innerText : ''));
          if (g) { window.__nodes.add(g); const t = g.querySelector('.t-count-final').innerText.trim(); if (window.__texts[window.__texts.length - 1] !== t) window.__texts.push(t);
            const n = +getComputedStyle(g.querySelector('.t-count-live')).getPropertyValue('--t-n'); if (window.__counts[window.__counts.length - 1] !== n) window.__counts.push(n);
            if (getComputedStyle(g.querySelector('.t-count-live')).display !== 'none') window.__live = true; } }, 8); }
    }, { ls: { sentria_onboarded: 'true', sentria_language: 'en', sentria_company_name: 'Pharmacie A', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', sentria_departments: '{"health":["pharmacie","clinique-hopital"]}', sentria_theme: theme }, sample });
    await signedIn(p, 'u', 'a@b.c', { plan: 'business' });
    await p.goto(APP_URL); await p.waitForTimeout(sample ? 2500 : 2000);
    return { p, ctx };
  };
  const ms = v => parseFloat(v) * (/ms$/.test(v) ? 1 : 1000);

  console.log('== the skill\'s timings are within the card\'s 250 ms budget');
  { const { p, ctx } = await open();
    const vars = await p.evaluate(() => { const r = getComputedStyle(document.documentElement); return Object.fromEntries(['--dropdown-open-dur', '--dropdown-close-dur', '--modal-open-dur', '--modal-close-dur', '--digit-dur', '--stagger-dur', '--toast-open'].map(k => [k, r.getPropertyValue(k).trim()])); });
    for (const [k, v] of Object.entries(vars)) pass(v !== '' && ms(v) <= 250, `${k} is ${v}`);
    await ctx.close(); }

  console.log('== KPI numbers count up to their value, and follow it');
  { const { p, ctx } = await open({ sample: true });
    const r = await p.evaluate(() => ({ counts: window.__counts, nodes: window.__nodes.size, texts: window.__texts, live: window.__live }));
    pass(r.texts.length === 1 && r.texts[0] === '14', `the page text is the final value from the first sample to the last: "14" (saw ${JSON.stringify(r.texts)})`);
    pass(r.live && r.counts[0] === 0 && r.counts.at(-1) === 14, `the counter runs from 0 to 14 (saw ${r.counts.length} steps: ${r.counts.slice(0, 6)}…)`);
    pass(r.counts.length >= 6 && r.counts.every((n, i) => i === 0 || n >= r.counts[i - 1]), 'in steps, never going backwards');
    const d = await p.evaluate(() => { const g = [...document.querySelectorAll('.t-count')].find(x => /Medicines affected|Médicaments concernés/i.test(x.parentElement.parentElement.innerText)); const fin = g.querySelector('.t-count-final'); const live = g.querySelector('.t-count-live'); return { copied: g.innerText.trim(), finalColour: getComputedStyle(fin).color, dur: getComputedStyle(live).transitionDuration, prop: getComputedStyle(live).transitionProperty, hidden: live.getAttribute('aria-hidden') }; });
    pass(d.copied === '14', `copy-paste and tests read "14" (${JSON.stringify(d.copied)})`);
    pass(/--t-n/.test(d.prop) && ms(d.dur) <= 1000, `the counter is a transition on --t-n, ${d.dur} (the page's arrival may take up to a second)`);
    pass(d.hidden === 'true' && /rgba\(0, 0, 0, 0\)|transparent/.test(d.finalColour), 'the drawn number is hidden from assistive tech, the real one is only see-through');
    // switching language refetches the alerts: the same tile now holds another number
    p._rows(ALERTS.slice(0, 9));
    await p.evaluate(() => { window.__counts.length = 0; localStorage.setItem('sentria_language', 'fr'); window.dispatchEvent(new Event('sentria_locale_updated')); });
    await p.waitForTimeout(1200);
    const r2 = await p.evaluate(() => ({ nodes: window.__nodes.size, texts: window.__texts, counts: window.__counts }));
    pass(r2.texts.at(-1) === '9', `the value changes on the same tile: "9" now (${JSON.stringify(r2.texts)})`);
    pass(r2.nodes === 1, `the same element follows the new value: no new tile, no replay of the arrival (${r2.nodes} node)`);
    pass(r2.counts.length >= 3 && r2.counts[0] <= 14 && r2.counts.at(-1) === 9 && r2.counts.every((n, i) => i === 0 || n <= r2.counts[i - 1]), `it counts down from 14 to 9 (${r2.counts})`);
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }
  { const { p, ctx } = await open({ sample: true, reduced: true });
    const r = await p.evaluate(() => { const g = [...document.querySelectorAll('.t-count')].find(x => /Medicines affected|Médicaments concernés/i.test(x.parentElement.parentElement.innerText)); return { live: window.__live, texts: window.__texts, colour: getComputedStyle(g.querySelector('.t-count-final')).color }; });
    pass(r.texts.at(-1) === '14' && r.live === false && !/rgba\(0, 0, 0, 0\)|transparent/.test(r.colour), 'reduce motion: the number is just shown, nothing is drawn over it');
    await ctx.close(); }

  console.log('== the attention banner (texts reveal)');
  for (const [label, reduced] of [['normal', false], ['reduce motion', true]]) {
    const { p, ctx } = await open({ reduced });
    const b = await p.evaluate(() => { const h = [...document.querySelectorAll('h2')].find(x => /What needs your attention right now\?/.test(x.textContent)); const block = h.closest('.t-stagger'); const l1 = h, l2 = block.querySelector('.t-stagger-line--2');
      return { shown: block.classList.contains('is-shown'), op1: getComputedStyle(l1).opacity, op2: getComputedStyle(l2).opacity, td: getComputedStyle(l1).transitionDuration }; });
    pass(b.shown && b.op1 === '1' && b.op2 === '1', `${label}: the headline and the line end up fully shown`);
    pass(reduced ? ms(b.td.split(',')[0].trim()) < 1 : ms(b.td.split(',')[0].trim()) <= 250, `${label}: the reveal transition is ${b.td}`);
    await ctx.close();
  }

  console.log('== menus and dialogs (menu dropdown, modal)');
  for (const [label, reduced] of [['normal', false], ['reduce motion', true]]) {
    const { p, ctx } = await open({ reduced });
    const menuBtn = p.locator('button[aria-haspopup="menu"]', { hasText: /department/ });
    await menuBtn.click(); await p.waitForTimeout(400);
    const m = await p.evaluate(() => { const e = document.querySelector('[role="menu"]'); return { cls: e.className, origin: e.dataset.origin, op: getComputedStyle(e).opacity, dur: getComputedStyle(e).transitionDuration }; });
    pass(/\bt-dropdown\b/.test(m.cls) && /\bis-open\b/.test(m.cls) && m.op === '1', `${label}: the department menu is .t-dropdown.is-open and fully shown`);
    pass(m.origin === 'bottom-left', `${label}: it grows from its trigger (data-origin ${m.origin})`);
    pass(reduced ? ms(m.dur.split(',')[0].trim()) < 1 : ms(m.dur.split(',')[0].trim()) <= 250, `${label}: transition ${m.dur}`);
    await p.evaluate(() => { window.__closing = false; window.__gone = null; const t0 = performance.now(); const i = setInterval(() => { const e = document.querySelector('[role="menu"]'); if (e && /is-closing/.test(e.className)) window.__closing = true; if (!e) { window.__gone = Math.round(performance.now() - t0); clearInterval(i); } }, 5); });
    await p.keyboard.press('Escape'); await p.waitForTimeout(600);
    const c = await p.evaluate(() => ({ closing: window.__closing, gone: window.__gone }));
    pass(c.gone !== null && c.gone < (reduced ? 120 : 450), `${label}: it is gone ${c.gone} ms after Escape`);
    if (!reduced) pass(c.closing, 'it showed .is-closing on the way out');

    await p.locator('aside').getByRole('button', { name: /^Sign out$/ }).click(); await p.waitForTimeout(400);
    const d = await p.evaluate(() => { const card = document.querySelector('[role="alertdialog"]'); const back = card.parentElement; return { card: card.className, back: back.className, op: getComputedStyle(card).opacity, bop: getComputedStyle(back).opacity }; });
    pass(/\bt-modal\b/.test(d.card) && /\bis-open\b/.test(d.card) && d.op === '1', `${label}: the sign-out confirm is .t-modal.is-open, fully shown`);
    pass(/\bt-modal-backdrop\b/.test(d.back) && /\bis-open\b/.test(d.back) && d.bop === '1', `${label}: and its backdrop faded in with it`);
    await p.evaluate(() => { window.__gone2 = null; const t0 = performance.now(); const i = setInterval(() => { if (!document.querySelector('[role="alertdialog"]')) { window.__gone2 = Math.round(performance.now() - t0); clearInterval(i); } }, 5); });
    await p.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click({ timeout: 1000 });
    await p.waitForTimeout(600);
    const g = await p.evaluate(() => window.__gone2);
    pass(g !== null && g < (reduced ? 150 : 450), `${label}: Cancel works at once, and the dialog is gone ${g} ms later`);
    pass(await p.evaluate(() => document.activeElement && /Sign out/.test(document.activeElement.textContent || '')), `${label}: focus is back on Sign out`);
    pass(p._errors.length === 0, `${label}: no page errors ${p._errors.join('|')}`);
    await ctx.close();
  }

  console.log('== the task board does not animate on first load');
  { const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 }, locale: 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    const R = (eq, key) => ({ equipment: eq, sector: 'health', business_type: 'pharmacie', severity: 'CRITICAL', date: NOW, message: `MSG ${eq}`, alert_key: key, recommended_action: `ACT ${eq}`, action_category: 'stock', confidence: 0.8, risk_score: null });
    await p.route(/\/alerts(\?|$)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await p.route(/\/recommendations/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ recommendations: [R('Doliprane', 'health.stock.low'), R('Amoxicilline', 'health.expiry.soon'), R('Insuline', 'health.cold.high')] }) }));
    await p.route(/\/(contractors|assignments)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"contractors":[],"assignments":[]}' }));
    await p.addInitScript(() => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); const s = { sentria_onboarded: '1', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', sentria_language: 'en', sentria_company_name: 'Acme' }; for (const k in s) localStorage.setItem(k, s[k]); } });
    await signedIn(p, 'u', 'a@b.c', { plan: 'business' }); await p.goto(APP_URL, { waitUntil: 'networkidle' });
    await p.getByRole('button', { name: /^Tracking$/ }).first().click(); await p.waitForTimeout(1200);
    const cards = await p.evaluate(() => [...document.querySelectorAll('article[draggable]')].map(a => a.className.includes('t-rise-in')));
    pass(cards.length >= 2, `the board shows its cards (${cards.length})`);
    pass(cards.every(x => x === false), 'none of them animates at page load');
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL OK'); process.exit(fails ? 1 : 0);
})();
