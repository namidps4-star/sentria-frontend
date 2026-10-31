// ROBO-CHAT: Robo's head, opened from Help, from the top bar on wider screens, and from a launcher on phones.
// The person types a question. A word Robo knows gets a short answer, then Robo offers to show the tour step that
// explains it. "Show me" starts the tour there; "Not now" goes back to the input; Escape closes.
// Light English, dark French, 390 px.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const PROFILE = { sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie' };

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async ({ lang = 'en', theme = 'light', vw = 1440, vh = 900, done = true } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, locale: lang === 'fr' ? 'fr-FR' : 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    await p.route(/onrender\.com\//, r => {
      const path = new URL(r.request().url()).pathname;
      return json(r, path === '/alerts' ? { alerts: [] } : path === '/recommendations' ? { recommendations: [] } : { recommendations: [], assignments: [], contractors: [] });
    });
    await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } },
      { sentria_onboarded: 'true', ...PROFILE, sentria_language: lang, sentria_theme: theme, ...(done ? { sentria_guide_done: '1' } : {}) });
    await signedIn(p, 'u-me', 'boss@sentria.app', { plan: 'decouverte', isAdmin: false });
    await p.goto(APP_URL); await p.waitForTimeout(1800);
    return { p, ctx };
  };
  const chat = p => p.locator('[data-testid="robo-chat"]');
  const tour = p => p.locator('[data-testid="guide-buddy"]');
  const input = p => chat(p).locator('[data-testid="robo-input"]');
  // Types a question and sends it.
  const ask = async (p, text) => { await input(p).fill(text); await chat(p).locator('[data-testid="robo-send"]').click(); await p.waitForTimeout(300); };
  // Opens Help, then Robo's chat from it (the drawer first on a phone).
  const openFromHelp = async p => {
    if (p.viewportSize().width < 768) { await p.getByRole('button', { name: /(open|ouvrir).*(menu|navigation)/i }).first().click(); await p.waitForTimeout(400); }
    await p.locator('[data-support-open]').locator('visible=true').first().click(); await p.waitForTimeout(500);
    await p.locator('[data-robo-open]').click(); await p.waitForTimeout(600);
  };

  console.log('== Help opens Robo, and Robo asks for a question first');
  { const { p, ctx } = await open();
    pass(await chat(p).count() === 0, 'no chat on load');
    await openFromHelp(p);
    pass(await chat(p).count() === 1, '"Ask Robo" in Help opens the chat');
    pass(await chat(p).getAttribute('data-stage') === 'ask', 'starts on the input');
    pass(await input(p).count() === 1, 'a text field takes the question');
    pass(await chat(p).locator('svg[aria-label="Robo"]').count() === 1, "Robo's head is drawn in the corner");
    await p.screenshot({ path: 'robochat-light.png' });

    await ask(p, 'risque');
    pass(await chat(p).getAttribute('data-stage') === 'answer', 'a typed word gets an answer');
    pass(/out of 100/.test(await chat(p).innerText()), 'the answer is the scripted risk text');
    pass(/show you now/.test(await chat(p).innerText()) && await chat(p).locator('[data-testid="robo-show"]').count() === 1, 'Robo asks "Do you want me to show you now?"');

    await chat(p).getByRole('button', { name: 'Not now' }).click(); await p.waitForTimeout(300);
    pass(await chat(p).getAttribute('data-stage') === 'ask', '"Not now" goes back to the input');
    pass(await tour(p).count() === 0, '"Not now" does not start the tour');

    await ask(p, 'risk');
    await chat(p).locator('[data-testid="robo-show"]').click(); await p.waitForTimeout(900);
    pass(await tour(p).count() === 1, '"Show me" starts the tour');
    pass(await tour(p).getAttribute('data-step') === 'meaning', 'and it starts on the meaning step, not on hello');
    pass(await chat(p).count() === 0, 'the chat closes when the tour takes over');
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== a question Robo does not know gets a fallback, not a guess');
  { const { p, ctx } = await open();
    await openFromHelp(p);
    await ask(p, 'banane volante');
    pass(await chat(p).locator('[data-testid="robo-answer"]').getAttribute('data-topic') === 'none', 'the answer says it has none');
    pass(/risk, confidence, tracking/.test(await chat(p).innerText()), 'and lists words that work');
    pass(await chat(p).locator('[data-testid="robo-show"]').count() === 0, 'no "Show me" for an unknown question');
    await chat(p).getByRole('button', { name: 'Ask another question' }).click(); await p.waitForTimeout(300);
    pass(await chat(p).getAttribute('data-stage') === 'ask', '"Ask another question" returns to the input');
    await ctx.close(); }

  console.log('== a tracking question shows the tracking part');
  { const { p, ctx } = await open();
    await openFromHelp(p);
    await ask(p, 'Where is my suivi? Tasks and owners');
    pass(/Tracking/.test(await chat(p).innerText()), 'the tracking answer names Tracking');
    await chat(p).locator('[data-testid="robo-show"]').click(); await p.waitForTimeout(900);
    pass(await tour(p).getAttribute('data-chapter') === 'tracking', 'the tour opens on the tracking part');
    pass(await tour(p).getAttribute('data-step') === 'part-tracking-board', 'at its first step');
    await ctx.close(); }

  console.log('== Escape closes the chat');
  { const { p, ctx } = await open();
    await openFromHelp(p);
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    pass(await chat(p).count() === 0, 'Escape closes Robo');
    await ctx.close(); }

  console.log('== the top bar opens Robo on the dashboard');
  { const { p, ctx } = await open();
    pass(await p.locator('[data-robo-topbar]').count() === 1, 'one Ask Robo button in the top bar, on the dashboard');
    await p.locator('[data-robo-topbar]').click(); await p.waitForTimeout(600);
    pass(await chat(p).count() === 1 && await chat(p).getAttribute('data-stage') === 'ask', 'it opens the input');
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== the top bar button is on the other pages too');
  { const { p, ctx } = await open();
    await p.locator('aside [data-nav="tracking"]').first().click(); await p.waitForTimeout(900);
    pass(await p.locator('[data-robo-topbar]').count() === 1, 'the Tracking page has the button');
    await p.locator('[data-robo-topbar]').click(); await p.waitForTimeout(600);
    pass(await chat(p).count() === 1 && await chat(p).getAttribute('data-stage') === 'ask', 'and it opens the input there');
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== French, dark, and a phone');
  { const { p, ctx } = await open({ lang: 'fr', theme: 'dark', vw: 390, vh: 844 });
    // The top bar has no room for a button on a phone: the head launcher in the corner is the way in.
    pass(await p.locator('[data-robo-topbar]').isHidden(), 'the top bar button is hidden on a phone');
    const launcher = p.locator('[data-robo-launcher]');
    pass(await launcher.isVisible(), 'a Robo launcher shows in the corner on a phone');
    pass(await launcher.getAttribute('aria-label') === 'Demander à Robo', 'and its label is French');
    const box = await launcher.boundingBox();
    pass(box && box.x >= 0 && box.x + box.width <= 390, 'the launcher stays inside the screen');
    await launcher.click(); await p.waitForTimeout(600);
    pass(await chat(p).count() === 1, 'the launcher opens the chat');
    await ask(p, 'confiance');
    pass(/Voulez-vous que je vous montre maintenant/.test(await chat(p).innerText()), 'the follow-up is in French');
    pass(/Montrez-moi/.test(await chat(p).innerText()) && /Pas maintenant/.test(await chat(p).innerText()), 'the buttons are in French');
    const card = await chat(p).boundingBox();
    pass(card && card.x >= 0 && card.x + card.width <= 390, 'the chat fits inside a 390 px screen');
    pass(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no horizontal page scroll at 390 px');
    await p.screenshot({ path: 'robochat-390-dark.png' });
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall pass');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
