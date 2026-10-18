// F-TEAMROLES: the boss puts someone in charge of one site. The boss sees a Team card in Settings (invite by email
// with one site, change a person's site, remove them); an employee sees no site menu, no Sites page, no Team card
// and no export or delete, but still their company and site. French, dark and a phone.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const NOW = new Date().toISOString();
const srcs = ['csv', 'api', 'erp', 'iot'].map(type => ({ type, wanted: false, connected: false, synced: false }));
const SITES = [
  { id: 's1', name: 'Cotonou', location: '', sector: 'health', status: 'offline', sources: srcs, created_at: NOW, departments: [], priorities: [], configured: false, alerts: 0, stats: null },
  { id: 's2', name: 'Porto-Novo', location: '', sector: 'health', status: 'offline', sources: srcs, created_at: NOW, departments: [], priorities: [], configured: false, alerts: 0, stats: null },
];

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async ({ role = null, lang = 'en', theme = 'light', vw = 1440, team = [], inviteFails = null } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: 900 }, locale: lang === 'fr' ? 'fr-FR' : 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p._calls = []; p.on('pageerror', e => p._errors.push(e.message));
    let members = team.map(m => ({ ...m }));
    await p.route(/onrender\.com\//, r => {
      const req = r.request(), u = new URL(req.url()), m = req.method(), path = u.pathname;
      if (path === '/sites') return json(r, { sites: role === 'employee' ? [SITES[0]] : SITES, persisted: true, max_sites: 50 });
      if (path === '/team' && m === 'GET') return json(r, { team: members, max: 20 });
      if (path === '/team' && m === 'POST') {
        const body = JSON.parse(req.postData()); p._calls.push({ m, path, body, auth: req.headers()['authorization'] });
        if (inviteFails) return json(r, { success: false, error_code: inviteFails, message: 'x' }, 409);
        members.push({ user_id: 'e1', email: body.email, name: body.name || null, site_ids: body.site_ids }); return json(r, { user_id: 'e1', email: body.email, site_ids: body.site_ids }, 201);
      }
      const one = path.match(/^\/team\/(.+)$/);
      if (one && m === 'PATCH') { const body = JSON.parse(req.postData()); p._calls.push({ m, path, body }); members = members.map(x => x.user_id === one[1] ? { ...x, site_ids: body.site_ids } : x); return json(r, { user_id: one[1], site_ids: body.site_ids }); }
      if (one && m === 'DELETE') { p._calls.push({ m, path }); members = members.filter(x => x.user_id !== one[1]); return json(r, { success: true }); }
      if (path === '/alerts') return json(r, []);
      return json(r, { recommendations: [], assignments: [], contractors: [] });
    });
    await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } },
      { sentria_onboarded: 'true', sentria_company_name: 'Acme', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', sentria_language: lang, sentria_theme: theme });
    await signedIn(p, 'u-1', 'a@b.c', { plan: 'entreprise', ...(role ? { role } : {}) });
    await p.goto(APP_URL, { waitUntil: 'networkidle' }); await p.waitForTimeout(1800);
    return { p, ctx };
  };
  const settings = async (p, lang = 'en', vw = 1440) => {
    if (vw < 1024) { const m = p.getByRole('button', { name: /menu/i }).first(); if (await m.count()) { await m.click(); await p.waitForTimeout(400); } }
    await p.getByRole('button', { name: lang === 'fr' ? /^Paramètres$/ : /^Settings$/ }).first().click(); await p.waitForTimeout(900);
  };

  console.log('== the boss');
  { const { p, ctx } = await open({ team: [{ user_id: 'e0', email: 'awa@acme.test', name: 'Awa', site_ids: ['s1'] }] });
    pass(await p.getByTestId('account-menu-button').count() === 1, 'the site menu is there');
    await settings(p);
    await p.getByTestId('team-card').scrollIntoViewIfNeeded();
    pass(await p.getByTestId('team-member').count() === 1 && /Awa · awa@acme\.test/.test(await p.getByTestId('team-member').innerText()), 'the Team card lists the employee');
    await p.getByTestId('team-email').fill('bako@acme.test');
    await p.getByTestId('team-site').selectOption('s2');
    await p.getByTestId('team-invite').click(); await p.waitForTimeout(700);
    const sent = p._calls.find(c => c.m === 'POST');
    pass(sent && sent.body.email === 'bako@acme.test' && JSON.stringify(sent.body.site_ids) === '["s2"]' && /^Bearer /.test(sent.auth || ''), 'inviting sends the email and one site, signed in');
    pass(/Invitation sent/.test(await p.getByTestId('team-note').innerText()) && await p.getByTestId('team-member').count() === 2, 'a note says it went and the list grows');
    await p.getByTestId('team-member').first().locator('select').selectOption('s2'); await p.waitForTimeout(500);
    pass(p._calls.some(c => c.m === 'PATCH' && c.path === '/team/e0' && JSON.stringify(c.body.site_ids) === '["s2"]'), 'moving a person to another site is a PATCH');
    await p.getByTestId('team-remove').first().click(); await p.waitForTimeout(500);
    pass(p._calls.some(c => c.m === 'DELETE' && c.path === '/team/e0') && await p.getByTestId('team-member').count() === 1, 'removing a person is a DELETE');
    await p.getByTestId('team-card').scrollIntoViewIfNeeded(); await p.screenshot({ path: 'teamroles-boss-light.png' });
    pass(await p.getByTestId('account-export').count() === 1, 'the boss keeps export and delete');
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== a refused invitation');
  { const { p, ctx } = await open({ inviteFails: 'team_email_taken' });
    await settings(p);
    await p.getByTestId('team-email').fill('boss@acme.test'); await p.getByTestId('team-invite').click(); await p.waitForTimeout(600);
    pass(/already has a SentrIA account/.test(await p.getByTestId('team-note').innerText()), 'the note says the address already has an account');
    await ctx.close(); }

  console.log('== the employee');
  { const { p, ctx } = await open({ role: 'employee' });
    pass(await p.getByTestId('account-menu-button').count() === 0, 'no site menu');
    pass(await p.locator('aside nav button', { hasText: /^Sites$/ }).count() === 0, 'no Sites page in the sidebar');
    await settings(p);
    pass(await p.getByTestId('team-card').count() === 0, 'no Team card');
    pass(await p.getByTestId('account-export').count() === 0 && await p.getByTestId('account-delete').count() === 0, 'no export and no delete');
    pass(p._calls.length === 0, 'and no call to /team');
    await p.screenshot({ path: 'teamroles-employee-light.png' });
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== French, dark, phone');
  { const { p, ctx } = await open({ lang: 'fr', theme: 'dark', vw: 390 });
    await settings(p, 'fr', 390);
    await p.getByTestId('team-card').scrollIntoViewIfNeeded();
    pass(/équipe/i.test(await p.getByTestId('team-card').innerText()) && /Inviter/.test(await p.getByTestId('team-card').innerText()), 'French labels');
    pass(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll at 390 px');
    await p.screenshot({ path: 'teamroles-390-dark-fr.png' });
    await ctx.close(); }

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exit(fails ? 1 : 0);
})();
