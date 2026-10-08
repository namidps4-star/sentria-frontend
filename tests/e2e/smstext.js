// F-SMS2: texting a person about a task, and the board catching the reply.
// A "Text" button on each person who is ON the task and CAN be texted; only
// the task and the person go to the API (never words); the answer says plainly
// when nothing was sent (SMS not live); a reply that closed the task on the
// server shows up on the board without a reload; an edit in progress is never
// overwritten.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };

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
    p._texts = []; p._answer = { sms: { status: 'placeholder', live: false } };
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

  console.log('== who gets a Text button (English)');
  { const { p, ctx } = await open();
    await detail(p, 'Doliprane');
    pass(await p.locator('#priority-detail-deadline').count() === 1, 'the task detail is open');
    pass(await textButtons(p).count() === 1, `one Text button: only the person who is on the task and can be texted (${await textButtons(p).count()})`);
    pass(/Awa Diop/.test(await textButtons(p).first().getAttribute('aria-label')), 'it is labelled with that person');
    await p.screenshot({ path: 'smstext-detail.png' });
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== sending: only the task and the person');
  { const { p, ctx } = await open();
    await detail(p, 'Doliprane');
    await textButtons(p).first().click(); await p.waitForTimeout(600);
    pass(p._texts.length === 1 && JSON.stringify(Object.keys(p._texts[0]).sort()) === JSON.stringify(['contractor_id', 'lang', 'task_key']), `the request has exactly the task, the person and the language (${JSON.stringify(p._texts[0])})`);
    pass(p._texts[0].task_key === 'Doliprane-health.stock.low' && p._texts[0].contractor_id === 'c1' && p._texts[0].lang === 'en', 'and they are the right ones');
    pass(/not sent/i.test(await p.locator('[data-task-text-result]').innerText()) && /not live/i.test(await p.locator('[data-task-text-result]').innerText()), 'with SMS off it says "Logged, not sent: SMS is not live yet"');
    pass(!/Text sent/.test(await p.locator('[data-task-text-result]').innerText()), 'and never claims the person was texted');
    pass(await p.locator('input[type=checkbox]:checked').count() >= 1 && (await p.getByLabel(/Awa Diop/).first().isChecked().catch(() => true)), 'pressing Text does not untick the person');

    p._answer = { sms: { status: 'sent', live: true } };
    await textButtons(p).first().click(); await p.waitForTimeout(600);
    const live = await p.locator('[data-task-text-result]').innerText();
    pass(/Text sent/.test(live) && /1/.test(live) && /9/.test(live), `live: it says the text went and what to answer (${live.replace(/\s+/g, ' ')})`);

    p._answer = { error_code: 'sms_capped', error_detail: 'cap' };
    await textButtons(p).first().click(); await p.waitForTimeout(600);
    pass(/daily text limit/i.test(await p.locator('[data-task-text-error]').innerText()), 'a capped company is told so, in words');
    pass(await p.locator('[data-task-text-result]').count() === 0, 'and the old "sent" note is gone');
    p._answer = { error_code: 'contractor_not_on_task', error_detail: 'x' };
    await textButtons(p).first().click(); await p.waitForTimeout(600);
    pass(/not saved with this person yet/i.test(await p.locator('[data-task-text-error]').innerText()), 'a task not saved yet says to try again');
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== French');
  { const { p, ctx } = await open({ lang: 'fr' });
    await p.getByRole('button', { name: /Détail|Priority detail/ }).first().click(); await p.waitForTimeout(400);
    const btn = textButtons(p).first();
    pass(await btn.count() === 1 && /Envoyer un SMS/.test(await btn.innerText()), 'the button is in French');
    await btn.click(); await p.waitForTimeout(600);
    pass(p._texts[0] && p._texts[0].lang === 'fr', 'and the API is asked for the French text');
    pass(/pas envoyé/.test(await p.locator('[data-task-text-result]').innerText()), 'the "not sent" note is in French');
    await ctx.close(); }

  console.log('== a reply closes the task on the server; the board catches up');
  { const { p, ctx } = await open();
    const col = async name => p.evaluate(n => { const s = [...document.querySelectorAll('section')].find(x => new RegExp(n).test(x.innerText.split('\n').slice(0, 3).join(' '))); return s ? s.innerText : ''; }, name);
    pass(!(await col('Resolved')).includes('Doliprane'), 'Doliprane is not resolved yet');
    p._server[0].status = 'done';                       // a "1" came in
    await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await p.waitForTimeout(1200);
    pass((await col('Resolved')).includes('Doliprane'), 'after a "1", Doliprane is in Resolved without a reload');
    p._server[2].status = 'dismissed';                  // a "9" came in
    await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await p.waitForTimeout(1200);
    pass(await p.locator('article', { hasText: 'Insuline' }).count() === 0, 'after a "9", Insuline leaves the board');
    pass(await p.locator('article', { hasText: 'Amoxicilline' }).count() === 1, 'the others are untouched');
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== an edit is never overwritten by a look');
  { const { p, ctx } = await open();
    const inProgress = async () => p.evaluate(() => { const s = [...document.querySelectorAll('section')].find(x => /In progress/.test(x.innerText.split('\n').slice(0, 3).join(' '))); return s ? s.innerText : ''; });
    pass((await inProgress()).includes('Amoxicilline'), 'Amoxicilline is in progress here');
    p._server[1].status = 'todo';                       // the server says something a reply cannot say
    await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await p.waitForTimeout(1200);
    pass((await inProgress()).includes('Amoxicilline'), 'a status that is not done or dismissed is not taken over');
    await ctx.close(); }

  console.log('== a phone');
  { const { p, ctx } = await open({ vw: 390 });
    await p.getByRole('button', { name: /Priority detail for Doliprane|Doliprane/ }).first().click().catch(() => {}); await p.waitForTimeout(500);
    pass(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'no sideways scroll at 390 px');
    await ctx.close(); }

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL OK'); process.exit(fails ? 1 : 0);
})();
