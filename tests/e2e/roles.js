// F-ROLE: a contractor's role stays free text. The add form offers the roles
// this team already uses (same spelling collapsed, most used first) as
// suggestions; nothing is forced, any other text is still a valid role, and
// an empty team offers nothing.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };

const P = (id, name, role) => ({ id, name, role, phone: null, email: null, availability: 'available', note: null, active: true, open_assignments: 0, sms_ready: null });
const TEAM = [
  P('c1', 'A', 'Crane mechanic'), P('c2', 'B', 'Crane mechanic'), P('c3', 'C', 'crane  mechanic'),
  P('c4', 'D', 'Électricien'), P('c5', 'E', 'electricien'), P('c6', 'F', 'Cleaner'),
  P('c7', 'G', null), P('c8', 'H', '   '),
];

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async ({ people = TEAM, lang = 'en', vw = 1440 } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: 1000 }, locale: lang === 'fr' ? 'fr-FR' : 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message)); p._created = [];
    await p.route(/\/alerts(\?|$)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await p.route(/\/recommendations/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"recommendations":[]}' }));
    await p.route(/\/assignments/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"assignments":[]}' }));
    await p.route(/\/contractors/, r => {
      if (r.request().method() === 'POST') { const b = JSON.parse(r.request().postData()); p._created.push(b); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ contractor: { ...P('new', b.name, b.role ?? null) } }) }); }
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ contractors: people }) });
    });
    await p.addInitScript(l => { const s = { sentria_onboarded: '1', sentria_sector: 'logistics', sentria_sectors: '["logistics"]', sentria_language: l, sentria_company_name: 'Acme' }; for (const k in s) localStorage.setItem(k, k === 'sentria_sectors' ? '["logistics"]' : s[k]); }, lang);
    await signedIn(p); await p.goto(APP_URL, { waitUntil: 'networkidle' });
    if (vw < 1024) { await p.getByRole('button', { name: /menu/i }).first().click(); await p.waitForTimeout(300); }
    await p.getByRole('button', { name: lang === 'fr' ? /^Intervenants$/ : /^Field team$/ }).first().click(); await p.waitForTimeout(1200);
    await p.getByRole('button', { name: lang === 'fr' ? /Ajouter un intervenant/ : /Add a contractor/ }).first().click(); await p.waitForTimeout(400);
    return { p, ctx };
  };
  const options = p => p.locator('datalist#contractor-roles option').evaluateAll(els => els.map(e => e.value));

  console.log('== the suggestions');
  { const { p, ctx } = await open();
    const o = await options(p);
    pass(JSON.stringify(o) === JSON.stringify(['Crane mechanic', 'Électricien', 'Cleaner']), `the team's own roles, most used first, one per spelling (${JSON.stringify(o)})`);
    pass(await p.getByPlaceholder(/Crane operator/).getAttribute('list') === 'contractor-roles', 'the Role field is wired to them');
    pass(!o.includes('crane  mechanic') && !o.includes('electricien'), 'a different case, accent or spacing is not a second role');
    await p.screenshot({ path: 'roles-form.png' });
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }
  { const { p, ctx } = await open({ people: [] });
    pass((await options(p)).length === 0, 'an empty team offers nothing');
    await ctx.close(); }
  { const { p, ctx } = await open({ people: [P('c1', 'A', null), P('c2', 'B', '  ')] });
    pass((await options(p)).length === 0, 'people with no role offer nothing');
    await ctx.close(); }

  console.log('== nothing is forced');
  { const { p, ctx } = await open();
    await p.getByLabel(/^Name/i).first().fill('New Person').catch(async () => { await p.locator('input[autocomplete="name"]').fill('New Person'); });
    await p.getByPlaceholder(/Crane operator/).fill('Rigger');
    await p.getByRole('button', { name: /^(Add|Save|Create)/ }).last().click(); await p.waitForTimeout(700);
    pass(p._created.length === 1 && p._created[0].role === 'Rigger', `a role nobody used before is saved as typed (${JSON.stringify(p._created[0])})`);
    await ctx.close(); }

  console.log('== French');
  { const { p, ctx } = await open({ lang: 'fr' });
    pass((await options(p)).length === 3, 'the suggestions are there in French too');
    await ctx.close(); }

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL OK'); process.exit(fails ? 1 : 0);
})();
