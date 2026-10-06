// F-CDELETE: removing a contractor who still holds open tasks. The trash
// button opens a dialog: every open task with its priority and deadline,
// "Suggest a handover" (pre-filled from the API's ranking) or "Choose myself"
// (empty), each task editable, nothing done until "Confirm and remove". Then
// one drafted text per person who gained a task, kept on the Contractors page
// with its Send button switched off ("SMS not yet active"). The API is faked
// (no backend here); the backend's own rules are in the backend's
// tests/check_handover.py.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const ROOT = path.join(__dirname, '..', '..');

const A = 'CRANE-02-logistics.cycles.critical', B = 'QUAI-1-logistics.wait.warning', C = 'SOLO-7-only.awa';
const person = (id, name, role, availability, open, extra = {}) => ({ id, name, role, phone: null, email: null, availability, note: null, active: true, open_assignments: open, sms_ready: null, ...extra });
const PEOPLE = () => [
  person('c1', 'Awa Diop', 'Crane mechanic', 'available', 3),
  person('c2', 'Kofi Mensah', 'Electrician', 'busy', 1),
  person('c3', 'Yao Koffi', 'Crane mechanic', 'available', 1, { phone: '+2290197123457', sms_ready: true }),
  person('c4', 'Ama Off', 'Crane mechanic', 'off', 0),
  person('c6', 'Mia Lopez', 'Crane mechanic', 'available', 0, { phone: '+2290197123458', sms_ready: false }),
  person('c9', 'Zed Nobody', 'Cleaner', 'available', 0),
  person('c8', 'Broken Bo', 'Cleaner', 'available', 0),
];
const cand = (id, name, availability, role_match, open, conflicts, score) => ({ id, name, role: role_match ? 'Crane mechanic' : 'Electrician', availability, role_match, open, conflicts, score });
const PLAN = {
  contractor: { id: 'c1', name: 'Awa Diop', role: 'Crane mechanic' }, open_count: 3,
  tasks: [
    { task_key: A, status: 'in_progress', priority: 'critical', deadline: '2026-10-10', equipment: 'CRANE-02', message: 'Crane cycles critical', co_holders: [], suggested: 'c6', candidates: [cand('c6', 'Mia Lopez', 'available', true, 0, 0, 70), cand('c3', 'Yao Koffi', 'available', true, 1, 1, 35), cand('c2', 'Kofi Mensah', 'busy', false, 1, 1, -35)] },
    { task_key: B, status: 'todo', priority: 'high', deadline: '2026-10-11', equipment: 'QUAI-1', message: 'Queue rising at the berth', co_holders: ['c2'], suggested: 'c3', candidates: [cand('c3', 'Yao Koffi', 'available', true, 1, 1, 35)] },
    { task_key: C, status: 'todo', priority: 'low', deadline: null, equipment: 'SOLO-7', message: '', co_holders: [], suggested: null, candidates: [] },
  ],
};
const draftBody = (lang, name) => lang === 'fr' ? `SentrIA : ${name}, vous reprenez les tâches de Awa Diop : CRANE-02 (10/10). Détails dans l'application.` : `SentrIA: ${name}, you now handle Awa Diop's tasks: CRANE-02 (Oct 10). Details in the app.`;

async function open(browser, { lang = 'en', theme = 'light', width = 1440, scheme = 'light', applyError = null, keepStorage = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 1000 }, locale: lang === 'fr' ? 'fr-FR' : 'en-US', colorScheme: scheme, permissions: ['clipboard-read', 'clipboard-write'] });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const calls = { plan: [], apply: [], remove: [] }; const state = { people: PEOPLE(), planHits: 0 };
  await p.route(/onrender\.com\//, r => {
    const u = new URL(r.request().url()); const m = r.request().method();
    const json = body => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    const hand = u.pathname.match(/^\/contractors\/([^/]+)\/handover$/);
    if (hand && m === 'GET') {
      calls.plan.push(hand[1]); state.planHits++;
      if (hand[1] === 'c8') return r.fulfill({ status: 500, contentType: 'application/json', body: '{"detail":{"message":"boom"}}' });
      if (hand[1] === 'c9') return json({ handover: { contractor: { id: 'c9', name: 'Zed Nobody', role: 'Cleaner' }, open_count: 0, tasks: [] } });
      return json({ handover: PLAN });
    }
    if (hand && m === 'POST') {
      const body = JSON.parse(r.request().postData()); calls.apply.push(body);
      if (applyError) return json({ error_code: applyError.code, error_detail: applyError.detail });
      state.people = state.people.filter(x => x.id !== hand[1]);
      return json({ result: { contractor: { id: 'c1', name: 'Awa Diop', active: false }, handed_over: 2, unassigned: [C], drafts: [
        { contractor_id: 'c6', name: 'Mia Lopez', phone: '+2290197123458', sms_ready: false, task_keys: [A], body: draftBody(body.lang, 'Mia Lopez') },
        { contractor_id: 'c3', name: 'Yao Koffi', phone: '+2290197123457', sms_ready: true, task_keys: [B], body: draftBody(body.lang, 'Yao Koffi') } ] } });
    }
    const one = u.pathname.match(/^\/contractors\/([^/]+)$/);
    if (one && m === 'DELETE') { calls.remove.push(one[1]); state.people = state.people.filter(x => x.id !== one[1]); return json({ contractor: { id: one[1], active: false } }); }
    if (u.pathname === '/contractors') return json({ contractors: state.people });
    if (u.pathname === '/alerts') return json([]);
    return json({ recommendations: [], assignments: [] });
  });
  await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; if (!ls.__keep) localStorage.clear(); delete ls.__keep; for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } },
    { sentria_language: lang, sentria_onboarded: 'true', sentria_sector: 'logistics', sentria_sectors: '["logistics"]', sentria_company_name: 'Acme', sentria_theme: theme, sentria_country: 'BJ', ...(keepStorage ? { __keep: '1' } : {}) });
  await signedIn(p, 'u', 'a@b.c', { plan: 'entreprise' });
  await p.goto(APP_URL); await p.waitForTimeout(1600);
  await goToContractors(p, lang, width);
  return { ctx, p, errs, calls, state };
}
async function goToContractors(p, lang, width) {
  if (width < 768) { await p.getByRole('button', { name: /open.*(menu|navigation)|ouvrir.*(menu|navigation)/i }).first().click().catch(() => {}); await p.waitForTimeout(300); }
  await p.locator('aside nav button').filter({ hasText: new RegExp('^' + (lang === 'fr' ? 'Intervenants' : 'Field team') + '$') }).locator('visible=true').first().click(); await p.waitForTimeout(900);
}
const trash = (p, name, lang = 'en') => p.getByRole('button', { name: `${lang === 'fr' ? 'Retirer' : 'Remove'} ${name}`, exact: true });
const dlg = p => p.locator('[data-handover]');
const row = (p, key) => p.locator(`[data-handover-task="${key}"]`);
const sel = (p, key) => row(p, key).locator('select');
const confirmBtn = p => p.locator('[data-handover-confirm]');
const picked = async (p, key) => sel(p, key).evaluate(s => s.options[s.selectedIndex]?.text ?? '');

(async () => {
  const b = await chromium.launch(LAUNCH);

  console.log('== the trash button opens a dialog, and nothing is removed yet');
  {
    const { ctx, p, errs, calls } = await open(b);
    await trash(p, 'Awa Diop').click(); await p.waitForTimeout(500);
    pass(await dlg(p).isVisible() && /Awa Diop has 3 open tasks/.test(await dlg(p).innerText()), 'the dialog names the person and how many open tasks');
    pass(calls.plan.join() === 'c1' && calls.remove.length === 0 && calls.apply.length === 0, 'the tasks were read; nothing was removed');
    const t = await row(p, A).innerText();
    pass(/CRANE-02/.test(t) && /Crane cycles critical/.test(t), 'a task shows its asset and what the alert says');
    pass(/Critical/.test(await row(p, A).locator('[data-handover-priority]').innerText()) && /High/.test(await row(p, B).locator('[data-handover-priority]').innerText()) && /Low/.test(await row(p, C).locator('[data-handover-priority]').innerText()), 'each task shows its priority');
    pass(/Due 10 Oct 2026/.test(await row(p, A).locator('[data-handover-deadline]').innerText()) && /No deadline/.test(await row(p, C).locator('[data-handover-deadline]').innerText()), 'and its deadline (or says there is none)');
    pass(await confirmBtn(p).isDisabled() && /0 of 3 chosen/.test(await p.locator('[data-handover-count]').innerText()), 'confirm is off until every task has someone (0 of 3)');
    pass(await picked(p, A) === 'Choose…', 'nothing is pre-filled before a choice is made');
    pass(/Also on this task: Kofi Mensah/.test(await row(p, B).innerText()), 'a co-holder who stays is named');
    const opts = await sel(p, B).locator('option').allInnerTexts();
    pass(!opts.some(o => /Kofi Mensah/.test(o)) && !opts.some(o => /Awa Diop/.test(o)), 'the co-holder and the person leaving are not offered');
    pass(opts.some(o => /Ama Off · Crane mechanic \(Unavailable\)/.test(o)), 'someone who is unavailable is listed, marked');
    pass(opts.at(-1) === 'No one for now', '"No one for now" is the last choice');
    await p.keyboard.press('Escape'); await p.waitForTimeout(500);
    pass(await dlg(p).count() === 0 && calls.remove.length === 0 && calls.apply.length === 0, 'Escape closes it and still nothing is removed');
    await trash(p, 'Awa Diop').click(); await p.waitForTimeout(400);
    await p.locator('[data-handover-cancel]').click(); await p.waitForTimeout(500);
    pass(await dlg(p).count() === 0 && calls.apply.length === 0, 'Cancel closes it');
    pass(errs.length === 0, `no page errors ${errs.join('|')}`);
    await ctx.close();
  }

  console.log('== Suggest: pre-filled from the ranking, every task editable');
  {
    const { ctx, p, calls } = await open(b);
    await trash(p, 'Awa Diop').click(); await p.waitForTimeout(500);
    await p.locator('[data-handover-suggest]').click(); await p.waitForTimeout(200);
    pass(/Mia Lopez/.test(await picked(p, A)) && /Yao Koffi/.test(await picked(p, B)), 'each task gets the API\'s first pick');
    pass(await picked(p, C) === 'No one for now', 'a task nobody can take is set to "No one for now"');
    pass(await p.locator('[data-handover-suggest]').getAttribute('aria-pressed') === 'true', 'the Suggest button shows it is on');
    pass(await confirmBtn(p).isEnabled() && /3 of 3 chosen/.test(await p.locator('[data-handover-count]').innerText()), 'confirm is on (3 of 3)');
    const facts = await row(p, A).locator('[data-handover-facts]').innerText();
    pass(/Suggested/.test(facts) && /Same role/.test(facts) && /Available/.test(facts) && /Nothing open/.test(facts), `the reasons are shown (${facts.replace(/\s+/g, ' ')})`);
    await sel(p, A).selectOption('c3'); await p.waitForTimeout(150);
    const f2 = await row(p, A).locator('[data-handover-facts]').innerText();
    pass(/Due near 1 other/.test(f2) && /1 open task\b/.test(f2) && !/Suggested/.test(f2), `change it by hand: new reasons (a clash with another task), and no "Suggested" tag (${f2.replace(/\s+/g, ' ')})`);
    await sel(p, A).selectOption('c2'); await p.waitForTimeout(150);
    const f3 = await row(p, A).locator('[data-handover-facts]').innerText();
    pass(/Busy/.test(f3) && !/Same role/.test(f3), 'a different role is not tagged "Same role"; busy is said');
    await sel(p, A).selectOption('c4'); await p.waitForTimeout(150);
    pass(/Unavailable/.test(await row(p, A).locator('[data-handover-facts]').innerText()), 'someone chosen outside the ranking still gets availability and workload');
    pass(/left with nobody/.test(await row(p, C).innerText()), 'a task left to nobody says so');
    await sel(p, A).selectOption('c6');
    pass(calls.apply.length === 0 && calls.remove.length === 0, 'still nothing sent');
    await ctx.close();
  }

  console.log('== Choose myself: empty, then picked by hand, then confirmed');
  {
    const { ctx, p, calls } = await open(b);
    await trash(p, 'Awa Diop').click(); await p.waitForTimeout(500);
    await p.locator('[data-handover-suggest]').click(); await p.waitForTimeout(100);
    await p.locator('[data-handover-manual]').click(); await p.waitForTimeout(150);
    pass(await picked(p, A) === 'Choose…' && await picked(p, B) === 'Choose…' && await confirmBtn(p).isDisabled(), '"Choose myself" empties the choices');
    await sel(p, A).selectOption('c3'); await sel(p, B).selectOption('c6');
    pass(await confirmBtn(p).isDisabled(), 'two of three is not enough');
    await sel(p, C).selectOption('__none__'); await p.waitForTimeout(100);
    pass(await confirmBtn(p).isEnabled(), 'an explicit "No one for now" counts as a choice');
    await confirmBtn(p).click(); await p.waitForTimeout(900);
    pass(calls.apply.length === 1 && calls.remove.length === 0, 'one hand-over request, no plain delete');
    const sent = calls.apply[0];
    pass(sent.lang === 'en' && JSON.stringify(sent.moves) === JSON.stringify([{ task_key: A, contractor_ids: ['c3'] }, { task_key: B, contractor_ids: ['c6'] }, { task_key: C, contractor_ids: [] }]), `it sends each task with its person (${JSON.stringify(sent.moves)})`);
    const done = await p.locator('[data-handover-done]').innerText();
    pass(/Awa Diop was removed/.test(await dlg(p).innerText()) && /2 tasks handed over/.test(done), 'the result says who was removed and how many tasks moved');
    pass(/Now with nobody: SOLO-7/.test(await p.locator('[data-handover-left]').innerText()), 'the task left with nobody is named');
    const rows = p.locator('[data-handover] [data-sms-draft]');
    pass(await rows.count() === 2, 'one drafted text per person who gained a task');
    pass(/Mia Lopez, you now handle Awa Diop's tasks: CRANE-02 \(Oct 10\)/.test(await rows.first().locator('[data-sms-body]').innerText()), 'the text names the task and the due date');
    const send = rows.first().locator('[data-sms-send]');
    pass(await send.isDisabled() && /SMS not yet active/.test(await send.innerText()), 'Send is there, off, and says SMS is not active yet');
    pass(/Fix the number/.test(await rows.first().innerText()) && !/Fix the number/.test(await rows.nth(1).innerText()), 'a number that cannot be texted is flagged on its row only');
    await rows.first().locator('[data-sms-copy]').click(); await p.waitForTimeout(250);
    pass((await p.evaluate(() => navigator.clipboard.readText())).startsWith('SentrIA: Mia Lopez') && /Copied/.test(await rows.first().locator('[data-sms-copy]').innerText()), 'Copy puts the text on the clipboard');
    const kept = await p.evaluate(() => JSON.parse(localStorage.getItem('sentria_sms_drafts') || '[]'));
    pass(kept.length === 2 && kept[0].from === 'Awa Diop' && kept[0].body.startsWith('SentrIA: '), 'the texts are kept in the browser');
    await p.locator('[data-handover-close]').click(); await p.waitForTimeout(500);
    pass(await dlg(p).count() === 0 && await trash(p, 'Awa Diop').count() === 0, 'closed; the list was reloaded without Awa');
    const card = p.locator('[data-sms-drafts]');
    pass(await card.isVisible() && /Messages ready \(2\)/.test(await card.innerText()) && /SMS not yet active/.test(await card.innerText()), 'the Contractors page lists the waiting texts');
    await p.reload(); await p.waitForTimeout(1600); await goToContractors(p, 'en', 1440);
    pass(await p.locator('[data-sms-drafts] [data-sms-draft]').count() === 2, 'they are still there after a reload');
    await p.locator('[data-sms-drafts] [data-sms-discard]').first().click(); await p.waitForTimeout(200);
    pass(await p.locator('[data-sms-drafts] [data-sms-draft]').count() === 1 && /Messages ready \(1\)/.test(await card.innerText()), 'Discard removes one');
    await p.locator('[data-sms-drafts] [data-sms-discard]').first().click(); await p.waitForTimeout(200);
    pass(await card.count() === 0, 'with none left the card is gone');
    await ctx.close();
  }

  console.log('== no open task: a plain confirmation, then the old removal');
  {
    const { ctx, p, calls } = await open(b);
    await trash(p, 'Zed Nobody').click(); await p.waitForTimeout(500);
    const t = await dlg(p).innerText();
    pass(/Remove Zed Nobody\?/.test(t) && /No open task/.test(t) && !(await p.locator('[data-handover-suggest]').count()), 'it asks "Remove Zed Nobody?", with no task list');
    pass(calls.remove.length === 0, 'asking removes nothing');
    await confirmBtn(p).click(); await p.waitForTimeout(800);
    pass(calls.remove.join() === 'c9' && calls.apply.length === 0, 'Remove calls the plain delete, not the hand-over');
    pass(await dlg(p).count() === 0 && await trash(p, 'Zed Nobody').count() === 0, 'the dialog closes and the list is reloaded');
    await ctx.close();
  }

  console.log('== when it goes wrong');
  {
    const { ctx, p, calls } = await open(b);
    await trash(p, 'Broken Bo').click(); await p.waitForTimeout(600);
    pass(/Their tasks could not be read/.test(await dlg(p).innerText()) && /Nothing was removed/.test(await dlg(p).innerText()), 'tasks that cannot be read: said so, and nothing was removed');
    pass(await confirmBtn(p).count() === 0 && calls.remove.length === 0, 'no remove button to press, no delete sent');
    await p.getByRole('button', { name: 'Try again' }).click(); await p.waitForTimeout(500);
    pass(calls.plan.filter(x => x === 'c8').length === 2, 'Try again asks again');
    await ctx.close();
  }
  {
    const { ctx, p, calls, state } = await open(b, { applyError: { code: 'task_not_open_for_contractor', detail: 'x is not an open task of this contractor.' } });
    await trash(p, 'Awa Diop').click(); await p.waitForTimeout(500);
    await p.locator('[data-handover-suggest]').click(); await confirmBtn(p).click(); await p.waitForTimeout(900);
    pass(/The tasks changed while you were choosing/.test(await dlg(p).innerText()), 'tasks that changed meanwhile: a clear message, in the reader\'s language');
    pass(state.planHits === 2 && await picked(p, A) === 'Choose…', 'the list is read again and the choices start over');
    pass(await dlg(p).count() === 1 && calls.remove.length === 0, 'the dialog stays open');
    await ctx.close();
  }
  {
    const { ctx, p } = await open(b, { applyError: { code: 'crm_query_failed', detail: 'The request could not be completed, try again.' } });
    await trash(p, 'Awa Diop').click(); await p.waitForTimeout(500);
    await p.locator('[data-handover-suggest]').click(); await confirmBtn(p).click(); await p.waitForTimeout(900);
    const t = await p.locator('[data-handover-problem]').innerText();
    pass(/could not be completed/.test(t) && /Some tasks may already have moved\. Try again to finish\./.test(t), 'a failed save says some tasks may have moved and to try again');
    pass(/Yao Koffi/.test(await picked(p, B)) && await confirmBtn(p).isEnabled(), 'the choices are kept so it can be run again');
    await ctx.close();
  }
  {
    const { ctx, p } = await open(b, { applyError: { code: 'handover_target_invalid', detail: 'c3 cannot take this task over.' } });
    await trash(p, 'Awa Diop').click(); await p.waitForTimeout(500);
    await p.locator('[data-handover-suggest]').click(); await confirmBtn(p).click(); await p.waitForTimeout(900);
    pass(/That person can no longer take tasks over/.test(await p.locator('[data-handover-problem]').innerText()), 'a person who can no longer take a task: said, choices kept');
    await ctx.close();
  }

  console.log('== French');
  {
    const { ctx, p, calls } = await open(b, { lang: 'fr' });
    await trash(p, 'Awa Diop', 'fr').click(); await p.waitForTimeout(500);
    const t = await dlg(p).innerText();
    pass(/Awa Diop a 3 tâches ouvertes/.test(t) && /Proposer une répartition/.test(t) && /Choisir moi-même/.test(t), 'title and the two ways to fill it');
    pass(/Critique/.test(await row(p, A).innerText()) && /Échéance 10 oct\. 2026/.test(await row(p, A).innerText()) && /Sans échéance/.test(await row(p, C).innerText()), 'priority and deadline in French');
    await p.locator('[data-handover-suggest]').click(); await p.waitForTimeout(150);
    pass(/Suggéré/.test(await row(p, A).locator('[data-handover-facts]').innerText()) && /Même fonction/.test(await row(p, A).locator('[data-handover-facts]').innerText()), 'the reasons in French');
    pass(/Personne pour l'instant/.test(await picked(p, C)) && /Cette tâche restera sans personne/.test(await row(p, C).innerText()), 'a task left to nobody, in French');
    await confirmBtn(p).click(); await p.waitForTimeout(900);
    pass(calls.apply[0].lang === 'fr', 'the request asks for French texts');
    const r = p.locator('[data-handover] [data-sms-draft]').first();
    pass(/vous reprenez les tâches de Awa Diop/.test(await r.locator('[data-sms-body]').innerText()) && /Envoyer · SMS pas encore actif/.test(await r.locator('[data-sms-send]').innerText()), 'the text and the off Send button in French');
    pass(/a été retiré/.test(await dlg(p).innerText()) && /Sans personne maintenant : SOLO-7/.test(await p.locator('[data-handover-left]').innerText()), 'the result in French');
    await p.locator('[data-handover-close]').click(); await p.waitForTimeout(500);
    pass(/Messages prêts \(2\)/.test(await p.locator('[data-sms-drafts]').innerText()), 'the page card in French');
    await ctx.close();
  }

  console.log('== looks right: light, dark, 390 px');
  for (const [label, o] of [['light', { theme: 'light' }], ['dark', { theme: 'dark' }], ['390', { theme: 'light', width: 390 }], ['390-dark', { theme: 'dark', width: 390 }]]) {
    const { ctx, p, errs } = await open(b, o);
    await trash(p, 'Awa Diop').click(); await p.waitForTimeout(500);
    await p.locator('[data-handover-suggest]').click(); await p.waitForTimeout(200);
    await p.screenshot({ path: `cdelete-dialog-${label}.png` });
    const box = await dlg(p).boundingBox(); const vw = (o.width || 1440);
    pass(box && box.x >= 0 && box.x + box.width <= vw + 0.5, `${label}: the dialog fits the screen width (${box && Math.round(box.x)}..${box && Math.round(box.x + box.width)} of ${vw})`);
    pass(await dlg(p).evaluate(e => e.scrollWidth <= e.clientWidth + 1), `${label}: nothing overflows sideways inside it`);
    pass(await confirmBtn(p).isVisible() || await dlg(p).evaluate(e => e.scrollHeight > e.clientHeight), `${label}: the confirm button is reachable (visible, or the dialog scrolls)`);
    // bright pastel tags on a dark card are what screens.js guards against: ours use the tag tokens
    if (/dark/.test(label)) {
      const bright = await p.evaluate(() => [...document.querySelectorAll('[data-handover] span.rounded-full.border')].filter(e => { const m = getComputedStyle(e).backgroundColor.match(/[\d.]+/g) || []; return m.length >= 3 && (+m[0] + +m[1] + +m[2]) / 3 > 200 && (m[3] === undefined || +m[3] > 0.5); }).length);
      pass(bright === 0, `${label}: no bright pastel tag on the dark dialog (${bright})`);
    }
    await confirmBtn(p).click(); await p.waitForTimeout(900);
    await p.screenshot({ path: `cdelete-result-${label}.png` });
    pass(await dlg(p).evaluate(e => e.scrollWidth <= e.clientWidth + 1), `${label}: the result view fits too`);
    await p.locator('[data-handover-close]').click(); await p.waitForTimeout(500);
    await p.screenshot({ path: `cdelete-page-${label}.png` });
    pass(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${label}: the page has no sideways scroll with the drafts card`);
    pass(errs.length === 0, `${label}: no page errors ${errs.join('|')}`);
    await ctx.close();
  }

  console.log('== source');
  {
    const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
    const files = ['components/sentria/handover-dialog.tsx', 'components/sentria/sms-drafts-card.tsx', 'lib/sms-drafts.ts'];
    pass(files.every(f => !/\bdark:/.test(read(f))), 'theme tokens only: no dark: class in the new files');
    pass(files.every(f => !/—/.test(read(f))), 'no em dash in the new files');
    pass(/"sentria_sms_drafts"/.test(read('lib/account.ts').split('LOCAL_ONLY_USER_KEYS')[1] || ''), 'the drafts are cleared at sign-out (listed with the per-user keys)');
    pass(!/deactivateContractor/.test(read('components/sentria/contractors-view.tsx')), 'the Contractors page no longer removes anyone directly');
    pass(!/\/api\.onrender|https?:\/\/[a-z0-9.-]+\.onrender\.com/.test(files.map(read).join('')) && /apiFetch/.test(read('lib/crm.ts')), 'the calls go through lib/crm.ts (apiFetch), no URL in the components');
  }

  await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
