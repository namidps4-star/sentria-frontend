// F-CONTRACTOR (notes and photos): the field page lets a person add a note or a photo; the boss reads them in the task detail. (copied set-up) The field link. The boss makes a signed link for one person on one task (a button under "Assigned
// to"); the page it opens is public, shows one task and three answers, sends no account, and says plainly when a
// link is expired, replaced or not yet switched on. French, dark, 390 px.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
const JPEG1 = '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';
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const now = new Date().toISOString();
const R = (eq, key) => ({ equipment: eq, sector: 'health', business_type: 'pharmacie', severity: 'CRITICAL', date: now, message: `MSG ${eq}`, alert_key: key, recommended_action: `ACT ${eq}`, action_category: 'stock', confidence: 0.8 });
const recs = [R('Doliprane', 'health.stock.low'), R('Amoxicilline', 'health.stock.low'), R('Insuline', 'health.stock.low')];
const PEOPLE = [
  { id: 'c1', name: 'Awa Diop', availability: 'available', open_assignments: 0, active: true, role: null, phone: '+2290197123456', sms_ready: true, note: null },
  { id: 'c2', name: 'Bad Number', availability: 'available', open_assignments: 0, active: true, role: null, phone: '12', sms_ready: false, note: null },
  { id: 'c3', name: 'No Number', availability: 'available', open_assignments: 0, active: true, role: null, phone: null, sms_ready: null, note: null },
  { id: 'c4', name: 'Not On Task', availability: 'available', open_assignments: 0, active: true, role: null, phone: '+2290197123457', sms_ready: true, note: null },
];

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async ({ lang = 'en', vw = 1440 } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vw < 500 ? 844 : 1400 }, locale: lang === 'fr' ? 'fr-FR' : 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    // What the server holds. The test changes it to play the part of a reply.
    p._server = [
      { task_key: 'Doliprane-health.stock.low', status: 'todo', priority: 'high', deadline: null, contractor_ids: ['c1', 'c2', 'c3'] },
      { task_key: 'Amoxicilline-health.stock.low', status: 'in_progress', priority: 'medium', deadline: null, contractor_ids: ['c1'] },
      { task_key: 'Insuline-health.stock.low', status: 'todo', priority: 'low', deadline: null, contractor_ids: ['c1'] },
    ];
    p._texts = []; p._answer = { sms: { status: 'placeholder', live: false } }; p._links = []; p._linkAnswer = null; p._reports = [];
    await p.route(/\/assignments\/field-reports\/[^/]+\/photo/, r => r.fulfill({ status: 200, contentType: 'image/jpeg', body: Buffer.from(JPEG1, 'base64') }));
    await p.route(/\/assignments\/field-reports(\?|$)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ available: true, reports: p._reports }) }));
    await p.route(/\/assignments\/field-link/, r => { const b = JSON.parse(r.request().postData()); p._links.push({ b, auth: r.request().headers()['authorization'] }); if (p._linkAnswer) return r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify(p._linkAnswer) }); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 'v1.TESTTOKEN.SIG', expires_at: Math.floor(Date.now() / 1000) + 3 * 86400 }) }); });
    await p.route(/\/alerts(\?|$)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await p.route(/\/recommendations/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ recommendations: recs }) }));
    await p.route(/\/contractors/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ contractors: PEOPLE }) }));
    await p.route(/\/assignments\/sms/, r => { p._texts.push(JSON.parse(r.request().postData())); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(p._answer) }); });
    await p.route(/\/assignments(\?|$)/, r => {
      if (r.request().method() === 'PUT') { const body = JSON.parse(r.request().postData()); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ assignment: body }) }); }
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ assignments: p._server }) });
    });
    await p.addInitScript(l => { const s = { sentria_onboarded: '1', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', sentria_language: l, sentria_company_name: 'Acme' }; for (const k in s) localStorage.setItem(k, s[k]); }, lang);
    await signedIn(p); await p.goto(APP_URL, { waitUntil: 'networkidle' });
    if (vw < 1024) { await p.getByRole('button', { name: /menu/i }).first().click(); await p.waitForTimeout(300); }
    await p.getByRole('button', { name: lang === 'fr' ? /^Suivi$/ : /^Tracking$/ }).first().click(); await p.waitForTimeout(1200);
    return { p, ctx };
  };
  const detail = async (p, eq) => { await p.getByRole('button', { name: `Priority detail for ${eq}` }).click(); await p.waitForTimeout(400); };
  const textButtons = p => p.locator('[data-task-text-send]');


  const detail2 = async (p, eq) => { await p.getByRole('button', { name: `Priority detail for ${eq}` }).click(); await p.waitForTimeout(500); };

  console.log('== the boss reads what came from the field');
  { const { p, ctx } = await open();
    p._reports = [
      { id: 'r1', kind: 'note', note: 'Leak at the base of the pump', created_at: new Date().toISOString(), name: 'Awa' },
      { id: 'r2', kind: 'photo', note: '', created_at: new Date().toISOString(), name: 'Awa' },
    ];
    await detail2(p, 'Doliprane'); await p.waitForTimeout(700);
    pass(await p.getByTestId('field-reports').count() === 1 && /From the field/i.test(await p.getByTestId('field-reports').innerText()), 'the task detail has a From the field section');
    const items = p.getByTestId('field-report-item');
    pass(await items.count() === 2 && /Leak at the base of the pump/.test(await items.nth(0).innerText()) && /Awa/.test(await items.nth(0).innerText()), 'the note is there with the first name');
    pass(await items.nth(1).locator('img').count() === 1 && /^blob:/.test(await items.nth(1).locator('img').getAttribute('src')), 'the photo shows as a picture fetched signed in');
    await p.getByTestId('field-reports').scrollIntoViewIfNeeded(); await p.screenshot({ path: 'fieldreports-board.png' });
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }
  { const { p, ctx } = await open();
    await detail2(p, 'Doliprane'); await p.waitForTimeout(500);
    pass(await p.getByTestId('field-reports').count() === 0, 'with nothing sent there is no section, no clutter');
    await ctx.close(); }

  console.log('== a person adds a note and a photo');
  const visit = async ({ view, failNote = null, failPhoto = null, lang = 'en', theme = 'light', vw = 390, token = 'v1.TOK.SIG' } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: 844 }, locale: lang === 'fr' ? 'fr-FR' : 'en-US', colorScheme: theme });
    const p = await ctx.newPage(); p._errors = []; p._notes = []; p._photos = []; p._headers = [];
    p.on('pageerror', e => p._errors.push(e.message));
    await p.route(/onrender\.com\//, r => {
      const req = r.request(), u = new URL(req.url()); p._headers.push(req.headers());
      if (req.method() === 'GET') return json(r, view);
      if (/\/note$/.test(u.pathname)) { p._notes.push(JSON.parse(req.postData())); return failNote ? json(r, { success: false, error_code: failNote }, 409) : json(r, { id: 'n1' }, 201); }
      if (/\/photo$/.test(u.pathname)) { p._photos.push({ type: req.headers()['content-type'], body: req.postDataBuffer() }); return failPhoto ? json(r, { success: false, error_code: failPhoto }, failPhoto === 'photo_too_big' ? 413 : 409) : json(r, { id: 'p1' }, 201); }
      if (/\/act$/.test(u.pathname)) return json(r, { status: 'done', changed: true });
      return json(r, {});
    });
    await p.goto(APP_URL.replace(/\/$/, '') + '/t/' + token, { waitUntil: 'networkidle' }); await p.waitForTimeout(700);
    return { p, ctx };
  };
  const VIEW = { title: 'Generator G2', problem: 'Fuel at 12%', action: 'Refill before noon', severity: 'CRITICAL', priority: 'high', deadline: '2026-10-20', status: 'todo', name: 'Kofi', lang: 'en', expires: Math.floor(Date.now() / 1000) + 86400, reports: { notes: 0, photos: 0, available: true, max_notes: 5, max_photos: 3 } };
  const pick = (p, w = 3000, h = 2000) => p.evaluate(async ([w, h]) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = '#c33'; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.fillRect(w / 4, h / 4, w / 2, h / 2);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.95)); const f = new File([blob], 'IMG_0042.jpg', { type: 'image/jpeg' });
    const dt = new DataTransfer(); dt.items.add(f); const input = document.querySelector('[data-testid=field-photo-input]'); input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true }));
  }, [w, h]);

  { const { p, ctx } = await visit({ view: VIEW });
    await p.getByTestId('field-note').scrollIntoViewIfNeeded();
    pass(await p.getByTestId('field-note-send').isDisabled(), 'Send note is off until something is written');
    await p.getByTestId('field-note').fill('  Pump is leaking  '); await p.getByTestId('field-note-send').click(); await p.waitForTimeout(500);
    pass(JSON.stringify(p._notes) === '[{"note":"Pump is leaking"}]' && /Note sent/.test(await p.getByTestId('field-report-message').innerText()) && /1 of 5 notes/.test(await p.getByTestId('field-report-count').innerText()), 'a note is sent trimmed, nothing else with it, and the count moves: ' + JSON.stringify(p._notes));
    pass(await p.getByTestId('field-note').inputValue() === '', 'the box is emptied');
    await pick(p); await p.waitForTimeout(1500);
    const ph = p._photos[0];
    pass(p._photos.length === 1 && /multipart\/form-data/.test(ph.type) && ph.body[0] !== undefined, 'a photo is sent as a file upload');
    const bytes = ph.body, text = bytes.toString('latin1');
    pass(text.includes('\xff\xd8\xff') && bytes.length < 1_500_000 && !/IMG_0042/.test(text.replace('photo.jpg', '')), 'it is a JPEG under 1.5 MB, shrunk on the phone (' + Math.round(bytes.length / 1024) + ' KB from a 3000 px picture)');
    pass(/Photo sent/.test(await p.getByTestId('field-report-message').innerText()) && /1 of 3 photos/.test(await p.getByTestId('field-report-count').innerText()), 'it says sent and counts it');
    pass(p._headers.every(h => !h['authorization'] && !h['x-view-as']), 'no sign-in on any of these calls');
    await p.getByTestId('field-report').scrollIntoViewIfNeeded(); await p.screenshot({ path: 'fieldreports-page-light.png' });
    await p.getByTestId('field-done').click(); await p.waitForTimeout(500);
    pass(await p.getByTestId('field-finished').count() === 1 && /1 of 5 notes/.test(await p.getByTestId('field-report-count').innerText()) && /1 of 3 photos/.test(await p.getByTestId('field-report-count').innerText()), 'after Done the same section stays, with the counts kept');
    await p.screenshot({ path: 'fieldreports-page-done.png' });
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }
  { const { p, ctx } = await visit({ view: { ...VIEW, reports: { notes: 5, photos: 3, available: true, max_notes: 5, max_photos: 3 } } });
    pass(await p.getByTestId('field-note').isDisabled() && await p.getByTestId('field-note-send').isDisabled() && await p.getByTestId('field-photo-input').isDisabled(), 'at the limit the note box, Send note and the photo picker are all off');
    pass(/5 of 5 notes · 3 of 3 photos/.test(await p.getByTestId('field-report-count').innerText()), 'and the count says so');
    await ctx.close(); }
  { const { p, ctx } = await visit({ view: { ...VIEW, reports: { notes: 0, photos: 0, available: false, max_notes: 5, max_photos: 3 } } });
    pass(/not available yet/.test(await p.getByTestId('field-report-unavailable').innerText()) && await p.getByTestId('field-note').count() === 0 && await p.getByTestId('field-done').count() === 1, 'before the migration it says so and the three answers still work');
    await ctx.close(); }
  { const { p, ctx } = await visit({ view: VIEW, failNote: 'report_limit' });
    await p.getByTestId('field-note').fill('one more'); await p.getByTestId('field-note-send').click(); await p.waitForTimeout(400);
    pass(/sent the most you can/.test(await p.getByTestId('field-report-message').innerText()) && await p.getByTestId('field-note').inputValue() === 'one more', 'a refusal says why and keeps what was typed');
    await ctx.close(); }
  { const { p, ctx } = await visit({ view: VIEW, failPhoto: 'photo_too_big' });
    await pick(p, 800, 600); await p.waitForTimeout(1200);
    pass(/too big/i.test(await p.getByTestId('field-report-message').innerText()) && /0 of 3 photos/.test(await p.getByTestId('field-report-count').innerText()), 'a refused photo is not counted');
    await ctx.close(); }
  { const { p, ctx } = await visit({ view: { ...VIEW, lang: 'fr' }, lang: 'fr', theme: 'dark' });
    await p.getByTestId('field-note').fill('Fuite au pied de la pompe'); await p.getByTestId('field-note-send').click(); await p.waitForTimeout(500);
    const t = await p.getByTestId('field-report').innerText();
    pass(/ajouter une note ou une photo/i.test(t) && /note envoyée/i.test(t) && /1 note sur 5/.test(t), 'French: ' + t.replace(/\s+/g, ' ').slice(0, 110));
    pass(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll at 390 px');
    await p.getByTestId('field-report').scrollIntoViewIfNeeded(); await p.screenshot({ path: 'fieldreports-page-390-dark-fr.png' });
    await ctx.close(); }

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exit(fails ? 1 : 0);
})();
