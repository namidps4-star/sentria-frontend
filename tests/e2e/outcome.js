// F-OUTCOME: "What happened?" on a done task. Pro and up (the free plan is
// not asked and the API is not called); three answers worded for the sector;
// only the task, the kind of problem and the answer go to the API, plus a
// cost range for an avoided problem; the count per kind of problem says when
// it starts to move the confidence score; a server that has not run the
// migration says so.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };

const now = new Date().toISOString();
const R = (eq, key, sector) => ({ equipment: eq, sector, business_type: sector === 'health' ? 'pharmacie' : null, severity: 'CRITICAL', date: now, message: `MSG ${eq}`, alert_key: key, recommended_action: `ACT ${eq}`, action_category: 'stock', confidence: 0.8 });
const HEALTH = 'health.stock.low';
const empty = () => ({ can_answer: true, answers: {}, kinds: {} });

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async ({ plan = 'pro', lang = 'en', vw = 1440, theme = 'light', sector = 'health', log = empty(), postAnswer = 'ok', getAnswer = 'ok' } = {}) => {
    const key = sector === 'health' ? HEALTH : `${sector}.failure.imminent`;
    const recs = [R('Doliprane', key, sector), R('Insuline', key, sector)];
    const ctx = await browser.newContext({ viewport: { width: vw, height: vw < 500 ? 844 : 1300 }, locale: lang === 'fr' ? 'fr-FR' : 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    p._gets = 0; p._posts = []; p._key = key;
    await p.route(/\/alerts(\?|$)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await p.route(/\/recommendations/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ recommendations: recs }) }));
    await p.route(/\/contractors/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"contractors":[]}' }));
    await p.route(/\/assignments(\?|$)/, r => {
      if (r.request().method() === 'PUT') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ assignment: JSON.parse(r.request().postData()) }) });
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ assignments: [
        { task_key: `Doliprane-${key}`, status: 'done', priority: 'high', deadline: null, contractor_ids: [] },
        { task_key: `Insuline-${key}`, status: 'in_progress', priority: 'low', deadline: null, contractor_ids: [] },
      ] }) });
    });
    await p.route(/\/outcomes/, r => {
      if (r.request().method() === 'POST') {
        p._posts.push(JSON.parse(r.request().postData()));
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(postAnswer === 'ok' ? { outcome: {} } : { error_code: postAnswer, error_detail: 'x' }) });
      }
      p._gets++;
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(getAnswer === 'ok' ? { outcomes: log } : { error_code: getAnswer, error_detail: 'x' }) });
    });
    await p.addInitScript(([l, t, s]) => { const v = { sentria_onboarded: '1', sentria_sector: s, sentria_sectors: JSON.stringify([s]), sentria_business_type: s === 'health' ? 'pharmacie' : '', sentria_language: l, sentria_company_name: 'Acme', sentria_theme: t }; for (const k in v) localStorage.setItem(k, v[k]); }, [lang, theme, sector]);
    await signedIn(p, 'u-test', 'test@sentria.app', { plan });
    await p.goto(APP_URL, { waitUntil: 'networkidle' });
    if (vw < 1024) { await p.getByRole('button', { name: /menu/i }).first().click(); await p.waitForTimeout(300); }
    await p.getByRole('button', { name: lang === 'fr' ? /^Suivi$/ : /^Tracking$/ }).first().click(); await p.waitForTimeout(1200);
    return { p, ctx };
  };
  const detail = async (p, eq) => { await p.locator(`button[aria-label$="${eq}"]`).first().click(); await p.waitForTimeout(700); };
  const ask = p => p.locator('[data-outcome-ask]');
  const words = async p => (await p.locator('[data-outcome]').allInnerTexts()).join(' | ');

  console.log('== Pro, a done pharmacy task (English)');
  { const { p, ctx } = await open();
    await detail(p, 'Doliprane');
    pass(await ask(p).count() === 1, 'the question shows on a done task');
    pass(/What happened\?/.test(await ask(p).innerText()), 'it asks "What happened?"');
    pass(await words(p) === 'Stock-out avoided | Stock-out happened | False alarm', `the three answers use the pharmacy's words (${await words(p)})`);
    pass(await p.locator('[data-outcome-tally]').count() === 0, 'no count is shown before any answer');
    await p.screenshot({ path: 'outcome-ask-light.png' });

    await p.locator('[data-outcome=avoided]').click(); await p.waitForTimeout(500);
    pass(p._posts.length === 1 && JSON.stringify(Object.keys(p._posts[0]).sort()) === JSON.stringify(['alert_key', 'outcome', 'task_key']), `one tap sends the task, the kind of problem and the answer only (${JSON.stringify(p._posts[0])})`);
    pass(p._posts[0].task_key === `Doliprane-${HEALTH}` && p._posts[0].alert_key === HEALTH && p._posts[0].outcome === 'avoided', 'and they are the right ones');
    pass(await p.locator('[data-outcome-saved=avoided]').count() === 1, 'the answer is shown as saved');
    pass(/1 real problem, 0 false alarms/.test(await p.locator('[data-outcome-tally]').innerText()), 'the count for this kind of alert appears');
    pass(/from 3 answers/.test(await p.locator('[data-outcome-tally]').innerText()), 'and says the score uses it from 3 answers');
    pass(await p.locator('[data-outcome-bucket]').count() === 4, 'an avoided problem offers the four cost ranges, optional');

    await p.locator('[data-outcome-bucket="100_1k"]').click(); await p.waitForTimeout(500);
    pass(p._posts.length === 2 && p._posts[1].outcome === 'avoided' && p._posts[1].bucket === '100_1k' && typeof p._posts[1].currency === 'string', `the range goes with the same answer (${JSON.stringify(p._posts[1])})`);
    pass(/Cost avoided/.test(await ask(p).innerText()) && await p.locator('[data-outcome-bucket]').count() === 0, 'the range is shown and not asked again');
    pass(/1 real problem/.test(await p.locator('[data-outcome-tally]').innerText()), 'adding the range does not count the task twice');

    await p.locator('[data-outcome-change]').click(); await p.waitForTimeout(300);
    await p.locator('[data-outcome=false_alarm]').click(); await p.waitForTimeout(500);
    pass(/0 real problems, 1 false alarm/.test(await p.locator('[data-outcome-tally]').innerText()), 'changing the answer moves the count, never doubles it');
    pass(/lower the confidence score/.test(await ask(p).innerText()), 'a false alarm says it lowers the score of this kind');
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== not asked where it does not belong');
  { const { p, ctx } = await open();
    await detail(p, 'Insuline');
    pass(await ask(p).count() === 0, 'a task still in progress is not asked');
    await ctx.close(); }
  { const { p, ctx } = await open({ plan: 'decouverte' });
    await detail(p, 'Doliprane');
    pass(await ask(p).count() === 0, 'the free plan is not asked');
    pass(p._gets === 0, `and the API is not called (${p._gets})`);
    await ctx.close(); }

  console.log('== an answer the server already holds, and enough answers');
  { const log = { can_answer: true, answers: { [`Doliprane-${HEALTH}`]: { outcome: 'happened', bucket: null, currency: '' } }, kinds: { [HEALTH]: { right: 3, wrong: 1 } } };
    const { p, ctx } = await open({ log });
    await detail(p, 'Doliprane');
    pass(await p.locator('[data-outcome-saved=happened]').count() === 1 && /Stock-out happened/.test(await ask(p).innerText()), 'the saved answer is shown, not asked again');
    pass(await p.locator('[data-outcome-bucket]').count() === 0, 'no cost range for a problem that happened');
    const tally = await p.locator('[data-outcome-tally]').innerText();
    pass(/3 real problems, 1 false alarm/.test(tally) && /takes them into account/.test(tally), `with 4 answers it says the score uses them (${tally.replace(/\s+/g, ' ')})`);
    await ctx.close(); }

  console.log('== words follow the sector');
  { const { p, ctx } = await open({ sector: 'industry' });
    await detail(p, 'Doliprane');
    pass(await words(p) === 'Breakdown avoided | Breakdown happened | False alarm', `industry speaks of breakdowns (${await words(p)})`);
    await ctx.close(); }

  console.log('== the server has not run migration 024');
  { const { p, ctx } = await open({ getAnswer: 'outcomes_unavailable', postAnswer: 'outcomes_unavailable' });
    await detail(p, 'Doliprane');
    pass(/migration 024/.test(await ask(p).innerText()), 'it says the server is not ready, in words');
    pass(await p.locator('[data-outcome-tally]').count() === 0, 'and shows no count');
    await ctx.close(); }

  console.log('== French, dark');
  { const { p, ctx } = await open({ lang: 'fr', theme: 'dark', log: { can_answer: true, answers: {}, kinds: { [HEALTH]: { right: 2, wrong: 1 } } } });
    await p.locator('button[aria-label*="Doliprane"]').first().click(); await p.waitForTimeout(700);
    pass(/Que s'est-il passé/.test(await ask(p).innerText()), 'the question is in French');
    pass(await words(p) === 'Rupture évitée | Rupture quand même | Fausse alerte', `the answers are in French (${await words(p)})`);
    pass(/2 vrais problèmes, 1 fausse alerte/.test(await p.locator('[data-outcome-tally]').innerText()), 'the count is in French');
    await p.screenshot({ path: 'outcome-ask-dark.png' });
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== a phone');
  { const { p, ctx } = await open({ vw: 390, log: { can_answer: true, answers: {}, kinds: { [HEALTH]: { right: 4, wrong: 1 } } } });
    await detail(p, 'Doliprane');
    await ask(p).scrollIntoViewIfNeeded();
    pass(await ask(p).count() === 1, 'the question shows at 390 px');
    pass(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'no sideways scroll at 390 px');
    await p.screenshot({ path: 'outcome-ask-390.png' });
    await ctx.close(); }

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL OK'); process.exit(fails ? 1 : 0);
})();
