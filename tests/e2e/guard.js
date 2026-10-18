// F-GUARD: the Admin page shows whether automatic sending is on, the Guard's log, and the kill switch.
// GET /admin/guard lists the state; PATCH {enabled} flips it; the page says when the switch is forced off by the
// server, when the log lives only in memory (migration 018 not run), and when the API does not answer.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const at = m => new Date(Date.now() - m * 60000).toISOString();
const LOG = [
  { id: 5, created_at: at(1), company_id: 'aaaaaaaa-0000-0000-0000-00000000000a', action: 'sms_alert', allowed: true, reason: '', detail: { severity: 'CRITICAL' } },
  { id: 4, created_at: at(5), company_id: 'aaaaaaaa-0000-0000-0000-00000000000a', action: 'sms_task', allowed: false, reason: 'kill_switch', detail: { task_key: 'quai:CRANE-02' } },
  { id: 3, created_at: at(6), company_id: null, action: 'switch', allowed: false, reason: 'off', detail: {} },
  { id: 2, created_at: at(9), company_id: 'bbbbbbbb-0000-0000-0000-00000000000b', action: 'email_report', allowed: true, reason: '', detail: {} },
  { id: 1, created_at: at(12), company_id: 'bbbbbbbb-0000-0000-0000-00000000000b', action: 'reply_advance', allowed: false, reason: 'kill_switch', detail: { reply: 'ack' } },
];

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async ({ enabled = true, forced = false, persisted = true, log = LOG, getFails = false, lang = 'en', theme = 'light', vw = 1440 } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: 900 }, locale: lang === 'fr' ? 'fr-FR' : 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p._patches = []; p.on('pageerror', e => p._errors.push(e.message));
    let state = { enabled, forced_off: forced, persisted, log };
    await p.route(/onrender\.com\//, r => {
      const u = new URL(r.request().url()); const req = r.request();
      if (u.pathname === '/admin/accounts') return json(r, { accounts: [] });
      if (u.pathname === '/admin/thresholds') return json(r, { thresholds: [], persisted: true });
      if (u.pathname === '/admin/guard') {
        if (getFails) return json(r, { detail: { error_code: 'x', message: 'Database unreachable' } }, 503);
        if (req.method() === 'PATCH') {
          const body = JSON.parse(req.postData()); p._patches.push({ body, auth: req.headers()['authorization'] });
          state = { ...state, enabled: body.enabled, log: [{ id: 99, created_at: at(0), company_id: null, action: 'switch', allowed: body.enabled, reason: body.enabled ? 'on' : 'off', detail: {} }, ...state.log] };
          return json(r, { ...state, saved: persisted });
        }
        return json(r, state);
      }
      return json(r, u.pathname === '/alerts' ? [] : { recommendations: [], assignments: [], contractors: [] });
    });
    await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } },
      { sentria_onboarded: 'true', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', sentria_language: lang, sentria_theme: theme });
    await signedIn(p, 'u-me', 'boss@sentria.app', { plan: 'decouverte', isAdmin: true });
    await p.goto(APP_URL); await p.waitForTimeout(1800);
    if (vw < 768) { await p.getByRole('button', { name: /open.*(menu|navigation)/i }).first().click(); await p.waitForTimeout(400); }
    await p.locator('aside nav button', { hasText: /^Admin$/ }).locator('visible=true').first().click(); await p.waitForTimeout(1200);
    return { p, ctx };
  };
  const panel = p => p.getByTestId('admin-guard');

  console.log('== the state and the log');
  { const { p, ctx } = await open();
    await panel(p).scrollIntoViewIfNeeded();
    pass(/Guard/.test(await panel(p).innerText()), 'a Guard card is on the Admin page');
    pass((await p.getByTestId('guard-state').innerText()) === 'On', 'it says automatic sending is On');
    pass(await p.getByTestId('guard-log').locator('tbody tr').count() === 5, 'five log lines');
    pass(/Alert text/.test(await panel(p).innerText()) && /Text to a contractor/.test(await panel(p).innerText()) && /Report email/.test(await panel(p).innerText()) && /Reply that moves a task/.test(await panel(p).innerText()), 'each action has its plain name');
    pass(await p.locator('[data-testid="guard-log"] tr[data-allowed="false"][data-action="sms_task"]').innerText().then(t => /Stopped/.test(t)), 'a stopped action says Stopped');
    pass(await p.locator('[data-testid="guard-log"] tr[data-action="switch"]').innerText().then(t => /Paused/.test(t)), 'a flip of the switch is its own line');
    pass(/2 stopped/i.test(await panel(p).innerText()), 'the header counts the stopped ones (2)');
    pass(!/CRANE-02|ack|CRITICAL/.test(await panel(p).innerText()), 'no task name, reply or message text on screen: only the action and the company id');
    pass(/aaaaaaaa/.test(await panel(p).innerText()) && !/aaaaaaaa-0000/.test(await panel(p).innerText()), 'a company shows as its first 8 characters');
    await p.screenshot({ path: 'guard-light.png' });
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== the kill switch');
  { const { p, ctx } = await open();
    await p.getByTestId('guard-switch').scrollIntoViewIfNeeded();
    pass(/Pause everything/.test(await p.getByTestId('guard-switch').innerText()), 'the button offers to pause');
    await p.getByTestId('guard-switch').click(); await p.waitForTimeout(700);
    pass(p._patches.length === 1 && p._patches[0].body.enabled === false && /^Bearer /.test(p._patches[0].auth || ''), 'it sends {enabled:false}, signed in');
    pass((await p.getByTestId('guard-state').innerText()) === 'Paused' && /Turn back on/.test(await p.getByTestId('guard-switch').innerText()), 'the page now says Paused and offers to turn back on');
    pass(await p.locator('[data-testid="guard-log"] tr[data-action="switch"]').first().innerText().then(t => /Paused/.test(t)), 'the flip is at the top of the log');
    await p.screenshot({ path: 'guard-paused-light.png' });
    await p.getByTestId('guard-switch').click(); await p.waitForTimeout(700);
    pass(p._patches[1].body.enabled === true && (await p.getByTestId('guard-state').innerText()) === 'On', 'turning back on sends {enabled:true}');
    await ctx.close(); }

  console.log('== forced off, memory only, empty, API down');
  { const { p, ctx } = await open({ enabled: false, forced: true });
    pass(await p.getByTestId('guard-switch').isDisabled() && /AGENT_WRITES=off/.test(await panel(p).innerText()), 'forced off by the server: the button is off and the page says why');
    await ctx.close(); }
  { const { p, ctx } = await open({ persisted: false });
    pass(await p.getByTestId('guard-memory').count() === 1 && /migration 018/.test(await p.getByTestId('guard-memory').innerText()), 'log in memory only: the page says so and names migration 018');
    await ctx.close(); }
  { const { p, ctx } = await open({ log: [] });
    pass(await p.getByTestId('guard-empty').count() === 1 && await p.getByTestId('guard-log').count() === 0, 'an empty log says "Nothing yet"');
    await ctx.close(); }
  { const { p, ctx } = await open({ getFails: true });
    pass(/Database unreachable/.test(await panel(p).innerText()) && await p.getByTestId('guard-switch').count() === 0, 'when the API does not answer: the error, and no switch to press blind');
    await ctx.close(); }

  console.log('== French, dark, phone');
  { const { p, ctx } = await open({ lang: 'fr', theme: 'dark' });
    await panel(p).scrollIntoViewIfNeeded();
    pass(/Garde/.test(await panel(p).innerText()) && /Tout mettre en pause/.test(await panel(p).innerText()) && /Texte d'alerte/.test(await panel(p).innerText()), 'French labels');
    await p.screenshot({ path: 'guard-dark-fr.png' }); await ctx.close(); }
  { const { p, ctx } = await open({ vw: 390 });
    await panel(p).scrollIntoViewIfNeeded();
    pass(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'no sideways scroll at 390 px (the table scrolls inside its card)');
    await p.screenshot({ path: 'guard-390.png' }); await ctx.close(); }

  await browser.close();
  console.log(fails ? `\n${fails} failed` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
