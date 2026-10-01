// F-VIZPREMIUM, onboarding step change: each step of the wizard enters from the
// side it is on, with a short slide / fade / blur (transitions.dev's page
// side-by-side, enter half; app/transitions.css). The card asks for about
// 150-200 ms and nothing that blocks input. This checks the build: the
// direction (right going forward, left going back), the timing, that the
// step is usable at once, that nothing is left on the element once it has
// landed (a leftover transform or filter would trap fixed children), that
// "reduce motion" turns it off, and that the layout is the one it was.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { mockSupabase } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const ROOT = path.join(__dirname, '..', '..');

console.log('== source');
{
  const css = fs.readFileSync(path.join(ROOT, 'app', 'transitions.css'), 'utf8');
  for (const line of ['--page-slide-distance: 8px;', '--page-blur: 3px;', '--page-fade-ease: cubic-bezier(0.22, 1, 0.36, 1);', '--page-slide-ease: cubic-bezier(0.22, 1, 0.36, 1);', '--page-exit-enabled: 1;'])
    pass(css.includes(line), `the skill's page side-by-side variable is there as shipped: ${line}`);
  pass(/--page-slide-dur: 200ms;\s*\n\s*--page-fade-dur: 200ms;/.test(css), 'tuned to 200 ms through the skill\'s own variables');
  pass(/\.t-step\.is-shown\s*\{\s*opacity: 1;\s*transform: none;\s*filter: none;/.test(css), 'it lands on "none", not translateX(0) / blur(0), which would trap fixed children');
  pass(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.t-step \{ transition: none !important; opacity: 1; transform: none; filter: none; \}/.test(css), 'reduced motion: the step just shows');
  const modal = fs.readFileSync(path.join(ROOT, 'components/sentria/onboarding-modal.tsx'), 'utf8');
  pass(/<StepSlide key=\{step\} direction=\{direction\}/.test(modal), 'every step mounts fresh inside a StepSlide keyed by the step');
  pass(!/animate-in fade-in slide-in-from-bottom-2/.test(modal.split('THE QUESTION')[1].split('ACTION BAR')[0]), 'the old per-header animation is gone (no double motion)');
  const tracked = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' });
  pass(!/transitions-(dev|polish)|skills-lock\.json/.test(tracked), 'the third-party skill files are still not tracked');
}

// ---- the browser
const USER = { 'new@co.bj': { uid: 'u-new', password: 'newpass12' } };
async function openWizard(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: opts.width || 1440, height: 900 }, locale: 'en-US', colorScheme: opts.scheme || 'light', reducedMotion: opts.reduce ? 'reduce' : 'no-preference' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route(/onrender\.com\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: r.request().url().includes('/alerts') ? '[]' : '{"recommendations":[],"assignments":[],"contractors":[]}' }));
  await p.addInitScript(t => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); localStorage.setItem('sentria_theme', t); localStorage.setItem('sentria_language', 'en'); } }, opts.theme || 'light');
  await mockSupabase(p, { users: USER, accounts: {} });
  await p.goto(APP_URL); await p.waitForTimeout(1200);
  await p.fill('#auth-email', 'new@co.bj'); await p.fill('#auth-password', 'newpass12');
  await p.getByRole('button', { name: /^Sign in$/ }).click(); await p.waitForTimeout(2200);
  return { ctx, p, errs };
}
// click, then sample the step element every frame for `ms`
async function clickAndSample(p, click, ms = 450) {
  await p.evaluate(() => { window.__old = document.querySelector('[data-step-slide]'); window.__samples = []; });
  await click();
  return p.evaluate(async (ms) => {
    const t0 = performance.now(); const out = [];
    while (performance.now() - t0 < ms) {
      const el = document.querySelector('[data-step-slide]'); const cs = el && getComputedStyle(el);
      const m = cs && cs.transform !== 'none' ? new DOMMatrix(cs.transform) : null;
      out.push({ t: performance.now() - t0, fresh: !!el && el !== window.__old, dir: el && el.dataset.direction, op: cs ? +cs.opacity : null, x: m ? m.e : 0, filter: cs && cs.filter, cls: el && el.className });
      await new Promise(requestAnimationFrame);
    }
    return out;
  }, ms);
}
const next = p => () => p.getByRole('button', { name: /^Continue/ }).last().click();
const back = p => () => p.getByRole('button', { name: /^Back$/ }).click();

(async () => {
  const b = await chromium.launch(LAUNCH);

  console.log('== going forward: it comes in from the right');
  {
    const { ctx, p, errs } = await openWizard(b);
    pass(await p.locator('[data-step-slide]').count() === 1, 'the wizard has one step on screen, in a StepSlide');
    await p.getByText('Nigeria', { exact: true }).first().click(); await p.waitForTimeout(500);
    const s = await clickAndSample(p, next(p));
    const first = s.find(x => x.fresh);
    pass(!!first && first.dir === 'forward', `the new step is a fresh element marked forward (${first && first.dir})`);
    pass(first && first.op < 0.6 && first.x > 4 && /blur/.test(first.filter), `it starts faded, 8 px to the right and blurred (opacity ${first && first.op.toFixed(2)}, x ${first && first.x.toFixed(1)}, ${first && first.filter})`);
    const landed = s.find(x => x.fresh && x.op >= 0.999 && x.x === 0 && x.filter === 'none');
    pass(!!landed && landed.t <= 200 + 90, `it has landed within 200 ms plus two frames (${landed && Math.round(landed.t)} ms)`);
    pass(landed && /is-shown/.test(landed.cls) && landed.x === 0 && landed.filter === 'none', 'once there, no transform and no filter is left on it');
    const mid = s.filter(x => x.fresh && x.op > 0.15 && x.op < 0.95);
    pass(mid.length >= 3, `it animates (not a jump): ${mid.length} frames in between`);
    pass(Math.max(...s.filter(x => x.fresh).map(x => x.x)) <= 8.01 && Math.min(...s.filter(x => x.fresh).map(x => x.x)) >= -0.01, 'it never travels more than the 8 px, and never the wrong way');
    pass(/Step 2 of 6/.test(await p.evaluate(() => document.body.innerText)), 'and it really is step 2');
    pass(await p.evaluate(() => document.activeElement && document.activeElement.tagName === 'H2'), 'the step\'s heading still takes focus, as before');

    console.log('== usable at once');
    await p.waitForTimeout(400);
    await p.locator('input').first().fill('Pharma Lagos');
    await p.getByRole('button', { name: /^Continue/ }).last().click();
    // no wait: a person does not wait for 200 ms. force skips Playwright's own "wait until it stops moving".
    await p.getByText(/^Health$/).first().click({ force: true, timeout: 1500 });
    await p.waitForTimeout(300);
    pass(await p.locator('[role=dialog] [aria-pressed="true"], [role=dialog] [aria-checked="true"]').count() >= 1 || await p.getByRole('button', { name: /^Continue/ }).last().isEnabled(), 'the next step takes a click while it is still arriving: nothing waits for the animation');

    console.log('== going back: it comes in from the left');
    await p.waitForTimeout(400);
    const sb = await clickAndSample(p, back(p));
    const fb = sb.find(x => x.fresh);
    pass(!!fb && fb.dir === 'back' && fb.x < -4 && fb.op < 0.6, `Back: marked back, starting 8 px to the left (x ${fb && fb.x.toFixed(1)})`);
    pass(!!sb.find(x => x.fresh && x.op >= 0.999 && x.x === 0 && x.filter === 'none'), '…and lands the same way');
    await p.waitForTimeout(300);
    await p.getByRole('button', { name: /^Continue/ }).last().click(); await p.waitForTimeout(500);
    const sj = await clickAndSample(p, () => p.locator('ol button, ol [role=button]').first().click(), 400);
    const fj = sj.find(x => x.fresh);
    pass(!!fj && fj.dir === 'back', 'jumping back by clicking an earlier step in the progress bar is a "back" move too');
    pass(errs.length === 0, 'no page errors: ' + errs.join('|'));
    await ctx.close();
  }

  console.log('== reduce motion: it just shows');
  {
    const { ctx, p, errs } = await openWizard(b, { reduce: true });
    await p.getByText('Nigeria', { exact: true }).first().click(); await p.waitForTimeout(300);
    const s = await clickAndSample(p, next(p), 200);
    const first = s.find(x => x.fresh);
    pass(!!first && first.op === 1 && first.x === 0 && first.filter === 'none', `from its first frame: opacity 1, no offset, no blur (${first && first.op}, ${first && first.x}, ${first && first.filter})`);
    pass(await p.locator('[data-step-slide]').evaluate(el => parseFloat(getComputedStyle(el).transitionDuration) < 0.001), 'and no transition');
    pass(errs.length === 0, 'no page errors');
    await ctx.close();
  }

  console.log('== the layout is the one it was, in light, dark and on a phone');
  {
    for (const [name, theme, scheme, width] of [['light', 'light', 'light', 1440], ['dark', 'dark', 'light', 1440], ['light, 390 px', 'light', 'light', 390], ['dark, 390 px', 'dark', 'light', 390]]) {
      const { ctx, p, errs } = await openWizard(b, { theme, scheme, width });
      await p.getByText('Nigeria', { exact: true }).first().click(); await p.waitForTimeout(300);
      await p.getByRole('button', { name: /^Continue/ }).last().click(); await p.waitForTimeout(700);
      const m = await p.evaluate(() => { const el = document.querySelector('[data-step-slide]'); const r = el.getBoundingClientRect(); const h2 = el.querySelector('h2').getBoundingClientRect(); const foot = document.querySelector('footer').getBoundingClientRect(); return { page: document.documentElement.scrollWidth, win: innerWidth, inside: r.left >= -0.5 && r.right <= innerWidth + 0.5, h2Visible: h2.width > 0 && h2.top >= 0, stepBeforeFooter: r.top < foot.top, gap: getComputedStyle(el).rowGap, display: getComputedStyle(el).display }; });
      pass(m.page <= m.win + 1 && m.inside && m.h2Visible && m.stepBeforeFooter, `${name}: no sideways scroll, the step sits inside the screen above the footer`);
      pass(m.display === 'flex' && m.gap === '28px', `${name}: the same flex column with the same 28 px gap between its blocks`);
      await p.screenshot({ path: `stepslide-${name.replace(/[ ,]+/g, '-')}.png` });
      pass(errs.length === 0, `${name}: no page errors`);
      await ctx.close();
    }
  }

  await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL OK');
  process.exit(fails ? 1 : 0);
})();
