// F-SUPPORT: the "Help and feedback" form in the sidebar. A bug, an idea or a
// question goes to POST /support/messages (the API emails it to the team with
// the company and the plan, which it reads from the sign-in, never from the
// request). The API is faked here; its own rules are in the backend's
// tests/check_support.py. What this suite guards: the entry point, what the
// request carries (and what it must not), every way a send can fail keeping
// the person's text, a stray click never losing a message, the wait time read
// from Retry-After, both languages, and light, dark and 390 px.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { mockSupabase, session, STORAGE_KEY } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const OK = () => ({ status: 200, body: { sent: true } });
// What the API answers when it refuses, with the header the browser may read.
const refuse = (status, code, message, extra = {}) => () => ({ status, body: { detail: { error_code: code, message } }, ...extra });
const EXPOSE = { 'access-control-expose-headers': 'Retry-After' };

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async ({ lang = 'en', theme = 'light', vw = 1440, vh = 900, collapsed = false, reduced = false, reply = OK } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, locale: lang === 'fr' ? 'fr-FR' : 'en-US', reducedMotion: reduced ? 'reduce' : 'no-preference' });
    const p = await ctx.newPage();
    p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    p._logs = []; p.on('console', m => p._logs.push(m.text()));
    p._posts = []; p._reply = reply;
    await p.route(/onrender\.com\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: r.request().url().includes('/alerts') ? '[]' : '{"recommendations":[],"assignments":[],"contractors":[]}' }));
    // Registered after the general route, so it is tried first.
    await p.route(/onrender\.com\/support\/messages/, async r => {
      const req = r.request();
      let body = null; try { body = JSON.parse(req.postData() || 'null'); } catch { body = null; }
      p._posts.push({ body, headers: req.headers(), raw: req.postData() || '' });
      const out = await p._reply(p._posts.length);
      if (out.abort) return r.abort('failed');
      await r.fulfill({ status: out.status, contentType: out.raw !== undefined ? 'text/html' : 'application/json', headers: out.headers || {}, body: out.raw !== undefined ? out.raw : JSON.stringify(out.body) });
    });
    await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } },
      { sentria_onboarded: 'true', sentria_company_name: 'Acme', sentria_sector: 'industry', sentria_sectors: '["industry"]', sentria_language: lang, sentria_theme: theme });
    const db = { users: { 'ama@acme.test': { uid: 'u-1', password: 'x' } }, accounts: {} };
    await mockSupabase(p, db, { profileFromPage: true, plan: 'pro' });
    await p.addInitScript(({ key, s }) => { localStorage.setItem(key, JSON.stringify(s)); localStorage.setItem('sentria_account_owner', 'u-1'); }, { key: STORAGE_KEY, s: session('u-1', 'ama@acme.test', {}) });
    await p.goto(APP_URL); await p.waitForTimeout(2200);
    if (vw < 768) { await p.getByRole('button', { name: /open.*(menu|navigation)/i }).first().click(); await p.waitForTimeout(400); }
    if (collapsed) { await p.getByRole('button', { name: /Collapse/ }).click(); await p.waitForTimeout(500); }
    return { p, ctx };
  };
  const entry = p => p.locator('aside [data-support-open]');
  const card = p => p.locator('[data-support]');
  const box = p => p.locator('#support-message');
  const sendBtn = p => p.locator('[data-support-send]');
  const problem = p => p.locator('[data-support-problem]');
  const show = async p => { await entry(p).click(); await p.waitForTimeout(350); };
  const closed = async p => { await p.waitForTimeout(450); return (await card(p).count()) === 0; };
  const focusIsEntry = p => p.evaluate(() => document.activeElement?.hasAttribute('data-support-open') === true);
  const type = async (p, text) => { await box(p).fill(text); await p.waitForTimeout(100); };
  const go = async p => { await sendBtn(p).click(); await p.waitForTimeout(700); };

  console.log('== the entry: a button above Sign out');
  { const { p, ctx } = await open();
    pass(await entry(p).count() === 1, 'the sidebar has one Help & feedback button');
    pass((await entry(p).innerText()).trim() === 'Help & feedback', 'it says "Help & feedback"');
    const r = await p.evaluate(() => {
      const a = document.querySelector('aside [data-support-open]').getBoundingClientRect();
      const so = [...document.querySelectorAll('aside button')].find(x => /^Sign out$/.test(x.innerText.trim())).getBoundingClientRect();
      return { above: a.bottom <= so.top + 1, fits: so.bottom <= innerHeight, visible: a.width > 0 && a.height > 0 };
    });
    pass(r.visible && r.above, 'it is visible and sits above Sign out');
    pass(r.fits, 'Sign out is still on screen');
    pass(await card(p).count() === 0, 'nothing is open until it is clicked');

    console.log('== opening it');
    await show(p);
    pass(await card(p).count() === 1 && await card(p).getAttribute('role') === 'dialog' && await card(p).getAttribute('aria-modal') === 'true', 'a modal dialog opens');
    pass(await p.getByRole('dialog', { name: 'How can we help?' }).count() === 1, 'it is named by its title: "How can we help?"');
    pass(/A bug, an idea or a question\./.test(await card(p).innerText()), 'it says what the form is for');
    const kinds = await card(p).getByRole('radio').allInnerTexts();
    pass(kinds.join('|') === 'Bug|Idea|Question', 'three kinds: Bug, Idea, Question');
    pass(await card(p).getByRole('radio', { name: 'Bug' }).getAttribute('aria-checked') === 'true', 'Bug is chosen by default');
    pass(await p.evaluate(() => document.activeElement?.id) === 'support-message', 'the cursor is already in the message box');
    pass(await sendBtn(p).isDisabled(), 'Send is off while the box is empty');
    pass((await p.locator('[data-support-count]').innerText()).trim() === '0/2000', 'the counter starts at 0/2000');
    pass(/We attach your company, your plan and this page \(Dashboard\)/.test(await card(p).innerText()), 'it says what is attached, with this page named: Dashboard');
    pass(await box(p).getAttribute('maxlength') === '2000', 'the box stops at 2000 characters, the API limit');
    await p.screenshot({ path: 'support-light.png' });

    console.log('== what unlocks Send');
    await type(p, 'hi');
    pass(await sendBtn(p).isDisabled(), '2 characters: still off');
    await type(p, '   \n   ab  ');
    pass(await sendBtn(p).isDisabled(), 'spaces around 2 letters: still off (the API trims)');
    await type(p, 'hello');
    pass(await sendBtn(p).isEnabled(), '5 characters: on');
    pass((await p.locator('[data-support-count]').innerText()).trim() === '5/2000', 'the counter follows: 5/2000');
    await type(p, 'x'.repeat(2100));
    pass((await box(p).inputValue()).length === 2000, 'a longer text is cut at 2000');
    pass((await p.locator('[data-support-count]').innerText()).trim() === '2000/2000', 'the counter reads 2000/2000');

    console.log('== the kind changes the hint');
    await type(p, '');
    const bugHint = await box(p).getAttribute('placeholder');
    await card(p).getByRole('radio', { name: 'Idea' }).click(); await p.waitForTimeout(100);
    pass(await card(p).getByRole('radio', { name: 'Idea' }).getAttribute('aria-checked') === 'true' && await card(p).getByRole('radio', { name: 'Bug' }).getAttribute('aria-checked') === 'false', 'Idea is chosen and Bug is not');
    const ideaHint = await box(p).getAttribute('placeholder');
    pass(bugHint === 'What happened, and what did you expect?' && ideaHint === 'What would you like to be able to do?', 'the hint in the box changes with the kind');
    await card(p).getByRole('radio', { name: 'Question' }).click(); await p.waitForTimeout(100);
    pass(await box(p).getAttribute('placeholder') === 'What would you like to know?', 'Question has its own hint');
    pass(p._posts.length === 0, 'nothing was sent so far');
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== sending: what the request carries');
  { const { p, ctx } = await open();
    await show(p);
    await card(p).getByRole('radio', { name: 'Idea' }).click();
    await type(p, '  Show the pump chart per week  ');
    await go(p);
    pass(p._posts.length === 1, 'one request is sent');
    const post = p._posts[0] || { body: {}, headers: {}, raw: '' };
    pass(/^Bearer \S+\.\S+\.sig$/.test(post.headers.authorization || ''), 'it carries the signed-in token');
    pass(/application\/json/.test(post.headers['content-type'] || ''), 'it is JSON');
    pass(Object.keys(post.body).sort().join() === 'agent,kind,language,message,page', 'exactly kind, message, page, language and agent');
    pass(post.body.kind === 'idea', 'kind: the one chosen');
    pass(post.body.message === 'Show the pump chart per week', 'message: trimmed');
    pass(post.body.page === 'dashboard', 'page: the view the person is on (dashboard)');
    pass(post.body.language === 'en', 'language: en');
    pass(typeof post.body.agent === 'string' && post.body.agent === (await p.evaluate(() => navigator.userAgent.slice(0, 200))), 'agent: the browser line, at most 200 characters');
    const rest = { ...post.body }; delete rest.message; delete rest.agent;
    pass(!/ama@acme\.test|Acme|company|plan|email/i.test(JSON.stringify(rest)), 'no company, plan or email in the request: the API reads those from the sign-in');

    console.log('== sent');
    pass(await p.locator('[data-support-done]').count() === 1, 'the card says it was sent');
    pass(/Message sent/.test(await card(p).innerText()) && /If a reply helps, it will come by email\./.test(await card(p).innerText()), '"Message sent", and how a reply would come');
    pass(await p.evaluate(() => document.activeElement?.hasAttribute('data-support-close')), 'the Close button has the focus');
    pass(await box(p).count() === 0, 'the form is gone, so it cannot be sent twice');
    await p.screenshot({ path: 'support-done-light.png' });
    await p.locator('[data-support-close]').click();
    pass(await closed(p), 'Close closes it');
    pass(await focusIsEntry(p), 'the focus is back on the Help & feedback button');

    console.log('== a new form starts empty');
    await show(p);
    pass(await box(p).inputValue() === '' && await card(p).getByRole('radio', { name: 'Bug' }).getAttribute('aria-checked') === 'true', 'empty box, Bug chosen');
    pass(await sendBtn(p).isDisabled(), 'Send is off again');
    await p.mouse.click(60, 450); pass(await closed(p), 'a click on the backdrop closes the empty form (the guard did not stay on)');
    pass(p._posts.length === 1, 'still one request in all');

    console.log('== the page sent follows the view');
    await p.locator('aside nav button', { hasText: 'Tracking' }).first().click(); await p.waitForTimeout(900);
    await show(p);
    pass(/this page \(Tracking\)/.test(await card(p).innerText()), 'the note names the page: Tracking');
    await type(p, 'A question about tracking'); await go(p);
    pass(p._posts.at(-1)?.body.page === 'tracking', 'page: tracking');
    await p.locator('[data-support-close]').click(); await p.waitForTimeout(450);
    await p.locator('aside nav button', { hasText: 'Calendar' }).first().click(); await p.waitForTimeout(900);
    await show(p); await type(p, 'A question about the calendar'); await go(p);
    pass(p._posts.at(-1)?.body.page === 'calendar', 'page: calendar');
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== a send that fails keeps the text, and a retry goes through');
  { const TEXT = 'The pump chart is empty today, secret-supplier-42';
    const { p, ctx } = await open();
    await show(p); await type(p, TEXT);
    const fail = async (label, reply, re, extra = {}) => {
      p._reply = reply; const n = p._posts.length;
      await go(p);
      const said = await problem(p).count() ? await problem(p).innerText() : '';
      pass(p._posts.length === n + 1, `${label}: one request`);
      pass(re.test(said), `${label}: says "${said.replace(/\s+/g, ' ').trim()}"`);
      pass(await box(p).inputValue() === TEXT && await card(p).count() === 1, `${label}: the text is kept and the card stays open`);
      pass(await sendBtn(p).isEnabled(), `${label}: Send is back, so a retry costs nothing`);
      pass(await problem(p).getAttribute('role') === 'alert', `${label}: announced as an alert`);
      if (extra.shot) await p.screenshot({ path: extra.shot });
    };
    await fail('429 with a wait the browser may read (45 min)', refuse(429, 'support_rate_limited', 'Too many messages. Try again later.', { headers: { 'retry-after': '2700', ...EXPOSE } }), /several messages in a row\. Try again in 45 min\./, { shot: 'support-error-light.png' });
    await fail('429 with a long wait (7300 s)', refuse(429, 'support_rate_limited', 'x', { headers: { 'retry-after': '7300', ...EXPOSE } }), /Try again in 3 hours\./);
    await fail('429 with a short wait (20 s)', refuse(429, 'support_rate_limited', 'x', { headers: { 'retry-after': '20', ...EXPOSE } }), /Try again in 1 min\./);
    await fail('429 when the browser cannot read Retry-After', refuse(429, 'support_rate_limited', 'x', { headers: { 'retry-after': '2700' } }), /Try again later\./);
    pass(!/\d+ min|\d+ hours?/.test(await problem(p).innerText()), 'no wait time is invented when the header is hidden');
    await fail('429 busy', refuse(429, 'support_busy', 'Support is busy.'), /getting a lot of messages right now\. Try again in a few minutes\./);
    await fail('503 not switched on', refuse(503, 'support_not_configured', 'x'), /Messages are not switched on yet\. Try again later\./);
    await fail('502 the mail provider refused', refuse(502, 'support_send_failed', 'x'), /could not be sent\. Your text is kept: try again\./);
    await fail('401 the session ended', refuse(401, 'auth_required', 'x'), /Your session expired\. Sign in again, then try again\./);
    await fail('400 the message was refused', refuse(400, 'message_too_short', 'x'), /was not accepted\. Check its length and try again\./);
    await fail('404 the API has no such route yet', () => ({ status: 404, body: { detail: 'Not Found' } }), /Something went wrong\. Your text is kept: try again\./);
    await fail('500 with a page, not JSON', () => ({ status: 500, raw: '<html>Bad gateway</html>' }), /Something went wrong\. Your text is kept: try again\./);
    await fail('the API cannot be reached', () => ({ abort: true }), /The SentrIA API did not answer\. Your text is kept: try again\./);

    pass(!p._logs.some(l => l.includes(TEXT) || l.includes('supplier')), 'the console never shows what the person wrote');
    pass(p._logs.some(l => /POST \/support\/messages -> HTTP 502 support_send_failed/.test(l)), 'a failure is logged with its status and code');

    console.log('== typing clears the message, a retry then works');
    await box(p).press('End'); await p.keyboard.type('!');
    pass(await problem(p).count() === 0, 'typing again clears the error line');
    p._reply = OK; const n = p._posts.length; await go(p);
    pass(p._posts.length === n + 1 && p._posts.at(-1).body.message === TEXT + '!', 'the retry sends the same words, plus the new character');
    pass(await p.locator('[data-support-done]').count() === 1, 'and it is sent');
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== while it sends: once, and nothing else works');
  { const { p, ctx } = await open({ reply: async () => { await sleep(1500); return OK(); } });
    await show(p); await type(p, 'This takes a moment to send');
    await sendBtn(p).click(); await p.waitForTimeout(350);
    pass((await sendBtn(p).innerText()).trim() === 'Sending…' && await sendBtn(p).isDisabled(), 'Send reads "Sending…" and is off');
    pass(await box(p).getAttribute('readonly') !== null, 'the text cannot change');
    pass(await p.locator('[data-support-cancel]').isDisabled() && await card(p).getByRole('button', { name: 'Close' }).isDisabled(), 'Cancel and the X are off');
    await p.keyboard.press('Escape'); await p.waitForTimeout(150);
    pass(await card(p).count() === 1, 'Escape does not close it');
    await p.mouse.click(60, 450); await p.waitForTimeout(150);
    pass(await card(p).count() === 1, 'a click on the backdrop does not close it');
    await p.evaluate(() => document.querySelector('[data-support] form').requestSubmit()); await p.waitForTimeout(150);
    await p.waitForTimeout(1500);
    pass(p._posts.length === 1, 'a second submit while it sends is ignored: one request');
    pass(await p.locator('[data-support-done]').count() === 1, 'then it says sent');
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== closing: nothing is lost by accident, nothing is sent by accident');
  { const { p, ctx } = await open();
    await show(p); await type(p, 'half a thought');
    await p.mouse.click(60, 450); await p.waitForTimeout(450);
    pass(await card(p).count() === 1, 'a click on the backdrop does not close a form with text');
    await card(p).locator('h3').click(); await p.waitForTimeout(200);
    pass(await card(p).count() === 1, 'a click inside the card does not close it');
    await p.locator('[data-support-cancel]').click();
    pass(await closed(p) && await focusIsEntry(p), 'Cancel closes it and the focus goes back to the button');
    await show(p);
    pass(await box(p).inputValue() === '', 'the text is gone when it was cancelled on purpose');
    await p.mouse.click(60, 450); pass(await closed(p), 'a click on the backdrop closes an empty form');
    await show(p); await p.keyboard.press('Escape');
    pass(await closed(p) && await focusIsEntry(p), 'Escape closes it, the focus goes back');
    await show(p); await type(p, 'typed then Escape'); await p.keyboard.press('Escape');
    pass(await closed(p), 'Escape closes it even with text (a deliberate key)');
    await show(p); await p.mouse.click(60, 450);
    pass(await closed(p), 'and the next empty form still closes on the backdrop');
    await show(p); await card(p).getByRole('button', { name: 'Close' }).click();
    pass(await closed(p), 'the X closes it');
    pass(p._posts.length === 0, 'nothing was sent by any of this');
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== placed over the whole screen, not inside the sidebar');
  { const { p, ctx } = await open();
    await show(p);
    const r = await p.evaluate(() => {
      const d = document.querySelector('[data-support]'); const b = d.getBoundingClientRect(); const back = d.parentElement.getBoundingClientRect();
      const top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      return { centered: Math.abs((b.left + b.width / 2) - innerWidth / 2) < 2, full: back.width >= innerWidth - 1 && back.height >= innerHeight - 1, top: d.contains(top), blur: getComputedStyle(d.parentElement).backdropFilter };
    });
    pass(r.centered, 'centred on the screen'); pass(r.full, 'the backdrop covers the whole screen'); pass(r.top, 'it is on top');
    await ctx.close(); }

  console.log('== collapsed sidebar (icon only)');
  { const { p, ctx } = await open({ collapsed: true });
    const icon = p.locator('aside button[aria-label="Help & feedback"]');
    pass(await icon.count() === 1 && (await icon.innerText()).trim() === '', 'the icon button is named for screen readers and shows no text');
    pass(await icon.getAttribute('title') === 'Help & feedback', 'it has a tooltip');
    await icon.click(); await p.waitForTimeout(350);
    pass(await card(p).count() === 1, 'it opens the same form');
    await p.keyboard.press('Escape');
    pass(await closed(p) && await focusIsEntry(p), 'Escape closes it, the focus is back on the icon');
    await ctx.close(); }

  console.log('== French');
  { const { p, ctx } = await open({ lang: 'fr', reply: refuse(429, 'support_rate_limited', 'x', { headers: { 'retry-after': '2700', ...EXPOSE } }) });
    pass((await entry(p).innerText()).trim() === 'Aide et retours', 'the button says "Aide et retours"');
    await show(p);
    const t = await card(p).innerText();
    pass(/Comment pouvons-nous aider \?/.test(t) && /Un bug, une idée ou une question\./.test(t), 'title and intro are in French');
    pass((await card(p).getByRole('radio').allInnerTexts()).join('|') === 'Problème|Idée|Question', 'the kinds: Problème, Idée, Question');
    pass(/Votre message/.test(t) && /Annuler/.test(t) && /Envoyer/.test(t), 'label and both buttons are in French');
    pass(/Nous joignons votre entreprise, votre offre et cette page \(Dashboard\)/.test(t), 'the attachment note is in French');
    pass(await box(p).getAttribute('placeholder') === "Que s'est-il passé, et qu'attendiez-vous ?", 'the hint is in French');
    await type(p, 'La courbe est vide'); await go(p);
    pass(p._posts[0]?.body.language === 'fr', 'language: fr');
    pass(/Vous avez envoyé plusieurs messages à la suite\. Réessayez dans 45 min\./.test(await problem(p).innerText()), 'a refusal says the wait in French');
    p._reply = OK; await go(p);
    pass(/Message envoyé/.test(await card(p).innerText()) && /Si une réponse est utile, elle arrivera par email\./.test(await card(p).innerText()), 'the sent card is in French');
    pass(/Fermer/.test(await p.locator('[data-support-close]').innerText()), 'with a Fermer button');
    await ctx.close(); }

  console.log('== reduced motion');
  { const { p, ctx } = await open({ reduced: true });
    await entry(p).click(); await p.waitForTimeout(150);
    pass(await card(p).count() === 1, 'it opens at once');
    await p.keyboard.press('Escape'); await p.waitForTimeout(150);
    pass(await card(p).count() === 0, 'and closes at once');
    await ctx.close(); }

  console.log('== dark');
  { const { p, ctx } = await open({ theme: 'dark', reply: refuse(502, 'support_send_failed', 'x') });
    await show(p); await p.screenshot({ path: 'support-dark.png' });
    await type(p, 'The chart is wrong in dark mode'); await go(p);
    pass(await problem(p).count() === 1, 'dark: the error line shows');
    await p.screenshot({ path: 'support-error-dark.png' });
    const r = await p.evaluate(() => {
      const el = document.querySelector('[data-support-problem]'); const c = getComputedStyle(el); const card = getComputedStyle(document.querySelector('[data-support]'));
      return { text: c.color, card: card.backgroundColor, border: card.borderTopColor };
    });
    pass(r.text !== r.card, 'dark: the error text differs from the card');
    p._reply = OK; await go(p);
    await p.screenshot({ path: 'support-done-dark.png' });
    pass(await p.locator('[data-support-done]').count() === 1, 'dark: the sent card shows');
    await ctx.close(); }

  console.log('== 390 px');
  { const { p, ctx } = await open({ vw: 390, vh: 844, reply: refuse(429, 'support_rate_limited', 'x', { headers: { 'retry-after': '2700', ...EXPOSE } }) });
    await show(p);
    const fit = () => p.evaluate(() => {
      const d = document.querySelector('[data-support]'); const b = d.getBoundingClientRect();
      const top = document.elementFromPoint(b.left + b.width / 2, b.top + 40);
      const send = document.querySelector('[data-support-send]')?.getBoundingClientRect();
      return { inside: b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight, top: d.contains(top), scroll: document.documentElement.scrollWidth <= innerWidth + 1, send: !send || (send.left >= b.left && send.right <= b.right && send.bottom <= innerHeight), kinds: [...document.querySelectorAll('[data-support-kind]')].every(k => k.getBoundingClientRect().right <= b.right) };
    });
    let r = await fit();
    pass(r.inside && r.top, '390 px: the card fits and is above the open sidebar');
    pass(r.scroll, '390 px: no sideways page scroll');
    pass(r.send && r.kinds, '390 px: the kinds and Send stay inside the card');
    await p.screenshot({ path: 'support-390.png' });
    await type(p, 'A long message that goes on and on to see the layout under the error line at a narrow width'); await go(p);
    r = await fit();
    pass(r.inside && r.send, '390 px: the card still fits with the error line');
    await p.screenshot({ path: 'support-error-390.png' });
    await p.setViewportSize({ width: 390, height: 420 }); await p.waitForTimeout(300);
    const short = await p.evaluate(() => { const d = document.querySelector('[data-support]'); const b = d.getBoundingClientRect(); return { fits: b.top >= 0 && b.bottom <= innerHeight, scrolls: getComputedStyle(d).overflowY === 'auto' && d.scrollHeight > d.clientHeight }; });
    pass(short.fits && short.scrolls, '390 px on a short screen: the card stays on screen and scrolls inside itself');
    await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(200);
    p._reply = OK; await go(p);
    await p.screenshot({ path: 'support-done-390.png' });
    pass(await p.locator('[data-support-done]').count() === 1, '390 px: sent');
    await p.locator('[data-support-close]').click(); await p.waitForTimeout(450);
    pass(await card(p).count() === 0 && p._errors.length === 0, '390 px: closes, no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL OK'); process.exit(fails ? 1 : 0);
})();
