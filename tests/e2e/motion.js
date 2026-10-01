// F-VIZPREMIUM, motion part: a short, subtle layer so the dashboard feels
// alive. KPI numbers count up, menus and dialogs open with a fade, new cards
// on the task board pop in. Every piece is under 250 ms except the number
// settling (450 ms), never blocks a click, and is off under "reduce motion".
// Written with the project's own tw-animate-css classes: no third-party skill
// or snippet is copied in.
const fs = require('fs');
const path = require('path');
const ts = require(path.join(__dirname, '..', '..', 'node_modules', 'typescript'));
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const ROOT = path.join(__dirname, '..', '..');

console.log('== the arrivals hook (the real code, run through a tiny hook runtime)');
{
  const src = fs.readFileSync(path.join(ROOT, 'lib', 'use-arrivals.ts'), 'utf8');
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  let states, refs, prevDeps, dirty, idx, effects;
  const React = {
    useRef: init => { const i = idx++; if (!(i in refs)) refs[i] = { current: init }; return refs[i]; },
    useState: init => { const i = idx++; if (!(i in states)) states[i] = typeof init === 'function' ? init() : init; return [states[i], v => { states[i] = typeof v === 'function' ? v(states[i]) : v; dirty = true; }]; },
    useEffect: (cb, deps) => { effects.push({ i: idx++, cb, deps }); },
  };
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', js)(() => React, mod, mod.exports);
  const reset = () => { states = {}; refs = {}; prevDeps = {}; dirty = false; idx = 0; effects = []; };
  const render = ids => { let out; for (let n = 0; n < 6; n++) { idx = 0; effects = []; dirty = false; out = mod.exports.useArrivals(ids);
    for (const e of effects) { const p = prevDeps[e.i]; if (!p || e.deps.some((d, k) => d !== p[k])) { prevDeps[e.i] = e.deps; e.cb(); } }
    if (!dirty) break; } return [...out].sort(); };
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  reset();
  pass(eq(render(['a', 'b']), []), 'the first list is the baseline: nothing arrives');
  pass(eq(render(['a', 'b']), []), 'the same list again: nothing arrives');
  pass(eq(render(['a', 'b', 'c']), ['c']), 'a new id arrives');
  pass(eq(render(['a', 'b', 'c', 'd']), ['c', 'd']), 'another one: both are arrivals');
  pass(eq(render(['a', 'd']), ['c', 'd']), 'a card that leaves does not undo the arrival');
  pass(eq(render(['a', 'b', 'd']), ['c', 'd']), 'a card that comes back is not new again');
  pass(eq(render(['a', 'b', 'd', 'a'.repeat(1)]), ['c', 'd']), 'a repeated id is not a new one');

  reset();
  pass(eq(render([]), []) && eq(render([]), []), 'an empty list first: nothing');
  pass(eq(render(['a', 'b']), []), 'the first non-empty list after an empty one is still the baseline (no page-load pop-in)');
  pass(eq(render(['a', 'b', 'z']), ['z']), 'and a later card arrives');
  // same ids in a fresh array each render must not churn
  reset(); render(['a']); const before = render(['a', 'b']);
  pass(eq(before, ['b']) && eq(render(['a', 'b'].slice()), ['b']), 'a fresh array with the same ids changes nothing');
}

console.log('== the budget (source): every animation added is short');
{
  const files = ['dashboard-view', 'sheet-tabs', 'topbar', 'sidebar', 'sites-view', 'upload-panel-host', 'recommendations-board-view'];
  let found = 0, tooLong = [];
  for (const f of files) {
    const code = fs.readFileSync(path.join(ROOT, 'components', 'sentria', f + '.tsx'), 'utf8');
    for (const lit of code.match(/["'`][^"'`\n]*\banimate-in\b[^"'`\n]*["'`]/g) || []) {
      found++; const m = lit.match(/\bduration-(\d+)\b/);
      if (!m || Number(m[1]) > 250) tooLong.push(`${f}: ${lit.slice(0, 70)}`);
    }
  }
  pass(found >= 12, `the touched files carry ${found} animate-in classes`);
  pass(tooLong.length === 0, 'each has a duration of 250 ms or less ' + tooLong.join(' | '));
}

const NOW = new Date().toISOString();
const ALERTS = Array.from({ length: 14 }, (_, k) => ({ id: k, equipment: `Med ${k}`, sector: 'health', business_type: 'pharmacie', severity: k % 2 ? 'WARNING' : 'CRITICAL', date: NOW, alert_key: 'health.stock.low', message: `MSG ${k}` }));
(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async ({ reduced = false, theme = 'light', vw = 1440, sample = false } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: 900 }, locale: 'en-US', reducedMotion: reduced ? 'reduce' : 'no-preference' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    await p.route(/onrender\.com\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: /\/alerts/.test(r.request().url()) ? JSON.stringify(ALERTS) : '{"recommendations":[],"assignments":[],"contractors":[]}' }));
    await p.addInitScript(({ ls, sample }) => {
      if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); }
      if (sample) { window.__seq = []; setInterval(() => { const el = [...document.querySelectorAll('p.font-heading')].find(q => q.parentElement && /Medicines affected/.test(q.parentElement.innerText)); if (!el) return; const n = el.innerText.trim(); if (window.__seq[window.__seq.length - 1] !== n) window.__seq.push(n); }, 8); }
    }, { ls: { sentria_onboarded: 'true', sentria_language: 'en', sentria_company_name: 'Pharmacie A', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', sentria_departments: '{"health":["pharmacie","clinique-hopital"]}', sentria_theme: theme }, sample });
    await signedIn(p, 'u', 'a@b.c', { plan: 'business' });
    await p.goto(APP_URL); await p.waitForTimeout(sample ? 3000 : 2200);
    return { p, ctx };
  };
  const anim = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); const c = getComputedStyle(e); return { name: c.animationName, dur: parseFloat(c.animationDuration) }; }, sel);

  console.log('== KPI numbers count up');
  { const { p, ctx } = await open({ sample: true });
    const seq = (await p.evaluate(() => window.__seq)).map(Number).filter(n => !Number.isNaN(n));
    pass(seq.at(-1) === 14, `it ends on the exact value, 14 (sequence ${seq.join(',')})`);
    pass(seq.slice(1).every((n, i) => n >= seq[i]), 'it only goes up');
    pass(seq.some(n => n > 0 && n < 14), 'and passes through intermediate values (it really counts)');
    pass(seq.every(n => n >= 0 && n <= 14), 'and never leaves 0 to 14 (it once flashed -1 on the first frame)');
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }
  { const { p, ctx } = await open({ sample: true, reduced: true });
    const seq = (await p.evaluate(() => window.__seq)).map(Number).filter(n => !Number.isNaN(n));
    pass(seq.at(-1) === 14 && seq.every(n => n === 0 || n === 14), `reduce motion: it just shows the value, no counting (sequence ${seq.join(',')})`);
    await ctx.close(); }

  console.log('== menus and dialogs open with a short fade');
  for (const [label, reduced] of [['normal', false], ['reduce motion', true]]) {
    const { p, ctx } = await open({ reduced });
    await p.locator('button[aria-haspopup="menu"]', { hasText: /department/ }).click();
    const m = await anim(p, '[role="menu"]');
    pass(reduced ? m.dur <= 0.001 : (m.name !== 'none' && m.dur > 0.1 && m.dur <= 0.25), `${label}: the department menu animates ${m.dur}s (${m.name})`);
    await p.keyboard.press('Escape'); await p.mouse.click(700, 300); await p.waitForTimeout(150);

    await p.locator('aside').getByRole('button', { name: /^Sign out$/ }).click();
    const card = await anim(p, '[role="alertdialog"]');
    pass(reduced ? card.dur <= 0.001 : (card.name !== 'none' && card.dur > 0.1 && card.dur <= 0.25), `${label}: the sign-out confirm animates ${card.dur}s`);
    // nothing blocks the click: Cancel works with no waiting
    await p.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click({ timeout: 1000 });
    await p.waitForTimeout(100);
    pass(await p.getByRole('alertdialog').count() === 0, `${label}: Cancel works the instant the dialog is there`);
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
    const cards = await p.evaluate(() => [...document.querySelectorAll('article[draggable]')].map(a => a.className.includes('animate-in')));
    pass(cards.length >= 2, `the board shows its cards (${cards.length})`);
    pass(cards.every(x => x === false), 'none of them animates at page load');
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL OK'); process.exit(fails ? 1 : 0);
})();
