// F-SIGNOUT: the sidebar's sign-out asks first. Cancel, Escape and a click
// outside leave the session untouched; only the confirm signs out, exactly as
// before (pending changes saved, server told, local account values wiped).
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { mockSupabase, session, STORAGE_KEY } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const logout = log => log.filter(l => l.path === '/auth/v1/logout').length;

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async ({ lang = 'en', theme = 'light', vw = 1440, collapsed = false } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: 900 }, locale: lang === 'fr' ? 'fr-FR' : 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    await p.route(/onrender\.com\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: r.request().url().includes('/alerts') ? '[]' : '{"recommendations":[],"assignments":[],"contractors":[]}' }));
    await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } },
      { sentria_onboarded: 'true', sentria_company_name: 'Acme', sentria_sector: 'industry', sentria_sectors: '["industry"]', sentria_language: lang, sentria_theme: theme });
    const db = { users: { 'ama@acme.test': { uid: 'u-1', password: 'x' } }, accounts: {} };
    const log = await mockSupabase(p, db, { profileFromPage: true, plan: 'pro' });
    await p.addInitScript(({ key, s }) => { localStorage.setItem(key, JSON.stringify(s)); localStorage.setItem('sentria_account_owner', 'u-1'); }, { key: STORAGE_KEY, s: session('u-1', 'ama@acme.test', {}) });
    await p.goto(APP_URL); await p.waitForTimeout(2200);
    if (vw < 768) { await p.getByRole('button', { name: /open.*(menu|navigation)/i }).first().click(); await p.waitForTimeout(400); }
    if (collapsed) { await p.getByRole('button', { name: /Collapse/ }).click(); await p.waitForTimeout(500); }
    return { p, ctx, log };
  };
  const signOutBtn = (p, name = /^Sign out$/) => p.locator('aside').getByRole('button', { name });
  const dialog = p => p.getByRole('alertdialog');
  const stillIn = async p => (await p.locator('aside nav').count()) === 1 && (await p.locator('#auth-email').count()) === 0;

  console.log('== a click on Sign out asks first');
  { const { p, ctx, log } = await open();
    await signOutBtn(p).click(); await p.waitForTimeout(300);
    pass(await dialog(p).count() === 1, 'a confirm dialog opens');
    pass(/End your session\?/.test(await dialog(p).innerText()), 'it asks "End your session?"');
    pass(await dialog(p).getByRole('button', { name: 'Cancel' }).count() === 1 && await dialog(p).getByRole('button', { name: 'Sign out' }).count() === 1, 'with Cancel and Sign out');
    pass(await p.evaluate(() => document.activeElement?.textContent?.trim()) === 'Cancel', 'the safe button (Cancel) has the focus');
    pass(logout(log) === 0 && await stillIn(p), 'nothing signed out yet');
    await p.screenshot({ path: 'signout-light.png' });

    console.log('== cancel, Escape and a click outside keep the session');
    await dialog(p).getByRole('button', { name: 'Cancel' }).click(); await p.waitForTimeout(300);
    pass(await dialog(p).count() === 0, 'Cancel closes the dialog');
    pass(logout(log) === 0 && await stillIn(p), 'Cancel: still signed in, server not called');
    pass(await p.evaluate(() => document.activeElement?.textContent?.trim()) === 'Sign out', 'Cancel: focus is back on the Sign out button');

    await signOutBtn(p).click(); await p.waitForTimeout(200); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    pass(await dialog(p).count() === 0 && logout(log) === 0 && await stillIn(p), 'Escape: closed, still signed in');

    await signOutBtn(p).click(); await p.waitForTimeout(200); await p.mouse.click(700, 120); await p.waitForTimeout(300);
    pass(await dialog(p).count() === 0 && logout(log) === 0 && await stillIn(p), 'click outside the card: closed, still signed in');

    await signOutBtn(p).click(); await p.waitForTimeout(200); await dialog(p).locator('h3').click(); await p.waitForTimeout(300);
    pass(await dialog(p).count() === 1, 'a click inside the card does not close it');

    console.log('== confirm signs out exactly as before');
    await p.evaluate(() => localStorage.setItem('sentria_monitoring', '["late-change"]'));
    await dialog(p).getByRole('button', { name: 'Sign out' }).click(); await p.waitForTimeout(1500);
    pass(await p.locator('#auth-email').count() === 1, 'back to the sign-in screen');
    pass(logout(log) === 1, 'server sign-out called once');
    const last = log.filter(l => l.method === 'PATCH').at(-1);
    pass(last && last.body.profile.sentria_monitoring === '["late-change"]', 'the last change was saved before signing out');
    const keys = await p.evaluate(() => Object.keys(localStorage));
    pass(!keys.some(k => k.startsWith('sb-')), 'session removed');
    pass(!keys.some(k => k.startsWith('sentria_') && !['sentria_language', 'sentria_theme'].includes(k)), 'account values wiped');
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== French');
  { const { p, ctx } = await open({ lang: 'fr' });
    await signOutBtn(p, /^Se déconnecter$/).click(); await p.waitForTimeout(300);
    const t = await dialog(p).innerText();
    pass(/Fermer votre session \?/.test(t) && /Annuler/.test(t) && /Se déconnecter/.test(t), 'title and both buttons are in French');
    await ctx.close(); }

  console.log('== collapsed sidebar (icon only)');
  { const { p, ctx, log } = await open({ collapsed: true });
    await p.locator('aside button[aria-label="Sign out"]').click(); await p.waitForTimeout(300);
    pass(await dialog(p).count() === 1, 'the icon button opens the same confirm');
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    pass(await dialog(p).count() === 0 && logout(log) === 0, 'Escape cancels'); await ctx.close(); }

  console.log('== placed over the whole screen, not inside the sidebar');
  { const { p, ctx } = await open();
    await signOutBtn(p).click(); await p.waitForTimeout(300);
    const r = await p.evaluate(() => {
      const d = document.querySelector('[role="alertdialog"]'); const box = d.getBoundingClientRect(); const back = d.parentElement.getBoundingClientRect();
      const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return { centered: Math.abs((box.left + box.width / 2) - innerWidth / 2) < 2, full: back.width >= innerWidth - 1 && back.height >= innerHeight - 1, top: d.contains(top) };
    });
    pass(r.centered, 'centred on the screen'); pass(r.full, 'the backdrop covers the whole screen'); pass(r.top, 'it is on top');
    await ctx.close(); }

  console.log('== dark and phone');
  { const { p, ctx } = await open({ theme: 'dark' });
    await signOutBtn(p).click(); await p.waitForTimeout(300);
    pass(await dialog(p).count() === 1, 'dark: dialog shown'); await p.screenshot({ path: 'signout-dark.png' }); await ctx.close(); }
  { const { p, ctx, log } = await open({ vw: 390 });
    await signOutBtn(p).click(); await p.waitForTimeout(300);
    const r = await p.evaluate(() => {
      const d = document.querySelector('[role="alertdialog"]'); const b = d.getBoundingClientRect();
      const top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      return { inside: b.left >= 0 && b.right <= innerWidth, top: d.contains(top), scroll: document.documentElement.scrollWidth <= innerWidth + 1 };
    });
    pass(r.inside && r.top, '390 px: the dialog fits and is above the open sidebar'); pass(r.scroll, 'no sideways page scroll');
    await p.screenshot({ path: 'signout-390.png' });
    await dialog(p).getByRole('button', { name: 'Cancel' }).click(); await p.waitForTimeout(300);
    pass(logout(log) === 0, '390 px: Cancel keeps the session'); await ctx.close(); }

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL OK'); process.exit(fails ? 1 : 0);
})();
