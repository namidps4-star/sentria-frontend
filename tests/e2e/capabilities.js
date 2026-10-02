// C-PRICE: what each plan can do, from one list. The pricing page's capability
// section is drawn from what GET /plans says (pipeline/entitlements.py in the
// backend), so the page and the entitlement map cannot disagree. This checks
// the parsing (all or nothing), the page (tiers, rows, columns, "soon"),
// that the plan cards' own rows follow the same list, and that nothing is
// drawn when the API has not said.
const fs = require('fs');
const path = require('path');
const ts = require(path.join(__dirname, '..', '..', 'node_modules', 'typescript'));
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
const { PLANS_ANSWER } = require('./plans-fixture');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const ROOT = path.join(__dirname, '..', '..');
const clone = o => JSON.parse(JSON.stringify(o));
const ORDER = PLANS_ANSWER.order;

// lib/plans.ts and lib/i18n in node: the real file, the i18n helper stubbed
function loadPlans() {
  const src = fs.readFileSync(path.join(ROOT, 'lib', 'plans.ts'), 'utf8');
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  const win = { dispatchEvent() {} };
  global.window = win; global.Event = class { constructor(n) { this.type = n; } };
  new Function('require', 'module', 'exports', js)(id => id === '@/lib/i18n' ? { localized: (fr, en) => ({ fr, en }) } : id === '@/lib/priorities' ? {} : require(id), mod, mod.exports);
  return mod.exports;
}

console.log('== the backend list, as the app reads it');
{
  const cap = PLANS_ANSWER.capabilities;
  pass(cap.length >= 12 && PLANS_ANSWER.tiers.map(t => t.key).join() === 'detection,estimation,coordination', `the fixture is the backend's answer: ${cap.length} capabilities in ${PLANS_ANSWER.tiers.length} tiers`);
  const P = loadPlans();
  pass(P.CAPABILITIES.length === 0 && P.TIERS.length === 0, 'before the API has answered there is no list (no copy of our own that could disagree)');
  pass(P.applyEntitlements(clone(PLANS_ANSWER)) === true && P.CAPABILITIES.length === cap.length && P.TIERS.length === 3, 'a /plans answer fills tiers and capabilities in place');
  pass(P.CAPABILITIES.every((c, i) => c.key === cap[i].key && c.plan === cap[i].plan && c.live === cap[i].live && c.label.fr === cap[i].label.fr && c.label.en === cap[i].label.en), 'each one keeps its key, plan, live flag and both labels');
  const incl = (plan, key) => P.includesCapability(plan, P.CAPABILITIES.find(c => c.key === key));
  pass(ORDER.map(p => incl(p, 'threshold_alerts')).join() === 'true,true,true,true', 'detection is in every plan');
  pass(ORDER.map(p => incl(p, 'value_at_risk')).join() === 'false,true,true,true', 'value at risk: Pro and up');
  pass(ORDER.map(p => incl(p, 'ml')).join() === 'false,false,true,true', 'the learned lead times: Business and up');
  pass(ORDER.map(p => incl(p, 'score')).join() === 'false,false,false,true', 'the score: Entreprise only');
  pass(ORDER.every(p => P.PLAN_LIMITS[p].tracking === incl(p, 'tracking') && P.PLAN_LIMITS[p].ml === incl(p, 'ml') && P.ENTITLEMENTS[p].sms === incl(p, 'sms_alerts')), 'the plan cards\' own flags (tracking, ml, sms) are the same answer as the list');

  const bad = (mutate) => { const p = clone(PLANS_ANSWER); mutate(p); const Q = loadPlans(); const ok = Q.applyEntitlements(p); return { ok, n: Q.CAPABILITIES.length, t: Q.TIERS.length, Q }; };
  let r = bad(p => { delete p.capabilities; delete p.tiers; });
  pass(r.ok === true && r.n === 0, 'an API that sends no capabilities (an older one): the plan numbers still apply, no list is drawn');
  r = bad(p => { p.capabilities[3].plan = 'platinum'; });
  pass(r.ok === true && r.n === 0 && r.t === 0, 'one capability with an unknown plan: none is applied (never half a list), the numbers still are');
  r = bad(p => { p.capabilities[2].tier = 'mystery'; }); pass(r.n === 0, 'a tier that is not listed: none applied');
  r = bad(p => { p.capabilities[1].label = { fr: 'seulement' }; }); pass(r.n === 0, 'a label missing its English: none applied');
  r = bad(p => { p.capabilities[0].live = 'yes'; }); pass(r.n === 0, 'live that is not a boolean: none applied');
  r = bad(p => { p.tiers[0].summary = null; }); pass(r.n === 0, 'a tier without a summary: none applied');
  r = bad(p => { p.capabilities = []; }); pass(r.n === 0, 'an empty list: nothing to draw');
  r = bad(p => { delete p.entitlements.pro; }); pass(r.ok === false && r.n === 0, 'bad plan numbers: the whole answer is ignored, capabilities included');
  const Q = loadPlans(); Q.applyEntitlements(clone(PLANS_ANSWER)); Q.applyEntitlements(Object.assign(clone(PLANS_ANSWER), { capabilities: [{ key: 'x' }] }));
  pass(Q.CAPABILITIES.length === cap.length, 'a later bad answer does not wipe a good list that was already applied');
}

// ---- the browser
const ONB = { sentria_onboarded: 'true', sentria_company_name: 'Pharmacie A', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', sentria_country: 'BJ' };
async function open(browser, { answer = PLANS_ANSWER, down = false, theme = 'light', scheme = 'light', width = 1440, lang = 'en', plan = 'business' } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, locale: lang === 'fr' ? 'fr-FR' : 'en-US', colorScheme: scheme });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route(/onrender\.com\//, r => {
    const u = r.request().url(); const json = (b, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(b) });
    if (/\/plans(\?|$)/.test(u)) return down ? json({ detail: 'down' }, 503) : json(answer);
    return json(u.includes('/alerts') ? [] : { recommendations: [], assignments: [], contractors: [] });
  });
  await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } }, { ...ONB, sentria_language: lang, sentria_theme: theme });
  await signedIn(p, 'u', 'a@b.c', { plan });
  await p.goto(APP_URL); await p.waitForTimeout(1800);
  if (width < 768) { await p.getByRole('button', { name: /open.*(menu|navigation)/i }).first().click().catch(() => {}); await p.waitForTimeout(300); }
  await p.locator('aside nav button').filter({ hasText: /^(Subscription|Abonnement)$/ }).locator('visible=true').first().click(); await p.waitForTimeout(900);
  return { ctx, p, errs };
}
const section = p => p.locator('[data-capabilities]');
const rowsOf = p => p.locator('[data-capability]').evaluateAll(els => els.map(e => ({ key: e.dataset.capability, live: e.dataset.live, tier: e.closest('tbody').dataset.tier, label: e.querySelector('th').childNodes[0].textContent.trim(), cells: [...e.querySelectorAll('td')].map(c => ({ plan: c.dataset.plan, included: c.dataset.included, shown: getComputedStyle(c).display !== 'none' })) })));

(async () => {
  const b = await chromium.launch(LAUNCH);

  console.log('== the pricing page: drawn from the list');
  {
    const { ctx, p, errs } = await open(b);
    pass(await section(p).count() === 1, 'the section is there');
    pass(/What each plan can do/.test(await section(p).locator('h3').innerText()) && /not by department/.test(await section(p).innerText()), 'its title says it is by what it gives you, not by department');
    const tiers = await section(p).locator('tbody').evaluateAll(els => els.map(e => ({ key: e.dataset.tier, name: e.querySelector('th').innerText.replace(/\s+/g, ' ').trim() })));
    pass(tiers.map(t => t.key).join() === 'detection,estimation,coordination' && /^Detect/.test(tiers[0].name) && /^Anticipate and estimate/.test(tiers[1].name) && /^Coordinate/.test(tiers[2].name), `the three tiers in order: ${tiers.map(t => t.name.slice(0, 22)).join(' | ')}`);
    const rows = await rowsOf(p);
    pass(rows.length === PLANS_ANSWER.capabilities.length && rows.every((r, i) => r.key === PLANS_ANSWER.capabilities[i].key), `one row per capability, in the API's order (${rows.length})`);
    pass(rows.every((r, i) => r.tier === PLANS_ANSWER.capabilities[i].tier), 'each under its own tier');
    pass(rows.every((r, i) => r.label === PLANS_ANSWER.capabilities[i].label.en), 'labels are the API\'s English');
    const wrong = rows.filter((r, i) => r.cells.map(c => c.included).join() !== ORDER.map(pl => String(ORDER.indexOf(pl) >= ORDER.indexOf(PLANS_ANSWER.capabilities[i].plan))).join());
    pass(wrong.length === 0 && rows.every(r => r.cells.length === 4 && r.cells.every(c => c.shown)), `every row's four cells follow its lowest plan exactly (${wrong.length} wrong)`);
    pass(await section(p).locator('thead th[data-plan-head]').evaluateAll(els => els.map(e => e.dataset.planHead)).then(h => h.join() === ORDER.join()), 'the four plan columns, in plan order');
    const heads = await section(p).locator('thead th[data-plan-head]').allInnerTexts(); pass(heads.join().toLowerCase() === 'découverte,pro,business,entreprise', `headed by the plan names (${heads})`);
    const soon = await p.locator('[data-capability][data-live="false"]').evaluateAll(els => els.map(e => /Soon/i.test(e.querySelector('th').innerText)));
    const live = await p.locator('[data-capability][data-live="true"]').evaluateAll(els => els.map(e => /Soon/i.test(e.querySelector('th').innerText)));
    pass(soon.length === 6 && soon.every(Boolean) && live.every(x => !x), `"Soon" is on the ${soon.length} roadmap rows and only on them`);
    pass(!/\bIoT\b|\bSSO\b|white label|webhooks/i.test(await section(p).innerText()), 'no promise of a thing that is not on the list');
    pass(await section(p).locator('td[data-included="true"] svg').first().evaluate(el => getComputedStyle(el).color) === await p.evaluate(() => { const e = document.createElement('i'); e.style.color = 'var(--tag-success-fg)'; document.body.appendChild(e); const c = getComputedStyle(e).color; e.remove(); return c; }), 'the check marks are the success token');
    pass(await section(p).locator('td .sr-only').first().innerText() === 'Included' && (await section(p).locator('td[data-included="false"] .sr-only').first().innerText()) === 'Not included', 'a screen reader hears Included / Not included, not just a mark');
    pass(await section(p).locator('table caption').count() === 1 && await section(p).locator('tbody tr th[scope=row]').count() === rows.length && await section(p).locator('thead th[scope=col]').count() === 5, 'a real table: caption, column headers, a row header per capability');
    pass(/seasonal advice starts from your region/i.test(await p.evaluate(() => document.body.innerText)), 'the seasonal-advice disclaimer is on the page (stock advice, never medical advice)');
    const banner = p.locator('section[class*="bg-brand-deep"]').filter({ has: p.locator('h3', { hasText: /^SentrIA Intelligence/ }) });
    pass(await banner.count() === 1 && await banner.evaluate(el => getComputedStyle(el).backgroundColor) === 'rgb(15, 46, 31)', 'the green SentrIA Intelligence banner is there, in the --brand-deep colour');
    pass(await banner.locator('li').count() === 4 && await banner.locator('li').filter({ hasText: /Soon/ }).count() === 3, 'the banner lists four features, three of them marked Soon');
    pass((await banner.boundingBox()).y < (await section(p).boundingBox()).y, 'the banner sits above the capability list');

    console.log('== the plan cards agree with it');
    const cards = await p.evaluate(() => [...document.querySelectorAll('section[aria-labelledby^="plan-"]')].map(c => ({ plan: c.getAttribute('aria-labelledby').replace('plan-', ''), rows: [...c.querySelectorAll('ul li')].map(li => ({ text: li.innerText.replace(/\s+/g, ' ').replace(/^Not included: /, '').trim(), has: !!li.querySelector('svg') && !/Not included/.test(li.innerText) })) })));
    const flagRow = (card, re) => card.rows.find(r => re.test(r.text));
    const cap = key => PLANS_ANSWER.capabilities.find(c => c.key === key);
    const wantHas = (plan, key) => ORDER.indexOf(plan) >= ORDER.indexOf(cap(key).plan);
    pass(cards.length === 4 && cards.every(c => flagRow(c, /Tracking, calendar/).has === wantHas(c.plan, 'tracking')), 'each card\'s "Tracking, calendar, contractors, reports" row is the capability "tracking"');
    pass(cards.every(c => flagRow(c, /SentrIA Intelligence/).has === wantHas(c.plan, 'ml')), 'each card\'s "SentrIA Intelligence (AI)" row is the capability "ml"');
    pass(cards.every(c => /SMS/.test(flagRow(c, /alerts/).text) === wantHas(c.plan, 'sms_alerts')), 'each card says "App + SMS alerts" or "In-app alerts" as the capability "sms_alerts" says');
    await p.screenshot({ path: 'capabilities-light-1440.png', fullPage: false });
    await section(p).scrollIntoViewIfNeeded(); await p.waitForTimeout(200); await section(p).screenshot({ path: 'capabilities-section-light.png' });
    pass(errs.length === 0, 'no page errors');
    await ctx.close();
  }

  console.log('== the list is the API\'s: change it and the page changes');
  {
    const moved = clone(PLANS_ANSWER);
    moved.capabilities.find(c => c.key === 'value_at_risk').plan = 'business';
    moved.capabilities.find(c => c.key === 'score').plan = 'business';
    moved.capabilities.find(c => c.key === 'score').label = { fr: 'Note de fiabilité', en: 'Reliability rating' };
    moved.capabilities.push({ key: 'extra', tier: 'estimation', plan: 'pro', live: false, label: { fr: 'Une nouveauté', en: 'A new thing' } });
    const { ctx, p } = await open(b, { answer: moved });
    const rows = Object.fromEntries((await rowsOf(p)).map(r => [r.key, r]));
    pass(rows.value_at_risk.cells.map(c => c.included).join() === 'false,false,true,true', 'value at risk moved to Business: the Pro cell is empty now');
    pass(rows.score.cells.map(c => c.included).join() === 'false,false,true,true' && rows.score.label === 'Reliability rating', 'the score moved to Business and was renamed: the page follows');
    pass(rows.extra && rows.extra.live === 'false' && rows.extra.label === 'A new thing' && rows.extra.cells.map(c => c.included).join() === 'false,true,true,true', 'a capability added on the API shows with no change in the app');
    await ctx.close();
  }

  console.log('== when the API has not said, nothing is drawn');
  for (const [label, opts] of [
    ['the API is down (503)', { down: true }],
    ['an answer with no capabilities (an older API)', { answer: (() => { const a = clone(PLANS_ANSWER); delete a.capabilities; delete a.tiers; return a; })() }],
    ['an answer with one malformed capability', { answer: (() => { const a = clone(PLANS_ANSWER); a.capabilities[0].plan = 'gold'; return a; })() }],
  ]) {
    const { ctx, p, errs } = await open(b, opts);
    pass(await section(p).count() === 0, `${label}: no capability section`);
    pass(await p.locator('section[aria-labelledby^="plan-"]').count() === 4 && /Add-ons|Options/.test(await p.evaluate(() => document.body.innerText)), `${label}: the four plan cards and the add-ons are still there`);
    pass(await p.locator('section[class*="bg-brand-deep"]').filter({ has: p.locator('h3', { hasText: /^SentrIA Intelligence/ }) }).count() === 1, `${label}: the SentrIA Intelligence banner is still there (it does not wait for the API)`);
    pass(errs.length === 0, `${label}: no page errors`);
    await ctx.close();
  }

  console.log('== French');
  {
    const { ctx, p } = await open(b, { lang: 'fr' });
    const rows = await rowsOf(p);
    pass(rows.every((r, i) => r.label === PLANS_ANSWER.capabilities[i].label.fr), 'every label is the API\'s French');
    const t = await section(p).innerText();
    pass(/Ce que chaque offre permet/.test(t) && /Anticiper et chiffrer/.test(t) && /Bientôt/.test(t) && /pas par département/.test(t), 'title, tiers and "Bientôt" in French');
    await ctx.close();
  }

  console.log('== themes and a phone');
  {
    for (const [name, theme, scheme] of [['dark', 'dark', 'light'], ['system, OS dark', 'system', 'dark']]) {
      const { ctx, p } = await open(b, { theme, scheme });
      const check = await section(p).locator('td[data-included="true"] svg').first().evaluate(el => getComputedStyle(el).color);
      const bg = await section(p).evaluate(el => getComputedStyle(el).backgroundColor);
      const lum = c => { const m = c.match(/[\d.]+/g).map(Number); return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255; };
      pass(lum(check) > lum(bg) + 0.3, `${name}: the check marks read against the card (${check} on ${bg})`);
      if (theme === 'dark') { await section(p).scrollIntoViewIfNeeded(); await p.waitForTimeout(200); await section(p).screenshot({ path: 'capabilities-section-dark.png' }); }
      await ctx.close();
    }
    for (const theme of ['light', 'dark']) {
      const { ctx, p, errs } = await open(b, { theme, width: 390 });
      const rows = await rowsOf(p);
      pass(rows.every(r => r.cells.every(c => !c.shown)), `${theme}, 390 px: the four plan columns are hidden (no room)…`);
      const from = await p.locator('[data-capability] [data-from]').allInnerTexts();
      pass(from.length === rows.length && from[0] === 'Every plan' && from[3] === 'From Pro' && from[8] === 'From Business' && from.at(-1) === 'From Entreprise', `…each row says its lowest plan instead (${from[0]} | ${from[3]} | ${from[8]} | ${from.at(-1)})`);
      const m = await p.evaluate(() => { const s = document.querySelector('[data-capabilities]'); const r = s.getBoundingClientRect(); const t = s.querySelector('table').getBoundingClientRect(); return { page: document.documentElement.scrollWidth, win: innerWidth, tableFits: t.right <= r.right + 1 && t.left >= r.left - 1 }; });
      pass(m.page <= m.win + 1 && m.tableFits, `${theme}, 390 px: no sideways scroll; the table fits its card`);
      await section(p).scrollIntoViewIfNeeded(); await p.waitForTimeout(200); await section(p).screenshot({ path: `capabilities-section-${theme}-390.png` });
      pass(errs.length === 0, `${theme}, 390 px: no page errors`);
      await ctx.close();
    }
  }

  await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL OK');
  process.exit(fails ? 1 : 0);
})();
