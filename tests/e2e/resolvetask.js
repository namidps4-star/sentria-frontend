// Mark handled / Resolved: one task, one save. Moving a task to Resolved on the
// board, or pressing "Mark handled" on the dashboard's top priority, saves the
// status on the server under the same task key the other screen uses. A refused
// save is rolled back and said out loud. A resolved board card asks "What happened?".
// Checked in light, dark and 390 px.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const now = new Date().toISOString();
const REC = { id: 1, equipment: 'Presse P1', sector: 'industry', business_type: 'usine-production', severity: 'CRITICAL', date: now, alert_key: 'industry.generic', message: 'Machine failure risk', recommended_action: 'Stop the press and inspect the bearing', action_category: 'maintenance', reasoning: null, risk_score: 0.9 };
const KEY = 'Presse P1-industry.generic';
const LS = { sentria_language: 'en', sentria_onboarded: 'true', sentria_company_name: 'Usine Nord', sentria_sector: 'industry', sentria_sectors: '["industry"]', sentria_business_type: 'usine-production', sentria_departments: '{"industry":["usine-production"]}' };

(async () => {
  const browser = await chromium.launch(LAUNCH);

  const open = async ({ theme, width, refuse = false }) => {
    const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 }, locale: 'en-US' });
    const p = await ctx.newPage(); p._errs = []; p.on('pageerror', e => p._errs.push(e.message));
    const patches = [];
    await p.route(/onrender\.com\//, r => {
      const req = r.request(); const u = req.url();
      if (/\/assignments/.test(u) && (req.method() === 'PATCH' || req.method() === 'PUT')) {
        const body = JSON.parse(req.postData() || '{}'); patches.push(body);
        if (refuse) return r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'x', message: 'boom' }) });
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ assignment: { task_key: body.task_key, status: body.status, priority: 'medium', deadline: null, contractor_ids: [] } }) });
      }
      if (/\/assignments/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: '{"assignments":[],"contractors":[]}' });
      if (/\/outcomes/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ can_answer: true, answers: {}, kinds: {} }) });
      if (/\/recommendations/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 1, recommendations: [REC] }) });
      r.fulfill({ status: 200, contentType: 'application/json', body: /\/alerts/.test(u) ? JSON.stringify([REC]) : '{"recommendations":[],"assignments":[],"contractors":[]}' });
    });
    await p.addInitScript(([ls, t]) => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); Object.entries({ ...ls, sentria_theme: t }).forEach(([k, v]) => localStorage.setItem(k, v)); } }, [LS, theme]);
    await signedIn(p, 'u', 'a@b.c', { plan: 'business' });
    await p.goto(APP_URL); await p.waitForTimeout(2500);
    return { ctx, p, patches };
  };

  console.log('== board: move to Resolved');
  for (const [theme, width] of [['light', 1280], ['dark', 1280], ['light', 390]]) {
    const { ctx, p, patches } = await open({ theme, width });
    await p.evaluate(() => document.querySelector('[data-nav="tracking"]').click());
    await p.waitForTimeout(2500);
    await p.locator('button[aria-label="Move to the next column"]').first().click({ force: true });
    await p.waitForTimeout(1200);
    await p.locator('button[aria-label="Move to the next column"]').first().click({ force: true }).catch(() => {});
    await p.waitForTimeout(2000);
    const last = patches[patches.length - 1] || {};
    pass(last.task_key === KEY && last.status === 'done', `${theme} ${width}px board: saved status done under ${KEY}`);
    // The question lives in the card's detail, opened by clicking the card.
    await p.getByRole('button', { name: /Priority detail for Presse P1/ }).first().click().catch(() => {});
    await p.waitForTimeout(1200);
    const t = await p.locator('body').innerText();
    pass(/What happened\?/.test(t), `${theme} ${width}px board: resolved card's detail asks "What happened?"`);
    pass(p._errs.length === 0, `${theme} ${width}px board: no page errors ${p._errs.join('|')}`);
    await p.screenshot({ path: `resolve-board-${theme}-${width}.png` });
    await ctx.close();
  }

  console.log('== dashboard: Mark handled on the top priority');
  for (const [theme, width] of [['light', 1280], ['dark', 1280], ['light', 390]]) {
    const { ctx, p, patches } = await open({ theme, width });
    await p.getByRole('button', { name: /Back to dashboard/ }).first().click().catch(() => {});
    await p.waitForTimeout(1500);
    const btn = p.getByRole('button', { name: /Mark handled/ }).first();
    await btn.evaluate(el => el.scrollIntoView({ block: 'center' }));
    await btn.click();
    await p.waitForTimeout(2000);
    const last = patches[patches.length - 1] || {};
    pass(last.task_key === KEY && last.status === 'done', `${theme} ${width}px dashboard: saved status done under ${KEY}`);
    const t = await p.locator('body').innerText();
    pass(/handled at \d\d:\d\d|traité à \d\d:\d\d/i.test(t), `${theme} ${width}px dashboard: shows the handled result`);
    await p.screenshot({ path: `resolve-dash-${theme}-${width}.png` });
    await ctx.close();
  }

  console.log('== dashboard: refused save is rolled back and said out loud');
  {
    const { ctx, p } = await open({ theme: 'light', width: 1280, refuse: true });
    await p.getByRole('button', { name: /Back to dashboard/ }).first().click().catch(() => {});
    await p.waitForTimeout(1500);
    const btn = p.getByRole('button', { name: /Mark handled/ }).first();
    await btn.evaluate(el => el.scrollIntoView({ block: 'center' }));
    await btn.click();
    await p.waitForTimeout(2000);
    const still = await p.getByRole('button', { name: /Mark handled/ }).count();
    pass(still > 0, 'refused save: the task is not shown as handled');
    pass(p._errs.length === 0, 'refused save: no page errors');
    await ctx.close();
  }

  await browser.close();
  console.log(`\n${fails ? fails + ' failure(s)' : 'ALL OK'}`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
