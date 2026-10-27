// F-CDELETE layout: the removal dialog is a side panel (who is leaving, what
// happens next, the buttons) beside the task list, and the result is a timeline
// of who took what, with no boxes around the rows. Screenshots in light, dark
// and 390 px go to the shots folder. The data and the API are faked here; the
// behaviour of the dialog is in cdelete.js.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };

const A = 'CRANE-02-logistics.cycles.critical', B = 'QUAI-1-logistics.wait.warning', C = 'SOLO-7-only.awa';
const person = (id, name, role, availability, open, extra = {}) => ({ id, name, role, phone: null, email: null, availability, note: null, active: true, open_assignments: open, sms_ready: null, ...extra });
const PEOPLE = () => [
  person('c1', 'Awa Diop', 'Crane mechanic', 'available', 3),
  person('c2', 'Kofi Mensah', 'Electrician', 'busy', 1),
  person('c3', 'Yao Koffi', 'Crane mechanic', 'available', 1, { phone: '+2290197123457', sms_ready: true }),
  person('c6', 'Mia Lopez', 'Crane mechanic', 'available', 0, { phone: '+2290197123458', sms_ready: false }),
];
const cand = (id, name, availability, role_match, open, conflicts, score) => ({ id, name, role: role_match ? 'Crane mechanic' : 'Electrician', availability, role_match, open, conflicts, score });
const PLAN = {
  contractor: { id: 'c1', name: 'Awa Diop', role: 'Crane mechanic' }, open_count: 3,
  tasks: [
    { task_key: A, status: 'in_progress', priority: 'critical', deadline: '2026-10-10', equipment: 'CRANE-02', message: 'Crane cycles critical', co_holders: [], suggested: 'c6', candidates: [cand('c6', 'Mia Lopez', 'available', true, 0, 0, 70), cand('c3', 'Yao Koffi', 'available', true, 1, 1, 35)] },
    { task_key: B, status: 'todo', priority: 'high', deadline: '2026-10-11', equipment: 'QUAI-1', message: 'Queue rising at the berth', co_holders: [], suggested: 'c3', candidates: [cand('c3', 'Yao Koffi', 'available', true, 1, 1, 35)] },
    { task_key: C, status: 'todo', priority: 'low', deadline: null, equipment: 'SOLO-7', message: '', co_holders: [], suggested: null, candidates: [] },
  ],
};

async function open(browser, { theme = 'light', width = 1440 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 1000 }, locale: 'en-US', colorScheme: 'light' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const state = { people: PEOPLE() };
  await p.route(/onrender\.com\//, r => {
    const u = new URL(r.request().url()); const m = r.request().method();
    const json = body => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    const hand = u.pathname.match(/^\/contractors\/([^/]+)\/handover$/);
    if (hand && m === 'GET') return json({ handover: PLAN });
    if (hand && m === 'POST') {
      state.people = state.people.filter(x => x.id !== hand[1]);
      return json({ result: { contractor: { id: 'c1', name: 'Awa Diop', active: false }, handed_over: 2, unassigned: [C], drafts: [
        { contractor_id: 'c6', name: 'Mia Lopez', phone: '+2290197123458', sms_ready: false, task_keys: [B], body: 'SentrIA: Mia Lopez, you now handle QUAI-1.' },
        { contractor_id: 'c3', name: 'Yao Koffi', phone: '+2290197123457', sms_ready: true, task_keys: [A], body: 'SentrIA: Yao Koffi, you now handle CRANE-02.' } ] } });
    }
    if (u.pathname === '/contractors') return json({ contractors: state.people });
    if (u.pathname === '/alerts') return json([]);
    return json({ recommendations: [], assignments: [] });
  });
  await p.addInitScript(th => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); Object.entries(th).forEach(([k, v]) => localStorage.setItem(k, v)); } },
    { sentria_language: 'en', sentria_onboarded: 'true', sentria_sector: 'logistics', sentria_sectors: '["logistics"]', sentria_company_name: 'Acme', sentria_theme: theme, sentria_country: 'BJ' });
  await signedIn(p, 'u', 'a@b.c', { plan: 'entreprise' });
  await p.goto(APP_URL); await p.waitForTimeout(1600);
  if (width < 768) { await p.getByRole('button', { name: /open.*(menu|navigation)/i }).first().click().catch(() => {}); await p.waitForTimeout(300); }
  await p.locator('aside nav button').filter({ hasText: /^Field team$/ }).locator('visible=true').first().click(); await p.waitForTimeout(900);
  await p.getByRole('button', { name: 'Remove Awa Diop', exact: true }).click(); await p.waitForTimeout(500);
  return { ctx, p, errs };
}

(async () => {
  const b = await chromium.launch(LAUNCH);
  const dlg = p => p.locator('[data-handover]');

  console.log('== the pick screen: a side panel beside the list');
  {
    const { ctx, p, errs } = await open(b);
    await p.locator('[data-handover-suggest]').click(); await p.waitForTimeout(200);
    const aside = await p.locator('[data-handover] aside').boundingBox();
    const list = await p.locator('[data-handover-task]').first().boundingBox();
    pass(aside && list && aside.x + aside.width <= list.x + 1, 'on a laptop the panel sits to the left of the list, not above it');
    pass(await dlg(p).evaluate(e => e.classList.contains('squircle') && e.className.includes('rounded-[30px]')), 'the dialog keeps the squircle corner with a large radius');
    const bg = await p.locator('[data-handover] aside').evaluate(e => getComputedStyle(e).backgroundColor);
    // Chromium reports this colour as lab(L a b) or rgb(); L under 25 is near black.
    const nums = (bg.match(/[-\d.]+/g) || []).map(Number);
    const dark = bg.startsWith('lab(') ? nums[0] < 25 : nums[0] < 60 && nums[1] < 60 && nums[2] < 60;
    pass(dark, `the panel uses the sidebar's shell colour in light (${bg})`);
    const boxes = await p.locator('[data-handover-task]').evaluateAll(els => els.map(e => { const cs = getComputedStyle(e); return [cs.borderTopWidth, cs.borderLeftWidth, cs.backgroundColor, cs.borderRadius]; }));
    pass(boxes.length === 3 && boxes.every(([t, l, bgc]) => t === '0px' && l === '0px' && (bgc === 'rgba(0, 0, 0, 0)' || bgc === 'transparent')), 'the task rows are lines, not boxes');
    pass(await p.locator('[data-handover-count]').innerText().then(t => /3 of 3 chosen/.test(t)), 'the count sits under the list');
    await p.screenshot({ path: 'handover-pick-light.png' });
    pass(await dlg(p).evaluate(e => e.scrollWidth <= e.clientWidth + 1), 'nothing overflows sideways');
    pass(errs.length === 0, `no page errors ${errs.join('|')}`);
    await ctx.close();
  }

  console.log('== the pick screen on a phone: the panel above the list');
  {
    const { ctx, p, errs } = await open(b, { width: 390 });
    await p.locator('[data-handover-suggest]').click(); await p.waitForTimeout(200);
    const aside = await p.locator('[data-handover] aside').boundingBox();
    const list = await p.locator('[data-handover-task]').first().boundingBox();
    pass(aside && list && aside.y + aside.height <= list.y + 1, 'on a phone the panel is above the list');
    pass(await p.locator('[data-handover] aside h3').isVisible(), 'the name shows at the top of the panel on a phone');
    const box = await dlg(p).boundingBox();
    pass(box && box.x >= 0 && box.x + box.width <= 390.5, `the dialog fits 390 px (${box && Math.round(box.x)}..${box && Math.round(box.x + box.width)})`);
    pass(await dlg(p).evaluate(e => e.scrollWidth <= e.clientWidth + 1), 'nothing overflows sideways at 390 px');
    await p.screenshot({ path: 'handover-pick-390.png' });
    pass(errs.length === 0, `390: no page errors ${errs.join('|')}`);
    await ctx.close();
  }

  console.log('== dark: the panel takes the dark sidebar shell');
  {
    const { ctx, p, errs } = await open(b, { theme: 'dark' });
    await p.locator('[data-handover-suggest]').click(); await p.waitForTimeout(200);
    const bg = await p.locator('[data-handover] aside').evaluate(e => getComputedStyle(e).backgroundColor);
    const [r, g] = (bg.match(/[\d.]+/g) || []).map(Number);
    pass(g > r + 10, `dark: the panel is the deep green shell (${bg})`);
    await p.screenshot({ path: 'handover-pick-dark.png' });
    pass(errs.length === 0, `dark: no page errors ${errs.join('|')}`);
    await ctx.close();
  }

  console.log('== the result: a timeline, no boxes');
  {
    const { ctx, p, errs } = await open(b);
    await p.locator('[data-handover-suggest]').click(); await p.waitForTimeout(150);
    await p.locator('[data-handover-confirm]').click(); await p.waitForTimeout(900);
    const done = p.locator('[data-handover-done]');
    pass(await done.count() === 1 && await p.locator('[data-handover] aside').count() === 0, 'the result replaces the panel');
    const w = await dlg(p).boundingBox();
    pass(w && w.width <= 601, `the result is narrower (${w && Math.round(w.width)} px)`);
    const steps = await done.locator('ol > li').count();
    pass(steps === 4, `one step for the person who left, one per new owner, one for the task left (${steps})`);
    const colours = await done.locator('ol > li').evaluateAll(els => els.map(e => e.getAttribute('style') || ''));
    pass(colours.slice(1, 3).every(s => /branch-/.test(s)), 'each new owner has a colour from the branch palette');
    pass(await done.locator('[data-handover-left]').count() === 1, 'the task left with nobody has its own step');
    pass(await done.locator('ol > li').first().locator('p').first().evaluate(e => getComputedStyle(e).textDecorationLine.includes('line-through')), 'the person who left is struck through');
    await p.screenshot({ path: 'handover-done-light.png' });
    pass(errs.length === 0, `result: no page errors ${errs.join('|')}`);
    await ctx.close();
  }
  {
    const { ctx, p, errs } = await open(b, { width: 390 });
    await p.locator('[data-handover-suggest]').click(); await p.waitForTimeout(150);
    await p.locator('[data-handover-confirm]').click(); await p.waitForTimeout(900);
    pass(await dlg(p).evaluate(e => e.scrollWidth <= e.clientWidth + 1), 'result at 390 px: nothing overflows sideways');
    await p.screenshot({ path: 'handover-done-390.png' });
    pass(errs.length === 0, `result 390: no page errors ${errs.join('|')}`);
    await ctx.close();
  }

  await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
  process.exit(fails ? 1 : 0);
})();
