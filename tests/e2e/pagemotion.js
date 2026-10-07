// The other pages rise the way the dashboard does (see dashmotion.js): the
// Ask SentrIA layout's three columns first, left to right, then what sits
// below them, each block a beat after the one before (`.t-enter` in
// app/transitions.css, its place from `enterAt()` in lib/motion.ts).
//
// What this guards, for every page: its blocks are marked, in order, with the
// delay their place says (read from the CSS, not from event times, which a
// slow frame moves); each rises once; nothing keeps a transform, a fade or a
// filter afterwards (that would trap a dropdown or a fixed layer); "reduce
// motion" turns it all off; there is no sideways scroll while it plays at
// 390 px; light and dark both render. Screenshots go to tests/e2e/shots.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };

// nav label, file name, the least number of blocks that must rise on screen
const PAGES = [
  ['Tracking', 'tracking', 4], ['Calendar', 'calendar', 5], ['Sites', 'sites', 3], ['Field team', 'team', 4],
  ['Ask SentrIA', 'ask', 3], ['Report', 'report', 3], ['Subscription', 'subscription', 4], ['Profile', 'profile', 3],
  ['Settings', 'settings', 3], ['Admin', 'admin', 2],
];
// Enough data for Tracking and Report to draw their real layout, not the empty one.
const now = new Date().toISOString();
const ALERTS = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, equipment: `Item ${i + 1}`, sector: 'health', business_type: 'pharmacie', severity: i % 3 ? 'WARNING' : 'CRITICAL', date: now, alert_key: 'health.stock.low', message: `Item ${i + 1}: stock low`, params: [['stock', 5], ['min_stock', 20]] }));
const RECS = ALERTS.slice(0, 4).map(a => ({ equipment: a.equipment, sector: 'health', business_type: 'pharmacie', severity: a.severity, date: now, message: a.message, alert_key: `${a.alert_key}.${a.id}`, recommended_action: `Reorder ${a.equipment}`, action_category: 'stock', confidence: 0.8, risk_score: null }));
const LS = { sentria_language: 'en', sentria_onboarded: 'true', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', sentria_company_name: 'Acme' };

function sampler() {
  window.__starts = new WeakMap(); window.__n = 0;
  document.addEventListener('animationstart', e => {
    if (e.animationName !== 't-enter') return;
    window.__starts.set(e.target, (window.__starts.get(e.target) || 0) + 1); window.__n++;
  }, true);
}
// What each block says about itself once it has played.
function readBlocks() {
  const ms = v => parseFloat(v) * (/ms$/.test(v) ? 1 : 1000);
  return [...document.querySelectorAll('main .t-enter')].filter(b => b.getClientRects().length > 0).map(b => {
    const c = getComputedStyle(b);
    return { at: +b.style.getPropertyValue('--i'), delay: Math.round(ms(c.animationDelay)), dur: ms(c.animationDuration), name: c.animationName, fill: c.animationFillMode, starts: window.__starts.get(b) || 0 };
  });
}
function leftovers() {
  return {
    running: document.getAnimations().filter(a => a.animationName === 't-enter').length,
    held: [...document.querySelectorAll('.t-enter')].filter(b => b.getClientRects().length > 0).filter(b => { const c = getComputedStyle(b); return c.transform !== 'none' || c.opacity !== '1' || c.filter !== 'none'; }).length,
  };
}

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async ({ theme = 'light', width = 1440, reduced = false } = {}) => {
    const ctx = await browser.newContext({ viewport: { width, height: 1000 }, locale: 'en-US', reducedMotion: reduced ? 'reduce' : 'no-preference' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    await p.route(/onrender\.com\//, r => { const path = new URL(r.request().url()).pathname;
      const body = path === '/alerts' ? ALERTS : path === '/recommendations' ? { recommendations: RECS } : { recommendations: [], assignments: [], contractors: [], accounts: [], events: [] };
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) }); });
    await p.addInitScript(l => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(l)) localStorage.setItem(k, v); } }, { ...LS, sentria_theme: theme });
    await p.addInitScript({ content: `(${sampler.toString()})()` });
    await signedIn(p, 'u', 'ama@acme.test', { plan: 'entreprise', isAdmin: true });
    await p.goto(APP_URL); await p.waitForTimeout(2200);
    return { ctx, p };
  };
  const go = async (p, label, phone) => {
    if (phone) { await p.getByRole('button', { name: /open.*(menu|navigation)/i }).first().click(); await p.waitForTimeout(400); }
    await p.locator('aside nav button').filter({ hasText: new RegExp('^' + label + '$') }).locator('visible=true').first().click();
  };

  console.log('== every page rises: marked, in order, once, and clean afterwards');
  { const { ctx, p } = await open();
    for (const [label, file, min] of PAGES) {
      await p.evaluate(() => { window.__starts = new WeakMap(); window.__n = 0; });
      await go(p, label); await p.waitForTimeout(1800);
      const b = await p.evaluate(readBlocks);
      pass(b.length >= min, `${label}: ${b.length} blocks on screen carry the rise (at least ${min})`);
      pass(b.every((x, i) => i === 0 || x.at >= b[i - 1].at), `${label}: their places never go back (${b.map(x => +x.at.toFixed(1)).join(', ')})`);
      pass(b.every(x => Math.abs(x.delay - x.at * 60) <= 1), `${label}: each waits its place x 60 ms (${b.map(x => x.delay).join(', ')})`);
      pass(b.every(x => x.name === 't-enter' && x.fill === 'backwards' && x.dur <= 420), `${label}: each takes at most 420 ms and holds nothing afterwards`);
      pass(b.every(x => x.starts === 1), `${label}: each rises once (${b.map(x => x.starts).join(',')})`);
      pass(Math.max(...b.map(x => x.at)) <= 9 && Math.max(...b.map(x => x.delay)) <= 540, `${label}: the last block waits at most 540 ms`);
      const left = await p.evaluate(leftovers);
      pass(left.running === 0 && left.held === 0, `${label}: it ends clean (${left.running} running, ${left.held} holding a transform or a fade)`);
      await p.screenshot({ path: `pagemotion-${file}-light.png`, fullPage: false });
    }
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== coming back to a page plays it again');
  { const { ctx, p } = await open();
    await go(p, 'Calendar'); await p.waitForTimeout(1500);
    await go(p, 'Tracking'); await p.waitForTimeout(1200);
    await p.evaluate(() => { window.__n = 0; });
    await go(p, 'Calendar'); await p.waitForTimeout(1500);
    const n = await p.evaluate(() => window.__n);
    pass(n >= 5, `back on Calendar the blocks rise again (${n} starts)`);
    await ctx.close(); }

  console.log('== a control that changes numbers does not replay the page');
  { const { ctx, p } = await open();
    await go(p, 'Calendar'); await p.waitForTimeout(1800);
    await p.evaluate(() => { window.__n = 0; });
    await p.getByRole('button', { name: /^(Next|Previous) week$/ }).first().click(); await p.waitForTimeout(900);
    const n = await p.evaluate(() => window.__n);
    pass(n === 0, `another week: the three columns and the grid stay where they are (${n} starts)`);
    await ctx.close(); }

  console.log('== reduce motion: nothing plays, everything is there at once');
  { const { ctx, p } = await open({ reduced: true });
    for (const [label, , min] of PAGES) {
      await go(p, label); await p.waitForTimeout(500);
      const r = await p.evaluate(() => ({ n: window.__n, blocks: [...document.querySelectorAll('main .t-enter')].filter(b => b.getClientRects().length > 0).map(b => { const c = getComputedStyle(b); return c.animationName === 'none' && c.opacity === '1' && c.transform === 'none'; }) }));
      pass(r.n === 0 && r.blocks.length >= min && r.blocks.every(Boolean), `${label}: no animation starts, ${r.blocks.length} blocks fully shown at once`);
    }
    await ctx.close(); }

  console.log('== dark');
  { const { ctx, p } = await open({ theme: 'dark' });
    for (const [label, file] of PAGES) { await go(p, label); await p.waitForTimeout(1800); await p.screenshot({ path: `pagemotion-${file}-dark.png` }); }
    const left = await p.evaluate(leftovers);
    pass(left.running === 0 && left.held === 0, 'dark: the last page ends clean');
    pass(p._errors.length === 0, 'dark: no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== 390 px');
  for (const theme of ['light', 'dark']) {
    const { ctx, p } = await open({ theme, width: 390 });
    for (const [label, file, min] of PAGES) {
      await p.evaluate(() => { window.__n = 0; });
      await go(p, label, true);
      const over = [];
      for (const t of [150, 450, 900]) { await p.waitForTimeout(t - (over.length ? over[over.length - 1].t : 0)); over.push({ t, w: await p.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth) }); }
      await p.waitForTimeout(1200);
      const n = await p.evaluate(() => window.__n); const left = await p.evaluate(leftovers);
      pass(over.every(o => o.w <= 0) && left.running === 0 && left.held === 0 && n >= 1, `${theme} ${label}: no sideways scroll while it plays, ${n} blocks rose, ends clean`);
      await p.screenshot({ path: `pagemotion-${file}-390-${theme}.png` });
    }
    pass(p._errors.length === 0, `390 ${theme}: no page errors ${p._errors.join('|')}`);
    await ctx.close();
  }

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL OK'); process.exit(fails ? 1 : 0);
})();
