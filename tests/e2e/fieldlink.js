// F-CONTRACTOR: the field link. The boss makes a signed link for one person on one task (a button under "Assigned
// to"); the page it opens is public, shows one task and three answers, sends no account, and says plainly when a
// link is expired, replaced or not yet switched on. French, dark, 390 px.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const now = new Date().toISOString();
const R = (eq, key) => ({ equipment: eq, sector: 'health', business_type: 'pharmacie', severity: 'CRITICAL', date: now, message: `MSG ${eq}`, alert_key: key, recommended_action: `ACT ${eq}`, action_category: 'stock', confidence: 0.8 });
const recs = [R('Doliprane', 'health.stock.low'), R('Amoxicilline', 'health.stock.low'), R('Insuline', 'health.stock.low')];
const PEOPLE = [
  { id: 'c1', name: 'Awa Diop', availability: 'available', open_assignments: 0, active: true, role: null, phone: '+2290197123456', sms_ready: true, note: null },
  { id: 'c2', name: 'Bad Number', availability: 'available', open_assignments: 0, active: true, role: null, phone: '12', sms_ready: false, note: null },
  { id: 'c3', name: 'No Number', availability: 'available', open_assignments: 0, active: true, role: null, phone: null, sms_ready: null, note: null },
  { id: 'c4', name: 'Not On Task', availability: 'available', open_assignments: 0, active: true, role: null, phone: '+2290197123457', sms_ready: true, note: null },
];

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async ({ lang = 'en', vw = 1440 } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vw < 500 ? 844 : 1400 }, locale: lang === 'fr' ? 'fr-FR' : 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    // What the server holds. The test changes it to play the part of a reply.
    p._server = [
      { task_key: 'Doliprane-health.stock.low', status: 'todo', priority: 'high', deadline: null, contractor_ids: ['c1', 'c2', 'c3'] },
      { task_key: 'Amoxicilline-health.stock.low', status: 'in_progress', priority: 'medium', deadline: null, contractor_ids: ['c1'] },
      { task_key: 'Insuline-health.stock.low', status: 'todo', priority: 'low', deadline: null, contractor_ids: ['c1'] },
    ];
    p._texts = []; p._answer = { sms: { status: 'placeholder', live: false } }; p._links = []; p._linkAnswer = null;
    await p.route(/\/assignments\/field-link/, r => { const b = JSON.parse(r.request().postData()); p._links.push({ b, auth: r.request().headers()['authorization'] }); if (p._linkAnswer) return r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify(p._linkAnswer) }); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 'v1.TESTTOKEN.SIG', expires_at: Math.floor(Date.now() / 1000) + 3 * 86400 }) }); });
    await p.route(/\/alerts(\?|$)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await p.route(/\/recommendations/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ recommendations: recs }) }));
    await p.route(/\/contractors/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ contractors: PEOPLE }) }));
    await p.route(/\/assignments\/sms/, r => { p._texts.push(JSON.parse(r.request().postData())); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(p._answer) }); });
    await p.route(/\/assignments(\?|$)/, r => {
      if (r.request().method() === 'PUT') { const body = JSON.parse(r.request().postData()); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ assignment: body }) }); }
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ assignments: p._server }) });
    });
    await p.addInitScript(l => { const s = { sentria_onboarded: '1', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', sentria_language: l, sentria_company_name: 'Acme' }; for (const k in s) localStorage.setItem(k, s[k]); }, lang);
    await signedIn(p); await p.goto(APP_URL, { waitUntil: 'networkidle' });
    if (vw < 1024) { await p.getByRole('button', { name: /menu/i }).first().click(); await p.waitForTimeout(300); }
    await p.getByRole('button', { name: lang === 'fr' ? /^Suivi$/ : /^Tracking$/ }).first().click(); await p.waitForTimeout(1200);
    return { p, ctx };
  };
  const detail = async (p, eq) => { await p.getByRole('button', { name: `Priority detail for ${eq}` }).click(); await p.waitForTimeout(400); };
  const textButtons = p => p.locator('[data-task-text-send]');


  console.log('== the boss makes a link');
  { const { p, ctx } = await open();
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
    await detail(p, 'Doliprane');
    pass(await p.getByTestId('field-link-make').count() === 3, 'every person on the task has a Copy field link button, with or without a phone number');
    await p.getByTestId('field-link-make').first().click(); await p.waitForTimeout(700);
    pass(p._links.length === 1 && JSON.stringify(Object.keys(p._links[0].b).sort()) === JSON.stringify(['contractor_id', 'lang', 'task_key']) && p._links[0].b.contractor_id === 'c1' && /^Bearer /.test(p._links[0].auth || ''), 'it sends only the task, the person and the language, signed in: ' + JSON.stringify(p._links[0] && p._links[0].b));
    const ready = await p.getByTestId('field-link-ready').innerText();
    pass(/Link copied/.test(ready) && /valid 3 d/.test(ready), 'it says the link is copied and for how long: ' + ready.replace(/\s+/g, ' '));
    pass(await p.evaluate(() => navigator.clipboard.readText()) === APP_URL.replace(/\/$/, '') + '/t/v1.TESTTOKEN.SIG', 'the copied address is the public page with the token');
    pass((await p.getByTestId('field-link-open').getAttribute('href')).endsWith('/t/v1.TESTTOKEN.SIG') && await p.getByTestId('field-link-open').getAttribute('target') === '_blank' && /noopener/.test(await p.getByTestId('field-link-open').getAttribute('rel')), 'Open the page opens it in a new tab without the opener');
    await p.screenshot({ path: 'fieldlink-board.png' });
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }
  { const { p, ctx } = await open();
    p._linkAnswer = { success: false, error_code: 'field_link_unconfigured' };
    await detail(p, 'Doliprane');
    await p.getByTestId('field-link-make').first().click(); await p.waitForTimeout(600);
    pass(/not switched on for the server yet/.test(await p.getByTestId('field-link-error').innerText()), 'a server with no key says field links are not switched on');
    await ctx.close(); }

  console.log('== the page a field person opens');
  const visit = async ({ view, act, fail = null, lang = 'en', theme = 'light', vw = 390, token = 'v1.TOK.SIG', locale = null } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: 844 }, locale: locale || (lang === 'fr' ? 'fr-FR' : 'en-US'), colorScheme: theme });
    const p = await ctx.newPage(); p._errors = []; p._calls = []; p._headers = [];
    p.on('pageerror', e => p._errors.push(e.message));
    await p.route(/onrender\.com\//, r => {
      const req = r.request(), u = new URL(req.url());
      p._headers.push(req.headers());
      if (fail === 'network') return r.abort();
      if (fail) return json(r, { success: false, error_code: 'x' }, fail);
      if (req.method() === 'GET' && u.pathname.startsWith('/field/')) return json(r, view);
      if (req.method() === 'POST' && /\/act$/.test(u.pathname)) { const b = JSON.parse(req.postData()); p._calls.push(b); return act ? json(r, act(b.action)) : json(r, { status: 'done', changed: true }); }
      return json(r, {});
    });
    await p.goto(APP_URL.replace(/\/$/, '') + '/t/' + token, { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
    return { p, ctx };
  };
  const VIEW = { title: 'Generator G2', problem: 'Fuel at 12%', action: 'Refill before noon', severity: 'CRITICAL', priority: 'high', deadline: '2026-10-20', status: 'todo', name: 'Kofi', lang: 'en', expires: Math.floor(Date.now() / 1000) + 86400 };

  { const { p, ctx } = await visit({ view: VIEW, act: a => ({ status: a === 'ack' ? 'in_progress' : a === 'done' ? 'done' : 'todo', changed: true }) });
    pass(/Generator G2/.test(await p.getByTestId('field-title').innerText()) && /Fuel at 12%/.test(await p.getByTestId('field-problem').innerText()) && /Refill before noon/.test(await p.getByTestId('field-action').innerText()), 'it shows the task, what is wrong and what to do');
    pass(/High priority/.test(await p.getByTestId('field-task').innerText()) && /Due 20 Oct/.test(await p.getByTestId('field-task').innerText()), 'with the priority and the due date');
    pass(await p.locator('aside, nav').count() === 0, 'no menu, no account, nothing else to tap');
    pass(p._headers.every(h => !h['authorization'] && !h['x-view-as']), 'the calls carry no sign-in and no account header');
    pass((await p.locator('meta[name=robots]').getAttribute('content')).includes('noindex') && (await p.locator('meta[name=referrer]').getAttribute('content')) === 'no-referrer', 'search engines skip it and the address is never sent on as a referrer');
    await p.screenshot({ path: 'fieldlink-page-light.png' });
    await p.getByTestId('field-ack').click(); await p.waitForTimeout(500);
    pass(/Thank you Kofi, noted: in progress/.test(await p.getByTestId('field-ack-note').innerText()) && await p.getByTestId('field-ack').count() === 0 && await p.getByTestId('field-started').count() === 1, 'Got it: noted as in progress, and the button is gone');
    await p.screenshot({ path: 'fieldlink-page-started.png' });
    await p.getByTestId('field-done').click(); await p.waitForTimeout(500);
    pass(JSON.stringify(p._calls) === '[{"action":"ack"},{"action":"done"}]' && /Done, thank you Kofi/.test(await p.getByTestId('field-finished').innerText()), 'Done: only the answer is sent, and the page says thank you');
    await p.screenshot({ path: 'fieldlink-page-done.png' });
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }
  { const { p, ctx } = await visit({ view: VIEW });
    await p.getByTestId('field-cannot').click(); await p.waitForTimeout(300);
    pass(p._calls.length === 0 && await p.getByTestId('field-confirm').count() === 1, "I can't asks first and sends nothing yet");
    await p.screenshot({ path: 'fieldlink-page-confirm.png' });
    await p.getByTestId('field-cannot-no').click(); await p.waitForTimeout(200);
    pass(await p.getByTestId('field-confirm').count() === 0, 'No, go back returns to the task');
    await p.getByTestId('field-cannot').click(); await p.getByTestId('field-cannot-yes').click(); await p.waitForTimeout(500);
    pass(JSON.stringify(p._calls) === '[{"action":"cannot"}]' && /You are off this task/.test(await p.getByTestId('field-finished').innerText()) && await p.getByTestId('field-finished').getAttribute('data-how') === 'cannot', "Yes: the answer is sent and the page says they are off the task");
    await ctx.close(); }
  { const { p, ctx } = await visit({ view: { ...VIEW, status: 'done' } });
    pass(await p.getByTestId('field-finished').getAttribute('data-how') === 'closed' && /already finished/.test(await p.getByTestId('field-finished').innerText()), 'a task that is already finished says so and offers no button');
    await ctx.close(); }
  for (const [fail, kind, text] of [[410, 'expired', /expired/i], [404, 'invalid', /not valid any more/i], [429, 'limited', /Too many tries/], [503, 'unavailable', /Not available yet/], ['network', 'network', /No connection/]]) {
    const { p, ctx } = await visit({ view: VIEW, fail });
    pass(await p.getByTestId('field-failed').getAttribute('data-failure') === kind && text.test(await p.getByTestId('field-failed').innerText()) && await p.getByTestId('field-done').count() === 0, `${fail}: says "${kind}" and shows no task and no button`);
    if (fail === 410) await p.screenshot({ path: 'fieldlink-page-expired.png' });
    await ctx.close();
  }
  { const { p, ctx } = await visit({ view: { ...VIEW, lang: 'fr', name: 'Kofi' }, lang: 'fr', theme: 'dark', act: () => ({ status: 'in_progress', changed: true }) });
    const t = await p.getByTestId('field-page').innerText();
    pass(/votre tâche/i.test(t) && /ce qui ne va pas/i.test(t) && /reçu, j'y vais/i.test(t) && /je ne peux pas/i.test(t) && /priorité haute/i.test(t), 'French, in the language the boss was in: ' + t.replace(/\s+/g, ' ').slice(0, 90));
    pass(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll at 390 px');
    await p.screenshot({ path: 'fieldlink-page-390-dark-fr.png' });
    await ctx.close(); }
  { const { p, ctx } = await visit({ view: { ...VIEW, lang: 'en' }, lang: 'fr', locale: 'fr-FR' });
    pass(/your task/i.test(await p.getByTestId('field-page').innerText()), 'the link\'s language wins over the phone\'s');
    await ctx.close(); }

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exit(fails ? 1 : 0);
})();
