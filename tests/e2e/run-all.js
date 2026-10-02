// Runs every suite one after the other and prints a summary.
// A suite fails when it prints a FAIL line or exits non-zero.
// realpct.js is left out: it needs a build pointed at fakeapi.js (see README).
const { spawnSync } = require('child_process');
const path = require('path');

const SUITES = ['auth', 'usernames', 'dash2', 'ask', 'showcase', 'onb7', 'admin', 'plans',
  'imports', 'verify', 'b25', 'p2', 'track', 'slide', 'allviews', 'sidebarfit',
  'sheettabs', 'userlogin', 'screens', 'logicompact', 'indtiles', 'teach', 'weekrep', 'money', 'suppress', 'sitegate', 'conf', 'ptier', 'tiertag', 'signout', 'thresholds', 'brand', 'motion', 'palette', 'charts', 'vizlimits', 'phone', 'stepslide', 'fresh', 'capabilities'];
const only = process.argv.slice(2);
const list = only.length ? SUITES.filter(s => only.includes(s)) : SUITES;

let bad = [];
for (const s of list) {
  const r = spawnSync(process.execPath, [path.join(__dirname, s + '.js')], { encoding: 'utf8' });
  const out = (r.stdout || '') + (r.stderr || '');
  const pass = (out.match(/\bPASS\b/g) || []).length;
  const fail = (out.match(/\bFAIL\b/g) || []).length;
  const ok = r.status === 0 && fail === 0;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${s.padEnd(11)} ${pass} passed, ${fail} failed`);
  if (!ok) { bad.push(s); console.log(out.split('\n').filter(l => /FAIL|Error|error/.test(l)).map(l => '     ' + l).join('\n')); }
}
console.log(bad.length ? `\n${bad.length} suite(s) failed: ${bad.join(', ')}` : '\nAll suites passed.');
process.exit(bad.length ? 1 : 0);
