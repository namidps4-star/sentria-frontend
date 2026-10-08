// I-COST step 2 screens: the starter figure in Settings (Pro and up), the
// customer's own figure and learned range in the recommendation popup, and
// the one-tap question after Mark handled (Business and up, only for an alert
// with no amount from the file). Nothing is invented: no figure without an
// answer behind it, never a zero.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };

const now = new Date().toISOString();
const KEY = 'health.cold.high';
const recOf = (eq, sev = 'CRITICAL') => ({ equipment: eq, sector: 'health', business_type: 'pharmacie', severity: sev, date: now, message: `MSG ${eq}`, alert_key: KEY, recommended_action: `ACT ${eq}`, action_category: 'cold', confidence: 0.8, risk_score: 80 });
const alertOf = (eq, params, sev = 'CRITICAL') => ({ id: eq, equipment: eq, sector: 'health', business_type: 'pharmacie', severity: sev, date: now, alert_key: KEY, message: `MSG ${eq}`, risk_score: 80, params });
const costOf = (plan, { starter = { amount: 500, currency: '€' }, learned = {} } = {}) => ({ plan, starter, learned, can_set_starter: plan !== 'decouverte', can_tap: plan === 'business' || plan === 'entreprise' });

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async ({ plan = 'entreprise', cost = null, params = undefined, severity = 'CRITICAL', lang = 'en', vw = 1440, theme = 'light', page = 'popup', putStarter = 'ok', tapAnswer = 'ok' } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vw < 500 ? 844 : 1000 }, locale: lang === 'fr' ? 'fr-FR' : 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    p._costGets = 0; p._starterPuts = []; p._taps = []; p._assign = [];
    await p.route(/\/alerts(\?|$)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([alertOf('Fridge-3', params, severity)]) }));
    await p.route(/\/recommendations/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ recommendations: [recOf('Fridge-3', severity)] }) }));
    await p.route(/\/contractors/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"contractors":[]}' }));
    await p.route(/\/cost\/tap/, r => { p._taps.push(JSON.parse(r.request().postData())); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(tapAnswer === 'ok' ? { tap: { bucket: 'x' } } : { error_code: 'cost_unavailable', error_detail: 'x' }) }); });
    await p.route(/\/cost\/starter/, r => { const b = JSON.parse(r.request().postData()); p._starterPuts.push(b); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(putStarter === 'ok' ? { starter: { amount: b.amount, currency: b.currency } } : { error_code: 'cost_unavailable', error_detail: 'x' }) }); });
    await p.route(/\/cost(\?|$)/, r => { p._costGets++; r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ cost: cost || costOf(plan) }) }); });
    await p.route(/\/assignments/, r => { if (r.request().method() === 'PUT') { const b = JSON.parse(r.request().postData()); p._assign.push(b); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ assignment: b }) }); } r.fulfill({ status: 200, contentType: 'application/json', body: '{"assignments":[]}' }); });
    await p.addInitScript(([l, t]) => { const s = { sentria_onboarded: '1', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', sentria_language: l, sentria_company_name: 'Acme', sentria_theme: t }; for (const k in s) localStorage.setItem(k, s[k]); }, [lang, theme]);
    await signedIn(p, 'u-test', 'test@sentria.app', { plan });
    await p.goto(APP_URL, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
    if (vw < 1024) { await p.getByRole('button', { name: /menu/i }).first().click(); await p.waitForTimeout(300); await p.getByRole('button', { name: lang === 'fr' ? /^Tableau de bord$/ : /^Dashboard$/ }).first().click(); await p.waitForTimeout(500); }
    if (page === 'settings') { await p.getByRole('button', { name: lang === 'fr' ? /^Paramètres$/ : /^Settings$/ }).first().click(); await p.waitForTimeout(1200); }
    else { await p.locator('tbody tr').first().click(); await p.waitForTimeout(400); await p.getByRole('button', { name: lang === 'fr' ? /Voir la recommandation/ : /See the recommendation/ }).first().click(); await p.waitForTimeout(600); }
    return { p, ctx };
  };
  const popup = p => p.locator('[aria-labelledby=recommendation-dialog-title]');
  const card = p => p.locator('[data-cost-starter]');

  console.log('== Settings: the starter figure');
  { const { p, ctx } = await open({ plan: 'pro', page: 'settings' });
    pass(await card(p).count() === 1 && await p.locator('[data-cost-starter-input]').inputValue() === '500', 'Pro: the card is there with the saved figure');
    pass(/On file: 500/.test(await p.locator('[data-cost-starter-saved]').innerText()), 'and says what is on file');
    await p.locator('[data-cost-starter-input]').fill('750'); await p.locator('[data-cost-starter-save]').click(); await p.waitForTimeout(500);
    pass(p._starterPuts.length === 1 && p._starterPuts[0].amount === 750 && typeof p._starterPuts[0].currency === 'string', `Save sends the amount and the currency (${JSON.stringify(p._starterPuts[0])})`);
    pass(/Saved\./.test(await card(p).innerText()), 'and says it was saved');
    await p.locator('[data-cost-starter-input]').fill('0'); await p.locator('[data-cost-starter-save]').click(); await p.waitForTimeout(300);
    pass(p._starterPuts.length === 1 && /above zero/.test(await card(p).innerText()), 'zero is refused on screen, nothing sent');
    await p.locator('[data-cost-starter-input]').fill('lots'); await p.locator('[data-cost-starter-save]').click(); await p.waitForTimeout(300);
    pass(p._starterPuts.length === 1, 'words are refused too');
    const sizes = await p.evaluate(() => { const h = n => { const s = [...document.querySelectorAll('section')].find(x => new RegExp(n).test(x.innerText.slice(0, 40))); return s ? Math.round(s.getBoundingClientRect().height) : null; }; return { org: h('Organisation'), lang: h('Language'), cost: h('What a stop') }; });
    pass(sizes.org !== null && sizes.org < 450 && sizes.lang !== null && sizes.lang < 450, `the boxes fit their content, none is stretched (${JSON.stringify(sizes)})`);
    const langs = await p.locator('button:has-text("English"), button:has-text("Français"), button:has-text("Español"), button:has-text("Kiswahili")').allInnerTexts();
    pass(/Fran/.test(langs.join()) && /English/.test(langs.join()) && !/Español|Kiswahili|Português/.test(await p.locator('body').innerText()), 'the language box lists French and English only');
    await p.screenshot({ path: 'costsetup-settings.png' });
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }
  { const { p, ctx } = await open({ plan: 'decouverte', page: 'settings' });
    pass(await p.locator('[data-cost-starter-locked]').count() === 1 && await p.locator('[data-cost-starter-input]').count() === 0, 'free: the card says it comes with Pro, with no field');
    pass(p._costGets === 0, 'and nothing is asked of the server');
    await ctx.close(); }
  { const { p, ctx } = await open({ plan: 'pro', page: 'settings', putStarter: 'fail' });
    await p.locator('[data-cost-starter-input]').fill('300'); await p.locator('[data-cost-starter-save]').click(); await p.waitForTimeout(500);
    pass(/migration 015/.test(await card(p).innerText()) && !/Saved\./.test(await card(p).innerText()), 'a refused save says why and never says "Saved"');
    await ctx.close(); }
  { const { p, ctx } = await open({ plan: 'pro', page: 'settings', lang: 'fr' });
    pass(/Coût d'un arrêt/.test(await card(p).innerText()), 'in French');
    await ctx.close(); }

  console.log('== the popup: your own figure');
  { const { p, ctx } = await open({ plan: 'pro' });
    pass(/You told us a stop costs about 500\s*€ a day/.test(await popup(p).innerText()), 'Pro, critical, no amount in the file: your daily figure, said as yours');
    await p.screenshot({ path: 'costsetup-pro.png' });
    await ctx.close(); }
  { const { p, ctx } = await open({ plan: 'pro', cost: costOf('pro', { starter: null }) });
    pass(await p.locator('[data-cost-starter-ask]').count() === 1 && !/\b0\s*€/.test(await popup(p).innerText()), 'no figure on file: it says where to add one, never a zero');
    await ctx.close(); }
  { const { p, ctx } = await open({ plan: 'pro', severity: 'WARNING' });
    pass(await p.locator('[data-cost-starter-shown]').count() === 0 && await p.locator('[data-cost-starter-ask]').count() === 0, 'a warning gets no cost line');
    await ctx.close(); }
  { const { p, ctx } = await open({ plan: 'decouverte' });
    pass(await p.locator('[data-cost-starter-shown],[data-cost-starter-ask],[data-cost-learned]').count() === 0 && p._costGets === 0, 'free: nothing about cost, and the server is not asked');
    await ctx.close(); }
  { const { p, ctx } = await open({ plan: 'pro', params: [['value', 1240], ['currency', '€']] });
    pass(await p.locator('[data-cost-ignored]').count() === 1 && await p.locator('[data-cost-starter-shown]').count() === 0, 'an alert with an amount from the file shows that, not your daily figure');
    await ctx.close(); }

  console.log('== Business: the typical range, and the one tap');
  { const { p, ctx } = await open({ plan: 'business', cost: costOf('business', { learned: { [KEY]: { bucket: '1k_10k', n: 4, currency: '€' } } }) });
    const t = await p.locator('[data-cost-learned]').innerText();
    pass(/1,000–10,000\s*€/.test(t) && /last 4 answers/.test(t), `the typical range, with how many answers it comes from (${t.replace(/\n/g, ' | ')})`);
    pass(await p.locator('[data-cost-starter-shown]').count() === 0, 'it replaces the daily figure for that kind of problem');
    await p.getByRole('button', { name: /Mark handled/ }).last().click(); await p.waitForTimeout(700);
    pass(await popup(p).count() === 1 && await p.locator('[data-cost-tap]').count() === 1, 'Mark handled keeps the popup open and asks the one question');
    pass(p._assign.some(a => a.status === 'done'), 'and the task was saved as done');
    pass(await popup(p).locator('[data-cost-tap]').evaluate(el => el.getBoundingClientRect().top < 400), 'the question sits at the top, in view');
    const gets = p._costGets;
    await p.locator('[data-cost-bucket="100_1k"]').click(); await p.waitForTimeout(600);
    pass(p._taps.length === 1 && JSON.stringify(Object.keys(p._taps[0]).sort()) === JSON.stringify(['alert_key', 'bucket', 'currency', 'task_key']) && p._taps[0].bucket === '100_1k' && p._taps[0].alert_key === KEY, `the answer is the task, the kind of problem and the range (${JSON.stringify(p._taps[0])})`);
    pass(/Thanks/.test(await popup(p).innerText()) && p._costGets > gets, 'it thanks them and reads the figures again');
    await ctx.close(); }
  { const { p, ctx } = await open({ plan: 'business' });
    await p.getByRole('button', { name: /Mark handled/ }).last().click(); await p.waitForTimeout(600);
    await p.locator('[data-cost-skip]').click(); await p.waitForTimeout(300);
    pass(p._taps.length === 0 && await p.locator('[data-cost-tap]').count() === 0, 'Skip sends nothing and the question goes away');
    await ctx.close(); }
  { const { p, ctx } = await open({ plan: 'business', tapAnswer: 'fail' });
    await p.getByRole('button', { name: /Mark handled/ }).last().click(); await p.waitForTimeout(600);
    await p.locator('[data-cost-bucket="gt10k"]').click(); await p.waitForTimeout(500);
    pass(/migration 015/.test(await p.locator('[data-cost-tap]').innerText()) && await p.locator('[data-cost-tap-thanks]').count() === 0, 'a refused answer says why and never says thanks');
    await ctx.close(); }
  { const { p, ctx } = await open({ plan: 'pro' });
    await p.getByRole('button', { name: /Mark handled/ }).last().click(); await p.waitForTimeout(600);
    pass(await popup(p).count() === 0 && p._taps.length === 0, 'Pro is not asked: Mark handled closes the popup as before');
    await ctx.close(); }
  { const { p, ctx } = await open({ plan: 'business', params: [['value', 1240], ['currency', '€']] });
    await p.getByRole('button', { name: /Mark handled/ }).last().click(); await p.waitForTimeout(600);
    pass(await popup(p).count() === 0, 'an alert with an amount from the file is not asked either');
    await ctx.close(); }

  console.log('== French, dark, phone');
  { const { p, ctx } = await open({ plan: 'business', lang: 'fr', cost: costOf('business', { learned: { [KEY]: { bucket: '100_1k', n: 3, currency: '€' } } }) });
    const t = await p.locator('[data-cost-learned]').innerText();
    pass(/Typique pour ce genre de problème/.test(t) && /3 dernières réponses/.test(t), 'the range line is in French');
    await p.getByRole('button', { name: /Marquer traité/ }).last().click(); await p.waitForTimeout(600);
    pass(/Environ, combien cela a-t-il coûté/.test(await p.locator('[data-cost-tap]').innerText()) && /Passer/.test(await p.locator('[data-cost-tap]').innerText()), 'and so is the question');
    await ctx.close(); }
  { const { p, ctx } = await open({ plan: 'business', theme: 'dark', cost: costOf('business', { learned: { [KEY]: { bucket: '1k_10k', n: 4, currency: '€' } } }) });
    await p.getByRole('button', { name: /Mark handled/ }).last().click(); await p.waitForTimeout(600);
    await p.screenshot({ path: 'costsetup-dark.png' }); await ctx.close(); }
  { const { p, ctx } = await open({ plan: 'business', vw: 390 });
    await p.getByRole('button', { name: /Mark handled/ }).last().click(); await p.waitForTimeout(600);
    pass(await p.locator('[data-cost-tap]').count() === 1 && !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'at 390 px the question is there and nothing scrolls sideways');
    await p.screenshot({ path: 'costsetup-phone.png' }); await ctx.close(); }

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL OK'); process.exit(fails ? 1 : 0);
})();
