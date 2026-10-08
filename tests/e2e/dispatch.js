// F-DISPATCH: sending someone to a task from its detail.
// The panel offers free people, best first (available before busy, people who
// can be texted, fewest open tasks); it leaves out people who are unavailable
// or already on the task; one press saves the person on the task, moves it to
// In progress, and only then asks the API to text them; it says plainly when
// the text was only logged, when the person has no number, and when the save
// failed (nothing is texted then).
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };

const now = new Date().toISOString();
const R = (eq, key) => ({ equipment: eq, sector: 'health', business_type: 'pharmacie', severity: 'CRITICAL', date: now, message: `MSG ${eq}`, alert_key: key, recommended_action: `ACT ${eq}`, action_category: 'stock', confidence: 0.8 });
const recs = [R('Doliprane', 'health.stock.low'), R('Amoxicilline', 'health.stock.low'), R('Insuline', 'health.stock.low')];
const P = (id, name, availability, open, ready) => ({ id, name, availability, open_assignments: open, active: true, role: null, phone: ready ? '+2290197123456' : null, sms_ready: ready ? true : null, note: null });
const PEOPLE = [
  P('c1', 'Awa Diop', 'available', 2, true),
  P('c2', 'Kofi Mensah', 'available', 0, true),
  P('c3', 'Busy Bob', 'busy', 0, true),
  P('c4', 'Off Olga', 'off', 0, true),
  P('c5', 'No Number', 'available', 0, false),
  P('c6', 'Already On', 'available', 0, true),
  P('c7', 'Extra Eve', 'available', 5, true),
];

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async ({ lang = 'en', vw = 1440, theme = 'light', people = PEOPLE, put = 'ok' } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vw < 500 ? 844 : 1400 }, locale: lang === 'fr' ? 'fr-FR' : 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    p._server = [
      { task_key: 'Doliprane-health.stock.low', status: 'todo', priority: 'high', deadline: null, contractor_ids: ['c6'] },
      { task_key: 'Amoxicilline-health.stock.low', status: 'in_progress', priority: 'medium', deadline: null, contractor_ids: [] },
      { task_key: 'Insuline-health.stock.low', status: 'done', priority: 'low', deadline: null, contractor_ids: [] },
    ];
    p._calls = []; p._puts = []; p._texts = []; p._answer = { sms: { status: 'placeholder', live: false } }; p._put = put;
    await p.route(/\/alerts(\?|$)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await p.route(/\/recommendations/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ recommendations: recs }) }));
    await p.route(/\/contractors/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ contractors: people }) }));
    await p.route(/\/assignments\/sms/, r => { p._calls.push('sms'); p._texts.push(JSON.parse(r.request().postData())); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(p._answer) }); });
    await p.route(/\/assignments(\?|$)/, r => {
      if (r.request().method() === 'PUT') {
        p._calls.push('put'); const body = JSON.parse(r.request().postData()); p._puts.push(body);
        if (p._put === 'fail') return r.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
        const row = p._server.find(x => x.task_key === body.task_key); if (row) Object.assign(row, { status: body.status, contractor_ids: body.contractor_ids });
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ assignment: body }) });
      }
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ assignments: p._server }) });
    });
    await p.addInitScript(([l, t]) => { const s = { sentria_onboarded: '1', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', sentria_language: l, sentria_company_name: 'Acme', sentria_theme: t }; for (const k in s) localStorage.setItem(k, s[k]); }, [lang, theme]);
    await signedIn(p); await p.goto(APP_URL, { waitUntil: 'networkidle' });
    if (vw < 1024) { await p.getByRole('button', { name: /menu/i }).first().click(); await p.waitForTimeout(300); }
    await p.getByRole('button', { name: lang === 'fr' ? /^Suivi$/ : /^Tracking$/ }).first().click(); await p.waitForTimeout(1200);
    return { p, ctx };
  };
  const detail = async (p, eq) => { await p.getByRole('button', { name: `Priority detail for ${eq}` }).click(); await p.waitForTimeout(400); };
  const names = p => p.locator('[data-dispatch-person]').evaluateAll(els => els.map(e => e.querySelector('.truncate').innerText));

  console.log('== who is offered, and in what order (English)');
  { const { p, ctx } = await open();
    await detail(p, 'Doliprane');
    pass(await p.locator('[data-dispatch]').count() === 1, 'the Send someone panel is in the task detail');
    pass((await names(p)).join('|') === 'Kofi Mensah|Awa Diop|Extra Eve', `top three: available and textable first, fewest open first (${(await names(p)).join('|')})`);
    pass(await p.locator('[data-dispatch-suggested]').count() === 1 && /Kofi/.test(await p.locator('[data-dispatch-person="c2"]').innerText()) && /Suggested/.test(await p.locator('[data-dispatch-person="c2"]').innerText()), 'only the first one is tagged Suggested');
    await p.screenshot({ path: 'dispatch-light.png' });
    await p.locator('[data-dispatch-more]').click(); await p.waitForTimeout(200);
    const all = (await names(p)).join('|');
    pass(all === 'Kofi Mensah|Awa Diop|Extra Eve|No Number|Busy Bob', `Show all: textable, then no number, then busy (${all})`);
    pass(!all.includes('Off Olga') && !all.includes('Already On'), 'a person who is unavailable, and one already on the task, are never offered');
    pass(/cannot be texted/.test(await p.locator('[data-dispatch-person="c5"]').innerText()), 'a person with no usable number says so');
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== sending: save first, text second');
  { const { p, ctx } = await open();
    await detail(p, 'Doliprane');
    await p.locator('[data-dispatch-person="c2"] [data-dispatch-send]').click(); await p.waitForTimeout(800);
    pass(p._calls.join(',') === 'put,sms', `the task is saved before the text is asked for (${p._calls.join(',')})`);
    const put = p._puts[0];
    pass(put.status === 'in_progress' && put.contractor_ids.includes('c2') && put.contractor_ids.includes('c6'), `the person joins the others and the task moves to In progress (${JSON.stringify([put.status, put.contractor_ids])})`);
    pass(JSON.stringify(Object.keys(p._texts[0]).sort()) === JSON.stringify(['contractor_id', 'lang', 'task_key']) && p._texts[0].contractor_id === 'c2' && p._texts[0].lang === 'en', 'the text request is the task, the person and the language only');
    pass(/Kofi Mensah/.test(await p.locator('[data-dispatch-outcome]').innerText()) && /not sent/i.test(await p.locator('[data-dispatch-outcome]').innerText()), 'with SMS off it says "Logged, not sent" next to their name');
    pass(!/Text sent/.test(await p.locator('[data-dispatch-outcome]').innerText()), 'and never claims they were texted');
    pass(await p.locator('[data-dispatch-person="c2"]').count() === 0, 'they leave the list now that they are on the task');
    pass(await p.getByRole('button', { name: 'In progress', pressed: true }).count() === 1, 'the task shows In progress');
    pass(await p.locator('[data-task-text-send]').count() === 3 || await p.locator('[data-task-text-send]').count() >= 2, 'they now have their own Text button under Assigned to');
    p._answer = { sms: { status: 'sent', live: true } };
    await p.locator('[data-dispatch-person="c1"] [data-dispatch-send]').click(); await p.waitForTimeout(800);
    pass(/Text sent/.test(await p.locator('[data-dispatch-outcome]').innerText()) && /Awa Diop/.test(await p.locator('[data-dispatch-outcome]').innerText()), 'live: it says the text went, and to whom');
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== a person with no number');
  { const { p, ctx } = await open();
    await detail(p, 'Doliprane');
    await p.locator('[data-dispatch-more]').click();
    pass(/Assign/.test(await p.locator('[data-dispatch-person="c5"] [data-dispatch-send]').innerText()), 'the button says Assign, not Send');
    await p.locator('[data-dispatch-person="c5"] [data-dispatch-send]').click(); await p.waitForTimeout(700);
    pass(p._calls.join(',') === 'put', `they are put on the task and no text is asked for (${p._calls.join(',')})`);
    pass(/Not texted: no valid number/.test(await p.locator('[data-dispatch-outcome]').innerText()), 'and the panel says they were not texted');
    await ctx.close(); }

  console.log('== when the save fails, nothing is texted');
  { const { p, ctx } = await open({ put: 'fail' });
    await detail(p, 'Doliprane');
    await p.locator('[data-dispatch-person="c2"] [data-dispatch-send]').click(); await p.waitForTimeout(900);
    pass(p._calls.join(',') === 'put', `no text is asked for (${p._calls.join(',')})`);
    pass(/Nothing was sent/.test(await p.locator('[data-dispatch-error]').innerText()), 'the panel says nothing was sent');
    pass(await p.locator('[data-dispatch-person="c2"]').count() === 1, 'the person is still on offer: the save was rolled back');
    await ctx.close(); }

  console.log('== when the text is refused after the save');
  { const { p, ctx } = await open();
    p._answer = { error_code: 'sms_capped', error_detail: 'cap' };
    await detail(p, 'Doliprane');
    await p.locator('[data-dispatch-person="c2"] [data-dispatch-send]').click(); await p.waitForTimeout(800);
    pass(/daily text limit/i.test(await p.locator('[data-dispatch-outcome]').innerText()), 'a capped company is told so, in words');
    pass(p._calls.join(',') === 'put,sms', 'the person stays on the task: only the text was refused');
    await ctx.close(); }

  console.log('== nobody free, and a closed task');
  { const { p, ctx } = await open({ people: [P('c4', 'Off Olga', 'off', 0, true)] });
    await detail(p, 'Doliprane');
    pass(/Nobody free to send/.test(await p.locator('[data-dispatch-empty]').innerText()), 'with nobody free it says so');
    await ctx.close(); }
  { const { p, ctx } = await open();
    await detail(p, 'Insuline');
    pass(await p.locator('#priority-detail-deadline').count() === 1 && await p.locator('[data-dispatch]').count() === 0, 'a task that is done has no Send someone panel');
    await ctx.close(); }

  console.log('== French');
  { const { p, ctx } = await open({ lang: 'fr' });
    await p.getByRole('button', { name: /Détail|Priority detail/ }).first().click(); await p.waitForTimeout(400);
    pass(/Envoyer quelqu'un/i.test(await p.locator('[data-dispatch]').innerText()) && /Suggéré/.test(await p.locator('[data-dispatch]').innerText()), 'the panel and the tag are in French');
    await p.locator('[data-dispatch-send]').first().click(); await p.waitForTimeout(800);
    pass(p._texts[0] && p._texts[0].lang === 'fr', 'and the API is asked for the French text');
    await ctx.close(); }

  console.log('== dark, and a phone');
  { const { p, ctx } = await open({ theme: 'dark' });
    await detail(p, 'Doliprane'); await p.screenshot({ path: 'dispatch-dark.png' }); await ctx.close(); }
  { const { p, ctx } = await open({ vw: 390 });
    await p.getByRole('button', { name: /Priority detail for Doliprane|Doliprane/ }).first().click().catch(() => {}); await p.waitForTimeout(500);
    pass(await p.locator('[data-dispatch]').count() === 1, 'the panel is there at 390 px');
    pass(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'no sideways scroll at 390 px');
    const box = await p.locator('[data-dispatch-send]').first().boundingBox();
    pass(box && box.x + box.width <= 390, 'the Send button stays inside the screen');
    await p.screenshot({ path: 'dispatch-phone.png' }); await ctx.close(); }


  console.log('== the same panel in the dashboard alert popup');
  const openDash = async ({ put = 'ok', assignments = [{ task_key: 'Doliprane-health.stock.low', status: 'todo', priority: 'high', deadline: null, contractor_ids: ['c6'] }], vw = 1440, vh = 1000 } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, locale: 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    p._calls = []; p._puts = []; p._texts = []; p._answer = { sms: { status: 'placeholder', live: false } };
    const alert = { id: 'a1', equipment: 'Doliprane', sector: 'health', business_type: 'pharmacie', severity: 'CRITICAL', date: now, alert_key: 'health.stock.low', message: 'MSG Doliprane', risk_score: 70 };
    await p.route(/\/alerts(\?|$)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([alert]) }));
    await p.route(/\/recommendations/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ recommendations: [recs[0]] }) }));
    await p.route(/\/contractors/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ contractors: PEOPLE }) }));
    await p.route(/\/assignments\/sms/, r => { p._calls.push('sms'); p._texts.push(JSON.parse(r.request().postData())); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(p._answer) }); });
    await p.route(/\/assignments(\?|$)/, r => {
      if (r.request().method() === 'PUT') {
        p._calls.push('put'); const body = JSON.parse(r.request().postData()); p._puts.push(body);
        if (put === 'fail') return r.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ assignment: body }) });
      }
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ assignments }) });
    });
    await p.addInitScript(() => { const s = { sentria_onboarded: '1', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', sentria_language: 'en', sentria_company_name: 'Acme' }; for (const k in s) localStorage.setItem(k, s[k]); });
    await signedIn(p); await p.goto(APP_URL, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
    await p.locator('tbody tr').first().click(); await p.waitForTimeout(400);
    await p.getByRole('button', { name: /See the recommendation/ }).first().click(); await p.waitForTimeout(600);
    return { p, ctx };
  };
  { const { p, ctx } = await openDash();
    pass(await p.locator('[data-dispatch]').count() === 1, 'the popup has the Send someone panel');
    pass((await names(p)).join('|') === 'Kofi Mensah|Awa Diop|Extra Eve' && /Suggested/.test(await p.locator('[data-dispatch-person="c2"]').innerText()), 'same order, same Suggested tag');
    await p.locator('[data-dispatch-person="c2"] [data-dispatch-send]').click(); await p.waitForTimeout(800);
    pass(p._calls.join(',') === 'put,sms', `saved first, text second (${p._calls.join(',')})`);
    pass(p._puts[0].task_key === 'Doliprane-health.stock.low' && p._puts[0].status === 'in_progress' && JSON.stringify(p._puts[0].contractor_ids) === '["c6","c2"]', `under the shared task key, In progress (${JSON.stringify([p._puts[0].task_key, p._puts[0].status, p._puts[0].contractor_ids])})`);
    pass(/not sent/i.test(await p.locator('[data-dispatch-outcome]').innerText()) && !/Text sent/.test(await p.locator('[data-dispatch-outcome]').innerText()), 'with SMS off it says "Logged, not sent"');
    const footer = await p.getByRole('button', { name: /Mark handled/ }).last().boundingBox();
    pass(footer && footer.y + footer.height <= 1000, 'Mark handled stays on screen with the panel in the popup');
    await p.getByRole('button', { name: /Mark handled/ }).last().click(); await p.waitForTimeout(600);
    pass(p._puts[p._puts.length - 1].status === 'done' && p._puts[p._puts.length - 1].contractor_ids.includes('c2'), 'Mark handled still saves done and keeps the person on the task');
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await p.screenshot({ path: 'dispatch-dash.png' }); await ctx.close(); }
  { const { p, ctx } = await openDash({ put: 'fail' });
    await p.locator('[data-dispatch-person="c2"] [data-dispatch-send]').click(); await p.waitForTimeout(800);
    pass(p._calls.join(',') === 'put' && /Nothing was sent/.test(await p.locator('[data-dispatch-error]').innerText()), 'a failed save texts nobody and says so');
    await ctx.close(); }
  { const { p, ctx } = await openDash({ assignments: [{ task_key: 'Doliprane-health.stock.low', status: 'done', priority: 'medium', deadline: null, contractor_ids: [] }] });
    pass(await p.locator('[data-dispatch]').count() === 0, 'a task already handled has no panel in the popup');
    await ctx.close(); }
  { const { p, ctx } = await openDash({ vw: 390, vh: 844 });
    await p.evaluate(() => { const d = document.querySelector('[role=dialog]'); d.scrollTop = d.scrollHeight; }); await p.waitForTimeout(300);
    pass(await p.locator('[data-dispatch]').count() === 1 && !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'at 390 px the panel is there and nothing scrolls sideways');
    await p.screenshot({ path: 'dispatch-dash-phone.png' }); await ctx.close(); }

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL OK'); process.exit(fails ? 1 : 0);
})();
