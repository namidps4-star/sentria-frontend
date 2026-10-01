// F-VIZPREMIUM: the chart colours (--series-N per sector, --slice-N for the
// donut) are validated, not eyeballed. This runs scripts/validate-palette.mjs
// on the shipped app/globals.css in light, dark and system dark, then proves
// the validator can fail: a palette with a flaw must be refused.
// No browser needed.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };

(async () => {
  const V = await import(path.join(ROOT, 'scripts', 'validate-palette.mjs'));
  const css = fs.readFileSync(path.join(ROOT, 'app', 'globals.css'), 'utf8');

  console.log('== the shipped palettes');
  const report = V.validate(css);
  pass(report.length === 6, 'six checks: series and slices, in light, dark and system dark');
  for (const r of report) pass(r.fails.length === 0, `${r.theme} / ${r.set}: ${r.fails.length ? r.fails.join('; ') : `valid (closest pair ${r.worst.toFixed(1)}, under colour blindness ${r.worstCvd.toFixed(1)})`}`);

  console.log('== the tokens are all there, and in step with the code');
  const series = [...css.matchAll(/--series-(\d+):/g)].map(m => +m[1]);
  const order = fs.readFileSync(path.join(ROOT, 'lib', 'chart-series.ts'), 'utf8').match(/SERIES_ORDER = \[([\s\S]*?)\] as const/)[1].match(/"[a-z]+"/g).length;
  const perTheme = new Set(series).size;
  pass(perTheme === order, `${order} sectors in SERIES_ORDER, ${perTheme} --series-N tokens`);
  pass(series.length === perTheme * 3, 'each token is defined in the three theme blocks (light, .dark, system dark)');
  const light = report.find(r => r.theme === 'light' && r.set === 'series').colors.map(c => c.color);
  const dark = report.find(r => r.theme === 'dark' && r.set === 'series').colors.map(c => c.color);
  pass(light.every((c, i) => c !== dark[i]), 'dark mode has its own values, not the light ones');
  const sys = report.find(r => r.theme === 'system-dark' && r.set === 'series').colors.map(c => c.color);
  pass(JSON.stringify(sys) === JSON.stringify(dark), 'system dark carries the same values as explicit dark');

  console.log('== the validator refuses a flawed palette');
  const card = 'oklch(1 0 0)';
  const ok = light.slice(0, 8).map((color, i) => ({ name: 'series-' + (i + 1), color }));
  const run = (colors, opt = { kind: 'categorical', status: true }) => V.checkSet(colors, card, opt).fails;
  pass(run(ok).length === 0, 'control: the light series on their own pass');
  pass(run(ok.map((c, i) => i === 1 ? { ...c, color: ok[2].color } : c)).some(f => /^distinct/.test(f)), 'two series the same colour: refused (distinct)');
  pass(run(ok.map((c, i) => i === 1 ? { ...c, color: '#e8e8e8' } : c)).some(f => /^contrast/.test(f)), 'a colour too pale for the card: refused (contrast)');
  pass(run(ok.map((c, i) => i === 1 ? { ...c, color: '#d02030' } : c)).some(f => /^status/.test(f)), 'a red in the series: refused (status colours are reserved)');
  pass(run(ok.map((c, i) => i === 1 ? { ...c, color: '#c98a00' } : c)).some(f => /^status/.test(f)), 'an amber in the series: refused (status colours are reserved)');
  pass(run(ok.map((c, i) => i === 1 ? { ...c, color: '#0b84a8' } : i === 3 ? { ...c, color: '#0a7ca0' } : c)).some(f => /^distinct|^cvd/.test(f)), 'two near-identical blues: refused');
  const ramp = report.find(r => r.theme === 'light' && r.set === 'slice').colors;
  pass(run(ramp, { kind: 'ramp' }).length === 0, 'control: the light slice ramp passes');
  const swapped = ramp.slice(); [swapped[1], swapped[3]] = [swapped[3], swapped[1]];
  pass(run(swapped, { kind: 'ramp' }).some(f => /^ramp/.test(f)), 'a ramp out of lightness order: refused');
  let threw = false; try { V.validate(css.replace(/--series-3: #[0-9a-f]{6};/, '')); } catch { threw = true; }
  pass(threw, 'a missing token is an error, not a silent pass');

  console.log(fails ? `\n${fails} FAILED` : '\nALL OK');
  process.exit(fails ? 1 : 0);
})();
