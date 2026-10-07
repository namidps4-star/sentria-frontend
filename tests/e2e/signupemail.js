// F-EMAIL: the sign-up confirmation email. Supabase sends it, from a template
// and a sender set in its dashboard, so the repo keeps the template
// (supabase/templates/confirmation.html) and this test. It checks: the template
// is valid Go template syntax and renders in both languages (with Go's own
// engines when Go is installed); it prints nothing the person typed; its colours
// are the brand tokens and read well in light and dark; it renders properly in a
// browser at 600 and 390 px; and the sign-up call carries the language the
// template reads.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { mockSupabase } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const ROOT = path.join(__dirname, '..', '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const TEMPLATE = 'supabase/templates/confirmation.html';
const URL_SAMPLE = 'https://sentria-test.supabase.co/auth/v1/verify?token=pkce_abc123';

// ---- colours
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const [hi, lo] = [lum(rgb(a)), lum(rgb(b))].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

// ---- the template, rendered. Only the few actions the file uses are understood;
// anything else throws, so a new construct has to be added here on purpose.
function renderTemplate(src, { language, url }) {
  const out = []; const stack = []; let en = false; let trimNext = false;
  const active = () => stack.every(f => f.on);
  const push = text => { if (trimNext) { text = text.replace(/^\s+/, ''); trimNext = false; } if (active()) out.push(text); };
  const re = /\{\{(-?)\s*([\s\S]*?)\s*(-?)\}\}/g; let last = 0; let m;
  while ((m = re.exec(src))) {
    let text = src.slice(last, m.index); if (m[1] === '-') text = text.replace(/\s+$/, '');
    push(text);
    const action = m[2];
    if (action === '$en := and .Data.language (eq .Data.language "en")') en = language === 'en';
    else if (action === 'if $en') stack.push({ cond: en, on: en });
    else if (action === 'else') { const f = stack[stack.length - 1]; f.on = !f.cond; }
    else if (action === 'end') stack.pop();
    else if (action === '.ConfirmationURL') { if (active()) out.push(url); }
    else throw new Error('unsupported template action: ' + action);
    trimNext = m[3] === '-'; last = re.lastIndex;
  }
  push(src.slice(last));
  return out.join('');
}
const ACTIONS = new Set(['$en := and .Data.language (eq .Data.language "en")', 'if $en', 'else', 'end', '.ConfirmationURL']);

// ---- Go's own engines (text/template and html/template), when Go is installed
const GO_SOURCE = `package main

import (
	"fmt"
	htmltemplate "html/template"
	"os"
	texttemplate "text/template"
)

func main() {
	engine, path, lang, url := os.Args[1], os.Args[2], os.Args[3], os.Args[4]
	src, err := os.ReadFile(path)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}
	user := map[string]interface{}{"full_name": "Ama <b>Bold</b>", "company_name": "Clinique <i>Sud</i>"}
	if lang != "-" {
		user["language"] = lang
	}
	data := map[string]interface{}{"ConfirmationURL": url, "Email": "someone@example.com", "SiteURL": "https://app.example.com", "Data": user}
	if engine == "text" {
		t, err := texttemplate.New("t").Parse(string(src))
		if err != nil {
			fmt.Fprintln(os.Stderr, "parse:", err)
			os.Exit(3)
		}
		if err := t.Execute(os.Stdout, data); err != nil {
			fmt.Fprintln(os.Stderr, "execute:", err)
			os.Exit(4)
		}
		return
	}
	t, err := htmltemplate.New("t").Parse(string(src))
	if err != nil {
		fmt.Fprintln(os.Stderr, "parse:", err)
		os.Exit(3)
	}
	if err := t.Execute(os.Stdout, data); err != nil {
		fmt.Fprintln(os.Stderr, "execute:", err)
		os.Exit(4)
	}
}
`;
function buildGo() {
  if (spawnSync('go', ['version']).status !== 0) return null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'signupemail-'));
  fs.writeFileSync(path.join(dir, 'render.go'), GO_SOURCE);
  const bin = path.join(dir, 'render');
  const built = spawnSync('go', ['build', '-o', bin, 'render.go'], { cwd: dir, encoding: 'utf8' });
  return built.status === 0 ? bin : { error: built.stderr };
}

// ---- the brand tokens in sRGB, read the way the page paints them
const block = (css, selector) => { const i = css.indexOf(selector + ' {'); return css.slice(i, css.indexOf('}', i)); };
const token = (b, name) => (b.match(new RegExp('--' + name + ':\\s*([^;]+);')) || [])[1];

(async () => {
  const src = read(TEMPLATE);
  const readme = read('supabase/templates/README.md');

  console.log('== the template: syntax, and nothing a person typed');
  {
    const actions = [...src.matchAll(/\{\{-?\s*([\s\S]*?)\s*-?\}\}/g)].map(m => m[1]);
    const unknown = actions.filter(a => !ACTIONS.has(a));
    pass(unknown.length === 0, `it uses only the few actions the test understands (${actions.length} in all)${unknown.length ? ': ' + unknown.join(' | ') : ''}`);
    const ifs = actions.filter(a => a === 'if $en').length, elses = actions.filter(a => a === 'else').length, ends = actions.filter(a => a === 'end').length;
    pass(ifs === elses && ifs === ends && ifs >= 8, `every if has its else and its end (${ifs})`);
    pass(!/\.Data\.(full_name|company_name|username)|\.Email\b|\.NewEmail|\.Token\b/.test(src), 'it never prints the name, the company, the username or the address: whoever fills the form types those, and the mail reaches the address they typed');
    pass((src.match(/\{\{ \.ConfirmationURL \}\}/g) || []).length === 3, 'the confirmation link is the button, its fallback line and the visible text');
    pass(/and \.Data\.language \(eq \.Data\.language "en"\)/.test(src), 'a missing language does not break it (and stops at the empty value)');
  }

  console.log('== the template, rendered: English, French, and no language');
  const html = {};
  for (const [name, language] of [['en', 'en'], ['fr', 'fr'], ['none', undefined], ['other', 'es']]) {
    html[name] = renderTemplate(src, { language, url: URL_SAMPLE });
  }
  {
    const text = h => h.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    pass(/Confirm your email/.test(html.en) && /Confirm my email/.test(html.en) && !/Confirmez|Confirmer mon/.test(html.en), 'English: the English words, none of the French');
    pass(/Confirmez votre email/.test(html.fr) && /Confirmer mon email/.test(html.fr) && !/Confirm your email|Confirm my email/.test(html.fr), 'French: the French words, none of the English');
    pass(html.none === html.fr && html.other === html.fr, 'no language, or a language the interface lacks: French');
    pass(/<html lang="en">/.test(html.en) && /<html lang="fr">/.test(html.fr), 'the page language follows');
    pass(!/\{\{|\}\}/.test(html.en + html.fr), 'nothing of the template is left in what is sent');
    const links = h => [...h.matchAll(/href="([^"]*)"/g)].map(m => m[1]);
    pass(links(html.en).length === 2 && links(html.fr).length === 2 && [...links(html.en), ...links(html.fr)].every(l => l === URL_SAMPLE), 'two links in each language, both the confirmation address');
    pass(text(html.en).split(URL_SAMPLE).length - 1 === 1 && text(html.fr).split(URL_SAMPLE).length - 1 === 1, 'the address is also written out once, for a button that will not open');
    const tags = h => (h.match(/<[a-z0-9]+/g) || []).join(',');
    pass(tags(html.en) === tags(html.fr), 'both languages have exactly the same structure');
    pass(!/[—–]/.test(html.en + html.fr), 'no dash used as punctuation, in either language');
    pass(/Click the button to confirm your address/.test(html.en) && /Cliquez sur le bouton pour confirmer votre adresse/.test(html.fr) && /Didn't ask for this account\?/.test(html.en) && /Vous n'avez pas demandé ce compte \?/.test(html.fr), 'what to do, and what to do if it was not you, in each language');
    const hidden = h => (h.match(/mso-hide:all[^>]*>([^<]*)</) || [])[1];
    pass(/open your account/.test(hidden(html.en)) && /ouvrir votre compte/.test(hidden(html.fr)), 'the preview line an inbox shows is set, in each language');
  }

  console.log('== Go\'s own template engines');
  {
    const bin = buildGo();
    if (bin === null) console.log('   SKIP Go is not installed: the template was rendered by the test\'s own reader only');
    else if (bin.error) pass(false, 'the Go renderer did not build: ' + bin.error);
    else {
      const file = path.join(ROOT, TEMPLATE);
      for (const engine of ['text', 'html']) {
        const same = [];
        for (const [name, language] of [['en', 'en'], ['fr', 'fr'], ['none', '-'], ['other', 'es']]) {
          const run = spawnSync(bin, [engine, file, language, URL_SAMPLE], { encoding: 'utf8' });
          same.push(run.status === 0 && run.stdout === html[name] ? null : `${name}: exit ${run.status} ${run.stderr.trim()}`);
        }
        pass(same.every(x => x === null), `${engine}/template parses and renders the same bytes as the test's reader in all four cases${same.filter(Boolean).length ? ' (' + same.filter(Boolean).join('; ') + ')' : ''}`);
      }
      const real = spawnSync(bin, ['html', file, 'en', 'https://x.supabase.co/auth/v1/verify?token=abc&type=signup&redirect_to=https://app.example.com'], { encoding: 'utf8' });
      pass(real.status === 0 && (real.stdout.match(/href="https:\/\/x\.supabase\.co\/auth\/v1\/verify\?token=abc&amp;type=signup&amp;redirect_to=https:\/\/app\.example\.com"/g) || []).length === 2, 'a real confirmation address, with its ampersands, comes out escaped for HTML in both links');
      const injected = spawnSync(bin, ['html', file, 'en', URL_SAMPLE], { encoding: 'utf8' }).stdout;
      pass(!/<b>Bold<\/b>|Clinique <i>|Ama/.test(injected), 'a name or company with markup in it does not reach the email');
    }
  }

  console.log('== email-safe HTML');
  {
    pass(!/<script|<link|@import|url\(|<img|<iframe|<form|javascript:/i.test(src), 'no script, no outside style, no image, no form: nothing an email app blocks or distrusts');
    pass(!/var\(--|oklch|color-mix|rgba?\(|hsl/.test(src), 'colours are plain hex, since email apps do not read CSS variables or newer colour syntax');
    pass(!/https?:\/\//.test(src.replace(/\{\{[^}]*\}\}/g, '')), 'no address is written into the template: the only link is the confirmation one');
    pass((src.match(/<table /g) || []).length >= 5 && (src.match(/<table [^>]*role="presentation"/g) || []).length === (src.match(/<table /g) || []).length, 'layout is tables, each marked as presentation for screen readers');
    pass(/<meta name="viewport"/.test(src) && /<meta name="color-scheme" content="light dark">/.test(src) && /@media \(prefers-color-scheme: dark\)/.test(src) && /@media \(max-width: 480px\)/.test(src), 'viewport, colour scheme, a dark block and a phone block are set');
    pass(/-apple-system/.test(src) && !/@font-face|fonts\.googleapis/.test(src), 'the system font stack, no web font to fetch');
    pass(Buffer.byteLength(src) < 12000, `small enough for an email (${Buffer.byteLength(src)} bytes; Gmail clips a message past 102 KB)`);
  }

  console.log('== the colours: the brand tokens, and readable');
  const browser = await chromium.launch(LAUNCH);
  {
    const css = read('app/globals.css'); const light = block(css, ':root'), dark = block(css, '.dark');
    const page = await browser.newPage();
    const paint = css => page.evaluate(c => { const k = document.createElement('canvas'); k.width = k.height = 1; const x = k.getContext('2d', { colorSpace: 'srgb' }); x.fillStyle = '#000'; x.fillStyle = c; x.fillRect(0, 0, 1, 1); const d = x.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]]; }, css);
    const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) <= 2);
    const TOKENS = [
      ['--brand (the lime)', token(light, 'brand'), '#bced31'], ['--brand-foreground (text on lime)', token(light, 'brand-foreground'), '#171e07'],
      ['--sidebar (the black card)', token(light, 'sidebar'), '#141412'], ['--sidebar-foreground (text on black)', token(light, 'sidebar-foreground'), '#f8f8f8'],
      ['--canvas (the cream)', token(light, 'canvas'), '#f8f1e7'], ['--muted-foreground, light', token(light, 'muted-foreground'), '#696965'],
      ['--background, dark', token(dark, 'background'), '#0a0a0a'], ['--muted-foreground, dark', token(dark, 'muted-foreground'), '#a1a1a1'],
    ];
    for (const [name, tokenValue, hex] of TOKENS) {
      const painted = tokenValue ? await paint(tokenValue.trim()) : null;
      pass(painted && near(painted, rgb(hex)) && src.includes(hex), `${name} is ${hex} in the template (the page paints ${painted ? '#' + painted.map(v => v.toString(16).padStart(2, '0')).join('') : 'nothing'})`);
    }
    await page.close();
    const PAIRS = [
      ['the title on the black card', '#f8f8f8', '#141412', 4.5], ['the sentence under it', '#d4d4d2', '#141412', 4.5], ['the small print on the card', '#9f9f9e', '#141412', 4.5],
      ['the written-out link on the card', '#bced31', '#141412', 4.5], ['the button text on lime', '#171e07', '#bced31', 4.5], ['the "SentrIA" tag on lime', '#171e07', '#bced31', 4.5],
      ['the line under the card, light', '#696965', '#f8f1e7', 4.5], ['the line under the card, dark', '#a1a1a1', '#0a0a0a', 4.5],
    ];
    for (const [name, fg, bg, min] of PAIRS) pass(src.includes(fg) && src.includes(bg) && ratio(fg, bg) >= min, `${name}: ${fg} on ${bg} is ${ratio(fg, bg).toFixed(1)}:1 (at least ${min})`);
  }

  console.log('== in a browser: English and French, light and dark, 600 and 390 px');
  for (const language of ['en', 'fr']) {
    for (const scheme of ['light', 'dark']) {
      for (const width of [600, 390]) {
        const label = `${language} ${scheme} ${width} px`;
        const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, locale: language === 'en' ? 'en-US' : 'fr-FR' });
        const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
        await p.setContent(html[language], { waitUntil: 'load' });
        const m = await p.evaluate(() => {
          const button = document.querySelector('.btn a'); const b = button.getBoundingClientRect(); const card = document.querySelector('.card'); const c = card.getBoundingClientRect();
          const written = [...document.querySelectorAll('a')].find(a => a !== button); const w = written.getBoundingClientRect();
          const h1 = document.querySelector('h1'); const below = document.querySelector('.below');
          return { href: button.getAttribute('href'), btn: { w: b.width, h: b.height, left: b.left, right: b.right }, card: { w: c.width, left: c.left, right: c.right, radius: getComputedStyle(card).borderRadius, bg: getComputedStyle(card).backgroundColor },
            written: { right: w.right, left: w.left }, h1: { size: getComputedStyle(h1).fontSize, colour: getComputedStyle(h1).color }, page: getComputedStyle(document.body).backgroundColor, below: getComputedStyle(below).color,
            over: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth, title: document.title, lang: document.documentElement.lang };
        });
        pass(m.href === URL_SAMPLE && m.btn.h >= 44, `${label}: the button opens the confirmation address and is ${Math.round(m.btn.h)} px tall (44 or more to tap)`);
        pass(width === 390 ? m.btn.w >= m.card.w - 22 * 2 - 4 : m.btn.w >= 140 && m.btn.w <= 300, `${label}: the button is ${Math.round(m.btn.w)} px wide, ${width === 390 ? 'the full width of the card on a phone' : 'as wide as its words, not a bar'}`);
        pass(m.card.w <= 520.5 && m.card.left >= 15 && m.card.right <= width - 15 && m.over <= 0, `${label}: the card is ${Math.round(m.card.w)} px, inside the screen with its margin, no sideways scroll (${m.over})`);
        pass(m.written.left >= m.card.left && m.written.right <= m.card.right, `${label}: the written-out address wraps inside the card`);
        pass(m.card.radius === '24px' && m.card.bg === 'rgb(20, 20, 18)', `${label}: a black card with the app's 24 px corners`);
        pass(m.h1.size === (width === 390 ? '24px' : '28px'), `${label}: the title is ${m.h1.size}`);
        pass(m.page === (scheme === 'dark' ? 'rgb(10, 10, 10)' : 'rgb(248, 241, 231)') && m.below === (scheme === 'dark' ? 'rgb(161, 161, 161)' : 'rgb(105, 105, 101)'), `${label}: the page is ${m.page}, the line under the card ${m.below}`);
        pass(m.lang === language && new RegExp(language === 'en' ? 'Confirm your email' : 'Confirmez votre email').test(m.title), `${label}: the page language and the title (${m.title})`);
        await p.screenshot({ path: `signup-email-${language}-${scheme}-${width}.png`, fullPage: true });
        pass(p._errors.length === 0, `${label}: no page errors ${p._errors.join('|')}`);
        await ctx.close();
      }
    }
  }

  console.log('== the sign-up call carries the language the person saw');
  const signUp = async ({ stored, toggle, width = 1440 }) => {
    const ctx = await browser.newContext({ viewport: { width, height: 1000 }, locale: 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    await p.route(/onrender\.com\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"recommendations":[],"assignments":[],"contractors":[]}' }));
    if (stored) await p.addInitScript(l => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.setItem('sentria_language', l); } }, stored);
    const log = await mockSupabase(p, { users: {}, accounts: {}, taken: [] });
    await p.goto(APP_URL); await p.waitForTimeout(900);
    const startsFrench = stored !== 'en';
    if (toggle) { await p.getByRole('group', { name: /Language|Langue/ }).getByRole('button', { name: toggle.toUpperCase() }).click(); await p.waitForTimeout(300); }
    const french = toggle ? toggle === 'fr' : startsFrench;
    await p.getByRole('button', { name: french ? 'Créer un compte' : 'Create one' }).click(); await p.waitForTimeout(300);
    await p.fill('#auth-name', 'Afi'); await p.fill('#auth-username', 'afi_sud'); await p.fill('#auth-company', 'Clinique Sud'); await p.fill('#auth-email', 'afi@clinique.bj'); await p.fill('#auth-password', 'longenough1'); await p.waitForTimeout(900);
    await p.getByRole('button', { name: french ? /Créer mon compte/ : /Create my account/ }).click(); await p.waitForTimeout(900);
    const call = log.find(l => l.path === '/auth/v1/signup');
    const out = { call, errors: p._errors, text: await p.evaluate(() => document.body.innerText) };
    await ctx.close(); return out;
  };
  {
    const en = await signUp({ stored: 'en' });
    pass(en.call && en.call.body.data.language === 'en', `interface in English: the call says language "${en.call && en.call.body.data.language}"`);
    pass(en.call && en.call.body.data.full_name === 'Afi' && en.call.body.data.company_name === 'Clinique Sud' && en.call.body.data.username === 'afi_sud', 'the name, company and username are sent as before');
    pass(en.call && /redirect_to=/.test(en.call.query), 'the redirect to the app is still asked for');
    pass(/Open the email sent to afi@clinique\.bj/.test(en.text), 'and the screen still says to open the email');
    const fr = await signUp({ stored: 'fr' });
    pass(fr.call && fr.call.body.data.language === 'fr', `interface in French: language "${fr.call && fr.call.body.data.language}"`);
    const toggled = await signUp({ stored: 'en', toggle: 'fr' });
    pass(toggled.call && toggled.call.body.data.language === 'fr', `English first, then the FR switch on the sign-up screen: language "${toggled.call && toggled.call.body.data.language}" (the email follows what is on screen when they press the button)`);
    const back = await signUp({ stored: 'fr', toggle: 'en' });
    pass(back.call && back.call.body.data.language === 'en', `French first, then EN: language "${back.call && back.call.body.data.language}"`);
    const other = await signUp({ stored: 'sw' });
    pass(other.call && other.call.body.data.language === 'fr', `a language the interface does not have (Kiswahili) shows French, so the call says "${other.call && other.call.body.data.language}"`);
    const phone = await signUp({ stored: 'en', width: 390 });
    pass(phone.call && phone.call.body.data.language === 'en', 'at 390 px too');
    pass([en, fr, toggled, back, other, phone].every(x => x.errors.length === 0), 'no page errors');
  }

  console.log('== the README says what to do');
  {
    pass(/Email Templates/.test(readme) && /Confirm signup/.test(readme) && /SMTP Settings/.test(readme) && /URL Configuration/.test(readme), 'it names the three places in the dashboard');
    pass(/Never put it in the repo/.test(readme) && !/re_[A-Za-z0-9]{10,}|smtp_pass|password:\s*\S{12,}/i.test(readme), 'it says the SMTP key stays in the dashboard, and holds none');
    pass(/signupemail\.js/.test(readme) && /reset-password/.test(readme), 'it says how to test a change, and what is left');
    pass(!/@(gmail|outlook|hotmail|yahoo)\./i.test(readme + src), 'no personal address in the template or the README');
  }

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL OK'); process.exit(fails ? 1 : 0);
})();
