// L4 trust layer: a source that did not answer is "not measured", never a calm zero.
//
// The API answers a failed list read with HTTP 200, an empty list and an
// error beside it ({"alerts": [], "error_code": ...}, {"recommendations": [],
// "error": ...}). The app used to read that as "no alerts" and drew a quiet
// screen over a broken source. This suite breaks the source four ways (that
// answer, HTTP 500, no network, an unconfigured database) and checks that every
// screen that reads it says so: the notice with a retry that works, a dash
// where a count would be, no "OK", no "all clear", no "no data yet". It also
// checks the other half of L4 on the views that had no note: a department that
// went silent. lib/answer.ts is tested on its own first.
process.env.TZ = 'Europe/Paris';
const fs = require('fs');
const path = require('path');
const ts = require(path.join(__dirname, '..', '..', 'node_modules', 'typescript'));
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const ROOT = path.join(__dirname, '..', '..');

// ---------------------------------------------------------------- lib/answer.ts
function loadAnswer() {
  const src = fs.readFileSync(path.join(ROOT, 'lib', 'answer.ts'), 'utf8');
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  new Function('module', 'exports', js)(mod, mod.exports);
  return mod.exports;
}
const reply = (status, body, json) => ({ ok: status >= 200 && status < 300, status, json: json || (async () => body) });

(async () => {
  console.log('== lib/answer.ts: did the source answer, or only look like it did');
  {
    const { listFrom, readList } = loadAnswer();
    const rows = [{ id: 1 }, { id: 2 }];
    let a = listFrom(rows, 'alerts');
    pass(a.ok && a.rows.length === 2, 'a bare array (what /alerts sends when it worked) is the rows');
    a = listFrom([], 'alerts');
    pass(a.ok && a.rows.length === 0, 'a bare empty array is an answer: no alerts');
    a = listFrom({ alerts: [], error_code: 'alerts_query_failed', error_detail: 'x' }, 'alerts');
    pass(!a.ok && a.reason === 'alerts_query_failed', 'the failed /alerts answer (200, empty list, error_code) is not an empty list');
    a = listFrom({ alerts: [], error_code: 'supabase_unconfigured' }, 'alerts');
    pass(!a.ok && a.reason === 'supabase_unconfigured', 'an unconfigured database is not an empty list either');
    a = listFrom({ count: 0, recommendations: [], error: 'The recommendations could not be loaded, try again.' }, 'recommendations');
    pass(!a.ok && a.reason === 'error', 'the failed /recommendations answer (an error text, no code) is not an empty list');
    a = listFrom({ count: 2, recommendations: rows }, 'recommendations');
    pass(a.ok && a.rows.length === 2, 'a list under its key is the rows');
    a = listFrom({ contractors: [], error_code: 'crm_query_failed', error_detail: 'x' }, 'contractors');
    pass(!a.ok && a.reason === 'crm_query_failed', 'the Field team answers fail the same way');
    a = listFrom({ alerts: rows, error_code: 'partial' }, 'alerts');
    pass(!a.ok, 'an error beside rows wins: the rows of a failed read are not a measurement');
    a = listFrom({ alerts: rows, error_code: '   ' }, 'alerts');
    pass(a.ok, 'a blank error_code is no error');
    for (const [label, body] of [['an empty object', {}], ['null', null], ['a string', 'ok'], ['a number', 42], ['an object with another key', { items: rows }], ['a key that is not a list', { alerts: 'none' }]]) {
      a = listFrom(body, 'alerts');
      pass(!a.ok && a.reason === 'unexpected_answer', `${label}: not an answer (unexpected_answer)`);
    }
    a = await readList(reply(500, { detail: 'boom' }), 'alerts');
    pass(!a.ok && a.reason === 'HTTP 500', 'HTTP 500: did not answer, with its status');
    a = await readList(reply(401, {}), 'alerts');
    pass(!a.ok && a.reason === 'HTTP 401', 'HTTP 401: did not answer');
    a = await readList(reply(200, null, async () => { throw new SyntaxError('Unexpected token <'); }), 'alerts');
    pass(!a.ok && a.reason === 'unreadable_answer', 'a body that is not JSON: did not answer');
    a = await readList(reply(200, rows), 'alerts');
    pass(a.ok && a.rows.length === 2, 'HTTP 200 with rows: the rows');
    a = await readList(reply(200, { alerts: [], error_code: 'alerts_query_failed' }), 'alerts');
    pass(!a.ok, 'HTTP 200 with an error_code: did not answer');
  }

  console.log('== source: nothing reads a list from the API without readList');
  {
    const files = [];
    const walk = dir => { for (const f of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) { const rel = path.join(dir, f.name); if (f.isDirectory()) walk(rel); else if (/\.(ts|tsx)$/.test(f.name)) files.push(rel); } };
    ['components', 'lib', 'app'].forEach(walk);
    const readers = files.filter(f => /\/(alerts|recommendations)\?/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
    pass(readers.length >= 7, `found the files that read /alerts or /recommendations (${readers.length})`);
    for (const f of readers) {
      const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
      pass(/\breadList</.test(src) || /\breadList\(/.test(src), `${f} reads it through readList`);
      pass(!/Array\.isArray\(d2?\) \?/.test(src) && !/Array\.isArray\(d\?\.recommendations\)/.test(src), `${f} has no "an object is an empty list" fallback`);
    }
    for (const f of ['components/sentria/not-measured.tsx', 'components/sentria/account-freshness.tsx', 'lib/answer.ts'])
      pass(!/\bdark:/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')), `${f} has no dark: class (tokens only)`);
  }

  // ------------------------------------------------------------------ the browser
  const NOW = Date.now();
  const ago = days => new Date(NOW - days * 86400000).toISOString();
  const ALERTS = Array.from({ length: 6 }, (_, i) => ({ id: i + 1, equipment: `Item ${i + 1}`, sector: 'health', business_type: 'pharmacie', severity: i < 2 ? 'CRITICAL' : 'WARNING', date: ago(0), alert_key: 'health.stock.low', message: `Item ${i + 1}: stock low`, params: [['stock', 5], ['min_stock', 20]] }));
  const RECS = ALERTS.slice(0, 4).map(a => ({ equipment: a.equipment, sector: 'health', business_type: 'pharmacie', severity: a.severity, date: a.date, message: a.message, alert_key: `${a.alert_key}.${a.id}`, recommended_action: `Reorder ${a.equipment}`, action_category: 'stock', confidence: 0.8, risk_score: null }));
  const stamp = (sector, days, scope = 'pharmacie') => ({ freshness: [{ sector, scope, last_upload_at: ago(days), age_days: Math.floor(days), stale: days > 7, rows_processed: 10, alerts_fired: 1 }], persisted: true, stale_after_days: 7 });
  const FRESH = stamp('health', 1), STALE = stamp('health', 12);
  const WEEK_ZEROS = { alerts: 0, critical: 0, warning: 0, previous_alerts: 0, delta: 0, trend: 'flat', resolved: 0, top_offender: null, email: { enabled: false, configured: false } };
  const A_I = (id, eq, sev, message) => ({ id, equipment: eq, sector: 'industry', business_type: 'usine-production', severity: sev, date: ago(0), alert_key: 'industry.generic', message });
  const IND_ROWS = [A_I(1, 'Presse P1', 'CRITICAL', 'Machine failure risk'), A_I(2, 'Moteur M2', 'WARNING', 'Motor vibration high')];
  const A_L = (id, eq, key, sev) => ({ id, equipment: eq, sector: 'logistics', business_type: 'port-conteneurs', severity: sev, date: ago(0), alert_key: key, message: `${eq}: ${key}` });
  const LOG_ROWS = [A_L(1, 'GRUE-02', 'logistics.cycles.critical', 'CRITICAL'), A_L(2, 'QUAI-3', 'logistics.wait.critical', 'WARNING')];

  const LS_HEALTH = { sentria_sector: 'health', sentria_sectors: '["industry","health","energy"]', sentria_business_type: 'pharmacie' };
  const LS_INDUSTRY = { sentria_sector: 'industry', sentria_sectors: '["industry"]', sentria_business_type: 'usine-production', sentria_departments: '{"industry":["usine-production"]}', sentria_equipment: '["machines","motors","production","maintenance-production-link"]' };
  const LS_LOGISTICS = { sentria_sector: 'logistics', sentria_sectors: '["logistics"]', sentria_business_type: 'port-conteneurs', sentria_ops_types: '["port"]', sentria_ops_type: 'port', sentria_departments: '{"logistics":["port-conteneurs"]}', sentria_equipment: '["blockages","wait","cost","anticipate","recommend"]' };

  // How each source answers: ok, or one of the four ways it can fail.
  const FAIL_BODY = {
    alerts: { alerts: [], error_code: 'alerts_query_failed', error_detail: 'The alerts could not be loaded, try again.' },
    recs: { count: 0, recommendations: [], error: 'The recommendations could not be loaded, try again.' },
  };
  const serve = (r, mode, ok, which) => {
    const json = (b, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(b) });
    if (mode === 'http500') return json({ detail: 'boom' }, 500);
    if (mode === 'network') return r.abort();
    if (mode === 'unconfigured') return json(which === 'alerts' ? { alerts: [], error_code: 'supabase_unconfigured', error_detail: 'The database is not configured.' } : { count: 0, recommendations: [], error: 'The database is not configured.' });
    if (mode === 'answerError') return json(FAIL_BODY[which === 'alerts' ? 'alerts' : 'recs']);
    return json(ok);
  };

  const browser = await chromium.launch(LAUNCH);
  async function open({ ls = LS_HEALTH, lang = 'en', theme = 'light', width = 1440, alerts = 'ok', recs = 'ok', alertRows = ALERTS, recRows = RECS, freshness = null, weekly = null, view = null } = {}) {
    const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 1000 }, locale: lang === 'fr' ? 'fr-FR' : 'en-US', timezoneId: 'Europe/Paris' });
    const p = await ctx.newPage(); p._errors = [];
    p.on('pageerror', e => p._errors.push(e.message));
    const api = { alerts, recs, alertRows, recRows, freshness, weekly, calls: { alerts: 0, recs: 0 } };
    await p.route(/onrender\.com\//, r => {
      const path = new URL(r.request().url()).pathname;
      const json = (b, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(b) });
      if (path === '/alerts') { api.calls.alerts++; return serve(r, api.alerts, api.alertRows, 'alerts'); }
      if (path === '/recommendations') { api.calls.recs++; return serve(r, api.recs, { count: api.recRows.length, recommendations: api.recRows }, 'recs'); }
      if (path === '/freshness') return json(api.freshness || { freshness: [], persisted: false, stale_after_days: 7 });
      if (path === '/reports/weekly') return api.weekly ? json(api.weekly) : json({ error_code: 'supabase_unconfigured' });
      return json({ recommendations: [], assignments: [], contractors: [] });
    });
    await p.addInitScript(l => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(l)) localStorage.setItem(k, v); } },
      { sentria_language: lang, sentria_onboarded: 'true', sentria_company_name: 'Acme', sentria_theme: theme, ...ls });
    await signedIn(p, 'u', 'ama@acme.test', { plan: 'entreprise', isAdmin: true });
    await p.goto(APP_URL); await p.waitForTimeout(2200);
    if (view) await go(p, view, width < 500);
    return { ctx, p, api };
  }
  async function go(p, label, phone) {
    if (phone) { await p.getByRole('button', { name: /open.*(menu|navigation)/i }).first().click(); await p.waitForTimeout(400); }
    await p.locator('aside nav button').filter({ hasText: new RegExp('^' + label + '$') }).locator('visible=true').first().click();
    await p.waitForTimeout(1900);
  }
  const text = p => p.locator('main').innerText().then(t => t.replace(/\s+/g, ' '));
  const notices = p => p.locator('[data-source-down]');
  const dashes = p => p.locator('[data-not-measured]');
  const staleNotes = p => p.locator('[data-freshness="stale"]').count();
  const noPageErrors = (p, l) => pass(p._errors.length === 0, `${l}: no page errors ${p._errors.join('|')}`);
  const overflow = p => p.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);

  // ------------------------------------------------------------ the dashboard
  console.log('== dashboard: the source answers with an error beside an empty list');
  {
    const { ctx, p, api } = await open({ alerts: 'answerError' });
    const body = await text(p);
    pass(await notices(p).count() === 1, 'one notice');
    pass(/Not measured: the alerts could not be loaded\./.test(await notices(p).innerText()), 'it says the alerts could not be loaded');
    pass(await notices(p).getAttribute('role') === 'alert', 'it is an alert for a screen reader');
    pass(await dashes(p).count() === 4, `all four KPI tiles show a dash (${await dashes(p).count()})`);
    const tiles = await p.evaluate(() => [...document.querySelectorAll('[data-not-measured]')].map(n => n.closest('.rounded-3xl').innerText.replace(/\s+/g, ' ')));
    pass(tiles.every(t => /Not measured: the alerts did not load/.test(t)), 'each tile says why');
    pass(tiles.every(t => !/\b(OK|Live|Act now|Monitoring|All sources)\b/.test(t)), `no "OK" or "Live" tag over a figure nobody measured (${tiles[1]})`);
    pass(!/No data for/.test(body), 'not "No data for this activity": a file may well have been imported');
    pass(!/No alerts in this period/.test(body) && /Not measured: the alerts did not load/.test(body), 'the chart does not say "No alerts in this period"');
    pass(!/Nothing to break down/.test(body), 'nor does the breakdown say "Nothing to break down"');
    const pills = await p.locator('main button').filter({ hasText: /^(All|Health|Industry|Energy)\s*\d+$/ }).count();
    pass(pills === 0, 'no sector pill carries a count');
    pass(/Cannot load the alerts \(alerts_query_failed\)/.test(body), 'the table says so, with the reason code');
    const head = await p.locator('#alerts-table h3').locator('xpath=following-sibling::span').innerText();
    pass(head.trim() === '—', `its count is a dash, not 0 (${head.trim()})`);
    pass(!/\b0 alerts\b/.test(body), 'and there is no "0 alerts" line');
    // try again
    api.alerts = 'ok';
    const calls = api.calls.alerts;
    await p.locator('[data-source-retry]').click(); await p.waitForTimeout(1500);
    pass(api.calls.alerts === calls + 1, 'Try again asks the API once more');
    await p.waitForTimeout(1500);
    pass(await notices(p).count() === 0 && await dashes(p).count() === 0, 'the notice and the dashes are gone once it answers');
    await p.waitForTimeout(1500);
    const medicines = await p.evaluate(() => { const l = [...document.querySelectorAll('span')].find(s => s.textContent.trim() === 'Medicines affected'); const t = l && l.closest('.rounded-3xl'); return t ? t.innerText.replace(/\s+/g, ' ') : ''; });
    pass(/Medicines affected.* 6$/.test(medicines), `the real figures are there (${medicines})`);
    pass(await p.locator('main button').filter({ hasText: /^(All|Health|Industry|Energy)\s*\d+$/ }).count() >= 1, 'and the sector pills carry their counts again');
    noPageErrors(p, 'answer error');
    await ctx.close();
  }

  for (const [mode, label] of [['http500', 'HTTP 500'], ['network', 'no network'], ['unconfigured', 'an unconfigured database']]) {
    console.log(`== dashboard: ${label}`);
    const { ctx, p } = await open({ alerts: mode });
    pass(await notices(p).count() === 1 && await dashes(p).count() === 4, `${label}: the notice and four dashes`);
    pass(!/No alerts in this period|No data for/.test(await text(p)), `${label}: no calm sentence`);
    noPageErrors(p, label);
    await ctx.close();
  }

  console.log('== dashboard (Health pill): a zero is still a zero when the source answered');
  {
    const { ctx, p } = await open({ alertRows: [], freshness: FRESH });
    await p.getByRole('button', { name: /^Health/ }).first().click(); await p.waitForTimeout(700);
    const body = await text(p);
    pass(await notices(p).count() === 0, 'no notice: it answered');
    pass(/No data for/.test(body), 'recent data and no alerts: it answered, so "No data for Health" stays');
    await ctx.close();
  }

  console.log('== dashboard (Health pill): the source failed');
  {
    const { ctx, p } = await open({ alerts: 'answerError' });
    await p.getByRole('button', { name: /^Health/ }).first().click(); await p.waitForTimeout(700);
    const body = await text(p);
    pass(!/No data for/.test(body) && await notices(p).count() === 1, 'the notice, and not "No data for Health"');
    pass(await dashes(p).count() === 4, 'four dashes');
    await ctx.close();
  }

  console.log('== dashboard: the priorities are their own read');
  {
    const { ctx, p } = await open({ recs: 'answerError', alertRows: ALERTS, freshness: FRESH });
    await p.getByRole('button', { name: /^Health/ }).first().click(); await p.waitForTimeout(700);
    pass(await notices(p).count() === 1 && /The priorities could not be loaded/.test(await notices(p).innerText()), 'the priorities notice, alone');
    pass(await dashes(p).count() === 0, 'the alerts are fine: no dashes');
    pass(/No priority shown here does not mean there are none/.test(await notices(p).innerText()), 'it says an empty panel is not "none"');
    await ctx.close();
    const both = await open({ alerts: 'http500', recs: 'http500' });
    pass(await notices(both.p).count() === 1, 'alerts and priorities both down: one notice, not two');
    await both.ctx.close();
  }

  console.log('== dashboard: the data is old (a clean file 12 days ago, so no alerts)');
  {
    const { ctx, p } = await open({ alertRows: [], freshness: STALE });
    await p.getByRole('button', { name: /^Health/ }).first().click(); await p.waitForTimeout(700);
    const body = await text(p);
    pass(await p.locator('[data-freshness="stale"]').count() === 1, 'the stale note');
    pass(!/No data for/.test(body), 'not "No data for Health": a file was imported 12 days ago');
    pass(await dashes(p).count() === 4, 'four dashes');
    const tiles = await p.evaluate(() => [...document.querySelectorAll('[data-not-measured]')].map(n => n.closest('.rounded-3xl').innerText.replace(/\s+/g, ' ')));
    pass(tiles.every(t => /Not measured: no recent data/.test(t) && !/\b(OK|Live)\b/.test(t)), `each says why, with no tag (${tiles[0]})`);
    pass(!/No alerts in this period/.test(body) && /Not measured: no recent data/.test(body), 'the chart does not say "No alerts in this period"');
    await ctx.close();
  }

  console.log('== dashboard: a priority with a zero is not "all clear" on old data');
  {
    // Priorities for another department exist, so this sector's panel is empty.
    const other = [{ ...RECS[0], sector: 'energy', business_type: null }];
    const fresh = await open({ alertRows: ALERTS, recRows: other, freshness: FRESH, });
    await fresh.p.getByRole('button', { name: /^Health/ }).first().click(); await fresh.p.waitForTimeout(700);
    pass(/Everything here is under control/.test(await text(fresh.p)), 'recent data: "Everything here is under control" stays');
    await fresh.ctx.close();
    const old = await open({ alertRows: ALERTS, recRows: other, freshness: STALE, });
    await old.p.getByRole('button', { name: /^Health/ }).first().click(); await old.p.waitForTimeout(700);
    const t = await text(old.p);
    pass(!/Everything here is under control/.test(t) && /does not say all is well/.test(t), 'old data: it no longer says everything is under control');
    await old.ctx.close();
  }

  console.log('== French');
  {
    const { ctx, p } = await open({ alerts: 'answerError', lang: 'fr' });
    pass(/Non mesuré : les alertes n'ont pas pu être chargées\./.test(await notices(p).innerText()), 'the notice in French');
    pass(/Réessayer/.test(await p.locator('[data-source-retry]').innerText()), 'and its button');
    const tile = await p.evaluate(() => document.querySelector('[data-not-measured]').closest('.rounded-3xl').innerText.replace(/\s+/g, ' '));
    pass(/Non mesuré : les alertes n'ont pas été chargées/.test(tile), `the tile in French (${tile})`);
    await ctx.close();
  }

  // ----------------------------------------------- industry and logistics overviews
  console.log('== industry overview');
  {
    const open2 = async o => { const x = await open({ ls: LS_INDUSTRY, alertRows: IND_ROWS, ...o }); const ind = x.p.getByRole('button', { name: /^Industry/ }).first(); if (await x.p.getByTestId('priority-bento').count() === 0 && await ind.count()) { await ind.click(); await x.p.waitForTimeout(800); } return x; };
    let x = await open2({ alerts: 'answerError' });
    let body = await text(x.p);
    pass(await notices(x.p).count() === 1, 'failed read: the notice');
    pass(await x.p.locator('main span.rounded-full').filter({ hasText: /^Not measured$/ }).count() === 1, 'the header chip says "Not measured" (not "0 signals · 0 critical")');
    pass(!/signals · \d+ critical/.test(body), 'no signal count');
    pass(await dashes(x.p).count() === 4, 'the four KPI cells show dashes');
    pass(!/No industry data/.test(body), 'not "No industry data": nobody knows');
    const bento = await x.p.getByTestId('priority-bento').innerText();
    pass(!/all clear|critical alert|to watch/.test(bento), 'the priority tiles carry no number');
    await x.p.screenshot({ path: 'notmeasured-industry-light.png' });
    noPageErrors(x.p, 'industry');
    await x.ctx.close();

    x = await open2({ alertRows: [], freshness: stamp('industry', 1, 'usine-production') });
    pass(/No industry data/.test(await text(x.p)) && await notices(x.p).count() === 0, 'it answered with nothing: "No industry data" stays');
    pass(await x.p.locator('[data-freshness]').count() === 0, 'recent data: the overview gains no "updated N days ago" line (it speaks up for a failure or old data only)');
    await x.ctx.close();

    x = await open2({ alertRows: [], freshness: stamp('industry', 12, 'usine-production') });
    body = await text(x.p);
    pass(!/No industry data/.test(body) && await dashes(x.p).count() === 4 && /Not measured/.test(body), 'old data and nothing in it: dashes, not "No industry data"');
    pass(await staleNotes(x.p) === 1, 'and the stale note on the overview');
    await x.ctx.close();

    x = await open2({ alertRows: IND_ROWS, freshness: stamp('industry', 12, 'usine-production') });
    const tiles = await x.p.getByTestId('priority-bento').locator(':scope > button').evaluateAll(els => els.map(e => e.innerText.replace(/\s+/g, ' ')));
    pass(/1 critical alert/.test(tiles[0]) && /1 alert to watch/.test(tiles[1]) && !/all clear/.test(tiles.join(' ')), `old data: what happened stays, and no tile says "all clear" (${tiles.map(t => t.slice(-34)).join(' | ')})`);
    await x.ctx.close();

    // A priority's own screen: nothing to show without the rows.
    x = await open2({ alerts: 'answerError' });
    await x.p.getByTestId('priority-bento').locator(':scope > button').first().click(); await x.p.waitForTimeout(900);
    body = await text(x.p);
    pass(await notices(x.p).count() === 1 && !/No machine alert|No alerts? for now|Aucune alerte/.test(body), 'a priority screen: the notice, and not "No machine alert for now"');
    await x.ctx.close();
  }

  console.log('== logistics overview');
  {
    const open2 = async o => { const x = await open({ ls: LS_LOGISTICS, alertRows: LOG_ROWS, ...o }); const log = x.p.getByRole('button', { name: /^Logistics/ }).first(); if (await x.p.getByTestId('priority-bento').count() === 0 && await log.count()) { await log.click(); await x.p.waitForTimeout(800); } return x; };
    let x = await open2({ alerts: 'answerError' });
    let body = await text(x.p);
    pass(await notices(x.p).count() === 1 && await dashes(x.p).count() === 4, 'failed read: the notice and four dashes');
    pass(!/signals · \d+ critical/.test(body), 'no signal count in the header');
    const bento = await x.p.getByTestId('priority-bento').innerText();
    pass(!/nothing blocked|queues? flagged|cost signals?|early warnings?|assets? to act on|under strain|critical signals?/.test(bento), 'no tile says "nothing blocked" over a read that failed');
    await x.p.screenshot({ path: 'notmeasured-logistics-light.png' });
    noPageErrors(x.p, 'logistics');
    await x.ctx.close();

    x = await open2({ alertRows: [], freshness: stamp('logistics', 1, 'port') });
    const empty = await x.p.getByTestId('priority-bento').innerText();
    pass(!/nothing blocked|queues? flagged|early warnings?/.test(empty), 'an account with no alerts yet: no "nothing blocked", the tiles explain themselves');
    pass(await x.p.locator('[data-freshness]').count() === 0, 'recent data: no "updated N days ago" line on the logistics overview either');
    await x.ctx.close();

    x = await open2({ alertRows: LOG_ROWS, freshness: stamp('logistics', 12, 'port') });
    const tiles = await x.p.getByTestId('priority-bento').locator(':scope > button').evaluateAll(els => els.map(e => e.innerText.replace(/\s+/g, ' ')));
    pass(/1 critical signal/.test(tiles[0]), `old data: the critical signal that happened stays (${tiles[0].slice(0, 60)})`);
    pass(!/0 cost signals|0 early warnings|0 assets|0 resources/.test(tiles.join(' ')), 'and no tile counts a zero as good news');
    await x.ctx.close();
  }

  // ------------------------------------------------------------- the other views
  console.log('== Tracking');
  {
    let x = await open({ recs: 'answerError', view: 'Tracking' });
    pass(await notices(x.p).count() === 1 && /Not measured: the recommendations could not be loaded\./.test(await notices(x.p).innerText()), 'the notice');
    pass(/An empty board here would not mean there is nothing to track/.test(await notices(x.p).innerText()), 'it says an empty board would not mean "nothing to track"');
    pass(!/Item \d/.test(await text(x.p)), 'no board');
    x.api.recs = 'ok';
    await x.p.locator('[data-source-retry]').click(); await x.p.waitForTimeout(1500);
    pass(await notices(x.p).count() === 0 && /Item 1/.test(await text(x.p)), 'Try again brings the board back');
    noPageErrors(x.p, 'tracking');
    await x.ctx.close();

    for (const mode of ['http500', 'network']) {
      x = await open({ recs: mode, view: 'Tracking' });
      pass(await notices(x.p).count() === 1, `${mode}: the notice`);
      await x.ctx.close();
    }

    x = await open({ freshness: STALE, view: 'Tracking' });
    pass(await staleNotes(x.p) === 1, 'old data: the stale note on top of the board');
    pass(/Item 1/.test(await text(x.p)), 'the tasks that happened are still there');
    await x.ctx.close();

    x = await open({ freshness: FRESH, view: 'Tracking' });
    pass(await staleNotes(x.p) === 0 && await x.p.locator('[data-freshness]').count() === 0, 'recent data: nothing added to the page (no quiet line either)');
    await x.ctx.close();

    x = await open({ recRows: [], freshness: FRESH, view: 'Tracking' });
    pass(/Everything here is under control/.test(await text(x.p)), 'recent data and an empty board: "Everything here is under control" stays');
    await x.ctx.close();
    x = await open({ recRows: [], freshness: STALE, view: 'Tracking' });
    const empty = await text(x.p);
    pass(await staleNotes(x.p) === 1 && !/Everything here is under control/.test(empty) && /does not say all is well/.test(empty), 'old data and an empty board: the note, and no "Everything here is under control"');
    await x.ctx.close();
  }

  console.log('== Calendar');
  {
    let x = await open({ recs: 'answerError', view: 'Calendar' });
    pass(await notices(x.p).count() === 1 && /Not measured: the deadlines could not be loaded\./.test(await notices(x.p).innerText()), 'the notice');
    const dd = await x.p.locator('main dl dd').allInnerTexts();
    pass(dd.length >= 3 && dd.every(v => v.trim() === '—'), `the three counters are dashes (${dd.join(',')})`);
    const body = await text(x.p);
    pass(!/Nothing to show/.test(body) && /Not measured/.test(body) && /Empty counters here are not readings/.test(body), 'the grid says not measured, and so does the grey panel');
    pass(!/This week: 0 deadlines/.test(body), 'not "This week: 0 deadlines"');
    x.api.recs = 'ok';
    await x.p.locator('[data-source-retry]').click(); await x.p.waitForTimeout(1500);
    const dd2 = await x.p.locator('main dl dd').allInnerTexts();
    pass(await notices(x.p).count() === 0 && dd2.some(v => /^\d+$/.test(v.trim())), `Try again: the counters are numbers (${dd2.join(',')})`);
    noPageErrors(x.p, 'calendar');
    await x.ctx.close();

    x = await open({ recRows: [], freshness: STALE, view: 'Calendar' });
    const dd3 = await x.p.locator('main dl dd').allInnerTexts();
    pass(await staleNotes(x.p) === 1 && dd3.every(v => v.trim() === '—'), `old data and nothing in it: the note, and dashes (${dd3.join(',')})`);
    await x.ctx.close();

    x = await open({ recRows: [], freshness: FRESH, view: 'Calendar' });
    const dd4 = await x.p.locator('main dl dd').allInnerTexts();
    pass(dd4.every(v => v.trim() === '0'), `recent data and nothing in it: a zero is a zero (${dd4.join(',')})`);
    await x.ctx.close();
  }

  console.log('== Report');
  {
    let x = await open({ alerts: 'answerError', view: 'Report' });
    const body = await text(x.p);
    pass(await notices(x.p).count() === 1 && /Not measured: the report cannot be built\./.test(await notices(x.p).innerText()), 'the notice');
    pass(!/No report to produce/.test(body) && await x.p.locator('#sentria-report').count() === 0, 'not "No report to produce", and no report');
    x.api.alerts = 'ok';
    await x.p.locator('[data-source-retry]').click(); await x.p.waitForTimeout(1500);
    pass(await notices(x.p).count() === 0 && await x.p.locator('#sentria-report').count() === 1, 'Try again builds the report');
    noPageErrors(x.p, 'report');
    await x.ctx.close();

    x = await open({ alerts: 'network', view: 'Report' });
    pass(await notices(x.p).count() === 1 && await x.p.locator('#sentria-report').count() === 0, 'no network: the same');
    await x.ctx.close();

    x = await open({ freshness: STALE, weekly: WEEK_ZEROS, view: 'Report' });
    pass(await x.p.locator('#sentria-report [data-freshness="stale"]').count() === 1, 'old data: the stale note is inside the report, so it prints with it');
    const week = await x.p.getByTestId('week-card').innerText();
    pass(!/\b0\b/.test(week.replace(/7 derniers jours|Last 7 days|7 days/g, '')) && (week.match(/Not measured: no recent data/g) || []).length === 3, `the week card: three dashes, no zero (${week.replace(/\s+/g, ' ').slice(0, 110)})`);
    await x.ctx.close();

    x = await open({ freshness: FRESH, weekly: WEEK_ZEROS, view: 'Report' });
    const week2 = await x.p.getByTestId('week-card').innerText();
    pass(!/Not measured/.test(week2) && /\b0\b/.test(week2), 'recent data: the week card keeps its zeros');
    pass(await x.p.locator('[data-freshness]').count() === 0, 'and the report has no note');
    await x.ctx.close();
  }

  console.log('== Profile');
  {
    let x = await open({ alerts: 'answerError', view: 'Profile' });
    const body = await text(x.p);
    pass(await notices(x.p).count() === 1 && /Not measured: the signals could not be loaded\./.test(await notices(x.p).innerText()), 'the notice');
    pass(/Not measured: I could not load your signals/.test(body) && !/imported yet/.test(body), 'the grey panel says the read failed, not "no signal imported yet"');
    const dd = await x.p.locator('main dl dd').filter({ hasText: /^(—|\d+)$/ }).allInnerTexts();
    pass(dd.length >= 4 && dd.every(v => v.trim() === '—'), `the counters are dashes (${dd.join(',')})`);
    pass(await x.p.getByTestId('profile-freshness').count() === 0, 'no "data freshness" card from nothing');
    x.api.alerts = 'ok';
    await x.p.locator('[data-source-retry]').click(); await x.p.waitForTimeout(1500);
    const dd2 = await x.p.locator('main dl dd').filter({ hasText: /^(—|\d+)$/ }).allInnerTexts();
    pass(await notices(x.p).count() === 0 && dd2.some(v => /^[1-9]\d*$/.test(v.trim())), `Try again: numbers (${dd2.join(',')})`);
    noPageErrors(x.p, 'profile');
    await x.ctx.close();

    // The age of the data is the newest upload, not the last alert.
    x = await open({ freshness: STALE, view: 'Profile' });
    const card = await x.p.getByTestId('profile-freshness').innerText();
    pass(/1[12] days ago/.test(card), `old data: the card says how old the file is, not how old the last alert is (${card.replace(/\s+/g, ' ').slice(0, 60)})`);
    await x.ctx.close();
    x = await open({ freshness: FRESH, alertRows: ALERTS.map(a => ({ ...a, date: ago(30) })), view: 'Profile' });
    const card2 = await x.p.getByTestId('profile-freshness').innerText();
    pass(/2\d h ago/.test(card2), `a clean file yesterday and alerts from a month ago: the file's age (${card2.replace(/\s+/g, ' ').slice(0, 60)})`);
    await x.ctx.close();
    x = await open({ view: 'Profile' });
    const card3 = await x.p.getByTestId('profile-freshness').innerText();
    pass(/less than an hour ago|\d+ h ago/.test(card3), `no stamp at all: the last alert still stands in (${card3.replace(/\s+/g, ' ').slice(0, 60)})`);
    await x.ctx.close();
  }

  console.log('== Ask SentrIA');
  {
    let x = await open({ alerts: 'answerError', view: 'Ask SentrIA' });
    const rows = await x.p.evaluate(() => [...document.querySelectorAll('main dt')].map(dt => [dt.textContent.trim(), dt.parentElement.querySelector('dd').textContent.trim()]));
    const read = rows.find(r => /Alerts read/.test(r[0]));
    pass(read && read[1] === '—', `"Alerts read" is a dash (${read && read[1]})`);
    const body = await text(x.p);
    pass(/Open critical\s*—/.test(body), '"Open critical" is a dash');
    pass(/Critical handled\s*—/.test(body) && !/0 \/ 0/.test(body), '"Critical handled" is a dash, not "0 / 0"');
    noPageErrors(x.p, 'ask');
    await x.ctx.close();
    x = await open({ view: 'Ask SentrIA' });
    pass(/Alerts read\s*6/.test(await text(x.p)), 'answered: "Alerts read 6"');
    await x.ctx.close();
  }

  console.log('== the bell');
  {
    const bell = p => p.getByRole('button', { name: /notification/i }).first();
    let x = await open({ alerts: 'answerError' });
    await bell(x.p).click(); await x.p.waitForTimeout(500);
    const dlg = x.p.getByRole('dialog', { name: /Critical alerts/ });
    pass(await dlg.locator('[data-bell-unknown]').count() === 1, 'the list says it could not check');
    pass(!/No critical alert waiting/.test(await dlg.innerText()), 'and does not say "No critical alert waiting"');
    pass(await x.p.locator('.bg-accent.ring-card').count() === 0, 'no unread dot for alerts nobody could read');
    noPageErrors(x.p, 'bell');
    await x.ctx.close();

    x = await open({});
    await bell(x.p).click(); await x.p.waitForTimeout(500);
    const dlg2 = x.p.getByRole('dialog', { name: /Critical alerts/ });
    pass(await dlg2.locator('[data-bell-unknown]').count() === 0 && /Item 1/.test(await dlg2.innerText()), 'answered: the critical alerts are listed, no warning');
    await x.p.keyboard.press('Escape'); await x.p.waitForTimeout(300);
    // Then the API fails: the list it held stays, with the warning.
    x.api.alerts = 'answerError';
    await go(x.p, 'Settings'); await x.p.waitForTimeout(800);
    await bell(x.p).click(); await x.p.waitForTimeout(500);
    const dlg3 = x.p.getByRole('dialog', { name: /Critical alerts/ });
    pass(await dlg3.locator('[data-bell-unknown]').count() === 1 && /Item 1/.test(await dlg3.innerText()), 'a later failure: the list it held stays, with the warning');
    await x.ctx.close();

    x = await open({ alertRows: [] });
    await bell(x.p).click(); await x.p.waitForTimeout(500);
    pass(/No critical alert waiting/.test(await x.p.getByRole('dialog', { name: /Critical alerts/ }).innerText()), 'answered with nothing: "No critical alert waiting" stays');
    await x.ctx.close();
  }

  console.log('== Sites: a site no data has reached is not "running normally"');
  {
    const x = await open({ view: 'Sites' });
    pass(/Critical alerts\s*—/.test(await text(x.p)), 'no sites: the "Critical alerts" total is a dash, not 0');
    await x.p.getByRole('button', { name: 'Add a site' }).locator('visible=true').first().click(); await x.p.waitForTimeout(300);
    await x.p.getByPlaceholder('e.g. Lyon plant').fill('Lyon plant');
    await x.p.getByRole('button', { name: 'Create the site' }).click(); await x.p.waitForTimeout(600);
    let body = await text(x.p);
    pass(await dashes(x.p).count() === 1 && /Needs attention Not measured/.test(body.replace(/ What needs you to look at it\./, '')), '"Needs attention" says "Not measured"');
    pass(!/No problem detected|running normally/.test(body), 'not "No problem detected. The site is running normally."');
    const health = await x.p.evaluate(() => { const t = [...document.querySelectorAll('.rounded-3xl')].find(c => c.firstElementChild && c.firstElementChild.textContent.trim() === 'Site health'); return t ? t.innerText.replace(/\s+/g, ' ') : ''; });
    pass(/—/.test(health) && /Not measured/.test(health) && !/Action required|Operational|Worth watching/.test(health), `the site health is "Not measured", not a ring at zero that says "Action required" (${health})`);
    pass(/Critical alerts\s*—/.test(body) && /Warnings\s*—/.test(body), 'critical alerts and warnings are dashes');
    const arcs = await x.p.evaluate(() => { const t = [...document.querySelectorAll('.rounded-3xl')].find(c => c.firstElementChild && c.firstElementChild.textContent.trim() === 'Site health'); return t ? t.querySelectorAll('svg path[stroke-dasharray]').length : -1; });
    pass(arcs === 0, 'no arc is drawn for the health (a zero-length one with a round cap leaves a dot)');
    const dot = await x.p.evaluate(() => { const t = [...document.querySelectorAll('div')].find(d => /^Last data:/.test(d.textContent.trim()) && d.querySelector(':scope > span.h-2')); return t ? t.querySelector(':scope > span.h-2').className : ''; });
    pass(dot !== '' && !/green/.test(dot), `the dot beside "Last data: No data" is not green (${dot})`);
    await x.p.screenshot({ path: 'notmeasured-site-light.png' });
    await x.p.getByRole('button', { name: 'All sites' }).click(); await x.p.waitForTimeout(500);
    body = await text(x.p);
    pass(/Warnings\s*—\s*Critical\s*—/.test(body), 'the site card: warnings and critical are dashes');
    pass(!/Action required|Operational/.test(body) && /Not measured/.test(body), 'and its health is not measured');
    pass(/Critical alerts\s*—/.test(body), 'the total is a dash while no site has data');
    noPageErrors(x.p, 'sites');
    await x.ctx.close();
  }

  // ------------------------------------------------------------ themes and a phone
  console.log('== colours: the warning tokens, light and dark');
  {
    const tokens = p => p.evaluate(() => { const e = document.createElement('i'); document.body.appendChild(e); e.style.color = 'var(--tag-warning-fg)'; const fg = getComputedStyle(e).color; e.style.color = 'var(--tag-warning-bg)'; const bg = getComputedStyle(e).color; e.remove(); return { fg, bg }; });
    for (const theme of ['light', 'dark']) {
      const { ctx, p } = await open({ alerts: 'answerError', theme });
      const t = await tokens(p);
      const s = await notices(p).evaluate(el => ({ color: getComputedStyle(el).color, bg: getComputedStyle(el).backgroundColor }));
      pass(s.color === t.fg && s.bg === t.bg, `${theme}: the notice is in the warning-tag colours (${s.color} on ${s.bg})`);
      await p.evaluate(() => { const l = [...document.querySelectorAll('span')].find(s => s.textContent.trim() === 'Critical stockouts'); if (l) l.closest('.rounded-3xl').scrollIntoView({ block: 'start' }); }); await p.waitForTimeout(500);
      await p.screenshot({ path: `notmeasured-dashboard-${theme}-1440.png` });
      await ctx.close();
    }
  }

  console.log('== 390 px');
  for (const theme of ['light', 'dark']) {
    for (const [label, o] of [['Dashboard', { alerts: 'answerError' }], ['Tracking', { recs: 'answerError', view: 'Tracking' }], ['Calendar', { recs: 'answerError', view: 'Calendar' }], ['Report', { alerts: 'answerError', view: 'Report' }], ['Profile', { alerts: 'answerError', view: 'Profile' }]]) {
      const { ctx, p } = await open({ ...o, theme, width: 390 });
      const n = notices(p).first();
      const box = await n.boundingBox();
      pass(await notices(p).count() >= 1 && box && box.x >= 0 && box.x + box.width <= 391, `${theme} ${label}: the notice fits the screen`);
      pass(await overflow(p) <= 0, `${theme} ${label}: no sideways scroll`);
      await p.evaluate(() => { const l = [...document.querySelectorAll('span')].find(s => s.textContent.trim() === 'Critical stockouts'); if (l) l.closest('.rounded-3xl').scrollIntoView({ block: 'start' }); }); await p.waitForTimeout(400);
      await p.screenshot({ path: `notmeasured-${label.toLowerCase()}-${theme}-390.png` });
      noPageErrors(p, `${theme} ${label}`);
      await ctx.close();
    }
  }

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL OK');
  process.exit(fails ? 1 : 0);
})();
