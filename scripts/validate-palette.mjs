#!/usr/bin/env node
// Checks the chart palettes in app/globals.css, in light and in dark mode.
// What it reads is what ships: the colours come from the file, not from a copy.
//
//   node scripts/validate-palette.mjs        prints a report, exits 1 on a FAIL
//
// Sets (marked in globals.css with /* palette: <name> */ in each theme block):
//   series        the per-sector line colours (categorical: identity, any order)
//   slice         the donut's slices and its "other" (categorical pastels, biggest
//                 slice first; they sit on the donut's black card, --sidebar)
//   slice-status  the donut's critical and warning slices, on the same card
//
// Rules, per theme (a chart sits on --card, the donut on --sidebar):
//   contrast   every colour reaches 3:1 against its surface (WCAG 1.4.11, graphics)
//   distinct   every pair is at least MIN_DE apart (CIEDE2000)
//   cvd        same, as seen with deuteranopia / protanopia / tritanopia
//   status     no series colour sits in the red / amber hue band the app keeps
//              for critical / warning (series only)
//   ramp       (a set of kind "ramp", none ships today) steps evenly: each
//              neighbour at least MIN_STEP apart, lightness moving one way
// The CVD floor is lower than the plain one: eight categorical colours cannot
// all stay far apart for a colour-blind reader. Identity is also carried by
// the legend and the tooltip, never by colour alone.

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"

export const MIN_CONTRAST = 3
export const MIN_DE = 12
export const MIN_DE_CVD = 7
export const MIN_STEP = 7
/** oklch hue band (degrees) of the status colours: pink-red through amber and olive-yellow. */
export const STATUS_HUES = [-15, 118]
export const MIN_CHROMA_FOR_HUE = 0.04

/* ----------------------------- colour maths ----------------------------- */

const clamp01 = (x) => Math.min(1, Math.max(0, x))
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)

export function parseColor(text) {
  const s = text.trim()
  let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s)
  if (m) {
    let h = m[1]
    if (h.length === 3) h = h.split("").map((c) => c + c).join("")
    const n = parseInt(h, 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => toLinear(v / 255))
  }
  m = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/i.exec(s)
  if (m) return oklchToLinear(+m[1], +m[2], +m[3])
  throw new Error(`cannot read colour "${text}"`)
}

export function oklchToLinear(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map(clamp01)
}

export function linearToOklch([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  const C = Math.hypot(a, bb)
  let h = (Math.atan2(bb, a) * 180) / Math.PI
  if (h < 0) h += 360
  return { L, C, h }
}

export const toHex = (lin) =>
  "#" + lin.map((c) => Math.round(clamp01(toGamma(c)) * 255).toString(16).padStart(2, "0")).join("")

export function luminance([r, g, b]) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

function linearToLab([r, g, b]) {
  const X = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b
  const Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b
  const Z = 0.0193339 * r + 0.119192 * g + 0.9503041 * b
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116)
  const fx = f(X / 0.95047), fy = f(Y), fz = f(Z / 1.08883)
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

/** CIEDE2000 between two linear-sRGB colours. */
export function deltaE(c1, c2) {
  const [L1, a1, b1] = linearToLab(c1)
  const [L2, a2, b2] = linearToLab(c2)
  const rad = (d) => (d * Math.PI) / 180
  const deg = (r) => (r * 180) / Math.PI
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2)
  const Cm = (C1 + C2) / 2
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)))
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2)
  const h = (b, a) => (b === 0 && a === 0 ? 0 : (deg(Math.atan2(b, a)) + 360) % 360)
  const h1p = h(b1, a1p), h2p = h(b2, a2p)
  const dLp = L2 - L1, dCp = C2p - C1p
  let dhp = 0
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p
    if (dhp > 180) dhp -= 360
    else if (dhp < -180) dhp += 360
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(rad(dhp / 2))
  const Lbp = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2
  let hbp = h1p + h2p
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) hbp += h1p + h2p < 360 ? 360 : -360
    hbp /= 2
  }
  const T = 1 - 0.17 * Math.cos(rad(hbp - 30)) + 0.24 * Math.cos(rad(2 * hbp)) +
    0.32 * Math.cos(rad(3 * hbp + 6)) - 0.2 * Math.cos(rad(4 * hbp - 63))
  const dTheta = 30 * Math.exp(-(((hbp - 275) / 25) ** 2))
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7))
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2)
  const Sc = 1 + 0.045 * Cbp, Sh = 1 + 0.015 * Cbp * T
  const Rt = -Math.sin(rad(2 * dTheta)) * Rc
  return Math.sqrt(
    (dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh)
  )
}

// Machado, Oliveira & Fernandes (2009), severity 1.0, applied in linear sRGB.
const CVD = {
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
}

export function simulate(lin, kind) {
  const M = CVD[kind]
  return M.map((row) => clamp01(row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2]))
}

export const CVD_KINDS = Object.keys(CVD)

/* ------------------------------ the checks ------------------------------ */

/** @param {{name:string,color:string}[]} colors  @param {string} bg  @param {{kind:'categorical'|'ramp',status?:boolean}} opt */
export function checkSet(colors, bg, opt) {
  const fails = []
  const parsed = colors.map((c) => ({ ...c, lin: parseColor(c.color) }))
  const bgLin = parseColor(bg)

  for (const c of parsed) {
    const ratio = contrast(c.lin, bgLin)
    if (ratio < MIN_CONTRAST) fails.push(`contrast ${c.name} ${c.color} is ${ratio.toFixed(2)}:1 on its surface (needs ${MIN_CONTRAST}:1)`)
  }

  const pairs = []
  for (let i = 0; i < parsed.length; i++) for (let j = i + 1; j < parsed.length; j++) pairs.push([parsed[i], parsed[j]])

  let worst = Infinity, worstCvd = Infinity
  for (const [a, b] of pairs) {
    if (opt.kind === "ramp" && Math.abs(parsed.indexOf(a) - parsed.indexOf(b)) !== 1) continue
    const de = deltaE(a.lin, b.lin)
    worst = Math.min(worst, de)
    const floor = opt.kind === "ramp" ? MIN_STEP : MIN_DE
    if (de < floor) fails.push(`distinct ${a.name} / ${b.name} are ${de.toFixed(1)} apart (needs ${floor})`)
    for (const kind of CVD_KINDS) {
      const d = deltaE(simulate(a.lin, kind), simulate(b.lin, kind))
      worstCvd = Math.min(worstCvd, d)
      if (opt.kind === "categorical" && d < MIN_DE_CVD) {
        fails.push(`cvd ${a.name} / ${b.name} are ${d.toFixed(1)} apart as ${kind} (needs ${MIN_DE_CVD})`)
      }
    }
  }

  if (opt.kind === "categorical" && opt.status) {
    for (const c of parsed) {
      const { C, h } = linearToOklch(c.lin)
      const hh = h > 180 ? h - 360 : h // pinks that lean red wrap below 0°
      if (C >= MIN_CHROMA_FOR_HUE && hh >= STATUS_HUES[0] && hh <= STATUS_HUES[1]) {
        fails.push(`status ${c.name} ${c.color} sits in the red/amber band (hue ${h.toFixed(0)}°)`)
      }
    }
  }

  if (opt.kind === "ramp") {
    // biggest slice first: lightness moves one way only
    // "other" is a neutral outside the ramp's order; it only has to stay apart from its neighbour
    const Ls = parsed.filter((c) => !c.name.endsWith("-other")).map((c) => linearToOklch(c.lin).L)
    const dir = Math.sign(Ls[Ls.length - 1] - Ls[0])
    for (let i = 1; i < Ls.length; i++) {
      if (Math.sign(Ls[i] - Ls[i - 1]) !== dir) fails.push(`ramp ${parsed[i].name} breaks the lightness order`)
    }
  }

  return { fails, worst, worstCvd }
}

/* ------------------------- reading app/globals.css ------------------------ */

function block(css, header) {
  const at = css.indexOf(header)
  if (at < 0) throw new Error(`no "${header}" block in globals.css`)
  const open = css.indexOf("{", at)
  let depth = 0
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++
    else if (css[i] === "}" && --depth === 0) return css.slice(open + 1, i)
  }
  throw new Error(`unclosed "${header}" block`)
}

const declared = (body, name) => {
  const m = new RegExp(`--${name}:\\s*([^;]+);`).exec(body)
  return m ? m[1].trim() : null
}

/** The three places a theme's tokens live: light, explicit .dark, system dark.
 *  The card colour comes from the theme's own block; the palette from the
 *  block that follows its /* palette:<theme> *\/ marker. */
export function readThemes(css) {
  return {
    light: { ground: block(css, ":root {\n  color-scheme: light;"), palette: block(css, "/* palette:light */") },
    dark: { ground: block(css, ".dark {\n  color-scheme: dark;"), palette: block(css, "/* palette:dark */") },
    "system-dark": { ground: block(css, ":root:not(.light) {\n    color-scheme: dark;"), palette: block(css, "/* palette:system-dark */") },
  }
}

export const SETS = [
  { name: "series", kind: "categorical", status: true, surface: "card", names: ["series-1", "series-2", "series-3", "series-4", "series-5", "series-6", "series-7", "series-8", "series-other"] },
  // The donut's family slices may be lime or pink: their meaning is in the legend,
  // and the status colours have their own pair below.
  { name: "slice", kind: "categorical", status: false, surface: "sidebar", names: ["slice-1", "slice-2", "slice-3", "slice-4", "slice-5", "slice-6", "slice-other"] },
  { name: "slice-status", kind: "categorical", status: false, surface: "sidebar", names: ["slice-critical", "slice-warning"] },
]

export function validate(css) {
  const themes = readThemes(css)
  const report = []
  for (const [theme, { ground, palette }] of Object.entries(themes)) {
    for (const set of SETS) {
      const surface = declared(ground, set.surface ?? "card")
      if (!surface) throw new Error(`--${set.surface ?? "card"} not found for ${theme}`)
      const colors = set.names.map((n) => {
        const v = declared(palette, n)
        if (!v) throw new Error(`--${n} missing in the ${theme} palette block`)
        return { name: n, color: v }
      })
      // "other" is deliberately a neutral: it must clear contrast and stay apart from the rest
      const result = checkSet(colors, surface, { kind: set.kind, status: set.status })
      report.push({ theme, set: set.name, colors, ...result })
    }
  }
  return report
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8")
  const report = validate(css)
  let bad = 0
  for (const r of report) {
    const ok = r.fails.length === 0
    if (!ok) bad++
    console.log(`${ok ? "PASS" : "FAIL"} ${r.theme} / ${r.set}  closest pair ΔE ${r.worst.toFixed(1)}, closest under CVD ${r.worstCvd.toFixed(1)}`)
    for (const f of r.fails) console.log(`     ${f}`)
  }
  console.log(bad ? `\n${bad} palette check(s) failed` : "\nPalettes valid in light, dark and system dark.")
  process.exit(bad ? 1 : 0)
}
